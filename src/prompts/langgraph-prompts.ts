export const INITIAL_ANALYSIS_PROMPT = `
You are an AI news analyst for a software developer. Analyze the following article and provide a score from 1-10 on its relevance. Your response must be in JSON format.

Scoring Criteria:
- High Score (8-10): Announce a new model, library, or tool; provide a technical tutorial.
- Medium Score (5-7): Discuss benchmark comparisons, best practices.
- Low Score (1-4): Focus on opinion, social commentary, or company funding.

Article Content:
{{CONTENT}}

IMPORTANT: Respond with valid JSON only. Do not include markdown formatting or code blocks.

Your Response (JSON):
{ "ai_score": <score_from_1_to_10>, "category": "<one of: 'New Tool', 'Tutorial', 'Research', 'Analysis', 'Opinion'>", "ai_summary": "<a one-sentence summary>" }
`;

export const RETRY_ANALYSIS_PROMPT = `
You are an AI news analyst for a software developer. Your previous analysis had quality issues: {{QUALITY_ISSUES}}

Please re-analyze this article more carefully, addressing the specific issues mentioned above.

Scoring Criteria:
- High Score (8-10): Announce a new model, library, or tool; provide a technical tutorial.
- Medium Score (5-7): Discuss benchmark comparisons, best practices.
- Low Score (1-4): Focus on opinion, social commentary, or company funding.

Requirements:
- Score must be between 1-10 (inclusive)
- Summary must be 20-100 words
- Category must be exactly one of: 'New Tool', 'Tutorial', 'Research', 'Analysis', 'Opinion'

Article Content:
{{CONTENT}}

IMPORTANT: Respond with valid JSON only. Do not include markdown formatting or code blocks.

Your Response (JSON):
{ "ai_score": <score_from_1_to_10>, "category": "<one of: 'New Tool', 'Tutorial', 'Research', 'Analysis', 'Opinion'>", "ai_summary": "<a one-sentence summary>" }
`;

export const QUALITY_CHECK_PROMPT = `
Evaluate this AI analysis result for quality issues. Check for:
1. Score is between 1-10 (inclusive)
2. Summary is appropriate length (20-100 words)
3. Category is one of the valid options
4. Content makes sense and is relevant

Analysis Result:
{{ANALYSIS_RESULT}}

Response Format (JSON):
{ "is_valid": <true/false>, "issues": ["issue1", "issue2", ...] }
`;

export function buildInitialAnalysisPrompt(content: string): string {
  return INITIAL_ANALYSIS_PROMPT.replace('{{CONTENT}}', content);
}

export function buildRetryAnalysisPrompt(content: string, qualityIssues: string[]): string {
  const issuesText = qualityIssues.join(', ');
  return RETRY_ANALYSIS_PROMPT
    .replace('{{CONTENT}}', content)
    .replace('{{QUALITY_ISSUES}}', issuesText);
}

export function buildQualityCheckPrompt(analysisResult: string): string {
  return QUALITY_CHECK_PROMPT.replace('{{ANALYSIS_RESULT}}', analysisResult);
} 