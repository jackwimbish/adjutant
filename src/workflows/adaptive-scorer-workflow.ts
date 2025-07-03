import { StateGraph, START, END, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { UserProfile, ArticleData } from '../types';
import { UserConfig } from '../config/user-config';

/**
 * State interface for the Adaptive Scorer Workflow
 */
export interface AdaptiveScorerState {
  // Input data
  article: ArticleData;
  topicDescription: string;
  
  // Workflow state
  userProfile?: UserProfile;
  topicRelevant?: boolean;
  scoredArticle?: ArticleData;
  errorCount: number;
  
  // Error tracking
  lastError?: string;
}

/**
 * LangGraph State Annotation for type safety
 */
const AdaptiveScorerStateAnnotation = Annotation.Root({
  // Input data
  article: Annotation<ArticleData>,
  topicDescription: Annotation<string>,
  
  // Workflow state  
  userProfile: Annotation<UserProfile | undefined>,
  topicRelevant: Annotation<boolean | undefined>,
  scoredArticle: Annotation<ArticleData | undefined>,
  errorCount: Annotation<number>,
  
  // Error tracking
  lastError: Annotation<string | undefined>
});

// Global clients (initialized by initializeAdaptiveScorerWorkflow)
let openaiClient: ChatOpenAI | null = null;
let firebaseDb: any = null;

/**
 * Initialize the adaptive scorer workflow with user configuration
 */
export function initializeAdaptiveScorerWorkflow(userConfig: UserConfig): void {
  console.log('🔧 Initializing Adaptive Scorer Workflow...');
  
  // Validate configuration
  if (!userConfig.openai?.apiKey) {
    throw new Error('OpenAI API key is required for adaptive scorer workflow');
  }
  
  if (!userConfig.firebase) {
    throw new Error('Firebase configuration is required for adaptive scorer workflow');
  }
  
  // Initialize OpenAI client with enhanced configuration
  openaiClient = new ChatOpenAI({
    apiKey: userConfig.openai.apiKey,
    model: 'gpt-4o-mini', // Start with cheaper model for topic filtering
    temperature: 0.1,
    maxRetries: 2,
    timeout: 30000, // 30 second timeout
  });
  
  // Firebase should already be initialized by the main process
  try {
    firebaseDb = getFirestore();
    console.log('✅ Firebase connection established');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    throw new Error('Firebase initialization failed');
  }
  
  console.log('✅ Adaptive Scorer Workflow initialized successfully');
  console.log('   - OpenAI client configured with gpt-4o-mini/gpt-4o');
  console.log('   - Firebase connection established');
  console.log('   - Cost optimization enabled');
}

/**
 * Node 1: Load User Profile
 * Loads the user profile from Firebase for scoring
 */
async function loadProfileNode(state: typeof AdaptiveScorerStateAnnotation.State): Promise<Partial<typeof AdaptiveScorerStateAnnotation.State>> {
  console.log('👤 Loading user profile for scoring...');
  
  if (!firebaseDb) {
    throw new Error('Firebase not initialized. Call initializeAdaptiveScorerWorkflow() first.');
  }
  
  try {
    const profileDocRef = doc(firebaseDb, 'profiles', 'user-profile');
    const profileDoc = await getDoc(profileDocRef);
    
    if (profileDoc.exists()) {
      const userProfile = profileDoc.data() as UserProfile;
      console.log(`✅ Profile loaded: ${userProfile.likes.length} likes, ${userProfile.dislikes.length} dislikes`);
      
      return {
        userProfile,
        errorCount: 0
      };
    } else {
      console.log('ℹ️ No user profile found - article will be unscored');
      return {
        userProfile: undefined,
        errorCount: 0
      };
    }
  } catch (error) {
    console.error('❌ Error loading profile:', error);
    return {
      errorCount: (state.errorCount || 0) + 1,
      lastError: `Profile loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Node 2: Topic Filter Check
 * Uses gpt-4o-mini for cost-optimized topic relevance filtering
 */
async function topicFilterNode(state: typeof AdaptiveScorerStateAnnotation.State): Promise<Partial<typeof AdaptiveScorerStateAnnotation.State>> {
  console.log('🔍 Checking topic relevance...');
  
  // If no profile, skip topic filtering (article will be unscored)
  if (!state.userProfile) {
    console.log('ℹ️ No profile available - skipping topic filter');
    return {
      topicRelevant: false,
      scoredArticle: {
        ...state.article,
        ai_score: null,
        ai_summary: 'No user profile available for scoring'
      }
    };
  }
  
  // Check if article was already topic-filtered to avoid re-processing
  if (state.article.topic_filtered) {
    console.log('ℹ️ Article already topic-filtered - skipping');
    return {
      topicRelevant: false,
      scoredArticle: {
        ...state.article,
        ai_score: null,
        ai_summary: 'Article previously filtered as off-topic'
      }
    };
  }
  
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Call initializeAdaptiveScorerWorkflow() first.');
  }
  
  // Retry logic for topic filtering
  let lastError: Error | null = null;
  const maxRetries = 2;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create topic relevance prompt with enhanced clarity
      const topicPrompt = `Is this article relevant to the topic: "${state.topicDescription}"?

Article Title: ${state.article.title}
Article Summary: ${state.article.ai_summary || state.article.rss_excerpt || 'No summary available'}

Instructions:
- Consider if the article content directly relates to the specified topic
- Ignore tangential mentions unless they are the main focus
- Respond with ONLY "yes" or "no" (no additional text)

Response:`;

      console.log(`🤖 Checking topic relevance with gpt-4o-mini (attempt ${attempt}/${maxRetries})...`);
      
      const response = await openaiClient.invoke([
        {
          role: 'user',
          content: topicPrompt
        }
      ]);
      
      const responseText = (response.content as string).toLowerCase().trim();
      
      // Enhanced response parsing
      let isRelevant = false;
      if (responseText.includes('yes') && !responseText.includes('no')) {
        isRelevant = true;
      } else if (responseText.includes('no') && !responseText.includes('yes')) {
        isRelevant = false;
      } else {
        // Ambiguous response - try again if we have retries left
        if (attempt < maxRetries) {
          console.warn(`⚠️ Ambiguous response: "${responseText}" - retrying...`);
          continue;
        } else {
          // Default to not relevant on final attempt
          console.warn(`⚠️ Ambiguous response on final attempt: "${responseText}" - defaulting to not relevant`);
          isRelevant = false;
        }
      }
      
      console.log(`✅ Topic relevance check: ${isRelevant ? 'RELEVANT' : 'NOT RELEVANT'}`);
      
      if (!isRelevant) {
        // Mark article as topic-filtered to avoid re-processing
        return {
          topicRelevant: false,
          scoredArticle: {
            ...state.article,
            ai_score: null,
            ai_summary: 'Article not relevant to user topic interests',
            topic_filtered: true,
            topic_filtered_at: new Date()
          }
        };
      }
      
      return {
        topicRelevant: true,
        errorCount: 0
      };
      
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Topic filter attempt ${attempt} failed:`, error);
      
      // If we have retries left, continue
      if (attempt < maxRetries) {
        console.log(`   Retrying topic filter (${attempt + 1}/${maxRetries})...`);
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    }
  }
  
  // All retries failed
  console.error('❌ Topic filter failed after all retries');
  return {
    errorCount: (state.errorCount || 0) + 1,
    lastError: `Topic filtering failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  };
}

/**
 * Node 3: Profile-Based Scoring
 * Uses gpt-4o for sophisticated profile-based article scoring
 */
async function profileScoringNode(state: typeof AdaptiveScorerStateAnnotation.State): Promise<Partial<typeof AdaptiveScorerStateAnnotation.State>> {
  console.log('🎯 Performing profile-based scoring...');
  
  if (!state.userProfile) {
    console.log('ℹ️ No profile available - returning unscored article');
    return {
      scoredArticle: {
        ...state.article,
        ai_score: null,
        ai_summary: 'No user profile available for scoring'
      }
    };
  }
  
  if (!state.topicRelevant) {
    console.log('ℹ️ Article not topic-relevant - already handled');
    return {}; // scoredArticle should already be set by topicFilterNode
  }
  
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Call initializeAdaptiveScorerWorkflow() first.');
  }
  
  // Retry logic for profile scoring
  let lastError: Error | null = null;
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Switch to gpt-4o for sophisticated scoring
      const scoringClient = new ChatOpenAI({
        apiKey: openaiClient.apiKey,
        model: 'gpt-4o',
        temperature: 0.1
      });
      
      // Create profile-based scoring prompt with enhanced instructions
      const scoringPrompt = `You are an AI content curator. Score this article from 1-10 based on how well it matches the user's preferences.

USER PREFERENCES:
Likes: ${state.userProfile.likes.join(', ')}
Dislikes: ${state.userProfile.dislikes.join(', ')}

ARTICLE TO SCORE:
Title: ${state.article.title}
Content: ${state.article.full_content_text || state.article.ai_summary || state.article.rss_excerpt}

SCORING GUIDELINES:
- Score 8-10: Strong match with user's likes, addresses their interests directly
- Score 6-7: Moderate match, some alignment with preferences
- Score 4-5: Neutral content, neither strongly liked nor disliked
- Score 2-3: Some elements user might dislike, but not strongly negative  
- Score 1: Strong match with user's dislikes, content they would avoid

INSTRUCTIONS:
- Consider content themes, writing style, technical depth, and subject matter
- Be specific about which preferences influenced your scoring
- Provide a concise but informative summary
- Ensure your score reflects the strength of preference alignment

Response format (JSON):
{
  "score": <number 1-10>,
  "summary": "Brief explanation of why this article would/wouldn't interest the user",
  "reasoning": "Which specific preferences influenced this score"
}`;

      console.log(`🤖 Performing profile-based scoring with gpt-4o (attempt ${attempt}/${maxRetries})...`);
      
      const response = await scoringClient.invoke([
        {
          role: 'user',
          content: scoringPrompt
        }
      ]);
      
      const responseText = response.content as string;
      
      // Enhanced JSON parsing with multiple strategies
      let scoringData;
      try {
        // Strategy 1: Try direct JSON parse first
        try {
          scoringData = JSON.parse(responseText);
        } catch {
          // Strategy 2: Extract JSON from response (in case there's extra text)
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('No JSON found in response');
          }
          scoringData = JSON.parse(jsonMatch[0]);
        }
        
        // Validate response structure
        if (typeof scoringData.score !== 'number' || 
            scoringData.score < 1 || 
            scoringData.score > 10 ||
            !Number.isInteger(scoringData.score)) {
          throw new Error(`Invalid score in response: ${scoringData.score}`);
        }
        
        if (!scoringData.summary || typeof scoringData.summary !== 'string' || scoringData.summary.trim().length === 0) {
          throw new Error('Missing or invalid summary in response');
        }
        
        if (!scoringData.reasoning || typeof scoringData.reasoning !== 'string' || scoringData.reasoning.trim().length === 0) {
          throw new Error('Missing or invalid reasoning in response');
        }
        
        // Successful parsing
        console.log(`✅ Article scored: ${scoringData.score}/10`);
        console.log(`   Summary: ${scoringData.summary}`);
        console.log(`   Reasoning: ${scoringData.reasoning}`);
        
        const scoredArticle: ArticleData = {
          ...state.article,
          ai_score: scoringData.score,
          ai_summary: scoringData.summary,
          ai_category: 'personalized' // Mark as profile-scored
        };
        
        return {
          scoredArticle,
          errorCount: 0
        };
        
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse scoring response (attempt ${attempt}):`, parseError);
        console.warn(`   Raw response: ${responseText.substring(0, 200)}...`);
        
        // If we have retries left, continue
        if (attempt < maxRetries) {
          console.log(`   Retrying profile scoring (${attempt + 1}/${maxRetries})...`);
          continue;
        } else {
          // Final attempt - use fallback scoring
          console.warn('⚠️ Using fallback scoring on final attempt');
          const fallbackScore = 5; // Neutral score
          const scoredArticle: ArticleData = {
            ...state.article,
            ai_score: fallbackScore,
            ai_summary: 'Unable to parse AI scoring response - using neutral score',
            ai_category: 'personalized-fallback'
          };
          
          return {
            scoredArticle,
            errorCount: 0 // Don't count as error since we provided fallback
          };
        }
      }
      
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Profile scoring attempt ${attempt} failed:`, error);
      
      // If we have retries left, continue
      if (attempt < maxRetries) {
        console.log(`   Retrying profile scoring (${attempt + 1}/${maxRetries})...`);
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    }
  }
  
  // All retries failed
  console.error('❌ Profile scoring failed after all retries');
  return {
    errorCount: (state.errorCount || 0) + 1,
    lastError: `Profile scoring failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  };
}

