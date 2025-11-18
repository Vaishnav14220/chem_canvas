import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Loader2, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { getMoleculeByName, get2DStructureUrl, getMoleculeAutocomplete, type MoleculeData } from '../services/pubchemService';
import { getRDKit3DViewerUrl, initRDKit, getMoleculeByNameRDKit, getRDKitAutocomplete } from '../services/rdkitService';

interface MoleculeSearchProps {
  onSelectMolecule?: (moleculeData: MoleculeData) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function MoleculeSearch({ onSelectMolecule, isOpen = true, onClose }: MoleculeSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
      setIsLoadingSuggestions(false);
      return;
    }

    // Only show suggestions for queries with at least 2 characters
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    setShowSuggestions(true);
    
    // Debounce the API call
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        // Try RDKit suggestions first
        const rdkitSuggestions = getRDKitAutocomplete(value.trim(), 8);
        setSuggestions(rdkitSuggestions);

        // If we have RDKit suggestions, don't fetch from PubChem
        if (rdkitSuggestions.length > 0) {
          setIsLoadingSuggestions(false);
          return;
        }

        // Fallback to PubChem if no RDKit suggestions
        const autocompleteSuggestions = await getMoleculeAutocomplete(value.trim(), 8);
        setSuggestions(autocompleteSuggestions);
      } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
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
    setError(null);
    setMoleculeData(null);
    setSuccessMessage(null);

    try {
      // Try RDKit first
      let data = await getMoleculeByNameRDKit(suggestion);

      // If RDKit doesn't have it, try PubChem as fallback
      if (!data) {
        console.log(`RDKit doesn't have ${suggestion}, trying PubChem...`);
        data = await getMoleculeByName(suggestion);
      }

      if (data) {
        // Automatically insert the molecule to canvas
        if (onSelectMolecule) {
          onSelectMolecule(data);
          setSuccessMessage(`✅ "${data.name}" has been added to your canvas!`);
          setSearchTerm('');
          // Close after a short delay to show success message
          setTimeout(() => {
            if (onClose) onClose();
          }, 1500);
          return;
        }

        // Fallback: show the data if no onSelectMolecule callback
        setMoleculeData(data);
        if (!searchHistory.includes(suggestion)) {
          setSearchHistory([suggestion, ...searchHistory].slice(0, 5));
        }
      } else {
        setError(`Molecule "${suggestion}" not found in RDKit or PubChem database.`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search molecule. Please try again.');
    } finally {
      // Loading completed
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a molecule name');
      return;
    }

    setError(null);
    setMoleculeData(null);
    setSuccessMessage(null);

    try {
      console.log(`Searching for molecule: ${searchTerm}`);

      // Try RDKit first
      let data = await getMoleculeByNameRDKit(searchTerm);

      // If RDKit doesn't have it, try PubChem as fallback
      if (!data) {
        console.log(`RDKit doesn't have ${searchTerm}, trying PubChem...`);
        data = await getMoleculeByName(searchTerm);
      }

      if (data) {
        // Automatically insert the molecule to canvas
        if (onSelectMolecule) {
          onSelectMolecule(data);
          setSuccessMessage(`✅ "${data.name}" has been added to your canvas!`);
          setSearchTerm('');
          // Close after a short delay to show success message
          setTimeout(() => {
            if (onClose) onClose();
          }, 1500);
          return;
        }

        // Fallback: show the data if no onSelectMolecule callback
        setMoleculeData(data);
        // Add to search history
        if (!searchHistory.includes(searchTerm)) {
          setSearchHistory([searchTerm, ...searchHistory].slice(0, 5));
        }
        setError(null);
      } else {
        setError(`Molecule "${searchTerm}" not found in RDKit or PubChem database. Try another name.`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search molecule. Please try again.');
    } finally {
      // Loading completed
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleInsertMolecule = () => {
    if (moleculeData && onSelectMolecule) {
      // Pass complete molecule data for canvas insertion
      onSelectMolecule(moleculeData);
      setMoleculeData(null);
      setSearchTerm('');
      if (onClose) onClose();
    }
  };

  const handleHistoryClick = (term: string) => {
    setSearchTerm(term);
  };

  const handleView3D = async () => {
    if (moleculeData) {
      try {
        // Initialize RDKit if not already done
        await initRDKit();

        // Get RDKit-powered 3D viewer URL
        const rdkitUrl = await getRDKit3DViewerUrl(moleculeData.smiles, moleculeData.name);
        window.open(rdkitUrl, '_blank');
      } catch (error) {
        console.error('Failed to load 3D viewer:', error);
        // Fallback to PubChem-based MolView
        const molViewUrl = `https://embed.molview.org/v1/?mode=balls&smiles=${encodeURIComponent(moleculeData.smiles)}`;
        window.open(molViewUrl, '_blank');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Search size={24} className="text-white" />
            <h2 className="text-xl font-bold text-white">Quick Add Molecules</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-1 rounded transition"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Search size={16} className="text-cyan-400" />
              Search Molecules
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchTermChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type molecule name (e.g., benzene, glucose, caffeine)..."
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                autoFocus
              />
              
              {/* Loading indicator for suggestions */}
              {isLoadingSuggestions && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Loader2 size={16} className="animate-spin text-cyan-400" />
                </div>
              )}
              
              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && (suggestions.length > 0 || isLoadingSuggestions) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                  {isLoadingSuggestions ? (
                    <div className="px-4 py-3 text-center text-slate-400">
                      <Loader2 size={16} className="animate-spin inline mr-2" />
                      Searching PubChem...
                    </div>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-700 text-slate-200 border-b border-slate-700/50 last:border-b-0 transition-all duration-150 flex items-center gap-3 group"
                      >
                        <Search size={16} className="text-cyan-400 group-hover:text-cyan-300 flex-shrink-0" />
                        <span className="truncate">{suggestion}</span>
                        <span className="text-xs text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          Click to add
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-slate-500">
                      No suggestions found
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Quick Search Buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs text-slate-400 mr-2 self-center">Quick search:</span>
              {['benzene', 'glucose', 'caffeine', 'aspirin', 'water'].map((molecule) => (
                <button
                  key={molecule}
                  onClick={() => handleSuggestionClick(molecule)}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full text-sm transition-colors duration-150 border border-slate-600 hover:border-slate-500"
                >
                  {molecule}
                </button>
              ))}
            </div>
          </div>

          {/* Search History */}
          {searchHistory.length > 0 && !moleculeData && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Recent Searches</label>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleHistoryClick(term)}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-full text-sm transition"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex gap-3 p-4 bg-red-900/30 border border-red-600/50 rounded-lg">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex gap-3 p-4 bg-green-900/30 border border-green-600/50 rounded-lg">
              <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-green-300 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Molecule Details (fallback only) */}
          {moleculeData && !successMessage && (
            <div className="space-y-4 border border-slate-700 rounded-lg p-4 bg-slate-800/50">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <h3 className="text-lg font-bold text-white">{moleculeData.name}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Molecular Formula</p>
                      <p className="text-cyan-400 font-mono">{moleculeData.molecularFormula}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Molecular Weight</p>
                      <p className="text-cyan-400 font-mono">{moleculeData.molecularWeight.toFixed(2)} g/mol</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400">SMILES</p>
                      <p className="text-cyan-400 font-mono text-xs break-all">{moleculeData.smiles}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400">Source</p>
                      <p className="text-cyan-400 font-mono text-xs">{moleculeData.source || 'pubchem'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400">3D Viewer</p>
                      <p className="text-cyan-400 font-mono text-xs">Powered by RDKit</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2D Structure Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-300">2D Structure</p>
                  <button
                    onClick={handleView3D}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs flex items-center gap-2 transition"
                    title="View 3D structure with RDKit"
                  >
                    <Eye size={14} />
                    View 3D
                  </button>
                </div>
                {moleculeData.svgData ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: moleculeData.svgData }}
                    className="bg-white p-2 rounded border border-slate-600 flex justify-center"
                    style={{ maxHeight: '300px', overflowY: 'auto' }}
                  />
                ) : (
                  <img
                    src={get2DStructureUrl(moleculeData.cid, 500)}
                    alt={moleculeData.name}
                    className="bg-white p-2 rounded border border-slate-600 w-full max-h-80 object-contain"
                    onError={() => {
                      // Fallback if image fails to load
                      console.error('Failed to load structure image');
                    }}
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleInsertMolecule}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
                >
                  <CheckCircle size={20} />
                  Insert into Canvas
                </button>
              </div>
            </div>
          )}

          {/* Tips */}
          {!successMessage && !error && (
            <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-300">💡 How to Search:</p>
              <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
                <li>Start typing a molecule name (2+ characters) to see RDKit suggestions</li>
                <li>Click any suggestion or press Enter to instantly add it to your canvas</li>
                <li>Click "View 3D" to see interactive 3D structures powered by RDKit</li>
                <li>Try common molecules: benzene, glucose, caffeine, aspirin, water</li>
                <li>Use IUPAC names or chemical formulas for precise results</li>
              </ul>
            </div>
          )}

          {/* How to Use Section */}
          {!successMessage && (
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-300">📚 How to Create a Reaction:</p>
              <ol className="text-sm text-blue-200 space-y-1 list-decimal list-inside">
                <li>Start typing a molecule name to see real-time suggestions from RDKit</li>
                <li>Click any suggestion or press <span className="font-semibold text-cyan-400">Enter</span> to instantly add it to your canvas</li>
                <li>Repeat for other molecules in your reaction (reactants and products)</li>
                <li>Use the arrow tool to show the reaction direction</li>
                <li>Add conditions (heat, catalyst, etc.) above the arrow</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
