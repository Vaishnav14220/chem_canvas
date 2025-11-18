// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { fetchStructuredReaction, type StructuredReactionPayload } from '../services/structuredReactionService';
import { reactionSmilesToSVGHuggingFace } from '../services/rdkitService';
import { sanitizeReactionSmilesInput, stripAtomMappings } from '../utils/reactionSanitizer';
import { captureFeatureEvent } from '../utils/errorLogger';

export interface ReactionSearchResult {
  payload: StructuredReactionPayload;
  svgData: string;
}

interface InlineReactionSearchProps {
  onSelectReaction?: (result: ReactionSearchResult) => void;
  className?: string;
}

const STATUS_MESSAGES = [
  'fetching reaction data…',
  'reactants resolved — preparing mechanism…',
  'rendering SVG preview…'
] as const;

export default function InlineReactionSearch({ onSelectReaction, className = '' }: InlineReactionSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusIndex, setStatusIndex] = useState<number>(-1);
  const [showResult, setShowResult] = useState(false);
  const [reactionSummary, setReactionSummary] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  const handleSearchTermChange = useCallback((value: string) => {
    setSearchTerm(value);
    setError(null);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (value.trim().length === 0) {
      setShowResult(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (componentRef.current && !componentRef.current.contains(event.target as Node)) {
        setShowResult(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const summarizeReactants = (payload: StructuredReactionPayload) => {
    const namesList =
      payload['reactant names'] ||
      payload.reactants ||
      payload['reactantsmiles'] ||
      payload['reactants'];
    if (Array.isArray(namesList) && namesList.length > 0) {
      const names = namesList
        .map((item) => (typeof item === 'string' ? item : item.name))
        .filter(Boolean);
      if (names.length) {
        return `Reactants: ${names.join(', ')}`;
      }
    }
    if (typeof namesList === 'string' && namesList.trim().length > 0) {
      return `Reactants: ${namesList}`;
    }
    if (payload['reaction smiles']) {
      return `SMILES: ${payload['reaction smiles'].replace(/\s+/g, ' ').slice(0, 80)}`;
    }
    return null;
  };

  const handleInsertReaction = async (payload: StructuredReactionPayload) => {
    if (!payload['reaction smiles']) return;

    setIsLoading(true);
    setStatusIndex(2);
    setReactionSummary(summarizeReactants(payload));

    try {
      const targetSmiles = payload['reaction smiles'];
      const sanitizedForRender = stripAtomMappings(sanitizeReactionSmilesInput(targetSmiles) ?? targetSmiles);
      const svgData = await reactionSmilesToSVGHuggingFace(sanitizedForRender);

      if (svgData && onSelectReaction) {
        onSelectReaction({ payload, svgData });
        void captureFeatureEvent('reaction_search', 'select', {
          query: searchTerm.trim(),
          reactionSmiles: targetSmiles
        });
        setSearchTerm('');
        setShowResult(false);
        setError(null);
      } else {
        setError('Failed to generate reaction SVG');
      }
    } catch (err) {
      console.error('Error generating reaction SVG:', err);
      setError('Failed to generate reaction SVG');
    } finally {
      setIsLoading(false);
      setStatusIndex(-1);
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setStatusIndex(0);
    setReactionSummary(null);
    setError(null);
    setShowResult(true);

    try {
      const payload = await fetchStructuredReaction(query.trim(), { mode: 'name' });
      setStatusIndex(1);

      if (payload) {
        await handleInsertReaction(payload);
      } else {
        setError('No reaction data found');
      }
    } catch (err) {
      console.error('Reaction search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search reaction');
    } finally {
      setIsLoading(false);
      setStatusIndex(-1);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      performSearch(searchTerm.trim());
    }
  };

  return (
    <div ref={componentRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/80 px-4 py-2 text-slate-100 shadow-inner transition-all duration-200 focus-within:border-purple-400 focus-within:shadow-lg">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchTermChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search reactions (e.g., Aldol, Diels-Alder)..."
          className="flex-1 bg-transparent text-sm placeholder-slate-500 focus:outline-none"
          disabled={isLoading}
        />
        <button
          onClick={() => performSearch(searchTerm)}
          disabled={isLoading || !searchTerm.trim()}
          className="text-slate-400 transition hover:text-purple-400 disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
      </div>

      {isLoading && (
        <div className="mt-3 reaction-status-card">
          <p className="reaction-status-label">Searching for reaction… please wait.</p>
          {statusIndex >= 0 && <p className="reaction-status-msg">{STATUS_MESSAGES[statusIndex]}</p>}
          {reactionSummary && <p className="reaction-status-detail">{reactionSummary}</p>}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg border border-red-500/50 bg-red-900/20 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
