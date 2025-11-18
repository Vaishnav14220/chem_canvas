import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Search, Loader2, ArrowRight, FlaskConical, AlertCircle, Database, Wand2, ChevronDown, Check } from 'lucide-react';
import { resolveReactionQuery, resolveReactionByName, type ReactionResolutionResult } from '../services/reactionResolver';
import { isGeminiInitialized } from '../services/geminiService';
import { generateTextContent } from '../services/geminiService';
import { getReactionSuggestions, REACTION_DATABASE, type ReactionDatabaseEntry } from '../data/reactionDatabase';
import { ordService, type ORDReaction } from '../services/ordService';
import { sanitizeReactionSmilesInput, stripAtomMappings } from '../utils/reactionSanitizer';
import { reactionSmilesToSVG } from '../services/rdkitService';
import {
  searchReactionByName,
  searchReactionByReactant,
  searchReactionByProduct,
  autocompleteReactionNames,
  autocompleteReactants,
  autocompleteProducts,
  generateReactionSvg,
  NameReactionApiError,
} from '../services/nameReactionApi';
import MoleculeStructure from './MoleculeStructure';
import ReactionDiagram from './ReactionDiagram';
import ReactionMechanismScene from './ReactionMechanismScene';
import ReactMolReactionViewer from './ReactMolReactionViewer';
import KekuleReactionViewer from './KekuleReactionViewer';
import KekuleReactionCanvasModal from './KekuleReactionCanvasModal';

interface ReactionSearchProps {
  onClose: () => void;
  onReactionInsert?: (reactionData: any) => void;
}

interface NameReactionEntry {
  reactionName: string;
  reactants: string;
  reactantSmiles: string[];
  reagents: string;
  reagentSmiles: string[];
  products: string;
  productSmiles: string[];
  description: string;
}

