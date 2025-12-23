import { useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

const DEFAULT_WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

let workerConfigured = false;

const ensureWorkerConfigured = () => {
  if (workerConfigured) {
    return;
  }

  if (typeof window !== 'undefined') {
    GlobalWorkerOptions.workerSrc = DEFAULT_WORKER_URL;
    workerConfigured = true;
  }
};

export interface PageImage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface UsePdfPageImagesState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  images: Record<number, PageImage>;
  error?: string;
}

const createDocumentSource = async (source: string | ArrayBuffer | Uint8Array) => {
  ensureWorkerConfigured();

  if (typeof source === 'string') {
    return getDocument({ url: source, useSystemFonts: true, disableFontFace: true }).promise;
  }

  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  return getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
};

const renderPageToImage = async (
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number
): Promise<PageImage | null> => {
  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    return null;
  }

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: false });

  if (!context) {
    return null;
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;

  const dataUrl = canvas.toDataURL('image/png');

  // Free canvas resources promptly to avoid memory bloat on large PDFs
  canvas.width = 0;
  canvas.height = 0;

  return {
    dataUrl,
    width: viewport.width,
    height: viewport.height,
  };
};

export const usePdfPageImages = (
  documentSource: string | ArrayBuffer | Uint8Array | null | undefined,
  pageNumbers: number[],
  scale = 1.4
): UsePdfPageImagesState => {
  const [state, setState] = useState<UsePdfPageImagesState>({ status: 'idle', images: {} });
  const taskRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const normalizedPages = useMemo(() => {
    const unique = Array.from(new Set(pageNumbers)).filter((num) => Number.isFinite(num) && num > 0);
    unique.sort((a, b) => a - b);
    return unique;
  }, [pageNumbers]);

  useEffect(() => {
    taskRef.current.cancelled = false;

    if (!documentSource || normalizedPages.length === 0) {
      setState({ status: 'idle', images: {} });
      return () => {
        taskRef.current.cancelled = true;
      };
    }

    setState({ status: 'loading', images: {} });

    let pdfInstance: PDFDocumentProxy | null = null;

    const load = async () => {
      try {
        pdfInstance = await createDocumentSource(documentSource);
        const images: Record<number, PageImage> = {};

        for (const pageNumber of normalizedPages) {
          if (taskRef.current.cancelled) {
            break;
          }

          const instance = pdfInstance;
          if (!instance) {
            break;
          }

          const rendered = await renderPageToImage(instance, pageNumber, scale);
          if (rendered) {
            images[pageNumber] = rendered;
          }
        }

        if (!taskRef.current.cancelled) {
          setState({ status: 'ready', images });
        }
      } catch (error) {
        if (!taskRef.current.cancelled) {
          setState({
            status: 'error',
            images: {},
            error: error instanceof Error ? error.message : 'Unable to render reference pages',
          });
        }
      } finally {
        if (pdfInstance) {
          try {
            await pdfInstance.cleanup();
            await pdfInstance.destroy();
          } catch (cleanupError) {
            console.warn('[usePdfPageImages] Cleanup warning:', cleanupError);
          }
        }
      }
    };

    load();

    return () => {
      taskRef.current.cancelled = true;
    };
  }, [documentSource, normalizedPages, scale]);

  return state;
};

export default usePdfPageImages;
