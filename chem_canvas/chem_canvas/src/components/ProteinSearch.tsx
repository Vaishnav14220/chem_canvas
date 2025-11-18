import { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2, AlertCircle, CheckCircle, Layers3, Atom, Database, ExternalLink } from 'lucide-react';
import {
  type PDBProteinData,
  searchPDBProteins,
  getPDBViewerUrl,
  getPDBEntryUrl,
} from '../services/pdbService';
import { captureFeatureEvent } from '../utils/errorLogger';

interface ProteinSearchProps {
  onSelectProtein?: (proteinData: PDBProteinData) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const QUICK_PROTEIN_QUERIES: Array<{ label: string; query: string }> = [
  { label: 'All proteins', query: 'protein' },
  { label: 'Enzyme', query: 'enzyme' },
  { label: 'Antibody', query: 'antibody' },
  { label: 'Hormone', query: 'hormone' },
  { label: 'Receptor', query: 'receptor' },
  { label: 'Cytokine', query: 'cytokine' },
  { label: 'Hemoglobin', query: 'hemoglobin' },
  { label: 'Insulin', query: 'insulin' },
  { label: 'Myosin', query: 'myosin' },
  { label: 'Collagen', query: 'collagen' },
];

export default function ProteinSearch({
  onSelectProtein,
  isOpen = true,
  onClose,
}: ProteinSearchProps) {
  const [searchTerm, setSearchTerm] = useState('protein');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PDBProteinData[]>([]);
  const [selectedProtein, setSelectedProtein] = useState<PDBProteinData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (queryOverride?: string) => {
    const term = (queryOverride ?? searchTerm).trim();
    if (!term) {
      setError('Please enter a protein query (e.g., "insulin", "hemoglobin").');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSelectedProtein(null);

    try {
      const searchResults = await searchPDBProteins(term);
      setResults(searchResults);
      if (searchResults.length === 0) {
        setError('No proteins found matching your query.');
      }
    } catch (err) {
      console.error('Protein search failed:', err);
      setError('Failed to search for proteins. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  const handleSelectProtein = useCallback((protein: PDBProteinData) => {
    setSelectedProtein(protein);
    if (onSelectProtein) {
      onSelectProtein(protein);
    }
    void captureFeatureEvent('protein_search', 'select', {
      pdbId: (protein as any).id ?? protein.entryId,
      title: protein.title
    });
  }, [onSelectProtein]);

  const handleClose = useCallback(() => {
    setSearchTerm('protein[Title]');
    setResults([]);
    setSelectedProtein(null);
    setError(null);
    setHasSearched(false);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen && !hasSearched) {
      handleSearch();
    }
  }, [isOpen, hasSearched, handleSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center">
                <Atom className="text-rose-400" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Protein Search</h2>
                <p className="text-sm text-slate-400">Search and add protein structures to your canvas</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white transition-colors flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search Section */}
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  placeholder="Search for proteins (e.g., 'insulin', 'hemoglobin')"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-400 focus:border-rose-400 focus:outline-none transition-colors"
                />
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={isLoading}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-600/50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                Search
              </button>
            </div>

            {/* Quick Search Buttons */}
            <div className="flex flex-wrap gap-2">
              {QUICK_PROTEIN_QUERIES.map((query) => (
                <button
                  key={query.label}
                  onClick={() => {
                    setSearchTerm(query.query);
                    handleSearch(query.query);
                  }}
                  className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg text-sm transition-colors border border-slate-600/30"
                >
                  {query.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results Section */}
          <div className="max-h-96 overflow-y-auto">
            {error && (
              <div className="p-6">
                <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-600/30 rounded-lg">
                  <AlertCircle className="text-red-400" size={20} />
                  <p className="text-red-300">{error}</p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="p-6 text-center">
                <Loader2 size={24} className="animate-spin text-rose-400 mx-auto mb-2" />
                <p className="text-slate-400">Searching for proteins...</p>
              </div>
            )}

            {!isLoading && !error && results.length > 0 && (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.map((protein) => (
                    <div
                      key={protein.entryId}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        selectedProtein?.entryId === protein.entryId
                          ? 'bg-rose-900/30 border-rose-400'
                          : 'bg-slate-700/30 border-slate-600/30 hover:bg-slate-600/30'
                      }`}
                      onClick={() => handleSelectProtein(protein)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-sm mb-1">
                            {protein.displayName || `PDB ${protein.entryId}`}
                          </h3>
                          <p className="text-xs text-slate-400 mb-2">{protein.title}</p>
                          {protein.organism && (
                            <p className="text-xs text-slate-500 mb-1">Organism: {protein.organism}</p>
                          )}
                          {protein.resolution && (
                            <p className="text-xs text-slate-500 mb-1">Resolution: {protein.resolution}Å</p>
                          )}
                          <p className="text-xs text-slate-500">Method: {protein.method}</p>
                        </div>
                        {selectedProtein?.entryId === protein.entryId && (
                          <CheckCircle className="text-rose-400" size={16} />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProtein(protein);
                            handleClose();
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-emerald-600/60 hover:bg-emerald-500/60 text-white rounded text-xs transition-colors"
                        >
                          <Layers3 size={12} />
                          Load 3D on Canvas
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(getPDBEntryUrl(protein.entryId), '_blank');
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-600/50 hover:bg-slate-500/50 text-slate-300 hover:text-white rounded text-xs transition-colors"
                        >
                          <Database size={12} />
                          PDB Entry
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(getPDBViewerUrl(protein.entryId), '_blank');
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-slate-600/50 hover:bg-slate-500/50 text-slate-300 hover:text-white rounded text-xs transition-colors"
                        >
                          <ExternalLink size={12} />
                          RCSB Viewer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isLoading && !error && hasSearched && results.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-slate-400">No proteins found. Try a different search term.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedProtein && (
            <div className="p-6 border-t border-slate-700/50 bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="text-green-400" size={20} />
                  <span className="text-white font-medium">
                    Selected: {selectedProtein.displayName || `PDB ${selectedProtein.entryId}`}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedProtein) {
                        handleSelectProtein(selectedProtein);
                        handleClose();
                      }
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium transition-colors"
                  >
                    Add to Canvas
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
