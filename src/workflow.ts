// src/workflow.ts
import { collection, doc, setDoc, terminate, getDoc } from 'firebase/firestore';
import RssParser from 'rss-parser';
import { createHash } from 'crypto';
import { DEFAULT_SOURCES, type NewsSource } from './config/sources';
import { type AnalysisResult, type RSSItem, type ArticleData } from './types';
import { initializeFirebaseApp, initializeFirestore } from './services/firebase';
import { withRetry } from './utils/retry';
import { analyzeArticleWithWorkflow, getWorkflowStatus } from './workflows/analysis-workflow';
import { loadUserConfig, isConfigValid } from './config/user-config';

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
    
    // Return items that have a link and some form of content
    const articlesWithContent = feed.items.filter(item => 
      item.link && (item.content || item.contentSnippet || item.summary)
    ) as RSSItem[];
    console.log(`Found ${articlesWithContent.length} articles with content`);
    
    return articlesWithContent;
  } catch (error) {
    console.error(`Failed to fetch from ${source.url}:`, error);
    return [];
  }
}

// 3. --- AI ANALYSIS (Now handled by LangGraph-style workflow) ---
// The analyzeArticleWithWorkflow function provides:
// - Multi-step preprocessing, analysis, and quality validation
// - Automatic retry logic with improved prompts
// - Better error handling and logging
// - Foundation for future adaptive learning features

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
  
  // Get the best available content
  const content = article.content || article.contentSnippet || article.summary || '';
  if (!content) return true;
  
  return false;
}

async function processArticle(article: RSSItem, source: NewsSource) {
  const articleId = createIdFromUrl(article.link!);
  
  // Check if article already exists to avoid re-processing
  if (await articleExists(articleId)) {
    console.log(`Article already exists, skipping: ${article.title}`);
    return;
  }
  
  console.log(`🔄 Processing article: ${article.title}`);

  // Use the new LangGraph-style workflow for analysis, passing user config
  const analysis = await analyzeArticleWithWorkflow(article, source, userConfig!);

  if (analysis && analysis.analysis_result) {
    // The workflow has completed with both analysis and scraping data
    const scrapingData = {
      rss_excerpt: analysis.rss_excerpt || '',
      full_content_text: analysis.full_content_text || '',
      content_source: analysis.content_source || 'rss' as const,
      scraping_status: analysis.scraping_status || 'failed' as const,
      scraping_error: analysis.scraping_error || null,  // Firebase doesn't allow undefined
      content_length: analysis.content_length || 0,
    };
    
    const articleData = createArticleData(article, analysis.analysis_result, source, scrapingData);
    
    // Save the structured data to Firestore with retry logic
    const saveResult = await withRetry(async () => {
      await setDoc(doc(articlesCollection, articleId), articleData);
      return true;
    });
    
    if (saveResult) {
      console.log(`✅ Successfully saved article: ${article.title} (${scrapingData.content_source} content, ${scrapingData.content_length} chars)`);
    } else {
      console.error(`❌ Failed to save article after retries: ${article.title}`);
    }
  } else {
    console.log(`⏭️  Skipped article after workflow analysis: ${article.title}`);
  }
}

main(); 