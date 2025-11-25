/**
 * OCR Extraction Service (Client-Side Only)
 * 
 * Provides document OCR capabilities using Tesseract.js (client-side).
 * No server-side dependencies - works entirely in the browser.
 * 
 * Features:
 * - Text extraction from images/PDFs
 * - Table detection and extraction
 * - Figure/diagram detection
 * - LaTeX generation for extracted content
 */

import Tesseract from 'tesseract.js';

// Types
export interface TextBlock {
  text: string;
  confidence: number;
  bbox?: number[][];
}

export interface TableCell {
  row: number;
  col: number;
  text: string;
  rowSpan?: number;
  colSpan?: number;
}

export interface TableData {
  type: 'table';
  bbox: number[];
  html?: string;
  cells?: TableCell[];
  latex?: string;
}

export interface FigureData {
  type: 'figure';
  bbox: number[];
  caption?: string;
  base64?: string;
  filename?: string;
}

export interface FormulaData {
  type: 'formula';
  bbox: number[];
  latex?: string;
}

export interface OCRResult {
  success: boolean;
  text_blocks: TextBlock[];
  tables: TableData[];
  figures: FigureData[];
  formulas: FormulaData[];
  raw_text: string;
  error?: string;
}

export interface ExtractedDocumentContent {
  text: string;
  tables: TableData[];
  figures: FigureData[];
  formulas: FormulaData[];
  latex: string;
}

// Progress callback type
type ProgressCallback = (progress: number, status: string) => void;

// ==========================================
// OCR Service Implementation (Client-Side)
// ==========================================

/**
 * Extract content from an image using Tesseract.js (client-side OCR)
 */
export async function extractFromImage(
  imageData: string | Blob | File,
  extractType: 'text' | 'table' | 'figure' | 'all' = 'all',
  onProgress?: ProgressCallback
): Promise<OCRResult> {
  try {
    // Convert to data URL if needed
    let dataUrl: string;
    
    if (typeof imageData === 'string') {
      // Check if it's already a data URL or just base64
      if (imageData.startsWith('data:')) {
        dataUrl = imageData;
      } else {
        dataUrl = `data:image/png;base64,${imageData}`;
      }
    } else {
      // Blob or File - convert to data URL
      dataUrl = await blobToDataUrl(imageData);
    }
    
    // Perform OCR with Tesseract.js
    const result = await Tesseract.recognize(
      dataUrl,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100), 'Recognizing text...');
          }
        }
      }
    );
    
    // Convert Tesseract result to our format
    const textBlocks: TextBlock[] = result.data.words.map(word => ({
      text: word.text,
      confidence: word.confidence / 100,
      bbox: [[word.bbox.x0, word.bbox.y0], [word.bbox.x1, word.bbox.y1]]
    }));
    
    // Try to detect tables from text structure
    const tables = extractType === 'text' ? [] : detectTablesFromText(result.data);
    
    return {
      success: true,
      text_blocks: textBlocks,
      tables,
      figures: [],
      formulas: [],
      raw_text: result.data.text
    };
    
  } catch (error) {
    console.error('OCR extraction failed:', error);
    return {
      success: false,
      text_blocks: [],
      tables: [],
      figures: [],
      formulas: [],
      raw_text: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Detect tables from OCR text structure
 */
function detectTablesFromText(ocrData: Tesseract.Page): TableData[] {
  const tables: TableData[] = [];
  
  // Simple heuristic: look for grid-like patterns in lines
  const lines = ocrData.lines || [];
  let currentTable: TableCell[][] = [];
  let tableStartY = 0;
  let tableEndY = 0;
  
  for (const line of lines) {
    const words = line.words || [];
    if (words.length < 2) continue;
    
    // Check if words are roughly aligned in columns
    const xPositions = words.map((w) => w.bbox.x0);
    const hasRegularSpacing = checkRegularSpacing(xPositions);
    
    if (hasRegularSpacing) {
      if (currentTable.length === 0) {
        tableStartY = line.bbox.y0;
      }
      tableEndY = line.bbox.y1;
      
      const row = words.map((w, i) => ({
        row: currentTable.length,
        col: i,
        text: w.text
      }));
      currentTable.push(row);
    } else if (currentTable.length >= 2) {
      // End of table
      tables.push(convertToTableData(currentTable, tableStartY, tableEndY));
      currentTable = [];
    }
  }
  
  // Handle table at end of document
  if (currentTable.length >= 2) {
    tables.push(convertToTableData(currentTable, tableStartY, tableEndY));
  }
  
  return tables;
}

function checkRegularSpacing(positions: number[]): boolean {
  if (positions.length < 3) return false;
  
  const gaps: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    gaps.push(positions[i] - positions[i - 1]);
  }
  
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
  
  // Low variance means regular spacing (likely a table)
  return variance < avgGap * avgGap * 0.5;
}

function convertToTableData(cells: TableCell[][], startY: number, endY: number): TableData {
  // Generate LaTeX for the table
  const numCols = Math.max(...cells.map(row => row.length));
  const colSpec = 'l'.repeat(numCols);
  
  let latex = `\\begin{tabular}{${colSpec}}\n\\toprule\n`;
  
  cells.forEach((row, i) => {
    const rowText = row.map(cell => cell.text).join(' & ');
    latex += rowText + ' \\\\\n';
    if (i === 0) latex += '\\midrule\n';
  });
  
  latex += '\\bottomrule\n\\end{tabular}';
  
  return {
    type: 'table',
    bbox: [0, startY, 1000, endY],
    cells: cells.flat(),
    latex
  };
}

/**
 * Convert blob to data URL
 */
async function blobToDataUrl(blob: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ==========================================
// PDF Page Extraction
// ==========================================

/**
 * Extract images from PDF pages for OCR processing
 */
export async function extractPDFPages(
  file: File,
  onProgress?: ProgressCallback
): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  
  // Set worker
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  const pages: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) {
      onProgress(Math.round((i / pdf.numPages) * 50), `Rendering page ${i}/${pdf.numPages}...`);
    }
    
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render page to canvas
    await page.render({
      canvasContext: context,
      viewport
    }).promise;
    
    // Convert to data URL (base64)
    const dataUrl = canvas.toDataURL('image/png');
    pages.push(dataUrl);
  }
  
  return pages;
}

