// PubChem API Service for fetching molecule structures
// Documentation: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest

import ordReactionsDataset from '../data/ordReactions.json';
import type { ReactionMetadata, ReactionSource } from '../types/reactions';

export interface PubChemReaction {
  rid: number;
  name?: string;
  smiles: string;
  reactants: string[];
  products: string[];
  description?: string;
  equation?: string;
  source?: ReactionSource;
  referenceId?: string;
  metadata?: ReactionMetadata;
  defaultQuery?: string;
  tags?: string[];
  categoryHint?: string;
  difficultyHint?: 'basic' | 'intermediate' | 'advanced';
}

export interface PubChemReactionSearchResult {
  reactions: PubChemReaction[];
  totalCount: number;
  searchTerm: string;
}

const PUBCHEM_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov';
const PUBCHEM_PUG_URL = `${PUBCHEM_BASE_URL}/rest/pug`;
const EUTILS_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const ORD_BASE_URL = 'https://open-reaction-database.org/api';

export const DEFAULT_REAGENT_QUERY = 'reagent[Chemical Role]';
export const DEFAULT_BICYCLIC_QUERY =
  '(bicyclo[All Fields] OR bicyclic[All Fields]) AND (chair[Title] OR chair[Description] OR conformer[Title])';

const FALLBACK_BICYCLIC_COMPOUNDS: MoleculeData[] = [
  {
    cid: 7044,
    name: 'Trans-Decalin',
    displayName: 'Trans-Decalin',
    molecularFormula: 'C10H18',
    molecularWeight: 138.25,
    svgUrl: '',
    smiles: 'C1CCC2CCCC[C@@H]2C1',
    sourceQuery: 'fallback:trans-decalin',
  },
  {
    cid: 12736,
    name: 'Cis-Decalin',
    displayName: 'Cis-Decalin',
    molecularFormula: 'C10H18',
    molecularWeight: 138.25,
    svgUrl: '',
    smiles: 'C1CCC2CCCC[C@H]2C1',
    sourceQuery: 'fallback:cis-decalin',
  },
  {
    cid: 111013,
    name: 'Bicyclo[3.3.1]nonane',
    displayName: 'Bicyclo[3.3.1]nonane',
    molecularFormula: 'C9H16',
    molecularWeight: 124.22,
    svgUrl: '',
    smiles: 'C1CC2CCC(C1)C2',
    sourceQuery: 'fallback:bicyclo[3.3.1]nonane',
  },
  {
    cid: 12390,
    name: 'Bicyclo[4.4.0]decane',
    displayName: 'Bicyclo[4.4.0]decane',
    molecularFormula: 'C10H18',
    molecularWeight: 138.25,
    svgUrl: '',
    smiles: 'C1CCC2CCCC2C1',
    sourceQuery: 'fallback:bicyclo[4.4.0]decane',
  },
];

export interface CrystalVisualData {
  atoms: Array<{
    element: string;
    x: number;
    y: number;
    z: number;
  }>;
  bonds: Array<{ from: number; to: number }>;
  cellVertices: Array<{
    x: number;
    y: number;
    z: number;
  }>;
  cellEdges: Array<[number, number]>;
}

export interface MoleculeData {
  name: string;
  cid: number;
  molecularFormula: string;
  molecularWeight: number;
  svgUrl: string;
  svgData?: string;
  smiles: string;
  sdfData?: string; // 2D SDF data
  sdf3DData?: string; // 3D SDF data
  displayName?: string;
  role?: string;
  sourceQuery?: string;
  source?: 'pubchem' | 'cod' | string;
  codId?: string;
  cifData?: string;
  isCrystal?: boolean;
  crystalData?: CrystalVisualData;
  analysis?: any; // Molecule analysis from Gemini API
}

export const fetchCanonicalSmiles = async (input: string): Promise<string | null> => {
  const identifier = input.trim();
  if (!identifier) return null;

  const tryEndpoint = async (endpoint: string): Promise<string | null> => {
    const response = await fetchWithRetry(endpoint);
    if (response && response.ok) {
      try {
        const data = await response.json();
        const canonical = data?.PropertyTable?.Properties?.[0]?.CanonicalSMILES;
        if (typeof canonical === 'string' && canonical.length > 0) {
          return canonical;
        }
      } catch (err) {
        console.warn('⚠️ Failed to parse canonical SMILES response:', err);
      }
    }
    return null;
  };

  // First try treating the input as an existing SMILES string
  const smilesEndpoint = `${PUBCHEM_PUG_URL}/compound/smiles/${encodeURIComponent(identifier)}/property/CanonicalSMILES/JSON`;
  const smilesResult = await tryEndpoint(smilesEndpoint);
  if (smilesResult) {
    console.log('✅ Verified SMILES via PubChem canonicalization');
    return smilesResult;
  }

  // If canonicalization fails, treat the input as a potential compound name
  const isLikelySmiles = /[\[\]@+\-=#()\\/]/.test(identifier) || /[cnops]\d/i.test(identifier);
  if (!isLikelySmiles) {
    const nameEndpoint = `${PUBCHEM_PUG_URL}/compound/name/${encodeURIComponent(identifier)}/property/CanonicalSMILES/JSON`;
    const nameResult = await tryEndpoint(nameEndpoint);
    if (nameResult) {
      console.log('✅ Fetched SMILES from PubChem using compound name');
      return nameResult;
    }
  } else {
    console.warn(`⚠️ Treating input as SMILES; skipping PubChem name lookup: ${identifier}`);
  }

  console.warn(`⚠️ Unable to verify SMILES for input: ${identifier}`);
  return null;
};

import { captureError } from '../utils/errorLogger';

// Helper function for API calls with retry logic
const fetchWithRetry = async (url: string, retries = 3): Promise<Response | null> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 429) {
        // Rate limiting - wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      if (i === retries - 1) {
        void captureError(new Error(`PubChem request failed (${response.status}) ${url}`), 'pubchemService:fetchWithRetry');
        return response; // Return final response
      }
    } catch (error) {
      if (i === retries - 1) {
        void captureError(error, 'pubchemService:fetchWithRetry');
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
    }
  }
  return null;
};

const fetchPreferredSynonym = async (cid: number): Promise<string | null> => {
  const synonymUrl = `${PUBCHEM_PUG_URL}/compound/cid/${cid}/synonyms/JSON`;
  try {
    const response = await fetchWithRetry(synonymUrl);
    if (!response || !response.ok) {
      return null;
    }
    const data = await response.json();
    const synonyms: string[] | undefined =
      data?.InformationList?.Information?.[0]?.Synonym;
    if (!synonyms || synonyms.length === 0) {
      return null;
    }
    const preferred = synonyms.find((syn) => {
      if (!syn || typeof syn !== 'string') return false;
      const trimmed = syn.trim();
      if (!trimmed) return false;
      const upper = trimmed.toUpperCase();
      if (upper.startsWith('CID ')) return false;
      if (upper.startsWith('UNII-')) return false;
      if (/^\d+$/.test(trimmed)) return false;
      return true;
    });
    return (preferred || synonyms[0])?.trim() ?? null;
  } catch (error) {
    console.warn(`?? Failed to fetch synonyms for CID ${cid}:`, error);
    return null;
  }
};

