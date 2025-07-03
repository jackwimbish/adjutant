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

/**
 * Helper function to format article publication date
 */
function formatArticleDate(publishedAt: any): string {
  try {
    if (publishedAt && typeof publishedAt.toDate === 'function') {
      return publishedAt.toDate().toLocaleDateString();
    } else if (publishedAt instanceof Date) {
      return publishedAt.toLocaleDateString();
    } else {
      return 'Unknown date';
    }
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Unknown date';
  }
}

/**
 * Create the article header with title
 */
function createArticleHeader(article: ArticleData): HTMLElement {
  const headerDiv = document.createElement('div');
  headerDiv.className = 'article-header';
  
  const titleElement = document.createElement('h2');
  titleElement.className = 'article-title';
  titleElement.textContent = article.title;
  
  headerDiv.appendChild(titleElement);
  return headerDiv;
}

/**
 * Create the article summary paragraph
 */
function createArticleSummary(article: ArticleData): HTMLElement {
  const summaryElement = document.createElement('p');
  summaryElement.className = 'article-summary';
  summaryElement.textContent = article.ai_summary;
  return summaryElement;
}

/**
 * Create the read status element (button or status indicator)
 */
function createReadStatusElement(article: ArticleData): HTMLElement {
  if (article.is_read) {
    const statusSpan = document.createElement('span');
    statusSpan.className = 'read-status';
    statusSpan.textContent = '✅ Read';
    return statusSpan;
  } else {
    const readButton = document.createElement('button');
    readButton.className = 'read-btn';
    readButton.textContent = '📖 Mark as Read';
    readButton.setAttribute('data-article-url', article.url);
    
    // Add event listener
    readButton.addEventListener('click', async (e) => {
      e.preventDefault();
      const articleElement = readButton.closest('.article') as HTMLElement;
      if (articleElement) {
        await markArticleAsRead(article.url, articleElement);
      }
    });
    
    return readButton;
  }
}

/**
 * Create rating controls based on column type
 */
function createRatingControls(article: ArticleData, columnType: 'unrated' | 'relevant'): HTMLElement | null {
  if (columnType === 'unrated') {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'rating-controls';
    
    const label = document.createElement('span');
    label.className = 'rating-label';
    label.textContent = 'Is this article relevant?';
    
    const relevantButton = document.createElement('button');
    relevantButton.className = 'rating-btn relevant';
    relevantButton.textContent = '✅ Relevant';
    relevantButton.setAttribute('data-relevant', 'true');
    relevantButton.setAttribute('data-article-url', article.url);
    
    const notRelevantButton = document.createElement('button');
    notRelevantButton.className = 'rating-btn not-relevant';
    notRelevantButton.textContent = '❌ Not Relevant';
    notRelevantButton.setAttribute('data-relevant', 'false');
    notRelevantButton.setAttribute('data-article-url', article.url);
    
    // Add event listeners
    const handleRatingClick = async (e: Event) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const relevantValue = target.getAttribute('data-relevant');
      if (relevantValue !== null) {
        const isRelevant = relevantValue === 'true';
        const articleElement = target.closest('.article') as HTMLElement;
        if (articleElement) {
          await rateArticle(article.url, isRelevant, articleElement);
        }
      }
    };
    
    relevantButton.addEventListener('click', handleRatingClick);
    notRelevantButton.addEventListener('click', handleRatingClick);
    
    controlsDiv.appendChild(label);
    controlsDiv.appendChild(relevantButton);
    controlsDiv.appendChild(notRelevantButton);
    
    return controlsDiv;
  } else if (columnType === 'relevant') {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'rating-controls';
    
    const unrateButton = document.createElement('button');
    unrateButton.className = 'rating-btn unrate';
    unrateButton.textContent = '🔄 Unrate Article';
    unrateButton.setAttribute('data-unrate', 'true');
    unrateButton.setAttribute('data-article-url', article.url);
    
    // Add event listener
    unrateButton.addEventListener('click', async (e) => {
      e.preventDefault();
      const articleElement = unrateButton.closest('.article') as HTMLElement;
      if (articleElement) {
        await unrateArticle(article.url, articleElement);
      }
    });
    
    controlsDiv.appendChild(unrateButton);
    return controlsDiv;
  }
  
  return null;
}

