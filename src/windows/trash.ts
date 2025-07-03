// Trash window renderer script
// Browser-compatible version without module exports

console.log('Trash TS loaded');

// Type definitions for Firebase Timestamp
interface FirebaseTimestamp {
  toDate(): Date;
}

// Article data interface
interface ArticleData {
  url: string;
  title: string;
  author: string;
  rss_excerpt: string;
  full_content_text: string;
  source_name: string;
  published_at: FirebaseTimestamp | Date | null;
  fetched_at: FirebaseTimestamp | Date | null;
  ai_summary: string;
  ai_score: number;
  ai_category: string;
  is_read: boolean;
  is_hidden: boolean;
  is_favorite: boolean;
  relevant: boolean | null;  // null = unrated, true = relevant, false = not relevant
  rated_at: FirebaseTimestamp | Date | null;
  content_source: 'rss' | 'scraped';
  scraping_status: 'pending' | 'completed' | 'failed';
  scraping_error: string | null;
  content_length: number;
  topic_filtered?: boolean;  // Field to track topic filtering
}

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Window API interface
interface TrashWindowAPI {
  closeWindow: () => void;
  getFirebaseConfig: () => Promise<FirebaseConfig | null>;
  unrateArticle: (articleUrl: string) => Promise<boolean>;
  rateArticle: (articleUrl: string, isRelevant: boolean) => Promise<boolean>;
}

// Article categories for trash
type TrashCategory = 'user-rejected' | 'low-score' | 'topic-filtered';

