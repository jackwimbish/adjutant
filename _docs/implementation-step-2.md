# Detailed Plan: Integrating the Profile into the Scoring Workflow

**Goal:** To modify the main `workflow.ts` script. We will update it to first fetch the user's preference profile from Firestore and then use that profile to influence the AI's scoring of every new article.

## 1. Fetching the User Profile

At the beginning of the workflow, we need to get the preference profile that the `learning_workflow.ts` created.

### Add Profile Fetching Function

Add a new function to `src/workflow.ts`:

This function retrieves the profile from Firestore. It's designed to fail gracefully by returning a default empty profile if one doesn't exist yet (e.g., for a new user).

```typescript
// src/workflow.ts

// ... (imports and initializations) ...

// Define an interface for our profile structure for type safety
interface UserProfile {
  likes: string[];
  dislikes: string[];
}

async function fetchUserProfile(): Promise<UserProfile> {
  console.log("Fetching user preference profile...");
  const defaultProfile: UserProfile = { likes: [], dislikes: [] };

  try {
    const profileRef = doc(db, 'profiles', 'user_main');
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      console.log("User profile found.");
      // Type assertion to ensure the data matches our interface
      return profileSnap.data() as UserProfile;
    } else {
      console.log("No user profile found, using default.");
      return defaultProfile;
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return defaultProfile; // Return default on error
  }
}
```

## 2. Enhancing the LangGraph Scoring Graph

Now we update the LangGraph workflow to accept and use this profile.

### Update the Graph's State Definition

The state now needs to hold the `userProfile` in addition to the article content.

```typescript
// Define the state for our scoring graph
interface ScoringGraphState {
  articleContent: string;
  userProfile: UserProfile; // Add the user profile to the state
  analysisResult?: {
    ai_score: number;
    category: string;
    ai_summary: string;
  };
  errorCount: number;
}
```

### Modify the analyzeArticleNode

This is the core change. The node's function now receives the `userProfile` via the state and injects it into the prompt.

```typescript
// Modify the analysis node to be profile-aware
async function analyzeArticleNode(state: ScoringGraphState): Promise<Partial<ScoringGraphState>> {
  console.log("Analyzing article with user profile...");
  
  // Dynamically build the preference part of the prompt
  const likesText = state.userProfile.likes.length > 0 
    ? `- The user LIKES articles that are: \n  - ${state.userProfile.likes.join('\n  - ')}` 
    : '';
  const dislikesText = state.userProfile.dislikes.length > 0 
    ? `- The user DISLIKES articles that are: \n  - ${state.userProfile.dislikes.join('\n  - ')}` 
    : '';

  const prompt = `
    You are an AI news analyst. Score the following article's relevance to a user with these specific preferences:
    ${likesText}
    ${dislikesText}

    Score the article from 1-10 based on how well it matches the user's "likes" and avoids their "dislikes". Your response must be in JSON format.
    Article Content:
    ${state.articleContent.substring(0, 4000)}

    Your Response (JSON):
    { "ai_score": <score>, "category": "<category>", "ai_summary": "<summary>" }
  `;

  // The rest of the function (making the API call and handling errors) remains the same...
  try {
    // ... OpenAI API call using the prompt above ...
  } catch (e) {
    // ... error handling ...
  }
}
```

## 3. Updating the Main Execution Loop

Finally, tie it all together in the main function of `workflow.ts`.

### Modify the Main Function

Update the main function to use the new pieces:

```typescript
async function main() {
  // First, fetch the user profile at the start of the run
  const userProfile = await fetchUserProfile();

  const sourceUrl = 'https://huggingface.co/blog/feed.xml';
  const articles = await fetchArticlesFromSource(sourceUrl);

  console.log(`Found ${articles.length} articles. Processing with personalization...`);

  // Compile your LangGraph app (assuming it's named scoringApp)
  const scoringApp = scoringWorkflow.compile();

  for (const article of articles) {
    if (!article.link || !article.content) continue;

    const articleId = createIdFromUrl(article.link);
    console.log(`Processing article: ${article.title}`);
    
    // TODO: Check if articleId exists to prevent re-processing

    // Set up the initial state for the graph for this article
    const initialState: ScoringGraphState = {
      articleContent: article.content,
      userProfile: userProfile, // Pass the fetched profile here
      errorCount: 0,
    };

    // Invoke the graph
    const finalState = await scoringApp.invoke(initialState);

    // If the graph succeeded, save the personalized result
    if (finalState.analysisResult) {
      const articleData = {
        // ... all the other article data fields
        ...finalState.analysisResult, // This now contains the personalized score
      };
      await setDoc(doc(articlesCollection, articleId), articleData);
      console.log(`Successfully saved personalized article: ${article.title}`);
    }
  }

  console.log('Personalized workflow finished.');
}

main();
```

## Summary

With these changes, your main workflow is now fully adaptive. The `ai_score` it generates for new articles will be directly influenced by the user's past feedback, creating a truly personalized experience.

### Key Changes Made:

1. **Profile Fetching**: Added `fetchUserProfile()` function with graceful error handling
2. **State Enhancement**: Updated `ScoringGraphState` to include user profile data
3. **Prompt Personalization**: Modified `analyzeArticleNode` to incorporate user preferences into the AI scoring prompt
4. **Main Loop Integration**: Updated the main execution flow to fetch and use the profile for each article

The system now creates a feedback loop where user interactions continuously improve the relevance of future article recommendations.