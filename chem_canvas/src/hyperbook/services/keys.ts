import { getSharedGeminiApiKey } from '@/firebase/apiKeys';

export async function getGeminiApiKey(): Promise<string> {
  const fromLocal =
    localStorage.getItem('gemini_api_key') ||
    localStorage.getItem('gemini-api-key') ||
    localStorage.getItem('geminiApiKey') ||
    '';

  if (fromLocal) return fromLocal;
  const shared = await getSharedGeminiApiKey();
  return shared || '';
}

export function getHyperbrowserApiKey(): string {
  const envKey = import.meta.env.VITE_HYPERBROWSER_API_KEY as string | undefined;
  const local = localStorage.getItem('hyperbrowser_api_key') || localStorage.getItem('hyperbrowser-api-key') || '';
  return (envKey || local || '').trim();
}