// Search for molecule by name using PubChem PUG REST API
export const searchMolecule = async (moleculeName: string): Promise<number | null> => {
  const rawQuery = moleculeName.trim();
  if (!rawQuery) {
    console.warn('⚠️ Empty molecule search query');
    return null;
  }

  try {
    console.log(`🔍 Searching PubChem for: ${rawQuery}`);

    const attemptParsers = {
      identifierList: (data: any): number | null => {
        const cids = data?.IdentifierList?.CID;
        if (Array.isArray(cids) && cids.length > 0) {
          const cid = Number(cids[0]);
          return Number.isFinite(cid) ? cid : null;
        }
        return null;
      },
      properties: (data: any): number | null => {
        const props = data?.PropertyTable?.Properties ?? data?.properties;
        if (Array.isArray(props) && props.length > 0) {
          const cid = Number(props[0]?.CID);
          return Number.isFinite(cid) ? cid : null;
        }
        return null;
      },
      eutils: (data: any): number | null => {
        const ids = data?.esearchresult?.idlist;
        if (Array.isArray(ids) && ids.length > 0) {
          const cid = Number(ids[0]);
          return Number.isFinite(cid) ? cid : null;
        }
        return null;
      }
    } as const;

    const tryFetch = async (label: string, url: string, parser: (data: any) => number | null) => {
      const response = await fetchWithRetry(url);
      if (!response || !response.ok) {
        console.warn(`⚠️ ${label} request failed with status ${response?.status}`);
        return null;
      }

      try {
        const data = await response.json();
        const cid = parser(data);
        if (cid) {
          console.log(`✅ Found CID ${cid} using ${label}`);
          return cid;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to parse ${label} response`, error);
      }

      return null;
    };

    // 1) Primary: PUG REST compound/name endpoint (handles synonyms and IUPAC names)
    const primaryUrl = `${PUBCHEM_PUG_URL}/compound/name/${encodeURIComponent(rawQuery)}/cids/JSON`;
    let cid = await tryFetch('compound-name lookup', primaryUrl, attemptParsers.identifierList);
    if (cid) return cid;

    // 2) Alternate spellings: try US/UK sulfur/sulphur if applicable
    if (/sulph/i.test(rawQuery)) {
      const swapped = rawQuery.replace(/sulph/gi, 'sulf');
      const swappedUrl = `${PUBCHEM_PUG_URL}/compound/name/${encodeURIComponent(swapped)}/cids/JSON`;
      cid = await tryFetch('alternate spelling lookup', swappedUrl, attemptParsers.identifierList);
      if (cid) return cid;
    } else if (/sulf/i.test(rawQuery)) {
      const swapped = rawQuery.replace(/sulf/gi, 'sulph');
      const swappedUrl = `${PUBCHEM_PUG_URL}/compound/name/${encodeURIComponent(swapped)}/cids/JSON`;
      cid = await tryFetch('alternate spelling lookup', swappedUrl, attemptParsers.identifierList);
      if (cid) return cid;
    }

    // 3) Synonym search (captures brand/legacy names)
    const synonymUrl = `${PUBCHEM_PUG_URL}/compound/synonym/${encodeURIComponent(rawQuery)}/cids/JSON`;
    cid = await tryFetch('synonym lookup', synonymUrl, attemptParsers.identifierList);
    if (cid) return cid;

    // 4) Name-to-property (falls back to property table)
    const propertyUrl = `${PUBCHEM_PUG_URL}/compound/name/${encodeURIComponent(rawQuery)}/property/MolecularFormula/JSON`;
    cid = await tryFetch('property lookup', propertyUrl, attemptParsers.properties);
    if (cid) return cid;

    // 5) Entrez E-utilities search against pccompound (broad fuzzy search)
    const eutilsUrl = `${EUTILS_BASE_URL}/esearch.fcgi?db=pccompound&term=${encodeURIComponent(rawQuery)}&retmode=json&retmax=5`;
    cid = await tryFetch('Entrez search', eutilsUrl, attemptParsers.eutils);
    if (cid) return cid;

    // 6) Final attempt: try quoted term to force exact match
    const quotedQuery = `"${rawQuery}"`;
    if (quotedQuery !== rawQuery) {
      const quotedUrl = `${EUTILS_BASE_URL}/esearch.fcgi?db=pccompound&term=${encodeURIComponent(quotedQuery)}&retmode=json&retmax=5`;
      cid = await tryFetch('exact Entrez search', quotedUrl, attemptParsers.eutils);
      if (cid) return cid;
    }

    console.warn(`❌ No CID found for "${rawQuery}" after all search strategies`);
    return null;
  } catch (error) {
    console.error('❌ Error searching molecule:', error);
    return null;
  }
};

// Fetch detailed molecule information by CID using PUG REST API
export const fetchMoleculeStructure = async (cid: number): Promise<MoleculeData | null> => {
  try {
    console.log(`📋 Fetching properties for CID: ${cid}`);
    
    // Common molecule names mapping for CID
    const cidToName: Record<number, string> = {
      297: 'methane',
      6324: 'ethane',
      241: 'benzene',
      962: 'water',
      783: 'hydrogen',
      977: 'oxygen',
      887: 'methanol',
      702: 'ethanol',
      180: 'acetone',
      5793: 'glucose',
      2519: 'caffeine',
      2244: 'aspirin',
      280: 'carbon dioxide',
      6325: 'ethene',
      6326: 'ethyne',
      6334: 'propane',
      7843: 'butane',
    };

    // Use PUG REST API for compound properties
    // Endpoint: /rest/pug/compound/CID/{cid}/property/{properties}/JSON
    const propertiesUrl = `${PUBCHEM_PUG_URL}/compound/CID/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES/JSON`;
    
    const propsResponse = await fetchWithRetry(propertiesUrl);

    let moleculeData: MoleculeData = {
      name: cidToName[cid] || `Compound ${cid}`,
      cid: cid,
      molecularFormula: 'Unknown',
      molecularWeight: 0,
      smiles: '',
      svgUrl: `${PUBCHEM_PUG_URL}/compound/CID/${cid}/PNG?image_size=400x400`,
      displayName: cidToName[cid] || `CID ${cid}`,
      source: 'pubchem',
    };

    // Try to get properties from API
    if (propsResponse && propsResponse.ok) {
      try {
    const propsData = await propsResponse.json();
    const properties = propsData.properties?.[0];

        if (properties) {
          const preferredName =
            properties.IUPACName ||
            properties.Title ||
            properties.Synonym?.[0] ||
            moleculeData.name;

          moleculeData.name = preferredName || moleculeData.name;
          moleculeData.displayName = preferredName || moleculeData.displayName;
          moleculeData.molecularFormula = properties.MolecularFormula || 'Unknown';
          moleculeData.molecularWeight = properties.MolecularWeight || 0;
          moleculeData.smiles = properties.CanonicalSMILES || '';
          
          console.log(`📊 Fetched properties for ${moleculeData.name}: ${moleculeData.molecularFormula}`);
        }
      } catch (parseError) {
        console.warn(`⚠️ Error parsing properties, using defaults:`, parseError);
      }
    } else {
      console.warn(`⚠️ Could not fetch properties from API, using default data for CID ${cid}`);
    }

    // Fetch SVG structure data asynchronously
    // Use PUG REST API: /rest/pug/compound/CID/{cid}/SVG
    try {
      const svgUrl = `${PUBCHEM_PUG_URL}/compound/CID/${cid}/SVG`;
      const svgResponse = await fetchWithRetry(svgUrl);
      
      if (svgResponse && svgResponse.ok) {
        let svgText = await svgResponse.text();
        if (svgText && svgText.includes('<svg')) {
          // Remove white background from SVG
          // Replace any white fill or rect with white background
          svgText = svgText
            .replace(/\sfill="white"/gi, '')  // Remove white fill attributes
            .replace(/\bfill="fff"/gi, '')    // Remove #fff fills
            .replace(/\bfill="#ffffff"/gi, '') // Remove #ffffff fills
            .replace(/\bfill="#fff"/gi, '')    // Remove #fff fills
            .replace(/<rect[^>]*width="100%"[^>]*height="100%"[^>]*fill="white"[^>]*>/gi, '') // Remove white background rects
            .replace(/<rect[^>]*fill="white"[^>]*width="100%"[^>]*height="100%"[^>]*>/gi, '') // Alternative order
            .replace(/background-color:\s*white/gi, '')
            .replace(/background-color:\s*#ffffff/gi, '')
            .replace(/background-color:\s*#fff/gi, '');
          
          // Ensure SVG has transparent background
          if (!svgText.includes('background')) {
            svgText = svgText.replace('<svg', '<svg style="background: transparent"');
          }
          
          moleculeData.svgData = svgText;
          console.log(`✅ Retrieved SVG structure for ${moleculeData.name} (with transparent background)`);
        }
      } else {
        console.warn(`⚠️ SVG not available for CID ${cid}, will use PNG fallback`);
      }
    } catch (svgError) {
      console.warn(`⚠️ Error fetching SVG: ${svgError}. Will use PNG as fallback.`);
    }

    // Fetch SDF (Structure Data Format) for 2D structure rendering
    try {
      const sdfData = await fetchSDF(cid, '2d');
      if (sdfData) {
        moleculeData.sdfData = sdfData;
        console.log(`✅ Retrieved SDF data for ${moleculeData.name}`);
      }
    } catch (sdfError) {
      console.warn(`⚠️ Error fetching SDF: ${sdfError}`);
    }

    try {
      const sdf3DData = await fetchSDF(cid, '3d');
      if (sdf3DData) {
        moleculeData.sdf3DData = sdf3DData;
        console.log(`✅ Retrieved 3D SDF data for ${moleculeData.name}`);
      }
    } catch (sdf3DError) {
      console.warn(`⚠️ Error fetching 3D SDF: ${sdf3DError}`);
    }

    console.log(`✅ Successfully created molecule data for CID ${cid}: ${moleculeData.name}`);
    return moleculeData;
  } catch (error) {
    console.error(`❌ Error fetching molecule structure for CID ${cid}:`, error);
    return null;
  }
};

// Get 2D structure image URL (PNG format) using PUG REST API
// Endpoint: /rest/pug/compound/CID/{cid}/PNG
export const get2DStructureUrl = (cid: number, imageSize: number = 400): string => {
  return `${PUBCHEM_PUG_URL}/compound/CID/${cid}/PNG?image_size=${imageSize}x${imageSize}`;
};

// Get high-quality 2D structure PNG by CID with blob conversion
export const get2DStructurePNG = async (cid: number, imageSize: number = 500): Promise<string | null> => {
  try {
    const url = get2DStructureUrl(cid, imageSize);
    console.log(`🖼️ Fetching PNG structure from: ${url}`);
    
    const response = await fetchWithRetry(url);
    
    if (response && response.ok) {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      console.log(`✅ Successfully created blob URL for PNG`);
      return objectUrl;
    }
    
    console.warn(`⚠️ Failed to fetch PNG for CID ${cid}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching 2D structure PNG for CID ${cid}:`, error);
    return null;
  }
};

// Fetch SVG data directly using PUG REST API
// Endpoint: /rest/pug/compound/CID/{cid}/SVG
export const getMoleculeSVG = async (cid: number): Promise<string | null> => {
  try {
    const url = `${PUBCHEM_PUG_URL}/compound/CID/${cid}/SVG`;
    console.log(`🎨 Fetching SVG from: ${url}`);
    
    const response = await fetchWithRetry(url);

    if (response && response.ok) {
      const svgText = await response.text();
      if (svgText && svgText.includes('<svg')) {
        console.log(`✅ Successfully retrieved SVG for CID ${cid}`);
        return svgText;
      }
    }
    
    console.warn(`⚠️ Failed to fetch SVG for CID ${cid}`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching SVG for CID ${cid}:`, error);
    return null;
  }
};

// Create MolView embed URL using CID (for 3D structures)
export const getMolViewUrl = (cid: number, mode: string = 'balls'): string => {
  return `https://embed.molview.org/v1/?mode=${mode}&cid=${cid}`;
};

// Create MolView URL using SMILES (alternative method)
export const getMolViewUrlFromSmiles = (smiles: string, mode: string = 'balls'): string => {
  return `https://embed.molview.org/v1/?mode=${mode}&smiles=${encodeURIComponent(smiles)}`;
};

// Main function: Fetch molecule by name (combined search + structure fetch)
export const getMoleculeByName = async (moleculeName: string): Promise<MoleculeData | null> => {
  try {
    console.log(`\n🧪 === Fetching molecule: ${moleculeName} ===`);
    
    // Quick lookup for common molecules FIRST
    const commonMolecules: Record<string, number> = {
      'methane': 297,
      'ethane': 6324,
      'propane': 6334,
      'butane': 7843,
      'ethene': 6325,
      'ethyne': 6326,
      'benzene': 241,
      'water': 962,
      'hydrogen': 783,
      'oxygen': 977,
      'carbon dioxide': 280,
      'co2': 280,
      'methanol': 887,
      'ethanol': 702,
      'acetone': 180,
      'glucose': 5793,
      'caffeine': 2519,
      'aspirin': 2244,
    };

    const lowerName = moleculeName.toLowerCase().trim();
    let cid: number | null = commonMolecules[lowerName] || null;

    // If not in common list, try searching
    if (!cid) {
      console.log(`📍 Not in common molecules list, searching PubChem...`);
      cid = await searchMolecule(moleculeName);
    } else {
      console.log(`✅ Found in common molecules: CID ${cid}`);
    }
    
    if (!cid) {
      console.error(`❌ Molecule "${moleculeName}" not found in PubChem database`);
      return null;
    }
    
    // Step 2: Fetch structure and properties by CID
    const moleculeData = await fetchMoleculeStructure(cid);
    
    if (!moleculeData) {
      console.error(`❌ Failed to fetch structure for CID ${cid}`);
      return null;
    }
    
    console.log(`✅ Successfully retrieved molecule data:\n  Name: ${moleculeData.name}\n  Formula: ${moleculeData.molecularFormula}\n  Weight: ${moleculeData.molecularWeight}`);
    return moleculeData;
  } catch (error) {
    console.error(`❌ Error getting molecule by name "${moleculeName}":`, error);
    return null;
  }
};

export const getMoleculeBySmiles = async (smilesInput: string): Promise<MoleculeData | null> => {
  const rawSmiles = smilesInput.trim();
  if (!rawSmiles) {
    return null;
  }

  try {
    const canonicalSmiles = await fetchCanonicalSmiles(rawSmiles);
    const searchSmiles = canonicalSmiles ?? rawSmiles;

    const cidUrl = `${PUBCHEM_PUG_URL}/compound/smiles/${encodeURIComponent(searchSmiles)}/cids/JSON`;
    const cidResponse = await fetchWithRetry(cidUrl);

    if (!cidResponse || !cidResponse.ok) {
      console.warn('⚠️ Failed to fetch CID for SMILES:', searchSmiles);
      return null;
    }

    try {
      const data = await cidResponse.json();
      const cid = data?.IdentifierList?.CID?.[0];
      if (typeof cid === 'number') {
        return await getMoleculeByCID(cid);
      }
    } catch (error) {
      console.warn('⚠️ Unable to parse SMILES CID response', error);
    }

    console.warn('⚠️ No CID found for SMILES input:', searchSmiles);
    return null;
  } catch (error) {
    console.error('❌ Error fetching molecule by SMILES:', error);
    return null;
  }
};

// Alternative: Fetch molecule by CID directly
export const getMoleculeByCID = async (cid: number): Promise<MoleculeData | null> => {
  try {
    console.log(`\n🧪 === Fetching molecule with CID: ${cid} ===`);

    const moleculeData = await fetchMoleculeStructure(cid);

    if (!moleculeData) {
      console.error(`❌ Failed to fetch molecule data for CID ${cid}`);
      return null;
    }

    console.log(`✅ Successfully retrieved molecule: ${moleculeData.name}`);
    return moleculeData;
  } catch (error) {
    console.error(`❌ Error fetching molecule by CID ${cid}:`, error);
    return null;
  }
};

export const searchReagentMolecules = async (
  query: string,
  maxResults = 12
): Promise<MoleculeData[]> => {
  const rawTerm = query.trim() || DEFAULT_REAGENT_QUERY;
  const cappedMax = Math.min(Math.max(maxResults, 1), 30);

  try {
    const executeSearch = async (term: string) => {
      const searchUrl = `${EUTILS_BASE_URL}/esearch.fcgi?db=pccompound&term=${encodeURIComponent(
        term
      )}&retmax=${cappedMax}&retmode=json`;

      const response = await fetchWithRetry(searchUrl);
      if (!response || !response.ok) {
        console.warn(`?? Reagent search failed for term: ${term}`);
        return { ids: [] as string[], term };
      }

      let data: any = null;
      try {
        data = await response.json();
      } catch (parseError) {
        console.warn('?? Failed to parse reagent search response as JSON', parseError);
        return { ids: [] as string[], term };
      }

      const idList: string[] = Array.isArray(data?.esearchresult?.idlist)
        ? data.esearchresult.idlist
        : [];

      return { ids: idList, term };
    };

    const prefer3DTerm = rawTerm.toLowerCase().includes('has_3d_structure')
      ? rawTerm
      : `(${rawTerm}) AND has_3d_structure[Filter]`;

    let searchResult = await executeSearch(prefer3DTerm);

    if (searchResult.ids.length === 0 && prefer3DTerm !== rawTerm) {
      console.warn('?? No reagents found with 3D filter, retrying without filter');
      searchResult = await executeSearch(rawTerm);
    }

    if (searchResult.ids.length === 0) {
      console.warn(`?? No reagent compounds found for term: ${searchResult.term}`);
      return [];
    }

    const limitedIds = searchResult.ids.slice(0, cappedMax);
    const molecules = await Promise.all(
      limitedIds.map(async (id) => {
        const cid = Number(id);
        if (!Number.isFinite(cid)) {
          return null;
        }

        const molecule = await getMoleculeByCID(cid);
        if (!molecule) {
          return null;
        }

        let displayName = molecule.displayName || molecule.name || '';
        if (!displayName || /^CID\s+\d+$/i.test(displayName)) {
          const synonym = await fetchPreferredSynonym(cid);
          if (synonym) {
            displayName = synonym;
          }
        }

        return {
          ...molecule,
          role: 'reagent',
          sourceQuery: searchResult.term,
          displayName: displayName || `CID ${cid}`,
          source: 'pubchem',
        } as MoleculeData;
      })
    );

    return molecules.filter((molecule): molecule is MoleculeData => molecule !== null);
  } catch (error) {
    console.error(`? Error searching reagent molecules with term "${rawTerm}":`, error);
    return [];
  }
};

export const searchBicyclicCompounds = async (
  query: string,
  maxResults = 12
): Promise<MoleculeData[]> => {
  const rawTerm = query.trim();
  const cappedMax = Math.min(Math.max(maxResults, 1), 24);

  const baseFilter = `${DEFAULT_BICYCLIC_QUERY} AND has_3d_structure[Filter]`;
  const finalQuery = rawTerm.length > 0 ? `(${rawTerm}) AND ${baseFilter}` : baseFilter;

  try {
    const searchUrl = `${EUTILS_BASE_URL}/esearch.fcgi?db=pccompound&term=${encodeURIComponent(
      finalQuery
    )}&retmax=${cappedMax}&retmode=json`;

    const response = await fetchWithRetry(searchUrl);
    if (!response || !response.ok) {
      console.warn('⚠️ Bicyclic compound search failed with status', response?.status);
      return [];
    }

    const data = await response.json().catch((err) => {
      console.warn('⚠️ Failed to parse bicyclic compound search response', err);
      return null;
    });

    if (!data) {
      return [];
    }

    const idList: string[] = Array.isArray(data?.esearchresult?.idlist)
      ? data.esearchresult.idlist.slice(0, cappedMax)
      : [];

    let hydrated: MoleculeData[] = [];

    if (idList.length > 0) {
      const molecules = await Promise.all(
        idList.map(async (id) => {
          const cid = Number(id);
          if (!Number.isFinite(cid)) {
            return null;
          }
          return getMoleculeByCID(cid);
        })
      );

      hydrated = molecules
        .filter((molecule): molecule is MoleculeData => Boolean(molecule))
        .map((molecule) => ({
          ...molecule,
          sourceQuery: finalQuery,
        }));
    }

    if (hydrated.length === 0) {
      hydrated = [...FALLBACK_BICYCLIC_COMPOUNDS];
    } else {
      // Always include fallback compounds to ensure user has options
      hydrated = [...hydrated, ...FALLBACK_BICYCLIC_COMPOUNDS];
    }

    return hydrated;
  } catch (error) {
    console.error('❌ Error searching bicyclic compounds:', error);
    // Return fallback compounds even on error to ensure user always gets results
    return [...FALLBACK_BICYCLIC_COMPOUNDS];
  }
};

export const searchProteinMolecules = async (
  query: string,
  maxResults = 12
): Promise<MoleculeData[]> => {
  const rawTerm = query.trim() || 'protein[Title]';
  const cappedMax = Math.min(Math.max(maxResults, 1), 30);

  try {
    const executeSearch = async (term: string) => {
      const searchUrl = `${EUTILS_BASE_URL}/esearch.fcgi?db=pccompound&term=${encodeURIComponent(
        term
      )}&retmax=${cappedMax}&retmode=json`;

      const response = await fetchWithRetry(searchUrl);
      if (!response || !response.ok) {
        console.warn(`?? Protein search failed for term: ${term}`);
        return { ids: [] as string[], term };
      }

      let data: any = null;
      try {
        data = await response.json();
      } catch (parseError) {
        console.warn('?? Failed to parse protein search response as JSON', parseError);
        return { ids: [] as string[], term };
      }

      const idList: string[] = Array.isArray(data?.esearchresult?.idlist)
        ? data.esearchresult.idlist
        : [];

      return { ids: idList, term };
    };

    const prefer3DTerm = rawTerm.toLowerCase().includes('has_3d_structure')
      ? rawTerm
      : `(${rawTerm}) AND has_3d_structure[Filter]`;

    let searchResult = await executeSearch(prefer3DTerm);

    if (searchResult.ids.length === 0 && prefer3DTerm !== rawTerm) {
      console.warn('?? No proteins found with 3D filter, retrying without filter');
      searchResult = await executeSearch(rawTerm);
    }

    if (searchResult.ids.length === 0) {
      console.warn(`?? No protein compounds found for term: ${searchResult.term}`);
      return [];
    }

    const limitedIds = searchResult.ids.slice(0, cappedMax);
    const molecules = await Promise.all(
      limitedIds.map(async (id) => {
        const cid = Number(id);
        if (!Number.isFinite(cid)) {
          return null;
        }

        const molecule = await getMoleculeByCID(cid);
        if (!molecule) {
          return null;
        }

        let displayName = molecule.displayName || molecule.name || '';
        if (!displayName || /^CID\s+\d+$/i.test(displayName)) {
          const synonym = await fetchPreferredSynonym(cid);
          if (synonym) {
            displayName = synonym;
          }
        }

        return {
          ...molecule,
          role: 'protein',
          sourceQuery: searchResult.term,
          displayName: displayName || `CID ${cid}`,
          source: 'pubchem',
        } as MoleculeData;
      })
    );

    return molecules.filter((molecule): molecule is MoleculeData => molecule !== null);
  } catch (error) {
    console.error(`? Error searching protein molecules with term "${rawTerm}":`, error);
    return [];
  }
};

// Autocomplete function using PubChem's multiple autocomplete APIs (like molview.org)
export const getMoleculeAutocomplete = async (query: string, limit: number = 15): Promise<string[]> => {
  if (!query || query.trim().length < 1) {
    return [];
  }

  const trimmedQuery = query.trim();

  try {
    // Use multiple PubChem autocomplete endpoints like molview.org does
    const endpoints = [
      `${PUBCHEM_BASE_URL}/rest/autocomplete/compound/${encodeURIComponent(trimmedQuery)}/json?limit=${Math.ceil(limit / 3)}`,
      `${PUBCHEM_BASE_URL}/rest/autocomplete/synonym/${encodeURIComponent(trimmedQuery)}/json?limit=${Math.ceil(limit / 3)}`,
      `${PUBCHEM_BASE_URL}/rest/autocomplete/name/${encodeURIComponent(trimmedQuery)}/json?limit=${Math.ceil(limit / 3)}`
    ];

    const results: string[] = [];
    const seen = new Set<string>();

    // Fetch from all endpoints in parallel
    const responses = await Promise.allSettled(
      endpoints.map(url => fetchWithRetry(url))
    );

    for (const result of responses) {
      if (result.status === 'fulfilled') {
        const response = result.value;
        if (response && response.ok) {
          try {
            const data = await response.json();
            const suggestions = data?.autocomplete || data?.synonym || data?.name || [];

            if (Array.isArray(suggestions)) {
              // Add unique suggestions
              for (const suggestion of suggestions) {
                if (typeof suggestion === 'string' && suggestion.trim() && !seen.has(suggestion.toLowerCase())) {
                  seen.add(suggestion.toLowerCase());
                  results.push(suggestion.trim());
                }
              }
            }
          } catch (error) {
            console.warn('Failed to parse autocomplete response:', error);
          }
        }
      }
    }

    // If we got results from PubChem APIs, return them
    if (results.length > 0) {
      const finalResults = results.slice(0, limit);
      console.log(`✅ Found ${finalResults.length} comprehensive autocomplete suggestions for "${trimmedQuery}"`);
      return finalResults;
    }

    // Fallback to common molecules if APIs return empty
    return getFallbackSuggestions(trimmedQuery, limit);
  } catch (error) {
    console.warn('Comprehensive autocomplete error, using fallback:', error);
    return getFallbackSuggestions(trimmedQuery, limit);
  }
};

// Fallback suggestions from common molecules when API fails
const getFallbackSuggestions = (query: string, limit: number): string[] => {
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

  const lowerQuery = query.toLowerCase();
  return commonMolecules
    .filter(mol => mol.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
};

// Interface for parsed SDF atom data
export interface AtomData {
  x: number;
  y: number;
  z: number;
  element: string;
  charge: number;
}

// Interface for parsed SDF bond data
export interface BondData {
  from: number;
  to: number;
  type: number; // 1=single, 2=double, 3=triple, 4=aromatic
}

// Interface for complete parsed SDF
export interface ParsedSDF {
  atoms: AtomData[];
  bonds: BondData[];
  moleculeName: string;
}

// Fetch SDF (Structure Data Format) from PubChem
export const fetchSDF = async (cid: number, recordType: '2d' | '3d' = '2d'): Promise<string | null> => {
  try {
    const sdfUrl = `${PUBCHEM_PUG_URL}/compound/CID/${cid}/SDF?record_type=${recordType}`;
    console.log(`📊 Fetching ${recordType.toUpperCase()} SDF for CID ${cid}...`);
    
    const response = await fetchWithRetry(sdfUrl);
    if (response && response.ok) {
      const sdfText = await response.text();
  console.log(`✅ SDF (${recordType.toUpperCase()}) fetched successfully for CID ${cid}`);
      return sdfText;
    }
  console.warn(`⚠️ Could not fetch ${recordType.toUpperCase()} SDF for CID ${cid}`);
    return null;
  } catch (error) {
  console.error(`❌ Error fetching ${recordType.toUpperCase()} SDF:`, error);
    return null;
  }
};

// Parse SDF format string into structured data
export const parseSDF = (sdfText: string): ParsedSDF | null => {
  try {
    const normalized = sdfText.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');
    if (lines.length < 4) return null;

    const atoms: AtomData[] = [];
    const bonds: BondData[] = [];

    const countsLineIndex = (() => {
      const explicitIndex = lines.findIndex(line => line.includes('V2000') || line.includes('V3000'));
      if (explicitIndex >= 0) {
        return explicitIndex;
      }
      return Math.min(3, lines.length - 1);
    })();

    const countsTokens = lines[countsLineIndex].trim().split(/\s+/);
    const atomCount = Number.parseInt(countsTokens[0], 10) || 0;
    const bondCount = Number.parseInt(countsTokens[1], 10) || 0;

    const parseFloatSafe = (value: string): number => {
      const num = Number.parseFloat(value);
      return Number.isFinite(num) ? num : 0;
    };

    const atomStartLine = countsLineIndex + 1;

    // Parse atoms (lines 4..4+atomCount)
    for (let i = 0; i < atomCount && atomStartLine + i < lines.length; i++) {
      const atomLine = lines[atomStartLine + i];
      const tokens = atomLine.trim().split(/\s+/);

      if (tokens.length >= 4) {
        atoms.push({
          x: parseFloatSafe(tokens[0]),
          y: parseFloatSafe(tokens[1]),
          z: parseFloatSafe(tokens[2]),
          element: tokens[3],
          charge: 0
        });
      }
    }

    const bondsStartLine = atomStartLine + atomCount;
    for (let i = 0; i < bondCount && bondsStartLine + i < lines.length; i++) {
      const bondLine = lines[bondsStartLine + i];
      const tokens = bondLine.trim().split(/\s+/);

      if (tokens.length >= 3) {
        const from = Number.parseInt(tokens[0], 10) - 1;
        const to = Number.parseInt(tokens[1], 10) - 1;
        const type = Number.parseInt(tokens[2], 10) || 1;

        if (Number.isFinite(from) && Number.isFinite(to)) {
          bonds.push({
            from: Math.max(0, from),
            to: Math.max(0, to),
            type
          });
        }
      }
    }

    let moleculeName = 'Unknown';
    for (let i = bondsStartLine + bondCount; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('>') || line.includes('M  ')) continue;
      moleculeName = line;
      break;
    }

    console.log(`✅ Parsed SDF: ${atoms.length} atoms, ${bonds.length} bonds`);
    return { atoms, bonds, moleculeName };
  } catch (error) {
    console.error(`❌ Error parsing SDF:`, error);
    return null;
  }
};

// Draw 2D structure on canvas from parsed SDF
export const drawSDF2DStructure = (
  ctx: CanvasRenderingContext2D,
  parsedSDF: ParsedSDF,
  centerX: number,
  centerY: number,
  scale: number = 30
) => {
  if (!parsedSDF.atoms || parsedSDF.atoms.length === 0) return;

  // Find bounds of the structure
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  parsedSDF.atoms.forEach(atom => {
    minX = Math.min(minX, atom.x);
    maxX = Math.max(maxX, atom.x);
    minY = Math.min(minY, atom.y);
    maxY = Math.max(maxY, atom.y);
  });

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const adjustedScale = Math.min(scale, 20 / Math.max(width, height));

  // Draw bonds first (so they appear behind atoms)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  parsedSDF.bonds.forEach(bond => {
    const atom1 = parsedSDF.atoms[bond.from];
    const atom2 = parsedSDF.atoms[bond.to];

    if (atom1 && atom2) {
      const x1 = centerX + (atom1.x - minX - width / 2) * adjustedScale;
      const y1 = centerY + (atom1.y - minY - height / 2) * adjustedScale;
      const x2 = centerX + (atom2.x - minX - width / 2) * adjustedScale;
      const y2 = centerY + (atom2.y - minY - height / 2) * adjustedScale;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw double/triple bonds
      if (bond.type === 2 || bond.type === 3) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const offsetX = (-dy / len) * 4;
        const offsetY = (dx / len) * 4;

        ctx.beginPath();
        ctx.moveTo(x1 + offsetX, y1 + offsetY);
        ctx.lineTo(x2 + offsetX, y2 + offsetY);
        ctx.stroke();

        if (bond.type === 3) {
          ctx.beginPath();
          ctx.moveTo(x1 - offsetX, y1 - offsetY);
          ctx.lineTo(x2 - offsetX, y2 - offsetY);
          ctx.stroke();
        }
      }
    }
  });

  // Draw atoms
  const atomColors: { [key: string]: string } = {
    'C': '#ffffff',
    'H': '#cccccc',
    'N': '#3b82f6',
    'O': '#ef4444',
    'S': '#fbbf24',
    'P': '#8b5cf6',
    'Cl': '#10b981',
    'Br': '#d946a6',
    'F': '#14b8a6',
    'I': '#8b5cf6',
  };

  parsedSDF.atoms.forEach(atom => {
    const x = centerX + (atom.x - minX - width / 2) * adjustedScale;
    const y = centerY + (atom.y - minY - height / 2) * adjustedScale;
    const radius = 5;

    // Draw atom circle
    const color = atomColors[atom.element] || '#cccccc';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw atom border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw element symbol (for non-hydrogen)
    if (atom.element !== 'H' || false) { // Skip H labels for cleaner view
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(atom.element, x, y);
    }
  });
};

