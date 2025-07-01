export const ANALYSIS_PROMPT_TEMPLATE = `
You are an AI news analyst for a software developer. Analyze the following article and provide a score from 1-10 on its relevance. Your response must be in JSON format.

Scoring Criteria:
- High Score (8-10): Announce a new model, library, or tool; provide a technical tutorial.
- Medium Score (5-7): Discuss benchmark comparisons, best practices.
- Low Score (1-4): Focus on opinion, social commentary, or company funding.

Article Content:
{{CONTENT}}

Your Response (JSON):
{ "ai_score": <score_from_1_to_10>, "category": "<one of: 'New Tool', 'Tutorial', 'Research', 'Analysis', 'Opinion'>", "ai_summary": "<a one-sentence summary>" }
`;

export function buildAnalysisPrompt(content: string): string {
  return ANALYSIS_PROMPT_TEMPLATE.replace('{{CONTENT}}', content);
} 