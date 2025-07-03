// src/workflow.ts
import { collection, doc, setDoc, terminate, getDoc } from 'firebase/firestore';
import RssParser from 'rss-parser';
import { createHash } from 'crypto';
import { DEFAULT_SOURCES, type NewsSource } from './config/sources';
import { type AnalysisResult, type RSSItem, type ArticleData } from './types';
import { initializeFirebaseApp, initializeFirestore } from './services/firebase';
import { withRetry } from './utils/retry';
import { analyzeArticleWithWorkflow, getWorkflowStatus } from './workflows/analysis-workflow';
import { runAdaptiveScorerWorkflow, checkProfileExists } from './workflows/adaptive-scorer-workflow';
import { loadUserConfig, isConfigValid } from './config/user-config';
import { ChatOpenAI } from '@langchain/openai';
import { scrapeArticleContent, isScrapeable, stripHtmlTags } from './utils/content-scraper';

console.log('Workflow script started...');

// Load user configuration
const userConfig = loadUserConfig();

if (!userConfig || !isConfigValid(userConfig)) {
  console.error('❌ No valid user configuration found. Please configure the app first.');
  process.exit(1);
}

console.log('✅ User configuration loaded successfully');

// 1. --- INITIALIZE SERVICES ---

// Initialize Firebase using centralized service with user config
const firebaseApp = initializeFirebaseApp(userConfig.firebase);
const db = initializeFirestore(firebaseApp);
const articlesCollection = collection(db, 'articles');

const parser = new RssParser();

// Log the active workflow system
getWorkflowStatus().then(status => console.log('📋', status));

// 2. --- FETCHING ARTICLES ---

async function fetchArticlesFromSource(source: NewsSource): Promise<RSSItem[]> {
  try {
    console.log(`Fetching articles from: ${source.url}`);
    const feed = await parser.parseURL(source.url);
    console.log(`Raw feed has ${feed.items.length} items`);
    
    // Return items that have a link and either content OR title (for content scraping)
    // Some feeds (like Hugging Face) have minimal RSS with no content, relying on scraping
    const articlesWithLink = feed.items.filter(item => 
      item.link && item.title
    ) as RSSItem[];
    
    // Filter out articles older than 90 days
    const NINETY_DAYS_AGO = new Date();
    NINETY_DAYS_AGO.setDate(NINETY_DAYS_AGO.getDate() - 90);
    
    const recentArticles = articlesWithLink.filter(item => {
      if (!item.isoDate) {
        // If no date, assume it's recent (some feeds might not have dates)
        console.log(`⚠️  No date found for article: ${item.title}, including anyway`);
        return true;
      }
      
      try {
        const articleDate = new Date(item.isoDate);
        const isRecent = articleDate >= NINETY_DAYS_AGO;
        
        if (!isRecent) {
          console.log(`📅 Skipping old article (${articleDate.toDateString()}): ${item.title}`);
        }
        
        return isRecent;
      } catch (error) {
        // If date parsing fails, include the article
        console.log(`⚠️  Invalid date format for article: ${item.title}, including anyway`);
        return true;
      }
    });
    
    console.log(`📅 Filtered ${articlesWithLink.length} articles to ${recentArticles.length} recent articles (within 90 days)`);
    
    // Limit to first 10 articles to avoid processing too many at once
    const MAX_ARTICLES_PER_FEED = 10;
    const limitedArticles = recentArticles.slice(0, MAX_ARTICLES_PER_FEED);
    
    console.log(`Found ${articlesWithLink.length} articles with links, processing first ${limitedArticles.length}`);
    
    return limitedArticles;
  } catch (error) {
    console.error(`Failed to fetch from ${source.url}:`, error);
    return [];
  }
}

// 3. --- AI ANALYSIS & ADAPTIVE SCORING ---
// The system now supports two modes:
// 1. Legacy Analysis: Uses the original analysis workflow for content processing
// 2. Adaptive Scoring: Uses profile-based scoring when a user profile exists
// 
// The adaptive scorer provides:
// - Profile-based relevance scoring (1-10)
// - Cost-optimized topic filtering with gpt-4o-mini
// - Smart caching to avoid re-processing filtered articles
// - Graceful fallback to unscored articles when no profile exists

/**
 * Topic-only article analysis for users without profiles
 * @param article - The RSS article to analyze
 * @param source - The news source configuration
 * @param userConfig - User configuration including API keys and topic description
 * @returns ArticleData with topic filtering and basic summarization
 */
