import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2, FlaskConical, Database } from 'lucide-react';

interface InlineReactionSearchProps {
  onSelectReaction?: (reactionData: any) => void;
  className?: string;
}

interface ReactionSuggestion {
  name: string;
  smiles: string;
  description?: string;
}

// Common reaction database - could be expanded or moved to a service
const COMMON_REACTIONS: ReactionSuggestion[] = [
  {
    name: 'Esterification',
    smiles: 'CC(=O)O.CCO>>CC(=O)OCC.CC(=O)O',
    description: 'Acetic acid + Ethanol → Ethyl acetate + Water'
  },
  {
    name: 'Aldol Condensation',
    smiles: 'CC(=O)C=O.CC(=O)C=O>>CC(=O)C(O)(C=C(C=O)C)C=O',
    description: 'Acetaldehyde self-condensation'
  },
  {
    name: 'Grignard Reaction',
    smiles: 'CCBr.[Mg]>>CC[Mg]Br',
    description: 'Alkyl halide + Magnesium → Grignard reagent'
  },
  {
    name: 'SN2 Reaction',
    smiles: 'CCBr.CC[O-]>>CCO.CCBr',
    description: 'Methyl bromide + Ethoxide → Methanol + Ethylene'
  },
  {
    name: 'Diels-Alder',
    smiles: 'C=CC=C.C=C[C@@H]1CCC=C1>>C1CCC2C=CC1C2',
    description: 'Cyclohexadiene + Ethylene → Cyclohexene'
  },
  {
    name: 'Friedel-Crafts',
    smiles: 'c1ccccc1.CC(Cl)=O>>c1ccccc1C(C)=O',
    description: 'Benzene + Acetyl chloride → Acetophenone'
  },
  {
    name: 'Wittig Reaction',
    smiles: 'CC=O.CCP(C1CCCCC1)(C2CCCCC2)=O>>CC=C.CCP(C1CCCCC1)(C2CCCCC2)O',
    description: 'Aldehyde + Phosphonium ylide → Alkene'
  },
  {
    name: 'Hydrolysis',
    smiles: 'CC(=O)OC>>CC(=O)O.O',
    description: 'Ester hydrolysis'
  }
];

