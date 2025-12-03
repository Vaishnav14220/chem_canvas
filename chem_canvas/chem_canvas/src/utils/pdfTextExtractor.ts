// @ts-nocheck
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { TextContent, PDFDocumentProxy } from 'pdfjs-dist';

// Use CDN for worker to avoid Vite/build issues with local worker file
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

const MAX_TEXT_LENGTH = 20000;

export const extractTextFromPdf = async (file: File, maxPages = 10): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc: PDFDocumentProxy = await getDocument({ data: arrayBuffer }).promise;

  try {
    const pagesToProcess = Math.min(maxPages, pdfDoc.numPages);
    let collectedText = '';

    for (let pageNumber = 1; pageNumber <= pagesToProcess; pageNumber += 1) {
      const page = await pdfDoc.getPage(pageNumber);
      const content: TextContent = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');

      collectedText += `${pageText}\n`;

      if (collectedText.length >= MAX_TEXT_LENGTH) {
        break;
      }
    }

    return collectedText;
  } finally {
    await pdfDoc.destroy();
  }
};
