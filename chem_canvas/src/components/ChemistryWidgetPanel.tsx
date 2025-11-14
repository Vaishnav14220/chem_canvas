import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Info, LineChart, ExternalLink, Layers3 } from 'lucide-react';
import MolecularVisualizationWorkspace from './MolecularVisualizationWorkspace';

interface ChemistryWidgetPanelProps {
  onClose?: () => void;
  initialView?: 'overview' | 'nmr' | 'explorer';
  startFullscreen?: boolean;
}

const NMR_IFRAME_URL = 'https://nmrium.nmrxiv.org?workspace=default';

type ActiveView = 'overview' | 'nmr' | 'explorer';

const ChemistryWidgetPanel: React.FC<ChemistryWidgetPanelProps> = ({
  onClose,
  initialView = 'overview',
  startFullscreen = false,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(startFullscreen);
  const [activeView, setActiveView] = useState<ActiveView>(initialView);
  const [isLoadingNmr, setIsLoadingNmr] = useState(initialView === 'nmr');

  useEffect(() => {
    setActiveView(initialView);
    if (initialView === 'nmr') {
      setIsLoadingNmr(true);
    }
  }, [initialView]);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'relative'} bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col`} style={{ height: isFullscreen ? '100vh' : '550px' }}>
      <div className="bg-gradient-to-r from-slate-800 to-slate-750 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
            {activeView === 'nmr' ? (
              <LineChart size={20} className="text-white" />
            ) : activeView === 'explorer' ? (
              <Layers3 size={20} className="text-white" />
            ) : (
              <Info size={20} className="text-white" />
            )}
          </div>
          <div>
            <h2 className="font-bold text-white">Chemistry Tools</h2>
            <p className="text-xs text-slate-400">
              {activeView === 'nmr'
                ? 'Embedded NMRium viewer (Beta)'
                : activeView === 'explorer'
                  ? 'Interactive JSmol demos, loaders, and guided activities.'
                  : 'Select a tool to get started.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300">✕</button>
          )}
        </div>
      </div>

      {/* Toggle buttons */}
      <div className="border-b border-slate-700 bg-slate-800/60 px-4 py-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView === 'overview' ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView('explorer')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView === 'explorer' ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60'}`}
          >
            3D Explorer
          </button>
          <button
            onClick={() => {
              setActiveView('nmr');
              setIsLoadingNmr(true);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView === 'nmr' ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600/60'}`}
          >
            NMR Viewer
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-900 overflow-auto">
        {activeView === 'overview' ? (
          <div className="p-8 flex flex-col gap-6">
            <p className="text-sm text-slate-300 max-w-xl">
              The ChemDoodle-based widgets have been removed. We are working on a replacement set of molecular tools. In the meantime, you can use the NMRium viewer for quick spectral analysis by switching to the "NMR Viewer" tab above.
            </p>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm text-slate-300 max-w-xl">
              <h3 className="text-sm font-semibold text-white mb-2">What you can expect soon:</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Modern molecular drawing and SMILES tools</li>
                <li>3D conformer visualization</li>
                <li>Integrated reaction balancing helpers</li>
                <li>Expanded spectroscopy previews</li>
              </ul>
            </div>
          </div>
        ) : activeView === 'nmr' ? (
          <div className="flex flex-col gap-4 p-4 h-full">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Embedded NMRium Viewer</h3>
                <p className="text-xs text-slate-400">Using the NFDI4Chem public instance. Documentation: <a href="https://github.com/NFDI4Chem/nmrium-react-wrapper" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">nmrium-react-wrapper</a>.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.open(NMR_IFRAME_URL, '_blank', 'noopener')}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700"
                >
                  <ExternalLink size={14} /> Open in new tab
                </button>
              </div>
            </div>
            <div className="relative flex-1 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              {isLoadingNmr && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-slate-300 text-sm">
                  Loading NMRium...
                </div>
              )}
              <iframe
                title="nmrium-viewer"
                src={NMR_IFRAME_URL}
                className="w-full h-full"
                style={{ minHeight: '400px' }}
                allowFullScreen
                onLoad={() => setIsLoadingNmr(false)}
              />
            </div>
            <div className="text-xs text-slate-400 bg-blue-900/10 border border-blue-800/40 rounded-lg p-3">
              <p className="font-semibold text-blue-200 mb-1">Tip:</p>
              <p>Drag and drop JCAMP-DX files directly into the embedded viewer or use the toolbar inside NMRium for advanced analysis.</p>
            </div>
          </div>
        ) : (
          <div className="p-4 h-full overflow-y-auto bg-slate-900">
            <MolecularVisualizationWorkspace />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChemistryWidgetPanel;
