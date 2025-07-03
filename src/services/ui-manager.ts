/**
 * UI Manager - Handles all DOM rendering and UI updates
 * Uses declarative template literals for better readability and maintainability
 */

import { ArticleData } from './article-service';

export class UIManager {
  private unratedContainer: HTMLElement;
  private relevantContainer: HTMLElement;
  private onMarkAsRead: (url: string, element: HTMLElement) => Promise<void>;
  private onRateArticle: (url: string, isRelevant: boolean, element: HTMLElement) => Promise<void>;
  private onUnrateArticle: (url: string, element: HTMLElement) => Promise<void>;

  constructor(
    unratedContainer: HTMLElement,
    relevantContainer: HTMLElement,
    callbacks: {
      onMarkAsRead: (url: string, element: HTMLElement) => Promise<void>;
      onRateArticle: (url: string, isRelevant: boolean, element: HTMLElement) => Promise<void>;
      onUnrateArticle: (url: string, element: HTMLElement) => Promise<void>;
    }
  ) {
    this.unratedContainer = unratedContainer;
    this.relevantContainer = relevantContainer;
    this.onMarkAsRead = callbacks.onMarkAsRead;
    this.onRateArticle = callbacks.onRateArticle;
    this.onUnrateArticle = callbacks.onUnrateArticle;
    
    console.log('UIManager: Initialized with containers and callbacks');
  }

  /**
   * Show loading state for a specific container
   */
  showLoading(type: 'unrated' | 'relevant'): void {
    const container = type === 'unrated' ? this.unratedContainer : this.relevantContainer;
    const message = type === 'unrated' ? 'Loading unrated articles...' : 'Loading relevant articles...';
    
    container.innerHTML = `<p style="color: #888; text-align: center; padding: 20px;">${message}</p>`;
  }

  /**
   * Show error state for a specific container
   */
  showError(type: 'unrated' | 'relevant', error: string): void {
    const container = type === 'unrated' ? this.unratedContainer : this.relevantContainer;
    
    container.innerHTML = `
      <p style="color: red; text-align: center; padding: 20px;">
        Error loading articles: ${error}<br>
        <small>Check console for details.</small>
      </p>
    `;
  }

  /**
   * Render articles using declarative templates
   */
  renderArticles(articles: ArticleData[], type: 'unrated' | 'relevant'): void {
    const container = type === 'unrated' ? this.unratedContainer : this.relevantContainer;
    
    console.log(`UIManager: Rendering ${articles.length} ${type} articles`);
    
    // Clear existing content
    container.innerHTML = '';
    
    if (articles.length === 0) {
      this.showEmptyState(type);
      return;
    }
    
    // Render each article using template literals
    articles.forEach(article => {
      const articleHTML = this.createArticleTemplate(article, type);
      container.insertAdjacentHTML('beforeend', articleHTML);
    });
    
    // Attach event listeners after rendering
    this.attachEventListeners(container, type);
  }

  /**
   * Show appropriate empty state message
   */
  private showEmptyState(type: 'unrated' | 'relevant'): void {
    const container = type === 'unrated' ? this.unratedContainer : this.relevantContainer;
    
    const message = type === 'unrated' 
      ? 'No unrated articles found.<br>Run the workflow to fetch some!'
      : 'No relevant articles yet.<br>Rate articles as "Relevant" to build your curated feed!';
    
    container.innerHTML = `
      <p style="text-align: center; opacity: 0.7; padding: 20px;">
        ${message}
      </p>
    `;
  }

  /**
   * Create article HTML template using template literals
   */
  private createArticleTemplate(article: ArticleData, columnType: 'unrated' | 'relevant'): string {
    const readClass = article.is_read ? ' read' : '';
    const formattedDate = this.formatDate(article.published_at);
    
    return `
      <div class="article${readClass}" data-article-url="${this.escapeHtml(article.url)}">
        ${this.createHeaderTemplate(article)}
        ${this.createSummaryTemplate(article)}
        ${this.createActionsTemplate(article, columnType)}
        ${this.createMetaTemplate(article, formattedDate)}
      </div>
    `;
  }

  /**
   * Create article header template
   */
  private createHeaderTemplate(article: ArticleData): string {
    return `
      <div class="article-header">
        <h2 class="article-title">${this.escapeHtml(article.title)}</h2>
      </div>
    `;
  }

  /**
   * Create article summary template
   */
  private createSummaryTemplate(article: ArticleData): string {
    return `
      <p class="article-summary">${this.escapeHtml(article.ai_summary)}</p>
    `;
  }

  /**
   * Create actions template (rating controls and read status)
   */
  private createActionsTemplate(article: ArticleData, columnType: 'unrated' | 'relevant'): string {
    const readStatusHTML = article.is_read 
      ? '<span class="read-status">✅ Read</span>'
      : '<button class="read-btn" data-action="mark-read">📖 Mark as Read</button>';
    
    const ratingControlsHTML = this.createRatingControlsTemplate(columnType);
    
    return `
      <div class="action-row">
        ${readStatusHTML}
        ${ratingControlsHTML}
      </div>
    `;
  }

