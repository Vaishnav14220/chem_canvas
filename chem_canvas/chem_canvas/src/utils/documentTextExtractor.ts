// @ts-nocheck
import { extractTextFromPdf } from './pdfTextExtractor';

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'tsv',
  'json',
  'log',
  'tex',
  'rtf'
]);

const WORD_EXTENSIONS = new Set(['docx', 'docm', 'dotx', 'dotm']);
const LEGACY_WORD_EXTENSIONS = new Set(['doc', 'dot']);
const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xlsm', 'xltx', 'xltm', 'xls', 'xlsb', 'ods', 'numbers']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v']);

const getExtension = (file: File): string => {
  const match = /\.([^.]+)$/.exec(file.name.toLowerCase());
  return match ? match[1] : '';
};

export interface SheetPreview {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ExtractedDocument {
  text: string;
  format: string;
  sheets?: SheetPreview[];
}

export const isPdfFile = (file: File) => {
  const ext = getExtension(file);
  return file.type === 'application/pdf' || ext === 'pdf';
};

export const isPlainTextDocument = (file: File) => {
  const ext = getExtension(file);
  return file.type.startsWith('text/') || TEXT_EXTENSIONS.has(ext);
};

export const isWordDocument = (file: File) => WORD_EXTENSIONS.has(getExtension(file));
export const isLegacyWordDocument = (file: File) => LEGACY_WORD_EXTENSIONS.has(getExtension(file));
export const isSpreadsheetDocument = (file: File) =>
  file.type.includes('spreadsheet') || SPREADSHEET_EXTENSIONS.has(getExtension(file));

export const isAudioFile = (file: File) => file.type.startsWith('audio/') || AUDIO_EXTENSIONS.has(getExtension(file));
export const isVideoFile = (file: File) => file.type.startsWith('video/') || VIDEO_EXTENSIONS.has(getExtension(file));

export const isSupportedTextDocument = (file: File) =>
  isPlainTextDocument(file) || isWordDocument(file) || isLegacyWordDocument(file) || isSpreadsheetDocument(file);

const MAX_PREVIEW_ROWS = 30;
const MAX_PREVIEW_COLS = 8;

const normalizeCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildSheetPreview = (name: string, rows: unknown[][]): SheetPreview | null => {
  if (!rows.length) return null;
  const normalizedRows = rows
    .map((row) => row.slice(0, MAX_PREVIEW_COLS).map((cell) => normalizeCellValue(cell)))
    .slice(0, MAX_PREVIEW_ROWS + 1);
  const headers = normalizedRows.shift() ?? [];
  if (!headers.length && !normalizedRows.length) {
    return null;
  }
  return {
    name,
    headers,
    rows: normalizedRows
  };
};

export const extractTextFromDocument = async (file: File): Promise<ExtractedDocument> => {
  if (isPdfFile(file)) {
    const text = await extractTextFromPdf(file);
    return { text, format: 'pdf' };
  }

  if (isPlainTextDocument(file)) {
    const text = await file.text();
    return { text, format: 'text' };
  }

  if (isWordDocument(file)) {
    const mammothModule: any = await import('mammoth/mammoth.browser');
    const mammoth = mammothModule.default ?? mammothModule;
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value || '', format: 'word' };
  }

  if (isSpreadsheetDocument(file)) {
    const xlsxModule: any = await import('xlsx');
    const XLSX = xlsxModule.default ?? xlsxModule;
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sections: string[] = [];
    const sheetPreviews: SheetPreview[] = [];

    workbook.SheetNames.forEach((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) return;
      const csv = XLSX.utils.sheet_to_csv(sheet).trim();
      if (csv) {
        sections.push(`Sheet: ${name}\n${csv}`);
      }
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];
      const preview = buildSheetPreview(name, rows);
      if (preview) {
        sheetPreviews.push(preview);
      }
    });

    return {
      text: sections.join('\n\n') || '',
      format: 'spreadsheet',
      sheets: sheetPreviews
    };
  }

  if (isLegacyWordDocument(file)) {
    const binary = await file.text();
    return {
      text: `Unable to fully parse legacy Word file ${file.name}. Raw content preview:\n${binary.slice(0, 2000)}`,
      format: 'word-legacy'
    };
  }

  throw new Error(`Unsupported document type: ${getExtension(file) || file.type || 'unknown'}`);
};
