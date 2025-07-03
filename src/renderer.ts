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
  relevant: boolean | null;  // null = unrated, true = relevant, false = not relevant
  rated_at?: any;
  content_source: 'rss' | 'scraped' | 'failed';
  scraping_status: 'pending' | 'success' | 'failed';
  scraping_error?: string | null;
  content_length: number;
}

console.log('Renderer script loaded.');

// Firebase config should be available immediately since HTML waits for it
const config = (window as any).firebaseConfig;
console.log('Firebase config found:', config);

const unratedListDiv = document.getElementById('unrated-list');
const relevantListDiv = document.getElementById('relevant-list');

if (!unratedListDiv || !relevantListDiv) {
  console.error('Article list elements not found!');
} else if (!config || !config.apiKey) {
  console.error('Firebase config not available!');
  if (unratedListDiv) unratedListDiv.innerHTML = '<p style="color: red;">Error: Firebase configuration not available</p>';
  if (relevantListDiv) relevantListDiv.innerHTML = '<p style="color: red;">Error: Firebase configuration not available</p>';
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
    if (unratedListDiv) {
      unratedListDiv.innerHTML = '<p style="color: #888;">Loading unrated articles...</p>';
    }
    if (relevantListDiv) {
      relevantListDiv.innerHTML = '<p style="color: #888;">Loading relevant articles...</p>';
    }
    
    // Set up real-time listener for all articles, filter unrated ones on client side
    const articlesRef = db.collection('articles');
    
    console.log('Setting up real-time listener...');
    
    articlesRef.onSnapshot((snapshot: any) => {
      console.log(`Received ${snapshot.docs.length} articles from Firestore`);
      
      if (!unratedListDiv || !relevantListDiv) return;
      
      // Clear existing content
      unratedListDiv.innerHTML = '';
      relevantListDiv.innerHTML = '';
      
      // Convert snapshot to arrays and separate by rating
      const unratedArticles: ArticleData[] = [];
      const relevantArticles: ArticleData[] = [];
      
      snapshot.forEach((doc: any) => {
        const articleData = doc.data() as ArticleData;
        
        if (articleData.relevant === null || articleData.relevant === undefined) {
          // Unrated articles (null or undefined)
          unratedArticles.push(articleData);
        } else if (articleData.relevant === true) {
          // Relevant articles
          relevantArticles.push(articleData);
        }
        // Skip not relevant articles (relevant === false)
      });
      
      // Sort both arrays by published date (newest first)
      const sortByDate = (a: ArticleData, b: ArticleData) => {
        const dateA = a.published_at?.toDate ? a.published_at.toDate() : new Date(a.published_at);
        const dateB = b.published_at?.toDate ? b.published_at.toDate() : new Date(b.published_at);
        return dateB.getTime() - dateA.getTime();
      };
      
      unratedArticles.sort(sortByDate);
      relevantArticles.sort(sortByDate);
      
      // Display unrated articles
      if (unratedArticles.length === 0) {
        if (snapshot.empty) {
          unratedListDiv.innerHTML = '<p style="text-align: center; opacity: 0.7;">No articles found. Run the workflow to fetch some!</p>';
        } else {
          unratedListDiv.innerHTML = '<p style="text-align: center; opacity: 0.7;">All articles have been rated! 🎉</p>';
        }
      } else {
        unratedArticles.forEach(article => {
          const articleElement = createArticleElement(article, 'unrated');
          unratedListDiv.appendChild(articleElement);
        });
      }
      
      // Display relevant articles
      if (relevantArticles.length === 0) {
        relevantListDiv.innerHTML = '<p style="text-align: center; opacity: 0.7;">No relevant articles yet.<br>Rate articles as "Relevant" to build your curated feed!</p>';
      } else {
        relevantArticles.forEach(article => {
          const articleElement = createArticleElement(article, 'relevant');
          relevantListDiv.appendChild(articleElement);
        });
      }
      
      console.log(`Displayed ${unratedArticles.length} unrated and ${relevantArticles.length} relevant articles`);
    }, (error: any) => {
      console.error('Error listening to articles:', error);
      if (unratedListDiv) {
        unratedListDiv.innerHTML = '<p style="color: red;">Error loading articles. Check console for details.</p>';
      }
      if (relevantListDiv) {
        relevantListDiv.innerHTML = '<p style="color: red;">Error loading articles. Check console for details.</p>';
      }
    });
    
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    if (unratedListDiv) {
      unratedListDiv.innerHTML = `<p style="color: red;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>`;
    }
    if (relevantListDiv) {
      relevantListDiv.innerHTML = `<p style="color: red;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>`;
    }
  }
}

