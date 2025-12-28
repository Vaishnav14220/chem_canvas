import { extractTextFromDocument, isImageFile, isPdfFile, isPlainTextDocument, isSupportedTextDocument } from './documentTextExtractor';
import { useSourceStore } from '../store/sourceStore';
import type { SourceFile } from '../store/sourceStore';

type AddFileOptions = {
  content?: string;
  data?: string;
  name?: string;
  mimeType?: string;
  skipExtract?: boolean;
};

type AddTextOptions = {
  name: string;
  content: string;
  type?: SourceFile['type'];
  mimeType?: string;
};

const getExtension = (fileName: string) => {
  const match = /\.([^.]+)$/.exec(fileName.toLowerCase());
  return match ? match[1] : '';
};

const resolveSourceType = (file: File, mimeType?: string): SourceFile['type'] => {
  const extension = getExtension(file.name);
  const resolvedMimeType = mimeType || file.type;

  if (isPdfFile(file)) return 'pdf';
  if (isImageFile(file)) return 'image';
  if (extension === 'md' || extension === 'markdown') return 'markdown';
  if (extension === 'html' || extension === 'htm') return 'html';
  if (resolvedMimeType?.startsWith('text/') || isPlainTextDocument(file)) return 'text';
  if (isSupportedTextDocument(file)) return 'document';
  return 'document';
};

const shouldPersistData = (type: SourceFile['type']) => type === 'pdf' || type === 'image';

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });

const tryExtractText = async (file: File) => {
  try {
    const { text } = await extractTextFromDocument(file);
    return text;
  } catch (error) {
    console.warn('[sourceLibrary] Unable to extract text from file:', file.name, error);
    return '';
  }
};

export const addFileToSourceLibrary = async (file: File, options: AddFileOptions = {}) => {
  const type = resolveSourceType(file, options.mimeType);
  const content = options.content ?? (options.skipExtract ? '' : await tryExtractText(file));
  const data = shouldPersistData(type) ? (options.data ?? await fileToBase64(file)) : undefined;
  const mimeType = options.mimeType || file.type || 'application/octet-stream';

  return useSourceStore.getState().addSource({
    name: options.name || file.name,
    type,
    data,
    content,
    mimeType,
    size: file.size,
    lastModified: file.lastModified
  });
};

export const addTextToSourceLibrary = async ({ name, content, type, mimeType }: AddTextOptions) => {
  return useSourceStore.getState().addSource({
    name,
    type: type || 'text',
    content,
    mimeType: mimeType || 'text/plain',
    size: content.length,
    lastModified: Date.now()
  });
};
