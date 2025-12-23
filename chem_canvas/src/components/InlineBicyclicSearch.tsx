import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2, Database } from 'lucide-react';
import {
  searchBicyclicCompounds,
  DEFAULT_BICYCLIC_QUERY,
  type MoleculeData,
} from '../services/pubchemService';

interface InlineBicyclicSearchProps {
  onSelectMolecule?: (molecule: MoleculeData) => void;
  className?: string;
}

const COMMON_BICYCLIC_QUERIES: Array<{ label: string; term: string }> = [
  { label: 'Trans-Decalin', term: '"trans-decalin"' },
  { label: 'Cis-Decalin', term: '"cis-decalin"' },
  { label: 'Bicyclo[3.3.1]nonane', term: '"Bicyclo[3.3.1]nonane"' },
  { label: 'Bicyclo[4.4.0]decane', term: '"Bicyclo[4.4.0]decane"' },
];

export default function InlineBicyclicSearch({
  onSelectMolecule,
  className = '',
}: InlineBicyclicSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MoleculeData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (termOverride?: string, options?: { autoOpen?: boolean }) => {
    const term = termOverride ?? searchTerm;
    const trimmed = term.trim();
    const query = trimmed.length > 0 ? trimmed : DEFAULT_BICYCLIC_QUERY;

    setIsLoading(true);
    setError(null);

    try {
      const molecules = await searchBicyclicCompounds(query, 12);
  setResults(molecules);
  setShowResults(options?.autoOpen ?? true);
      if (molecules.length === 0) {
        setError('No bicyclic chair conformers found for this query. Try another name.');
      }
    } catch (err) {
      console.error('Bicyclic compound search failed:', err);
      setError('Unable to search bicyclic compounds right now.');
      setResults([]);
      setShowResults(false);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  const handleSubmit = useCallback(async () => {
    await runSearch(undefined, { autoOpen: true });
  }, [runSearch]);

  const handleSelect = useCallback((molecule: MoleculeData) => {
    if (onSelectMolecule) {
      onSelectMolecule(molecule);
    }
    setShowResults(false);
    setResults([]);
    setSearchTerm('');
  }, [onSelectMolecule]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Prefetch curated dataset so the dropdown is ready for quick insertion.
    void runSearch(DEFAULT_BICYCLIC_QUERY, { autoOpen: false });
  }, [runSearch]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-slate-100 shadow-inner transition-all duration-200 focus-within:border-cyan-400 focus-within:shadow-lg">
        <div className="text-slate-400">
          {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="Bicyclic dataset..."
          className="flex-1 bg-transparent text-sm placeholder-slate-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600/80 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-500/80 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
          title="Search bicyclic chair conformers"
        >
          <Database size={13} />
          Search
        </button>
      </div>

      {showResults && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-600/70 bg-slate-900/95 p-3 shadow-2xl">
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-slate-400">
            {COMMON_BICYCLIC_QUERIES.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  void runSearch(item.term, { autoOpen: true });
                }}
                className="rounded-full border border-slate-600 px-2 py-0.5 text-[11px] uppercase tracking-wide transition-colors hover:border-cyan-500 hover:text-cyan-300"
              >
                {item.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {results.length > 0 && (
            <ul className="flex flex-col gap-2">
              {results.map((molecule) => {
                const formulaLine = molecule.molecularFormula ? `Formula: ${molecule.molecularFormula}` : null;
                return (
                  <li key={molecule.cid}>
                    <button
                      type="button"
                      onClick={() => handleSelect(molecule)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-600/80 bg-slate-800/60 px-3 py-2 text-left transition-colors hover:border-cyan-500 hover:bg-slate-700/60"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-100">{molecule.displayName || molecule.name}</p>
                        {formulaLine && (
                          <p className="text-[11px] font-mono uppercase tracking-wide text-slate-400">{formulaLine}</p>
                        )}
                      </div>
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">CID {molecule.cid}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
