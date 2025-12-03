import React, { useState, useRef } from 'react';
import { Upload, Link as LinkIcon, Download, RotateCcw } from 'lucide-react';

const SAMPLE_URL = 'https://files.rcsb.org/download/1CRN.pdb';

const QUICK_MOLECULES = [
  { name: 'Water', smiles: 'O', desc: 'H₂O' },
  { name: 'Methane', smiles: 'C', desc: 'CH₄' },
  { name: 'Benzene', smiles: 'c1ccccc1', desc: 'C₆H₆' },
  { name: 'Caffeine', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C', desc: 'Stimulant' },
];

interface MoleculeLoaderProps {
  onScriptChange: (script: string) => void;
}

const MoleculeLoader: React.FC<MoleculeLoaderProps> = ({ onScriptChange }) => {
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadQuickMolecule = (smiles: string) => {
    onScriptChange(`load $${smiles}; wireframe 0.15; spacefill 20%; color cpk; rotate best;`);
  };

  const loadSample = () => {
    setUrl(SAMPLE_URL);
    onScriptChange(`load "${SAMPLE_URL}"; spacefill off; wireframe 0.15; select all; color cpk;`);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      const inline = `load inline "${data}"; spacefill off; wireframe 0.15; color cpk;`;
      onScriptChange(inline);
    };
    reader.readAsText(file);
  };

  const loadFromUrl = () => {
    if (url.trim()) {
      onScriptChange(`load "${url}"; spacefill off; wireframe 0.15; color cpk;`);
    }
  };

  const runCommand = (cmd: string) => {
    onScriptChange(cmd);
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Quick Molecules</h3>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_MOLECULES.map((mol) => (
            <button
              key={mol.name}
              onClick={() => loadQuickMolecule(mol.smiles)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs transition-colors"
            >
              <div className="font-semibold">{mol.name}</div>
              <div className="text-purple-200 text-[10px]">{mol.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Load Structure</h3>
        
        <div className="space-y-3">
          <button
            onClick={loadSample}
            className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Load Sample Protein (1CRN.pdb)
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter structure URL (PDB, MOL, CIF)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadFromUrl()}
              className="flex-1 px-3 py-2 bg-slate-600 text-white rounded-lg text-sm"
            />
            <button
              onClick={loadFromUrl}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdb,.mol,.cif,.xyz"
              onChange={handleFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Local File
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Display Styles</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => runCommand('spacefill 25%;')}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
          >
            Spacefill
          </button>
          <button
            onClick={() => runCommand('wireframe 0.15; spacefill off;')}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
          >
            Ball & Stick
          </button>
          <button
            onClick={() => runCommand('cartoon; color structure;')}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
          >
            Cartoon
          </button>
          <button
            onClick={() => runCommand('select all; color cpk;')}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
          >
            CPK Colors
          </button>
          <button
            onClick={() => runCommand('reset;')}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors col-span-2 flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset View
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoleculeLoader;