async function analyzeArticleWithTopicOnly(
  article: RSSItem, 
  source: NewsSource, 
  userConfig: any
): Promise<any> {
  console.log(`🔍 Starting topic-only analysis for: ${article.title}`);
  
  // First, do content scraping (reuse existing logic)
  console.log('📄 Running content scraping...');
  const rssContent = article.content || article.contentSnippet || article.summary || '';
  const url = article.link!;
  
  let scrapingData = {
    rss_excerpt: stripHtmlTags(rssContent),
    full_content_text: stripHtmlTags(rssContent),
    content_source: 'rss' as 'rss' | 'scraped' | 'failed',
    scraping_status: 'failed' as 'pending' | 'success' | 'failed',
    scraping_error: null as string | null,
    content_length: stripHtmlTags(rssContent).length,
  };
  
  // Attempt content scraping if URL is scrapeable
  if (isScrapeable(url)) {
    console.log(`🕷️  Starting content scraping for: ${url}`);
    
    try {
      const scrapedContent = await scrapeArticleContent(url);
      
      if (scrapedContent.success && scrapedContent.content.length > 100) {
        console.log(`✅ Successfully scraped ${scrapedContent.length} characters from: ${article.title}`);
        
        scrapingData = {
          ...scrapingData,
          full_content_text: scrapedContent.content,
          content_source: 'scraped',
          scraping_status: 'success',
          scraping_error: null,
          content_length: scrapedContent.length,
        };
      } else {
        console.log(`⚠️  Scraping failed or insufficient content, using RSS excerpt: ${scrapedContent.error || 'Content too short'}`);
        scrapingData.scraping_error = scrapedContent.error || 'Scraped content too short';
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Content scraping error for ${article.title}:`, errorMessage);
      scrapingData.scraping_error = errorMessage;
    }
  } else {
    console.log(`⏭️  URL not scrapeable: ${url}`);
    scrapingData.scraping_error = 'URL not scrapeable (blocked domain)';
  }
  
  // Initialize OpenAI client
  const openaiClient = new ChatOpenAI({
    apiKey: userConfig.openai.apiKey,
    model: 'gpt-4o-mini',
    temperature: 0.1
  });
  
  // Do topic filtering with GPT-4o-mini
  console.log('🔍 Checking topic relevance...');
  const availableContent = scrapingData.full_content_text || scrapingData.rss_excerpt || 'No content available';
  const contentPreview = availableContent.length > 4000 ? availableContent.substring(0, 4000) + '...' : availableContent;
  
  const topicPrompt = `Is this article relevant to the topic: "${userConfig.appSettings.topicDescription}"?

Article Title: ${article.title}

Article Content:
${contentPreview}

Instructions:
- Consider if the article content directly relates to the specified topic
- Ignore tangential mentions unless they are the main focus
- Look at the main themes, techniques, tools, and subject matter discussed
- Respond with ONLY "yes" or "no" (no additional text)

Response:`;

  try {
    const topicResponse = await openaiClient.invoke([
      {
        role: 'user',
        content: topicPrompt
      }
    ]);
    
    const responseText = (topicResponse.content as string).toLowerCase().trim();
    
    // Parse response
    let isRelevant = false;
    if (responseText.includes('yes') && !responseText.includes('no')) {
      isRelevant = true;
    } else if (responseText.includes('no') && !responseText.includes('yes')) {
      isRelevant = false;
    } else {
      // Ambiguous response - default to not relevant
      console.warn(`⚠️ Ambiguous response: "${responseText}" - defaulting to not relevant`);
      isRelevant = false;
    }
    
    console.log(`✅ Topic relevance check: ${isRelevant ? 'RELEVANT' : 'NOT RELEVANT'}`);
    
    if (!isRelevant) {
      // Article not relevant - mark as topic-filtered
      return {
        ...scrapingData,
        analysis_result: {
          ai_summary: 'Article not relevant to user topic interests',
          ai_score: null,
          category: 'Off-topic'
        },
        topic_filtered: true,
        topic_filtered_at: new Date()
      };
    }
    
    // Article is relevant - generate basic summary with GPT-4o-mini
    console.log('📝 Generating basic summary...');
    const summaryPrompt = `Provide a concise summary of this article in 2-3 sentences. Focus on the main points and key takeaways.

Article Title: ${article.title}

Article Content:
${contentPreview}

Summary:`;
    
    const summaryResponse = await openaiClient.invoke([
      {
        role: 'user',
        content: summaryPrompt
      }
    ]);
    
    const aiSummary = (summaryResponse.content as string).trim();
    
    console.log('✅ Topic-only analysis completed with basic summary');
    
    return {
      ...scrapingData,
      analysis_result: {
        ai_summary: aiSummary,
        ai_score: 5, // Default score for topic-relevant articles
        category: 'Topic-relevant'
      },
      topic_filtered: false
    };
    
  } catch (error) {
    console.error('❌ Topic-only analysis failed:', error);
    // On error, return basic data with no scoring
    return {
      ...scrapingData,
      analysis_result: {
        ai_summary: 'Error during topic analysis',
        ai_score: null,
        category: 'Error'
      },
      topic_filtered: false
    };
  }
}

/**
 * Enhanced article analysis that integrates adaptive scoring
 * @param article - The RSS article to analyze
 * @param source - The news source configuration
 * @param userConfig - User configuration including API keys and topic description
 * @returns ArticleData with either traditional analysis or adaptive scoring
 */
async function analyzeArticleWithAdaptiveScoring(
  article: RSSItem, 
  source: NewsSource, 
  userConfig: any
): Promise<any> {
  console.log(`🔍 Starting enhanced analysis for: ${article.title}`);
  
  // Check if user has a profile for adaptive scoring
  console.log('👤 Checking for user profile...');
  const hasProfile = await checkProfileExists(userConfig);
  
  if (!hasProfile) {
    console.log('ℹ️ No user profile found - using topic-only analysis');
    return await analyzeArticleWithTopicOnly(article, source, userConfig);
  }
  
  // First, run the traditional analysis workflow for content processing and scraping
  console.log('📄 Running content analysis and scraping...');
  const analysisResult = await analyzeArticleWithWorkflow(article, source, userConfig);
  
  if (!analysisResult || !analysisResult.analysis_result) {
    console.log('❌ Content analysis failed, skipping adaptive scoring');
    return analysisResult;
  }
  
  // Create preliminary article data for adaptive scoring
  const preliminaryArticleData: ArticleData = {
    url: article.link!,
    title: article.title!,
    author: article.creator || 'N/A',
    rss_excerpt: analysisResult.rss_excerpt || '',
    full_content_text: analysisResult.full_content_text || '',
    source_name: source.name,
    published_at: article.isoDate ? new Date(article.isoDate) : new Date(),
    fetched_at: new Date(),
    ai_summary: analysisResult.analysis_result.ai_summary || 'No summary provided',
    ai_score: analysisResult.analysis_result.ai_score || 1,
    ai_category: analysisResult.analysis_result.category || 'Unknown',
    is_read: false,
    is_hidden: false,
    is_favorite: false,
    relevant: null,
    content_source: analysisResult.content_source || 'rss',
    scraping_status: analysisResult.scraping_status || 'failed',
    scraping_error: analysisResult.scraping_error || null,
    content_length: analysisResult.content_length || 0,
    // Initialize topic filtering fields
    topic_filtered: false
    // Note: topic_filtered_at is optional and will be set by adaptive scorer if topic filtering occurs
  };
  
  // Run adaptive scoring workflow
  console.log('🎯 Running adaptive scoring workflow...');
  try {
    const scoredArticle = await runAdaptiveScorerWorkflow(
      preliminaryArticleData,
      userConfig.appSettings.topicDescription,
      userConfig
    );
    
    // Update the analysis result with adaptive scoring
    const enhancedResult = {
      ...analysisResult,
      analysis_result: {
        ...analysisResult.analysis_result,
        ai_score: scoredArticle.ai_score,
        ai_summary: scoredArticle.ai_summary,
        category: scoredArticle.ai_category
      },
      // Add topic filtering information
      topic_filtered: scoredArticle.topic_filtered || false,
      ...(scoredArticle.topic_filtered_at && { topic_filtered_at: scoredArticle.topic_filtered_at })
    };
    
    console.log(`✅ Adaptive scoring completed: ${scoredArticle.ai_score ? `${scoredArticle.ai_score}/10` : 'unscored'}`);
    return enhancedResult;
    
  } catch (error) {
    console.error('❌ Adaptive scoring failed, using traditional analysis:', error);
    return analysisResult;
  }
}

// 4. --- MAIN PROCESSING LOOP ---

// Helper to create a unique ID from a URL
const createIdFromUrl = (url: string) => createHash('sha256').update(url).digest('hex');

// 4. --- DUPLICATE DETECTION ---

async function articleExists(articleId: string): Promise<boolean> {
  const result = await withRetry(async () => {
    const docSnap = await getDoc(doc(articlesCollection, articleId));
    return docSnap.exists();
  });
  
  // If retry fails, assume doesn't exist to be safe
  return result ?? false;
}

// 5. --- ARTICLE DATA MAPPING ---

function createArticleData(
  rssItem: RSSItem, 
  analysis: AnalysisResult, 
  source: NewsSource,
  scrapingData: {
    rss_excerpt: string;
    full_content_text: string;
    content_source: 'rss' | 'scraped' | 'failed';
    scraping_status: 'pending' | 'success' | 'failed';
    scraping_error?: string | null;
    content_length: number;
  }
): ArticleData {
  return {
    url: rssItem.link!,
    title: rssItem.title!,
    author: rssItem.creator || 'N/A',
    rss_excerpt: scrapingData.rss_excerpt,
    full_content_text: scrapingData.full_content_text,
    source_name: source.name,
    published_at: rssItem.isoDate ? new Date(rssItem.isoDate) : new Date(),
    fetched_at: new Date(),
    ai_summary: analysis.ai_summary || 'No summary provided',
    ai_score: analysis.ai_score || 1,
    ai_category: analysis.category || 'Unknown',
    is_read: false,
    is_hidden: false,
    is_favorite: false,
    relevant: null,  // Initialize as unrated
    content_source: scrapingData.content_source,
    scraping_status: scrapingData.scraping_status,
    scraping_error: scrapingData.scraping_error,
    content_length: scrapingData.content_length,
  };
}

async function main() {
  console.log(`Processing ${DEFAULT_SOURCES.length} sources...`);
  
  for (const source of DEFAULT_SOURCES) {
    await processSource(source);
  }

  console.log('Workflow finished.');
  
  // Close Firebase connection to allow process to exit
  await terminate(db);
  console.log('Firebase connection closed.');
  
  // Explicitly exit the process
  process.exit(0);
}

async function processSource(source: NewsSource) {
  const articles = await fetchArticlesFromSource(source);
  console.log(`Found ${articles.length} articles from ${source.name}. Processing...`);
  
  await processArticles(articles, source);
}

async function processArticles(articles: RSSItem[], source: NewsSource) {
  for (const article of articles) {
    if (await shouldSkipArticle(article)) continue;
    await processArticle(article, source);
  }
}

async function shouldSkipArticle(article: RSSItem): Promise<boolean> {
  if (!article.link) return true;
  if (!article.title) return true;
  
  // For minimal RSS feeds (like Hugging Face), we rely on content scraping
  // so we don't require content to be present in the RSS feed itself
  return false;
}

async function processArticle(article: RSSItem, source: NewsSource) {
  const articleId = createIdFromUrl(article.link!);
  
  // Phase 3.3: Topic filtering optimization - Check if article already exists and was topic-filtered
  const existingDoc = await withRetry(async () => {
    const docSnap = await getDoc(doc(articlesCollection, articleId));
    return docSnap.exists() ? docSnap.data() : null;
  });
  
  if (existingDoc) {
    if (existingDoc.topic_filtered) {
      console.log(`Article already topic-filtered, skipping: ${article.title}`);
      return;
    } else {
      console.log(`Article already exists, skipping: ${article.title}`);
      return;
    }
  }
  
  console.log(`🔄 Processing article: ${article.title}`);

  // Use the enhanced analysis with adaptive scoring integration
  const analysis = await analyzeArticleWithAdaptiveScoring(article, source, userConfig!);

  if (analysis && analysis.analysis_result) {
    // The enhanced workflow has completed with analysis, scraping, and optional adaptive scoring
    const scrapingData = {
      rss_excerpt: analysis.rss_excerpt || '',
      full_content_text: analysis.full_content_text || '',
      content_source: analysis.content_source || 'rss' as const,
      scraping_status: analysis.scraping_status || 'failed' as const,
      scraping_error: analysis.scraping_error || null,  // Firebase doesn't allow undefined
      content_length: analysis.content_length || 0,
    };
    
    const articleData = createArticleData(article, analysis.analysis_result, source, scrapingData);
    
    // Add topic filtering fields if they exist
    if (analysis.topic_filtered !== undefined) {
      (articleData as any).topic_filtered = analysis.topic_filtered;
      if (analysis.topic_filtered_at) {
        (articleData as any).topic_filtered_at = analysis.topic_filtered_at;
      }
    }
    
    // Save the structured data to Firestore with retry logic
    const saveResult = await withRetry(async () => {
      await setDoc(doc(articlesCollection, articleId), articleData);
      return true;
    });
    
    if (saveResult) {
      const scoringInfo = analysis.topic_filtered 
        ? 'topic-filtered' 
        : (articleData.ai_score ? `scored ${articleData.ai_score}/10` : 'traditional analysis');
      console.log(`✅ Successfully saved article: ${article.title} (${scrapingData.content_source} content, ${scrapingData.content_length} chars, ${scoringInfo})`);
    } else {
      console.error(`❌ Failed to save article after retries: ${article.title}`);
    }
  } else {
    console.log(`⏭️  Skipped article after enhanced analysis: ${article.title}`);
  }
}

main(); 