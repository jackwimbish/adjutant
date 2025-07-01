import { type AnalysisState } from '../types';
import { scrapeArticleContent, isScrapeable, stripHtmlTags } from '../../utils/content-scraper';

export async function scrapeContentNode(state: AnalysisState): Promise<Partial<AnalysisState>> {
  console.log(`🔍 Checking content scraping for: ${state.article.title}`);
  
  if (state.should_skip) {
    return { should_skip: true };
  }
  
  const url = state.article.link;
  if (!url) {
    console.log('⏭️  No URL available for scraping');
    return {
      content_source: 'rss',
      scraping_status: 'failed',
      scraping_error: 'No URL available',
      full_content_text: stripHtmlTags(state.content),
      content_length: stripHtmlTags(state.content).length
    };
  }
  
  // Check if URL is scrapeable
  if (!isScrapeable(url)) {
    console.log(`⏭️  URL not scrapeable: ${url}`);
    return {
      content_source: 'rss',
      scraping_status: 'failed', 
      scraping_error: 'URL not scrapeable (blocked domain)',
      full_content_text: stripHtmlTags(state.content),
      content_length: stripHtmlTags(state.content).length
    };
  }
  
  console.log(`🕷️  Starting content scraping for: ${url}`);
  
  try {
    // Attempt to scrape the full content
    const scrapedContent = await scrapeArticleContent(url);
    
    if (scrapedContent.success && scrapedContent.content.length > 100) {
      // Successful scraping with substantial content
      console.log(`✅ Successfully scraped ${scrapedContent.length} characters from: ${state.article.title}`);
      
      return {
        content_source: 'scraped',
        scraping_status: 'success',
        full_content_text: scrapedContent.content,
        content_length: scrapedContent.length,
        rss_excerpt: stripHtmlTags(state.content),
        scraping_error: null
      };
    } else {
      // Scraping failed or content too short, fallback to RSS
      console.log(`⚠️  Scraping failed or insufficient content, using RSS excerpt: ${scrapedContent.error || 'Content too short'}`);
      
      return {
        content_source: 'rss',
        scraping_status: 'failed',
        scraping_error: scrapedContent.error || 'Scraped content too short',
        full_content_text: stripHtmlTags(state.content),
        content_length: stripHtmlTags(state.content).length,
        rss_excerpt: stripHtmlTags(state.content)
      };
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Content scraping error for ${state.article.title}:`, errorMessage);
    
    // Fallback to RSS content
    return {
      content_source: 'rss',
      scraping_status: 'failed',
      scraping_error: errorMessage,
      full_content_text: stripHtmlTags(state.content),
      content_length: stripHtmlTags(state.content).length,
      rss_excerpt: stripHtmlTags(state.content)
    };
  }
} 