import React, { useState } from 'react';
import { Maximize2, Minimize2, Layers3 } from 'lucide-react';
import MolecularVisualizationWorkspace from './MolecularVisualizationWorkspace';

interface ChemistryWidgetPanelProps {
  onClose?: () => void;
  startFullscreen?: boolean;
}

const ChemistryWidgetPanel: React.FC<ChemistryWidgetPanelProps> = ({
  onClose,
  startFullscreen = false,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(startFullscreen);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'relative'} bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col`} style={{ height: isFullscreen ? '100vh' : '550px' }}>
      <div className="bg-gradient-to-r from-slate-800 to-slate-750 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
            <Layers3 size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white">Chemistry Tools</h2>
            <p className="text-xs text-slate-400">
              Interactive JSmol demos, loaders, and guided activities.
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

      <div className="flex-1 bg-slate-900 overflow-auto">
        <div className="p-4 h-full overflow-y-auto bg-slate-900">
          <MolecularVisualizationWorkspace />
        </div>
      </div>
    </div>
  );
};

export default ChemistryWidgetPanel;
