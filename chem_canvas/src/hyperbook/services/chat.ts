import type { Citation, Message, Source } from '../lib/types';
import { getOrCreateFileSearchStore } from './fileSearchStore';
import { getGeminiApiKey } from './keys';

type ChatSource = { title?: string; uri?: string };

export async function chatWithSources(params: {
  messages: Array<Pick<Message, 'role' | 'content'>>;
  sources: Source[];
  fileSearchStoreName?: string | null;
}): Promise<{ content: string; citations: Citation[] }> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is missing');

  const model = 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const successfulSources = params.sources.filter((s) => s.status === 'success');
  const context = successfulSources
    .map((s) => `Title: ${s.title}\nContent: ${(s.text || s.content || '').slice(0, 2000)}`)
    .join('\n\n');

  const sourceList: ChatSource[] = successfulSources.map((s) => ({ title: s.title, uri: s.url }));
  const citations: Citation[] = sourceList.map((source) => ({
    startIndex: 0,
    endIndex: 0,
    source: { title: source.title, uri: source.uri },
  }));

  const sourcesBlock =
    sourceList.length > 0
      ? `\n\nSources (cite using [n] where n is the source number):\n${sourceList
          .map((s, i) => `[${i + 1}] ${s.title || 'Untitled'}${s.uri ? ` - ${s.uri}` : ''}`)
          .join('\n')}\n`
      : '';

  const systemPrompt = `You are HyperbookLM, an advanced research assistant.
${context ? `You have access to the following source context:\n${context}\n` : ''}
Answer the user's questions based on available context.
Always include inline citations at the end of EVERY non-empty line in your answer using [n] (example: "... sentence. [1] [3]").
Only cite from the provided Sources list.
Be concise, helpful, and professional.

Format your response as GitHub-flavored Markdown. Use headings and bullet lists where helpful. For math, use LaTeX wrapped in $...$ or $$...$$.
${sourcesBlock}`;

  const contents = params.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const store =
    params.fileSearchStoreName ||
    (await getOrCreateFileSearchStore().then((s) => s?.name).catch(() => null));

  const tools = store
    ? [
        {
          fileSearch: {
            fileSearchStoreNames: [store],
          },
        },
      ]
    : undefined;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      tools,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const data: any = await response.json();
  const parts: Array<{ text?: string }> = data.candidates?.[0]?.content?.parts ?? [];
  const text: string = parts.map((p) => p.text || '').join('');

  const content =
    citations.length > 0
      ? text
          .split('\n')
          .map((line) => (line.trim().length > 0 && !/\[\d+\]/.test(line) ? `${line} [1]` : line))
          .join('\n')
      : text;

  return { content, citations };
}

