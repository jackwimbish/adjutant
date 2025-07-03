import { CONFIG } from '../../config/settings';
import { type AnalysisState } from '../types';

export async function preprocessArticle(state: AnalysisState): Promise<Partial<AnalysisState>> {
  console.log(`Preprocessing article: ${state.article.title}`);
  
  // Get the best available content
  const rawContent = state.article.content || 
                    state.article.contentSnippet || 
                    state.article.summary || '';
  
  // For minimal RSS feeds (like Hugging Face), allow articles with no content
  // Content scraping will be attempted in the next step
  if (!rawContent) {
    console.log('No RSS content found, proceeding to content scraping...');
    return {
      content: '' // Empty content, will rely on content scraping
    };
  }
  
  // Clean and truncate content
  const cleanedContent = cleanContent(rawContent);
  const truncatedContent = cleanedContent.substring(0, CONFIG.AI_CONTENT_MAX_LENGTH);
  
  if (truncatedContent.length < 50) {
    console.log('RSS content too short, proceeding to content scraping...');
    return {
      content: truncatedContent // Keep what we have, content scraping may provide more
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