const splitSmilesList = (value: string): string[] => {
  return value
    .replace(/`/g, '')
    .split(/,\s*/)
    .map(item => item.trim())
    .filter(Boolean);
};

const parseNameReactionResponse = (raw: string): NameReactionEntry[] => {
  if (!raw?.trim()) {
    return [];
  }

  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const header = lines[0].split(/\t+/);
  const indexMap = {
    name: header.findIndex(col => col.toLowerCase().includes('reaction')),
    reactants: header.findIndex(col => col.toLowerCase().startsWith('reactants') && !col.toLowerCase().includes('smiles')),
    reactantSmiles: header.findIndex(col => col.toLowerCase().includes('reactants') && col.toLowerCase().includes('smiles')),
    reagents: header.findIndex(col => col.toLowerCase().startsWith('reagents') && !col.toLowerCase().includes('smiles')),
    reagentSmiles: header.findIndex(col => col.toLowerCase().includes('reagents') && col.toLowerCase().includes('smiles')),
    products: header.findIndex(col => col.toLowerCase().startsWith('products') && !col.toLowerCase().includes('smiles')),
    productSmiles: header.findIndex(col => col.toLowerCase().includes('products') && col.toLowerCase().includes('smiles')),
    description: header.findIndex(col => col.toLowerCase().includes('description'))
  };

  const getColumn = (columns: string[], index: number): string => {
    if (index < 0 || index >= columns.length) {
      return '';
    }
    return columns[index]?.trim() ?? '';
  };

  return lines.slice(1).map(line => {
    const columns = line.split(/\t+/);
    return {
      reactionName: getColumn(columns, indexMap.name),
      reactants: getColumn(columns, indexMap.reactants),
      reactantSmiles: splitSmilesList(getColumn(columns, indexMap.reactantSmiles)),
      reagents: getColumn(columns, indexMap.reagents),
      reagentSmiles: splitSmilesList(getColumn(columns, indexMap.reagentSmiles)),
      products: getColumn(columns, indexMap.products),
      productSmiles: splitSmilesList(getColumn(columns, indexMap.productSmiles)),
      description: getColumn(columns, indexMap.description)
    } satisfies NameReactionEntry;
  });
};

const ROLE_LABELS: Record<'reactant' | 'agent' | 'product', string> = {
  reactant: 'Reactants',
  agent: 'Reagents & catalysts',
  product: 'Products'
};

const ROLE_COLOURS: Record<'reactant' | 'agent' | 'product', string> = {
  reactant: '#ec4899',
  agent: '#10b981',
  product: '#2563eb'
};

const ROLE_ORDER = ['reactant', 'agent', 'product'] as const;

type ReactionViewMode = 'structured' | 'svg' | 'kekule' | 'animated' | 'reactMol';

const ReactionSearch: React.FC<ReactionSearchProps> = ({ onClose, onReactionInsert }) => {
  const [reactionInput, setReactionInput] = useState('');
  const [reactionName, setReactionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactionPreviewSvg, setReactionPreviewSvg] = useState<string | null>(null);
  const [reactionBaseSvg, setReactionBaseSvg] = useState<string | null>(null);
  const [reactionHighlightSvg, setReactionHighlightSvg] = useState<string | null>(null);
  const [isRenderingSvg, setIsRenderingSvg] = useState(false);
  const [rdkitError, setRdkitError] = useState<string | null>(null);
  const [resolvedReaction, setResolvedReaction] = useState<ReactionResolutionResult | null>(null);
  const autoPreviewTimeoutRef = useRef<number | null>(null);
  const skipAutoPreviewRef = useRef(false);
  const geminiReady = isGeminiInitialized();
  const [showHighlights, setShowHighlights] = useState(false);
  const [viewMode, setViewMode] = useState<ReactionViewMode>('svg');
  const [kekuleRenderType, setKekuleRenderType] = useState<'R2D' | 'R3D'>('R2D');
  const [kekuleDisplayType, setKekuleDisplayType] = useState<'SKELETAL' | 'CONDENSED' | 'WIRE' | 'STICKS' | 'BALL_STICK' | 'SPACE_FILL'>('SKELETAL');
  const [kekulePreset, setKekulePreset] = useState<'fullFunc' | 'basic' | 'editOnly' | 'static'>('basic');
  const [atomColor, setAtomColor] = useState('#000000');
  const [bondColor, setBondColor] = useState('#000000');
  const [reactionSmilesForCanvas, setReactionSmilesForCanvas] = useState<string | null>(null);
  const [showKekuleCanvas, setShowKekuleCanvas] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);

  // Name Reaction API state
  const [showNameReactionExplorer, setShowNameReactionExplorer] = useState(false);
  const [nameReactionMode, setNameReactionMode] = useState<'name' | 'reactant' | 'product'>('name');
  const [nameReactionQuery, setNameReactionQuery] = useState('');
  const [nameReactionResult, setNameReactionResult] = useState<string | null>(null);
  const [nameReactionEntries, setNameReactionEntries] = useState<NameReactionEntry[]>([]);
  const [nameReactionSuggestions, setNameReactionSuggestions] = useState<string[]>([]);
  const [isFetchingNameReaction, setIsFetchingNameReaction] = useState(false);
  const [nameReactionError, setNameReactionError] = useState<string | null>(null);
  const [nameReactionSvg, setNameReactionSvg] = useState<string | null>(null);
  const nameReactionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reaction prompt state
  const [reactionPrompt, setReactionPrompt] = useState('');
  const [isInterpretingReaction, setIsInterpretingReaction] = useState(false);
  const [interpretedReactionSmiles, setInterpretedReactionSmiles] = useState<string | null>(null);

  // ORD Database state
  const [ordReactions, setOrdReactions] = useState<ORDReaction[]>([]);
  const [isSearchingOrd, setIsSearchingOrd] = useState(false);
  const [ordApiConfigured, setOrdApiConfigured] = useState(false);
  const [ordApiUrl, setOrdApiUrl] = useState<string>('');

  // Function to interpret reaction prompt using Gemini
  const interpretReactionPrompt = useCallback(async () => {
    if (!reactionPrompt.trim() || !geminiReady) {
      return;
    }

    setIsInterpretingReaction(true);
    try {
      const prompt = `Convert this reaction description to a SMILES reaction string with reactants >> products format. 
      Only return the SMILES string, no explanation: "${reactionPrompt.trim()}"`;
      
      const response = await generateTextContent(prompt);
      
      // Extract SMILES from response (assuming it contains the SMILES)
      const smilesMatch = response.match(/[A-Za-z0-9\[\]\(\)\+\-\=\.#@]+>>[A-Za-z0-9\[\]\(\)\+\-\=\.#@]+/);
      if (smilesMatch) {
        const extracted = sanitizeReactionSmilesInput(smilesMatch[0]) ?? smilesMatch[0];
        setInterpretedReactionSmiles(extracted);
        setReactionSmilesForCanvas(stripAtomMappings(extracted)); // Also set for Kekule viewer
      } else {
        // Try to find any SMILES-like string
        const anySmilesMatch = response.match(/[A-Za-z0-9\[\]\(\)\+\-\=\.#@]+/);
        if (anySmilesMatch) {
          const extracted = sanitizeReactionSmilesInput(anySmilesMatch[0]) ?? anySmilesMatch[0];
          setInterpretedReactionSmiles(extracted);
          setReactionSmilesForCanvas(stripAtomMappings(extracted));
        } else {
          throw new Error('Could not extract SMILES from Gemini response');
        }
      }
    } catch (error) {
      console.error('Failed to interpret reaction prompt:', error);
      setError('Failed to interpret reaction prompt. Please try a different description.');
    } finally {
      setIsInterpretingReaction(false);
    }
  }, [reactionPrompt, geminiReady]);

  // ORD Database functions
  const checkOrdApiStatus = useCallback(async () => {
    try {
      const url = ordService.getApiUrl();
      if (url) {
        setOrdApiUrl(url);
        const isWorking = await ordService.testConnection();
        setOrdApiConfigured(isWorking);
      } else {
        setOrdApiConfigured(false);
      }
    } catch (error) {
      console.error('ORD API status check failed:', error);
      setOrdApiConfigured(false);
    }
  }, []);

  const searchOrdReactions = useCallback(async (query: string = '') => {
    if (!ordApiConfigured) {
      setError('ORD API not configured. Please set the API URL in settings.');
      return;
    }

    setIsSearchingOrd(true);
    try {
      const reactions = await ordService.searchReactions(query, 20);
      setOrdReactions(reactions);
      setError(null);
    } catch (error) {
      console.error('ORD search failed:', error);
      setError('Failed to search ORD database. Please check your API configuration.');
      setOrdReactions([]);
    } finally {
      setIsSearchingOrd(false);
    }
  }, [ordApiConfigured]);

  const setOrdApiUrlAndTest = useCallback(async (url: string) => {
    try {
      ordService.setApiUrl(url);
      setOrdApiUrl(url);
      const isWorking = await ordService.testConnection();
      setOrdApiConfigured(isWorking);
      if (isWorking) {
        // Automatically search for some reactions to show it works
        await searchOrdReactions();
      }
    } catch (error) {
      console.error('Failed to set ORD API URL:', error);
      setOrdApiConfigured(false);
    }
  }, [searchOrdReactions]);

  // Initialize ORD API URL and configuration on component mount
  useEffect(() => {
    const initializeOrdApi = async () => {
      const storedUrl = ordService.getApiUrl();
      if (storedUrl) {
        setOrdApiUrl(storedUrl);
        try {
          const isWorking = await ordService.testConnection();
          setOrdApiConfigured(isWorking);
        } catch (error) {
          console.warn('Failed to test stored ORD API URL:', error);
          setOrdApiConfigured(false);
        }
      }
    };
    initializeOrdApi();
  }, []);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<ReactionDatabaseEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isUsingSuggestion, setIsUsingSuggestion] = useState(false);

  const selectedReactionSvg =
    showHighlights && reactionHighlightSvg
      ? reactionHighlightSvg ?? reactionPreviewSvg ?? reactionBaseSvg
      : reactionBaseSvg ?? reactionPreviewSvg ?? reactionHighlightSvg;

  const hasStructuredView = Boolean(
    resolvedReaction?.components?.some(component => component.smiles?.trim())
  );

  const canShowSvg = Boolean(selectedReactionSvg);
  const canShowKekule = Boolean(reactionSmilesForCanvas?.trim());
  const canShowReactMol = Boolean(reactionSmilesForCanvas?.trim());
  const canShowAnimated = Boolean(resolvedReaction?.components?.length);

  useEffect(() => {
    const availability: Record<ReactionViewMode, boolean> = {
      structured: hasStructuredView,
      svg: canShowSvg,
      kekule: canShowKekule,
      animated: canShowAnimated,
      reactMol: canShowReactMol
    };

    const fallbackOrder: ReactionViewMode[] = ['structured', 'reactMol', 'animated', 'svg', 'kekule'];

    setViewMode(prev => {
      if (availability[prev]) {
        return prev;
      }
      const next = fallbackOrder.find(mode => availability[mode]);
      return next ?? prev;
    });
  }, [hasStructuredView, canShowSvg, canShowKekule, canShowAnimated, canShowReactMol]);

  useEffect(() => {
    if (showKekuleCanvas && (!canShowKekule || viewMode !== 'kekule')) {
      setShowKekuleCanvas(false);
    }
  }, [showKekuleCanvas, canShowKekule, viewMode]);

  const viewOptions: Array<{ value: ReactionViewMode; label: string; disabled: boolean }> = [
    { value: 'structured', label: 'Structured view', disabled: !hasStructuredView },
    { value: 'reactMol', label: 'React-Mol simulation', disabled: !canShowReactMol },
    { value: 'animated', label: 'Animated 3D', disabled: !canShowAnimated },
    { value: 'svg', label: 'Original SVG', disabled: !canShowSvg },
    { value: 'kekule', label: 'Kekule canvas', disabled: !canShowKekule }
  ];

  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container) {
      return;
    }

    const svgElement = container.querySelector<SVGSVGElement>('svg');
    if (!svgElement) {
      return;
    }

    svgElement.removeAttribute('width');
    svgElement.removeAttribute('height');
    svgElement.style.width = '100%';
    svgElement.style.height = 'auto';
    svgElement.style.maxWidth = '100%';
    svgElement.style.display = 'block';

    const viewBox = svgElement.getAttribute('viewBox');
    if (!viewBox) {
      try {
        const { width, height } = svgElement.getBBox();
        if (width > 0 && height > 0) {
          svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
      } catch (err) {
        console.warn('Unable to derive viewBox for reaction SVG:', err);
      }
    }
  }, [selectedReactionSvg, showHighlights]);

  // Autocomplete functions
  const updateSuggestions = useCallback(async (input: string) => {
    if (isUsingSuggestion) return; // Don't show suggestions when using a suggestion

    try {
      const trimmed = input.trim();
      const [coreSuggestions, hfNameSuggestions] = await Promise.all([
        getReactionSuggestions(input, 8),
        trimmed.length > 0 ? autocompleteReactionNames(trimmed).catch(() => []) : Promise.resolve([])
      ]);

      const hfEntries: ReactionDatabaseEntry[] = (hfNameSuggestions ?? []).map((name, index) => ({
        id: `hf-name:${name.toLowerCase()}-${index}`,
        name,
        description: 'Named reaction from HuggingFace dataset',
        reactionSmiles: '',
        category: 'Named Reactions',
        difficulty: 'intermediate',
        tags: ['named reaction', 'hf-dataset'],
        source: 'local',
        defaultQuery: name,
        metadata: {
          dataset: 'HuggingFace Name Reaction API',
          sourceUrl: 'https://huggingface.co/spaces/smitathkr1/namereaction-api'
        }
      }));

      const merged = new Map<string, ReactionDatabaseEntry>();

      const addEntry = (entry: ReactionDatabaseEntry) => {
        const key = entry.reactionSmiles && entry.reactionSmiles.trim().length > 0
          ? `${entry.source}:${entry.reactionSmiles.toLowerCase()}`
          : `${entry.source}:${entry.name.toLowerCase()}`;
        if (!merged.has(key)) {
          merged.set(key, entry);
        }
      };

      coreSuggestions.forEach(addEntry);
      hfEntries.forEach(addEntry);

      const mergedSuggestions = Array.from(merged.values()).slice(0, 12);

      setSuggestions(mergedSuggestions);
      setShowSuggestions(mergedSuggestions.length > 0 && input.length > 0);
      setSelectedSuggestionIndex(-1);
    } catch (error) {
      console.warn('Failed to fetch reaction suggestions:', error);
      // Fallback to empty suggestions
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [isUsingSuggestion]);

  const selectSuggestion = useCallback((suggestion: ReactionDatabaseEntry) => {
    setIsUsingSuggestion(true);
    const nextInput = suggestion.defaultQuery?.trim() || suggestion.reactionSmiles || suggestion.description || suggestion.name;
    setReactionInput(nextInput);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);

    // Reset the flag after a short delay
    setTimeout(() => setIsUsingSuggestion(false), 100);
  }, []);

  const renderResolvedReaction = useCallback(async (resolution: ReactionResolutionResult | null, fallbackSmiles: string) => {
    const targetSmiles = resolution?.reactionSmiles ?? fallbackSmiles;
  const sanitizedSmiles = sanitizeReactionSmilesInput(targetSmiles) ?? targetSmiles;
  const displaySmiles = stripAtomMappings(sanitizedSmiles) || sanitizedSmiles;

    if (!sanitizedSmiles) {
      throw new Error('No reaction SMILES available.');
    }

    if (isMountedRef.current) {
      setResolvedReaction(resolution);
  setReactionSmilesForCanvas(displaySmiles);
      setRdkitError(null);
      setIsRenderingSvg(true);
    }

    try {
  const svg = await reactionSmilesToSVG(displaySmiles, 960, 320);
      if (!isMountedRef.current) {
        return;
      }

      if (svg) {
        setReactionBaseSvg(svg);
        setReactionPreviewSvg(svg);
        setReactionHighlightSvg(null);
      } else {
        setReactionBaseSvg(null);
        setReactionPreviewSvg(null);
        setReactionHighlightSvg(null);
        setRdkitError('RDKit could not generate a reaction diagram for the provided SMILES.');
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Failed to render RDKit reaction SVG:', error);
        setReactionBaseSvg(null);
        setReactionPreviewSvg(null);
        setReactionHighlightSvg(null);
        setRdkitError('Failed to render reaction diagram with RDKit.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsRenderingSvg(false);
      }
    }
  }, [reactionSmilesToSVG]);

  const renderSourceBadge = useCallback((source: ReactionDatabaseEntry['source']) => {
    switch (source) {
      case 'pubchem':
        return (
          <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full">
            PubChem
          </span>
        );
      case 'ord':
        return (
          <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-300 rounded-full">
            ORD
          </span>
        );
      case 'kegg':
        return (
          <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded-full">
            KEGG
          </span>
        );
      case 'compound':
        return (
          <span className="px-1.5 py-0.5 text-xs bg-teal-500/20 text-teal-300 rounded-full">
            Compound
          </span>
        );
      case 'local':
      default:
        return (
          <span className="px-1.5 py-0.5 text-xs bg-slate-500/20 text-slate-300 rounded-full">
            Local
          </span>
        );
    }
  }, []);

  const fetchNameReactionSuggestions = useCallback(async (query: string, mode: 'name' | 'reactant' | 'product') => {
    if (!query.trim()) {
      setNameReactionSuggestions([]);
      return;
    }

    try {
      let results: string[] = [];
      switch (mode) {
        case 'reactant':
          results = await autocompleteReactants(query);
          break;
        case 'product':
          results = await autocompleteProducts(query);
          break;
        case 'name':
        default:
          results = await autocompleteReactionNames(query);
          break;
      }
      setNameReactionSuggestions(results ?? []);
    } catch (error) {
      console.warn('Failed to fetch Name Reaction suggestions:', error);
      setNameReactionSuggestions([]);
    }
  }, []);

  const handleNameReactionQueryChange = useCallback((value: string) => {
    setNameReactionQuery(value);
    setNameReactionError(null);
    setNameReactionResult(null);
    setNameReactionEntries([]);
    setNameReactionSvg(null);

    if (nameReactionDebounceRef.current) {
      clearTimeout(nameReactionDebounceRef.current);
      nameReactionDebounceRef.current = null;
    }

    if (!value.trim()) {
      setNameReactionSuggestions([]);
      return;
    }

    nameReactionDebounceRef.current = setTimeout(() => {
      fetchNameReactionSuggestions(value.trim(), nameReactionMode).catch(err => {
        console.warn('Name Reaction autocomplete failed:', err);
      });
    }, 300);
  }, [fetchNameReactionSuggestions, nameReactionMode]);

  const handleNameReactionModeChange = useCallback((mode: 'name' | 'reactant' | 'product') => {
    setNameReactionMode(mode);
    setNameReactionSuggestions([]);
    setNameReactionError(null);
    setNameReactionResult(null);
    setNameReactionEntries([]);
    setNameReactionSvg(null);

    if (nameReactionDebounceRef.current) {
      clearTimeout(nameReactionDebounceRef.current);
      nameReactionDebounceRef.current = null;
    }

    if (nameReactionQuery.trim()) {
      nameReactionDebounceRef.current = setTimeout(() => {
        fetchNameReactionSuggestions(nameReactionQuery.trim(), mode).catch(err => {
          console.warn('Name Reaction autocomplete failed:', err);
        });
      }, 0);
    }
  }, [fetchNameReactionSuggestions, nameReactionQuery]);

  const applyNameReactionSuggestion = useCallback((suggestion: string) => {
    setNameReactionQuery(suggestion);
    setNameReactionSuggestions([]);
  }, []);

  const handleFetchNameReaction = useCallback(async () => {
    const trimmedQuery = nameReactionQuery.trim();
    if (!trimmedQuery) {
      setNameReactionError('Please enter a search term.');
      return;
    }

    setIsFetchingNameReaction(true);
    setNameReactionError(null);
    setNameReactionResult(null);
    setNameReactionEntries([]);
    setNameReactionSvg(null);

    try {
      let markdown: string;
      switch (nameReactionMode) {
        case 'reactant':
          markdown = await searchReactionByReactant(trimmedQuery);
          break;
        case 'product':
          markdown = await searchReactionByProduct(trimmedQuery);
          break;
        case 'name':
        default:
          markdown = await searchReactionByName(trimmedQuery);
          break;
      }

      setNameReactionResult(markdown);
      setNameReactionEntries(parseNameReactionResponse(markdown));

      if (nameReactionMode === 'name') {
        try {
          const svgContent = await generateReactionSvg(trimmedQuery);
          if (svgContent?.trim()) {
            setNameReactionSvg(svgContent);
          }
        } catch (svgError) {
          console.warn('Failed to fetch reaction SVG:', svgError);
        }
      }
    } catch (error) {
      setNameReactionEntries([]);
      if (error instanceof NameReactionApiError) {
        setNameReactionError(error.message);
      } else {
        console.error('Failed to fetch Name Reaction data:', error);
        setNameReactionError('Failed to fetch reaction data. Please try again.');
      }
    } finally {
      setIsFetchingNameReaction(false);
    }
  }, [nameReactionMode, nameReactionQuery]);

  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setReactionInput(value);
    await updateSuggestions(value);
  }, [updateSuggestions]);

  const handleGetReaction = useCallback(async ({
    preservePreview = false,
    silentValidation = false
  }: { preservePreview?: boolean; silentValidation?: boolean } = {}) => {
    const trimmedInput = reactionInput.trim();
    const candidateInput = trimmedInput.includes('>')
      ? sanitizeReactionSmilesInput(trimmedInput) ?? trimmedInput
      : trimmedInput;
    if (!trimmedInput) {
      if (!silentValidation) {
        setError('Please enter a reaction SMILES string');
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    if (!preservePreview) {
      setReactionPreviewSvg(null);
      setReactionBaseSvg(null);
      setReactionHighlightSvg(null);
      setResolvedReaction(null);
      setReactionSmilesForCanvas(null);
      setRdkitError(null);
    }

    try {
      const resolution = await resolveReactionQuery(candidateInput);
      const resolvedSmiles = resolution?.reactionSmiles ?? candidateInput;

      const sanitizedResolutionSmiles = resolution?.reactionSmiles
        ? sanitizeReactionSmilesInput(resolution.reactionSmiles) ?? resolution.reactionSmiles
        : null;

      if (
        sanitizedResolutionSmiles &&
        sanitizedResolutionSmiles !== trimmedInput &&
        sanitizedResolutionSmiles !== candidateInput
      ) {
        skipAutoPreviewRef.current = true;
  setReactionInput(stripAtomMappings(sanitizedResolutionSmiles));
      }

      await renderResolvedReaction(resolution, sanitizedResolutionSmiles ?? resolvedSmiles);
    } catch (err) {
      console.error('Failed to parse reaction:', err);
      setReactionPreviewSvg(null);
      setReactionBaseSvg(null);
      setReactionHighlightSvg(null);
      setReactionSmilesForCanvas(null);
      setIsRenderingSvg(false);
      setRdkitError('Unable to interpret or render the reaction.');
      setError(err instanceof Error ? err.message : 'Failed to interpret the reaction. Try providing a clearer description or SMILES string.');
    } finally {
      setIsLoading(false);
    }
  }, [reactionInput, renderResolvedReaction]);

  const handleResolveReactionName = useCallback(async () => {
    const trimmedName = reactionName.trim();
    if (!trimmedName) {
      setError('Enter a reaction name to interpret.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setReactionPreviewSvg(null);
    setReactionBaseSvg(null);
    setReactionHighlightSvg(null);
    setResolvedReaction(null);
    setReactionSmilesForCanvas(null);
    setRdkitError(null);

    try {
      const resolution = await resolveReactionByName(trimmedName);
      if (!resolution?.reactionSmiles) {
        throw new Error('Gemini did not return a reaction scheme for that name.');
      }

      skipAutoPreviewRef.current = true;
      setReactionInput(sanitizeReactionSmilesInput(resolution.reactionSmiles) ?? resolution.reactionSmiles);
      await renderResolvedReaction(resolution, resolution.reactionSmiles);
      setReactionName('');
    } catch (err) {
      console.error('Failed to resolve reaction name:', err);
      setReactionPreviewSvg(null);
      setReactionBaseSvg(null);
      setReactionHighlightSvg(null);
      setReactionSmilesForCanvas(null);
      setIsRenderingSvg(false);
      setRdkitError('Unable to resolve or render the named reaction.');
      setError(err instanceof Error ? err.message : 'Unable to interpret that reaction name. Try adding more detail or an example.');
    } finally {
      setIsLoading(false);
    }
  }, [reactionName, renderResolvedReaction]);

  const handleInsertReaction = useCallback((withSDF: boolean) => {
    if (reactionBaseSvg && onReactionInsert) {
      onReactionInsert({
        type: 'reaction',
        svg: reactionBaseSvg,
        highlightSvg: reactionHighlightSvg,
        previewSvg: reactionPreviewSvg,
        smiles: resolvedReaction?.reactionSmiles ?? reactionInput,
        includeSDF: withSDF,
        metadata: resolvedReaction
          ? {
              originalQuery: reactionInput,
              usedGemini: resolvedReaction.usedGemini,
              components: resolvedReaction.components,
              confidence: resolvedReaction.confidence,
              notes: resolvedReaction.notes,
              reactionName: resolvedReaction.reactionName,
              reactionDescription: resolvedReaction.reactionDescription,
              reactionSmilesWithConditions: resolvedReaction.reactionSmilesWithConditions,
              conditions: resolvedReaction.conditions,
              structuredPayload: resolvedReaction.structuredPayload
            }
          : undefined,
        timestamp: Date.now()
      });
      onClose();
    }
  }, [reactionBaseSvg, reactionHighlightSvg, reactionPreviewSvg, reactionInput, onReactionInsert, onClose, resolvedReaction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex(prev =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
          return;
        case 'Enter':
          if (selectedSuggestionIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[selectedSuggestionIndex]);
            return;
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
          return;
        case 'Tab':
          if (selectedSuggestionIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[selectedSuggestionIndex]);
            return;
          }
          break;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGetReaction();
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, selectSuggestion, handleGetReaction]);

  useEffect(() => {
    if (skipAutoPreviewRef.current) {
      skipAutoPreviewRef.current = false;
      return;
    }

    const trimmed = reactionInput.trim();

    if (autoPreviewTimeoutRef.current) {
      window.clearTimeout(autoPreviewTimeoutRef.current);
    }

    if (!trimmed) {
      setReactionPreviewSvg(null);
      setReactionBaseSvg(null);
      setReactionHighlightSvg(null);
      setResolvedReaction(null);
      setReactionSmilesForCanvas(null);
      setIsRenderingSvg(false);
      setRdkitError(null);
      return;
    }

    autoPreviewTimeoutRef.current = window.setTimeout(() => {
      autoPreviewTimeoutRef.current = null;
      void handleGetReaction({ preservePreview: true, silentValidation: true });
    }, 700);

    return () => {
      if (autoPreviewTimeoutRef.current) {
        window.clearTimeout(autoPreviewTimeoutRef.current);
        autoPreviewTimeoutRef.current = null;
      }
    };
  }, [reactionInput, handleGetReaction]);

  // Check ORD API status on mount
  useEffect(() => {
    checkOrdApiStatus();
  }, [checkOrdApiStatus]);

  useEffect(() => {
    return () => {
      if (nameReactionDebounceRef.current) {
        clearTimeout(nameReactionDebounceRef.current);
        nameReactionDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 bg-slate-950/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="text-emerald-400" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-white">Reaction Search</h2>
              <p className="text-sm text-slate-400">
                Enter SMILES or describe the transformation �?? Gemini will propose the scheme.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-2 text-slate-300 transition hover:border-rose-500/70 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-[calc(90vh-80px)]">
          {/* Input Section */}
          <div className="border-b border-slate-700/60 bg-slate-900/70 p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="reaction-name-input" className="block text-sm font-medium text-slate-300 mb-2">
                  Reaction Name
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    id="reaction-name-input"
                    type="text"
                    value={reactionName}
                    onChange={(event) => setReactionName(event.target.value)}
                    placeholder="e.g., Fischer esterification, Diels-Alder reaction"
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleResolveReactionName}
                    disabled={isLoading || !reactionName.trim() || !geminiReady}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900"
                    title={geminiReady ? undefined : 'Add your Gemini API key in Settings to enable reaction-name lookup.'}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Interpret Name
                  </button>
                </div>
                {!geminiReady && (
                  <p className="mt-2 text-xs text-amber-300">
                    Configure your Gemini API key in Settings to convert reaction names into SMILES automatically.
                  </p>
                )}
              </div>
              <div>
                  <label htmlFor="reaction-input" className="block text-sm font-medium text-slate-300 mb-2">
                    Reaction Query
                </label>
                <div className="relative">
                  <textarea
                    id="reaction-input"
                    value={reactionInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (suggestions.length > 0 && reactionInput.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay hiding suggestions to allow for clicks
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    placeholder="Type reaction SMILES or describe it (e.g., 'aldol condensation of acetone and benzaldehyde')"
                    className="w-full h-24 px-3 py-2 bg-slate-800/70 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none resize-none"
                    disabled={isLoading}
                  />

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-600 bg-slate-800/95 shadow-xl backdrop-blur-sm">
                      <div className="p-2 border-b border-slate-700/60">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Database size={12} />
                          <span>Reaction Database ({suggestions.length} suggestions)</span>
                        </div>
                      </div>
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id}
                          onClick={() => selectSuggestion(suggestion)}
                          className={`w-full px-3 py-2 text-left hover:bg-slate-700/70 transition-colors ${
                            index === selectedSuggestionIndex ? 'bg-emerald-600/20 border-l-2 border-emerald-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white text-sm truncate">
                                  {suggestion.name}
                                </span>
                                <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                                  suggestion.difficulty === 'basic' ? 'bg-green-500/20 text-green-400' :
                                  suggestion.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-red-500/20 text-red-400'
                                }`}>
                                  {suggestion.difficulty}
                                </span>
                                {renderSourceBadge(suggestion.source)}
                              </div>
                              <p className="text-xs text-slate-400 truncate mb-1">
                                {suggestion.description}
                              </p>
                              {(suggestion.metadata?.conditions?.length || typeof suggestion.metadata?.yield === 'number' || suggestion.metadata?.enzyme) && (
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                  {suggestion.metadata?.conditions?.slice(0, 2).map(condition => (
                                    <span key={condition} className="rounded bg-slate-700/40 px-1.5 py-0.5 text-slate-200">
                                      {condition}
                                    </span>
                                  ))}
                                  {suggestion.metadata?.conditions && suggestion.metadata.conditions.length > 2 && (
                                    <span className="rounded bg-slate-700/20 px-1.5 py-0.5 text-slate-300">
                                      +{suggestion.metadata.conditions.length - 2} more
                                    </span>
                                  )}
                                  {typeof suggestion.metadata?.yield === 'number' && (
                                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                                      {(suggestion.metadata.yield * 100).toFixed(0)}% yield
                                    </span>
                                  )}
                                  {suggestion.metadata?.enzyme && (
                                    <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-indigo-300">
                                      Enzyme: {suggestion.metadata.enzyme}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-500">{suggestion.category}</span>
                                {suggestion.tags.length > 0 && (
                                  <>
                                    <span className="text-slate-600">•</span>
                                    <div className="flex gap-1">
                                      {suggestion.tags.slice(0, 2).map(tag => (
                                        <span key={tag} className="px-1 py-0.5 text-xs bg-slate-700/50 text-slate-300 rounded">
                                          {tag}
                                        </span>
                                      ))}
                                      {suggestion.tags.length > 2 && (
                                        <span className="text-xs text-slate-500">+{suggestion.tags.length - 2}</span>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            {index === selectedSuggestionIndex && (
                              <Check size={16} className="text-emerald-400 flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </button>
                      ))}
                      <div className="p-2 border-t border-slate-700/60">
                        <p className="text-xs text-slate-500 text-center">
                          Use ↑↓ to navigate, Enter/Tab to select, Esc to close
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Use '&gt;&gt;' to separate reactants from products. Press Enter to generate reaction.
                </p>
              </div>

              {/* Browse Reactions Button */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const allReactions = await getReactionSuggestions('', 20);
                        setSuggestions(allReactions);
                        setShowSuggestions(true);
                        setReactionInput('');
                      } catch (error) {
                        console.warn('Failed to fetch all reactions:', error);
                        // Fallback to local database
                        setSuggestions(REACTION_DATABASE);
                        setShowSuggestions(true);
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white rounded-lg border border-slate-600/50 hover:border-slate-500/70 transition-colors"
                  >
                    <Database size={14} />
                    Browse All Reactions
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setShowNameReactionExplorer(prev => {
                        const next = !prev;
                        if (!next) {
                          setNameReactionSuggestions([]);
                          setNameReactionError(null);
                          setNameReactionResult(null);
                          setNameReactionEntries([]);
                          setNameReactionSvg(null);
                        }
                        return next;
                      })
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      showNameReactionExplorer
                        ? 'bg-emerald-600/90 text-white border-emerald-500 hover:bg-emerald-500'
                        : 'bg-slate-800/60 text-slate-200 border-emerald-500/40 hover:border-emerald-400 hover:text-white'
                    }`}
                    title="Search 800+ named reactions with reagents and products"
                  >
                    <Search size={14} />
                    {showNameReactionExplorer ? 'Hide Named Reactions' : 'Fetch Named Reactions'}
                  </button>
                </div>
                <div className="text-xs text-slate-500 text-right">
                  <div>Connected to PubChem · KEGG · ORD datasets</div>
                  <div className="text-emerald-300/80">HuggingFace Name Reaction API · 800+ reactions</div>
                </div>
              </div>

              {showNameReactionExplorer && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-slate-800/50 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                      <Search size={16} />
                      Fetch reactions with reagents, products, and conditions
                    </div>
                    <div className="flex items-center gap-2">
                      {(['name', 'reactant', 'product'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleNameReactionModeChange(mode)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            nameReactionMode === mode
                              ? 'bg-emerald-500/90 text-white border-emerald-400'
                              : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:border-emerald-400/60'
                          }`}
                        >
                          {mode === 'name' ? 'By Reaction' : mode === 'reactant' ? 'By Reactant' : 'By Product'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={nameReactionQuery}
                      onChange={(event) => handleNameReactionQueryChange(event.target.value)}
                      placeholder={
                        nameReactionMode === 'name'
                          ? 'e.g., Appel reaction, Claisen rearrangement'
                          : nameReactionMode === 'reactant'
                            ? 'e.g., benzaldehyde, allyl bromide'
                            : 'e.g., lactone, alkene'
                      }
                      className="w-full rounded-lg border border-emerald-500/30 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
                      autoComplete="off"
                    />

                    {nameReactionSuggestions.length > 0 && (
                      <div className="absolute z-40 mt-2 max-h-48 w-full overflow-y-auto rounded-lg border border-emerald-500/30 bg-slate-900/95 shadow-xl">
                        {nameReactionSuggestions.map(suggestion => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => applyNameReactionSuggestion(suggestion)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 hover:bg-emerald-500/10"
                          >
                            <span className="truncate">{suggestion}</span>
                            <ArrowRight size={14} className="text-emerald-300 flex-shrink-0 ml-2" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleFetchNameReaction()}
                      disabled={isFetchingNameReaction || !nameReactionQuery.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900"
                    >
                      {isFetchingNameReaction ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      {isFetchingNameReaction ? 'Fetching...' : 'Fetch Reaction Data'}
                    </button>
                    <p className="text-xs text-slate-400">
                      Data sourced from HuggingFace Name Reaction API (828 named reactions)
                    </p>
                  </div>

                  {nameReactionError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      <AlertCircle size={16} className="mt-0.5" />
                      <span>{nameReactionError}</span>
                    </div>
                  )}

                  {nameReactionEntries.length > 0 ? (
                    <div className="space-y-4">
                      {nameReactionEntries.map((entry, index) => {
                        const reactionLabel = entry.reactionName || `Reaction ${index + 1}`;
                        const renderSection = (
                          title: string,
                          content: string,
                          smiles: string[]
                        ) => (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
                              {title}
                            </p>
                            <p className="text-sm text-slate-200 whitespace-pre-line">{content || '—'}</p>
                            {smiles.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {smiles.map((smile, smileIndex) => (
                                  <code
                                    key={`${title}-${smile}-${smileIndex}`}
                                    className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-100"
                                  >
                                    {smile}
                                  </code>
                                ))}
                              </div>
                            )}
                          </div>
                        );

                        return (
                          <div
                            key={`${reactionLabel}-${index}`}
                            className="space-y-4 rounded-lg border border-emerald-500/30 bg-slate-900/70 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h4 className="text-lg font-semibold text-emerald-100">{reactionLabel}</h4>
                                <p className="text-xs uppercase tracking-wide text-slate-400">
                                  Named Reaction · HuggingFace dataset
                                </p>
                              </div>
                              {entry.productSmiles.length > 0 && (
                                <div className="text-right">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
                                    Products (SMILES)
                                  </p>
                                  <div className="mt-1 flex flex-wrap justify-end gap-1.5">
                                    {entry.productSmiles.map((smile, smileIndex) => (
                                      <code
                                        key={`product-${smile}-${smileIndex}`}
                                        className="rounded bg-slate-800/80 px-2 py-0.5 text-xs text-emerald-200"
                                      >
                                        {smile}
                                      </code>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {entry.description && (
                              <p className="text-sm leading-relaxed text-slate-200">
                                {entry.description}
                              </p>
                            )}

                            <div className="grid gap-4 md:grid-cols-3">
                              {renderSection('Reactants', entry.reactants, entry.reactantSmiles)}
                              {renderSection('Reagents', entry.reagents, entry.reagentSmiles)}
                              {renderSection('Products', entry.products, entry.productSmiles)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : nameReactionResult ? (
                    <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-slate-900/70 p-3">
                      <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                        <ReactMarkdown>{nameReactionResult}</ReactMarkdown>
                      </div>
                    </div>
                  ) : null}

                  {nameReactionSvg && (
                    <div className="rounded-lg border border-emerald-500/20 bg-slate-900/70 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
                        Reaction Diagram
                      </div>
                      <div
                        className="overflow-x-auto"
                        // SVG returned by trusted API endpoint; ensure content remains SVG before rendering
                        dangerouslySetInnerHTML={{ __html: nameReactionSvg }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleGetReaction()}
                  disabled={isLoading || !reactionInput.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                  {isLoading ? 'Generating...' : 'Get Reaction'}
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleInsertReaction(false)}
                    disabled={!reactionBaseSvg || isLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                      reactionBaseSvg && !isLoading
                        ? 'border-slate-600 bg-slate-800/80 text-slate-100 hover:border-emerald-500/70 hover:text-white'
                        : 'border-slate-700/70 bg-slate-800/50 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <ArrowRight size={16} />
                    Insert 2D Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertReaction(true)}
                    disabled={!reactionBaseSvg || isLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                      reactionBaseSvg && !isLoading
                        ? 'border-blue-500/70 bg-blue-600 text-white shadow-lg hover:bg-blue-500'
                        : 'border-blue-900/60 bg-slate-800/50 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Database size={16} />
                    Insert With 3D Models
                  </button>
                </div>
              </div>

              {reactionBaseSvg && (
                <p className="mt-2 flex items-center gap-2 text-xs text-blue-300">
                  <Database size={14} />
                  Select “Insert With 3D Models” to drop SDF tiles for each reactant and product beneath the scheme. You can also add them later from the reaction inspector.
                </p>
              )}

              {resolvedReaction && (
                <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-800/60 p-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <Wand2 size={14} className="mt-0.5 text-emerald-300" />
                    <div className="space-y-2">
                      <div>
                        <span className="text-slate-400">Resolved SMILES:</span>
                        <p className="mt-1 break-all font-mono text-[11px] text-emerald-300">
                          {resolvedReaction.reactionSmiles}
                        </p>
                      </div>
                      {resolvedReaction.reactionSmilesWithConditions && (
                        <div>
                          <span className="text-slate-400">Reaction SMILES (with conditions):</span>
                          <p className="mt-1 break-all font-mono text-[11px] text-sky-300">
                            {resolvedReaction.reactionSmilesWithConditions}
                          </p>
                        </div>
                      )}
                      {resolvedReaction.reactionName && (
                        <div>
                          <span className="text-slate-400">Reaction Name:</span>
                          <p className="mt-1 text-sm text-slate-200">{resolvedReaction.reactionName}</p>
                        </div>
                      )}
                      {resolvedReaction.conditions && resolvedReaction.conditions.length > 0 && (
                        <div>
                          <span className="text-slate-400">Conditions:</span>
                          <ul className="mt-1 list-inside list-disc space-y-1 text-[11px] text-slate-200">
                            {resolvedReaction.conditions.map((condition, index) => (
                              <li key={`${condition}-${index}`}>{condition}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {resolvedReaction.usedGemini && (
                        <p className="text-[11px] text-blue-300">
                          Interpreted with Gemini to identify reactants/products.
                        </p>
                      )}
                      {typeof resolvedReaction.confidence === 'number' && (
                        <p className="text-[11px] text-slate-400">
                          Confidence: {(resolvedReaction.confidence * 100).toFixed(0)}%
                        </p>
                      )}
                      {resolvedReaction.reactionDescription && (
                        <div>
                          <span className="text-slate-400">Description:</span>
                          <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-300">
                            {resolvedReaction.reactionDescription}
                          </p>
                        </div>
                      )}
                      {resolvedReaction.notes && resolvedReaction.notes !== resolvedReaction.reactionDescription && (
                        <p className="text-[11px] text-slate-400">{resolvedReaction.notes}</p>
                      )}
                      {resolvedReaction.components.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-slate-400">Components:</p>
                          <ul className="space-y-1">
                            {resolvedReaction.components.map((component, index) => (
                              <li key={`${component.role}-${index}`} className="flex flex-wrap items-center gap-2">
                                <span className="rounded bg-slate-700/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                                  {component.role}
                                </span>
                                {component.label && (
                                  <span className="text-slate-200">{component.label}</span>
                                )}
                                {component.smiles && (
                                  <code className="text-[11px] text-emerald-300">{component.smiles}</code>
                                )}
                                {!component.smiles && (
                                  <span className="text-[11px] text-rose-300">SMILES not resolved</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {resolvedReaction.components.length > 0 && (
                        <div className="mt-3 space-y-4 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
                          {ROLE_ORDER.map(role => {
                            const items = resolvedReaction.components.filter(component => component.role === role);
                            if (!items.length) {
                              return null;
                            }

                            return (
                              <div key={role} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] uppercase tracking-wide text-slate-400">
                                    {ROLE_LABELS[role]}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                    {items.length} {items.length === 1 ? 'entry' : 'entries'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                  {items.map((component, index) =>
                                    component.smiles ? (
                                      <MoleculeStructure
                                        key={`${role}-${index}-${component.smiles}`}
                                        structure={component.smiles}
                                        legend={component.label ?? component.original ?? component.smiles}
                                        width={180}
                                        height={160}
                                        highlightColour={ROLE_COLOURS[role]}
                                      />
                                    ) : (
                                      <div
                                        key={`${role}-${index}-missing`}
                                        className="flex h-[160px] w-[180px] flex-col items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-center text-[11px] text-rose-200"
                                      >
                                        SMILES unavailable
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                  <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />
                  <p className="text-sm text-rose-200">{error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Reaction Prompt Section */}
          <div className="border-b border-slate-700/60 bg-slate-900/70 p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Reaction Prompt
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Describe reactants/products or provide a named transformation to draw the reaction.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={reactionPrompt}
                    onChange={(e) => setReactionPrompt(e.target.value)}
                    placeholder='e.g. "Aldol condensation of acetone with benzaldehyde"'
                    className="flex-1 rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                    disabled={isInterpretingReaction}
                  />
                  <button
                    onClick={interpretReactionPrompt}
                    disabled={isInterpretingReaction || !reactionPrompt.trim() || !geminiReady}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-900"
                    title={geminiReady ? undefined : 'Add your Gemini API key in Settings to enable reaction interpretation.'}
                  >
                    {isInterpretingReaction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    Interpret Reaction
                  </button>
                </div>
                {!geminiReady && (
                  <p className="mt-2 text-xs text-amber-300">
                    Configure your Gemini API key in Settings to interpret reaction descriptions.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Kekule Reaction Widget */}
          <div className="border-b border-slate-700/60 bg-slate-900/70 p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Kekule.js Reaction Widget</h3>
                <p className="text-xs text-slate-400">Interactive reaction viewer using Kekule.js widget - zoom, rotate, and explore.</p>
              </div>
              
              {interpretedReactionSmiles ? (
                <KekuleReactionViewer
                  reactionSmiles={interpretedReactionSmiles}
                  renderType={kekuleRenderType}
                  moleculeDisplayType={kekuleDisplayType}
                  preset={kekulePreset}
                  atomColor={atomColor}
                  bondColor={bondColor}
                  enableInput={true}
                  height={300}
                />
              ) : (
                <div className="flex items-center justify-center h-64 border border-slate-700/60 rounded-lg bg-slate-800/50">
                  <div className="text-center">
                    <FlaskConical className="mx-auto text-slate-600 mb-2" size={32} />
                    <p className="text-sm text-slate-400">No reaction rendered yet.</p>
                    <p className="text-xs text-slate-500 mt-1">Enter a reaction prompt above to see it displayed in the Kekule.js widget.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ORD Database Section */}
          <div className="border-b border-slate-700/60 bg-slate-900/70 p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Open Reaction Database (ORD)</h3>
                <p className="text-xs text-slate-400">Search thousands of reactions from the ORD using the official ORD Interface API. Provides structured access to reaction data with SMILES, conditions, and metadata.</p>
              </div>

              {!ordApiConfigured ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="url"
                      value={ordApiUrl}
                      onChange={(e) => setOrdApiUrl(e.target.value)}
                      placeholder="http://localhost:5000"
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      onClick={() => setOrdApiUrlAndTest(ordApiUrl)}
                      disabled={!ordApiUrl.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900"
                    >
                      <Check className="h-4 w-4" />
                      Configure API
                    </button>
                  </div>
                  <div className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-3">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">ORD Interface Setup</h4>
                    <div className="text-xs text-slate-400 space-y-2">
                      <div>
                        <p className="font-medium text-slate-300 mb-1">Prerequisites:</p>
                        <p>• PostgreSQL (conda install postgresql)</p>
                        <p>• Node.js/npm for frontend</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-300 mb-1">Installation:</p>
                        <p>• Clone: <code className="text-emerald-300">git clone https://github.com/open-reaction-database/ord-interface.git</code></p>
                        <p>• Install: <code className="text-emerald-300">cd ord-interface && pip install -e '.[tests]'</code></p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-300 mb-1">Database Setup:</p>
                        <p>• Build test DB: <code className="text-emerald-300">./build_test_database.sh</code></p>
                        <p>• (Loads sample ORD data into PostgreSQL)</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-300 mb-1">Run API (choose one):</p>
                        <p className="text-slate-500 mb-1">• Docker (recommended):</p>
                        <p className="ml-2">• <code className="text-emerald-300">docker build -t ord-interface . && docker compose up</code></p>
                        <p className="text-slate-500 mb-1">• Local:</p>
                        <p className="ml-2">• <code className="text-emerald-300">cd ord_interface/api && ORD_INTERFACE_TESTING=TRUE fastapi dev main.py --port=5000</code></p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-300 mb-1">Optional - Run Frontend:</p>
                        <p>• <code className="text-emerald-300">cd app && npm install && npm run serve</code></p>
                        <p>• Access at http://localhost:8080</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Enter the ORD Interface API URL (e.g., http://localhost:5000/api for local development).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      placeholder="Search ORD reactions (e.g., 'aldol', 'coupling', 'CCO')"
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-800/70 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          searchOrdReactions(e.currentTarget.value);
                        }
                      }}
                    />
                    <button
                      onClick={() => searchOrdReactions()}
                      disabled={isSearchingOrd}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900"
                    >
                      {isSearchingOrd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                      Search ORD
                    </button>
                  </div>

                  {ordReactions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-slate-300">ORD Results ({ordReactions.length})</h4>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {ordReactions.map((reaction) => (
                          <div key={reaction.reaction_id} className="rounded-lg border border-slate-700/60 bg-slate-800/50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-400 truncate">ID: {reaction.reaction_id}</p>
                                <p className="text-xs text-emerald-300 font-mono break-all mt-1">
                                  {reaction.reaction_smiles.length > 100
                                    ? `${reaction.reaction_smiles.substring(0, 100)}...`
                                    : reaction.reaction_smiles}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  const sanitized = sanitizeReactionSmilesInput(reaction.reaction_smiles) ?? reaction.reaction_smiles;
                                  setReactionSmilesForCanvas(sanitized);
                                  setInterpretedReactionSmiles(sanitized);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-500 transition"
                              >
                                <ArrowRight className="h-3 w-3" />
                                Use
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Reaction Display */}
          <div className="flex-1 p-6 overflow-x-auto overflow-y-visible">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex flex-wrap gap-1 rounded-md border border-slate-700/60 bg-slate-800/70 p-1 text-xs text-slate-300">
                {viewOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setViewMode(option.value)}
                    disabled={option.disabled}
                    className={`rounded-md px-3 py-1 font-medium transition-colors ${
                      viewMode === option.value
                        ? 'bg-slate-900 text-white shadow'
                        : 'hover:bg-slate-900/60 disabled:opacity-40'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {viewMode === 'svg' && reactionHighlightSvg && (
                <button
                  onClick={() => setShowHighlights(prev => !prev)}
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                    showHighlights
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                      : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:border-emerald-500/60 hover:text-emerald-200'
                  }`}
                >
                  {showHighlights ? 'Hide highlights' : 'Show highlights'}
                </button>
              )}
              {viewMode === 'kekule' && canShowKekule && (
                <button
                  onClick={() => setShowKekuleCanvas(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20"
                >
                  Open interactive canvas
                </button>
              )}
            </div>

            {isRenderingSvg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-xs text-slate-200">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
                Rendering reaction diagram with RDKit...
              </div>
            )}

            {rdkitError && !isRenderingSvg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4" />
                {rdkitError}
              </div>
            )}

            {(() => {
              const renderStructured = () => (
                <ReactionDiagram resolution={resolvedReaction} fallbackSvg={selectedReactionSvg} />
              );

              const renderSvg = () => (
                <div className="rounded-lg border border-slate-200/40 bg-white p-6 shadow">
                  <div
                    ref={svgContainerRef}
                    className="w-full overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: selectedReactionSvg! }}
                  />
                </div>
              );

              const renderAnimated = () => <ReactionMechanismScene resolution={resolvedReaction} />;

              const renderReactMol = () => (
                <ReactMolReactionViewer
                  reactionSmiles={reactionSmilesForCanvas}
                  resolution={resolvedReaction}
                />
              );

              const renderKekule = () => (
                <div className="space-y-4">
                  {/* Kekule Viewer Controls */}
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200/40 bg-slate-50/50 p-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Render:</label>
                      <select
                        value={kekuleRenderType}
                        onChange={(e) => setKekuleRenderType(e.target.value as 'R2D' | 'R3D')}
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="R2D">2D</option>
                        <option value="R3D">3D</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Display:</label>
                      <select
                        value={kekuleDisplayType}
                        onChange={(e) => setKekuleDisplayType(e.target.value as any)}
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        {kekuleRenderType === 'R2D' ? (
                          <>
                            <option value="SKELETAL">Skeletal</option>
                            <option value="CONDENSED">Condensed</option>
                          </>
                        ) : (
                          <>
                            <option value="WIRE">Wire</option>
                            <option value="STICKS">Sticks</option>
                            <option value="BALL_STICK">Ball & Stick</option>
                            <option value="SPACE_FILL">Space Fill</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Preset:</label>
                      <select
                        value={kekulePreset}
                        onChange={(e) => setKekulePreset(e.target.value as any)}
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="basic">Basic</option>
                        <option value="fullFunc">Full Function</option>
                        <option value="editOnly">Edit Only</option>
                        <option value="static">Static</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Atom Color:</label>
                      <input
                        type="color"
                        value={atomColor}
                        onChange={(e) => setAtomColor(e.target.value)}
                        className="h-8 w-8 rounded border border-slate-300"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Bond Color:</label>
                      <input
                        type="color"
                        value={bondColor}
                        onChange={(e) => setBondColor(e.target.value)}
                        className="h-8 w-8 rounded border border-slate-300"
                      />
                    </div>
                  </div>

                  <KekuleReactionViewer
                    reactionSmiles={reactionSmilesForCanvas}
                    renderType={kekuleRenderType}
                    moleculeDisplayType={kekuleDisplayType}
                    preset={kekulePreset}
                    atomColor={atomColor}
                    bondColor={bondColor}
                    enableInput={true}
                    height={400}
                  />
                </div>
              );

              if (viewMode === 'structured' && hasStructuredView) {
                return renderStructured();
              }

              if (viewMode === 'svg' && canShowSvg) {
                return renderSvg();
              }

              if (viewMode === 'animated' && canShowAnimated) {
                return renderAnimated();
              }

              if (viewMode === 'reactMol' && canShowReactMol) {
                return renderReactMol();
              }

              if (viewMode === 'kekule' && canShowKekule) {
                return renderKekule();
              }

              if (hasStructuredView) {
                return renderStructured();
              }

              if (canShowReactMol) {
                return renderReactMol();
              }

              if (canShowAnimated) {
                return renderAnimated();
              }

              if (canShowSvg) {
                return renderSvg();
              }

              if (canShowKekule) {
                return renderKekule();
              }

              return (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <FlaskConical size={48} className="mb-4 opacity-50" />
                  <h3 className="mb-2 text-lg font-medium">No reaction diagram available</h3>
                  <p className="max-w-md text-sm">
                    Enter a valid reaction SMILES string above and click &ldquo;Get Reaction&rdquo; to visualise the chemical reaction.
                  </p>
                  <div className="mt-6 rounded-lg bg-slate-800/50 p-4 text-left text-xs">
                    <p className="mb-2 font-medium">Example SMILES:</p>
                    <code className="text-emerald-300">CC(=O)O.CCO&gt;&gt;CC(=O)OCC.CC(=O)O</code>
                    <p className="mt-1 text-slate-500">Esterification reaction</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      </div>
      {showKekuleCanvas && (
        <KekuleReactionCanvasModal
          reactionSmiles={reactionSmilesForCanvas}
          onClose={() => setShowKekuleCanvas(false)}
        />
      )}
    </>
  );
};

export default ReactionSearch;
