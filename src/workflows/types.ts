import { type RSSItem, type AnalysisResult } from '../types';
import { type NewsSource } from '../config/sources';

export interface AnalysisState {
  // Input data
  article: RSSItem;
  source: NewsSource;
  content: string;
  
  // Analysis results
  ai_summary?: string;
  ai_score?: number;
  ai_category?: string;
  
  // Quality control
  quality_issues: string[];
  retry_count: number;
  max_retries: number;
  
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