// =============================================================================
// KEGG REACTION DATABASE INTEGRATION
// =============================================================================

export interface KeggReaction {
  entryId: string;
  name: string;
  equation: string;
  definition: string;
  enzyme?: string;
  pathway?: string;
  smiles?: string;
}

/**
 * Search KEGG reactions using their REST API
 */
export const searchKeggReactions = async (
  query: string,
  limit: number = 10
): Promise<PubChemReactionSearchResult> => {
  try {
    // KEGG API for finding reactions
    const findUrl = `https://rest.kegg.jp/find/reaction/${encodeURIComponent(query)}`;
    const response = await fetch(findUrl);

    if (!response.ok) {
      throw new Error(`KEGG API error: ${response.status}`);
    }

    const text = await response.text();
    const lines = text.trim().split('\n');

    const keggReactions: KeggReaction[] = lines.map(line => {
      const [entryId, description] = line.split('\t');
      return {
        entryId,
        name: description,
        equation: description,
        definition: description
      };
    });

    const parseEquationParticipants = (equation?: string): { reactants: string[]; products: string[] } => {
      if (!equation) {
        return { reactants: [], products: [] };
      }
      const arrow = equation.includes('<=>') ? '<=>' : equation.includes('=>') ? '=>' : '<=>';
      const [rawReactants, rawProducts] = equation.split(arrow);
      const tokenize = (segment?: string) =>
        segment?.split('+').map(token => token.trim()).filter(Boolean) ?? [];
      return {
        reactants: tokenize(rawReactants),
        products: tokenize(rawProducts)
      };
    };

    // Convert to PubChemReaction format with metadata
    const pubchemReactions: PubChemReaction[] = keggReactions.slice(0, limit).map((reaction, index) => {
      const numericId = Number.parseInt(reaction.entryId.replace('rn:', ''), 10);
      const participants = parseEquationParticipants(reaction.equation);
      const defaultQuery = reaction.definition
        ? `${reaction.name}: ${reaction.definition}`
        : reaction.equation || reaction.name;
      const smilesValue = reaction.smiles && reaction.smiles.trim().length > 0
        ? reaction.smiles
        : defaultQuery ?? reaction.name ?? '';

      return {
        rid: Number.isFinite(numericId) ? numericId : 800000 + index,
        name: reaction.name,
        smiles: smilesValue,
        reactants: participants.reactants,
        products: participants.products,
        description: reaction.definition || reaction.equation || reaction.name,
        source: 'kegg',
        referenceId: reaction.entryId,
        metadata: {
          enzyme: reaction.enzyme,
          equation: reaction.equation,
          dataset: 'KEGG Reaction Database'
        },
        defaultQuery,
        categoryHint: 'Biochemical',
        difficultyHint: 'advanced'
      } satisfies PubChemReaction;
    });

    return {
      reactions: pubchemReactions,
      totalCount: lines.length,
      searchTerm: query
    };

  } catch (error) {
    console.error('Error searching KEGG reactions:', error);
    return { reactions: [], totalCount: 0, searchTerm: query };
  }
};

