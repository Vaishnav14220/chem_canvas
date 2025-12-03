import React from 'react';
import { AlertTriangle, ExternalLink, Loader2, Maximize2 } from 'lucide-react';
import { usePdfPageImages } from '../hooks/usePdfPageImages';

interface QuestionReferencePreviewProps {
  documentFileUrl: string;
  pages: number[];
  scale?: number;
}

const QuestionReferencePreview: React.FC<QuestionReferencePreviewProps> = ({
  documentFileUrl,
  pages,
  scale = 1.35,
}) => {
  const { status, images, error } = usePdfPageImages(documentFileUrl, pages, scale);
  const orderedPages = React.useMemo(() => {
    const unique = Array.from(new Set(pages)).filter((num) => Number.isFinite(num) && num > 0);
    unique.sort((a, b) => a - b);
    return unique;
  }, [pages]);

  const handleOpenInNewTab = (dataUrl: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<img src="${dataUrl}" style="width: 100%; height: auto;" />`);
      newWindow.document.title = 'Document Diagram Preview';
    }
  };

  if (orderedPages.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-blue-500/40 bg-slate-950/70 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">
            Extracted diagram preview
          </p>
          <p className="text-[11px] text-blue-200/70">
            Generated from referenced pages for quick review alongside the question.
          </p>
        </div>
        {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-blue-200" />}
      </div>

      {status === 'error' && (
        <div className="mt-3 flex items-center gap-2 rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertTriangle className="h-4 w-4" />
          <span>{error ?? 'Unable to render reference pages.'}</span>
        </div>
      )}

      <div className="mt-3 space-y-4">
        {orderedPages.map((pageNumber) => {
          const image = images[pageNumber];
          return (
            <div key={pageNumber} className="rounded border border-slate-700/80 bg-slate-900/70 p-2">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-300">
                <span>Page {pageNumber}</span>
                {image && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenInNewTab(image.dataUrl)}
                      className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      <Maximize2 className="h-3 w-3" />
                      Enlarge
                    </button>
                    <a
                      href={image.dataUrl}
                      download={`diagram-page-${pageNumber}.png`}
                      className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-blue-500"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Save
                    </a>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded border border-slate-800 bg-black/90">
                {image ? (
                  <img
                    src={image.dataUrl}
                    alt={`Reference from page ${pageNumber}`}
                    className="max-h-64 w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center text-xs text-slate-500">
                    {status === 'loading' ? 'Rendering page...' : 'No render available for this page.'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionReferencePreview;
