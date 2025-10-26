// PubChem API Service for fetching molecule structures
// Documentation: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest

import type { MoleculeAnalysisResult } from './moleculeAnalysisService';

const PUBCHEM_BASE_URL = 'https://pubchem.ncbi.nlm.nih.gov';
const PUBCHEM_PUG_URL = `${PUBCHEM_BASE_URL}/rest/pug`;
const EUTILS_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export const DEFAULT_REAGENT_QUERY = 'reagent[Chemical Role]';

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
  analysis?: MoleculeAnalysisResult;
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
  const nameEndpoint = `${PUBCHEM_PUG_URL}/compound/name/${encodeURIComponent(identifier)}/property/CanonicalSMILES/JSON`;
  const nameResult = await tryEndpoint(nameEndpoint);
  if (nameResult) {
    console.log('✅ Fetched SMILES from PubChem using compound name');
    return nameResult;
  }

  console.warn(`⚠️ Unable to verify SMILES for input: ${identifier}`);
  return null;
};

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
      if (i === retries - 1) return response; // Return final response
    } catch (error) {
      if (i === retries - 1) throw error;
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
