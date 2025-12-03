import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ExternalLink, X, Maximize2, Minimize2, RefreshCw, Search, Home, AlertTriangle, ChevronDown } from 'lucide-react';

interface MolecularViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MoleculeSuggestion {
  name: string;
  cid?: string;
  formula?: string;
  weight?: number;
  smiles?: string;
}

const MolecularViewer: React.FC<MolecularViewerProps> = ({ isOpen, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMolecule, setCurrentMolecule] = useState<string>('');
  const [moleculeName, setMoleculeName] = useState<string>('');
  const [embedUrl, setEmbedUrl] = useState('https://embed.molview.org/v1/?mode=balls');
  const [suggestions, setSuggestions] = useState<MoleculeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Comprehensive molecule database
  const moleculeDatabase: MoleculeSuggestion[] = [
    // Common organic compounds
    { name: 'Methane', cid: '297', formula: 'CH4', weight: 16 },
    { name: 'Ethane', cid: '6324', formula: 'C2H6', weight: 30 },
    { name: 'Propane', cid: '6334', formula: 'C3H8', weight: 44 },
    { name: 'Butane', cid: '7843', formula: 'C4H10', weight: 58 },
    { name: 'Pentane', cid: '8003', formula: 'C5H12', weight: 72 },
    { name: 'Hexane', cid: '8058', formula: 'C6H14', weight: 86 },
    { name: 'Heptane', cid: '8900', formula: 'C7H16', weight: 100 },
    { name: 'Octane', cid: '356', formula: 'C8H18', weight: 114 },
    
    // Aromatic compounds
    { name: 'Benzene', cid: '241', formula: 'C6H6', weight: 78 },
    { name: 'Toluene', cid: '1140', formula: 'C7H8', weight: 92 },
    { name: 'Xylene', cid: '7809', formula: 'C8H10', weight: 106 },
    { name: 'Naphthalene', cid: '931', formula: 'C10H8', weight: 128 },
    { name: 'Anthracene', cid: '8418', formula: 'C14H10', weight: 178 },
    { name: 'Phenanthrene', cid: '995', formula: 'C14H10', weight: 178 },
    
    // Alcohols
    { name: 'Methanol', cid: '887', formula: 'CH4O', weight: 32 },
    { name: 'Ethanol', cid: '702', formula: 'C2H6O', weight: 46 },
    { name: 'Propanol', cid: '1031', formula: 'C3H8O', weight: 60 },
    { name: 'Butanol', cid: '263', formula: 'C4H10O', weight: 74 },
    { name: 'Phenol', cid: '996', formula: 'C6H6O', weight: 94 },
    { name: 'Glycerol', cid: '753', formula: 'C3H8O3', weight: 92 },
    
    // Aldehydes and Ketones
    { name: 'Formaldehyde', cid: '712', formula: 'CH2O', weight: 30 },
    { name: 'Acetaldehyde', cid: '177', formula: 'C2H4O', weight: 44 },
    { name: 'Acetone', cid: '180', formula: 'C3H6O', weight: 58 },
    { name: 'Benzaldehyde', cid: '240', formula: 'C7H6O', weight: 106 },
    { name: 'Acetophenone', cid: '7410', formula: 'C8H8O', weight: 120 },
    
    // Carboxylic acids
    { name: 'Formic acid', cid: '284', formula: 'CH2O2', weight: 46 },
    { name: 'Acetic acid', cid: '176', formula: 'C2H4O2', weight: 60 },
    { name: 'Propionic acid', cid: '1032', formula: 'C3H6O2', weight: 74 },
    { name: 'Butyric acid', cid: '264', formula: 'C4H8O2', weight: 88 },
    { name: 'Benzoic acid', cid: '243', formula: 'C7H6O2', weight: 122 },
    { name: 'Salicylic acid', cid: '338', formula: 'C7H6O3', weight: 138 },
    
    // Esters
    { name: 'Methyl acetate', cid: '6584', formula: 'C3H6O2', weight: 74 },
    { name: 'Ethyl acetate', cid: '8857', formula: 'C4H8O2', weight: 88 },
    { name: 'Aspirin', cid: '2244', formula: 'C9H8O4', weight: 180 },
    { name: 'Methyl salicylate', cid: '4133', formula: 'C8H8O3', weight: 152 },
    
    // Amines
    { name: 'Methylamine', cid: '6329', formula: 'CH5N', weight: 31 },
    { name: 'Ethylamine', cid: '6341', formula: 'C2H7N', weight: 45 },
    { name: 'Aniline', cid: '6115', formula: 'C6H7N', weight: 93 },
    { name: 'Pyridine', cid: '1049', formula: 'C5H5N', weight: 79 },
    { name: 'Quinoline', cid: '7047', formula: 'C9H7N', weight: 129 },
    
    // Sugars
    { name: 'Glucose', cid: '5793', formula: 'C6H12O6', weight: 180 },
    { name: 'Fructose', cid: '5984', formula: 'C6H12O6', weight: 180 },
    { name: 'Sucrose', cid: '5988', formula: 'C12H22O11', weight: 342 },
    { name: 'Lactose', cid: '6134', formula: 'C12H22O11', weight: 342 },
    { name: 'Maltose', cid: '6255', formula: 'C12H22O11', weight: 342 },
    { name: 'Ribose', cid: '5779', formula: 'C5H10O5', weight: 150 },
    { name: 'Deoxyribose', cid: '5460005', formula: 'C5H10O4', weight: 134 },
    
    // Amino acids
    { name: 'Glycine', cid: '750', formula: 'C2H5NO2', weight: 75 },
    { name: 'Alanine', cid: '5950', formula: 'C3H7NO2', weight: 89 },
    { name: 'Valine', cid: '6287', formula: 'C5H11NO2', weight: 117 },
    { name: 'Leucine', cid: '6106', formula: 'C6H13NO2', weight: 131 },
    { name: 'Isoleucine', cid: '6306', formula: 'C6H13NO2', weight: 131 },
    { name: 'Serine', cid: '5951', formula: 'C3H7NO3', weight: 105 },
    { name: 'Threonine', cid: '6288', formula: 'C4H9NO3', weight: 119 },
    { name: 'Cysteine', cid: '5862', formula: 'C3H7NO2S', weight: 121 },
    { name: 'Methionine', cid: '6137', formula: 'C5H11NO2S', weight: 149 },
    { name: 'Phenylalanine', cid: '6140', formula: 'C9H11NO2', weight: 165 },
    { name: 'Tyrosine', cid: '6057', formula: 'C9H11NO3', weight: 181 },
    { name: 'Tryptophan', cid: '6305', formula: 'C11H12N2O2', weight: 204 },
    { name: 'Histidine', cid: '6274', formula: 'C6H9N3O2', weight: 155 },
    { name: 'Lysine', cid: '5962', formula: 'C6H14N2O2', weight: 146 },
    { name: 'Arginine', cid: '6322', formula: 'C6H14N4O2', weight: 174 },
    { name: 'Aspartic acid', cid: '5960', formula: 'C4H7NO4', weight: 133 },
    { name: 'Glutamic acid', cid: '611', formula: 'C5H9NO4', weight: 147 },
    { name: 'Asparagine', cid: '6267', formula: 'C4H8N2O3', weight: 132 },
    { name: 'Glutamine', cid: '5961', formula: 'C5H10N2O3', weight: 146 },
    { name: 'Proline', cid: '614', formula: 'C5H9NO2', weight: 115 },
    
    // Nucleotides
    { name: 'Adenine', cid: '190', formula: 'C5H5N5', weight: 135 },
    { name: 'Guanine', cid: '764', formula: 'C5H5N5O', weight: 151 },
    { name: 'Cytosine', cid: '597', formula: 'C4H5N3O', weight: 111 },
    { name: 'Thymine', cid: '1135', formula: 'C5H6N2O2', weight: 126 },
    { name: 'Uracil', cid: '1174', formula: 'C4H4N2O2', weight: 112 },
    { name: 'Adenosine', cid: '60961', formula: 'C10H13N5O4', weight: 267 },
    { name: 'Guanosine', cid: '6802', formula: 'C10H13N5O5', weight: 283 },
    { name: 'Cytidine', cid: '6175', formula: 'C9H13N3O5', weight: 243 },
    { name: 'Thymidine', cid: '5789', formula: 'C10H14N2O5', weight: 242 },
    { name: 'Uridine', cid: '6029', formula: 'C9H12N2O6', weight: 244 },
    
    // Vitamins
    { name: 'Vitamin A', cid: '445354', formula: 'C20H30O', weight: 286 },
    { name: 'Vitamin B1', cid: '6042', formula: 'C12H17N4OS+', weight: 265 },
    { name: 'Vitamin B2', cid: '493570', formula: 'C17H20N4O6', weight: 376 },
    { name: 'Vitamin B3', cid: '938', formula: 'C6H6N2O', weight: 122 },
    { name: 'Vitamin B6', cid: '1054', formula: 'C8H11NO3', weight: 169 },
    { name: 'Vitamin B12', cid: '16212801', formula: 'C63H88CoN14O14P', weight: 1355 },
    { name: 'Vitamin C', cid: '54670067', formula: 'C6H8O6', weight: 176 },
    { name: 'Vitamin D', cid: '5280795', formula: 'C27H44O', weight: 384 },
    { name: 'Vitamin E', cid: '14985', formula: 'C29H50O2', weight: 430 },
    { name: 'Folic acid', cid: '6037', formula: 'C19H19N7O6', weight: 441 },
    
    // Drugs and pharmaceuticals
    { name: 'Caffeine', cid: '2519', formula: 'C8H10N4O2', weight: 194 },
    { name: 'Aspirin', cid: '2244', formula: 'C9H8O4', weight: 180 },
    { name: 'Ibuprofen', cid: '3672', formula: 'C13H18O2', weight: 206 },
    { name: 'Acetaminophen', cid: '1983', formula: 'C8H9NO2', weight: 151 },
    { name: 'Morphine', cid: '5288826', formula: 'C17H19NO3', weight: 285 },
    { name: 'Codeine', cid: '5284371', formula: 'C18H21NO3', weight: 299 },
    { name: 'Penicillin', cid: '5904', formula: 'C16H18N2O4S', weight: 334 },
    { name: 'Insulin', cid: '16132498', formula: 'C254H377N65O75S6', weight: 5808 },
    { name: 'Cortisol', cid: '5755', formula: 'C21H30O5', weight: 362 },
    { name: 'Testosterone', cid: '6013', formula: 'C19H28O2', weight: 288 },
    { name: 'Estradiol', cid: '5757', formula: 'C18H24O2', weight: 272 },
    { name: 'Cholesterol', cid: '5997', formula: 'C27H46O', weight: 387 },
    { name: 'Cocaine', cid: '446220', formula: 'C17H21NO4', weight: 303 },
    { name: 'LSD', cid: '5761', formula: 'C20H25N3O', weight: 323 },
    { name: 'MDMA', cid: '1615', formula: 'C11H15NO2', weight: 193 },
    
    // Natural products
    { name: 'Chlorophyll', cid: '15965065', formula: 'C55H72MgN4O5', weight: 893 },
    { name: 'Carotene', cid: '5280489', formula: 'C40H56', weight: 536 },
    { name: 'Lycopene', cid: '446925', formula: 'C40H56', weight: 536 },
    { name: 'Quinine', cid: '3034034', formula: 'C20H24N2O2', weight: 324 },
    { name: 'Capsaicin', cid: '1548943', formula: 'C18H27NO3', weight: 305 },
    { name: 'Caffeine', cid: '2519', formula: 'C8H10N4O2', weight: 194 },
    { name: 'Nicotine', cid: '89594', formula: 'C10H14N2', weight: 162 },
    { name: 'Cocaine', cid: '446220', formula: 'C17H21NO4', weight: 303 },
    { name: 'Morphine', cid: '5288826', formula: 'C17H19NO3', weight: 285 },
    { name: 'Codeine', cid: '5284371', formula: 'C18H21NO3', weight: 299 },
    
    // Inorganic compounds
    { name: 'Water', cid: '962', formula: 'H2O', weight: 18 },
    { name: 'Ammonia', cid: '222', formula: 'NH3', weight: 17 },
    { name: 'Carbon dioxide', cid: '280', formula: 'CO2', weight: 44 },
    { name: 'Carbon monoxide', cid: '281', formula: 'CO', weight: 28 },
    { name: 'Nitrogen dioxide', cid: '3032552', formula: 'NO2', weight: 46 },
    { name: 'Sulfur dioxide', cid: '1119', formula: 'SO2', weight: 64 },
    { name: 'Hydrogen sulfide', cid: '402', formula: 'H2S', weight: 34 },
    { name: 'Hydrogen chloride', cid: '313', formula: 'HCl', weight: 36 },
    { name: 'Hydrogen fluoride', cid: '14917', formula: 'HF', weight: 20 },
    { name: 'Hydrogen bromide', cid: '260', formula: 'HBr', weight: 81 },
    { name: 'Hydrogen iodide', cid: '24841', formula: 'HI', weight: 128 },
    
    // Common solvents
    { name: 'Acetone', cid: '180', formula: 'C3H6O', weight: 58 },
    { name: 'Ethanol', cid: '702', formula: 'C2H6O', weight: 46 },
    { name: 'Methanol', cid: '887', formula: 'CH4O', weight: 32 },
    { name: 'Diethyl ether', cid: '3283', formula: 'C4H10O', weight: 74 },
    { name: 'Chloroform', cid: '6212', formula: 'CHCl3', weight: 119 },
    { name: 'Carbon tetrachloride', cid: '5943', formula: 'CCl4', weight: 154 },
    { name: 'Benzene', cid: '241', formula: 'C6H6', weight: 78 },
    { name: 'Toluene', cid: '1140', formula: 'C7H8', weight: 92 },
    { name: 'Hexane', cid: '8058', formula: 'C6H14', weight: 86 },
    { name: 'Pentane', cid: '8003', formula: 'C5H12', weight: 72 },
    
    // Polymers and macromolecules
    { name: 'Polyethylene', cid: '6325', formula: '(C2H4)n', weight: 28 },
    { name: 'Polypropylene', cid: '7698', formula: '(C3H6)n', weight: 42 },
    { name: 'Polystyrene', cid: '247', formula: '(C8H8)n', weight: 104 },
    { name: 'PVC', cid: '6338', formula: '(C2H3Cl)n', weight: 62 },
    { name: 'Teflon', cid: '9002-84-0', formula: '(C2F4)n', weight: 100 },
    { name: 'Nylon', cid: '248', formula: '(C12H22N2O2)n', weight: 226 },
    { name: 'Kevlar', cid: '249', formula: '(C14H10N2O2)n', weight: 238 },
    { name: 'DNA', cid: '5957', formula: 'C10H14N5O7P', weight: 331 },
    { name: 'RNA', cid: '6023', formula: 'C9H13N3O8P', weight: 322 },
    { name: 'Protein', cid: '16132498', formula: 'C254H377N65O75S6', weight: 5808 }
  ];

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      setHasError(false);
      iframeRef.current.src = embedUrl;
    }
  };

  const handleHome = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      setHasError(false);
      setEmbedUrl('https://embed.molview.org/v1/?mode=balls');
      setCurrentMolecule('');
      setMoleculeName('');
      setSearchQuery('');
      iframeRef.current.src = 'https://embed.molview.org/v1/?mode=balls';
    }
  };

  const openInNewTab = () => {
    window.open('https://molview.org/', '_blank');
  };

  const handleIframeLoad = () => {
    console.log('Iframe loaded successfully');
    
    // Clear the loading timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    console.log('Iframe failed to load');
    setIsLoading(false);
    setHasError(true);
  };

  // Function to fetch CID for a molecule name
  const fetchCID = async (moleculeName: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(moleculeName)}/cids/JSON`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.IdentifierList && data.IdentifierList.CID && data.IdentifierList.CID[0]) {
          return data.IdentifierList.CID[0].toString();
        }
      }
    } catch (error) {
      console.log('CID fetch error for', moleculeName, ':', error);
    }
    return null;
  };

  // Search suggestions using PubChem autocomplete API
  const searchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    
    try {
      // Use PubChem autocomplete API (same as MolView uses)
      const response = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/pcautocp/pcautocp.cgi?dict=pc_compoundnames&n=10&q=${encodeURIComponent(query)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const autocompleteResults = data.autocp_array || [];
        
        // Convert PubChem results to our format and fetch CIDs for top results
        const pubchemSuggestions: MoleculeSuggestion[] = await Promise.all(
          autocompleteResults.slice(0, 8).map(async (name: string) => {
            const cid = await fetchCID(name);
            return {
              name: name,
              cid: cid || undefined,
              formula: undefined,
              weight: undefined
            };
          })
        );
        
        // Combine with local database results for better coverage
        const localFiltered = moleculeDatabase
          .filter(mol => 
            mol.name.toLowerCase().includes(query.toLowerCase()) ||
            (mol.formula && mol.formula.toLowerCase().includes(query.toLowerCase()))
          )
          .slice(0, 4);
        
        // Merge and deduplicate results
        const allSuggestions = [...pubchemSuggestions, ...localFiltered];
        const uniqueSuggestions = allSuggestions.filter((suggestion, index, self) => 
          index === self.findIndex(s => s.name.toLowerCase() === suggestion.name.toLowerCase())
        ).slice(0, 10);
        
        setSuggestions(uniqueSuggestions);
        setShowSuggestions(uniqueSuggestions.length > 0);
      } else {
        // Fallback to local database if API fails
        const filtered = moleculeDatabase
          .filter(mol => 
            mol.name.toLowerCase().includes(query.toLowerCase()) ||
            (mol.formula && mol.formula.toLowerCase().includes(query.toLowerCase()))
          )
          .slice(0, 10);
        
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      }
    } catch (error) {
      console.log('PubChem API error, using local database:', error);
      // Fallback to local database
      const filtered = moleculeDatabase
        .filter(mol => 
          mol.name.toLowerCase().includes(query.toLowerCase()) ||
          (mol.formula && mol.formula.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 10);
      
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debounced search
  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setSelectedIndex(-1);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchSuggestions(value);
    }, 100);
  };

  const searchMolecule = async (molecule?: MoleculeSuggestion) => {
    const targetMolecule = molecule || { name: searchQuery, cid: searchQuery };
    
    if (!targetMolecule.name.trim()) return;
    
    // Update search query if molecule was selected from autocomplete
    if (molecule && molecule.name !== searchQuery) {
      setSearchQuery(molecule.name);
    }
    
    setIsLoading(true);
    setHasError(false);
    setShowSuggestions(false);
    
    try {
      let newEmbedUrl: string;
      let cid = targetMolecule.cid;
      
      console.log('Searching for molecule:', targetMolecule.name);
      
      // Always try to get CID from PubChem for better accuracy
      if (!cid || isNaN(Number(cid))) {
        try {
          console.log('Looking up CID for:', targetMolecule.name);
          
          // Try multiple PubChem API endpoints for better success rate
          const endpoints = [
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(targetMolecule.name)}/property/MolecularFormula,MolecularWeight/JSON`,
            `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(targetMolecule.name)}/cids/JSON`
          ];
          
          let foundCid = false;
          for (const endpoint of endpoints) {
            try {
              console.log('Trying endpoint:', endpoint);
              const response = await fetch(endpoint);
              
              if (response.ok) {
                const data = await response.json();
                console.log('PubChem response:', data);
                
                // Handle different response formats
                if (data.PC_Compounds && data.PC_Compounds[0]) {
                  cid = data.PC_Compounds[0].id.id.cid.toString();
                  console.log('Found CID from PC_Compounds:', cid);
                  foundCid = true;
                  break;
                } else if (data.IdentifierList && data.IdentifierList.CID && data.IdentifierList.CID[0]) {
                  cid = data.IdentifierList.CID[0].toString();
                  console.log('Found CID from IdentifierList:', cid);
                  foundCid = true;
                  break;
                }
              } else {
                console.log('Endpoint failed with status:', response.status);
              }
            } catch (endpointError) {
              console.log('Endpoint error:', endpointError);
            }
          }
          
          if (!foundCid) {
            console.log('No CID found in PubChem for:', targetMolecule.name);
          }
        } catch (apiError) {
          console.log('PubChem CID lookup failed:', apiError);
        }
      }
      
      // Create MolView embed URL - prioritize CID-based URLs
      if (cid && !isNaN(Number(cid))) {
        newEmbedUrl = `https://embed.molview.org/v1/?mode=balls&cid=${cid}`;
        console.log('Using CID-based URL:', newEmbedUrl);
      } else {
        // Fallback to name-based search
        newEmbedUrl = `https://embed.molview.org/v1/?mode=balls&q=${encodeURIComponent(targetMolecule.name)}`;
        console.log('Using name-based URL:', newEmbedUrl);
      }
      
      setEmbedUrl(newEmbedUrl);
      setCurrentMolecule(cid || targetMolecule.name);
      setMoleculeName(targetMolecule.name);
      
      if (iframeRef.current) {
        console.log('Loading iframe with URL:', newEmbedUrl);
        
        // Clear any existing timeout
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
        }
        
        // Set a timeout to handle loading issues
        loadingTimeoutRef.current = setTimeout(() => {
          console.log('Iframe loading timeout - molecule may not be available');
          setIsLoading(false);
          setHasError(true);
        }, 15000); // Increased to 15 seconds for complex molecules
        
        iframeRef.current.src = newEmbedUrl;
      }
    } catch (err) {
      console.error('Error in searchMolecule:', err);
      setHasError(true);
    }
  };

  const loadExampleMolecules = () => {
    return [
      { name: 'Caffeine', cid: '2519' },
      { name: 'Aspirin', cid: '2244' },
      { name: 'Glucose', cid: '5793' },
      { name: 'Benzene', cid: '241' },
      { name: 'Water', cid: '962' },
      { name: 'Methane', cid: '297' },
      { name: 'Ethanol', cid: '702' },
      { name: 'Acetone', cid: '180' }
    ];
  };

  const loadExampleMolecule = (example: { name: string; cid: string }) => {
    setSearchQuery(example.name);
    setCurrentMolecule(example.cid);
    setMoleculeName(example.name);
    setHasError(false);
    setIsLoading(true);
    setShowSuggestions(false);
    
    const newEmbedUrl = `https://embed.molview.org/v1/?mode=balls&cid=${example.cid}`;
    setEmbedUrl(newEmbedUrl);
    
    if (iframeRef.current) {
      iframeRef.current.src = newEmbedUrl;
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        searchMolecule();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev <= 0 ? suggestions.length - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          searchMolecule(suggestions[selectedIndex]);
        } else {
          searchMolecule();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const changeViewMode = (mode: 'balls' | 'sticks' | 'cartoon') => {
    const baseUrl = currentMolecule 
      ? `https://embed.molview.org/v1/?mode=${mode}&cid=${currentMolecule}`
      : `https://embed.molview.org/v1/?mode=${mode}`;
    
    setEmbedUrl(baseUrl);
    setIsLoading(true);
    
    if (iframeRef.current) {
      iframeRef.current.src = baseUrl;
    }
  };

  useEffect(() => {
    if (isOpen && iframeRef.current) {
      setIsLoading(true);
      setHasError(false);
      iframeRef.current.src = embedUrl;
    }
  }, [isOpen, embedUrl]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.search-container')) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSuggestions]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 ${
      isFullscreen ? 'p-0' : 'p-4'
    }`}>
      <div className={`bg-gray-900/95 backdrop-blur-lg shadow-2xl border border-gray-700 ${
        isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-7xl h-[95vh] rounded-2xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 22L22 17" />
                <path d="M2 12L12 17L22 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">MolView - 3D Molecular Viewer</h2>
              <p className="text-sm text-gray-400">
                Interactive 3D molecular visualization
                {moleculeName && <span className="text-purple-400 ml-2">• {moleculeName}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleHome}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Go to MolView homepage"
            >
              <Home className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh viewer"
            >
              <RefreshCw className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
            <button
              onClick={openInNewTab}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5 text-gray-400 hover:text-white" />
              ) : (
                <Maximize2 className="h-5 w-5 text-gray-400 hover:text-white" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Search and Controls */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/30">
          <div className="flex items-center space-x-3 mb-3">
            <div className="flex-1 relative search-container">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                placeholder="Search 100M+ molecules from PubChem (e.g., ani, caf, asp, glu, ben)..."
                className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
                autoComplete="off"
              />
              
              {/* Autocomplete Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.cid || suggestion.name}-${index}`}
                      onClick={() => {
                        console.log('Clicked on suggestion:', suggestion.name);
                        searchMolecule(suggestion);
                      }}
                      className={`px-4 py-3 cursor-pointer border-b border-gray-700 last:border-b-0 transition-colors ${
                        index === selectedIndex 
                          ? 'bg-purple-600 text-white' 
                          : 'hover:bg-gray-700 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{suggestion.name}</div>
                          {suggestion.formula && (
                            <div className="text-xs text-gray-400 mt-1">
                              {suggestion.formula}
                              {suggestion.weight && ` • MW: ${suggestion.weight} g/mol`}
                            </div>
                          )}
                          {!suggestion.formula && (
                            <div className="text-xs text-gray-500 mt-1">
                              From PubChem database
                              {suggestion.cid ? ' • CID available' : ' • Click to load'}
                            </div>
                          )}
                        </div>
                        {suggestion.cid && (
                          <div className="text-xs text-gray-500">
                            CID: {suggestion.cid}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Loading indicator for autocomplete */}
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                </div>
              )}
            </div>
            <button
              onClick={() => searchMolecule()}
              disabled={!searchQuery.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Search
            </button>
          </div>
          
          {/* View Mode Controls */}
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-xs text-gray-400">View Mode:</span>
            <button
              onClick={() => changeViewMode('balls')}
              className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Balls
            </button>
            <button
              onClick={() => changeViewMode('sticks')}
              className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Sticks
            </button>
            <button
              onClick={() => changeViewMode('cartoon')}
              className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
            >
              Cartoon
            </button>
          </div>
          
          {/* Example Molecules */}
          <div>
            <p className="text-xs text-gray-400 mb-2">Quick examples (test these first):</p>
            <div className="flex flex-wrap gap-2">
              {loadExampleMolecules().map((example) => (
                <button
                  key={example.name}
                  onClick={() => loadExampleMolecule(example)}
                  className="px-3 py-1 text-xs bg-gray-700 text-gray-300 rounded-full hover:bg-gray-600 transition-colors"
                >
                  {example.name}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <button
                onClick={() => {
                  console.log('Testing iframe with direct URL');
                  if (iframeRef.current) {
                    iframeRef.current.src = 'https://embed.molview.org/v1/?mode=balls&cid=2519';
                    setMoleculeName('Caffeine (Test)');
                    setIsLoading(true);
                  }
                }}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
              >
                Test Caffeine (Direct)
              </button>
              <button
                onClick={async () => {
                  console.log('Testing CID fetch for Aniline');
                  const cid = await fetchCID('Aniline');
                  console.log('Aniline CID:', cid);
                  if (cid && iframeRef.current) {
                    iframeRef.current.src = `https://embed.molview.org/v1/?mode=balls&cid=${cid}`;
                    setMoleculeName('Aniline (CID Test)');
                    setIsLoading(true);
                  }
                }}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors ml-2"
              >
                Test Aniline (CID)
              </button>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {isLoading && moleculeName && (
          <div className="p-4 bg-blue-900/20 border-b border-blue-700">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <div>
                <p className="text-blue-400 text-sm font-medium">Loading {moleculeName}...</p>
                <p className="text-blue-300 text-xs">Fetching 3D structure from MolView</p>
              </div>
            </div>
          </div>
        )}
        
        {hasError && (
          <div className="p-4 bg-red-900/20 border-b border-red-700">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div>
                <p className="text-red-400 text-sm font-medium">MolView Loading Issue</p>
                <p className="text-red-300 text-xs">The molecular viewer may be experiencing issues. Try refreshing or opening in a new tab.</p>
              </div>
              <button
                onClick={handleRefresh}
                className="ml-auto px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* MolView Embed */}
        <div className="relative" style={{ height: isFullscreen ? 'calc(100vh - 200px)' : 'calc(95vh - 200px)' }}>
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-white text-lg">Loading MolView...</p>
                <p className="text-gray-400 text-sm mt-2">Accessing molecular database</p>
              </div>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="MolView - 3D Molecular Viewer"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation allow-modals"
            allow="fullscreen; camera; microphone; geolocation; payment; usb; autoplay"
            referrerPolicy="no-referrer-when-downgrade"
            loading="eager"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center space-x-4">
              <span className="font-medium text-purple-400">MolView Embed</span>
              <span>•</span>
              <span>PubChem Autocomplete API</span>
              <span>•</span>
              <span>100M+ Molecules Database</span>
              <span>•</span>
              <span>Interactive 3D Visualization</span>
              {moleculeName && (
                <>
                  <span>•</span>
                  <span className="text-white font-medium">Current: {moleculeName}</span>
                </>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span>Drag to rotate • Scroll to zoom</span>
              <span>•</span>
              <a 
                href="https://molview.org/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                MolView.org
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MolecularViewer;