/**
 * Get detailed KEGG reaction information
 */
export const getKeggReactionDetails = async (entryId: string): Promise<KeggReaction | null> => {
  try {
    const url = `https://rest.kegg.jp/get/${entryId}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    const lines = text.split('\n');

    let reaction: Partial<KeggReaction> = {
      entryId,
      name: '',
      equation: '',
      definition: ''
    };

    for (const line of lines) {
      if (line.startsWith('NAME')) {
        reaction.name = line.substring(5).trim();
      } else if (line.startsWith('EQUATION')) {
        reaction.equation = line.substring(9).trim();
      } else if (line.startsWith('DEFINITION')) {
        reaction.definition = line.substring(11).trim();
      } else if (line.startsWith('ENZYME')) {
        reaction.enzyme = line.substring(7).trim();
      }
    }

    return reaction as KeggReaction;

  } catch (error) {
    console.error('Error getting KEGG reaction details:', error);
    return null;
  }
};

export interface OrdReaction {
  rid?: number;
  reactionId: string;
  name?: string;
  smiles: string;
  reactants: string[];
  products: string[];
  description?: string;
  conditions?: string[];
  yield?: number;
  reactionType?: string;
  category?: string;
  difficulty?: 'basic' | 'intermediate' | 'advanced';
  tags?: string[];
  defaultQuery?: string;
  dataset?: string;
  metadata?: ReactionMetadata;
}

/**
 * ORD API interfaces and functions
 * Note: The Open Reaction Database currently doesn't have a public API.
 * This implementation provides a framework for ORD integration when available.
 * Currently falls back to static curated ORD reactions.
 *
 * For full ORD integration:
 * 1. Clone https://github.com/open-reaction-database/ord-data
 * 2. Install ord-schema: pip install ord-schema
 * 3. Load .pb.gz files and convert to JSON using ord_schema.message_helpers
 */
interface OrdQueryParams {
  reaction_smarts?: string;
  component?: string;
  dataset_id?: string;
  reaction_id?: string;
  min_yield?: number;
  max_yield?: number;
  min_conversion?: number;
  max_conversion?: number;
  doi?: string;
  use_stereochemistry?: boolean;
  similarity?: number;
  limit?: number;
}

interface OrdQueryResponse {
  task_id: string;
  status: string;
}

interface OrdResultResponse {
  status: string;
  result?: {
    reactions: any[]; // ORD reaction objects
    total_count: number;
  };
  error?: string;
}

/**
 * Convert ORD reaction data to PubChemReaction format
 * (Placeholder for when ORD API becomes available)
 */
const convertOrdReactionToPubChem = (ordReaction: any, index: number): PubChemReaction => {
  // Extract basic information from ORD reaction
  const reactionId = ordReaction.reaction_id || ordReaction.id || `ord_${index}`;
  const name = ordReaction.name || `ORD Reaction ${reactionId}`;

  // Extract SMILES from reaction components
  let smiles = '';
  const reactants: string[] = [];
  const products: string[] = [];

  if (ordReaction.inputs) {
    Object.values(ordReaction.inputs).forEach((input: any) => {
      if (input.components) {
        input.components.forEach((component: any) => {
          if (component.smiles) {
            reactants.push(component.smiles);
          }
        });
      }
    });
  }

  if (ordReaction.outcomes) {
    ordReaction.outcomes.forEach((outcome: any) => {
      if (outcome.products) {
        outcome.products.forEach((product: any) => {
          if (product.smiles) {
            products.push(product.smiles);
          }
        });
      }
    });
  }

  // Create SMILES string (reactants >> products)
  if (reactants.length > 0 && products.length > 0) {
    smiles = `${reactants.join('.')}>${products.join('.')}`;
  }

  // Extract metadata
  const metadata: ReactionMetadata = {
    dataset: ordReaction.dataset_id || 'Open Reaction Database',
    conditions: ordReaction.conditions ? [JSON.stringify(ordReaction.conditions)] : undefined,
    yield: ordReaction.outcomes?.[0]?.conversion?.value,
    reactionType: ordReaction.reaction_type,
  };

  return {
    rid: parseInt(reactionId.replace(/[^0-9]/g, ''), 10) || 900000 + index,
    name,
    smiles,
    reactants: reactants.map((smiles, i) => `Reactant ${i + 1}`), // Placeholder names
    products: products.map((smiles, i) => `Product ${i + 1}`), // Placeholder names
    description: ordReaction.description || name,
    source: 'ord',
    referenceId: reactionId,
    metadata,
    defaultQuery: name,
    tags: ordReaction.tags || ['ord'],
    categoryHint: ordReaction.reaction_type,
    difficultyHint: 'intermediate'
  };
};

/**
 * Fetch reactions from Open Reaction Database (ORD)
 * ORD provides comprehensive organic reaction data
 */
const ORD_REACTIONS: OrdReaction[] = (ordReactionsDataset as OrdReaction[]).map((reaction) => ({
  ...reaction,
  dataset: reaction.dataset ?? 'Open Reaction Database'
}));

export const searchOrdReactions = async (
  query: string,
  limit: number = 10
): Promise<PubChemReactionSearchResult> => {
  try {
    // TODO: When ORD provides a public API, replace this with actual API calls
    // The ORD interface (https://github.com/open-reaction-database/ord-interface)
    // provides FastAPI endpoints, but currently requires local deployment
    //
    // For now, we use curated static data that represents ORD-style reactions
    // To integrate with full ORD data:
    // 1. Use ord-data repository protobuf files
    // 2. Convert using ord_schema.message_helpers.load_message()
    // 3. Parse reaction data and convert to PubChemReaction format

    console.log(`ORD Search: "${query}" (using static curated data - full ORD API not yet publicly available)`);

    return await searchOrdReactionsStatic(query, limit);
  } catch (error) {
    console.error('Error searching ORD reactions:', error);
    return await searchOrdReactionsStatic(query, limit);
  }
};
const searchOrdReactionsStatic = async (
  query: string,
  limit: number = 10
): Promise<PubChemReactionSearchResult> => {
  try {
    const normalized = query.trim().toLowerCase();

    const filteredReactions = normalized.length === 0
      ? ORD_REACTIONS
      : ORD_REACTIONS.filter((reaction) => {
          const haystacks: Array<string | undefined> = [
            reaction.name,
            reaction.description,
            reaction.reactionType,
            reaction.category,
            reaction.defaultQuery,
            ...(reaction.tags ?? []),
            ...reaction.reactants,
            ...reaction.products,
            ...(reaction.conditions ?? [])
          ];

          return haystacks.some((value) =>
            typeof value === 'string' && value.toLowerCase().includes(normalized)
          );
        });

    const limited = filteredReactions.slice(0, limit);

    const pubchemReactions: PubChemReaction[] = limited.map((reaction, index) => {
      const numericId = reaction.rid
        ?? parseInt(reaction.reactionId.replace(/[^0-9]/g, ''), 10)
        ?? 900000 + index;

      return {
        rid: numericId,
        name: reaction.name,
        smiles: reaction.smiles,
        reactants: reaction.reactants,
        products: reaction.products,
        description: reaction.description,
        source: 'ord',
        referenceId: reaction.reactionId,
        metadata: {
          ...(reaction.metadata ?? {}),
          conditions: reaction.conditions,
          yield: reaction.yield,
          reactionType: reaction.reactionType,
          dataset: reaction.dataset ?? 'Open Reaction Database'
        },
        defaultQuery: reaction.defaultQuery ?? reaction.description ?? reaction.name,
        tags: reaction.tags,
        categoryHint: reaction.category,
        difficultyHint: reaction.difficulty
      } satisfies PubChemReaction;
    });

    return {
      reactions: pubchemReactions,
      totalCount: filteredReactions.length,
      searchTerm: query
    };

  } catch (error) {
    console.error('Error searching static ORD reactions:', error);
    return { reactions: [], totalCount: 0, searchTerm: query };
  }
};

/**
 * Get detailed ORD reaction information
 */
export const getOrdReactionDetails = async (reactionId: string): Promise<OrdReaction | null> => {
  // In a real implementation, this would fetch from ORD dataset
  // For now, return mock data
  const mockReactions: Record<string, OrdReaction> = {
    'ord_001': {
      reactionId: 'ord_001',
      name: 'Suzuki Coupling',
      smiles: 'B(c1ccccc1)(O)O.CC(=O)c1ccccc1>>CC(=O)c1ccccc1',
      reactants: ['phenylboronic acid', 'acetophenone'],
      products: ['biphenyl ketone'],
      description: 'Palladium-catalyzed cross-coupling reaction',
      conditions: ['Pd catalyst', 'base'],
      reactionType: 'cross-coupling'
    }
  };

  return mockReactions[reactionId] || null;
};

/**
 * Search for reactions in PubChem database
 * Note: PubChem has limited reaction data, so we use compound relationships
 */
export const searchPubChemReactions = async (
  query: string,
  limit: number = 10
): Promise<PubChemReactionSearchResult> => {
  if (!query.trim()) {
    return { reactions: [], totalCount: 0, searchTerm: query };
  }

  try {
    const aggregated: PubChemReaction[] = [];
    const lowerQuery = query.toLowerCase();

    const ensureStringArray = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .map(item => typeof item === 'string' ? item.trim() : typeof item === 'number' ? String(item) : '')
          .filter(Boolean);
      }
      if (typeof value === 'string') {
        return value.split(',').map(item => item.trim()).filter(Boolean);
      }
      return [];
    };

    const buildReactionFromSynopsis = (info: any, index: number): PubChemReaction | null => {
      if (!info || typeof info !== 'object') {
        return null;
      }

      const ridCandidate = info.RID ?? info.ReactionID ?? info.RxnID ?? (Array.isArray(info.ID) ? info.ID[0] : info.ID);
      const ridNumber = Number(ridCandidate);

      const name = typeof info.Name === 'string'
        ? info.Name
        : Array.isArray(info.Synonym) && typeof info.Synonym[0] === 'string'
          ? info.Synonym[0]
          : undefined;

      const equation = info.Equation ?? info.ReactionEquation ?? info?.Reaction?.Equation;
      const smilesCandidate = info.RXNSMILES
        ?? info.ReactionSmiles
        ?? info['Reaction SMILES']
        ?? info?.Reaction?.ReactionSmiles
        ?? '';

      const reactants = ensureStringArray(info.Reactants ?? info.Reactant);
      const products = ensureStringArray(info.Products ?? info.Product);

      const metadata: ReactionMetadata = { dataset: 'PubChem Reactions' };
      if (info.Comment) metadata.notes = String(info.Comment);
      if (info.Reference) metadata.reference = info.Reference;
      if (info.DOI) metadata.doi = info.DOI;
      if (info.Source) metadata.source = info.Source;

      const defaultQuery = typeof info.Title === 'string'
        ? info.Title
        : equation ?? name;

      const smiles = typeof smilesCandidate === 'string' && smilesCandidate.trim().length > 0
        ? smilesCandidate
        : (equation ?? name ?? '');

      const referenceId = typeof ridCandidate === 'string' ? ridCandidate : undefined;

      return {
        rid: Number.isFinite(ridNumber) ? ridNumber : 600000 + index,
        name: name ?? defaultQuery ?? `PubChem Reaction ${600000 + index}`,
        smiles,
        reactants,
        products,
        description: info.Description ?? info.Comment ?? equation ?? name,
        equation,
        source: 'pubchem',
        referenceId,
        metadata,
        defaultQuery,
        tags: ensureStringArray(info.Keywords),
        categoryHint: typeof info.Category === 'string' ? info.Category : undefined
      };
    };

    // Attempt direct PubChem reaction lookup for high-quality matches
    try {
      const synopsisUrl = `${PUBCHEM_PUG_URL}/reaction/name/${encodeURIComponent(query)}/synopsis/JSON`;
      const response = await fetchWithRetry(synopsisUrl);
      if (response && response.ok) {
        const data = await response.json();
        const infoList = data?.InformationList?.Information;
        if (Array.isArray(infoList)) {
          infoList.forEach((info, index) => {
            const reaction = buildReactionFromSynopsis(info, index);
            if (reaction) {
              aggregated.push(reaction);
            }
          });
        }
      }
    } catch (apiError) {
      console.warn('PubChem synopsis lookup failed, falling back to heuristics:', apiError);
    }

    const createSynthetic = (configuration: {
      rid: number;
      name: string;
      smiles: string;
      reactants: string[];
      products: string[];
      description: string;
      category: string;
      difficulty: 'basic' | 'intermediate' | 'advanced';
      tags: string[];
    }): PubChemReaction => ({
      ...configuration,
      source: 'pubchem',
      metadata: { dataset: 'PubChem Reaction Templates' },
      defaultQuery: configuration.name,
      categoryHint: configuration.category,
      difficultyHint: configuration.difficulty
    });

    const reactionPatterns: Array<{
      keywords: string[];
      generateReactions: (query: string) => PubChemReaction[];
    }> = [
      {
        keywords: ['combustion', 'burning', 'oxidation'],
        generateReactions: () => [
          createSynthetic({
            rid: 1001,
            name: 'Methane Combustion',
            smiles: 'C.O=O>>O=C.O',
            reactants: ['CH4', 'O2'],
            products: ['CO2', 'H2O'],
            description: 'Complete combustion of methane',
            category: 'Combustion',
            difficulty: 'basic',
            tags: ['oxidation', 'energy']
          }),
          createSynthetic({
            rid: 1002,
            name: 'Hydrocarbon Combustion',
            smiles: 'CC.O=O>>O=C.O',
            reactants: ['C2H6', 'O2'],
            products: ['CO2', 'H2O'],
            description: 'General hydrocarbon combustion',
            category: 'Combustion',
            difficulty: 'basic',
            tags: ['hydrocarbon', 'oxidation']
          })
        ]
      },
      {
        keywords: ['acid', 'base', 'neutralization'],
        generateReactions: () => [
          createSynthetic({
            rid: 2001,
            name: 'Acid-Base Neutralization',
            smiles: 'Cl.[Na+].[OH-]>>[Na+].[Cl-].O',
            reactants: ['HCl', 'NaOH'],
            products: ['NaCl', 'H2O'],
            description: 'Neutralization of hydrochloric acid with sodium hydroxide',
            category: 'Acid-Base',
            difficulty: 'basic',
            tags: ['neutralization', 'salt']
          })
        ]
      },
      {
        keywords: ['ester', 'esterification'],
        generateReactions: () => [
          createSynthetic({
            rid: 3001,
            name: 'Fischer Esterification',
            smiles: 'CC(=O)O.CCO>>CC(=O)OCC.O',
            reactants: ['CH3COOH', 'C2H5OH'],
            products: ['CH3COOC2H5', 'H2O'],
            description: 'Acid-catalyzed formation of ethyl acetate',
            category: 'Organic Synthesis',
            difficulty: 'intermediate',
            tags: ['ester', 'acid catalysis']
          })
        ]
      },
      {
        keywords: ['saponification', 'soap'],
        generateReactions: () => [
          createSynthetic({
            rid: 3002,
            name: 'Saponification',
            smiles: 'CCCCCCCC(=O)OCC.O>>CCCCCCCC(=O)O.CCO',
            reactants: ['Triglyceride', 'NaOH'],
            products: ['Soap', 'Glycerol'],
            description: 'Hydrolysis of fat to form soap and glycerol',
            category: 'Organic Synthesis',
            difficulty: 'intermediate',
            tags: ['hydrolysis', 'base']
          })
        ]
      },
      {
        keywords: ['substitution', 'sn2', 'nucleophilic'],
        generateReactions: () => [
          createSynthetic({
            rid: 4001,
            name: 'SN2 Substitution',
            smiles: 'CCCl.CC[O-]>>CCO.CCCl',
            reactants: ['CH3CH2Cl', 'OH-'],
            products: ['CH3CH2OH', 'Cl-'],
            description: 'Bimolecular nucleophilic substitution on a primary halide',
            category: 'Organic Mechanisms',
            difficulty: 'intermediate',
            tags: ['nucleophile', 'halide']
          })
        ]
      },
      {
        keywords: ['aromatic', 'electrophilic', 'nitration'],
        generateReactions: () => [
          createSynthetic({
            rid: 5001,
            name: 'Benzene Nitration',
            smiles: 'c1ccccc1.O=[N+](=O)[O-]>>c1ccccc1[N+](=O)[O-]',
            reactants: ['C6H6', 'HNO3'],
            products: ['C6H5NO2', 'H2O'],
            description: 'Electrophilic aromatic substitution with nitric acid',
            category: 'Aromatic Chemistry',
            difficulty: 'advanced',
            tags: ['nitration', 'aromatic']
          })
        ]
      },
      {
        keywords: ['reduction', 'ketone', 'alcohol'],
        generateReactions: () => [
          createSynthetic({
            rid: 6001,
            name: 'Ketone Reduction',
            smiles: 'CC(=O)C.[H][H]>>CC(O)C',
            reactants: ['Acetone', 'H2'],
            products: ['Isopropanol'],
            description: 'Hydrogenation of ketone to secondary alcohol',
            category: 'Reduction',
            difficulty: 'intermediate',
            tags: ['hydrogenation', 'carbonyl']
          })
        ]
      },
      {
        keywords: ['oxidation', 'alcohol', 'aldehyde'],
        generateReactions: () => [
          createSynthetic({
            rid: 6002,
            name: 'Primary Alcohol Oxidation',
            smiles: 'CCO.O=O>>CC=O.O',
            reactants: ['Ethanol', 'O2'],
            products: ['Acetaldehyde', 'H2O'],
            description: 'Conversion of ethanol to acetaldehyde',
            category: 'Oxidation',
            difficulty: 'intermediate',
            tags: ['oxidation', 'alcohol']
          })
        ]
      }
    ];

    const matchingPatterns = reactionPatterns.filter(pattern =>
      pattern.keywords.some(keyword => lowerQuery.includes(keyword))
    );

    if (matchingPatterns.length > 0) {
      matchingPatterns.forEach(pattern => {
        const synthetic = pattern.generateReactions(query);
        aggregated.push(...synthetic);
      });
    }

    if (aggregated.length === 0) {
      const compoundResults = await searchReactionsByCompound(query, limit);
      aggregated.push(...compoundResults.reactions);
    } else if (aggregated.length < limit) {
      const compoundResults = await searchReactionsByCompound(query, limit - aggregated.length);
      aggregated.push(...compoundResults.reactions);
    }

    const dedupeMap = new Map<string, PubChemReaction>();
    aggregated.forEach(reaction => {
      const key = reaction.smiles && reaction.smiles.trim().length > 0
        ? `${reaction.source ?? 'pubchem'}:${reaction.smiles.toLowerCase()}`
        : `${reaction.source ?? 'pubchem'}:${(reaction.name ?? '').toLowerCase()}`;
      const normalizedKey = key.trim();
      if (!normalizedKey) {
        return;
      }
      if (!dedupeMap.has(normalizedKey)) {
        dedupeMap.set(normalizedKey, reaction);
      }
    });

    const uniqueReactions = Array.from(dedupeMap.values());

    return {
      reactions: uniqueReactions.slice(0, limit),
      totalCount: uniqueReactions.length,
      searchTerm: query
    };

  } catch (error) {
    console.error('Error searching PubChem reactions:', error);
    return { reactions: [], totalCount: 0, searchTerm: query };
  }
};

/**
 * Get detailed information about a specific PubChem reaction
 * Since PubChem has limited reaction data, this creates synthetic reactions
 */
export const getPubChemReactionDetails = async (rid: number): Promise<PubChemReaction | null> => {
  // For synthetic reactions, return predefined data based on RID
  const syntheticReactions: Record<number, PubChemReaction> = {
    1001: {
      rid: 1001,
      name: 'Methane Combustion',
      smiles: 'C.O=O>>O=C.O',
      reactants: ['CH4', 'O2'],
      products: ['CO2', 'H2O'],
      description: 'Complete combustion of methane: CH4 + 2O2 → CO2 + 2H2O'
    },
    1002: {
      rid: 1002,
      name: 'Ethane Combustion',
      smiles: 'CC.O=O>>O=C.O',
      reactants: ['C2H6', 'O2'],
      products: ['CO2', 'H2O'],
      description: 'Combustion of ethane: 2C2H6 + 7O2 → 4CO2 + 6H2O'
    },
    2001: {
      rid: 2001,
      name: 'Acid-Base Neutralization',
      smiles: 'Cl.[Na+].[OH-]>>[Na+].[Cl-].O',
      reactants: ['HCl', 'NaOH'],
      products: ['NaCl', 'H2O'],
      description: 'Neutralization: HCl + NaOH → NaCl + H2O'
    },
    3001: {
      rid: 3001,
      name: 'Esterification',
      smiles: 'CC(=O)O.CCO>>CC(=O)OCC.O',
      reactants: ['CH3COOH', 'C2H5OH'],
      products: ['CH3COOC2H5', 'H2O'],
      description: 'Ester formation: CH3COOH + C2H5OH → CH3COOC2H5 + H2O'
    },
    3002: {
      rid: 3002,
      name: 'Saponification',
      smiles: 'CCCCCCCC(=O)OCC.O>>CCCCCCCC(=O)O.CCO',
      reactants: ['Triglyceride', 'NaOH'],
      products: ['Soap', 'Glycerol'],
      description: 'Soap formation from fats and base'
    },
    4001: {
      rid: 4001,
      name: 'SN2 Reaction',
      smiles: 'CCCl.CC[O-]>>CCO.CCCl',
      reactants: ['CH3CH2Cl', 'OH-'],
      products: ['CH3CH2OH', 'Cl-'],
      description: 'Nucleophilic substitution: CH3CH2Cl + OH- → CH3CH2OH + Cl-'
    },
    5001: {
      rid: 5001,
      name: 'Electrophilic Aromatic Substitution',
      smiles: 'c1ccccc1.O=[N+](=O)[O-]>>c1ccccc1[N+](=O)[O-]',
      reactants: ['C6H6', 'HNO3'],
      products: ['C6H5NO2', 'H2O'],
      description: 'Nitration of benzene: C6H6 + HNO3 → C6H5NO2 + H2O'
    },
    6001: {
      rid: 6001,
      name: 'Ketone Reduction',
      smiles: 'CC(=O)C.[H][H]>>CC(O)C',
      reactants: ['CH3COCH3', 'H2'],
      products: ['(CH3)2CHOH'],
      description: 'Reduction of acetone to isopropanol'
    },
    6002: {
      rid: 6002,
      name: 'Alcohol Oxidation',
      smiles: 'CCO.O=O>>CC=O.O',
      reactants: ['C2H5OH', 'O2'],
      products: ['CH3CHO', 'H2O'],
      description: 'Oxidation of ethanol to acetaldehyde'
    }
  };

  return syntheticReactions[rid] || null;
};

/**
 * Search for reactions by compound name
 * Creates synthetic reactions involving the searched compound
 */
export const searchReactionsByCompound = async (
  compoundQuery: string,
  limit: number = 10
): Promise<PubChemReactionSearchResult> => {
  try {
    // First try to find the compound in PubChem
    const compoundSearch = await searchMolecule(compoundQuery);
    if (!compoundSearch) {
      return { reactions: [], totalCount: 0, searchTerm: compoundQuery };
    }

    // Get compound details
    const compoundDetails = await fetchMoleculeStructure(compoundSearch);
    if (!compoundDetails) {
      return { reactions: [], totalCount: 0, searchTerm: compoundQuery };
    }

    const compoundName = compoundDetails.name.toLowerCase();
    const compoundSmiles = compoundDetails.smiles;

    // Create reactions based on compound type
    const reactions: PubChemReaction[] = [];

    // Alcohol reactions
    if (compoundName.includes('ol') || compoundName.includes('alcohol')) {
      reactions.push({
        rid: 7001,
        name: `${compoundDetails.name} Oxidation`,
        smiles: compoundSmiles ? `${compoundSmiles}.O=O>>` : 'CCO.O=O>>CC=O.O',
        reactants: [compoundDetails.name, 'O2'],
        products: ['Oxidation Product'],
        description: `Oxidation of ${compoundDetails.name}`,
        source: 'compound',
        metadata: {
          dataset: 'PubChem Compound Relationships',
          matchedCompound: compoundDetails.name
        },
        defaultQuery: `Oxidation of ${compoundDetails.name}`,
        tags: ['oxidation', 'compound'],
        categoryHint: 'Compound-Derived',
        difficultyHint: 'intermediate'
      });
    }

    // Acid reactions
    if (compoundName.includes('acid') || compoundName.includes('oic acid')) {
      reactions.push({
        rid: 7002,
        name: `${compoundDetails.name} Esterification`,
        smiles: compoundSmiles ? `${compoundSmiles}.CCO>>` : 'CC(=O)O.CCO>>CC(=O)OCC.O',
        reactants: [compoundDetails.name, 'Alcohol'],
        products: ['Ester', 'H2O'],
        description: `Esterification of ${compoundDetails.name}`,
        source: 'compound',
        metadata: {
          dataset: 'PubChem Compound Relationships',
          matchedCompound: compoundDetails.name
        },
        defaultQuery: `Esterification of ${compoundDetails.name}`,
        tags: ['esterification', 'compound'],
        categoryHint: 'Compound-Derived',
        difficultyHint: 'intermediate'
      });
    }

    // Ketone reactions
    if (compoundName.includes('one') || compoundName.includes('ketone')) {
      reactions.push({
        rid: 7003,
        name: `${compoundDetails.name} Reduction`,
        smiles: compoundSmiles ? `${compoundSmiles}.[H][H]>>` : 'CC(=O)C.[H][H]>>CC(O)C',
        reactants: [compoundDetails.name, 'H2'],
        products: ['Alcohol'],
        description: `Reduction of ${compoundDetails.name}`,
        source: 'compound',
        metadata: {
          dataset: 'PubChem Compound Relationships',
          matchedCompound: compoundDetails.name
        },
        defaultQuery: `Reduction of ${compoundDetails.name}`,
        tags: ['reduction', 'compound'],
        categoryHint: 'Compound-Derived',
        difficultyHint: 'intermediate'
      });
    }

    // Alkene reactions
    if (compoundName.includes('ene') || compoundSmiles?.includes('=') || compoundSmiles?.includes('C=C')) {
      reactions.push({
        rid: 7004,
        name: `${compoundDetails.name} Addition`,
        smiles: compoundSmiles ? `${compoundSmiles}.ClCl>>` : 'C=C.ClCl>>',
        reactants: [compoundDetails.name, 'Cl2'],
        products: ['Addition Product'],
        description: `Electrophilic addition to ${compoundDetails.name}`,
        source: 'compound',
        metadata: {
          dataset: 'PubChem Compound Relationships',
          matchedCompound: compoundDetails.name
        },
        defaultQuery: `Addition to ${compoundDetails.name}`,
        tags: ['addition', 'alkene'],
        categoryHint: 'Compound-Derived',
        difficultyHint: 'basic'
      });
    }

    // Aromatic reactions
    if (compoundName.includes('benzene') || compoundName.includes('phenyl') || compoundSmiles?.includes('c1ccccc1')) {
      reactions.push({
        rid: 7005,
        name: `${compoundDetails.name} Substitution`,
        smiles: compoundSmiles ? `${compoundSmiles}.O=[N+](=O)[O-]>>` : 'c1ccccc1.O=[N+](=O)[O-]>>c1ccccc1[N+](=O)[O-]',
        reactants: [compoundDetails.name, 'HNO3'],
        products: ['Substitution Product'],
        description: `Electrophilic aromatic substitution of ${compoundDetails.name}`,
        source: 'compound',
        metadata: {
          dataset: 'PubChem Compound Relationships',
          matchedCompound: compoundDetails.name
        },
        defaultQuery: `Substitution of ${compoundDetails.name}`,
        tags: ['aromatic', 'substitution'],
        categoryHint: 'Compound-Derived',
        difficultyHint: 'advanced'
      });
    }

    // Generic reaction if no specific type matched
    if (reactions.length === 0) {
      reactions.push({
        rid: 7006,
        name: `${compoundDetails.name} Reaction`,
        smiles: compoundSmiles ? `${compoundSmiles}>>` : 'CC>>',
        reactants: [compoundDetails.name],
        products: ['Product'],
        description: `General reaction involving ${compoundDetails.name}`,
        source: 'compound',
        metadata: {
          dataset: 'PubChem Compound Relationships',
          matchedCompound: compoundDetails.name
        },
        defaultQuery: `Reaction involving ${compoundDetails.name}`,
        tags: ['compound', 'generic'],
        categoryHint: 'Compound-Derived',
        difficultyHint: 'intermediate'
      });
    }

    return {
      reactions: reactions.slice(0, limit),
      totalCount: reactions.length,
      searchTerm: compoundQuery
    };

  } catch (error) {
    console.error('Error searching reactions by compound:', error);
    return { reactions: [], totalCount: 0, searchTerm: compoundQuery };
  }
};

/**
 * Get popular/common reactions from PubChem
 */
export const getPopularReactions = async (limit: number = 10): Promise<PubChemReaction[]> => {
  try {
    // Return a curated list of common reactions
    const popularReactions: PubChemReaction[] = [
      {
        rid: 1001,
        name: 'Methane Combustion',
        smiles: 'C.O=O>>O=C.O',
        reactants: ['CH4', 'O2'],
        products: ['CO2', 'H2O'],
        description: 'Complete combustion of methane'
      },
      {
        rid: 2001,
        name: 'Acid-Base Neutralization',
        smiles: 'Cl.[Na+].[OH-]>>[Na+].[Cl-].O',
        reactants: ['HCl', 'NaOH'],
        products: ['NaCl', 'H2O'],
        description: 'Neutralization reaction'
      },
      {
        rid: 3001,
        name: 'Esterification',
        smiles: 'CC(=O)O.CCO>>CC(=O)OCC.O',
        reactants: ['CH3COOH', 'C2H5OH'],
        products: ['CH3COOC2H5', 'H2O'],
        description: 'Formation of ester from carboxylic acid and alcohol'
      },
      {
        rid: 4001,
        name: 'SN2 Reaction',
        smiles: 'CCCl.CC[O-]>>CCO.CCCl',
        reactants: ['CH3CH2Cl', 'OH-'],
        products: ['CH3CH2OH', 'Cl-'],
        description: 'Nucleophilic substitution with alkyl halide'
      },
      {
        rid: 5001,
        name: 'Electrophilic Aromatic Substitution',
        smiles: 'c1ccccc1.O=[N+](=O)[O-]>>c1ccccc1[N+](=O)[O-]',
        reactants: ['C6H6', 'HNO3'],
        products: ['C6H5NO2', 'H2O'],
        description: 'Nitration of benzene'
      },
      {
        rid: 6001,
        name: 'Ketone Reduction',
        smiles: 'CC(=O)C.[H][H]>>CC(O)C',
        reactants: ['Acetone', 'H2'],
        products: ['Isopropanol'],
        description: 'Reduction of ketone to secondary alcohol'
      },
      {
        rid: 6002,
        name: 'Alcohol Oxidation',
        smiles: 'CCO.O=O>>CC=O.O',
        reactants: ['Ethanol', 'O2'],
        products: ['Acetaldehyde', 'H2O'],
        description: 'Oxidation of primary alcohol to aldehyde'
      },
      {
        rid: 3002,
        name: 'Saponification',
        smiles: 'CCCCCCCC(=O)OCC.O>>CCCCCCCC(=O)O.CCO',
        reactants: ['Triglyceride', 'NaOH'],
        products: ['Soap', 'Glycerol'],
        description: 'Hydrolysis of ester to form soap'
      }
    ];

    return popularReactions.slice(0, limit);

  } catch (error) {
    console.error('Error fetching popular reactions:', error);
    return [];
  }
};
export const fetchSDFBySmiles = async (smiles: string, recordType: '2d' | '3d' = '2d'): Promise<string | null> => {
  try {
    const encoded = encodeURIComponent(smiles);
    const sdfUrl = `${PUBCHEM_PUG_URL}/compound/SMILES/${encoded}/SDF?record_type=${recordType}`;
    console.log(` Fetching ${recordType.toUpperCase()} SDF for SMILES ${smiles}`);

    const response = await fetchWithRetry(sdfUrl);
    if (response && response.ok) {
      const sdfText = await response.text();
      if (sdfText?.trim().length) {
        console.log(` SDF (${recordType.toUpperCase()}) fetched successfully for SMILES ${smiles}`);
        return sdfText;
      }
    }

    console.warn(` Could not fetch ${recordType.toUpperCase()} SDF for SMILES ${smiles}`);
    return null;
  } catch (error) {
    console.error(` Error fetching ${recordType.toUpperCase()} SDF for SMILES ${smiles}:`, error);
    return null;
  }
};
