# Adjutant Setup Guide

**Adjutant** is an intelligent news aggregator that automatically fetches articles from RSS feeds, analyzes them with AI for relevance scoring, and displays them in a beautiful real-time interface.

## 🚀 Quick Setup

### 1. Download & Install
1. Download the latest `Adjutant.dmg` from the [Releases page](../../releases)
2. Open the DMG file and drag Adjutant to your Applications folder
3. Launch Adjutant from Applications

### 2. Configure API Keys
The app will initially show an error because it needs your API keys. Here's how to set them up:

#### Step 1: Copy the configuration template
```bash
# Navigate to the app bundle (right-click Adjutant.app > Show Package Contents)
cd /Applications/Adjutant.app/Contents/Resources
cp env.example .env
```

#### Step 2: Get your OpenAI API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-`)

#### Step 3: Set up Firebase (Free)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Add a web app to your project
4. Go to Project Settings > General > Your apps
5. Copy the config values from the "Firebase SDK snippet"

#### Step 4: Edit your configuration
```bash
# Edit the .env file with your values
nano .env
```

Replace the placeholder values:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

### 3. Set up Firestore Database
1. In Firebase Console, go to Firestore Database
2. Create database in production mode
3. Set rules to allow read/write (for testing):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 4. Launch the App
1. Quit and restart Adjutant
2. The app will start fetching articles automatically
3. Articles appear in real-time as they're analyzed

## ✨ How It Works

1. **Automatic Fetching**: Every 30 minutes, the app fetches articles from Towards Data Science
2. **AI Analysis**: Each article goes through a sophisticated multi-step analysis:
   - Content preprocessing and cleaning
   - AI relevance scoring (1-10 scale)
   - Quality validation with automatic retry
   - Category classification
3. **Real-time Display**: Articles appear instantly in the UI, sorted by AI score
4. **Interactive Reading**: Click any article tile to expand and read the full content
5. **Beautiful Interface**: Dark theme with professional styling and smooth animations

## 🔧 Troubleshooting

### App won't start or shows errors
- Make sure your `.env` file is in the right location
- Verify all API keys are correct
- Check that Firebase rules allow read/write

### No articles appearing
- Check the console for error messages
- Verify your OpenAI API key has sufficient credits
- Ensure Firebase project is set up correctly

### App location for .env file
If you can't find the app bundle:
1. Right-click Adjutant.app in Applications
2. Select "Show Package Contents"
3. Navigate to Contents/Resources/
4. Your .env file should be here

## 💡 Features

- **Smart Analysis**: Multi-step AI workflow with quality validation
- **Real-time Updates**: Articles appear instantly as they're processed
- **Interactive Reading**: Click any article to expand and read full content
- **Professional UI**: Beautiful dark theme with smooth animations
- **Automatic Retry**: Built-in error recovery and quality checks
- **Relevance Scoring**: AI scores articles 1-10 for developer relevance
- **Source Links**: Direct links to original articles for further reading

## 🛠 For Developers

If you want to modify the source code or add RSS feeds:
1. Clone the repository
2. Install dependencies: `npm install --legacy-peer-deps`
3. Copy `env.example` to `.env` and configure
4. Run development mode: `npm start`

---

**Need help?** Open an issue on the [GitHub repository](../../issues) 