/**
 * Create the article actions section
 */
function createArticleActions(article: ArticleData, columnType: 'unrated' | 'relevant'): HTMLElement {
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'article-actions';
  
  // Create action row with read link and read status
  const actionRow = document.createElement('div');
  actionRow.className = 'action-row';
  
  const readLink = document.createElement('a');
  readLink.href = article.url;
  readLink.target = '_blank';
  readLink.className = 'read-full-link';
  readLink.textContent = 'Read Full Article ↗';
  
  const readStatusElement = createReadStatusElement(article);
  
  actionRow.appendChild(readLink);
  actionRow.appendChild(readStatusElement);
  actionsDiv.appendChild(actionRow);
  
  // Add rating controls if applicable
  const ratingControls = createRatingControls(article, columnType);
  if (ratingControls) {
    actionsDiv.appendChild(ratingControls);
  }
  
  return actionsDiv;
}

/**
 * Create the article metadata section
 */
function createArticleMeta(article: ArticleData): HTMLElement {
  const metaDiv = document.createElement('div');
  metaDiv.className = 'article-meta';
  
  const publishedDate = formatArticleDate(article.published_at);
  const contentTypeIcon = article.content_source === 'scraped' ? '📰' : '📝';
  
  // Create individual meta spans
  const sourceSpan = document.createElement('span');
  sourceSpan.textContent = `Source: ${article.source_name}`;
  
  const separator1 = document.createTextNode(' | ');
  
  const dateSpan = document.createElement('span');
  dateSpan.textContent = `Published: ${publishedDate}`;
  
  const separator2 = document.createTextNode(' | ');
  
  const scoreSpan = document.createElement('span');
  scoreSpan.textContent = `Score: ${article.ai_score.toFixed(1)}`;
  
  const separator3 = document.createTextNode(' | ');
  
  const contentTypeSpan = document.createElement('span');
  contentTypeSpan.textContent = `${contentTypeIcon} ${article.content_source}`;
  
  metaDiv.appendChild(sourceSpan);
  metaDiv.appendChild(separator1);
  metaDiv.appendChild(dateSpan);
  metaDiv.appendChild(separator2);
  metaDiv.appendChild(scoreSpan);
  metaDiv.appendChild(separator3);
  metaDiv.appendChild(contentTypeSpan);
  
  return metaDiv;
}

/**
 * Main function to create an article element using component-based approach
 */
function createArticleElement(article: ArticleData, columnType: 'unrated' | 'relevant'): HTMLElement {
  const articleElement = document.createElement('div');
  articleElement.classList.add('article');
  
  // Add read class for styling if article is read
  if (article.is_read) {
    articleElement.classList.add('read');
  }
  
  // Create and append all components
  const header = createArticleHeader(article);
  const summary = createArticleSummary(article);
  const actions = createArticleActions(article, columnType);
  const meta = createArticleMeta(article);
  
  articleElement.appendChild(header);
  articleElement.appendChild(summary);
  articleElement.appendChild(actions);
  articleElement.appendChild(meta);
  
  return articleElement;
}

// escapeHtml function no longer needed with programmatic DOM creation

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
        // Restore original unrate button using programmatic DOM creation
        const unrateButton = document.createElement('button');
        unrateButton.className = 'rating-btn unrate';
        unrateButton.textContent = '🔄 Unrate Article';
        unrateButton.setAttribute('data-unrate', 'true');
        unrateButton.setAttribute('data-article-url', articleUrl);
        
        // Add event listener
        unrateButton.addEventListener('click', async (e) => {
          e.preventDefault();
          await unrateArticle(articleUrl, articleElement);
        });
        
        ratingControls.innerHTML = '';
        ratingControls.appendChild(unrateButton);
      }, 2000);
    }
  }
}
