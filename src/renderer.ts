// This file is loaded by the index.html file and runs in the renderer process.

// Make this a module to allow global declarations
export {};

// Since we can't use ES6 imports in browser context, we'll need to include
// the service classes directly or use a different loading strategy

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
    checkProfileThreshold?: () => Promise<void>;
    checkProfileExists?: () => Promise<void>;
  }
}

// Article data interface (duplicated from types to avoid imports)
interface ArticleData {
  url: string;
  title: string;
  summary: string;
  content: string;
  score: number;
  relevant: boolean | null;
  read: boolean;
  created_at: Date;
  rated_at?: Date;
}

console.log('Renderer script loaded.');

// Firebase config should be available immediately since HTML waits for it
const config = (window as any).firebaseConfig;
console.log('Firebase config found:', config);

// Get DOM elements
const unratedListDiv = document.getElementById('unrated-list');
const relevantListDiv = document.getElementById('relevant-list');

// Firebase app and db instances
let app: any = null;
let db: any = null;

// Article listeners for cleanup
let unratedListener: (() => void) | null = null;
let relevantListener: (() => void) | null = null;

// Initialize the application
if (!unratedListDiv || !relevantListDiv) {
  console.error('Article list elements not found!');
} else if (!config || !config.apiKey) {
  console.error('Firebase config not available!');
  showConfigError();
} else {
  initializeApplication();
}

/**
 * Show configuration error in the UI
 */
function showConfigError(): void {
  const errorMessage = '<p style="color: red;">Error: Firebase configuration not available</p>';
  if (unratedListDiv) unratedListDiv.innerHTML = errorMessage;
  if (relevantListDiv) relevantListDiv.innerHTML = errorMessage;
}

/**
 * Initialize the application
 */
async function initializeApplication(): Promise<void> {
  try {
    console.log('Initializing application...');
    
    // Initialize Firebase
    initializeFirebase();
    
    // Show loading states
    showLoading('unrated');
    showLoading('relevant');
    
    // Set up article listeners
    setupArticleListeners();
    
    console.log('✅ Application initialized successfully');
    
  } catch (error) {
    console.error('Error initializing application:', error);
    showInitializationError(error);
  }
}

/**
 * Initialize Firebase connection
 */
function initializeFirebase(): void {
  // Create unique app name to avoid conflicts
  const appName = `renderer-app-${Date.now()}`;
  app = (window as any).firebase.initializeApp(config, appName);
  db = (window as any).firebase.firestore(app);
  console.log('Firebase initialized for renderer');
}

/**
 * Set up real-time listeners for articles
 */
function setupArticleListeners(): void {
  // Listen for unrated articles (simplified query to avoid index requirement)
  const unratedQuery = db.collection('articles')
    .where('relevant', '==', null);
    
  unratedListener = unratedQuery.onSnapshot((snapshot: any) => {
    const articles: ArticleData[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      articles.push({
        url: doc.id,
        title: data.title || 'No title',
        summary: data.summary || 'No summary available',
        content: data.content || '',
        score: data.score || 0,
        relevant: data.relevant,
        read: data.read || false,
        created_at: data.created_at?.toDate() || new Date(),
        rated_at: data.rated_at?.toDate()
      });
    });
    
    // Sort by created_at in JavaScript instead of Firestore
    articles.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    
    console.log(`Received ${articles.length} unrated articles`);
    renderArticles(articles, 'unrated');
  }, (error: any) => {
    console.error('Error listening to unrated articles:', error);
    showError('unrated', error.message);
  });

  // Listen for relevant articles (simplified query to avoid index requirement)
  const relevantQuery = db.collection('articles')
    .where('relevant', '==', true);
    
  relevantListener = relevantQuery.onSnapshot((snapshot: any) => {
    const articles: ArticleData[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      articles.push({
        url: doc.id,
        title: data.title || 'No title',
        summary: data.summary || 'No summary available',
        content: data.content || '',
        score: data.score || 0,
        relevant: data.relevant,
        read: data.read || false,
        created_at: data.created_at?.toDate() || new Date(),
        rated_at: data.rated_at?.toDate()
      });
    });
    
    // Sort by created_at in JavaScript instead of Firestore
    articles.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    
    console.log(`Received ${articles.length} relevant articles`);
    renderArticles(articles, 'relevant');
  }, (error: any) => {
    console.error('Error listening to relevant articles:', error);
    showError('relevant', error.message);
  });
}

/**
 * Render articles in the specified column
 */
function renderArticles(articles: ArticleData[], type: 'unrated' | 'relevant'): void {
  const container = type === 'unrated' ? unratedListDiv : relevantListDiv;
  if (!container) return;

  if (articles.length === 0) {
    container.innerHTML = `<p style="color: #888; text-align: center; padding: 20px;">No ${type} articles found</p>`;
    return;
  }

  const articlesHtml = articles.map(article => createArticleHtml(article, type)).join('');
  container.innerHTML = articlesHtml;
  
  // Set up event listeners for the new articles
  setupArticleEventListeners(container, type);
}

/**
 * Create HTML for a single article
 */
