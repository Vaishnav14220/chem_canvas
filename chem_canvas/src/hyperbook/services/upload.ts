import { extractText } from 'unpdf';
import { uploadTextToFileSearchStore } from './fileSearchStore';
import { addFileToSourceLibrary } from '../../utils/sourceLibrary';

export async function processUploadedFile(file: File): Promise<{
  title: string;
  text: string;
  content: string;
  filename: string;
  pages: number;
  fileSearchDocumentName: string | null;
}> {
  const fileNameLower = file.name.toLowerCase();
  const isPDF = fileNameLower.endsWith('.pdf');
  const isTXT = fileNameLower.endsWith('.txt');

  if (!isPDF && !isTXT) throw new Error('Only PDF and TXT files are supported');

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) throw new Error('File too large (max 10MB)');

  let text = '';
  let totalPages = 1;

  if (isTXT) {
    text = await file.text();
  } else {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const result = await extractText(uint8Array);
    text = Array.isArray((result as any).text) ? (result as any).text.join('\n') : ((result as any).text as string);
    totalPages = (result as any).totalPages || 1;
  }

  const title = file.name.replace(/\.(pdf|txt)$/i, '');
  const fileSearchDocumentName = await uploadTextToFileSearchStore({
    title,
    text: `Title: ${title}\n\nFilename: ${file.name}\n\n${text}`,
  });
  addFileToSourceLibrary(file, { content: text, name: file.name, mimeType: file.type }).catch((error) => {
    console.warn('[hyperbook] Failed to add source to library:', error);
  });

  return {
    title,
    text,
    content: text,
    filename: file.name,
    pages: totalPages,
    fileSearchDocumentName,
  };
}
