import { getGeminiApiKey } from './keys';

export const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-3-flash-preview';

export async function geminiGenerateText(params: {
  model: string;
  prompt: string;
  generationConfig?: Record<string, unknown>;
  tools?: unknown;
  systemInstruction?: string;
}): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is missing');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${apiKey}`;

  const body: any = {
    contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
  };
  if (params.systemInstruction) {
    body.systemInstruction = { parts: [{ text: params.systemInstruction }] };
  }
  if (params.generationConfig) body.generationConfig = params.generationConfig;
  if (params.tools) body.tools = params.tools;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data: any = await res.json();
  const parts: Array<{ text?: string }> = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text || '').join('');
}

export async function geminiGenerateJson<T = unknown>(params: {
  model: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<T> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is missing');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: params.prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        ...(params.maxOutputTokens ? { maxOutputTokens: params.maxOutputTokens } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data: any = await res.json();
  const parts: Array<{ text?: string }> = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text || '').join('').trim();
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
  return JSON.parse(cleaned) as T;
}
