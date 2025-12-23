import type { MindmapNode, Source } from '../lib/types';
import { DEFAULT_GEMINI_TEXT_MODEL, geminiGenerateJson } from './geminiText';

function buildContentFromSources(sources: Source[], maxChars = 4000) {
  const payload = sources
    .filter((s) => s.status === 'success' && (s.text || s.content))
    .map((s, idx) => {
      const text = (s.text || s.content || '').slice(0, maxChars);
      return `[Source ${idx + 1}] ${s.title ?? s.url}\n${text}`;
    })
    .join('\n\n');
  if (!payload) {
    throw new Error('No source text available for generation.');
  }
  return payload;
}

export async function generateMindmapFromSources(sources: Source[]): Promise<MindmapNode> {
  const content = buildContentFromSources(sources, 4000);
  const prompt =
    'You produce concise mindmaps. Output ONLY valid JSON with this EXACT structure: {"root": {"title": "Main Topic", "children": [{"title": "Subtopic 1"}, {"title": "Subtopic 2", "children": [{"title": "Detail"}]}]}}. EVERY node MUST have a "title" string property. Keep hierarchy shallow (max 3 levels) and informative.\n\n' +
    content;

  const json = await geminiGenerateJson<{ root?: MindmapNode } | MindmapNode>({
    model: DEFAULT_GEMINI_TEXT_MODEL,
    prompt,
    maxOutputTokens: 2000,
  });

  const root = (json as any).root || json;
  if (!root?.title) throw new Error('Invalid mindmap structure returned from Gemini');
  if (root.title && !root.children) root.children = [];
  return root as MindmapNode;
}
