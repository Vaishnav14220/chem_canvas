import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, AlertCircle, CheckCircle, Dna, Database, ExternalLink } from 'lucide-react';
import type { MoleculeData } from '../services/pubchemService';
import { searchProteins, getProteinStructure, getAlphaFoldProteinStructure, type ProteinSearchResult } from '../services/proteinService';

interface ProteinSearchProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectProtein?: (moleculeData: MoleculeData) => void;
}

const POPULAR_PROTEINS = [
  'Hemoglobin',
  'Insulin',
  'Myoglobin',
  'Lysozyme',
  'Ferritin',
  'Albumin',
  'Collagen',
  'Actin',
  'Glutamate Dehydrogenase',
  'DNA Polymerase',
];

const extractAtomCountFromSDF = (sdf?: string) => {
  if (!sdf) return null;
  const lines = sdf.split(/\r?\n/);
  if (lines.length < 4) return null;
  const countsSegment = lines[3].slice(0, 3).trim();
  const value = Number.parseInt(countsSegment, 10);
  return Number.isFinite(value) ? value : null;
};

export default function ProteinSearch({
  isOpen = true,
  onClose,
  onSelectProtein,
}: ProteinSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProteinSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ProteinSearchResult | null>(null);
  const [selectedProtein, setSelectedProtein] = useState<MoleculeData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingStructure, setIsLoadingStructure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [pdbInput, setPdbInput] = useState('');
  const hasPrefetchedRef = useRef(false);

  const handleResultSelect = useCallback(async (result: ProteinSearchResult) => {
    setSelectedResult(result);
    setSelectedProtein(null);
    setStructureError(null);
    setIsLoadingStructure(true);

    try {
      let data: MoleculeData | null = null;
      if (result.source === 'alphafold') {
        data = await getAlphaFoldProteinStructure(
          result.uniprotAccession ?? result.pdbId,
          result.pdbUrl,
          result.title,
          result.organism
        );
      } else {
        data = await getProteinStructure(result.pdbId);
      }

      if (!data) {
        setStructureError('This entry could not be converted into a 3D structure for the canvas.');
        return;
      }

      setSelectedProtein({
        ...data,
        name: result.title || data.name,
        displayName:
          result.source === 'alphafold'
            ? `${result.title} (${result.pdbId}, AlphaFold)`
            : `${result.title} (${result.pdbId})`,
      });
    } catch (err) {
      console.error('Failed to load protein structure:', err);
      setStructureError('Unable to load the structure. The file may be too large or unavailable.');
    } finally {
      setIsLoadingStructure(false);
    }
  }, []);

  const handleSearch = useCallback(async (value: string, options?: { autoSelectFirst?: boolean }) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Please enter a protein name or PDB identifier.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setStructureError(null);
    setSelectedResult(null);
    setSelectedProtein(null);

    try {
      const matches = await searchProteins(trimmed, 20);
      setResults(matches);
      if (matches.length === 0) {
        setError(`No proteins found matching "${trimmed}". Try a different keyword or PDB ID.`);
      } else if (options?.autoSelectFirst && matches[0]) {
        await handleResultSelect(matches[0]);
      }
    } catch (err) {
      console.error('Protein search failed:', err);
      setError('Unable to reach the protein search services (RCSB/AlphaFold). Please try again shortly.');
    } finally {
      setIsSearching(false);
    }
  }, [handleResultSelect]);

  useEffect(() => {
    if (!isOpen) {
      hasPrefetchedRef.current = false;
      return;
    }

    if (hasPrefetchedRef.current) {
      return;
    }

    const defaultTerm = POPULAR_PROTEINS[0];
    if (!defaultTerm) {
      return;
    }

    hasPrefetchedRef.current = true;
    setQuery(defaultTerm);
    void handleSearch(defaultTerm, { autoSelectFirst: true });
  }, [isOpen, handleSearch]);

  if (!isOpen) {
    return null;
  }

  const handleFetchById = async () => {
    const trimmed = pdbInput.trim().toUpperCase();
    if (!trimmed) {
      setStructureError('Enter a valid PDB identifier (e.g., 1CRN).');
      return;
    }

    setStructureError(null);
    setSelectedProtein(null);
    setSelectedResult({
      pdbId: trimmed,
      title: trimmed,
      source: 'rcsb',
    });
    setIsLoadingStructure(true);

    try {
      let data = await getProteinStructure(trimmed);
      if (!data) {
        data = await getAlphaFoldProteinStructure(trimmed);
      }
      if (!data) {
        setStructureError(`Could not load structure for identifier ${trimmed}. Try a UniProt or PDB accession.`);
        return;
      }
      setSelectedProtein({
        ...data,
        name: data.displayName || trimmed,
      });
      if (data.source === 'alphafold') {
        setSelectedResult({
          pdbId: trimmed,
          title: data.displayName || trimmed,
          source: 'alphafold',
          pdbUrl: (data as any).pdbUrl,
          organism: (data as any).organism,
        } as ProteinSearchResult);
      }
    } catch (err) {
      console.error('Direct PDB fetch failed:', err);
      setStructureError(`Failed to download a structure for ${trimmed}.`);
    } finally {
      setIsLoadingStructure(false);
    }
  };

  const handleInsert = () => {
    if (selectedProtein && onSelectProtein) {
      onSelectProtein(selectedProtein);
      setSelectedProtein(null);
      setSelectedResult(null);
      setResults([]);
      setQuery('');
      if (onClose) {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative flex h-full max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/60 bg-gradient-to-r from-blue-900/70 to-slate-900/60 px-6 py-4">
          <div className="flex items-center gap-3 text-slate-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-500/15">
              <Dna size={20} className="text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Search Proteins (PDB)</h2>
              <p className="text-xs text-slate-400">Fetch 3D protein structures from the RCSB Protein Data Bank</p>
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

        <div className="grid flex-1 gap-6 overflow-hidden p-6 lg:grid-cols-[360px,1fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
              <div className="flex items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-900 px-4 py-3">
                <Search size={18} className="text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSearch(query);
                    }
                  }}
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  placeholder="Search proteins by name, function, or PDB ID"
                />
                <button
                  type="button"
                  onClick={() => handleSearch(query)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
                  disabled={isSearching}
                >
                  Search
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>Quick picks:</span>
                {POPULAR_PROTEINS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setQuery(name);
                      handleSearch(name);
                    }}
                    className="rounded-full border border-slate-700/60 bg-slate-900/70 px-3 py-1 font-medium text-slate-200 transition-colors hover:border-blue-500/60 hover:bg-blue-500/10 hover:text-blue-200"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Direct PDB Lookup
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pdbInput}
                  onChange={(event) => setPdbInput(event.target.value)}
                  placeholder="Enter PDB ID (e.g., 1CRN)"
                  className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleFetchById}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-emerald-400"
                >
                  Fetch
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/60">
              <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3 text-xs uppercase tracking-wide text-slate-400">
                <span>Matches</span>
                <span className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Database size={14} />
                    RCSB
                  </span>
                  <span></span>
                  <span className="inline-flex items-center gap-1">
                    <Dna size={14} />
                    AlphaFold
                  </span>
                </span>
              </div>

              <div className="h-full max-h-[360px] overflow-y-auto p-3">
                {isSearching && (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/70 p-4 text-sm text-slate-300">
                    <Loader2 size={18} className="animate-spin" />
                    Searching proteins...
                  </div>
                )}

                {!isSearching && error && (
                  <div className="flex items-center gap-3 rounded-lg border border-red-600/50 bg-red-900/30 p-4 text-sm text-red-200">
                    <AlertCircle size={18} />
                    <p>{error}</p>
                  </div>
                )}

                {!isSearching && !error && results.length > 0 && (
                  <div className="space-y-3">
                    {results.map((result) => {
                      const isActive = selectedResult?.pdbId === result.pdbId;
                        return (
                          <button
                            key={result.pdbId}
                            onClick={() => handleResultSelect(result)}
                            className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                              isActive
                                ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                                : 'border-slate-700/60 bg-slate-900/70 text-slate-200 hover:border-slate-500 hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                              <span className="font-semibold text-emerald-300">
                                {result.source === 'alphafold' ? `AlphaFold ${result.pdbId}` : `PDB ${result.pdbId}`}
                              </span>
                              {result.source === 'rcsb' && result.resolution && (
                                <span className="text-slate-400">{result.resolution.toFixed(2)} Å</span>
                              )}
                              {result.source === 'alphafold' && typeof result.confidence === 'number' && (
                                <span className="text-slate-400">pLDDT {result.confidence.toFixed(1)}</span>
                              )}
                            </div>
                            <p className="mt-1 text-sm font-semibold text-white">{result.title}</p>
                            {result.organism && (
                              <p className="mt-1 text-xs text-cyan-300">{result.organism}</p>
                            )}
                          {result.released && (
                            <p className="mt-1 text-[11px] text-slate-500">Released: {new Date(result.released).toLocaleDateString()}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!isSearching && results.length === 0 && !error && (
                  <p className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-400">
                    Search to see matching proteins. Each result includes a downloadable PDB file and ready-to-use 3D structure.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="flex items-center gap-2 text-slate-200">
                <Dna size={18} />
                <h3 className="text-sm font-semibold uppercase tracking-wide">3D Protein Structure</h3>
              </div>

              {isLoadingStructure && (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-300">
                  <Loader2 size={18} className="animate-spin" />
                  Loading protein structure...
                </div>
              )}

              {!isLoadingStructure && structureError && (
                <div className="mt-4 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-900/20 p-3 text-xs text-amber-100">
                  <AlertCircle size={16} className="mt-0.5" />
                  <p>{structureError}</p>
                </div>
              )}

              {!isLoadingStructure && selectedProtein && (
                <div className="mt-4 space-y-4 text-sm text-slate-300">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Protein</p>
                    <p className="text-base font-semibold text-white">
                      {selectedProtein.displayName || selectedProtein.name}
                    </p>
                    {selectedResult?.organism && (
                      <p className="text-xs text-cyan-300">{selectedResult.organism}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-slate-400">PDB ID</p>
                      <p className="font-mono text-cyan-300">{selectedResult?.pdbId ?? pdbInput.toUpperCase()}</p>
                    </div>
                    {selectedResult?.resolution && (
                      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                        <p className="text-slate-400">Resolution</p>
                        <p className="font-mono text-cyan-300">{selectedResult.resolution.toFixed(2)} Å</p>
                      </div>
                    )}
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-slate-400">Source</p>
                      <p className="font-semibold text-emerald-300">
                        {selectedResult?.source === 'alphafold'
                          ? 'AlphaFold (Predicted Model)'
                          : 'RCSB Protein Data Bank'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-slate-400">Atoms</p>
                      <p className="font-mono text-cyan-300">
                        {extractAtomCountFromSDF(selectedProtein.sdf3DData) ?? 'N/A'}
                      </p>
                    </div>
                    {selectedResult?.source === 'alphafold' && typeof selectedResult?.confidence === 'number' && (
                      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                        <p className="text-slate-400">Average pLDDT</p>
                        <p className="font-mono text-cyan-300">{selectedResult.confidence.toFixed(1)}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-xs text-slate-400">
                    <p>The structure is exported as a 3D SDF with inferred bonds suitable for canvas manipulation.</p>
                    <p>
                      View the entry on RCSB for advanced visualization or download the original PDB file:
                    </p>
                    <a
                      href={`https://www.rcsb.org/structure/${selectedResult?.pdbId ?? pdbInput.toUpperCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                    >
                      <ExternalLink size={14} />
                      Open on rcsb.org
                    </a>
                  </div>

                  <button
                    onClick={handleInsert}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400"
                  >
                    <CheckCircle size={18} />
                    Insert protein into canvas
                  </button>
                </div>
              )}

              {!isLoadingStructure && !selectedProtein && !structureError && (
                <p className="mt-6 rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
                  Select a protein entry or fetch by PDB ID to preview the structure and add it to the canvas.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 text-xs text-slate-400">
              <p className="font-semibold uppercase tracking-wide text-slate-300">Tips</p>
              <ul className="mt-2 space-y-1">
                <li> Search by function (“oxygen transport”), protein name (“Hemoglobin”), or PDB ID (“1CRN”).</li>
                <li> Inserted proteins include full atom coordinates with inferred bonds for 3D manipulation.</li>
                <li> Large proteins may take a few seconds to process; consider using specific chains if needed.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



