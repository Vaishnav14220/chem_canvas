import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2, Beaker } from 'lucide-react';
import { fetchStructuredReaction, type StructuredReactionPayload } from '../services/structuredReactionService';
import { reactionSmilesToSVGHuggingFace } from '../services/rdkitService';
import { sanitizeReactionSmilesInput, stripAtomMappings } from '../utils/reactionSanitizer';

export interface ReactionSearchResult {
  payload: StructuredReactionPayload;
  svgData: string;
}

interface InlineReactionSearchProps {
  onSelectReaction?: (result: ReactionSearchResult) => void;
  className?: string;
}

export default function InlineReactionSearch({ onSelectReaction, className = '' }: InlineReactionSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<StructuredReactionPayload | null>(null);
  const [showResult, setShowResult] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  const handleSearchTermChange = useCallback((value: string) => {
    setSearchTerm(value);
    setError(null);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (value.trim().length === 0) {
      setSearchResult(null);
      setShowResult(false);
      return;
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

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setSearchResult(null);

    try {
      const payload = await fetchStructuredReaction(query.trim(), { mode: 'name' });
      
      if (payload) {
        // Immediately insert to canvas without showing preview
        await handleInsertReaction(payload);
      } else {
        setError('No reaction data found');
      }
    } catch (err) {
      console.error('Reaction search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search reaction');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsertReaction = async (payload: StructuredReactionPayload) => {
    if (!payload['reaction smiles']) return;

    setIsLoading(true);
    try {
      const targetSmiles = payload['reaction smiles'];
      const sanitizedForRender = stripAtomMappings(sanitizeReactionSmilesInput(targetSmiles) ?? targetSmiles);
      const svgData = await reactionSmilesToSVGHuggingFace(sanitizedForRender);
      
      if (svgData && onSelectReaction) {
        onSelectReaction({
          payload,
          svgData
        });
        // Clear search after successful insertion
        setSearchTerm('');
        setSearchResult(null);
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

      {error && (
        <div className="mt-2 rounded-lg border border-red-500/50 bg-red-900/20 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="mt-2 rounded-lg border border-purple-500/50 bg-purple-900/20 px-3 py-2 text-sm text-purple-300">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            <span>Fetching reaction data and generating SVG...</span>
          </div>
        </div>
      )}
    </div>
  );
}