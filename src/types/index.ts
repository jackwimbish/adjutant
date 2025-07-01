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