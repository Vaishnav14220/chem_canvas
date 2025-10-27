import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { getMoleculeByName, getMoleculeAutocomplete, type MoleculeData } from '../services/pubchemService';

interface InlineMoleculeSearchProps {
  onSelectMolecule?: (moleculeData: MoleculeData) => void;
  className?: string;
}

export default function InlineMoleculeSearch({ onSelectMolecule, className = '' }: InlineMoleculeSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Only show suggestions for queries with at least 2 characters
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(true);

    // Debounce the API call
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const autocompleteSuggestions = await getMoleculeAutocomplete(value.trim(), 6);
        setSuggestions(autocompleteSuggestions);
      } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
        setSuggestions([]);
      }
    }, 300);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleSuggestionClick = async (suggestion: string) => {
    setSearchTerm(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);

    // Auto-search and insert for the suggestion
    setIsLoading(true);

    try {
      const data = await getMoleculeByName(suggestion);
      if (data) {
        // Automatically insert the molecule to canvas
        if (onSelectMolecule) {
          onSelectMolecule(data);
          setSearchTerm('');
          return;
        }
      } else {
        console.warn(`Molecule "${suggestion}" not found`);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      handleSuggestionClick(searchTerm.trim());
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchTermChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search molecules..."
          className="w-64 px-4 py-2 pr-10 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
        />

        {/* Loading/Search icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-slate-400" />
          ) : (
            <Search size={16} className="text-slate-400" />
          )}
        </div>

        {/* Autocomplete Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto w-64">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 hover:bg-slate-600 text-slate-200 border-b border-slate-600 last:border-b-0 transition text-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}