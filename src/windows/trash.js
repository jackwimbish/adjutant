// Trash window renderer script
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    const articlesContainer = document.getElementById('articles-container');
    const articleCountElement = document.getElementById('article-count');
    const closeBtn = document.getElementById('close-btn');

    // Article data type (simplified for browser context)
    const ArticleData = {
        url: '',
        title: '',
        author: '',
        rss_excerpt: '',
        full_content_text: '',
        source_name: '',
        published_at: null,
        fetched_at: null,
        ai_summary: '',
        ai_score: 0,
        ai_category: '',
        is_read: false,
        is_hidden: false,
        is_favorite: false,
        relevant: null,  // null = unrated, true = relevant, false = not relevant
        rated_at: null,
        content_source: 'rss',
        scraping_status: 'pending',
        scraping_error: null,
        content_length: 0
    };

    // Event listeners
    closeBtn.addEventListener('click', () => {
        window.trashAPI.closeWindow();
    });

    // Initialize the trash window
    await initializeTrashWindow();

    /**
     * Initialize the trash window and load not relevant articles
     */
    async function initializeTrashWindow() {
        try {
            console.log('Initializing trash window...');
            
            // Get Firebase config from main process
            const firebaseConfig = await window.trashAPI.getFirebaseConfig();
            
            if (!firebaseConfig) {
                showError('Firebase configuration not available');
                return;
            }

            // Initialize Firebase
            await initializeFirebase(firebaseConfig);
            
        } catch (error) {
            console.error('Error initializing trash window:', error);
            showError(`Error: ${error.message}`);
        }
    }

    /**
     * Initialize Firebase and set up real-time listener
     */
    async function initializeFirebase(config) {
        try {
            // Load Firebase SDK dynamically
            await loadFirebaseSDK();
            
            const firebase = window.firebase;
            if (!firebase) {
                throw new Error('Firebase SDK not loaded');
            }
            
            // Initialize Firebase app with unique name for trash window
            const app = firebase.initializeApp(config, 'trash-app');
            
            // Get Firestore instance from the specific app
            const db = firebase.firestore(app);
            
            console.log('Firebase initialized successfully for trash window');
            
            // Set up real-time listener for not relevant articles
            setupArticleListener(db);
            
        } catch (error) {
            console.error('Error initializing Firebase:', error);
            showError(`Firebase initialization failed: ${error.message}`);
        }
    }

    /**
     * Load Firebase SDK scripts
     */
    async function loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            // Check if Firebase is already loaded
            if (window.firebase) {
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
     * Set up real-time listener for not relevant articles
     */
    function setupArticleListener(db) {
        console.log('Setting up real-time listener for not relevant articles...');
        
        // Query for articles where relevant === false
        const articlesRef = db.collection('articles').where('relevant', '==', false);
        
        articlesRef.onSnapshot((snapshot) => {
            console.log(`Received ${snapshot.docs.length} not relevant articles from Firestore`);
            
            if (!articlesContainer) return;
            
            // Clear existing content
            articlesContainer.innerHTML = '';
            
            // Convert snapshot to array
            const notRelevantArticles = [];
            snapshot.forEach((doc) => {
                const articleData = doc.data();
                notRelevantArticles.push(articleData);
            });
            
            // Update article count
            updateArticleCount(notRelevantArticles.length);
            
            // Display articles
            if (notRelevantArticles.length === 0) {
                showEmptyState();
            } else {
                // Sort by published date (newest first)
                notRelevantArticles.sort((a, b) => {
                    const dateA = a.published_at?.toDate ? a.published_at.toDate() : new Date(a.published_at);
                    const dateB = b.published_at?.toDate ? b.published_at.toDate() : new Date(b.published_at);
                    return dateB.getTime() - dateA.getTime();
                });
                
                notRelevantArticles.forEach(article => {
                    const articleElement = createArticleElement(article);
                    articlesContainer.appendChild(articleElement);
                });
            }
            
            console.log(`Displayed ${notRelevantArticles.length} not relevant articles`);
        }, (error) => {
            console.error('Error listening to not relevant articles:', error);
            showError('Error loading articles. Check console for details.');
        });
    }

    /**
     * Create HTML element for an article
     */
    function createArticleElement(article) {
        const articleElement = document.createElement('div');
        articleElement.classList.add('article');
        
        // Handle Firestore Timestamp
        let publishedDate;
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
        
        // Handle rated date
        let ratedDate;
        try {
            if (article.rated_at && typeof article.rated_at.toDate === 'function') {
                ratedDate = article.rated_at.toDate().toLocaleDateString();
            } else if (article.rated_at instanceof Date) {
                ratedDate = article.rated_at.toLocaleDateString();
            } else {
                ratedDate = 'Unknown date';
            }
        } catch (error) {
            console.warn('Error formatting rated date:', error);
            ratedDate = 'Unknown date';
        }
        
        // Determine content type icon
        const contentTypeIcon = article.content_source === 'scraped' ? '📰' : '📝';
        
        articleElement.innerHTML = `
            <div class="article-header">
                <h2 class="article-title">${escapeHtml(article.title)}</h2>
                <div class="trash-badge">Not Relevant</div>
            </div>
            <p class="article-summary">${escapeHtml(article.ai_summary)}</p>
            <div class="article-actions">
                <div class="action-left">
                    <a href="${escapeHtml(article.url)}" target="_blank" class="read-full-link">
                        Read Full Article ↗
                    </a>
                </div>
                <button class="unrate-btn" data-article-url="${escapeHtml(article.url)}">
                    🔄 Unrate Article
                </button>
            </div>
            <div class="article-meta">
                <span>Source: ${escapeHtml(article.source_name)}</span>
                <span>Published: ${publishedDate}</span>
                <span>Marked not relevant: ${ratedDate}</span>
                <span>Score: ${article.ai_score.toFixed(1)}</span>
                <span>${contentTypeIcon} ${article.content_source}</span>
            </div>
        `;
        
        // Add event listener for unrate button
        const unrateButton = articleElement.querySelector('.unrate-btn');
        if (unrateButton) {
            unrateButton.addEventListener('click', async (e) => {
                e.preventDefault();
                const articleUrl = unrateButton.getAttribute('data-article-url');
                
                if (articleUrl) {
                    await unrateArticle(articleUrl, articleElement);
                }
            });
        }
        
        return articleElement;
    }

    /**
     * Unrate an article (set relevant back to null)
     */
    async function unrateArticle(articleUrl, articleElement) {
        try {
            console.log(`Unrating article: ${articleUrl}`);
            
            // Show loading state
            const unrateButton = articleElement.querySelector('.unrate-btn');
            if (unrateButton) {
                unrateButton.innerHTML = '⏳ Unrating...';
                unrateButton.disabled = true;
                unrateButton.classList.add('loading');
            }
            
            // Create article ID from URL (same method used in main workflow)
            const crypto = window.crypto;
            const encoder = new TextEncoder();
            const data = encoder.encode(articleUrl);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const articleId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Get Firebase instance - use the existing app
            const firebase = window.firebase;
            const app = firebase.app('trash-app');
            const db = firebase.firestore(app);
            
            // Update the article to remove rating
            await db.collection('articles').doc(articleId).update({
                relevant: null,
                rated_at: null
            });
            
            console.log('✅ Successfully unrated article');
            
            // Show success message briefly
            if (unrateButton) {
                unrateButton.innerHTML = '✅ Unrated';
                unrateButton.classList.remove('loading');
            }
            
            // Animate article removal
            articleElement.classList.add('removing');
            
            // Remove article from DOM after animation
            setTimeout(() => {
                if (articleElement.parentNode) {
                    articleElement.parentNode.removeChild(articleElement);
                }
            }, 300);
            
        } catch (error) {
            console.error('Error unrating article:', error);
            
            // Show error and restore button
            const unrateButton = articleElement.querySelector('.unrate-btn');
            if (unrateButton) {
                unrateButton.innerHTML = '❌ Error - Try Again';
                unrateButton.disabled = false;
                unrateButton.classList.remove('loading');
                
                // Restore original button after 3 seconds
                setTimeout(() => {
                    unrateButton.innerHTML = '🔄 Unrate Article';
                }, 3000);
            }
        }
    }

    /**
     * Update the article count display
     */
    function updateArticleCount(count) {
        if (articleCountElement) {
            if (count === 0) {
                articleCountElement.textContent = 'No articles in trash';
            } else if (count === 1) {
                articleCountElement.textContent = '1 article in trash';
            } else {
                articleCountElement.textContent = `${count} articles in trash`;
            }
        }
    }

    /**
     * Show empty state when no articles are found
     */
    function showEmptyState() {
        articlesContainer.innerHTML = `
            <div class="empty-state">
                <h2>🎉 Trash is Empty!</h2>
                <p>No articles marked as "Not Relevant".<br>
                Articles you mark as not relevant will appear here.</p>
            </div>
        `;
    }

    /**
     * Show error state
     */
    function showError(message) {
        articlesContainer.innerHTML = `
            <div class="error-state">
                <h2>⚠️ Error</h2>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
        
        if (articleCountElement) {
            articleCountElement.textContent = 'Error loading articles';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}); 