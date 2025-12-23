import type { Slide, Source } from '../lib/types';
import { DEFAULT_GEMINI_TEXT_MODEL, geminiGenerateJson } from './geminiText';

function buildContentFromSources(sources: Source[], maxChars = 5000) {
  const payload = sources
    .filter((s) => s.status === 'success' && (s.text || s.content))
    .map((s, idx) => {
      const text = (s.text || s.content || '').slice(0, maxChars);
      return `[Source ${idx + 1}] ${s.title ?? s.url}\n${text}`;
    })
    .join('\n\n');
  if (!payload) throw new Error('No source text available for generation.');
  return payload;
}

export async function generateSlidesFromSources(sources: Source[]): Promise<Slide[]> {
  const sourceContent = buildContentFromSources(sources);

  const prompt = `You are an expert presentation designer.
Create a slide deck outline based on the provided source content.

Sources:
${sourceContent}

Instructions:
- Create 5-8 slides
- Each slide should have a "title" and a list of "bullets" (2-4 bullets per slide)
- Be concise, professional, and impactful
- Do not include filler text
- Return ONLY valid JSON matching this exact structure:
{
  "slides": [
    {
      "title": "Slide Title Here",
      "bullets": ["Point 1", "Point 2", "Point 3"]
    }
  ]
}

Return ONLY the JSON, no other text.`;

  const json = await geminiGenerateJson<{ slides: Slide[] }>({
    model: DEFAULT_GEMINI_TEXT_MODEL,
    prompt,
  });

  if (!Array.isArray(json?.slides)) throw new Error('Invalid slides structure');
  return json.slides;
}
