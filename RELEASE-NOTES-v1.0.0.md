# Adjutant v1.0.0 🎉

**Personal News Intelligence Dashboard**

The first official release of Adjutant - an intelligent news aggregation desktop application that automatically fetches, analyzes, and curates articles using AI.

## 🆕 What's New in v1.0.0

### Core Features
- **AI-Powered Article Analysis**: Automatic scoring and summarization using OpenAI GPT models
- **Advanced Content Extraction**: Full article scraping using Puppeteer + Mozilla Readability
- **Intelligent Two-Column Interface**: Unrated articles (left) and Relevant articles (right)
- **Smart Rating System**: Rate articles as Relevant, Neutral, or Not Relevant
- **Real-Time Updates**: Articles move between columns automatically
- **Automated Workflow**: Fetches and processes articles every 30 minutes

### Technical Highlights
- **Multi-Step Processing Pipeline**: 6-stage workflow with quality validation and retry logic
- **Duplicate Detection**: SHA256 hashing prevents reprocessing articles
- **Firebase Integration**: Real-time data synchronization with Firestore
- **Content Scraping**: Extracts full article text while falling back gracefully to RSS excerpts
- **Professional UI**: Dark theme with smooth animations and responsive design

## 📦 Installation (macOS)

### Prerequisites
You'll need:
- **OpenAI API Key** (for article analysis)
- **Firebase Project** (for data storage)

### Quick Setup

1. **Download** the `Adjutant-1.0.0-arm64.dmg` file below
2. **Install** by dragging Adjutant to your Applications folder
3. **Configure** your API keys:
   ```bash
   # Navigate to the app bundle
   cd /Applications/Adjutant.app/Contents/Resources
   
   # Copy the environment template
   cp env.example .env
   
   # Edit with your API keys (use nano, vim, or any text editor)
   nano .env
   ```

4. **Set up Firebase**:
   - Create a new project at [Firebase Console](https://console.firebase.google.com)
   - Enable Firestore Database
   - Get your config from Project Settings → General → Your apps
   - Add the 6 Firebase config values to your `.env` file

5. **Launch** Adjutant from Applications folder

### Configuration Template

Your `.env` file should look like this:

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

## 🚀 How It Works

1. **Automatic Article Fetching**: Every 30 minutes, Adjutant fetches articles from Towards Data Science RSS feed
2. **AI Analysis**: Each article is analyzed by OpenAI for relevance scoring, summarization, and categorization
3. **Content Scraping**: Full article text is extracted from original sources for better AI analysis
4. **Quality Validation**: Results are validated with automatic retry logic for failed analyses
5. **Real-Time UI**: Articles appear instantly in the dashboard, ready for your review
6. **Smart Curation**: Rate articles to build your personalized relevant feed

## 📊 Article Processing Stats

The workflow processes articles through 6 sophisticated steps:
- **RSS Fetching** → Parse feeds and extract metadata
- **Preprocessing** → Clean and validate content
- **AI Analysis** → Generate scores, summaries, and categories  
- **Quality Validation** → Ensure result quality with retry logic
- **Content Scraping** → Extract full article text using browser automation
- **Data Storage** → Save to Firebase with real-time UI updates

## 🔧 Technical Specifications

- **Platform**: macOS (Apple Silicon M1/M2)
- **Requirements**: macOS 10.15+ 
- **Dependencies**: Node.js runtime (bundled), Chromium (bundled for scraping)
- **Storage**: Firebase Firestore (cloud-based)
- **AI**: OpenAI GPT models via API
- **Updates**: Automatic article processing every 30 minutes

## 🐛 Known Issues

- Code signing warning on first launch (app is not notarized) - click "Open" in System Preferences → Security & Privacy
- Some articles may fail to scrape due to anti-bot measures (falls back to RSS excerpt)
- Large articles (>50k characters) may take longer to process

## 📋 Next Steps After Installation

1. Launch the app and wait for initial article processing
2. Review articles in the left "Unrated Articles" column
3. Rate articles using the 👍/😐/👎 buttons
4. Build your personalized "Relevant Articles" feed on the right
5. Mark articles as read using the "Mark as Read" button

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/jackwimbish/adjutant/issues)
- **Documentation**: See README.md for detailed setup and technical information
- **Source Code**: Available on GitHub for transparency and contributions

---

**Built with ❤️ for intelligent content curation**

### File Information
- **Filename**: `Adjutant-1.0.0-arm64.dmg`
- **Size**: ~221 MB
- **Architecture**: Apple Silicon (M1/M2)
- **SHA256**: Will be calculated after download 