  /**
   * Create rating controls template based on column type
   */
  private createRatingControlsTemplate(columnType: 'unrated' | 'relevant'): string {
    if (columnType === 'unrated') {
      return `
        <div class="rating-controls">
          <button class="relevant-btn" data-action="rate-relevant">✓ Relevant</button>
          <button class="not-relevant-btn" data-action="rate-not-relevant">✗ Not Relevant</button>
        </div>
      `;
    } else if (columnType === 'relevant') {
      return `
        <div class="rating-controls">
          <button class="unrate-btn" data-action="unrate">↩ Unrate</button>
        </div>
      `;
    }
    
    return '';
  }

  /**
   * Create article meta information template
   */
  private createMetaTemplate(article: ArticleData, formattedDate: string): string {
    return `
      <div class="article-meta">
        <div class="meta-row">
          <span class="source">${this.escapeHtml(article.source_name)}</span>
          <span class="author">by ${this.escapeHtml(article.author)}</span>
        </div>
        <div class="meta-row">
          <span class="date">📅 ${formattedDate}</span>
          <span class="score">🧠 Score: ${article.ai_score.toFixed(1)}</span>
        </div>
        <div class="meta-row">
          <a href="${this.escapeHtml(article.url)}" target="_blank" class="read-full-link">
            🔗 Read Full Article
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners to rendered articles
   */
  private attachEventListeners(container: HTMLElement, columnType: 'unrated' | 'relevant'): void {
    // Use event delegation for better performance
    container.addEventListener('click', async (event) => {
      const target = event.target as HTMLElement;
      const action = target.getAttribute('data-action');
      
      if (!action) return;
      
      const articleElement = target.closest('.article') as HTMLElement;
      if (!articleElement) return;
      
      const articleUrl = articleElement.getAttribute('data-article-url');
      if (!articleUrl) return;
      
      // Prevent double-clicks
      if (target.hasAttribute('disabled')) return;
      
      try {
        // Show loading state
        this.showButtonLoading(target, true);
        
        switch (action) {
          case 'mark-read':
            await this.onMarkAsRead(articleUrl, articleElement);
            this.updateReadStatus(articleElement);
            break;
            
          case 'rate-relevant':
            await this.onRateArticle(articleUrl, true, articleElement);
            this.showRatingSuccess(target, 'relevant');
            setTimeout(() => this.removeArticleWithAnimation(articleElement), 1000);
            break;
            
          case 'rate-not-relevant':
            await this.onRateArticle(articleUrl, false, articleElement);
            this.showRatingSuccess(target, 'not relevant');
            setTimeout(() => this.removeArticleWithAnimation(articleElement), 1000);
            break;
            
          case 'unrate':
            await this.onUnrateArticle(articleUrl, articleElement);
            this.showRatingSuccess(target, 'unrated');
            setTimeout(() => this.removeArticleWithAnimation(articleElement), 1000);
            break;
        }
      } catch (error) {
        console.error('UIManager: Error handling action:', error);
        this.showActionError(target);
      }
    });
  }

  /**
   * Show loading state for a button
   */
  private showButtonLoading(button: HTMLElement, isLoading: boolean): void {
    if (isLoading) {
      button.setAttribute('disabled', 'true');
      button.style.opacity = '0.6';
      button.textContent = 'Saving...';
    } else {
      button.removeAttribute('disabled');
      button.style.opacity = '1';
    }
  }

  /**
   * Update read status in the UI
   */
  private updateReadStatus(articleElement: HTMLElement): void {
    articleElement.classList.add('read');
    
    const readButton = articleElement.querySelector('.read-btn');
    if (readButton) {
      readButton.outerHTML = '<span class="read-status">✅ Read</span>';
    }
  }

  /**
   * Show rating success message
   */
  private showRatingSuccess(button: HTMLElement, ratingType: string): void {
    const ratingControls = button.closest('.rating-controls');
    if (ratingControls) {
      ratingControls.innerHTML = `<span style="color: #00aaff;">✓ Rated as ${ratingType}</span>`;
    }
  }

  /**
   * Show action error message
   */
  private showActionError(button: HTMLElement): void {
    this.showButtonLoading(button, false);
    
    const ratingControls = button.closest('.rating-controls');
    if (ratingControls) {
      ratingControls.innerHTML = '<span style="color: #ff6b6b;">Error. Please try again.</span>';
      
      // Reload page after error (simple recovery)
      setTimeout(() => {
        location.reload();
      }, 2000);
    }
  }

  /**
   * Remove article with smooth animation
   */
  private removeArticleWithAnimation(articleElement: HTMLElement): void {
    articleElement.style.transition = 'all 0.3s ease';
    articleElement.style.opacity = '0';
    articleElement.style.transform = 'translateX(-100%)';
    
    setTimeout(() => {
      articleElement.remove();
    }, 300);
  }

  /**
   * Format article publication date
   */
  private formatDate(publishedAt: any): string {
    try {
      if (publishedAt && typeof publishedAt.toDate === 'function') {
        return publishedAt.toDate().toLocaleDateString();
      } else if (publishedAt instanceof Date) {
        return publishedAt.toLocaleDateString();
      } else {
        return 'Unknown date';
      }
    } catch (error) {
      console.warn('UIManager: Error formatting date:', error);
      return 'Unknown date';
    }
  }

  /**
   * Escape HTML to prevent XSS attacks
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
} 