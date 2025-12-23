import { getHyperbrowserApiKey } from './keys';
import { uploadTextToFileSearchStore } from './fileSearchStore';

async function hbRequest<T>(apiKey: string, path: string, init?: RequestInit): Promise<T> {
  const url = `https://api.hyperbrowser.ai/api${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Hyperbrowser request failed (${res.status})`);
  }

  if (res.headers.get('content-length') === '0') return {} as T;
  return (await res.json()) as T;
}

async function startScrapeJob(apiKey: string, params: any): Promise<{ jobId: string }> {
  return await hbRequest(apiKey, '/scrape', { method: 'POST', body: JSON.stringify(params) });
}

async function getScrapeStatus(apiKey: string, jobId: string): Promise<{ status: string }> {
  return await hbRequest(apiKey, `/scrape/${encodeURIComponent(jobId)}/status`, { method: 'GET' });
}

async function getScrapeResult(apiKey: string, jobId: string): Promise<any> {
  return await hbRequest(apiKey, `/scrape/${encodeURIComponent(jobId)}`, { method: 'GET' });
}

async function startAndWaitScrape(apiKey: string, params: any) {
  const job = await startScrapeJob(apiKey, params);
  const jobId = job?.jobId;
  if (!jobId) throw new Error('Failed to start Hyperbrowser scrape job (missing jobId)');

  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const status = await getScrapeStatus(apiKey, jobId);
    if (status?.status === 'completed' || status?.status === 'failed') {
      return await getScrapeResult(apiKey, jobId);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  throw new Error('Hyperbrowser scrape job timed out');
}

export async function scrapeUrl(url: string): Promise<{
  title: string;
  content: string;
  text: string;
  url: string;
  fileSearchDocumentName: string | null;
}> {
  const apiKey = getHyperbrowserApiKey();
  if (!apiKey) {
    throw new Error('Hyperbrowser API key is missing (set VITE_HYPERBROWSER_API_KEY or localStorage hyperbrowser_api_key)');
  }

  const result = await startAndWaitScrape(apiKey, { url, sessionOptions: { useProxy: false, solveCaptchas: false } });
  const data = (result as any)?.data as any;
  const title = data?.metadata?.title || new URL(url).hostname;
  const content = data?.markdown || data?.text || '';
  const text = data?.text || data?.markdown || '';

  const fileSearchDocumentName = await uploadTextToFileSearchStore({
    title,
    text: `Title: ${title}\n\nURL: ${url}\n\n${text}`,
  });

  return { title, content, text, url, fileSearchDocumentName };
}
