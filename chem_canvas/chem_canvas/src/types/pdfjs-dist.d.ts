declare module 'pdfjs-dist/build/pdf' {
  import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

  interface PDFDocumentLoadingTask<T extends PDFDocumentProxy = PDFDocumentProxy> {
    promise: Promise<T>;
    destroy(): void;
  }

  interface DocumentInitParameters {
    url?: string;
    data?: Uint8Array;
    useSystemFonts?: boolean;
    disableFontFace?: boolean;
  }

  export const GlobalWorkerOptions: {
    workerSrc: string | undefined;
  };

  export function getDocument(params: string | DocumentInitParameters): PDFDocumentLoadingTask;
}
