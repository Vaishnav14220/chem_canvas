/**
 * PDF Viewer Sidebar Component
 * Displays the original document with highlighting of relevant sections
 * Based on the lesson content being studied
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { Eye, EyeOff, Download, ZoomIn, ZoomOut, X, FileText } from 'lucide-react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import {
  highlightPlugin,
  Trigger,
  type HighlightArea,
  type RenderHighlightsProps,
} from '@react-pdf-viewer/highlight';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { thumbnailPlugin } from '@react-pdf-viewer/thumbnail';

import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';
import '@react-pdf-viewer/thumbnail/lib/styles/index.css';

interface DocumentSidebarProps {
  documentContent: string;
  documentName: string;
  highlightedLines?: number[];
  currentLesson?: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  documentFileUrl?: string | null;
  requestedPage?: number | null;
  onClearRequestedPage?: () => void;
}

interface LineHighlight {
  lineNumber: number;
  text: string;
  reason: 'molecule' | 'reaction' | 'simulation' | 'topic';
  context: string;
  pageNumber: number | null;
}

interface SidebarHighlightArea extends HighlightArea {
  id: string;
  reason: LineHighlight['reason'];
}

const PAGE_TOKEN_REGEX = /\[\s*PAGE\s*(\d+)\s*\]/i;

const parseDocumentLines = (
  content: string,
  highlightedLines: number[]
): LineHighlight[] => {
  const lines = content.split('\n');
  const pageNumbers: number[] = [];
  let currentPage = 1;

  lines.forEach((line) => {
    const match = PAGE_TOKEN_REGEX.exec(line);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        currentPage = parsed;
      }
    }
    pageNumbers.push(currentPage);
  });

  const highlights: LineHighlight[] = [];

  highlightedLines.forEach((lineNum) => {
    if (lineNum < 0 || lineNum >= lines.length) {
      return;
    }

    const rawLine = lines[lineNum] ?? '';
    const combinedWindow = `${rawLine} ${lines[lineNum + 1] ?? ''}`.toLowerCase();

    let reason: LineHighlight['reason'] = 'topic';
    if (
      combinedWindow.includes('structure') ||
      combinedWindow.includes('molecular') ||
      combinedWindow.includes('geometry')
    ) {
      reason = 'molecule';
    } else if (
      combinedWindow.includes('reaction') ||
      combinedWindow.includes('mechanism') ||
      combinedWindow.includes('synthesis')
    ) {
      reason = 'reaction';
    } else if (
      combinedWindow.includes('simulation') ||
      combinedWindow.includes('interactive') ||
      combinedWindow.includes('model')
    ) {
      reason = 'simulation';
    }

    const cleanedLine = rawLine.replace(PAGE_TOKEN_REGEX, '').trim();
    const fallbackLine = lines[lineNum + 1]?.replace(PAGE_TOKEN_REGEX, '').trim() ?? '';
    const text = cleanedLine.length > 0 ? cleanedLine : fallbackLine || '(empty line)';

    highlights.push({
      lineNumber: lineNum,
      text,
      reason,
      context: `Line ${lineNum + 1}`,
      pageNumber: pageNumbers[lineNum] ?? null,
    });
  });

  return highlights;
};

const getHighlightColor = (
  reason: LineHighlight['reason']
): string => {
  switch (reason) {
    case 'molecule':
      return 'bg-blue-500/20 border-l-4 border-blue-500';
    case 'reaction':
      return 'bg-purple-500/20 border-l-4 border-purple-500';
    case 'simulation':
      return 'bg-green-500/20 border-l-4 border-green-500';
    case 'topic':
    default:
      return 'bg-yellow-500/20 border-l-4 border-yellow-500';
  }
};

const getReasonLabel = (reason: LineHighlight['reason']): string => {
  switch (reason) {
    case 'molecule':
      return '🔬 Molecule';
    case 'reaction':
      return '⚡ Reaction';
    case 'simulation':
      return '🎮 Simulation';
    case 'topic':
    default:
      return '📚 Topic';
  }
};

const getOverlayColor = (reason: LineHighlight['reason']): string => {
  switch (reason) {
    case 'molecule':
      return 'rgba(59, 130, 246, 0.22)';
    case 'reaction':
      return 'rgba(168, 85, 247, 0.22)';
    case 'simulation':
      return 'rgba(34, 197, 94, 0.18)';
    case 'topic':
    default:
      return 'rgba(234, 179, 8, 0.18)';
  }
};

export const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  documentContent,
  documentName,
  highlightedLines = [],
  currentLesson = '',
  isOpen,
  onToggle,
  documentFileUrl,
  requestedPage,
  onClearRequestedPage,
}) => {
  const [textZoom, setTextZoom] = useState(100);
  const [selectedHighlight, setSelectedHighlight] = useState<number | null>(null);
  const [showOnlyHighlights, setShowOnlyHighlights] = useState(false);
  const [search, setSearch] = useState('');
  const [pdfHighlightAreas, setPdfHighlightAreas] = useState<SidebarHighlightArea[]>([]);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Debug logging
  useEffect(() => {
    console.log('[DocumentSidebar] Props update:', {
      isOpen,
      documentFileUrl: documentFileUrl ? 'Available' : 'Not available',
      highlightedLinesCount: highlightedLines.length,
      documentContentLength: documentContent.length,
      documentName
    });
  }, [isOpen, documentFileUrl, highlightedLines, documentContent, documentName]);

  const highlights = useMemo(
    () => parseDocumentLines(documentContent, highlightedLines),
    [documentContent, highlightedLines]
  );

  const filteredHighlights = useMemo(() => {
    if (!showOnlyHighlights) {
      return highlights;
    }

    const query = search.trim().toLowerCase();
    if (!query) {
      return highlights;
    }

    return highlights.filter((highlight) =>
      highlight.text.toLowerCase().includes(query) ||
      highlight.reason.includes(query)
    );
  }, [highlights, showOnlyHighlights, search]);

  const displayHighlights = showOnlyHighlights ? filteredHighlights : highlights;

  useEffect(() => {
    if (!documentFileUrl) {
      setPdfHighlightAreas([]);
      return;
    }

    const byPage = new Map<number, SidebarHighlightArea>();

    displayHighlights.forEach((highlight) => {
      const pageNumber = highlight.pageNumber ?? 1;
      const pageIndex = Math.max(pageNumber - 1, 0);

      if (!byPage.has(pageIndex)) {
        byPage.set(pageIndex, {
          id: `highlight-page-${pageIndex}`,
          pageIndex,
          top: 0,
          left: 0,
          width: 100,
          height: 100,
          reason: highlight.reason,
        });
      }
    });

    setPdfHighlightAreas(Array.from(byPage.values()));
  }, [displayHighlights, documentFileUrl]);

  const renderPdfHighlights = useCallback(
    (props: RenderHighlightsProps) => (
      <div>
        {pdfHighlightAreas
          .filter((area) => area.pageIndex === props.pageIndex)
          .map((area) => (
            <div
              key={area.id}
              style={Object.assign(
                {},
                {
                  background: getOverlayColor(area.reason),
                  borderRadius: '6px',
                },
                props.getCssProperties(area, props.rotation)
              )}
            />
          ))}
      </div>
    ),
    [pdfHighlightAreas]
  );

  const highlightPluginInstance = highlightPlugin({
    renderHighlights: renderPdfHighlights,
    trigger: Trigger.None,
  });

  const zoomPluginInstance = zoomPlugin();
  const { ZoomIn: PdfZoomIn, ZoomOut: PdfZoomOut, CurrentScale } = zoomPluginInstance;

  const pageNavigationPluginInstance = pageNavigationPlugin();
  const pageNavigationPluginRef = useRef(pageNavigationPluginInstance);
  pageNavigationPluginRef.current = pageNavigationPluginInstance;

  const thumbnailPluginInstance = thumbnailPlugin();
  const { Thumbnails } = thumbnailPluginInstance;
  useEffect(() => {
    if (!requestedPage) {
      return;
    }

    const plugin = pageNavigationPluginRef.current;
    if (plugin?.jumpToPage) {
      const pageIndex = Math.max(requestedPage - 1, 0);
      plugin.jumpToPage(pageIndex);
      onClearRequestedPage?.();
    }
  }, [requestedPage, onClearRequestedPage]);

  const handleHighlightSelect = (highlight: LineHighlight) => {
    setSelectedHighlight(highlight.lineNumber);

    if (!documentFileUrl || !highlight.pageNumber) {
      return;
    }

    const pageIndex = Math.max(highlight.pageNumber - 1, 0);
    const area = pdfHighlightAreas.find((entry) => entry.pageIndex === pageIndex);
    if (area) {
      highlightPluginInstance.jumpToHighlightArea?.(area);
    }
  };

  const handleExportHighlights = () => {
    const text = displayHighlights
      .map(
        (highlight) =>
          `[${getReasonLabel(highlight.reason)}] ${highlight.context}: ${highlight.text}`
      )
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentName}-highlights.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Conditional rendering without early return to satisfy React Hooks rules
  if (!isOpen) {
    return (
      <button
        onClick={() => onToggle(true)}
        className="fixed right-4 bottom-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all z-40"
        title="Open document reference"
      >
        <Eye className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      ref={sidebarRef}
      className="fixed right-0 top-0 h-screen w-[28rem] bg-slate-900 border-l border-slate-700 shadow-xl flex flex-col overflow-hidden z-50"
    >
      <div className="bg-gradient-to-r from-blue-900/50 to-blue-800/50 border-b border-blue-700/50 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-blue-100 truncate">{documentName}</h2>
            {currentLesson && (
              <p className="text-xs text-blue-300 mt-1">Studying: {currentLesson}</p>
            )}
          </div>
          <button
            onClick={() => onToggle(false)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search highlights..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowOnlyHighlights((prev) => !prev)}
            className={`p-1.5 rounded transition-colors ${
              showOnlyHighlights
                ? 'bg-blue-600/60 text-blue-100'
                : 'bg-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title={showOnlyHighlights ? 'Show all highlights' : 'Filter highlights by search'}
          >
            {showOnlyHighlights ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>
            {displayHighlights.length} highlight{displayHighlights.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTextZoom((prev) => Math.max(80, prev - 10))}
              className="p-0.5 hover:bg-slate-700/50 rounded transition-colors"
              title="Decrease text size"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="px-2">{textZoom}%</span>
            <button
              onClick={() => setTextZoom((prev) => Math.min(160, prev + 10))}
              className="p-0.5 hover:bg-slate-700/50 rounded transition-colors"
              title="Increase text size"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {documentFileUrl ? (
        <div className="border-b border-slate-700/60 bg-slate-900/60">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <div className="flex items-center gap-2 text-slate-200">
              <FileText className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Document Viewer
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PdfZoomOut>
                {(props) => (
                  <button
                    onClick={props.onClick}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                )}
              </PdfZoomOut>
              <CurrentScale>
                {(props) => (
                  <span className="text-xs text-slate-300 min-w-[48px] text-center">
                    {Math.round(props.scale * 100)}%
                  </span>
                )}
              </CurrentScale>
              <PdfZoomIn>
                {(props) => (
                  <button
                    onClick={props.onClick}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded transition-colors"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                )}
              </PdfZoomIn>
            </div>
          </div>
          <div className="h-[36rem] lg:h-[42rem] overflow-hidden bg-slate-950">
            <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
              <Viewer
                fileUrl={documentFileUrl}
                plugins={[
                  highlightPluginInstance,
                  zoomPluginInstance,
                  pageNavigationPluginInstance,
                  thumbnailPluginInstance,
                ]}
                defaultScale={1.2}
                theme={{ theme: 'dark' }}
              />
            </Worker>
          </div>
          <div className="border-t border-slate-800/60 bg-slate-950/70 px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Quick navigation
            </div>
            <div className="max-h-44 overflow-y-auto pr-1">
              <Thumbnails />
            </div>
          </div>
        </div>
      ) : (
        <div className="border-b border-slate-700/60 bg-slate-900/50 px-4 py-3 text-xs text-slate-400">
          Original PDF preview unavailable for this session.
        </div>
      )}

      <div className="bg-slate-800/50 border-b border-slate-700/50 px-4 py-2 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500/60 rounded-sm" />
            <span className="text-slate-300">Molecules</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500/60 rounded-sm" />
            <span className="text-slate-300">Reactions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500/60 rounded-sm" />
            <span className="text-slate-300">Simulations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500/60 rounded-sm" />
            <span className="text-slate-300">Topics</span>
          </div>
        </div>
      </div>

      <div ref={contentRef} className="flex-1 overflow-y-auto">
        {displayHighlights.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            <p>No relevant sections highlighted yet</p>
            <p className="text-xs mt-2">Highlights will appear as you study</p>
          </div>
        ) : (
          displayHighlights.map((highlight) => (
            <div
              key={highlight.lineNumber}
              data-line={highlight.lineNumber}
              onClick={() => handleHighlightSelect(highlight)}
              className={`p-3 border-b border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-all ${
                selectedHighlight === highlight.lineNumber ? 'ring-1 ring-blue-500' : ''
              }`}
              style={{ fontSize: `${textZoom}%` }}
            >
              <div className="flex items-start gap-2 mb-1 flex-wrap">
                <span className="text-xs whitespace-nowrap px-2 py-0.5 rounded bg-slate-700/60 text-slate-300">
                  {highlight.context}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-700/60 text-slate-300">
                  {getReasonLabel(highlight.reason)}
                </span>
                {highlight.pageNumber && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-700/60 text-slate-300">
                    Page {highlight.pageNumber}
                  </span>
                )}
              </div>
              <div className={`p-2 rounded text-sm text-slate-200 ${getHighlightColor(highlight.reason)}`}>
                {highlight.text}
              </div>
            </div>
          ))
        )}
      </div>

      {displayHighlights.length > 0 && (
        <div className="bg-slate-800/50 border-t border-slate-700/50 p-3 flex-shrink-0 flex gap-2">
          <button
            onClick={handleExportHighlights}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            title="Export highlights as text file"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setShowOnlyHighlights(false)}
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded transition-colors"
            title="Show all highlights"
          >
            Show All
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentSidebar;
