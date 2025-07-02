import OpenAI from 'openai';
import { CONFIG } from '../../config/settings';
import { buildInitialAnalysisPrompt, buildRetryAnalysisPrompt } from '../../prompts/langgraph-prompts';
import { type AnalysisState } from '../types';
import { type AnalysisResult } from '../../types';

export async function analyzeArticle(state: AnalysisState): Promise<Partial<AnalysisState>> {
  console.log(`Analyzing article: ${state.article.title}`);
  
  if (state.should_skip) {
    return { should_skip: true };
  }
  
  if (!state.userConfig?.openai?.apiKey) {
    return {
      should_skip: true,
      error: 'No OpenAI API key available in configuration'
    };
  }
  
  try {
    // Initialize OpenAI client with config from user
    const openai = new OpenAI({
      apiKey: state.userConfig.openai.apiKey,
    });
    
    // Choose prompt based on whether this is a retry
    const prompt = state.retry_count > 0 
      ? buildRetryAnalysisPrompt(state.content, state.quality_issues)
      : buildInitialAnalysisPrompt(state.content);
    
    console.log(`Analysis attempt ${state.retry_count + 1}/${state.max_retries + 1}`);
    
    const response = await openai.chat.completions.create({
      model: CONFIG.AI_MODEL,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });
    
    const resultJson = response.choices[0]?.message?.content;
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