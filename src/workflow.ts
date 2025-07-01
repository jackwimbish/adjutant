// src/workflow.ts
import 'dotenv/config';
import { collection, doc, setDoc, terminate, getDoc } from 'firebase/firestore';
import OpenAI from 'openai';
import RssParser from 'rss-parser';
import { createHash } from 'crypto';
import { DEFAULT_SOURCES, type NewsSource } from './config/sources';
import { CONFIG } from './config/settings';
import { type AnalysisResult, type RSSItem, type ArticleData } from './types';
import { buildAnalysisPrompt } from './prompts/analysis-prompt';
import { initializeFirebaseApp, initializeFirestore } from './services/firebase';
import { withRetry } from './utils/retry';

console.log('Workflow script started...');

// 1. --- INITIALIZE SERVICES ---

// Initialize OpenAI client using environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Firebase using centralized service
const firebaseApp = initializeFirebaseApp();
const db = initializeFirestore(firebaseApp);
const articlesCollection = collection(db, 'articles');

const parser = new RssParser();

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

// 3. --- AI ANALYSIS ---

async function analyzeArticleContent(content: string): Promise<AnalysisResult | null> {
  const truncatedContent = content.substring(0, CONFIG.AI_CONTENT_MAX_LENGTH);
  const prompt = buildAnalysisPrompt(truncatedContent);

  return await withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: CONFIG.AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" },
    });
    
    const resultJson = response.choices[0].message.content;
    if (!resultJson) {
      throw new Error('No content received from OpenAI');
    }
    return JSON.parse(resultJson) as AnalysisResult;
  }, 3, 2000); // 3 retries with 2 second base delay
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
  content: string, 
  analysis: AnalysisResult, 
  source: NewsSource
): ArticleData {
  return {
    url: rssItem.link!,
    title: rssItem.title!,
    author: rssItem.creator || 'N/A',
    full_content_text: content,
    source_name: source.name,
    published_at: rssItem.isoDate ? new Date(rssItem.isoDate) : new Date(),
    fetched_at: new Date(),
    ai_summary: analysis.ai_summary || 'No summary provided',
    ai_score: analysis.ai_score || 1,
    ai_category: analysis.category || 'Unknown',
    is_read: false,
    is_hidden: false,
    is_favorite: false,
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
  const content = article.content || article.contentSnippet || article.summary || '';
  const articleId = createIdFromUrl(article.link!);
  
  // Check if article already exists to avoid re-processing
  if (await articleExists(articleId)) {
    console.log(`Article already exists, skipping: ${article.title}`);
    return;
  }
  
  console.log(`Processing article: ${article.title}`);

  const analysis = await analyzeArticleContent(content);

  if (analysis) {
    const articleData = createArticleData(article, content, analysis, source);
    
    // Save the structured data to Firestore with retry logic
    const saveResult = await withRetry(async () => {
      await setDoc(doc(articlesCollection, articleId), articleData);
      return true;
    });
    
    if (saveResult) {
      console.log(`Successfully saved article: ${article.title}`);
    } else {
      console.error(`Failed to save article after retries: ${article.title}`);
    }
  }
}

main(); 