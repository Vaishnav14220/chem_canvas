import { useState, useEffect, useCallback } from 'react';
import { Search, X, Loader2, AlertCircle, CheckCircle, Eye, FlaskConical, Filter } from 'lucide-react';
import {
  type MoleculeData,
  searchReagentMolecules,
  get2DStructureUrl,
  getMolViewUrl,
  DEFAULT_REAGENT_QUERY,
} from '../services/pubchemService';

interface ReagentSearchProps {
  onSelectReagent?: (moleculeData: MoleculeData) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const QUICK_REAGENT_QUERIES: Array<{ label: string; query: string }> = [
  { label: 'All reagents', query: DEFAULT_REAGENT_QUERY },
  { label: 'Laboratory reagent', query: 'laboratory reagent[Title]' },
  { label: 'Analytical reagent', query: 'analytical reagent' },
  { label: 'Oxidizing reagent', query: 'oxidizing reagent' },
  { label: 'Reducing reagent', query: 'reducing reagent' },
  { label: 'Catalyst reagent', query: 'catalyst[Role]' },
  { label: 'CHEBI 132865', query: 'CHEBI:132865[ChEBI]' },
  { label: 'CHEBI 33893', query: 'CHEBI:33893[ChEBI]' },
];

export default function ReagentSearch({
  onSelectReagent,
  isOpen = true,
  onClose,
}: ReagentSearchProps) {
  const [searchTerm, setSearchTerm] = useState(DEFAULT_REAGENT_QUERY);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MoleculeData[]>([]);
  const [selectedReagent, setSelectedReagent] = useState<MoleculeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (queryOverride?: string) => {
    const term = (queryOverride ?? searchTerm).trim();
    if (!term) {
      setError('Please enter a reagent query (e.g., "reagent[Chemical Role]").');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSelectedReagent(null);

    try {
      const molecules = await searchReagentMolecules(term, 18);
      const sorted = [...molecules].sort((a, b) => {
        const aHas3D = Boolean(a.sdf3DData && a.sdf3DData.trim().length > 0);
        const bHas3D = Boolean(b.sdf3DData && b.sdf3DData.trim().length > 0);
        if (aHas3D === bHas3D) {
          return (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '');
        }
        return bHas3D ? 1 : -1;
      });
      setResults(sorted);
      if (sorted.length > 0) {
        setSelectedReagent(sorted[0]);
      }
      if (sorted.length === 0) {
        setError('No reagents found for this query. Try a different term or ChEBI identifier.');
      }
    } catch (searchError) {
      console.error('Reagent search error:', searchError);
      setError('Failed to search reagent molecules. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  const handleQuickQuery = (query: string) => {
    setSearchTerm(query);
    void handleSearch(query);
  };

  const handleInsertReagent = () => {
    if (!selectedReagent || !onSelectReagent) {
      return;
    }
    onSelectReagent({
      ...selectedReagent,
      role: 'reagent',
    });
    if (onClose) {
      onClose();
    }
  };

  const handleView3D = () => {
    if (!selectedReagent?.cid) return;
    const url = getMolViewUrl(selectedReagent.cid);
    window.open(url, '_blank');
  };

  useEffect(() => {
    if (!isOpen || hasSearched || isLoading) {
      return;
    }
    void handleSearch(searchTerm);
  }, [isOpen, hasSearched, isLoading, handleSearch, searchTerm]);

  const renderResultsList = () => {
    if (results.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-slate-700/60 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          <FlaskConical size={28} className="text-slate-500" />
          <p>{hasSearched ? 'No reagents found. Adjust your search query or try a different ChEBI term.' : 'Run a search to see reagent matches from PubChem.'}</p>
        </div>
      );
    }

    return (
      <div className="grid max-h-80 gap-2 overflow-y-auto pr-1">
        {results.map((result) => {
          const isActive = selectedReagent?.cid === result.cid;
          const primaryName = result.displayName || result.name || `CID ${result.cid}`;
          const canonicalName = result.name && result.name !== primaryName ? result.name : null;
          const formulaLine = result.molecularFormula ? `Formula: ${result.molecularFormula}` : null;
          const has3D = Boolean(result.sdf3DData && result.sdf3DData.trim().length > 0);
          return (
            <button
              key={result.cid}
              onClick={() => setSelectedReagent(result)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                isActive
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                  : 'border-slate-700/60 bg-slate-900/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{primaryName}</span>
                {canonicalName && (
                  <span className="text-xs text-slate-400">{canonicalName}</span>
                )}
                {formulaLine && (
                  <span className="text-[11px] font-mono uppercase tracking-wide text-slate-500">
                    {formulaLine}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  CID {result.cid}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    has3D
                      ? 'border border-emerald-500/60 bg-emerald-500/15 text-emerald-200'
                      : 'border border-slate-700/60 bg-slate-800/80 text-slate-400'
                  }`}
                >
                  {has3D ? '3D Ready' : '2D Only'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-900/80 px-6 py-4">
          <div className="flex items-center gap-3 text-slate-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/15">
              <FlaskConical size={20} className="text-cyan-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Reagent Library</h2>
              <p className="text-xs text-slate-400">Search PubChem reagents via NCBI E-Utilities</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700/60 bg-slate-800/80 p-2 text-slate-300 transition-colors hover:bg-slate-700/60"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-hidden p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleSearch();
                  }
                }}
                placeholder='e.g., "reagent[Chemical Role]" or "CHEBI:132865[ChEBI]"'
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleSearch()}
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Search
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Filter size={16} />
              <span>Quick filters:</span>
              {QUICK_REAGENT_QUERIES.slice(0, 3).map((option) => (
                <button
                  key={option.query}
                  type="button"
                  onClick={() => handleQuickQuery(option.query)}
                  className="rounded-full border border-slate-700/60 bg-slate-900/70 px-3 py-1 font-medium text-slate-200 transition-colors hover:border-cyan-500/60 hover:bg-cyan-500/10 hover:text-cyan-200"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Reagent Roles
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_REAGENT_QUERIES.map((option) => (
                    <button
                      key={option.query}
                      type="button"
                      onClick={() => handleQuickQuery(option.query)}
                      className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-300 transition-colors hover:border-cyan-500/60 hover:bg-cyan-500/10 hover:text-cyan-200"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Matches
                </p>
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                    <Loader2 size={16} className="animate-spin" />
                    Fetching reagents...
                  </div>
                ) : (
                  renderResultsList()
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {error && (
                <div className="flex gap-3 rounded-lg border border-red-600/50 bg-red-900/30 p-4 text-sm text-red-200">
                  <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {selectedReagent ? (
                <div className="space-y-4 rounded-xl border border-slate-700/60 bg-slate-900/70 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {selectedReagent.displayName || selectedReagent.name || `CID ${selectedReagent.cid}`}
                      </h3>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400">Molecular Formula</p>
                          <p className="text-cyan-300 font-mono">
                            {selectedReagent.molecularFormula}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Molecular Weight</p>
                          <p className="text-cyan-300 font-mono">
                            {selectedReagent.molecularWeight.toFixed(2)} g/mol
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-slate-400">SMILES</p>
                          <p className="text-cyan-300 font-mono break-all text-xs">
                            {selectedReagent.smiles}
                          </p>
                        </div>
                        {selectedReagent.sourceQuery && (
                          <div className="col-span-2">
                            <p className="text-slate-400">Source Query</p>
                            <p className="text-slate-300 text-xs">
                              {selectedReagent.sourceQuery}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleView3D}
                      className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
                    >
                      <Eye size={16} className="inline mr-2" />
                      View 3D
                    </button>
                  </div>

                  <div className="rounded-lg border border-slate-700/60 bg-slate-900/80 p-3">
                    <p className="text-sm font-semibold text-slate-300 mb-2">
                      2D Structure
                    </p>
                    {selectedReagent.svgData ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: selectedReagent.svgData }}
                        className="flex max-h-[280px] justify-center overflow-auto rounded border border-slate-700/60 bg-white p-3"
                      />
                    ) : (
                      <img
                        src={get2DStructureUrl(selectedReagent.cid, 400)}
                        alt={selectedReagent.displayName || selectedReagent.name || `CID ${selectedReagent.cid}`}
                        className="max-h-[280px] w-full rounded border border-slate-700/60 bg-white p-3 object-contain"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleInsertReagent}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:from-emerald-500 hover:to-green-500"
                    >
                      <CheckCircle size={18} />
                      Add to Canvas
                    </button>
                  </div>
                </div>
              ) : (
                !error && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/70 p-6 text-center text-sm text-slate-400">
                    <FlaskConical size={32} className="text-slate-500" />
                    <p>
                      Select a reagent from the matches to preview structure details and insert it
                      into the canvas.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300 uppercase tracking-wide">
              Query Tips
            </p>
            <p>
              • Use <span className="text-cyan-300">[Chemical Role]</span> or{' '}
              <span className="text-cyan-300">[Title]</span> qualifiers to find compounds annotated
              as reagents.
            </p>
            <p>
              • ChEBI identifiers like <span className="text-cyan-300">CHEBI:132865</span> return
              laboratory reagents and related sub-classes.
            </p>
            <p>
              • PubChem E-Utilities searches the entire compound database—refine results by adding
              keywords such as <em className="text-slate-300">"oxidizing"</em>,{' '}
              <em className="text-slate-300">"reducing"</em>, or <em className="text-slate-300">"catalyst"</em>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
