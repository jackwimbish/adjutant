export interface AnalysisResult {
  ai_score: number;
  category: 'New Tool' | 'Tutorial' | 'Research' | 'Analysis' | 'Opinion';
  ai_summary: string;
}

export interface RSSItem {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  creator?: string;
  isoDate?: string;
}

export interface ArticleData {
  url: string;
  title: string;
  author: string;
  rss_excerpt: string;          // Original RSS content (may contain HTML)
  full_content_text: string;    // Scraped full article (clean text)
  source_name: string;
  published_at: Date;
  fetched_at: Date;
  ai_summary: string;
  ai_score: number;
  ai_category: string;
  is_read: boolean;
  is_hidden: boolean;
  is_favorite: boolean;
  // Content scraping metadata
  content_source: 'rss' | 'scraped' | 'failed';
  scraping_status: 'pending' | 'success' | 'failed';
  scraping_error?: string | null;
  content_length: number;       // Character count of full content
} 