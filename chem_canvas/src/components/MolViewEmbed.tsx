import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, X, Maximize2, Minimize2, RefreshCw, Home, AlertTriangle } from 'lucide-react';

interface MolViewEmbedProps {
  isOpen: boolean;
  onClose: () => void;
}

const MolViewEmbed: React.FC<MolViewEmbedProps> = ({ isOpen, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [useAlternative, setUseAlternative] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://molview.org/');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      setHasError(false);
      iframeRef.current.src = currentUrl;
    }
  };

  const handleHome = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      setHasError(false);
      setCurrentUrl('https://molview.org/');
      iframeRef.current.src = 'https://molview.org/';
    }
  };

  const openInNewTab = () => {
    window.open(currentUrl, '_blank');
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
    if (iframeRef.current) {
      try {
        // Try to get the current URL from the iframe (may not work due to CORS)
        const iframeUrl = iframeRef.current.contentWindow?.location.href;
        if (iframeUrl && iframeUrl !== 'about:blank') {
          setCurrentUrl(iframeUrl);
        }
      } catch (e) {
        // CORS prevents access to iframe URL, keep current URL
      }
    }
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const tryAlternative = () => {
    setUseAlternative(true);
    setHasError(false);
    setIsLoading(true);
  };

  useEffect(() => {
    if (isOpen && iframeRef.current) {
      setIsLoading(true);
      setHasError(false);
      iframeRef.current.src = 'https://molview.org/';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 ${
      isFullscreen ? 'p-0' : 'p-4'
    }`}>
      <div className={`bg-gray-900/95 backdrop-blur-lg shadow-2xl border border-gray-700 ${
        isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-7xl h-[95vh] rounded-2xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17" />
                <path d="M2 12L12 17L22 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">MolView - Full Website Access</h2>
              <p className="text-sm text-gray-400">
                Complete chemical structure visualization platform
                {useAlternative && <span className="text-orange-400 ml-2">(Alternative Mode)</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleHome}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Go to MolView homepage"
            >
              <Home className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh page"
            >
              <RefreshCw className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
            <button
              onClick={openInNewTab}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5 text-gray-400 hover:text-white" />
              ) : (
                <Maximize2 className="h-5 w-5 text-gray-400 hover:text-white" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* URL Bar */}
        <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/30">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400">URL:</span>
            <div className="flex-1 bg-gray-700 rounded px-3 py-1 text-sm text-gray-300 font-mono">
              {currentUrl}
            </div>
          </div>
        </div>

        {/* MolView Full Website iframe */}
        <div className="relative" style={{ height: isFullscreen ? 'calc(100vh - 120px)' : 'calc(95vh - 120px)' }}>
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-white text-lg">Loading MolView...</p>
                <p className="text-gray-400 text-sm mt-2">Accessing 51+ million chemical compounds</p>
              </div>
            </div>
          )}
          
          {hasError && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10">
              <div className="text-center max-w-md mx-auto p-6">
                <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-white text-xl font-bold mb-2">MolView Loading Issue</h3>
                <p className="text-gray-400 text-sm mb-4">
                  The MolView website may be experiencing issues or blocking iframe embedding. 
                  Try opening it in a new tab for full functionality.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={tryAlternative}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Alternative Mode
                  </button>
                  <button
                    onClick={openInNewTab}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Open in New Tab
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            src="https://molview.org/"
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="MolView - Full Chemical Structure Platform"
            sandbox={useAlternative 
              ? "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation allow-modals allow-orientation-lock allow-pointer-lock allow-presentation"
              : "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation allow-modals"
            }
            allow="fullscreen; camera; microphone; geolocation; payment; usb; autoplay; clipboard-read; clipboard-write"
            referrerPolicy="no-referrer-when-downgrade"
            loading="eager"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center space-x-4">
              <span className="font-medium text-blue-400">MolView v2.4</span>
              <span>•</span>
              <span>51+ million compounds from PubChem</span>
              <span>•</span>
              <span>100,000+ protein structures from RCSB</span>
              <span>•</span>
              <span>300,000+ crystal structures</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Full website access within Studium</span>
              <span>•</span>
              <a 
                href="https://molview.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                MolView.org
              </a>
              <span>•</span>
              <button
                onClick={openInNewTab}
                className="text-green-400 hover:text-green-300 underline"
              >
                Open Full Site
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MolViewEmbed;
