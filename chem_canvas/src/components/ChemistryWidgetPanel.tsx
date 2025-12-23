import React, { useState } from 'react';
import { Maximize2, Minimize2, Layers3, Atom, Waves, RefreshCw } from 'lucide-react';
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
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'relative'} border rounded-lg overflow-hidden flex flex-col`} style={{ backgroundColor: '#1F1F1F', borderColor: 'rgba(6, 182, 212, 0.2)', height: isFullscreen ? '100vh' : '550px' }}>
      <div className="px-6 py-4 flex items-center justify-between backdrop-blur-xl" style={{ backgroundColor: '#22262B', borderBottom: '1px solid rgba(6, 182, 212, 0.2)' }}>
        <h2 className="font-bold text-white">3D Explorer</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300">✕</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#1F1F1F' }}>
        <div className="p-4 h-full overflow-y-auto" style={{ backgroundColor: '#1F1F1F' }}>
          <MolecularVisualizationWorkspace />
        </div>
      </div>
    </div>
  );
};

export default ChemistryWidgetPanel;
