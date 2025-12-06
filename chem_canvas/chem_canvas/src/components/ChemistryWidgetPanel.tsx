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
        {/* Compact Magic UI dock for quick presets */}
        <div className="px-4 pb-4 pt-2">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:backdrop-blur-lg">
            {[
              { id: 'dock-ball', label: 'Ball & Stick', icon: Layers3 },
              { id: 'dock-density', label: 'Density', icon: Atom },
              { id: 'dock-surface', label: 'Surface', icon: Waves },
              { id: 'dock-reset', label: 'Reset', icon: RefreshCw },
            ].map((item) => (
              <button
                key={item.id}
                className="group relative flex h-11 flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/80 text-[12px] font-semibold text-slate-200 transition hover:-translate-y-[1px] hover:border-slate-600 hover:bg-slate-800/80 hover:text-white"
                title={item.label}
              >
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-blue-500/10 via-cyan-400/10 to-blue-600/10 blur-[18px] transition-opacity" />
                <div className="relative flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 h-full overflow-y-auto bg-slate-900">
          <MolecularVisualizationWorkspace />
        </div>
      </div>
    </div>
  );
};

export default ChemistryWidgetPanel;