export default function InlineReactionSearch({ onSelectReaction, className = '' }: InlineReactionSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ReactionSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [includeSDF, setIncludeSDF] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  const handleSearchTermChange = useCallback((value: string) => {
    setSearchTerm(value);

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Clear previous suggestions and errors
    if (value.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Show suggestions for queries with at least 1 character
    if (value.trim().length >= 1) {
      setShowSuggestions(true);

      // Filter common reactions by name or check if it's a SMILES string
      const filteredSuggestions = COMMON_REACTIONS.filter(reaction =>
        reaction.name.toLowerCase().includes(value.toLowerCase()) ||
        reaction.smiles.toLowerCase().includes(value.toLowerCase()) ||
        (reaction.description && reaction.description.toLowerCase().includes(value.toLowerCase()))
      );

      // If input looks like a SMILES string (contains >> or chemical elements), treat it as direct SMILES
      const looksLikeSMILES = /[A-Za-z0-9\[\]\(\)=\-\+\.#]/g.test(value) && (value.includes('>>') || /[A-Z][a-z]?/.test(value));

      if (looksLikeSMILES && !filteredSuggestions.some(r => r.smiles === value.trim())) {
        // Add the direct SMILES input as a suggestion
        filteredSuggestions.unshift({
          name: 'Custom SMILES',
          smiles: value.trim(),
          description: 'Direct SMILES input'
        });
      }

      setSuggestions(filteredSuggestions.slice(0, 8)); // Limit to 8 suggestions
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (componentRef.current && !componentRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSuggestionClick = async (suggestion: ReactionSuggestion) => {
    setSearchTerm(suggestion.name);
    setSuggestions([]);
    setShowSuggestions(false);

    // Generate reaction and insert to canvas
    setIsLoading(true);

    try {
      // RDKit visualization removed - using placeholder
      const placeholderSvg = `<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="40%" text-anchor="middle" font-family="monospace" font-size="10" fill="#374151">${suggestion.smiles}</text>
        <text x="50%" y="65%" text-anchor="middle" font-size="8" fill="#6b7280">RDKit visualization removed</text>
      </svg>`;

      const reactionData = {
        type: 'reaction',
        svg: placeholderSvg,
        highlightSvg: null,
        previewSvg: placeholderSvg,
        smiles: suggestion.smiles,
        name: suggestion.name,
        description: suggestion.description,
        includeSDF: includeSDF,
        timestamp: Date.now()
      };

      // Automatically insert the reaction to canvas
      if (onSelectReaction) {
        onSelectReaction(reactionData);
        setSearchTerm('');
        return;
      }
    } catch (err) {
      console.error('Reaction generation error:', err);
      // Still insert with basic data if SVG generation fails
      const fallbackSvg = visualization?.reactionSvg ?? visualization?.previewSvg ?? null;

      const reactionData = {
        type: 'reaction',
        svg: fallbackSvg,
        highlightSvg: visualization?.highlightSvg ?? null,
        previewSvg: visualization?.previewSvg ?? null,
        smiles: suggestion.smiles,
        name: suggestion.name,
        description: suggestion.description,
        includeSDF: includeSDF,
        timestamp: Date.now()
      };

      if (onSelectReaction) {
        onSelectReaction(reactionData);
        setSearchTerm('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      // If we have suggestions, use the first one, otherwise treat as direct SMILES
      if (suggestions.length > 0) {
        handleSuggestionClick(suggestions[0]);
      } else {
        // Treat as direct SMILES input
        const directReaction: ReactionSuggestion = {
          name: 'Custom SMILES',
          smiles: searchTerm.trim(),
          description: 'Direct SMILES input'
        };
        handleSuggestionClick(directReaction);
      }
    }
  };

  return (
    <div ref={componentRef} className={`relative ${className}`}>
      {/* Header with SDF info */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} className="text-orange-400" />
          <span className="text-sm font-medium text-slate-200">Reaction Search</span>
        </div>
        {includeSDF && (
          <div className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
            <Database size={12} />
            <span>3D Models Enabled</span>
          </div>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchTermChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search reactions, formulas, or SMILES..."
          className="w-96 px-4 py-2 pr-40 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
        />

        {/* Controls */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          <button
            onClick={() => setIncludeSDF(!includeSDF)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all font-medium text-sm ${
              includeSDF
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600 hover:text-white'
            }`}
            title={includeSDF ? 'Include 3D SDF models for reaction components' : 'Show 2D reaction diagram only'}
          >
            <Database size={14} />
            <span>{includeSDF ? '3D Models' : '2D Only'}</span>
          </button>

          {/* Loading/Search icon */}
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-slate-400" />
          ) : (
            <Search size={16} className="text-slate-400" />
          )}
        </div>

        {/* Autocomplete Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto w-96">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 hover:bg-slate-600 border-b border-slate-600 last:border-b-0 transition"
              >
                <div className="flex items-center gap-2">
                  <FlaskConical size={14} className="text-orange-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-200 truncate">
                        {suggestion.name}
                      </div>
                      {includeSDF && (
                        <div className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                          <Database size={10} />
                          <span>3D</span>
                        </div>
                      )}
                    </div>
                    {suggestion.description && (
                      <div className="text-xs text-slate-400 truncate">
                        {suggestion.description}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 font-mono truncate">
                      {suggestion.smiles}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results message */}
        {showSuggestions && suggestions.length === 0 && searchTerm.trim().length >= 1 && (
          <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 w-96 p-3">
            <div className="text-sm text-slate-400 text-center">
              {/[A-Za-z0-9\[\]\(\)=\-\+\.#]/g.test(searchTerm) && (searchTerm.includes('>>') || /[A-Z][a-z]?/.test(searchTerm))
                ? 'Press Enter to use as SMILES string'
                : 'No reactions found. Try a reaction name or SMILES string.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}