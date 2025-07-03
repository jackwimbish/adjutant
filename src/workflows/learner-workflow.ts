import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { LearnerState, UserProfile, ArticleData } from '../types/index.js';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeFirebaseApp, initializeFirestore } from '../services/firebase.js';
import { UserConfig } from '../config/user-config.js';

// State annotation for LangGraph
const LearnerStateAnnotation = Annotation.Root({
  ratedArticles: Annotation<ArticleData[]>,
  existingProfile: Annotation<UserProfile | undefined>,
  generatedProfile: Annotation<UserProfile | undefined>,
  errorCount: Annotation<number>,
  validationPassed: Annotation<boolean>
});

// OpenAI client and Firebase - will be initialized when workflow is created
let openaiClient: ChatOpenAI;
let firebaseDb: ReturnType<typeof initializeFirestore>;

/**
 * Initialize the learner workflow with user configuration
 */
export function initializeLearnerWorkflow(userConfig: UserConfig): void {
  openaiClient = new ChatOpenAI({
    apiKey: userConfig.openai.apiKey,
    model: 'gpt-4o',
    temperature: 0.1
  });

  // Initialize Firebase
  const firebaseApp = initializeFirebaseApp(userConfig.firebase);
  firebaseDb = initializeFirestore(firebaseApp);
}

/**
 * Node 1: Collect feedback from Firebase
 * Queries Firebase for articles with user ratings (relevant: true/false)
 */
async function collectFeedbackNode(state: typeof LearnerStateAnnotation.State): Promise<Partial<typeof LearnerStateAnnotation.State>> {
  console.log('🔍 Collecting user feedback from rated articles...');
  
  if (!firebaseDb) {
    throw new Error('Firebase not initialized. Call initializeLearnerWorkflow() first.');
  }

  try {
    const articlesCollection = collection(firebaseDb, 'articles');
    
    // Query for articles that have been rated (relevant is not null)
    const ratedQuery = query(
      articlesCollection,
      where('relevant', '!=', null)
    );
    
    const querySnapshot = await getDocs(ratedQuery);
    const ratedArticles: ArticleData[] = [];
    
    querySnapshot.forEach((docSnapshot) => {
      const articleData = docSnapshot.data() as ArticleData;
      ratedArticles.push(articleData);
    });
    
    console.log(`📊 Found ${ratedArticles.length} rated articles`);
    
    // Log breakdown for debugging
    const relevantCount = ratedArticles.filter(article => article.relevant === true).length;
    const notRelevantCount = ratedArticles.filter(article => article.relevant === false).length;
    console.log(`   - ${relevantCount} marked as relevant`);
    console.log(`   - ${notRelevantCount} marked as not relevant`);
    
    return {
      ratedArticles,
      errorCount: 0
    };
  } catch (error) {
    console.error('❌ Error collecting feedback from Firebase:', error);
    return {
      ratedArticles: [],
      errorCount: (state.errorCount || 0) + 1
    };
  }
}

/**
 * Node 2: Validate minimum threshold
 * Checks if we have at least 2 relevant + 2 not-relevant ratings
 */
async function validateThresholdNode(state: typeof LearnerStateAnnotation.State): Promise<Partial<typeof LearnerStateAnnotation.State>> {
  console.log('✅ Validating rating threshold...');
  
  const relevantCount = state.ratedArticles?.filter(article => article.relevant === true).length || 0;
  const notRelevantCount = state.ratedArticles?.filter(article => article.relevant === false).length || 0;
  
  const validationPassed = relevantCount >= 2 && notRelevantCount >= 2;
  
  console.log(`Found ${relevantCount} relevant, ${notRelevantCount} not-relevant articles`);
  console.log(`Validation ${validationPassed ? 'PASSED' : 'FAILED'}`);
  
  return {
    validationPassed
  };
}

/**
 * Node 3: Load existing profile
 * Fetches current user profile from Firebase if it exists
 */
