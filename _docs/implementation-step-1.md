# Detailed Plan: The "Learning" Workflow

The goal of this step is to create the `learning_workflow.ts` script. This script will run periodically in the background. Its sole purpose is to analyze your feedback (the articles you've marked "relevant" or "not relevant") and generate a new, updated preference profile that will be used to score future articles.

## 1. Setup and Initialization

Since API keys are now stored in application settings, your `main.ts` will be responsible for fetching them and passing them as command-line arguments when it spawns this workflow script.

### Create the Learning Workflow File

1. Create the file `src/learning_workflow.ts`

2. Add initial code to handle arguments and initialize clients:

```typescript
// src/learning_workflow.ts
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, Firestore, DocumentData, setDoc, doc } from 'firebase/firestore';
import OpenAI from 'openai';

// --- 1. HANDLE ARGUMENTS AND INITIALIZE ---

// This script expects the OpenAI API key to be passed as a command-line argument
const openAIApiKey = process.argv[2];

if (!openAIApiKey) {
  console.error("OpenAI API key was not provided.");
  process.exit(1); // Exit if the key is missing
}

console.log("Learning workflow started...");

// Initialize clients with the provided key
const openai = new OpenAI({ apiKey: openAIApiKey });

// The Firebase config can still be loaded from your .env file or be hardcoded here
// as it does not contain secrets.
const firebaseConfig = { /* Your Firebase Config Object */ };
const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
const db: Firestore = getFirestore(firebaseApp);
```

## 2. Fetch User Feedback from Firestore

Next, create a function to pull the data that will be used to "train" the new profile. We'll get the summaries of articles you've recently rated.

Add this function to your `learning_workflow.ts`:

```typescript
async function getFeedbackData(): Promise<{ favoritedSummaries: string[], hiddenSummaries: string[] }> {
  const articlesRef = collection(db, 'articles');
  const favoritedSummaries: string[] = [];
  const hiddenSummaries: string[] = [];

  // Query for the last 20 articles marked "relevant"
  const favoritedQuery = query(articlesRef, where("is_relevant", "==", true), orderBy("fetched_at", "desc"), limit(20));
  const favoritedSnapshot = await getDocs(favoritedQuery);
  favoritedSnapshot.forEach(doc => favoritedSummaries.push(doc.data().ai_summary));

  // Query for the last 20 articles marked "not relevant"
  const hiddenQuery = query(articlesRef, where("is_relevant", "==", false), orderBy("fetched_at", "desc"), limit(20));
  const hiddenSnapshot = await getDocs(hiddenQuery);
  hiddenSnapshot.forEach(doc => hiddenSummaries.push(doc.data().ai_summary));
  
  console.log(`Found ${favoritedSummaries.length} favorited and ${hiddenSummaries.length} hidden articles for analysis.`);
  return { favoritedSummaries, hiddenSummaries };
}
```

## 3. Define and Run the LangGraph "Learning" Graph

This is the core of the workflow. Instead of a simple API call, we'll use LangGraph to create a more resilient process that can validate the AI's output and retry if necessary.

Add this LangGraph setup to `learning_workflow.ts`:

```typescript
import { StateGraph, END } from '@langchain/langgraph';

// Define the state for our learning graph
interface LearningGraphState {
  favoritedSummaries: string[];
  hiddenSummaries: string[];
  profile?: { // The final output
    likes: string[];
    dislikes: string[];
    changelog: string;
  };
  errorCount: number;
}

// Define the graph's nodes
async function generateProfileNode(state: LearningGraphState): Promise<Partial<LearningGraphState>> {
  console.log("Generating new user profile...");
  const prompt = `
    You are a user preference analyst. Based on the summaries of articles the user has marked as "relevant" or "not relevant", generate a profile of their content preferences.
    Relevant Articles:
    ${state.favoritedSummaries.join('\n- ')}

    Not Relevant Articles:
    ${state.hiddenSummaries.join('\n- ')}
    
    Your Response (JSON):
    { "likes": ["<feature 1>", ...], "dislikes": ["<feature A>", ...], "changelog": "<explanation>" }
  `;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const resultJson = response.choices[0].message.content;
    return { profile: JSON.parse(resultJson) };
  } catch (e) {
    console.error("Error generating profile:", e);
    return { profile: undefined, errorCount: state.errorCount + 1 };
  }
}

// Define the conditional edge for retries
function shouldRetry(state: LearningGraphState): 'generateProfileNode' | typeof END {
  if (!state.profile || !state.profile.likes || !state.profile.dislikes) {
    if (state.errorCount > 2) {
      console.error("Failed to generate a valid profile after 3 attempts.");
      return END;
    }
    console.log("Invalid profile generated, retrying...");
    return 'generateProfileNode';
  }
  return END;
}

// Build the graph
const learningWorkflow = new StateGraph<LearningGraphState>({ /* ... channels setup ... */ });

learningWorkflow.addNode("generateProfileNode", generateProfileNode);
learningWorkflow.addConditionalEdges("generateProfileNode", shouldRetry, {
  "generateProfileNode": "generateProfileNode",
  [END]: END
});
learningWorkflow.setEntryPoint("generateProfileNode");

const learningApp = learningWorkflow.compile();
```

## 4. Putting It All Together

Finally, create the main function that calls these pieces in order.

Add this main execution block at the end of `learning_workflow.ts`:

```typescript
async function runLearningProcess() {
  const { favoritedSummaries, hiddenSummaries } = await getFeedbackData();

  if (favoritedSummaries.length === 0 && hiddenSummaries.length === 0) {
    console.log("No feedback data found. Exiting learning workflow.");
    return;
  }

  const initialState: LearningGraphState = {
    favoritedSummaries,
    hiddenSummaries,
    errorCount: 0,
  };

  const finalState = await learningApp.invoke(initialState);

  if (finalState.profile) {
    console.log("Successfully generated new profile. Saving to Firestore...");
    const profileRef = doc(db, 'profiles', 'user_main');
    await setDoc(profileRef, {
      ...finalState.profile,
      last_updated: new Date(),
    });
    console.log("Profile saved.");
  }
}

runLearningProcess();
```

## Summary

This completes the `learning_workflow.ts` script. It's a robust, resilient process using LangGraph that you can now trigger from your `main.ts`, passing in the user's OpenAI key. The workflow:

1. Initializes with the provided OpenAI API key
2. Fetches user feedback data from Firestore
3. Uses LangGraph to generate a new user preference profile with retry logic
4. Saves the updated profile back to Firestore

The script is designed to run periodically in the background and continuously improve the article recommendation system based on user feedback.