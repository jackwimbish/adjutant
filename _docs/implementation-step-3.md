The primary goal here is to make the UI "come alive" by connecting it to your Firebase database and ensuring it updates in real-time as your background workflow adds new articles.

## Step 3 (Detailed): Building the Basic UI

**Goal**: Create the `src/renderer.ts` file. This script runs in the "renderer process" (the application window itself) and is responsible for fetching data from Firestore and rendering it as HTML.

---

### 3.1: Setup and Initialization

First, we need to set up the `renderer.ts` file to connect to Firebase. This process is identical to how we did it in `workflow.ts`, using the same `dotenv` and Firebase configuration.

**Create `src/renderer.ts` and add the initial code:** This snippet initializes the Firebase connection.

```typescript
// src/renderer.ts
import 'dotenv/config'; // Must be the first import
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';

console.log('Renderer script loaded.');

// 1. --- INITIALIZE FIREBASE ---
// This uses the same .env file as your workflow script.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const articlesCollection = collection(db, 'articles');

// We will add more code below...
```

---

### 3.2: Listening for Real-Time Data

This is the most important part of the UI. Instead of fetching data just once, we will set up a real-time listener using Firestore's `onSnapshot` function. This function is automatically triggered every time the data in the `articles` collection changes.

**Add this code to `renderer.ts`:** This code queries the collection, sorts the articles by their AI score, and attaches the listener.

```typescript
// 2. --- SETUP REAL-TIME LISTENER ---

// Get a reference to the DOM element where we will display articles.
const articleListDiv = document.getElementById('article-list');

// Create a query to get all articles, ordered by their AI score in descending order.
const articlesQuery = query(articlesCollection, orderBy('ai_score', 'desc'));

// Attach the real-time listener.
onSnapshot(articlesQuery, (snapshot) => {
  console.log('Received updated data from Firestore.');
  if (!articleListDiv) {
    console.error('Article list element not found!');
    return;
  }

  // Clear the current list of articles to prevent duplicates.
  articleListDiv.innerHTML = '';

  // Loop through each document in the snapshot.
  snapshot.forEach(doc => {
    const article = doc.data();
    
    // Create the HTML for the article and append it to the list.
    const articleElement = document.createElement('div');
    articleElement.classList.add('article');
    
    // Format the date for display
    const publishedDate = article.published_at.toDate().toLocaleDateString();

    articleElement.innerHTML = `
      <h2 class="article-title">${article.title}</h2>
      <p class="article-summary">${article.ai_summary}</p>
      <div class="article-meta">
        <span>Source: ${article.source_name}</span> |
        <span>Published: ${publishedDate}</span> |
        <span>Score: ${article.ai_score.toFixed(1)}</span>
      </div>
    `;
    
    articleListDiv.appendChild(articleElement);
  });
});
```

### 3.3: How to Test

With `main.ts`, `index.html`, `renderer.ts`, and `workflow.ts` all created, you are ready for a full end-to-end test.

**Run the App**:

```bash
npm start
```

1. This will compile your code and launch the Electron window. Initially, the window might be empty if your database has no articles.
2. **Wait for the Workflow**: Your `main.ts` is configured to run `workflow.ts` on startup. Wait for the console logs from the workflow to appear in your terminal. As the workflow processes and saves articles to Firestore, you should see them appear **instantly** in the Electron window, sorted with the highest-scoring articles at the top.

**Test Real-time Updates**: Leave the app open. Manually run the workflow again from your terminal:

```bash
npx ts-node src/workflow.ts
```

3. If the workflow finds a new article, you should see it pop into your already-open application window without needing to restart or refresh anything. This confirms that your real-time listener is working perfectly.