async function loadExistingProfileNode(state: typeof LearnerStateAnnotation.State): Promise<Partial<typeof LearnerStateAnnotation.State>> {
  console.log('📂 Loading existing user profile...');
  
  if (!firebaseDb) {
    throw new Error('Firebase not initialized. Call initializeLearnerWorkflow() first.');
  }

  try {
    // Query for the user profile document with fixed ID 'user-profile'
    const profileDocRef = doc(firebaseDb, 'profiles', 'user-profile');
    const profileSnapshot = await getDoc(profileDocRef);
    
    if (profileSnapshot.exists()) {
      const existingProfile = profileSnapshot.data() as UserProfile;
      console.log('✅ Found existing user profile');
      console.log(`   - ${existingProfile.likes?.length || 0} likes`);
      console.log(`   - ${existingProfile.dislikes?.length || 0} dislikes`);
      console.log(`   - Last updated: ${existingProfile.last_updated}`);
      
      return {
        existingProfile,
        errorCount: 0
      };
    } else {
      console.log('📝 No existing profile found - will create new one');
      return {
        existingProfile: undefined,
        errorCount: 0
      };
    }
  } catch (error) {
    console.error('❌ Error loading existing profile:', error);
    return {
      existingProfile: undefined,
      errorCount: (state.errorCount || 0) + 1
    };
  }
}

/**
 * Helper function to create the AI prompt for profile generation
 */
function createProfilePrompt(
  ratedArticles: ArticleData[], 
  existingProfile?: UserProfile
): string {
  const relevantArticles = ratedArticles.filter(article => article.relevant === true);
  const notRelevantArticles = ratedArticles.filter(article => article.relevant === false);
  
  // Create article summaries for analysis
  const relevantSummaries = relevantArticles.map(article => ({
    title: article.title,
    summary: article.ai_summary,
    category: article.ai_category,
    source: article.source_name
  }));
  
  const notRelevantSummaries = notRelevantArticles.map(article => ({
    title: article.title,
    summary: article.ai_summary,
    category: article.ai_category,
    source: article.source_name
  }));

  const isEvolution = !!existingProfile;
  
  return `You are an AI assistant that analyzes user reading preferences to create personalized news profiles.

${isEvolution ? 'TASK: EVOLVE EXISTING PROFILE' : 'TASK: CREATE NEW PROFILE'}

You will analyze articles that a user has rated as "relevant" vs "not relevant" to understand their preferences.

${isEvolution ? `EXISTING PROFILE:
Likes: ${existingProfile!.likes.join(', ')}
Dislikes: ${existingProfile!.dislikes.join(', ')}
Last Updated: ${existingProfile!.last_updated}

Your task is to EVOLVE this profile based on new user feedback, not replace it entirely.
` : ''}

USER FEEDBACK DATA:

RELEVANT ARTICLES (${relevantArticles.length} articles the user found interesting):
${relevantSummaries.map((article, i) => `${i + 1}. "${article.title}"
   Category: ${article.category}
   Source: ${article.source}
   Summary: ${article.summary}
`).join('\n')}

NOT RELEVANT ARTICLES (${notRelevantArticles.length} articles the user found uninteresting):
${notRelevantSummaries.map((article, i) => `${i + 1}. "${article.title}"
   Category: ${article.category}
   Source: ${article.source}
   Summary: ${article.summary}
`).join('\n')}

ANALYSIS REQUIREMENTS:

1. LIKES (max 15 items): Extract specific preference patterns from relevant articles
   - Focus on topics, themes, industries, technologies, or concepts
   - Be specific (e.g., "AI safety research" not just "AI")
   - Look for patterns across multiple articles
   - ${isEvolution ? 'EVOLVE existing likes - refine, add new ones, or remove outdated ones' : 'Create new likes based on the data'}

2. DISLIKES (max 15 items): Extract patterns from articles marked as not relevant
   - Identify topics, themes, or content types the user avoids
   - Be specific about what they dislike
   - ${isEvolution ? 'EVOLVE existing dislikes - refine, add new ones, or remove outdated ones' : 'Create new dislikes based on the data'}

3. CHANGELOG: Provide a clear explanation of ${isEvolution ? 'what changed and why' : 'how the profile was created'}
   - Explain your reasoning
   - Mention key patterns you identified
   - ${isEvolution ? 'Highlight what was added, removed, or refined from the existing profile' : 'Describe the initial preferences discovered'}

IMPORTANT CONSTRAINTS:
- Maximum 15 likes and 15 dislikes
- Be specific and actionable (good for filtering future articles)
- Focus on content themes, not just sources or authors
- ${isEvolution ? 'Preserve valuable existing preferences while incorporating new insights' : 'Build from scratch based on user behavior'}
- Avoid overly broad categories like "technology" - be more specific

RESPONSE FORMAT (JSON only):
{
  "likes": ["specific preference 1", "specific preference 2", ...],
  "dislikes": ["specific dislike 1", "specific dislike 2", ...],
  "changelog": "Detailed explanation of ${isEvolution ? 'profile evolution' : 'profile creation'} and reasoning"
}`;
}

