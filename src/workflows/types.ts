import { type RSSItem, type AnalysisResult } from '../types';
import { type NewsSource } from '../config/sources';
import { type UserConfig } from '../config/user-config';

export interface AnalysisState {
  // Input data
  article: RSSItem;
  source: NewsSource;
  content: string;
  
  // User configuration
  userConfig?: UserConfig;
  
  // Analysis results
  ai_summary?: string;
  ai_score?: number;
  ai_category?: string;
  
  // Quality control
  quality_issues: string[];
  retry_count: number;
  max_retries: number;
  
  // Content scraping
  rss_excerpt?: string;
  full_content_text?: string;
  content_source?: 'rss' | 'scraped' | 'failed';
  scraping_status?: 'pending' | 'success' | 'failed';
  scraping_error?: string | null;
  content_length?: number;
  
  // Final result
  analysis_result?: AnalysisResult;
  
  // Error handling
  error?: string;
  should_skip?: boolean;
}

export interface QualityCheck {
  isValid: boolean;
  issues: string[];
}

export const INITIAL_STATE: Partial<AnalysisState> = {
  quality_issues: [],
  retry_count: 0,
  max_retries: 3,
  should_skip: false,
}; 