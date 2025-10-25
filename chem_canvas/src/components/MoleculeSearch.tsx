import { useState } from 'react';
import { Search, X, Loader2, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { getMoleculeByName, get2DStructureUrl, getMolViewUrl, type MoleculeData } from '../services/pubchemService';

interface MoleculeSearchProps {
  onSelectMolecule?: (moleculeData: MoleculeData) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function MoleculeSearch({ onSelectMolecule, isOpen = true, onClose }: MoleculeSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Comprehensive list of common molecules for autocomplete
  const commonMolecules = [
    'methane', 'ethane', 'propane', 'butane', 'pentane',
    'ethene', 'ethyne', 'benzene', 'toluene', 'xylene',
    'methanol', 'ethanol', 'propanol', 'butanol', 'phenol',
    'acetone', 'acetaldehyde', 'formaldehyde',
    'water', 'hydrogen', 'oxygen', 'nitrogen', 'carbon dioxide', 'carbon monoxide',
    'ammonia', 'sulfur dioxide', 'nitrous oxide', 'nitrogen dioxide',
    'glucose', 'fructose', 'sucrose', 'lactose', 'maltose',
    'caffeine', 'aspirin', 'ibuprofen', 'acetaminophen',
    'sodium chloride', 'potassium chloride', 'calcium carbonate',
    'sulfuric acid', 'hydrochloric acid', 'acetic acid', 'formic acid',
    'sodium hydroxide', 'potassium hydroxide', 'ammonia solution',
    'hydrogen peroxide', 'ethyl alcohol', 'glycerol', 'urea',
    'DNA', 'RNA', 'cholesterol', 'vitamin C', 'nicotine',
    'CO2', 'H2O', 'H2', 'O2', 'N2', 'NH3', 'CH4', 'C2H6',
  ];

  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    
    // Generate suggestions
    if (value.trim().length > 0) {
      const filtered = commonMolecules.filter(mol =>
        mol.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 8)); // Show max 8 suggestions
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setSearchTerm(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    
    // Auto-search for the suggestion
    setIsLoading(true);
    setError(null);
    setMoleculeData(null);

    try {
      const data = await getMoleculeByName(suggestion);
      if (data) {
        setMoleculeData(data);
        if (!searchHistory.includes(suggestion)) {
          setSearchHistory([suggestion, ...searchHistory].slice(0, 5));
        }
      } else {
        setError(`Molecule "${suggestion}" not found in PubChem database.`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search molecule. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a molecule name');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMoleculeData(null);

    try {
      console.log(`Searching for molecule: ${searchTerm}`);
      const data = await getMoleculeByName(searchTerm);
      
      if (data) {
        setMoleculeData(data);
        // Add to search history
        if (!searchHistory.includes(searchTerm)) {
          setSearchHistory([searchTerm, ...searchHistory].slice(0, 5));
        }
        setError(null);
      } else {
        setError(`Molecule "${searchTerm}" not found in PubChem database. Try another name.`);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search molecule. Please try again.');
    } finally {
      setIsLoading(false);
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

  const handleView3D = () => {
    if (moleculeData) {
      const molViewUrl = getMolViewUrl(moleculeData.cid, 'balls');
      window.open(molViewUrl, '_blank');
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
            <h2 className="text-xl font-bold text-white">Search Molecules</h2>
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
            <label className="text-sm font-semibold text-slate-300">Molecule Name</label>
            <div className="flex gap-2 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchTermChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="e.g., benzene, glucose, caffeine, water..."
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg flex items-center gap-2 transition font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Search
                  </>
                )}
              </button>
              
              {/* Autocomplete Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-12 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-200 border-b border-slate-700 last:border-b-0 transition flex items-center gap-2"
                    >
                      <Search size={16} className="text-cyan-400" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
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

          {/* Molecule Details */}
          {moleculeData && (
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
                      <p className="text-slate-400">PubChem CID</p>
                      <p className="text-cyan-400 font-mono">{moleculeData.cid}</p>
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
                    title="View 3D structure in MolView"
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
          {!moleculeData && !error && (
            <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-slate-300">💡 Tips:</p>
              <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
                <li>Try common molecule names: benzene, glucose, caffeine, water, ethanol</li>
                <li>Use IUPAC names for more specific results</li>
                <li>Results include molecular formula, weight, and 2D structure</li>
                <li>Click "View 3D" to see the 3D structure in MolView</li>
              </ul>
            </div>
          )}

          {/* How to Use Section */}
          {moleculeData && (
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-300">📚 How to Create a Reaction:</p>
              <ol className="text-sm text-blue-200 space-y-1 list-decimal list-inside">
                <li>Click <span className="font-semibold text-green-400">"Insert into Canvas"</span> to add this molecule</li>
                <li>Repeat for other molecules in your reaction (reactants and products)</li>
                <li>Use the arrow tool to show the reaction direction</li>
                <li>Add conditions (heat, catalyst, etc.) above the arrow</li>
                <li>Arrange molecules to show the complete reaction</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
