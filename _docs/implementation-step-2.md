# Step 2 (Detailed): Building the Backend Workflow

**Goal:** Create a standalone workflow.ts file in your src directory. This script will handle the entire data pipeline: fetching articles, processing them with AI, and saving them to your database. We'll test this script independently before integrating it with Electron.

## 2.1: Setup and Initialization

First, let's set up the script and initialize the connections to Firebase and OpenAI. You'll also need a simple way to parse RSS feeds, so let's add a helper library for that.

1. Install a new dependency:

```bash
npm install rss-parser
```

2. Create `src/workflow.ts` and add initial code:

This snippet sets up your clients. Remember to manage your OpenAI API key securely; using environment variables is a best practice.

```typescript
// src/workflow.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import OpenAI from 'openai';
import RssParser from 'rss-parser';

console.log('Workflow script started...');

// 1. --- INITIALIZE SERVICES ---

// IMPORTANT: Use environment variables or a secure method for your API key in a real app.
const openai = new OpenAI({
  apiKey: 'YOUR_OPENAI_API_KEY', // Replace with your actual key
});

// Use the Firebase config object you got from your Firebase project settings.
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const articlesCollection = collection(db, 'articles');

const parser = new RssParser();

// We will add more code below...
```

## 2.2: Fetching Articles

Next, let's write a function to fetch articles from a hardcoded RSS feed.

Add this function to `workflow.ts`:

```typescript
async function fetchArticlesFromSource(sourceUrl: string) {
  try {
    console.log(`Fetching articles from: ${sourceUrl}`);
    const feed = await parser.parseURL(sourceUrl);
    // Return only the items that have a link and content
    return feed.items.filter(item => item.link && item.content);
  } catch (error) {
    console.error(`Failed to fetch from ${sourceUrl}:`, error);
    return [];
  }
}
```

## 2.3: Defining the AI Logic

Now, let's define the AI analysis step. For simplicity, we'll make a direct call to OpenAI. As you enhance the project, you can wrap this logic in a more complex LangGraph structure.

Add this analysis function to `workflow.ts`:

```typescript
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
    return JSON.parse(resultJson);
  } catch (error) {
    console.error('Error analyzing article with OpenAI:', error);
    return null;
  }
}
```

## 2.4: The Main Processing Loop

Finally, let's create the main function that ties everything together. It will fetch the articles, loop through them, call the AI for analysis, and save the final, structured object to Firestore.

Add this main function and call it at the end of `workflow.ts`:

```typescript
// Helper to create a unique ID from a URL
import { createHash } from 'crypto';
const createIdFromUrl = (url: string) => createHash('sha256').update(url).digest('hex');

async function main() {
  const sourceUrl = 'https://huggingface.co/blog/feed.xml'; // Start with one source
  const articles = await fetchArticlesFromSource(sourceUrl);

  console.log(`Found ${articles.length} articles. Processing...`);

  for (const article of articles) {
    if (!article.link || !article.content) continue;

    const articleId = createIdFromUrl(article.link);
    console.log(`Processing article: ${article.title}`);

    // TODO: Add a check here to see if the articleId already exists in Firestore to avoid re-processing.

    const analysis = await analyzeArticleContent(article.content);

    if (analysis) {
      const articleData = {
        url: article.link,
        title: article.title,
        author: article.creator || 'N/A',
        full_content_text: article.content,
        source_name: 'Hugging Face Blog',
        published_at: article.isoDate ? new Date(article.isoDate) : new Date(),
        fetched_at: new Date(),
        ai_summary: analysis.ai_summary,
        ai_score: analysis.ai_score,
        ai_category: analysis.ai_category,
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
}

main();
```

## How to Test

Now, you can run this script directly from your terminal to test the entire backend pipeline:

```bash
npx ts-node src/workflow.ts
```

Watch the console logs and check your Firebase Firestore console to see the articles collection get populated. Once this script works reliably, you'll know your core logic is solid and ready for integration into the Electron app.