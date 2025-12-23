import { getGeminiApiKey } from './keys';

export type FileSearchStore = { name: string; displayName: string };

let cachedStore: FileSearchStore | null = null;
let inFlight: Promise<FileSearchStore> | null = null;

export async function getOrCreateFileSearchStore(): Promise<FileSearchStore | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;
  if (cachedStore) return cachedStore;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    if (!listRes.ok) throw new Error(await listRes.text());
    const listData = await listRes.json();

    const existing = listData.fileSearchStores?.find((s: any) => s.displayName === 'hyperbooklm-store');
    if (existing?.name) {
      return { name: existing.name as string, displayName: existing.displayName as string };
    }

    const createRes = await fetch(listUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'hyperbooklm-store' }),
    });
    if (!createRes.ok) throw new Error(await createRes.text());
    const createData = await createRes.json();
    return { name: createData.name as string, displayName: createData.displayName as string };
  })()
    .then((store) => {
      cachedStore = store;
      return store;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export async function uploadTextToFileSearchStore(params: { title: string; text: string }): Promise<string | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;
  if (!params.text.trim()) return null;

  const store = await getOrCreateFileSearchStore();
  if (!store?.name) return null;

  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/${store.name}:uploadDocument?key=${apiKey}`;
  const boundary = '----HyperbookBoundary' + Math.random().toString(36).slice(2);

  const fileContent = `Title: ${params.title}\n\n${params.text}`;

  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="metadata"',
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ displayName: params.title }),
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${params.title}.txt"`,
    'Content-Type: text/plain',
    '',
    fileContent,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!uploadRes.ok) {
    console.warn('[HyperbookLM] File Search upload failed:', await uploadRes.text());
    return null;
  }

  const uploadData = await uploadRes.json();
  return (uploadData.document?.name as string | undefined) || null;
}

