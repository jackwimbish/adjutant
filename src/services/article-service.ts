/**
 * Article Service - Handles all Firebase interactions for articles
 * Provides optimized queries and data management for the article system
 */

// Article data type interface
export interface ArticleData {
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

// Callback type for article updates
export type ArticleUpdateCallback = (articles: ArticleData[], type: 'unrated' | 'relevant') => void;

export class ArticleService {
  private firebase: any;
  private db: any;
  private unratedListener: (() => void) | null = null;
  private relevantListener: (() => void) | null = null;

  constructor(firebaseConfig: any) {
    // Initialize Firebase using the compat SDK
    this.firebase = (window as any).firebase;
    if (!this.firebase) {
      throw new Error('Firebase SDK not loaded');
    }
    
    const app = this.firebase.initializeApp(firebaseConfig, 'article-service');
    this.db = this.firebase.firestore();
    console.log('ArticleService: Firebase initialized successfully');
  }

  /**
   * Set up optimized real-time listeners for articles
   * Uses separate queries for better performance
   */
  setupArticleListeners(callback: ArticleUpdateCallback): void {
    console.log('ArticleService: Setting up optimized article listeners...');
    
    // Set up listener for unrated articles (relevant is null)
    this.unratedListener = this.db.collection('articles')
      .where('relevant', '==', null)
      .onSnapshot((snapshot: any) => {
        console.log(`ArticleService: Received ${snapshot.docs.length} unrated articles`);
        
        const articles: ArticleData[] = [];
        snapshot.forEach((doc: any) => {
          articles.push(doc.data() as ArticleData);
        });
        
        // Sort by published date (newest first)
        articles.sort(this.sortByDate);
        
        callback(articles, 'unrated');
      }, (error: any) => {
        console.error('ArticleService: Error in unrated articles listener:', error);
        callback([], 'unrated'); // Return empty array on error
      });

    // Set up listener for relevant articles (relevant is true)
    this.relevantListener = this.db.collection('articles')
      .where('relevant', '==', true)
      .onSnapshot((snapshot: any) => {
        console.log(`ArticleService: Received ${snapshot.docs.length} relevant articles`);
        
        const articles: ArticleData[] = [];
        snapshot.forEach((doc: any) => {
          articles.push(doc.data() as ArticleData);
        });
        
        // Sort by published date (newest first)
        articles.sort(this.sortByDate);
        
        callback(articles, 'relevant');
      }, (error: any) => {
        console.error('ArticleService: Error in relevant articles listener:', error);
        callback([], 'relevant'); // Return empty array on error
      });
  }

  /**
   * Sort articles by published date (newest first)
   */
  private sortByDate = (a: ArticleData, b: ArticleData): number => {
    const dateA = a.published_at?.toDate ? a.published_at.toDate() : new Date(a.published_at);
    const dateB = b.published_at?.toDate ? b.published_at.toDate() : new Date(b.published_at);
    return dateB.getTime() - dateA.getTime();
  };

  /**
   * Create article ID from URL using SHA-256 hash
   */
  private async createArticleId(url: string): Promise<string> {
    const crypto = (window as any).crypto;
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Mark an article as read
   */
  async markAsRead(articleUrl: string): Promise<void> {
    try {
      console.log(`ArticleService: Marking article as read: ${articleUrl}`);
      
      const articleId = await this.createArticleId(articleUrl);
      
      await this.db.collection('articles').doc(articleId).update({
        is_read: true
      });
      
      console.log('ArticleService: ✅ Successfully marked article as read');
    } catch (error) {
      console.error('ArticleService: Error marking article as read:', error);
      throw error;
    }
  }

  /**
   * Rate an article (relevant or not relevant)
   */
  async rateArticle(articleUrl: string, isRelevant: boolean): Promise<void> {
    try {
      const relevanceText = isRelevant ? 'relevant' : 'not relevant';
      console.log(`ArticleService: Rating article as ${relevanceText}: ${articleUrl}`);
      
      const articleId = await this.createArticleId(articleUrl);
      
      await this.db.collection('articles').doc(articleId).update({
        relevant: isRelevant,
        rated_at: this.firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`ArticleService: ✅ Successfully rated article as ${relevanceText}`);
    } catch (error) {
      console.error('ArticleService: Error rating article:', error);
      throw error;
    }
  }

  /**
   * Remove rating from an article (set relevant back to null)
   */
  async unrateArticle(articleUrl: string): Promise<void> {
    try {
      console.log(`ArticleService: Unrating article: ${articleUrl}`);
      
      const articleId = await this.createArticleId(articleUrl);
      
      await this.db.collection('articles').doc(articleId).update({
        relevant: null,
        rated_at: this.firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('ArticleService: ✅ Successfully unrated article');
    } catch (error) {
      console.error('ArticleService: Error unrating article:', error);
      throw error;
    }
  }

  /**
   * Format article publication date
   */
  formatDate(publishedAt: any): string {
    try {
      if (publishedAt && typeof publishedAt.toDate === 'function') {
        return publishedAt.toDate().toLocaleDateString();
      } else if (publishedAt instanceof Date) {
        return publishedAt.toLocaleDateString();
      } else {
        return 'Unknown date';
      }
    } catch (error) {
      console.warn('ArticleService: Error formatting date:', error);
      return 'Unknown date';
    }
  }

  /**
   * Clean up listeners when service is no longer needed
   */
  destroy(): void {
    console.log('ArticleService: Cleaning up listeners...');
    
    if (this.unratedListener) {
      this.unratedListener();
      this.unratedListener = null;
    }
    
    if (this.relevantListener) {
      this.relevantListener();
      this.relevantListener = null;
    }
  }
} 