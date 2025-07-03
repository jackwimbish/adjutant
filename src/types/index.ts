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
  ai_score: number | null;      // null when no profile available or scoring fails
  ai_category: string;
  is_read: boolean;
  is_hidden: boolean;
  is_favorite: boolean;
  // User relevance rating
  relevant: boolean | null;  // null = unrated, true = relevant, false = not relevant
  rated_at?: Date;
  // Content scraping metadata
  content_source: 'rss' | 'scraped' | 'failed';
  scraping_status: 'pending' | 'success' | 'failed';
  scraping_error?: string | null;
  content_length: number;       // Character count of full content
  // Topic filtering optimization
  topic_filtered?: boolean;     // True if filtered out by topic check
  topic_filtered_at?: Date;     // When topic filtering occurred
}

// Learning Algorithm Interfaces

export interface UserProfile {
  likes: string[];           // Max 15 items - descriptive preference phrases
  dislikes: string[];        // Max 15 items - descriptive dislike phrases
  changelog: string;         // AI explanation of changes made to profile
  last_updated: Date;        // When profile was last updated
  created_at: Date;          // When profile was first created
}

export interface LearnerState {
  ratedArticles: ArticleData[];     // Articles with user ratings
  existingProfile?: UserProfile;    // Current profile if it exists
  newProfile?: UserProfile;         // Generated/evolved profile
  errorCount: number;               // Retry counter for error handling
  validationErrors?: string[];      // Validation error messages
}

export interface AdaptiveScorerState {
  article: ArticleData;             // Article to be scored
  userProfile?: UserProfile;        // User's preference profile
  topicDescription: string;         // Topic filtering criteria
  scoredArticle?: ArticleData;      // Article with score applied
  errorCount: number;               // Retry counter for error handling
} 