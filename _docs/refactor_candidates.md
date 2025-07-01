# Code Refactor Candidates

After reviewing the codebase in `src/`, here are the areas that could benefit from refactoring to improve maintainability, readability, and extensibility.

## High Priority Refactors

### 1. **workflow.ts: Extract Configuration Management**
**Current Issue:** Hardcoded values scattered throughout the code
- Hardcoded RSS URL: `'https://towardsdatascience.com/feed'`
- Hardcoded source name: `'Towards Data Science'`
- Hardcoded content truncation: `content.substring(0, 4000)`

**Why Refactor:** Makes it difficult to add new sources or modify behavior without code changes

**Proposed Solution:**
```typescript
// config/sources.ts
interface NewsSource {
  name: string;
  url: string;
  type: 'RSS' | 'NITTER';
}

const DEFAULT_SOURCES: NewsSource[] = [
  { name: 'Towards Data Science', url: 'https://towardsdatascience.com/feed', type: 'RSS' },
  // Future sources can be added here
];

// config/settings.ts
export const CONFIG = {
  AI_CONTENT_MAX_LENGTH: 4000,
  AI_MODEL: 'gpt-4o',
  PROCESS_TIMEOUT: 30 * 60 * 1000, // 30 minutes
};
```

### 2. **workflow.ts: Break Down Monolithic `main()` Function**
**Current Issue:** The main function handles multiple responsibilities:
- Source fetching
- Article processing
- Data transformation
- Database saving
- Cleanup

**Why Refactor:** Violates Single Responsibility Principle, hard to test individual parts

**Proposed Solution:**
```typescript
async function main() {
  const sources = await loadSources();
  
  for (const source of sources) {
    await processSource(source);
  }
  
  await cleanup();
}

async function processSource(source: NewsSource) {
  const articles = await fetchArticlesFromSource(source);
  await processArticles(articles, source);
}

async function processArticles(articles: any[], source: NewsSource) {
  for (const article of articles) {
    if (await shouldSkipArticle(article)) continue;
    await processArticle(article, source);
  }
}
```

### 3. **workflow.ts: Extract AI Prompt Management**
**Current Issue:** Large prompt string embedded in function makes it hard to modify and maintain

**Why Refactor:** AI prompts should be easily tweakable without touching core logic

**Proposed Solution:**
```typescript
// prompts/analysis-prompt.ts
export const ANALYSIS_PROMPT_TEMPLATE = `
You are an AI news analyst for a software developer. Analyze the following article and provide a score from 1-10 on its relevance. Your response must be in JSON format.

Scoring Criteria:
- High Score (8-10): {{HIGH_SCORE_CRITERIA}}
- Medium Score (5-7): {{MEDIUM_SCORE_CRITERIA}}
- Low Score (1-4): {{LOW_SCORE_CRITERIA}}

Article Content:
{{CONTENT}}

Your Response (JSON):
{ "ai_score": <score_from_1_to_10>, "category": "<one of: {{CATEGORIES}}>", "ai_summary": "<a one-sentence summary>" }
`;

// Then use a template engine or simple replace
const prompt = buildAnalysisPrompt(content, promptConfig);
```

### 4. **workflow.ts: Improve Type Safety**
**Current Issue:** Using `any` type for analysis results and RSS feed items

**Why Refactor:** Type safety prevents runtime errors and improves developer experience

**Proposed Solution:**
```typescript
interface AnalysisResult {
  ai_score: number;
  category: 'New Tool' | 'Tutorial' | 'Research' | 'Analysis' | 'Opinion';
  ai_summary: string;
}

interface RSSItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  creator?: string;
  isoDate?: string;
}

interface ArticleData {
  url: string;
  title: string;
  author: string;
  full_content_text: string;
  source_name: string;
  published_at: Date;
  fetched_at: Date;
  ai_summary: string;
  ai_score: number;
  ai_category: string;
  is_read: boolean;
  is_hidden: boolean;
  is_favorite: boolean;
}
```

## Medium Priority Refactors

### 5. **workflow.ts: Extract Article Data Mapping**
**Current Issue:** Large object literal in main processing loop

**Why Refactor:** Reusable transformation logic, easier to test

**Proposed Solution:**
```typescript
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
```

### 6. **main.ts: Extract Configuration**
**Current Issue:** Hardcoded interval and file paths

**Why Refactor:** Makes scheduling and paths configurable

**Proposed Solution:**
```typescript
// config/app-config.ts
export const APP_CONFIG = {
  WORKFLOW_INTERVAL_MS: 30 * 60 * 1000,
  WORKFLOW_SCRIPT_PATH: 'workflow.ts',
  WINDOW_CONFIG: {
    width: 1200,
    height: 800,
  },
  DEV_TOOLS_OPEN: process.env.NODE_ENV === 'development',
};
```

### 7. **workflow.ts: Add Duplicate Detection**
**Current Issue:** TODO comment indicates missing functionality to avoid reprocessing

**Why Refactor:** Essential feature to prevent duplicate work and API costs

**Proposed Solution:**
```typescript
async function articleExists(articleId: string): Promise<boolean> {
  try {
    const docSnap = await getDoc(doc(articlesCollection, articleId));
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking article existence:', error);
    return false; // Assume doesn't exist to be safe
  }
}

// Then in main processing:
if (await articleExists(articleId)) {
  console.log(`Article already exists, skipping: ${article.title}`);
  continue;
}
```

## Low Priority Refactors

### 8. **Centralize Firebase Configuration**
**Current Issue:** Firebase config repeated if used in multiple files

**Why Refactor:** DRY principle, easier to manage configuration

**Proposed Solution:**
```typescript
// services/firebase.ts
export function initializeFirebaseApp() {
  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  };
  
  return initializeApp(firebaseConfig);
}
```

### 9. **main.ts: Security Improvements**
**Current Issue:** Comment mentions security concerns with nodeIntegration

**Why Refactor:** Security best practices for Electron apps

**Proposed Solution:**
```typescript
// Use preload script instead of nodeIntegration: true
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'preload.js'),
}
```

### 10. **Add Error Recovery and Retry Logic**
**Current Issue:** Single failures could stop entire workflow

**Why Refactor:** Robustness for production use

**Proposed Solution:**
```typescript
async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3
): Promise<T | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error(`Operation failed after ${maxRetries} attempts:`, error);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
  return null;
}
```

## Summary

The current codebase is functional but could benefit from better separation of concerns, improved type safety, and more flexible configuration management. The highest impact refactors would be:

1. **Configuration extraction** - makes the app more flexible
2. **Function decomposition** - improves testability and maintainability  
3. **Type safety improvements** - prevents runtime errors
4. **Duplicate detection** - essential missing feature

These refactors would transform the codebase from a working prototype into a maintainable production application. 