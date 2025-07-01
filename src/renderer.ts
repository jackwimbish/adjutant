// This file is loaded by the index.html file and runs in the renderer process.

// Make this a module to allow global declarations
export {};

// Declare global types for TypeScript
declare global {
  interface Window {
    firebaseConfig: {
      apiKey: string;
      authDomain: string;
      projectId: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
    };
    firebase: any; // Firebase SDK loaded via script tag
  }
}

// Article data type (simplified for browser context)
interface ArticleData {
  url: string;
  title: string;
  author: string;
  rss_excerpt: string;
  full_content_text: string;
  source_name: string;
  published_at: any; // Firestore Timestamp or Date
  fetched_at: any;
  ai_summary: string;
  ai_score: number;
  ai_category: string;
  is_read: boolean;
  is_hidden: boolean;
  is_favorite: boolean;
  content_source: 'rss' | 'scraped' | 'failed';
  scraping_status: 'pending' | 'success' | 'failed';
  scraping_error?: string | null;
  content_length: number;
}

console.log('Renderer script loaded.');

// Firebase config should be available immediately since HTML waits for it
const config = (window as any).firebaseConfig;
console.log('Firebase config found:', config);

const articleListDiv = document.getElementById('article-list');
if (!articleListDiv) {
  console.error('Article list element not found!');
} else if (!config || !config.apiKey) {
  console.error('Firebase config not available!');
  articleListDiv.innerHTML = '<p style="color: red;">Error: Firebase configuration not available</p>';
} else {
  initializeFirebaseAndLoadArticles();
}

async function initializeFirebaseAndLoadArticles() {
  try {
    console.log('Initializing Firebase...');
    
    // Initialize Firebase using the compat SDK
    const firebase = (window as any).firebase;
    if (!firebase) {
      throw new Error('Firebase SDK not loaded');
    }
    
    const app = firebase.initializeApp(config);
    const db = firebase.firestore();
    
    console.log('Firebase initialized successfully');
    
    // Update UI to show loading
    if (articleListDiv) {
      articleListDiv.innerHTML = '<p style="color: #888;">Loading articles from database...</p>';
    }
    
    // Set up real-time listener for articles
    const articlesRef = db.collection('articles');
    const query = articlesRef.orderBy('ai_score', 'desc');
    
    console.log('Setting up real-time listener...');
    
    query.onSnapshot((snapshot: any) => {
      console.log(`Received ${snapshot.docs.length} articles from Firestore`);
      
      if (!articleListDiv) return;
      
      // Clear existing content
      articleListDiv.innerHTML = '';
      
      if (snapshot.empty) {
        articleListDiv.innerHTML = '<p style="text-align: center; opacity: 0.7;">No articles found. Run the workflow to fetch some!</p>';
        return;
      }
      
      // Process each article
      snapshot.forEach((doc: any) => {
        const article = doc.data() as ArticleData;
        const articleElement = createArticleElement(article);
        articleListDiv.appendChild(articleElement);
      });
      
      console.log(`Displayed ${snapshot.docs.length} articles`);
    }, (error: any) => {
      console.error('Error listening to articles:', error);
      if (articleListDiv) {
        articleListDiv.innerHTML = '<p style="color: red;">Error loading articles. Check console for details.</p>';
      }
    });
    
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    if (articleListDiv) {
      articleListDiv.innerHTML = `<p style="color: red;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>`;
    }
  }
}

function createArticleElement(article: ArticleData): HTMLElement {
  const articleElement = document.createElement('div');
  articleElement.classList.add('article');
  
  // Handle Firestore Timestamp
  let publishedDate: string;
  try {
    if (article.published_at && typeof article.published_at.toDate === 'function') {
      publishedDate = article.published_at.toDate().toLocaleDateString();
    } else if (article.published_at instanceof Date) {
      publishedDate = article.published_at.toLocaleDateString();
    } else {
      publishedDate = 'Unknown date';
    }
  } catch (error) {
    console.warn('Error formatting date:', error);
    publishedDate = 'Unknown date';
  }
  
  // Create unique ID for this article
  const articleId = `article-${btoa(article.url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`;
  
  // Determine content type status for metadata
  const contentTypeIcon = article.content_source === 'scraped' ? '📰' : '📝';

  articleElement.innerHTML = `
    <div class="article-header">
      <h2 class="article-title">${escapeHtml(article.title)}</h2>
    </div>
    <p class="article-summary">${escapeHtml(article.ai_summary)}</p>
    <div class="article-actions">
      <a href="${escapeHtml(article.url)}" target="_blank" class="read-full-link">
        Read Full Article ↗
      </a>
    </div>
    <div class="article-meta">
      <span>Source: ${escapeHtml(article.source_name)}</span> |
      <span>Published: ${publishedDate}</span> |
      <span>Score: ${article.ai_score.toFixed(1)}</span> |
      <span>${contentTypeIcon} ${article.content_source}</span>
    </div>
  `;
  
  // No expand/collapse functionality needed anymore
  
  return articleElement;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// formatContent function removed since we no longer display scraped content in the UI
