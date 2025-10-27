import React, { useEffect, useRef, useState } from 'react';
import { X, Maximize2, Minimize2, RefreshCw, Database, Download } from 'lucide-react';
// @ts-ignore - 3Dmol.js doesn't have TypeScript definitions
import * as $3Dmol from '3dmol';

interface PDBViewerEmbeddedProps {
  pdbId: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

const PDBViewerEmbedded: React.FC<PDBViewerEmbeddedProps> = ({
  pdbId,
  isOpen,
  onClose,
  title
}) => {
  console.log('PDBViewerEmbedded render:', { pdbId, isOpen, title });

  // Validate pdbId more thoroughly
  if (!pdbId || typeof pdbId !== 'string' || pdbId.trim() === '' || !/^[A-Za-z0-9]{4}$/.test(pdbId)) {
    console.error('Invalid PDB ID provided to PDBViewerEmbedded:', pdbId);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl p-6 max-w-md">
          <h2 className="text-xl font-bold text-white mb-4">Invalid PDB ID</h2>
          <p className="text-slate-300 mb-4">The provided PDB ID is not valid. PDB IDs should be 4 characters long.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);

  const entryUrl = `https://www.rcsb.org/structure/${pdbId.toUpperCase()}`;

  useEffect(() => {
    if (isOpen && pdbId && viewerContainerRef.current) {
      loadPDBStructure();
    }

    return () => {
      if (viewerInstanceRef.current) {
        try {
          viewerInstanceRef.current.clear();
          viewerInstanceRef.current = null;
        } catch (err) {
          console.warn('Error clearing 3Dmol viewer:', err);
        }
      }
    };
  }, [isOpen, pdbId]);

  const loadPDBStructure = async () => {
    if (!viewerContainerRef.current) return;

    console.log('Loading PDB structure for ID:', pdbId);
    setIsLoading(true);
    setError(null);

    try {
      // Clear any existing viewer
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.clear();
      }

      // Create new 3Dmol viewer
      const viewer = $3Dmol.createViewer(viewerContainerRef.current, {
        backgroundColor: 'black'
      });

      viewerInstanceRef.current = viewer;

      // Load PDB structure
      const pdbUrl = `https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`;

      await new Promise<void>((resolve, reject) => {
        viewer.addModel(pdbUrl, 'pdb', (model: any) => {
          if (!model || model.length === 0) {
            reject(new Error('Failed to load PDB model'));
            return;
          }
          resolve();
        });
      });

      // Configure visualization
      viewer.setStyle({}, {
        cartoon: {
          color: 'spectrum',
          thickness: 0.5
        }
      });

      // Add surface for better 3D visualization
      viewer.addSurface($3Dmol.SurfaceType.VDW, {
        opacity: 0.7,
        color: 'white'
      });

      // Set up the view
      viewer.zoomTo();
      viewer.render();
      viewer.zoom(0.8, 1000); // Slight zoom out for better view

      setIsLoading(false);
      console.log('PDB structure loaded successfully');

    } catch (err) {
      console.error('Error loading PDB structure:', err);
      setError(err instanceof Error ? err.message : 'Failed to load PDB structure');
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadPDBStructure();
  };

  const openPDBEntry = () => {
    window.open(entryUrl, '_blank');
  };

  const downloadPDB = () => {
    const downloadUrl = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.pdb`;
    window.open(downloadUrl, '_blank');
  };

  if (!isOpen) {
    console.log('PDBViewerEmbedded not rendering because isOpen is false');
    return null;
  }

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
              onClick={downloadPDB}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
              title="Download PDB File"
            >
              <Download size={14} />
              Download
            </button>

            <button
              onClick={openPDBEntry}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
              title="Open PDB Entry Page"
            >
              <Database size={14} />
              PDB Entry
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
        <div className="relative w-full h-full bg-black">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading 3D Structure...</p>
                <p className="text-xs text-slate-500 mt-2">Fetching PDB data from RCSB</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center max-w-md">
                <div className="text-red-400 mb-4">
                  <X size={48} className="mx-auto mb-2" />
                  <p className="font-semibold">Failed to Load Structure</p>
                </div>
                <p className="text-slate-300 mb-4">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* 3Dmol.js WebGL Canvas Container */}
          <div
            ref={viewerContainerRef}
            className="w-full h-full"
            style={{ minHeight: '400px' }}
          />
        </div>
      </div>
    </div>
  );
};

export default PDBViewerEmbedded;