import { CONFIG } from '../../config/settings';
import { type AnalysisState } from '../types';

export async function preprocessArticle(state: AnalysisState): Promise<Partial<AnalysisState>> {
  console.log(`Preprocessing article: ${state.article.title}`);
  
  // Get the best available content
  const rawContent = state.article.content || 
                    state.article.contentSnippet || 
                    state.article.summary || '';
  
  if (!rawContent) {
    return {
      should_skip: true,
      error: 'No content available for analysis'
    };
  }
  
  // Clean and truncate content
  const cleanedContent = cleanContent(rawContent);
  const truncatedContent = cleanedContent.substring(0, CONFIG.AI_CONTENT_MAX_LENGTH);
  
  if (truncatedContent.length < 50) {
    return {
      should_skip: true,
      error: 'Content too short for meaningful analysis'
    };
  }
  
  console.log(`Content processed: ${truncatedContent.length} characters`);
  
  return {
    content: truncatedContent
  };
}

function cleanContent(content: string): string {
  return content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
} 