// @ts-nocheck
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { TextContent, PDFDocumentProxy } from 'pdfjs-dist';
import { generateVisionContent } from '../services/geminiService';

// Use CDN for worker to avoid Vite/build issues with local worker file
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

const MAX_TEXT_LENGTH = 20000;
const MIN_TEXT_THRESHOLD = 50; // If extracted text is less than this, use Gemini vision

/**
 * Converts a PDF page to a base64 image
 */
const pdfPageToImage = async (page: any, scale: number = 2.0): Promise<string> => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  await page.render(renderContext).promise;
  return canvas.toDataURL('image/png');
};

/**
 * Extracts text from PDF using Gemini 3 Pro Preview vision capabilities
 * This is especially useful for PDFs with images, scanned documents, or complex layouts
 */
const extractTextWithGemini = async (imageBase64: string, pageNumber: number): Promise<string> => {
  try {
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const prompt = `Extract all text content from this PDF page ${pageNumber}. 
    Include:
    - All visible text (headings, paragraphs, captions, labels)
    - Text from images, diagrams, and charts
    - Mathematical formulas and equations (in LaTeX format if possible)
    - Table contents
    - Any annotations or notes
    
    Return the extracted text in a clear, structured format preserving the original organization and hierarchy.`;

    const extractedText = await generateVisionContent(
      prompt,
      base64Data,
      'image/png',
      { model: 'gemini-3-pro-preview' }
    );

    return extractedText || '';
  } catch (error) {
    console.error(`Failed to extract text from page ${pageNumber} with Gemini:`, error);
    return '';
  }
};

export const extractTextFromPdf = async (file: File, maxPages = 10, useGeminiVision = true): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc: PDFDocumentProxy = await getDocument({ data: arrayBuffer }).promise;

  try {
    const pagesToProcess = Math.min(maxPages, pdfDoc.numPages);
    let collectedText = '';

    for (let pageNumber = 1; pageNumber <= pagesToProcess; pageNumber += 1) {
      const page = await pdfDoc.getPage(pageNumber);
      
      // First, try standard text extraction
      const content: TextContent = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');

      // If text extraction is poor or empty, and Gemini vision is enabled, use Gemini 3 Pro Preview
      if (useGeminiVision && (pageText.trim().length < MIN_TEXT_THRESHOLD || pageText.trim().length === 0)) {
        console.log(`📄 Page ${pageNumber}: Low text content (${pageText.length} chars), using Gemini 3 Pro Preview for vision extraction...`);
        try {
          const pageImage = await pdfPageToImage(page);
          const geminiText = await extractTextWithGemini(pageImage, pageNumber);
          
          if (geminiText && geminiText.trim().length > pageText.trim().length) {
            console.log(`✅ Gemini extracted ${geminiText.length} chars vs ${pageText.length} chars from standard extraction`);
            collectedText += `\n[Page ${pageNumber}]\n${geminiText}\n`;
          } else {
            // Fallback to standard extraction if Gemini didn't improve it
            collectedText += `\n[Page ${pageNumber}]\n${pageText}\n`;
          }
        } catch (visionError) {
          console.warn(`Vision extraction failed for page ${pageNumber}, using standard extraction:`, visionError);
          collectedText += `\n[Page ${pageNumber}]\n${pageText}\n`;
        }
      } else {
        // Use standard extraction
        collectedText += `\n[Page ${pageNumber}]\n${pageText}\n`;
      }

      if (collectedText.length >= MAX_TEXT_LENGTH) {
        break;
      }
    }

    return collectedText.trim();
  } finally {
    await pdfDoc.destroy();
  }
};
