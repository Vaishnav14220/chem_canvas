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
    // Dynamically import Tesseract.js
    const Tesseract = await import('tesseract.js');
    
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

// PDF.js worker setup - use CDN with proper HTTPS
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Initialize PDF.js with worker
 */
async function initPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  
  // Use CDN worker URL (more reliable than unpkg)
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
  
  return pdfjs;
}

/**
 * Extract images from PDF pages for OCR processing
 */
export async function extractPDFPages(
  file: File,
  onProgress?: ProgressCallback
): Promise<string[]> {
  const pdfjs = await initPdfJs();
  
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
 * Extract embedded images from a PDF document
 * This extracts actual image objects embedded in the PDF
 */
export async function extractImagesFromPDF(
  file: File,
  onProgress?: ProgressCallback
): Promise<FigureData[]> {
  const pdfjs = await initPdfJs();
  const figures: FigureData[] = [];
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (onProgress) {
        onProgress(Math.round((pageNum / pdf.numPages) * 100), `Extracting images from page ${pageNum}/${pdf.numPages}...`);
      }
      
      const page = await pdf.getPage(pageNum);
      const operatorList = await page.getOperatorList();
      
      // Look for image operations in the PDF
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        // OPS.paintImageXObject = 85, OPS.paintJpegXObject = 82
        if (operatorList.fnArray[i] === 85 || operatorList.fnArray[i] === 82) {
          try {
            const imgName = operatorList.argsArray[i][0];
            
            // Get the image object
            const objs = (page as any).objs;
            if (objs && objs._objs && objs._objs[imgName]) {
              const imgData = objs._objs[imgName].data;
              
              if (imgData && imgData.data) {
                // Convert image data to canvas and then to base64
                const canvas = document.createElement('canvas');
                canvas.width = imgData.width;
                canvas.height = imgData.height;
                const ctx = canvas.getContext('2d')!;
                
                // Create ImageData from the raw data
                const imageData = ctx.createImageData(imgData.width, imgData.height);
                
                // Handle different image formats
                if (imgData.data.length === imgData.width * imgData.height * 4) {
                  // RGBA data
                  imageData.data.set(imgData.data);
                } else if (imgData.data.length === imgData.width * imgData.height * 3) {
                  // RGB data - convert to RGBA
                  for (let j = 0; j < imgData.width * imgData.height; j++) {
                    imageData.data[j * 4] = imgData.data[j * 3];
                    imageData.data[j * 4 + 1] = imgData.data[j * 3 + 1];
                    imageData.data[j * 4 + 2] = imgData.data[j * 3 + 2];
                    imageData.data[j * 4 + 3] = 255;
                  }
                } else {
                  continue; // Unknown format
                }
                
                ctx.putImageData(imageData, 0, 0);
                const base64 = canvas.toDataURL('image/png');
                
                // Only include reasonably sized images (not tiny icons)
                if (imgData.width > 50 && imgData.height > 50) {
                  figures.push({
                    type: 'figure',
                    bbox: [0, 0, imgData.width, imgData.height],
                    base64,
                    filename: `figure_p${pageNum}_${figures.length + 1}.png`,
                    caption: `Figure from page ${pageNum}`
                  });
                }
              }
            }
          } catch (imgError) {
            // Skip this image if extraction fails
            console.warn('Failed to extract image:', imgError);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Image extraction from PDF failed:', error);
  }
  
  // If no embedded images found, render pages as images
  if (figures.length === 0) {
    console.log('No embedded images found, rendering pages as figures...');
    const pages = await extractPDFPages(file, onProgress);
    
    // Add each page as a figure
    pages.forEach((pageDataUrl, index) => {
      figures.push({
        type: 'figure',
        bbox: [0, 0, 800, 1000],
        base64: pageDataUrl,
        filename: `page_${index + 1}.png`,
        caption: `Page ${index + 1}`
      });
    });
  }
  
  return figures;
}

/**
 * Extract all content from a PDF document
 * Extracts both text AND images
 */
export async function extractPDFContent(
  file: File,
  onProgress?: ProgressCallback
): Promise<ExtractedDocumentContent> {
  const allFigures: FigureData[] = [];
  const allTables: TableData[] = [];
  const allFormulas: FormulaData[] = [];
  
  // Extract text directly from PDF
  const directText = await extractPDFTextDirect(file);
  
  // Extract images from PDF
  if (onProgress) {
    onProgress(50, 'Extracting images from PDF...');
  }
  
  const extractedImages = await extractImagesFromPDF(file, (p, s) => {
    if (onProgress) {
      onProgress(50 + Math.round(p * 0.5), s);
    }
  });
  
  allFigures.push(...extractedImages);
  
  console.log(`Extracted ${allFigures.length} images from PDF`);
  
  // Generate combined LaTeX
  const latex = generateLatexFromExtraction({
    text: directText,
    tables: allTables,
    figures: allFigures,
    formulas: allFormulas
  });
  
  return {
    text: directText || `[PDF Document with ${allFigures.length} images]`,
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
    const pdfjs = await initPdfJs();
    
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
