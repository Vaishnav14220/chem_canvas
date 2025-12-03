import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, X, Maximize2, Minimize2, RefreshCw, AlertTriangle, Database } from 'lucide-react';

interface PDBViewerEmbedProps {
  pdbId: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

const PDBViewerEmbed: React.FC<PDBViewerEmbedProps> = ({
  pdbId,
  isOpen,
  onClose,
  title
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const viewerUrl = `https://www.rcsb.org/3d-view/${pdbId.toUpperCase()}`;
  const entryUrl = `https://www.rcsb.org/structure/${pdbId.toUpperCase()}`;

  useEffect(() => {
    if (isOpen && pdbId) {
      setIsLoading(true);
      setHasError(false);
    }
  }, [isOpen, pdbId]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      setHasError(false);
      iframeRef.current.src = viewerUrl;
    }
  };

  const openInNewTab = () => {
    window.open(viewerUrl, '_blank');
  };

  const openPDBEntry = () => {
    window.open(entryUrl, '_blank');
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
      isFullscreen ? 'bg-black' : 'bg-black/60 backdrop-blur-sm'
    }`}>
      <div className={`relative bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden ${
        isFullscreen ? 'w-full h-full' : 'w-full max-w-6xl h-[80vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <Database className="text-blue-400" size={20} />
            <div>
              <h2 className="text-lg font-semibold text-white">
                PDB 3D Viewer - {pdbId.toUpperCase()}
              </h2>
              {title && (
                <p className="text-sm text-slate-400">{title}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openPDBEntry}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
              title="Open PDB Entry Page"
            >
              <Database size={14} />
              PDB Entry
            </button>

            <button
              onClick={openInNewTab}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink size={14} />
              New Tab
            </button>

            <button
              onClick={handleRefresh}
              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-colors"
              title="Refresh Viewer"
            >
              <RefreshCw size={16} />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg transition-colors"
              title="Close Viewer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative w-full h-full bg-slate-900">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading 3D Viewer...</p>
              </div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center max-w-md">
                <AlertTriangle className="text-red-400 h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Failed to Load 3D Viewer</h3>
                <p className="text-slate-400 mb-4">
                  Unable to load the RCSB PDB 3D viewer. This may be due to network issues or the viewer being temporarily unavailable.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={openInNewTab}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                  >
                    Open in Browser
                  </button>
                </div>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={viewerUrl}
            className={`w-full h-full border-0 ${isLoading || hasError ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title={`RCSB PDB 3D Viewer - ${pdbId.toUpperCase()}`}
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
};

export default PDBViewerEmbed;