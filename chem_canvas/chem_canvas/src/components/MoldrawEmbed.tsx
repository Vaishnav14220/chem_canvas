import React, { useState, useRef, useEffect } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  Download, 
  Copy, 
  RefreshCw, 
  ExternalLink,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface MoldrawEmbedProps {
  onClose?: () => void;
}

const MoldrawEmbed: React.FC<MoldrawEmbedProps> = ({ onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Set a timeout to handle loading state
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const refreshIframe = () => {
    setIsLoading(true);
    setHasError(false);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const openInNewTab = () => {
    window.open('https://moldraw.com/', '_blank');
  };

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full'} bg-slate-900`}>
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/50 p-3">
        <div className="flex items-center justify-between">
          {/* Left - Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <h3 className="text-white font-semibold">Moldraw Molecular Editor</h3>
            </div>
            <span className="text-xs text-slate-400">Professional Chemistry Drawing Tool</span>
          </div>

          {/* Right - Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={refreshIframe}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            
            <button
              onClick={openInNewTab}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink size={18} />
            </button>

            <div className="w-px h-6 bg-slate-600 mx-2"></div>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-20 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Loader2 size={48} className="text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-medium mb-2">Loading Moldraw Editor...</p>
            <p className="text-slate-400 text-sm">Please wait while we load the molecular drawing tool</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 z-20 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center max-w-md p-8 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <p className="text-white text-lg font-medium mb-2">Failed to Load Moldraw</p>
            <p className="text-slate-400 text-sm mb-6">
              The Moldraw editor could not be loaded. This might be due to:
            </p>
            <ul className="text-slate-400 text-sm text-left mb-6 space-y-2">
              <li>• Network connectivity issues</li>
              <li>• Browser security restrictions</li>
              <li>• Moldraw.com may not allow embedding</li>
            </ul>
            <div className="flex gap-3 justify-center">
              <button
                onClick={refreshIframe}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                onClick={openInNewTab}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <ExternalLink size={16} />
                Open in New Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Iframe Container */}
      <div className="w-full h-full" style={{ paddingTop: '60px' }}>
        <iframe
          ref={iframeRef}
          src="https://moldraw.com/"
          className="w-full h-full border-0"
          title="Moldraw Molecular Editor"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
          allow="clipboard-read; clipboard-write"
        />
      </div>

      {/* Info Banner */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700/50 p-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>Powered by Moldraw.com</span>
            <span>•</span>
            <span>Professional Molecular Drawing</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Draw molecules, reactions, and chemical structures</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoldrawEmbed;