function createArticleElement(article: ArticleData, columnType: 'unrated' | 'relevant'): HTMLElement {
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

  // Show rating controls based on column type
  let ratingControlsHtml = '';
  if (columnType === 'unrated') {
    // Show relevance rating buttons for unrated articles
    ratingControlsHtml = `
      <div class="rating-controls">
        <span class="rating-label">Is this article relevant?</span>
        <button class="rating-btn relevant" data-relevant="true" data-article-url="${escapeHtml(article.url)}">
          ✅ Relevant
        </button>
        <button class="rating-btn not-relevant" data-relevant="false" data-article-url="${escapeHtml(article.url)}">
          ❌ Not Relevant
        </button>
      </div>
    `;
  } else if (columnType === 'relevant') {
    // Show unrate button for relevant articles
    ratingControlsHtml = `
      <div class="rating-controls">
        <button class="rating-btn unrate" data-unrate="true" data-article-url="${escapeHtml(article.url)}">
          🔄 Unrate Article
        </button>
      </div>
    `;
  }

  // Read status indicator and button
  const readStatusHtml = article.is_read ? 
    '<span class="read-status">✅ Read</span>' : 
    `<button class="read-btn" data-article-url="${escapeHtml(article.url)}">📖 Mark as Read</button>`;

  // Add read class for styling
  if (article.is_read) {
    articleElement.classList.add('read');
  }

  articleElement.innerHTML = `
    <div class="article-header">
      <h2 class="article-title">${escapeHtml(article.title)}</h2>
    </div>
    <p class="article-summary">${escapeHtml(article.ai_summary)}</p>
    <div class="article-actions">
      <div class="action-row">
        <a href="${escapeHtml(article.url)}" target="_blank" class="read-full-link">
          Read Full Article ↗
        </a>
        ${readStatusHtml}
      </div>
      ${ratingControlsHtml}
    </div>
    <div class="article-meta">
      <span>Source: ${escapeHtml(article.source_name)}</span> |
      <span>Published: ${publishedDate}</span> |
      <span>Score: ${article.ai_score.toFixed(1)}</span> |
      <span>${contentTypeIcon} ${article.content_source}</span>
    </div>
  `;
  
  // Add event listeners for rating buttons
  const ratingButtons = articleElement.querySelectorAll('.rating-btn');
  ratingButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const articleUrl = target.getAttribute('data-article-url');
      
      if (!articleUrl) return;
      
      // Check if this is an unrate button
      const isUnrateButton = target.getAttribute('data-unrate') === 'true';
      if (isUnrateButton) {
        await unrateArticle(articleUrl, articleElement);
        return;
      }
      
      // Handle relevance rating buttons
      const relevantValue = target.getAttribute('data-relevant');
      if (relevantValue !== null) {
        const isRelevant = relevantValue === 'true';
        await rateArticle(articleUrl, isRelevant, articleElement);
      }
    });
  });

  // Add event listener for read button (available for all articles)
  const readButton = articleElement.querySelector('.read-btn');
  if (readButton) {
    readButton.addEventListener('click', async (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const articleUrl = target.getAttribute('data-article-url');
      
      if (articleUrl) {
        await markArticleAsRead(articleUrl, articleElement);
      }
    });
  }
  
  return articleElement;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// formatContent function removed since we no longer display scraped content in the UI

async function markArticleAsRead(articleUrl: string, articleElement: HTMLElement) {
  try {
    console.log(`Marking article as read: ${articleUrl}`);
    
    // Show loading state
    const readButton = articleElement.querySelector('.read-btn') as HTMLButtonElement;
    if (readButton) {
      readButton.innerHTML = '<span style="color: #888;">Saving...</span>';
      readButton.disabled = true;
    }
    
    // Create article ID from URL (same method used in main workflow)
    const crypto = (window as any).crypto;
    const encoder = new TextEncoder();
    const data = encoder.encode(articleUrl);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const articleId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Get Firebase instances
    const firebase = (window as any).firebase;
    const db = firebase.firestore();
    
    // Update the article as read
    await db.collection('articles').doc(articleId).update({
      is_read: true
    });
    
    console.log(`✅ Successfully marked article as read`);
    
    // Update the UI immediately
    articleElement.classList.add('read');
    
    // Replace button with read status
    const actionRow = articleElement.querySelector('.action-row');
    if (actionRow) {
      const readStatus = actionRow.querySelector('.read-btn, .read-status');
      if (readStatus) {
        readStatus.outerHTML = '<span class="read-status">✅ Read</span>';
      }
    }
    
  } catch (error) {
    console.error('Error marking article as read:', error);
    
    // Show error and restore button
    const readButton = articleElement.querySelector('.read-btn') as HTMLButtonElement;
    if (readButton) {
      readButton.innerHTML = '📖 Mark as Read';
      readButton.disabled = false;
    }
  }
}