/**
 * Helper function to parse and validate AI response
 */
function parseProfileResponse(response: string): UserProfile | null {
  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate structure
    if (!parsed.likes || !parsed.dislikes || !parsed.changelog) {
      throw new Error('Missing required fields in response');
    }
    
    if (!Array.isArray(parsed.likes) || !Array.isArray(parsed.dislikes)) {
      throw new Error('Likes and dislikes must be arrays');
    }
    
    // Enforce limits
    const likes = parsed.likes.slice(0, 15);
    const dislikes = parsed.dislikes.slice(0, 15);
    
    return {
      likes,
      dislikes,
      changelog: parsed.changelog,
      last_updated: new Date(),
      created_at: new Date() // Will be overridden with existing date if evolving
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return null;
  }
}

/**
 * Node 4: Generate/evolve profile
 * Uses OpenAI to analyze user preferences and create/update profile
 */
async function generateProfileNode(state: typeof LearnerStateAnnotation.State): Promise<Partial<typeof LearnerStateAnnotation.State>> {
  console.log('🧠 Generating/evolving user profile with AI...');
  
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized. Call initializeLearnerWorkflow() first.');
  }
  
  if (!state.ratedArticles || state.ratedArticles.length === 0) {
    throw new Error('No rated articles available for profile generation');
  }
  
  try {
    const isEvolution = !!state.existingProfile;
    console.log(`📊 ${isEvolution ? 'Evolving existing' : 'Creating new'} profile from ${state.ratedArticles.length} rated articles`);
    
    // Create the analysis prompt
    let prompt = createProfilePrompt(state.ratedArticles, state.existingProfile);
    
    console.log('🤖 Sending analysis request to OpenAI...');
    
    // Retry logic for AI generation
    let parsedProfile: UserProfile | null = null;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/3...`);
        
        // Call OpenAI for analysis
        const response = await openaiClient.invoke([
          {
            role: 'user',
            content: prompt
          }
        ]);
        
        console.log('✅ Received AI analysis response');
        
        // Parse and validate the response
        parsedProfile = parseProfileResponse(response.content as string);
        
        if (parsedProfile) {
          console.log(`✅ Successfully parsed profile on attempt ${attempt}`);
          break;
        } else {
          throw new Error('Failed to parse AI response into valid profile');
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Attempt ${attempt} failed: ${lastError.message}`);
        
        if (attempt < 3) {
          console.log('   Retrying with refined prompt...');
          // Add a note to the prompt for retry attempts
          if (attempt === 2) {
            prompt += '\n\nIMPORTANT: Please ensure your response is valid JSON with exactly the format specified above.';
          }
        }
      }
    }
    
    if (!parsedProfile) {
      throw new Error(`AI profile generation failed after 3 attempts. Last error: ${lastError?.message}`);
    }
    
    // If evolving, preserve the original creation date
    if (isEvolution && state.existingProfile) {
      parsedProfile.created_at = state.existingProfile.created_at;
    }
    
    console.log('🎯 Profile generation successful:');
    console.log(`   - ${parsedProfile.likes.length} likes identified`);
    console.log(`   - ${parsedProfile.dislikes.length} dislikes identified`);
    console.log(`   - ${isEvolution ? 'Evolution' : 'Creation'} completed`);
    
    return {
      generatedProfile: parsedProfile,
      errorCount: 0
    };
  } catch (error) {
    console.error('❌ Error generating profile with AI:', error);
    return {
      errorCount: (state.errorCount || 0) + 1
    };
  }
}