/**
 * Conditional routing function for workflow flow control
 */
function routeScorerFlow(state: typeof AdaptiveScorerStateAnnotation.State): string {
  // If too many errors, end workflow
  if ((state.errorCount || 0) >= 3) {
    console.log('❌ Too many errors - ending workflow');
    return END;
  }
  
  // If no profile loaded, skip to end (article will be unscored)
  if (!state.userProfile) {
    console.log('ℹ️ No profile available - ending workflow');
    return END;
  }
  
  // Continue to topic filter
  return 'topicFilter';
}

/**
 * Conditional routing after topic filter
 */
function routeAfterTopicFilter(state: typeof AdaptiveScorerStateAnnotation.State): string {
  // If too many errors, end workflow
  if ((state.errorCount || 0) >= 3) {
    console.log('❌ Too many errors - ending workflow');
    return END;
  }
  
  // If topic not relevant, end workflow (article already marked)
  if (!state.topicRelevant) {
    console.log('ℹ️ Article not topic-relevant - ending workflow');
    return END;
  }
  
  // Continue to profile scoring
  return 'profileScoring';
}

/**
 * Create and return the compiled adaptive scorer workflow
 */
export function createAdaptiveScorerWorkflow(): ReturnType<typeof StateGraph.prototype.compile> {
  const workflow = new StateGraph(AdaptiveScorerStateAnnotation)
    // Add all 3 nodes
    .addNode('loadProfile', loadProfileNode)
    .addNode('topicFilter', topicFilterNode)
    .addNode('profileScoring', profileScoringNode)
    
    // Define the flow sequence
    .addEdge(START, 'loadProfile')
    .addConditionalEdges('loadProfile', routeScorerFlow, {
      'topicFilter': 'topicFilter',
      [END]: END
    })
    .addConditionalEdges('topicFilter', routeAfterTopicFilter, {
      'profileScoring': 'profileScoring',
      [END]: END
    })
    .addEdge('profileScoring', END);

  return workflow.compile();
}

