import React, { useState } from 'react';
import { 
  Download, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  RefreshCw,
  FileText,
  Code,
  Beaker,
  Atom
} from 'lucide-react';

interface ChemistryStructureViewerProps {
  structure: any;
  onClose: () => void;
  onRegenerate: () => void;
}

const ChemistryStructureViewer: React.FC<ChemistryStructureViewerProps> = ({
  structure,
  onClose,
  onRegenerate
}) => {
  const [activeTab, setActiveTab] = useState<'structure' | 'formula' | 'smiles' | 'inchi'>('structure');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadStructure = (format: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${structure.metadata.name || 'structure'}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderStructure = () => {
    if (!structure) return null;

    return (
      <div className="space-y-4">
        {/* Structure Info */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Atom size={20} className="text-blue-400" />
            Structure Information
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400">Name</label>
              <p className="text-white font-medium">{structure.metadata.name || 'Unnamed'}</p>
            </div>
            <div>
              <label className="text-sm text-slate-400">Type</label>
              <p className="text-white font-medium capitalize">{structure.type}</p>
            </div>
            <div>
              <label className="text-sm text-slate-400">Atoms</label>
              <p className="text-white font-medium">{structure.atoms.length}</p>
            </div>
            <div>
              <label className="text-sm text-slate-400">Bonds</label>
              <p className="text-white font-medium">{structure.bonds.length}</p>
            </div>
          </div>
        </div>

        {/* Atoms List */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h4 className="text-md font-semibold text-white mb-3">Atoms</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {structure.atoms.map((atom: any, index: number) => (
              <div key={atom.id} className="flex items-center justify-between bg-slate-600/30 rounded p-2">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    {atom.element}
                  </div>
                  <span className="text-white text-sm">{atom.element}</span>
                  {atom.charge && atom.charge !== 0 && (
                    <span className="text-xs bg-yellow-500 text-yellow-900 px-1 rounded">
                      {atom.charge > 0 ? '+' : ''}{atom.charge}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  ({atom.x}, {atom.y})
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bonds List */}
        <div className="bg-slate-700/30 rounded-lg p-4">
          <h4 className="text-md font-semibold text-white mb-3">Bonds</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {structure.bonds.map((bond: any, index: number) => (
              <div key={bond.id} className="flex items-center justify-between bg-slate-600/30 rounded p-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-white text-sm">
                      {structure.atoms.find((a: any) => a.id === bond.from)?.element}
                    </span>
                    <span className="text-slate-400">
                      {bond.type === 'single' ? '—' : 
                       bond.type === 'double' ? '=' : 
                       bond.type === 'triple' ? '≡' : 
                       bond.type === 'aromatic' ? ':' : '—'}
                    </span>
                    <span className="text-white text-sm">
                      {structure.atoms.find((a: any) => a.id === bond.to)?.element}
                    </span>
                  </div>
                  <span className="text-xs bg-purple-500 text-purple-100 px-2 py-1 rounded">
                    {bond.type}
                  </span>
                </div>
                {bond.stereo && (
                  <span className="text-xs bg-green-500 text-green-100 px-2 py-1 rounded">
                    {bond.stereo}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderFormula = () => {
    const formula = structure.metadata.formula || 'Unknown';
    
    return (
      <div className="space-y-4">
        <div className="bg-slate-700/30 rounded-lg p-6 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">Molecular Formula</h3>
          <div className="text-4xl font-mono text-blue-400 mb-4">{formula}</div>
          <button
            onClick={() => copyToClipboard(formula, 'formula')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto"
          >
            {copied === 'formula' ? <CheckCircle size={16} /> : <Copy size={16} />}
            {copied === 'formula' ? 'Copied!' : 'Copy Formula'}
          </button>
        </div>
      </div>
    );
  };

  const renderSMILES = () => {
    const smiles = structure.metadata.smiles || 'Unknown';
    
    return (
      <div className="space-y-4">
        <div className="bg-slate-700/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Code size={20} className="text-green-400" />
            SMILES Notation
          </h3>
          <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
            <code className="text-green-400 text-lg font-mono break-all">{smiles}</code>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(smiles, 'smiles')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {copied === 'smiles' ? <CheckCircle size={16} /> : <Copy size={16} />}
              {copied === 'smiles' ? 'Copied!' : 'Copy SMILES'}
            </button>
            <button
              onClick={() => downloadStructure('smi', smiles)}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Download
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderInChI = () => {
    const inchi = structure.metadata.inchi || 'Unknown';
    
    return (
      <div className="space-y-4">
        <div className="bg-slate-700/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <FileText size={20} className="text-purple-400" />
            InChI Identifier
          </h3>
          <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
            <code className="text-purple-400 text-sm font-mono break-all">{inchi}</code>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(inchi, 'inchi')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {copied === 'inchi' ? <CheckCircle size={16} /> : <Copy size={16} />}
              {copied === 'inchi' ? 'Copied!' : 'Copy InChI'}
            </button>
            <button
              onClick={() => downloadStructure('inchi', inchi)}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Download
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Beaker size={24} className="text-blue-400" />
              Chemistry Structure
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={onRegenerate}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                title="Regenerate Structure"
              >
                <RefreshCw size={16} />
                Regenerate
              </button>
              <button
                onClick={onClose}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700/50">
          <div className="flex">
            {[
              { id: 'structure', label: 'Structure', icon: Atom },
              { id: 'formula', label: 'Formula', icon: FileText },
              { id: 'smiles', label: 'SMILES', icon: Code },
              { id: 'inchi', label: 'InChI', icon: Info }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {activeTab === 'structure' && renderStructure()}
          {activeTab === 'formula' && renderFormula()}
          {activeTab === 'smiles' && renderSMILES()}
          {activeTab === 'inchi' && renderInChI()}
        </div>
      </div>
    </div>
  );
};

export default ChemistryStructureViewer;