async function rateArticle(articleUrl: string, isRelevant: boolean, articleElement: HTMLElement) {
  try {
    const relevanceText = isRelevant ? 'relevant' : 'not relevant';
    console.log(`Rating article as ${relevanceText}: ${articleUrl}`);
    
    // Show loading state
    const ratingControls = articleElement.querySelector('.rating-controls') as HTMLElement;
    if (ratingControls) {
      ratingControls.innerHTML = '<span style="color: #888;">Saving rating...</span>';
    }
    
    // Create article ID from URL (same method used in main workflow)
    const crypto = (window as any).crypto;
    const encoder = new TextEncoder();
    const data = encoder.encode(articleUrl);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const articleId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Get Firebase instances
    const firebase = (window as any).firebase;
    const db = firebase.firestore();
    
    // Update the article with relevance rating
    await db.collection('articles').doc(articleId).update({
      relevant: isRelevant,
      rated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Successfully rated article as ${relevanceText}`);
    
    // Show success message briefly, then remove the article
    if (ratingControls) {
      ratingControls.innerHTML = `<span style="color: #00aaff;">✓ Rated as ${relevanceText}</span>`;
    }
    
    // Remove article from UI after brief delay
    setTimeout(() => {
      articleElement.style.transition = 'all 0.3s ease';
      articleElement.style.opacity = '0';
      articleElement.style.transform = 'translateX(-100%)';
      
      setTimeout(() => {
        articleElement.remove();
      }, 300);
    }, 1000);
    
  } catch (error) {
    console.error('Error rating article:', error);
    
    // Show error message
    const ratingControls = articleElement.querySelector('.rating-controls') as HTMLElement;
    if (ratingControls) {
      ratingControls.innerHTML = '<span style="color: #ff6b6b;">Error saving rating. Please try again.</span>';
      
      // Restore buttons after error
      setTimeout(() => {
        location.reload(); // Simple recovery - reload the page
      }, 2000);
    }
  }
}

async function unrateArticle(articleUrl: string, articleElement: HTMLElement) {
  try {
    console.log(`Unrating article: ${articleUrl}`);
    
    // Show loading state
    const ratingControls = articleElement.querySelector('.rating-controls') as HTMLElement;
    if (ratingControls) {
      ratingControls.innerHTML = '<span style="color: #888;">Removing rating...</span>';
    }
    
    // Create article ID from URL (same method used in main workflow)
    const crypto = (window as any).crypto;
    const encoder = new TextEncoder();
    const data = encoder.encode(articleUrl);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const articleId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Get Firebase instances
    const firebase = (window as any).firebase;
    const db = firebase.firestore();
    
    // Update the article to remove relevance rating
    await db.collection('articles').doc(articleId).update({
      relevant: null,
      rated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Successfully unrated article`);
    
    // Show success message briefly, then remove the article from this column
    if (ratingControls) {
      ratingControls.innerHTML = '<span style="color: #00aaff;">✓ Rating removed</span>';
    }
    
    // Remove article from UI after brief delay (it will move back to unrated column)
    setTimeout(() => {
      articleElement.style.transition = 'all 0.3s ease';
      articleElement.style.opacity = '0';
      articleElement.style.transform = 'translateX(-100%)';
      
      setTimeout(() => {
        articleElement.remove();
      }, 300);
    }, 1000);
    
  } catch (error) {
    console.error('Error unrating article:', error);
    const ratingControls = articleElement.querySelector('.rating-controls') as HTMLElement;
    if (ratingControls) {
      ratingControls.innerHTML = '<span style="color: red;">Error removing rating</span>';
      setTimeout(() => {
        // Restore original unrate button
        ratingControls.innerHTML = `
          <button class="rating-btn unrate" data-unrate="true" data-article-url="${escapeHtml(articleUrl)}">
            🔄 Unrate Article
          </button>
        `;
      }, 2000);
    }
  }
}
