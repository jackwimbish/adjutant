import { ChatOpenAI } from '@langchain/openai';
import { CONFIG } from '../../config/settings';
import { buildInitialAnalysisPrompt, buildRetryAnalysisPrompt } from '../../prompts/langgraph-prompts';
import { type AnalysisState } from '../types';
import { type AnalysisResult } from '../../types';

// Initialize OpenAI client
const llm = new ChatOpenAI({
  modelName: CONFIG.AI_MODEL,
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeArticle(state: AnalysisState): Promise<Partial<AnalysisState>> {
  console.log(`Analyzing article: ${state.article.title}`);
  
  if (state.should_skip) {
    return { should_skip: true };
  }
  
  try {
    // Choose prompt based on whether this is a retry
    const prompt = state.retry_count > 0 
      ? buildRetryAnalysisPrompt(state.content, state.quality_issues)
      : buildInitialAnalysisPrompt(state.content);
    
    console.log(`Analysis attempt ${state.retry_count + 1}/${state.max_retries + 1}`);
    
    const response = await llm.invoke([
      { role: 'user', content: prompt }
    ]);
    
    const resultJson = response.content as string;
    if (!resultJson) {
      throw new Error('No content received from OpenAI');
    }
    
    // Clean the response - remove markdown code blocks if present
    const cleanedJson = cleanJsonResponse(resultJson);
    const analysis = JSON.parse(cleanedJson) as AnalysisResult;
    
    return {
      ai_summary: analysis.ai_summary,
      ai_score: analysis.ai_score,
      ai_category: analysis.category,
      analysis_result: analysis
    };
    
  } catch (error) {
    console.error(`Analysis failed:`, error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (state.retry_count >= state.max_retries) {
      return {
        should_skip: true,
        error: `Analysis failed after ${state.max_retries + 1} attempts: ${errorMessage}`
      };
    }
    
    return {
      error: `Analysis attempt ${state.retry_count + 1} failed: ${errorMessage}`,
      quality_issues: [...state.quality_issues, `API Error: ${errorMessage}`]
    };
  }
}

function cleanJsonResponse(response: string): string {
  // Remove markdown code blocks if present
  let cleaned = response.trim();
  
  // Remove ```json and ``` markers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '');
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  
  return cleaned.trim();
} 