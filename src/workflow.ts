// src/workflow.ts
import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, terminate } from 'firebase/firestore';
import OpenAI from 'openai';
import RssParser from 'rss-parser';
import { createHash } from 'crypto';

console.log('Workflow script started...');

// 1. --- INITIALIZE SERVICES ---

// Initialize OpenAI client using environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const articlesCollection = collection(db, 'articles');

const parser = new RssParser();

// 2. --- FETCHING ARTICLES ---

async function fetchArticlesFromSource(sourceUrl: string) {
  try {
    console.log(`Fetching articles from: ${sourceUrl}`);
    const feed = await parser.parseURL(sourceUrl);
    console.log(`Raw feed has ${feed.items.length} items`);
    
    // Return items that have a link and some form of content
    const articlesWithContent = feed.items.filter(item => item.link && (item.content || item.contentSnippet || item.summary));
    console.log(`Found ${articlesWithContent.length} articles with content`);
    
    return articlesWithContent;
  } catch (error) {
    console.error(`Failed to fetch from ${sourceUrl}:`, error);
    return [];
  }
}

// 3. --- AI ANALYSIS ---

async function analyzeArticleContent(content: string): Promise<any> {
  const prompt = `
    You are an AI news analyst for a software developer. Analyze the following article and provide a score from 1-10 on its relevance. Your response must be in JSON format.
    Scoring Criteria:
    - High Score (8-10): Announce a new model, library, or tool; provide a technical tutorial.
    - Medium Score (5-7): Discuss benchmark comparisons, best practices.
    - Low Score (1-4): Focus on opinion, social commentary, or company funding.
    Article Content:
    ${content.substring(0, 4000)}

    Your Response (JSON):
    { "ai_score": <score_from_1_to_10>, "category": "<one of: 'New Tool', 'Tutorial', 'Research', 'Analysis', 'Opinion'>", "ai_summary": "<a one-sentence summary>" }
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Or another model you prefer
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" },
    });
    
    const resultJson = response.choices[0].message.content;
    if (!resultJson) {
      console.error('No content received from OpenAI');
      return null;
    }
    return JSON.parse(resultJson);
  } catch (error) {
    console.error('Error analyzing article with OpenAI:', error);
    return null;
  }
}

// 4. --- MAIN PROCESSING LOOP ---

// Helper to create a unique ID from a URL
const createIdFromUrl = (url: string) => createHash('sha256').update(url).digest('hex');

async function main() {
  const sourceUrl = 'https://towardsdatascience.com/feed'; // Start with one source that includes content
  const articles = await fetchArticlesFromSource(sourceUrl);

  console.log(`Found ${articles.length} articles. Processing...`);

  for (const article of articles) {
    if (!article.link) continue;

    // Get the best available content
    const content = article.content || article.contentSnippet || article.summary || '';
    if (!content) continue;

    const articleId = createIdFromUrl(article.link);
    console.log(`Processing article: ${article.title}`);

    // TODO: Add a check here to see if the articleId already exists in Firestore to avoid re-processing.

    const analysis = await analyzeArticleContent(content);

    if (analysis) {
      const articleData = {
        url: article.link,
        title: article.title,
        author: article.creator || 'N/A',
        full_content_text: content,
        source_name: 'Towards Data Science',
        published_at: article.isoDate ? new Date(article.isoDate) : new Date(),
        fetched_at: new Date(),
        ai_summary: analysis.ai_summary || 'No summary provided',
        ai_score: analysis.ai_score || 1,
        ai_category: analysis.category || 'Unknown',
        is_read: false,
        is_hidden: false,
        is_favorite: false,
      };

      // Save the structured data to Firestore
      await setDoc(doc(articlesCollection, articleId), articleData);
      console.log(`Successfully saved article: ${article.title}`);
    }
  }

  console.log('Workflow finished.');
  
  // Close Firebase connection to allow process to exit
  await terminate(db);
  console.log('Firebase connection closed.');
  
  // Explicitly exit the process
  process.exit(0);
}

main(); 