# Adjutant 📰

**Personal News Intelligence Dashboard**

Adjutant is an intelligent news aggregation desktop application built with Electron that automatically fetches, analyzes, and curates articles using AI. It helps you stay informed by scoring articles for relevance and building a personalized knowledge feed based on your preferences.

## Features

### 🤖 **AI-Powered Analysis**
- Automatic article scoring using OpenAI GPT models
- Intelligent content summarization
- Category classification and relevance detection
- Quality validation with automatic retry logic

### 🕷️ **Advanced Content Extraction**
- Full article scraping using Puppeteer + Mozilla Readability
- Smart fallback to RSS excerpts when scraping fails
- Clean, readable content extraction from original sources

### 📊 **Intelligent Curation**
- **Two-column interface**: Unrated articles (left) and Relevant articles (right)
- **Smart rating system**: Rate articles as Relevant, Neutral, or Not Relevant
- **Read tracking**: Mark articles as read with visual greying
- **Real-time updates**: Articles move between columns automatically

### 🔄 **Automated Workflow**
- Fetches articles every 30 minutes automatically
- Processes articles through a sophisticated LangGraph-style pipeline
- Stores full article content and analysis in Firebase Firestore
- Duplicate detection prevents redundant processing

## Quick Start (Release Version)

### Prerequisites
You'll need accounts and API keys for:
- **OpenAI API** (for article analysis)
- **Firebase Project** (for data storage)

### Installation

1. **Download the latest release** from [GitHub Releases](https://github.com/your-repo/adjutant/releases)
2. **Install the DMG** by dragging Adjutant to your Applications folder
3. **Set up your configuration**:
   ```bash
   # Navigate to the app bundle
   cd /Applications/Adjutant.app/Contents/Resources
   
   # Copy the environment template
   cp env.example .env
   
   # Edit with your API keys
   nano .env
   ```

### Configuration

Edit the `.env` file with your credentials:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

### Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Firestore Database
3. Set Firestore rules to allow read/write (for development):
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
4. Get your configuration from Project Settings → General → Your apps

### Launch
Simply run Adjutant from your Applications folder. The app will:
- Start processing articles automatically
- Display them in the two-column interface
- Run the workflow every 30 minutes

## Article Processing Workflow

Adjutant uses a sophisticated multi-step pipeline inspired by LangGraph to process articles:

### 1. **RSS Fetching**
```
📡 RSS Feed → Parse → Extract Articles
```
- Fetches from configured RSS feeds (currently Towards Data Science)
- Parses XML and extracts article metadata
- Filters for articles with sufficient content

### 2. **Preprocessing**
```
📋 Raw Content → Clean → Validate → Structure
```
- Cleans and normalizes article content
- Validates required fields (title, content, URL)
- Prepares content for AI analysis
- Skips articles that don't meet quality thresholds

### 3. **AI Analysis**
```
🧠 Content → OpenAI API → Score + Summary + Category
```
- Sends article content to OpenAI GPT models
- Generates relevance score (1-10)
- Creates concise AI summary
- Classifies into categories
- Uses sophisticated prompts optimized for technical content

### 4. **Quality Validation**
```
✅ AI Response → Validate → Retry if Needed
```
- Validates AI response format and content quality
- Checks for required fields (score, summary, category)
- Triggers retry with enhanced prompts if validation fails
- Maximum 3 retry attempts with different prompt strategies

### 5. **Content Scraping**
```
🕷️ Article URL → Puppeteer → Readability → Clean Text
```
- Launches headless browser to visit original article
- Uses Mozilla Readability algorithm to extract main content
- Cleans and formats extracted text
- Falls back to RSS excerpt if scraping fails
- Handles anti-bot measures and dynamic content

### 6. **Data Storage**
```
💾 Processed Article → Firebase Firestore → Real-time UI Update
```
- Stores complete article data with analysis results
- Includes both RSS excerpt and scraped full content
- Tracks content source and scraping status
- Updates user interface in real-time

### Workflow State Management

The workflow maintains state throughout processing:

```typescript
interface AnalysisState {
  // Input data
  article: RSSItem;
  source: NewsSource;
  content: string;
  
  // Analysis results  
  ai_summary?: string;
  ai_score?: number;
  ai_category?: string;
  
  // Content scraping
  rss_excerpt?: string;
  full_content_text?: string;
  content_source?: 'rss' | 'scraped' | 'failed';
  
  // Quality control
  quality_issues: string[];
  retry_count: number;
  max_retries: number;
  
  // Error handling
  error?: string;
  should_skip?: boolean;
}
```

### Error Handling & Resilience

- **Retry Logic**: Failed analyses retry up to 3 times with improved prompts
- **Graceful Degradation**: Scraping failures fall back to RSS content
- **Rate Limiting**: Respects OpenAI API rate limits with exponential backoff
- **Duplicate Prevention**: SHA256 hashing prevents reprocessing articles
- **Comprehensive Logging**: Detailed logs with emoji-coded status indicators

## Data Model

### Article Schema
```typescript
interface ArticleData {
  // Core content
  url: string;
  title: string;
  author: string;
  rss_excerpt: string;        // Original RSS content
  full_content_text: string;  // Scraped full article
  
  // Metadata
  source_name: string;
  published_at: Date;
  fetched_at: Date;
  
  // AI Analysis
  ai_summary: string;
  ai_score: number;           // 1-10 relevance score
  ai_category: string;
  
  // User interaction
  user_rating: 'positive' | 'negative' | 'neutral' | null;
  rated_at?: Date;
  is_read: boolean;
  
  // Content tracking
  content_source: 'rss' | 'scraped' | 'failed';
  scraping_status: 'pending' | 'success' | 'failed';
  content_length: number;
}
```

## Development

### Prerequisites
- Node.js 16+
- npm or yarn
- OpenAI API key
- Firebase project

### Setup
```bash
git clone https://github.com/your-repo/adjutant.git
cd adjutant
npm install
cp env.example .env
# Edit .env with your credentials
npm run build
npm start
```

### Building Releases
```bash
npm run dist:mac    # Create DMG for macOS
npm run pack        # Create app bundle for testing
npm run release     # Complete build with instructions
```

## Architecture

- **Frontend**: Electron with TypeScript, HTML/CSS, Firebase SDK
- **Backend**: Node.js workflow with OpenAI integration  
- **Database**: Firebase Firestore with real-time listeners
- **AI Processing**: Custom LangGraph-style workflow with quality validation
- **Content Extraction**: Puppeteer + Mozilla Readability
- **Distribution**: electron-builder with DMG packaging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please [open an issue](https://github.com/your-repo/adjutant/issues) on GitHub.

---

**Built with ❤️ for intelligent content curation** 