/**
 * Extract all content from a PDF document using client-side OCR
 */
export async function extractPDFContent(
  file: File,
  onProgress?: ProgressCallback
): Promise<ExtractedDocumentContent> {
  // First, try to extract text directly from PDF (faster, more accurate)
  const directText = await extractPDFTextDirect(file);
  
  if (directText && directText.length > 100) {
    // If we got good text directly, use it
    return {
      text: directText,
      tables: [],
      figures: [],
      formulas: [],
      latex: ''
    };
  }
  
  // Otherwise, fall back to OCR (for scanned PDFs)
  const pages = await extractPDFPages(file, onProgress);
  
  const allText: string[] = [];
  const allTables: TableData[] = [];
  const allFigures: FigureData[] = [];
  const allFormulas: FormulaData[] = [];
  
  for (let i = 0; i < pages.length; i++) {
    if (onProgress) {
      onProgress(50 + Math.round((i / pages.length) * 50), `OCR page ${i + 1}/${pages.length}...`);
    }
    
    console.log(`Processing page ${i + 1}/${pages.length}...`);
    
    const result = await extractFromImage(pages[i], 'all');
    
    if (result.success) {
      allText.push(result.raw_text);
      allTables.push(...result.tables);
      allFigures.push(...result.figures.map(f => ({
        ...f,
        filename: `figure_page${i + 1}_${allFigures.length + 1}.png`
      })));
      allFormulas.push(...result.formulas);
    }
  }
  
  // Generate combined LaTeX
  const latex = generateLatexFromExtraction({
    text: allText.join('\n\n'),
    tables: allTables,
    figures: allFigures,
    formulas: allFormulas
  });
  
  return {
    text: allText.join('\n\n'),
    tables: allTables,
    figures: allFigures,
    formulas: allFormulas,
    latex
  };
}

/**
 * Extract text directly from PDF without OCR (for digital PDFs)
 */
async function extractPDFTextDirect(file: File): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.warn('Direct PDF text extraction failed:', error);
    return '';
  }
}

// ==========================================
// LaTeX Generation
// ==========================================

/**
 * Generate LaTeX code for extracted content
 */
function generateLatexFromExtraction(content: Omit<ExtractedDocumentContent, 'latex'>): string {
  let latex = '';
  
  // Add figures
  for (let i = 0; i < content.figures.length; i++) {
    const fig = content.figures[i];
    latex += `
\\begin{figure}[htbp]
\\centering
\\includegraphics[width=0.8\\textwidth]{${fig.filename || `figure_${i + 1}.png`}}
\\caption{${fig.caption || 'Extracted figure from source document'}}
\\label{fig:extracted_${i + 1}}
\\end{figure}

`;
  }
  
  // Add tables
  for (let i = 0; i < content.tables.length; i++) {
    const table = content.tables[i];
    if (table.latex) {
      latex += `
\\begin{table}[htbp]
\\centering
${table.latex}
\\caption{Extracted table from source document}
\\label{tab:extracted_${i + 1}}
\\end{table}

`;
    }
  }
  
  // Add formulas
  for (const formula of content.formulas) {
    if (formula.latex) {
      latex += `\\begin{equation}\n${formula.latex}\n\\end{equation}\n\n`;
    }
  }
  
  return latex;
}

// ==========================================
// Utility: HTML Table to LaTeX
// ==========================================

interface HtmlTableData {
  rows: string[][];
  headers?: string[];
  caption?: string;
  label?: string;
}

/**
 * Convert HTML table structure to LaTeX
 */
export function htmlTableToLatex(table: HtmlTableData): string {
  const numCols = Math.max(
    table.headers?.length || 0,
    ...table.rows.map(r => r.length)
  );
  
  if (numCols === 0) return '';
  
  const colSpec = 'l'.repeat(numCols);
  let latex = `\\begin{tabular}{${colSpec}}\n\\toprule\n`;
  
  // Add headers if present
  if (table.headers && table.headers.length > 0) {
    latex += table.headers.join(' & ') + ' \\\\\n';
    latex += '\\midrule\n';
  }
  
  // Add rows
  table.rows.forEach((row) => {
    latex += row.join(' & ') + ' \\\\\n';
  });
  
  latex += '\\bottomrule\n\\end{tabular}';
  
  return latex;
}
