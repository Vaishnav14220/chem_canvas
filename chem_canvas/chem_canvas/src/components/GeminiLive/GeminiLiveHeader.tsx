import React from 'react';
import { FlaskConical, Atom, X } from 'lucide-react';

interface GeminiLiveHeaderProps {
  onClose: () => void;
}

const GeminiLiveHeader: React.FC<GeminiLiveHeaderProps> = ({ onClose }) => {
  return (
    <header className="w-full p-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-molecule-teal to-molecule-purple rounded-lg shadow-lg shadow-molecule-teal/20">
            <FlaskConical className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Chem<span className="text-molecule-teal">Tutor</span> AI</h1>
          <p className="text-xs text-slate-400 font-mono">University Level • Gemini Live</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-500 border border-slate-800 rounded-full px-3 py-1">
          <Atom className="w-3 h-3 animate-spin-slow" />
          <span>Status: Operational</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          title="Close Gemini Live"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default GeminiLiveHeader;