document.addEventListener('DOMContentLoaded', async (): Promise<void> => {
    // Get DOM elements
    const userRejectedContainer = document.getElementById('user-rejected-articles') as HTMLDivElement;
    const lowScoreContainer = document.getElementById('low-score-articles') as HTMLDivElement;
    const topicFilteredContainer = document.getElementById('topic-filtered-articles') as HTMLDivElement;
    
    const userRejectedCount = document.getElementById('user-rejected-count') as HTMLElement;
    const lowScoreCount = document.getElementById('low-score-count') as HTMLElement;
    const topicFilteredCount = document.getElementById('topic-filtered-count') as HTMLElement;
    
    const closeBtn = document.getElementById('close-btn') as HTMLButtonElement;

    // Event listeners
    closeBtn.addEventListener('click', () => {
        (window as any).trashAPI.closeWindow();
    });

    // Initialize the trash window
    await initializeTrashWindow();

    /**
     * Initialize the trash window and load all trash categories
     */
    async function initializeTrashWindow(): Promise<void> {
        try {
            console.log('Initializing trash window...');
            
            // Get Firebase config from main process
            const firebaseConfig = await (window as any).trashAPI.getFirebaseConfig();
            
            if (!firebaseConfig) {
                showError('Firebase configuration not available');
                return;
            }

            // Initialize Firebase
            await initializeFirebase(firebaseConfig);
            
        } catch (error) {
            console.error('Error initializing trash window:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            showError(`Error: ${errorMessage}`);
        }
    }

    /**
     * Initialize Firebase and set up real-time listeners
     */
    async function initializeFirebase(config: FirebaseConfig): Promise<void> {
        try {
            // Load Firebase SDK dynamically
            await loadFirebaseSDK();
            
            const firebase = (window as any).firebase;
            if (!firebase) {
                throw new Error('Firebase SDK not loaded');
            }
            
            // Initialize Firebase app with unique name for trash window
            const app = firebase.initializeApp(config, 'trash-app');
            
            // Get Firestore instance from the specific app
            const db = firebase.firestore(app);
            
            console.log('Firebase initialized successfully for trash window');
            
            // Set up real-time listeners for all trash categories
            setupArticleListeners(db);
            
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            showError(`Firebase initialization failed: ${errorMessage}`);
        }
    }

    /**
     * Load Firebase SDK scripts
     */
    async function loadFirebaseSDK(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Check if Firebase is already loaded
            if ((window as any).firebase) {
                resolve();
                return;
            }

            // Load Firebase scripts
            const scripts = [
                'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js'
            ];

            let loadedCount = 0;
            
            scripts.forEach(src => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = () => {
                    loadedCount++;
                    if (loadedCount === scripts.length) {
                        resolve();
                    }
                };
                script.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.head.appendChild(script);
            });
        });
    }

    /**
     * Set up real-time listeners for all trash categories
     */
    function setupArticleListeners(db: any): void {
        console.log('Setting up real-time listeners for trash categories...');
        
        // 1. User Rejected Articles (relevant === false)
        const userRejectedRef = db.collection('articles').where('relevant', '==', false);
        userRejectedRef.onSnapshot((snapshot: any) => {
            console.log(`Received ${snapshot.docs.length} user rejected articles from Firestore`);
            const articles = convertSnapshotToArticles(snapshot);
            updateArticleCount('user-rejected', articles.length);
            displayArticles(articles, 'user-rejected');
        });

        // 2. Low Score Articles (relevant === null AND ai_score <= 3 AND ai_score > 0 AND NOT topic_filtered)
        const lowScoreRef = db.collection('articles').where('relevant', '==', null);
        lowScoreRef.onSnapshot((snapshot: any) => {
            console.log(`Checking ${snapshot.docs.length} unrated articles for low scores`);
            const articles = convertSnapshotToArticles(snapshot);
            
            // Filter for articles with ai_score <= 3 and ai_score > 0 AND NOT topic_filtered
            // Only articles that passed topic filtering but got low scores should appear here
            const lowScoreArticles = articles.filter(article => 
                article.ai_score > 0 && 
                article.ai_score <= 3 && 
                !article.topic_filtered  // Exclude topic-filtered articles
            );
            
            console.log(`Found ${lowScoreArticles.length} low score articles (excluding topic-filtered)`);
            updateArticleCount('low-score', lowScoreArticles.length);
            displayArticles(lowScoreArticles, 'low-score');
        });

        // 3. Topic Filtered Articles (relevant === null AND topic_filtered === true)
        // Note: This requires articles to have a topic_filtered field
        const topicFilteredRef = db.collection('articles')
            .where('relevant', '==', null)
            .where('topic_filtered', '==', true);
        
        topicFilteredRef.onSnapshot((snapshot: any) => {
            console.log(`Received ${snapshot.docs.length} topic filtered articles from Firestore`);
            const articles = convertSnapshotToArticles(snapshot);
            updateArticleCount('topic-filtered', articles.length);
            displayArticles(articles, 'topic-filtered');
        }, (error: any) => {
            // If topic_filtered index doesn't exist, show empty state
            console.log('Topic filtered query failed (likely no topic_filtered field/index):', error);
            updateArticleCount('topic-filtered', 0);
            displayArticles([], 'topic-filtered');
        });
    }

    /**
     * Convert Firestore snapshot to ArticleData array
     */
    function convertSnapshotToArticles(snapshot: any): ArticleData[] {
        const articles: ArticleData[] = [];
        snapshot.forEach((doc: any) => {
            const articleData = doc.data();
            articles.push(articleData);
        });
        
        // Sort by published date (newest first)
        articles.sort((a, b) => {
            const dateA = a.published_at && typeof (a.published_at as FirebaseTimestamp).toDate === 'function' 
                ? (a.published_at as FirebaseTimestamp).toDate() 
                : new Date(a.published_at as Date);
            const dateB = b.published_at && typeof (b.published_at as FirebaseTimestamp).toDate === 'function' 
                ? (b.published_at as FirebaseTimestamp).toDate() 
                : new Date(b.published_at as Date);
            return dateB.getTime() - dateA.getTime();
        });
        
        return articles;
    }

    /**
     * Display articles in the specified category
     */
    function displayArticles(articles: ArticleData[], category: TrashCategory): void {
        const container = getContainerForCategory(category);
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        if (articles.length === 0) {
            showEmptyState(container, category);
            return;
        }

        // Create article elements
        articles.forEach(article => {
            const articleElement = createArticleElement(article, category);
            container.appendChild(articleElement);
        });
    }

    /**
     * Get the container element for a category
     */
    function getContainerForCategory(category: TrashCategory): HTMLDivElement | null {
        switch (category) {
            case 'user-rejected':
                return userRejectedContainer;
            case 'low-score':
                return lowScoreContainer;
            case 'topic-filtered':
                return topicFilteredContainer;
            default:
                return null;
        }
    }

    /**
     * Create HTML element for an article
     */
    function createArticleElement(article: ArticleData, category: TrashCategory): HTMLDivElement {
        const articleDiv = document.createElement('div');
        articleDiv.className = 'article';
        articleDiv.setAttribute('data-url', article.url);

        // Format published date
        let publishedDate = 'Unknown date';
        if (article.published_at) {
            try {
                const date = typeof (article.published_at as FirebaseTimestamp).toDate === 'function' 
                    ? (article.published_at as FirebaseTimestamp).toDate() 
                    : new Date(article.published_at as Date);
                publishedDate = date.toLocaleDateString();
            } catch (error) {
                console.error('Error formatting date:', error);
            }
        }

        // Get badge text and determine available actions based on category
        const badgeText = getBadgeText(category, article);
        const canUnrate = category === 'user-rejected'; // Only user rejected articles can be unrated
        const canRate = category === 'low-score'; // Only low score articles can be rated

        // Create action buttons based on category
        let actionButtonsHtml = '';
        if (canUnrate) {
            actionButtonsHtml = `
                <button class="unrate-btn" data-url="${escapeHtml(article.url)}">
                    Unrate
                </button>
            `;
        } else if (canRate) {
            actionButtonsHtml = `
                <button class="rating-btn relevant-btn" data-url="${escapeHtml(article.url)}" data-relevant="true">
                    Relevant
                </button>
                <button class="rating-btn not-relevant-btn" data-url="${escapeHtml(article.url)}" data-relevant="false">
                    Not Relevant
                </button>
            `;
        }

        articleDiv.innerHTML = `
            <div class="article-header">
                <h3 class="article-title">${escapeHtml(article.title)}</h3>
                <div class="article-badge">${badgeText}</div>
            </div>
            <p class="article-summary">${escapeHtml(article.ai_summary || 'No summary available')}</p>
            <div class="article-actions">
                <div class="action-left">
                    <a href="${escapeHtml(article.url)}" target="_blank" class="read-full-link">
                        Read Full Article
                    </a>
                </div>
                <div class="action-right">
                    ${actionButtonsHtml}
                </div>
            </div>
            <div class="article-meta">
                <span>📰 ${escapeHtml(article.source_name || 'Unknown Source')}</span>
                <span>📅 ${publishedDate}</span>
                ${article.ai_score > 0 ? `<span>🧠 Score: ${article.ai_score}/10</span>` : ''}
            </div>
        `;

        // Add event listeners based on category
        if (canUnrate) {
            const unrateBtn = articleDiv.querySelector('.unrate-btn') as HTMLButtonElement;
            if (unrateBtn) {
                unrateBtn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    await unrateArticle(article.url, articleDiv);
                });
            }
        } else if (canRate) {
            const ratingBtns = articleDiv.querySelectorAll('.rating-btn') as NodeListOf<HTMLButtonElement>;
            ratingBtns.forEach(btn => {
                btn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const isRelevant = btn.getAttribute('data-relevant') === 'true';
                    await rateArticle(article.url, isRelevant, articleDiv);
                });
            });
        }

        return articleDiv;
    }

    /**
     * Get badge text for different categories
     */
    function getBadgeText(category: TrashCategory, article: ArticleData): string {
        switch (category) {
            case 'user-rejected':
                return 'Not Relevant';
            case 'low-score':
                return `Score: ${article.ai_score}/10`;
            case 'topic-filtered':
                return 'Topic Filtered';
            default:
                return 'Filtered';
        }
    }

    /**
     * Unrate an article (set relevant back to null)
     */
    async function unrateArticle(articleUrl: string, articleElement: HTMLDivElement): Promise<void> {
        try {
            console.log('Unrating article:', articleUrl);
            
                         // Show loading state
             const unrateBtn = articleElement.querySelector('.unrate-btn') as HTMLButtonElement;
             const originalText = unrateBtn ? unrateBtn.textContent : 'Unrate';
             if (unrateBtn) {
                 unrateBtn.textContent = 'Unrating...';
                 unrateBtn.disabled = true;
             }

            // Call main process to unrate the article
            const success = await (window as any).trashAPI.unrateArticle(articleUrl);
            
            if (success) {
                console.log('Article unrated successfully');
                
                // Add removal animation
                articleElement.classList.add('removing');
                
                // Remove element after animation
                setTimeout(() => {
                    if (articleElement.parentNode) {
                        articleElement.parentNode.removeChild(articleElement);
                    }
                }, 300);
                
            } else {
                console.error('Failed to unrate article');
                
                // Restore button state
                if (unrateBtn) {
                    unrateBtn.textContent = originalText || 'Unrate';
                    unrateBtn.disabled = false;
                }
                
                alert('Failed to unrate article. Please try again.');
            }
            
        } catch (error) {
            console.error('Error unrating article:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error unrating article: ${errorMessage}`);
            
            // Restore button state
            const unrateBtn = articleElement.querySelector('.unrate-btn') as HTMLButtonElement;
            if (unrateBtn) {
                unrateBtn.textContent = 'Unrate';
                unrateBtn.disabled = false;
            }
        }
    }

    /**
     * Rate an article (set relevant to true or false)
     */
    async function rateArticle(articleUrl: string, isRelevant: boolean, articleElement: HTMLDivElement): Promise<void> {
        try {
            console.log(`Rating article as ${isRelevant ? 'relevant' : 'not relevant'}:`, articleUrl);
            
            // Show loading state on all rating buttons
            const ratingBtns = articleElement.querySelectorAll('.rating-btn') as NodeListOf<HTMLButtonElement>;
            const originalTexts = Array.from(ratingBtns).map(btn => btn.textContent || '');
            
            ratingBtns.forEach(btn => {
                btn.textContent = 'Rating...';
                btn.disabled = true;
            });

            // Call main process to rate the article
            const success = await (window as any).trashAPI.rateArticle(articleUrl, isRelevant);
            
            if (success) {
                console.log('Article rated successfully');
                
                // Add removal animation
                articleElement.classList.add('removing');
                
                // Remove element after animation
                setTimeout(() => {
                    if (articleElement.parentNode) {
                        articleElement.parentNode.removeChild(articleElement);
                    }
                }, 300);
                
            } else {
                console.error('Failed to rate article');
                
                // Restore button states
                ratingBtns.forEach((btn, index) => {
                    btn.textContent = originalTexts[index] || 'Rate';
                    btn.disabled = false;
                });
                
                alert('Failed to rate article. Please try again.');
            }
            
        } catch (error) {
            console.error('Error rating article:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Error rating article: ${errorMessage}`);
            
            // Restore button states
            const ratingBtns = articleElement.querySelectorAll('.rating-btn') as NodeListOf<HTMLButtonElement>;
            ratingBtns.forEach(btn => {
                btn.textContent = btn.classList.contains('relevant-btn') ? 'Relevant' : 'Not Relevant';
                btn.disabled = false;
            });
        }
    }

    /**
     * Update article count for a category
     */
    function updateArticleCount(category: TrashCategory, count: number): void {
        const countElement = getCountElementForCategory(category);
        if (countElement) {
            countElement.textContent = count.toString();
        }
    }

    /**
     * Get count element for a category
     */
    function getCountElementForCategory(category: TrashCategory): HTMLElement | null {
        switch (category) {
            case 'user-rejected':
                return userRejectedCount;
            case 'low-score':
                return lowScoreCount;
            case 'topic-filtered':
                return topicFilteredCount;
            default:
                return null;
        }
    }

    /**
     * Show empty state for a category
     */
    function showEmptyState(container: HTMLDivElement, category: TrashCategory): void {
        const emptyMessages = {
            'user-rejected': {
                title: 'No rejected articles',
                message: 'Articles you mark as "Not Relevant" will appear here.'
            },
            'low-score': {
                title: 'No low score articles',
                message: 'Articles that passed topic filtering but scored ≤ 3 will appear here.'
            },
            'topic-filtered': {
                title: 'No topic filtered articles',
                message: 'Articles rejected by topic relevance will appear here.'
            }
        };

        const message = emptyMessages[category];
        
        container.innerHTML = `
            <div class="empty-state">
                <h3>${message.title}</h3>
                <p>${message.message}</p>
            </div>
        `;
    }

    /**
     * Show error state
     */
    function showError(message: string): void {
        const containers = [userRejectedContainer, lowScoreContainer, topicFilteredContainer];
        
        containers.forEach(container => {
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <p>Error: ${escapeHtml(message)}</p>
                    </div>
                `;
            }
        });
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}); 