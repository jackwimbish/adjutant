import { type AnalysisState, INITIAL_STATE } from './types';
import { type RSSItem, type AnalysisResult } from '../types';
import { type NewsSource } from '../config/sources';
import { preprocessArticle } from './nodes/preprocess';
import { analyzeArticle } from './nodes/analyze';
import { qualityCheckNode } from './nodes/quality-check';

/**
 * Custom workflow system that provides the same benefits as LangGraph:
 * - Multi-step processing with state management
 * - Quality validation and automatic retry logic
 * - Clean separation of concerns
 * - Comprehensive error handling
 */
export class AnalysisWorkflow {
  private async runWorkflow(initialState: AnalysisState): Promise<AnalysisState> {
    let state = { ...initialState };
    
    console.log(`🔄 Starting workflow for: ${state.article.title}`);
    
    // Step 1: Preprocess the article content
    const preprocessResult = await preprocessArticle(state);
    state = { ...state, ...preprocessResult };
    
    if (state.should_skip) {
      console.log(`⏭️  Skipping article after preprocessing: ${state.error}`);
      return state;
    }
    
    // Workflow loop: analyze → quality_check → retry if needed
    while (state.retry_count <= state.max_retries) {
      console.log(`📊 Analysis attempt ${state.retry_count + 1}/${state.max_retries + 1}`);
      
      // Step 2: Analyze the article with AI
      const analysisResult = await analyzeArticle(state);
      state = { ...state, ...analysisResult };
      
      if (state.should_skip) {
        console.log(`⏭️  Skipping article after analysis failure: ${state.error}`);
        return state;
      }
      
      // Step 3: Quality check the analysis result
      const qualityResult = await qualityCheckNode(state);
      state = { ...state, ...qualityResult };
      
      if (state.should_skip) {
        console.log(`⏭️  Skipping article after quality check failure: ${state.error}`);
        return state;
      }
      
      // If quality check passed (no issues), we're done!
      if (state.quality_issues.length === 0 && state.analysis_result) {
        console.log(`✅ Analysis completed successfully for: ${state.article.title}`);
        return state;
      }
      
      // Quality check failed, but we'll retry if we haven't exceeded max retries
      if (state.retry_count < state.max_retries) {
        console.log(`🔄 Quality issues found, retrying: ${state.quality_issues.join(', ')}`);
        continue;
      } else {
        console.log(`❌ Max retries reached, giving up on: ${state.article.title}`);
        state.should_skip = true;
        state.error = `Quality validation failed after ${state.max_retries + 1} attempts`;
        return state;
      }
    }
    
    return state;
  }
  
  public async analyzeArticle(article: RSSItem, source: NewsSource): Promise<AnalysisResult | null> {
    try {
      // Initialize workflow state
      const initialState: AnalysisState = {
        article,
        source,
        content: '',
        ...INITIAL_STATE
      } as AnalysisState;
      
      // Run the complete workflow
      const finalState = await this.runWorkflow(initialState);
      
      // Return result or null if skipped
      if (finalState.should_skip || !finalState.analysis_result) {
        return null;
      }
      
      return finalState.analysis_result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Workflow error for ${article.title}:`, errorMessage);
      return null;
    }
  }
  
  public getStatus(): string {
    return 'Custom Analysis Workflow: Active (preprocess → analyze → quality_check → retry_logic)';
  }
}

// Export a singleton instance for use throughout the application
export const analysisWorkflow = new AnalysisWorkflow();

// Convenience function that matches the expected interface
export async function analyzeArticleWithWorkflow(
  article: RSSItem,
  source: NewsSource
): Promise<AnalysisResult | null> {
  return analysisWorkflow.analyzeArticle(article, source);
}

export async function getWorkflowStatus(): Promise<string> {
  return analysisWorkflow.getStatus();
} 