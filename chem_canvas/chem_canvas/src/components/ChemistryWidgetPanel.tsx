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
        {/* Magic UI-inspired interactive strip */}
        <div className="px-4 py-3 border-b border-slate-800/70 bg-slate-900/80">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'preset-ball', label: 'Ball & Stick', accent: 'from-blue-500/50 to-cyan-500/40' },
              { id: 'preset-density', label: 'Electron Density', accent: 'from-violet-500/50 to-indigo-500/40' },
              { id: 'preset-surface', label: 'Solvent Surface', accent: 'from-emerald-500/50 to-teal-500/40' },
              { id: 'preset-reset', label: 'Reset View', accent: 'from-amber-500/50 to-orange-500/40' },
            ].map((item) => (
              <button
                key={item.id}
                className={`group relative overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/80 px-3 py-3 text-left transition hover:-translate-y-[1px] hover:border-slate-600 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)]`}
              >
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${item.accent} blur-[18px]`} />
                <div className="relative flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">{item.label}</span>
                  <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/80">
                    tap
                  </span>
                </div>
                <p className="relative mt-1 text-[11px] text-slate-400">
                  Interactive control — apply instantly to the live viewport.
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 h-full overflow-y-auto bg-slate-900">
          <MolecularVisualizationWorkspace />
        </div>

        {/* Compact Magic-UI style dock */}
        <div className="sticky bottom-0 z-10 px-4 pb-4">
          <div className="mx-auto flex w-full max-w-xl items-center justify-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/80 px-3 py-2 shadow-xl backdrop-blur">
            {[
              { id: 'ball', label: 'Ball&Stick' },
              { id: 'density', label: 'Density' },
              { id: 'surface', label: 'Surface' },
              { id: 'reset', label: 'Reset' },
            ].map((item) => (
              <button
                key={item.id}
                className="flex h-10 flex-1 items-center justify-center rounded-xl bg-slate-900/80 text-[12px] font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white border border-slate-800/70"
                title={item.label}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChemistryWidgetPanel;
