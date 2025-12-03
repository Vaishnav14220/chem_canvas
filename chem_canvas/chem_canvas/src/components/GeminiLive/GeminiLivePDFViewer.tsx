import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Upload, Download, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

interface GeminiLivePDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  onPDFLoaded?: (text: string) => void;
  onPageChange?: (pageText: string, pageNumber: number) => void;
  highlightText?: string;
  embedded?: boolean;
}

const GeminiLivePDFViewer: React.FC<GeminiLivePDFViewerProps> = ({ isOpen, onClose, onPDFLoaded, onPageChange, highlightText, embedded = false }) => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [highlightedText, setHighlightedText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set up PDF.js worker
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }, []);

  // Update highlighted text when prop changes
  useEffect(() => {
    if (highlightText) {
      setHighlightedText(highlightText);
      console.log('Highlighting PDF text:', highlightText.substring(0, 50) + '...');
    }
  }, [highlightText]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPdfFile(file);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const pdf = await pdfjsLib.getDocument(e.target?.result as ArrayBuffer).promise;
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);

        // Extract all text and notify parent
        let fullText = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        onPDFLoaded?.(fullText);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderPage = async (pageNumber: number) => {
    if (!pdfDocument || !canvasRef.current) return;

    try {
      const page = await pdfDocument.getPage(pageNumber);
      const scale = zoom / 100;
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');
      if (!context) return;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      // Extract page text and notify parent
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      if (onPageChange) {
        onPageChange(pageText, pageNumber);
      }

      // Apply highlighting if text is selected
      if (highlightedText) {
        await highlightTextInPage(page, context, viewport, scale);
      }
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  const highlightTextInPage = async (page: any, context: CanvasRenderingContext2D, viewport: any, scale: number) => {
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // Simple substring matching for highlighting
    items.forEach((item) => {
      if (item.str.toLowerCase().includes(highlightedText.toLowerCase())) {
        // Calculate position and draw highlight
        const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const x = transform[4];
        const y = viewport.height - transform[5];

        context.fillStyle = 'rgba(255, 255, 0, 0.3)';
        context.fillRect(x, y - item.height, item.width, item.height);
      }
    });
  };

  useEffect(() => {
    if (pdfDocument && currentPage > 0 && currentPage <= totalPages) {
      renderPage(currentPage);
    }
  }, [pdfDocument, currentPage, zoom, highlightedText]);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      setHighlightedText(selection.toString());
    }
  };

  const zoomIn = () => {
    setZoom(Math.min(zoom + 20, 200));
  };

  const zoomOut = () => {
    setZoom(Math.max(zoom - 20, 50));
  };

  if (!isOpen) return null;

  // Embedded view - no modal, just the content
  if (embedded) {
    return (
      <div className="w-full h-full bg-slate-900 rounded-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">PDF Viewer</h3>
          </div>
          <div className="flex items-center gap-2">
            {pdfDocument && (
              <>
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="p-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-slate-300 text-xs font-medium min-w-[4rem] text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="p-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-all"
            >
              <Upload size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PDF Display */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-950 p-3 flex items-center justify-center"
          onMouseUp={handleTextSelection}
        >
          {pdfDocument ? (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full"
                style={{ display: 'block' }}
              />
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-slate-900/50 rounded-lg transition-all">
              <Upload size={32} className="text-slate-500 mb-2" />
              <span className="text-slate-400 text-sm font-medium">Click or drag PDF here</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        {highlightedText && (
          <div className="p-2 bg-yellow-500/10 border-t border-yellow-500/30 text-yellow-300 text-xs">
            Highlighted: {highlightedText.substring(0, 50)}...
          </div>
        )}
      </div>
    );
  }

  // Modal view
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[90vh] bg-slate-900 rounded-xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3 flex-1">
            <Upload size={20} className="text-molecule-teal" />
            <h2 className="text-lg font-bold text-white">
              {pdfFile ? pdfFile.name : 'Upload PDF'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-all"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4 p-4 border-b border-slate-700 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-molecule-teal text-white rounded-lg hover:bg-molecule-teal/80 transition-all flex items-center gap-2"
          >
            <Upload size={16} />
            Upload PDF
          </button>

          {pdfDocument && (
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-slate-300 text-sm font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {pdfDocument && (
            <div className="flex items-center gap-2">
              <button
                onClick={zoomOut}
                className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
                title="Zoom out"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-slate-300 text-sm font-medium min-w-[3rem] text-center">
                {zoom}%
              </span>
              <button
                onClick={zoomIn}
                className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
                title="Zoom in"
              >
                <ZoomIn size={18} />
              </button>
            </div>
          )}

          {highlightedText && (
            <button
              onClick={() => setHighlightedText('')}
              className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded border border-yellow-500/30 hover:bg-yellow-500/30 transition-all"
            >
              Clear Highlight
            </button>
          )}
        </div>

        {/* PDF Display */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center"
          onMouseUp={handleTextSelection}
        >
          {pdfDocument ? (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full"
                style={{ display: 'block' }}
              />
            </div>
          ) : (
            <div className="text-center">
              <div className="text-slate-400 mb-4">
                <Upload size={48} className="mx-auto mb-2 opacity-50" />
              </div>
              <p className="text-slate-400 mb-2">No PDF loaded</p>
              <p className="text-slate-500 text-sm">
                Click "Upload PDF" to load a document
              </p>
            </div>
          )}
        </div>

        {/* Info Footer */}
        {highlightedText && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50">
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-yellow-400">Highlighted:</span> {highlightedText.substring(0, 100)}
              {highlightedText.length > 100 ? '...' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeminiLivePDFViewer;
