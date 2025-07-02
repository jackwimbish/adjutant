import puppeteer from 'puppeteer-core';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface ScrapedContent {
  success: boolean;
  content: string;
  title?: string;
  byline?: string;
  length: number;
  error?: string;
}

/**
 * Scrapes full article content from a URL using Puppeteer and Mozilla Readability
 */
export async function scrapeArticleContent(url: string): Promise<ScrapedContent> {
  let browser;
  
  try {
    console.log(`🕷️  Starting content scraping for: ${url}`);
    
    // Launch headless browser using Electron's bundled Chromium
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.execPath, // Use current Electron executable
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to the page with timeout
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 30000 
    });
    
    // Wait a bit for any dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the HTML content
    const html = await page.content();
    
    // Use Mozilla Readability to extract clean content
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    
    if (!article || !article.textContent) {
      return {
        success: false,
        content: '',
        length: 0,
        error: 'Could not extract readable content from page'
      };
    }
    
    // Clean the extracted content
    const cleanContent = cleanExtractedContent(article.textContent);
    
    console.log(`✅ Successfully scraped ${cleanContent.length} characters from: ${url}`);
    
    return {
      success: true,
      content: cleanContent,
      title: article.title || undefined,
      byline: article.byline || undefined,
      length: cleanContent.length
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Scraping failed for ${url}:`, errorMessage);
    
    return {
      success: false,
      content: '',
      length: 0,
      error: errorMessage
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Cleans and formats extracted article content
 */
function cleanExtractedContent(content: string): string {
  return content
    .replace(/\n{3,}/g, '\n\n')     // Replace multiple newlines with double newlines
    .replace(/\t/g, ' ')            // Replace tabs with spaces
    .replace(/ {3,}/g, '  ')        // Replace multiple spaces with double spaces
    .trim();
}

/**
 * Validates if a URL is scrapeable (basic checks)
 */
export function isScrapeable(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // Skip certain domains that are known to be problematic
    const blockedDomains = [
      'twitter.com',
      'x.com', 
      'youtube.com',
      'youtu.be',
      'linkedin.com',
      'facebook.com',
      'instagram.com'
    ];
    
    return !blockedDomains.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Strips HTML tags from RSS content to get clean text
 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')        // Remove HTML tags
    .replace(/&nbsp;/g, ' ')        // Replace &nbsp; with space
    .replace(/&amp;/g, '&')         // Replace &amp; with &
    .replace(/&lt;/g, '<')          // Replace &lt; with <
    .replace(/&gt;/g, '>')          // Replace &gt; with >
    .replace(/&quot;/g, '"')        // Replace &quot; with "
    .replace(/&#39;/g, "'")         // Replace &#39; with '
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim();
} 