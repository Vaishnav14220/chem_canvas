/**
 * OCR Extraction Service
 * 
 * Provides document OCR capabilities using PaddleOCR on the server
 * and Tesseract.js as a client-side fallback.
 * 
 * Features:
 * - Text extraction from images/PDFs
 * - Table detection and extraction
 * - Figure/diagram detection
 * - Formula recognition
 * - LaTeX generation for extracted content
 */

// Types
export interface TextBlock {
  text: string;
  confidence: number;
  bbox?: number[][];
}

export interface TableData {
  type: 'table';
  bbox: number[];
  html?: string;
  cells?: TableCell[];
  latex?: string;
}

export interface TableCell {
  row: number;
  col: number;
  text: string;
  rowSpan?: number;
  colSpan?: number;
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
  fallback?: boolean;
  text_blocks: TextBlock[];
  tables: TableData[];
  figures: FigureData[];
  formulas: FormulaData[];
  raw_text: string;
  use_client_ocr?: boolean;
  error?: string;
}

export interface ExtractedDocumentContent {
  text: string;
  tables: TableData[];
  figures: FigureData[];
  formulas: FormulaData[];
  latex: string;
}

// ==========================================
// OCR Service Implementation
// ==========================================

/**
 * Extract content from an image using OCR
 */
export async function extractFromImage(
  imageData: string | Blob | File,
  extractType: 'text' | 'table' | 'figure' | 'all' = 'all'
): Promise<OCRResult> {
  try {
    // Convert to base64 if needed
    let base64Data: string;
    
    if (typeof imageData === 'string') {
      // Already base64 or data URL
      base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    } else {
      // Blob or File - convert to base64
      base64Data = await blobToBase64(imageData);
    }
    
    // Try server-side OCR first
    const serverResult = await tryServerOCR(base64Data, extractType);
    
    if (serverResult.success && !serverResult.use_client_ocr) {
      return serverResult;
    }
    
    // Fallback to client-side OCR
    return await clientSideOCR(base64Data, extractType);
    
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
 * Try server-side OCR using Netlify function (PaddleOCR)
 */
async function tryServerOCR(
  base64Image: string,
  extractType: string
): Promise<OCRResult> {
  const netlifyUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:8888/.netlify/functions/ocr_extract'
    : '/.netlify/functions/ocr_extract';
  
  try {
    const response = await fetch(netlifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: base64Image,
        extract_type: extractType
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.log('Server OCR not available:', error);
    return {
      success: true,
      use_client_ocr: true,
      text_blocks: [],
      tables: [],
      figures: [],
      formulas: [],
      raw_text: ''
    };
  }
}

/**
 * Client-side OCR using Tesseract.js (fallback)
 */
async function clientSideOCR(
  base64Image: string,
  extractType: string
): Promise<OCRResult> {
  try {
    // Dynamically import Tesseract.js
    const Tesseract = await import('tesseract.js');
    
    const dataUrl = `data:image/png;base64,${base64Image}`;
    
    const result = await Tesseract.recognize(
      dataUrl,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
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
    const tables = detectTablesFromText(result.data);
    
    return {
      success: true,
      fallback: true,
      text_blocks: textBlocks,
      tables,
      figures: [],
      formulas: [],
      raw_text: result.data.text
    };
    
  } catch (error) {
    console.error('Client OCR failed:', error);
    return {
      success: false,
      text_blocks: [],
      tables: [],
      figures: [],
      formulas: [],
      raw_text: '',
      error: 'Client-side OCR not available'
    };
  }
}

/**
 * Detect tables from OCR text structure
 */
function detectTablesFromText(ocrData: any): TableData[] {
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
    const xPositions = words.map((w: any) => w.bbox.x0);
    const hasRegularSpacing = checkRegularSpacing(xPositions);
    
    if (hasRegularSpacing) {
      if (currentTable.length === 0) {
        tableStartY = line.bbox.y0;
      }
      tableEndY = line.bbox.y1;
      
      const row = words.map((w: any, i: number) => ({
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
  
  const gaps = [];
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
 * Convert blob to base64
 */
async function blobToBase64(blob: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
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
export async function extractPDFPages(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  
  // Set worker
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  
  const pages: string[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
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
    
    // Convert to base64
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    pages.push(base64);
  }
  
  return pages;
}

/**
 * Extract all content from a PDF document
 */
export async function extractPDFContent(file: File): Promise<ExtractedDocumentContent> {
  const pages = await extractPDFPages(file);
  
  const allText: string[] = [];
  const allTables: TableData[] = [];
  const allFigures: FigureData[] = [];
  const allFormulas: FormulaData[] = [];
  
  for (let i = 0; i < pages.length; i++) {
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

/**
 * Convert HTML table to LaTeX
 */
export function htmlTableToLatex(html: string): string {
  // Parse HTML table
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  
  if (!table) return '';
  
  const rows = table.querySelectorAll('tr');
  const numCols = Math.max(...Array.from(rows).map(row => row.querySelectorAll('td, th').length));
  
  let latex = `\\begin{tabular}{${'l'.repeat(numCols)}}\n\\toprule\n`;
  
  rows.forEach((row, i) => {
    const cells = row.querySelectorAll('td, th');
    const cellTexts = Array.from(cells).map(cell => escapeLatex(cell.textContent || ''));
    
    // Pad with empty cells if needed
    while (cellTexts.length < numCols) {
      cellTexts.push('');
    }
    
    latex += cellTexts.join(' & ') + ' \\\\\n';
    
    // Add midrule after header
    if (i === 0 && row.querySelector('th')) {
      latex += '\\midrule\n';
    }
  });
  
  latex += '\\bottomrule\n\\end{tabular}';
  
  return latex;
}

/**
 * Escape special LaTeX characters
 */
function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

// ==========================================
// Image Extraction from Documents
// ==========================================

/**
 * Extract embedded images from a document
 */
export async function extractImagesFromDocument(
  file: File
): Promise<{ images: FigureData[]; thumbnails: string[] }> {
  const images: FigureData[] = [];
  const thumbnails: string[] = [];
  
  if (file.type === 'application/pdf') {
    // Extract images from PDF
    const pages = await extractPDFPages(file);
    
    for (let i = 0; i < pages.length; i++) {
      // Each page as a potential figure
      thumbnails.push(`data:image/png;base64,${pages[i]}`);
      
      images.push({
        type: 'figure',
        bbox: [0, 0, 0, 0],
        base64: pages[i],
        filename: `page_${i + 1}.png`
      });
    }
  } else if (file.type.startsWith('image/')) {
    // Single image file
    const base64 = await blobToBase64(file);
    thumbnails.push(`data:image/png;base64,${base64}`);
    
    images.push({
      type: 'figure',
      bbox: [0, 0, 0, 0],
      base64,
      filename: file.name
    });
  }
  
  return { images, thumbnails };
}

/**
 * Save extracted figure as a file for LaTeX inclusion
 */
export function saveFigureForLatex(figure: FigureData): { filename: string; content: string } {
  const filename = figure.filename || `figure_${Date.now()}.png`;
  const content = figure.base64 || '';
  
  return { filename, content };
}