/**
 * Main function to run the adaptive scorer workflow
 */
export async function runAdaptiveScorerWorkflow(
  article: ArticleData, 
  topicDescription: string, 
  userConfig: UserConfig
): Promise<ArticleData> {
  const startTime = Date.now();
  console.log(`🚀 Starting Adaptive Scorer Workflow for: ${article.title}`);
  
  // Initialize the workflow with user configuration
  try {
    initializeAdaptiveScorerWorkflow(userConfig);
  } catch (error) {
    console.error('❌ Failed to initialize adaptive scorer workflow:', error);
    return {
      ...article,
      ai_score: null,
      ai_summary: `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
  
  const workflow = createAdaptiveScorerWorkflow();
  
  const initialState: Partial<typeof AdaptiveScorerStateAnnotation.State> = {
    article,
    topicDescription,
    errorCount: 0
  };
  
  try {
    console.log('⚙️ Executing workflow...');
    const result = await workflow.invoke(initialState);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (result.scoredArticle) {
      console.log(`✅ Adaptive scorer workflow completed successfully in ${duration}ms`);
      
      // Log performance metrics
      if (result.scoredArticle.ai_score !== null) {
        console.log(`   📊 Article scored: ${result.scoredArticle.ai_score}/10`);
        console.log(`   💰 Cost optimization: ${result.scoredArticle.topic_filtered ? 'Topic filtered (low cost)' : 'Full scoring (higher cost)'}`);
      } else {
        console.log(`   ℹ️ Article unscored: ${result.scoredArticle.ai_summary}`);
      }
      
      return result.scoredArticle;
    } else {
      console.log(`⚠️ Workflow completed but no scored article returned (${duration}ms)`);
      return {
        ...article,
        ai_score: null,
        ai_summary: 'Scoring workflow completed without result'
      };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error(`❌ Adaptive scorer workflow failed after ${duration}ms:`, error);
    
    // Return unscored article on failure with detailed error info
    return {
      ...article,
      ai_score: null,
      ai_summary: `Scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Utility function to check if a profile exists
 */
export async function checkProfileExists(userConfig: UserConfig): Promise<boolean> {
  try {
    initializeAdaptiveScorerWorkflow(userConfig);
    
    const profileDocRef = doc(firebaseDb, 'profiles', 'user-profile');
    const profileDoc = await getDoc(profileDocRef);
    
    return profileDoc.exists();
  } catch (error) {
    console.error('❌ Error checking profile existence:', error);
    return false;
  }
}

/**
 * Utility function to get workflow performance stats
 */
export function getWorkflowStats(): {
  isInitialized: boolean;
  hasOpenAIClient: boolean;
  hasFirebaseConnection: boolean;
} {
  return {
    isInitialized: !!(openaiClient && firebaseDb),
    hasOpenAIClient: !!openaiClient,
    hasFirebaseConnection: !!firebaseDb
  };
} 