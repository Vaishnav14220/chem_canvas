import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { getMoleculeByName, getMoleculeAutocomplete, type MoleculeData } from '../services/pubchemService';
import { captureFeatureEvent } from '../utils/errorLogger';
import { toast } from 'react-toastify';

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

    // Only show suggestions for queries with at least 1 character
    if (value.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(true);

    // Debounce the API call
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const autocompleteSuggestions = await getMoleculeAutocomplete(value.trim(), 12);
        setSuggestions(autocompleteSuggestions);
      } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
        setSuggestions([]);
      }
    }, 200);
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

  const handleSuggestionClick = async (suggestion: string) => {
    setSearchTerm(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);

    // Auto-search and insert for the suggestion
    setIsLoading(true);

    // Show loading toast
    const toastId = toast.loading(`Adding ${suggestion} to canvas...`, {
      position: "top-right",
      theme: "light",
    });

    try {
      const data = await getMoleculeByName(suggestion);
      if (data) {
        // Automatically insert the molecule to canvas
        if (onSelectMolecule) {
          onSelectMolecule(data);
          setSearchTerm('');
        }
        void captureFeatureEvent('molecule_search', 'select', {
          query: suggestion,
          cid: (data as any).cid ?? (data as any).id ?? null,
          name: (data as any).name ?? null
        });
        
        // Update toast to success with checkmark
        toast.update(toastId, {
          render: `✓ ${suggestion} added successfully!`,
          type: "success",
          isLoading: false,
          autoClose: 3000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        
        setSearchTerm('');
        return;
      } else {
        console.warn(`Molecule "${suggestion}" not found`);
        // Update toast to error
        toast.update(toastId, {
          render: `Molecule "${suggestion}" not found`,
          type: "error",
          isLoading: false,
          autoClose: 4000,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    } catch (err) {
      console.error('Search error:', err);
      // Update toast to error
      toast.update(toastId, {
        render: `Failed to add ${suggestion}`,
        type: "error",
        isLoading: false,
        autoClose: 4000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
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
    <div ref={componentRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/80 px-4 py-2 text-slate-100 shadow-inner transition-all duration-200 focus-within:border-blue-400 focus-within:shadow-lg">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchTermChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Search molecules..."
          className="flex-1 bg-transparent text-sm placeholder-slate-500 focus:outline-none"
        />
        <div className="text-slate-400">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </div>
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-600 bg-slate-900/95 shadow-2xl">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full border-b border-slate-700/60 px-4 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-700/60 last:border-b-0"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