function createArticleHtml(article: ArticleData, type: 'unrated' | 'relevant'): string {
  const readClass = article.read ? ' read' : '';
  const readButtonHtml = article.read 
    ? '<span class="read-status">✓ Read</span>'
    : '<button class="read-btn" data-url="' + escapeHtml(article.url) + '">Mark as Read</button>';

  const actionButtonsHtml = type === 'unrated' 
    ? `
      <button class="rating-btn relevant" data-url="${escapeHtml(article.url)}" data-relevant="true">
        Relevant
      </button>
      <button class="rating-btn not-relevant" data-url="${escapeHtml(article.url)}" data-relevant="false">
        Not Relevant
      </button>
    `
    : `
      <button class="rating-btn unrate" data-url="${escapeHtml(article.url)}">
        Unrate
      </button>
    `;

  return `
    <div class="article${readClass}" data-url="${escapeHtml(article.url)}">
      <div class="article-header">
        <h3 class="article-title">${escapeHtml(article.title)}</h3>
      </div>
      <p class="article-summary">${escapeHtml(article.summary)}</p>
      <div class="article-actions">
        <div class="action-row">
          <a href="${escapeHtml(article.url)}" target="_blank" class="read-full-link">
            Read Full Article
          </a>
          ${readButtonHtml}
        </div>
        <div class="action-row">
          <span class="rating-label">Rate this article:</span>
          <div class="rating-controls">
            ${actionButtonsHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Set up event listeners for article actions
 */
function setupArticleEventListeners(container: HTMLElement, type: 'unrated' | 'relevant'): void {
  // Event delegation for better performance
  container.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const articleUrl = target.getAttribute('data-url');
    
    if (!articleUrl) return;
    
    try {
      if (target.classList.contains('read-btn')) {
        event.preventDefault();
        await handleMarkAsRead(articleUrl, target);
      } else if (target.classList.contains('rating-btn')) {
        event.preventDefault();
        
        if (target.classList.contains('unrate')) {
          await handleUnrateArticle(articleUrl, target);
        } else {
          const isRelevant = target.getAttribute('data-relevant') === 'true';
          await handleRateArticle(articleUrl, isRelevant, target);
        }
      }
    } catch (error) {
      console.error('Error handling article action:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Handle marking an article as read
 */
async function handleMarkAsRead(articleUrl: string, buttonElement: HTMLElement): Promise<void> {
  const originalText = buttonElement.textContent;
  buttonElement.textContent = 'Marking...';
  buttonElement.setAttribute('disabled', 'true');
  
  try {
    await db.collection('articles').doc(articleUrl).update({
      read: true
    });
    
    console.log('✅ Article marked as read successfully');
  } catch (error) {
    buttonElement.textContent = originalText;
    buttonElement.removeAttribute('disabled');
    throw error;
  }
}

/**
 * Handle rating an article
 */
async function handleRateArticle(articleUrl: string, isRelevant: boolean, buttonElement: HTMLElement): Promise<void> {
  const originalText = buttonElement.textContent;
  buttonElement.textContent = 'Rating...';
  buttonElement.setAttribute('disabled', 'true');
  
  try {
    await db.collection('articles').doc(articleUrl).update({
      relevant: isRelevant,
      rated_at: (window as any).firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Check profile threshold after rating (with delay to ensure UI update)
    setTimeout(() => {
      checkProfileThresholdInRenderer();
    }, 500);
    
    const relevanceText = isRelevant ? 'relevant' : 'not relevant';
    console.log(`✅ Article rated as ${relevanceText} successfully`);
  } catch (error) {
    buttonElement.textContent = originalText;
    buttonElement.removeAttribute('disabled');
    throw error;
  }
}

/**
 * Handle unrating an article
 */
async function handleUnrateArticle(articleUrl: string, buttonElement: HTMLElement): Promise<void> {
  const originalText = buttonElement.textContent;
  buttonElement.textContent = 'Unrating...';
  buttonElement.setAttribute('disabled', 'true');
  
  try {
    await db.collection('articles').doc(articleUrl).update({
      relevant: null,
      rated_at: (window as any).firebase.firestore.FieldValue.delete()
    });
    
    console.log('✅ Article unrated successfully');
  } catch (error) {
    buttonElement.textContent = originalText;
    buttonElement.removeAttribute('disabled');
    throw error;
  }
}

/**
 * Show loading state
 */
function showLoading(type: 'unrated' | 'relevant'): void {
  const container = type === 'unrated' ? unratedListDiv : relevantListDiv;
  if (container) {
    container.innerHTML = '<p style="text-align: center; padding: 20px;">Loading articles...</p>';
  }
}

/**
 * Show error state
 */
function showError(type: 'unrated' | 'relevant', message: string): void {
  const container = type === 'unrated' ? unratedListDiv : relevantListDiv;
  if (container) {
    container.innerHTML = `<p style="color: red; text-align: center; padding: 20px;">Error: ${escapeHtml(message)}</p>`;
  }
}

/**
 * Show initialization error in the UI
 */
function showInitializationError(error: any): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  showError('unrated', errorMessage);
  showError('relevant', errorMessage);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Check profile threshold from renderer context
 */
async function checkProfileThresholdInRenderer(): Promise<void> {
  try {
    if ((window as any).checkProfileThreshold) {
      await (window as any).checkProfileThreshold();
    }
    
    if ((window as any).checkProfileExists) {
      await (window as any).checkProfileExists();
    }
  } catch (error) {
    console.error('Renderer: Error checking profile threshold:', error);
  }
}

/**
 * Cleanup function for when the page is unloaded
 */
window.addEventListener('beforeunload', () => {
  console.log('Renderer: Cleaning up...');
  
  if (unratedListener) {
    unratedListener();
  }
  
  if (relevantListener) {
    relevantListener();
  }
});