/**
 * Node 5: Save profile
 * Saves the generated/updated profile to Firebase
 */
async function saveProfileNode(state: typeof LearnerStateAnnotation.State): Promise<Partial<typeof LearnerStateAnnotation.State>> {
  console.log('💾 Saving profile to Firebase...');
  
  if (!state.generatedProfile) {
    throw new Error('No generated profile to save');
  }

  if (!firebaseDb) {
    throw new Error('Firebase not initialized. Call initializeLearnerWorkflow() first.');
  }
  
  try {
    // Save profile to Firebase with fixed document ID 'user-profile'
    const profileDocRef = doc(firebaseDb, 'profiles', 'user-profile');
    
    // Prepare profile data for Firebase (ensure dates are properly handled)
    const profileData = {
      ...state.generatedProfile,
      last_updated: new Date(),
      created_at: state.existingProfile?.created_at || new Date()
    };
    
    await setDoc(profileDocRef, profileData);
    
    console.log('✅ Profile saved successfully to Firebase');
    console.log(`   - ${profileData.likes?.length || 0} likes stored`);
    console.log(`   - ${profileData.dislikes?.length || 0} dislikes stored`);
    
    return {
      errorCount: 0
    };
  } catch (error) {
    console.error('❌ Error saving profile to Firebase:', error);
    return {
      errorCount: (state.errorCount || 0) + 1
    };
  }
}

/**
 * Conditional edge function to determine next node
 */
function routeLearnerFlow(state: typeof LearnerStateAnnotation.State): string {
  // If validation failed, end the workflow
  if (state.validationPassed === false) {
    console.log('❌ Validation failed - ending workflow');
    return END;
  }
  
  // If we have too many errors, end the workflow
  if ((state.errorCount || 0) >= 3) {
    console.log('❌ Too many errors - ending workflow');
    return END;
  }
  
  // Continue to next node in sequence
  return 'loadExistingProfile';
}

/**
 * Create and return the compiled learner workflow
 */
export function createLearnerWorkflow(): ReturnType<typeof StateGraph.prototype.compile> {
  const workflow = new StateGraph(LearnerStateAnnotation)
    // Add all 5 nodes
    .addNode('collectFeedback', collectFeedbackNode)
    .addNode('validateThreshold', validateThresholdNode)
    .addNode('loadExistingProfile', loadExistingProfileNode)
    .addNode('generateProfile', generateProfileNode)
    .addNode('saveProfile', saveProfileNode)
    
    // Define the flow sequence
    .addEdge(START, 'collectFeedback')
    .addEdge('collectFeedback', 'validateThreshold')
    .addConditionalEdges('validateThreshold', routeLearnerFlow)
    .addEdge('loadExistingProfile', 'generateProfile')
    .addEdge('generateProfile', 'saveProfile')
    .addEdge('saveProfile', END);

  return workflow.compile();
}

/**
 * Main function to run the learner workflow
 */
export async function runLearnerWorkflow(userConfig: UserConfig): Promise<LearnerState> {
  console.log('🚀 Starting Learner Workflow...');
  
  // Initialize the workflow with user configuration
  initializeLearnerWorkflow(userConfig);
  
  const workflow = createLearnerWorkflow();
  
  const initialState: Partial<typeof LearnerStateAnnotation.State> = {
    ratedArticles: [],
    errorCount: 0,
    validationPassed: false
  };
  
  try {
    const result = await workflow.invoke(initialState);
    console.log('✅ Learner workflow completed successfully');
    return result as LearnerState;
  } catch (error) {
    console.error('❌ Learner workflow failed:', error);
    throw error;
  }
} 