import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { LearnerState, UserProfile, ArticleData } from '../types/index.js';

// State annotation for LangGraph
const LearnerStateAnnotation = Annotation.Root({
  ratedArticles: Annotation<ArticleData[]>,
  existingProfile: Annotation<UserProfile | undefined>,
  generatedProfile: Annotation<UserProfile | undefined>,
  errorCount: Annotation<number>,
  validationPassed: Annotation<boolean>
});

// OpenAI client - will be initialized when workflow is created
let openaiClient: ChatOpenAI;

/**
 * Initialize the learner workflow with OpenAI API key
 */
export function initializeLearnerWorkflow(apiKey: string): void {
  openaiClient = new ChatOpenAI({
    apiKey,
    model: 'gpt-4o',
    temperature: 0.1
  });
}

/**
 * Node 1: Collect feedback from Firebase
 * Queries Firebase for articles with user ratings (relevant: true/false)
 */
async function collectFeedbackNode(state: typeof LearnerStateAnnotation.State): Promise<Partial<typeof LearnerStateAnnotation.State>> {
  console.log('🔍 Collecting user feedback from rated articles...');
  
  // TODO: Implement Firebase query for rated articles
  // For now, return placeholder data
  const ratedArticles: ArticleData[] = [];
  
  return {
    ratedArticles,
    errorCount: state.errorCount || 0
  };
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
  
  // TODO: Implement Firebase query for existing profile
  // For now, return no existing profile
  const existingProfile: UserProfile | undefined = undefined;
  
  return {
    existingProfile
  };
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
  
  try {
    // TODO: Implement AI profile generation
    // For now, return placeholder profile
    const generatedProfile: UserProfile = {
      likes: ['placeholder like'],
      dislikes: ['placeholder dislike'],
      changelog: 'Initial profile generation - placeholder',
      last_updated: new Date(),
      created_at: new Date()
    };
    
    return {
      generatedProfile,
      errorCount: 0
    };
  } catch (error) {
    console.error('Error generating profile:', error);
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
  
  try {
    // TODO: Implement Firebase save operation
    console.log('Profile saved successfully');
    
    return {
      errorCount: 0
    };
  } catch (error) {
    console.error('Error saving profile:', error);
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
export async function runLearnerWorkflow(): Promise<LearnerState> {
  console.log('🚀 Starting Learner Workflow...');
  
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