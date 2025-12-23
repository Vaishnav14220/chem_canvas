import type { Source } from '../lib/types';
import { DEFAULT_GEMINI_TEXT_MODEL, geminiGenerateText } from './geminiText';

export async function generateSummaryFromSources(sources: Source[]): Promise<string> {
  const context = sources
    .filter((s) => s.status === 'success')
    .map((s) => `Title: ${s.title}\nContent: ${(s.text || '').slice(0, 2000)}`)
    .join('\n\n');

  if (!context) return 'No content to summarize.';

  const prompt =
    'You are an expert research assistant. Analyze the provided context and provide a comprehensive summary. \n\n' +
    'Structure:\n' +
    '1. A brief 1-2 sentence overview.\n' +
    '2. 3-5 key bullet points highlighting the most important facts or insights.\n' +
    '3. A concluding sentence.\n\n' +
    'Keep it professional, concise, and easy to read.\n\nContext:\n' +
    context;

  return await geminiGenerateText({ model: DEFAULT_GEMINI_TEXT_MODEL, prompt });
}
