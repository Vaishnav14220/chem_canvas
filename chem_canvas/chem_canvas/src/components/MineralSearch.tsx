import { useState } from 'react';
import { Search, X, Loader2, AlertCircle, CheckCircle, Gem, Box, Database, ExternalLink } from 'lucide-react';
import type { MoleculeData } from '../services/pubchemService';
import { searchMinerals, getMineralByCodId, type MineralSearchResult } from '../services/mineralService';
import { captureFeatureEvent } from '../utils/errorLogger';
import { toast } from 'react-toastify';

interface MineralSearchProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectMineral?: (moleculeData: MoleculeData) => void;
}

const COD_DOWNLOAD_BASE = 'https://www.crystallography.net/cod';

const POPULAR_MINERALS = [
  'Quartz',
  'Calcite',
  'Pyrite',
  'Galena',
  'Feldspar',
  'Halite',
  'Olivine',
  'Magnetite',
  'Dolomite',
];

const formatSpaceGroup = (spaceGroup?: string, hallSymbol?: string) => {
  if (spaceGroup && hallSymbol) {
    return `${spaceGroup} · ${hallSymbol}`;
  }
  return spaceGroup || hallSymbol || 'Unknown';
};

const extractAtomCount = (sdf?: string): number | null => {
  if (!sdf) {
    return null;
  }

  const lines = sdf.split(/\r?\n/);
  if (lines.length < 4) {
    return null;
  }

  const countsLine = lines[3];
  if (!countsLine || countsLine.length < 6) {
    return null;
  }

  const atomSegment = countsLine.slice(0, 3).trim();
  const parsed = Number.parseInt(atomSegment, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function MineralSearch({
  isOpen = true,
  onClose,
  onSelectMineral,
}: MineralSearchProps) {
  const [query, setQuery] = useState('');
  const [codIdInput, setCodIdInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [results, setResults] = useState<MineralSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<MineralSearchResult | null>(null);
  const [selectedMineral, setSelectedMineral] = useState<MoleculeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  if (!isOpen) {
    return null;
  }

  const handleSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setError('Please enter a mineral name or formula.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setStructureError(null);
    setSelectedResult(null);
    setSelectedMineral(null);

    try {
      const matches = await searchMinerals(trimmed, 20);
      setResults(matches);
      if (matches.length === 0) {
        setError(`No COD entries found for "${trimmed}".`);
      } else {
        if (!searchHistory.includes(trimmed)) {
          setSearchHistory((prev) => [trimmed, ...prev].slice(0, 6));
        }
      }
    } catch (err) {
      console.error('Mineral search failed:', err);
      setError('Failed to search the Crystallography Open Database. Try again later.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultSelect = async (result: MineralSearchResult) => {
    setSelectedResult(result);
    setSelectedMineral(null);
    setStructureError(null);
    setIsLoadingStructure(true);

    try {
      const data = await getMineralByCodId(result.codId);
      if (!data) {
        setStructureError('This entry is missing 3D coordinates or could not be parsed.');
        return;
      }
      setSelectedMineral(data);
    } catch (err) {
      console.error('Failed to load mineral structure:', err);
      setStructureError('Unable to load structure for this COD entry.');
    } finally {
      setIsLoadingStructure(false);
    }
  };

  const handleFetchByCodId = async () => {
    const trimmed = codIdInput.trim();
    if (!trimmed) {
      setStructureError('Enter a COD ID to fetch the structure.');
      return;
    }

    setSelectedResult({
      codId: trimmed,
      mineralName: `COD ${trimmed}`,
      formula: '',
    });
    setSelectedMineral(null);
    setStructureError(null);
    setIsLoadingStructure(true);

    try {
      const data = await getMineralByCodId(trimmed);
      if (!data) {
        setStructureError(`Could not load structure for COD ${trimmed}.`);
        return;
      }
      setSelectedMineral(data);
      if (!searchHistory.includes(trimmed)) {
        setSearchHistory((prev) => [trimmed, ...prev].slice(0, 6));
      }
    } catch (err) {
      console.error('Failed to fetch COD entry:', err);
      setStructureError('Unable to retrieve this COD entry.');
    } finally {
      setIsLoadingStructure(false);
    }
  };

  const handleInsert = async () => {
    if (selectedMineral && onSelectMineral) {
      // Show loading toast
      const toastId = toast.loading(`Adding ${selectedMineral.name || 'mineral'} to canvas...`, {
        position: "top-right",
        theme: "light",
      });
      
      onSelectMineral(selectedMineral);
      
      // Update toast to success
      toast.update(toastId, {
        render: `✓ ${selectedMineral.name || 'Mineral'} added successfully!`,
        type: "success",
        isLoading: false,
        autoClose: 3000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      void captureFeatureEvent('mineral_search', 'select', {
        name: selectedMineral.name,
        codId: selectedMineral.codId ?? selectedResult?.codId ?? null
      });
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch(query);
    }
  };

  const handleCodKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleFetchByCodId();
    }
  };

  const selectedCodId = selectedResult?.codId || selectedMineral?.codId;
  const atomCount = extractAtomCount(selectedMineral?.sdf3DData ?? selectedMineral?.sdfData);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4">
          <div className="flex items-center gap-3 text-white">
            <Gem size={24} />
            <div>
              <h2 className="text-xl font-semibold">Search Minerals (COD 3D)</h2>
              <p className="text-xs text-white/80">Pull crystalline minerals from the Crystallography Open Database</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/90 transition hover:bg-white/20"
              title="Close mineral search"
            >
              <X size={22} />
            </button>
          )}
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-semibold uppercase tracking-wide text-slate-300">Mineral name or formula</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="e.g., Quartz, SiO2, Pyrite, Magnetite"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  onClick={() => handleSearch(query)}
                  disabled={isSearching}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                >
                  {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  {isSearching ? 'Searching' : 'Search'}
                </button>
              </div>
            </div>

            {POPULAR_MINERALS.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Popular queries</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_MINERALS.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setQuery(item);
                        void handleSearch(item);
                      }}
                      className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searchHistory.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent searches</p>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setQuery(term);
                        void handleSearch(term);
                      }}
                      className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="flex gap-3 rounded-lg border border-red-500/40 bg-red-900/30 p-4 text-sm text-red-200">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Direct COD lookup</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codIdInput}
                  onChange={(event) => setCodIdInput(event.target.value)}
                  onKeyDown={handleCodKeyPress}
                  placeholder="Enter COD ID (e.g., 9011987)"
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  onClick={handleFetchByCodId}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
                >
                  Fetch
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Results</p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {results.map((result) => {
                  const isActive = selectedResult?.codId === result.codId;
                  return (
                    <button
                      key={result.codId}
                      onClick={() => handleResultSelect(result)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        isActive
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                          : 'border-slate-700 bg-slate-800/60 text-slate-200 hover:border-cyan-500/60 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Database size={14} />
                          COD {result.codId}
                        </span>
                        {result.spaceGroup && (
                          <span className="text-[11px] text-slate-500">{formatSpaceGroup(result.spaceGroup, result.hallSymbol)}</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">{result.mineralName}</p>
                      {result.formula && (
                        <p className="mt-1 text-xs text-cyan-300">{result.formula}</p>
                      )}
                    </button>
                  );
                })}

                {!isSearching && results.length === 0 && !error && (
                  <p className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-400">
                    Search to see matching COD entries. Each result includes a downloadable CIF and ready-to-use 3D structure.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="flex items-center gap-2 text-slate-200">
                <Box size={18} />
                <h3 className="text-sm font-semibold uppercase tracking-wide">3D Structure</h3>
              </div>

              {isLoadingStructure && (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-300">
                  <Loader2 size={18} className="animate-spin" />
                  Loading structure...
                </div>
              )}

              {!isLoadingStructure && structureError && (
                <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-900/20 p-3 text-xs text-amber-100">
                  <AlertCircle size={16} className="mt-0.5" />
                  <p>{structureError}</p>
                </div>
              )}

              {!isLoadingStructure && selectedMineral && (
                <div className="mt-4 space-y-4 text-sm text-slate-300">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Mineral</p>
                    <p className="text-base font-semibold text-white">{selectedMineral.displayName || selectedMineral.name}</p>
                    {selectedMineral.molecularFormula && (
                      <p className="text-xs text-cyan-300">{selectedMineral.molecularFormula}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-slate-400">COD ID</p>
                      <p className="font-mono text-cyan-300">{selectedCodId}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-slate-400">Atoms in cell</p>
                      <p className="font-mono text-cyan-300">{atomCount ?? 'N/A'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-slate-400">Source</p>
                      <p className="font-semibold text-emerald-300">Crystallography Open Database</p>
                    </div>
                    {selectedMineral.molecularWeight > 0 && (
                      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                        <p className="text-slate-400">Formula weight</p>
                        <p className="font-mono text-cyan-300">{selectedMineral.molecularWeight.toFixed(2)} g/mol</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-xs text-slate-400">
                    <p>This structure is exported as a 3D SDF and ready to insert into the canvas. Bonds are inferred from fractional coordinates for quick visualization.</p>
                    <p>
                      Need the original CIF? Download the source file directly from COD:
                    </p>
                    <a
                      href={`${COD_DOWNLOAD_BASE}/${encodeURIComponent(selectedCodId ?? '')}.cif`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
                    >
                      <ExternalLink size={14} />
                      Open CIF in new tab
                    </a>
                  </div>

                  <button
                    onClick={handleInsert}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400"
                  >
                    <CheckCircle size={18} />
                    Insert mineral into canvas
                  </button>
                </div>
              )}

              {!isLoadingStructure && !selectedMineral && !structureError && (
                <p className="mt-6 rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
                  Select a COD entry to load its 3D structure. We will center the coordinates and infer bonds so you can place the crystal directly on the canvas.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-xs text-slate-400">
              <p className="font-semibold uppercase tracking-wide text-slate-300">Tips</p>
              <ul className="mt-2 space-y-1">
                <li>• Use mineral names, chemical formulas, or COD IDs.</li>
                <li>• Inserted minerals include 3D coordinates for instant orbit mode.</li>
                <li>• Download original CIF files for further crystallographic analysis.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
