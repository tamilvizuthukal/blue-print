export type SpellIssueType = 'spelling' | 'grammar' | 'uncertain';

export interface SpellIssue {
  id: string;
  source: string;
  suggestion: string;
  type: SpellIssueType;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

const resolveApiUrl = () => {
  const envUrl = (import.meta as any)?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.trim().replace(/\/$/, '');
  }
  return '/api';
};

const API_URL = resolveApiUrl();

const getAuthHeaders = () => {
  const token = localStorage.getItem('blueprint_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const extractJson = (raw: string) => {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = Math.min(
    ...['[', '{']
      .map((token) => candidate.indexOf(token))
      .filter((index) => index >= 0)
  );
  if (!Number.isFinite(start)) {
    throw new Error('AI response did not contain JSON');
  }
  const sliced = candidate.slice(start).trim();
  const endArray = sliced.lastIndexOf(']');
  const endObject = sliced.lastIndexOf('}');
  const end = Math.max(endArray, endObject);
  return sliced.slice(0, end + 1);
};

export const analyzeTamilSpellings = async (text: string): Promise<SpellIssue[]> => {
  if (!text.trim()) return [];

  const response = await fetch(`${API_URL}/ai/spell-check`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
        const errorJson = JSON.parse(errorText);
        if (response.status === 429) {
            throw new Error(`Rate limit exceeded (அதிகப்படியான கோரிக்கைகள்). Please wait a few seconds before trying again.`);
        }
        throw new Error(errorJson?.error?.message || errorJson?.error || 'AI request failed');
    } catch (e: any) {
        if (e.message.includes('Rate limit')) throw e;
        throw new Error('AI analysis failed. Please try again later.');
    }
  }

  const data = await response.json();
  const rawText = (data?.candidates || [])
    .flatMap((candidate: any) => candidate?.content?.parts || [])
    .map((part: any) => part?.text || '')
    .join('\n');

  // If backend returns the raw Gemini response, we extract it. 
  // If backend already parsed it (unlikely in current implementation but good for future), we handle both.
  const parsed = data.issues ? data : JSON.parse(extractJson(rawText));
  const issues = Array.isArray(parsed) ? parsed : parsed?.issues;
  if (!Array.isArray(issues)) return [];

  return issues
    .filter((issue) => issue?.source && issue?.suggestion && issue?.type)
    .map((issue, index) => ({
      id: `issue-${index + 1}`,
      source: String(issue.source),
      suggestion: String(issue.suggestion),
      type: issue.type === 'grammar' || issue.type === 'uncertain' ? issue.type : 'spelling',
      confidence: issue.confidence === 'high' || issue.confidence === 'low' ? issue.confidence : 'medium',
      explanation: String(issue.explanation || '')
    }));
};
