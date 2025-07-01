import { type AnalysisState, type QualityCheck } from '../types';

const VALID_CATEGORIES = ['New Tool', 'Tutorial', 'Research', 'Analysis', 'Opinion'];

export async function qualityCheckNode(state: AnalysisState): Promise<Partial<AnalysisState>> {
  console.log(`Quality checking analysis for: ${state.article.title}`);
  
  if (state.should_skip || !state.analysis_result) {
    return { should_skip: state.should_skip };
  }
  
  const qualityCheck = validateAnalysis(state.analysis_result);
  
  if (qualityCheck.isValid) {
    console.log('Quality check passed ✓');
    return {
      // Clear any previous quality issues since this passed
      quality_issues: []
    };
  }
  
  console.log(`Quality issues found: ${qualityCheck.issues.join(', ')}`);
  
  // Check if we should retry
  if (state.retry_count >= state.max_retries) {
    console.log(`Max retries (${state.max_retries}) reached, skipping article`);
    return {
      should_skip: true,
      error: `Quality validation failed after ${state.max_retries + 1} attempts: ${qualityCheck.issues.join(', ')}`
    };
  }
  
  // Prepare for retry
  return {
    retry_count: state.retry_count + 1,
    quality_issues: qualityCheck.issues,
    // Clear the failed analysis result so we can try again
    ai_summary: undefined,
    ai_score: undefined,
    ai_category: undefined,
    analysis_result: undefined
  };
}

function validateAnalysis(analysis: any): QualityCheck {
  const issues: string[] = [];
  
  // Check score validity
  if (typeof analysis.ai_score !== 'number' || 
      analysis.ai_score < 1 || 
      analysis.ai_score > 10) {
    issues.push(`Invalid score: ${analysis.ai_score} (must be 1-10)`);
  }
  
  // Check summary validity
  if (!analysis.ai_summary || typeof analysis.ai_summary !== 'string') {
    issues.push('Missing or invalid summary');
  } else {
    const wordCount = analysis.ai_summary.split(' ').length;
    if (wordCount < 5) {
      issues.push(`Summary too short: ${wordCount} words (minimum 5)`);
    } else if (wordCount > 50) {
      issues.push(`Summary too long: ${wordCount} words (maximum 50)`);
    }
  }
  
  // Check category validity
  if (!analysis.category || !VALID_CATEGORIES.includes(analysis.category)) {
    issues.push(`Invalid category: ${analysis.category} (must be one of: ${VALID_CATEGORIES.join(', ')})`);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
} 