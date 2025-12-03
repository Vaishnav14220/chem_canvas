// RDKit Service for 3D molecule visualization and structure generation
// Uses RDKit.js (WebAssembly) for client-side molecular computations

import type { MoleculeData } from './pubchemService';
import { fetchSDFBySmiles } from './pubchemService';

declare global {
  interface Window {
    RDKit: any;
  }
}

let rdkitModule: any = null;

const fetchPubChemFallback3D = async (smiles: string, name?: string): Promise<RDKit3DData | null> => {
  const sdf = (await fetchSDFBySmiles(smiles, '3d')) || (await fetchSDFBySmiles(smiles, '2d'));
  if (!sdf) {
    return null;
  }
  console.warn('rdkit_fallback_pubchem Using PubChem SDF fallback for', smiles);
  return {
    pdb: '',
    sdf,
    smiles,
    name,
  };
};


// Common molecules database with SMILES
const COMMON_MOLECULES: Record<string, { smiles: string; formula: string; weight: number }> = {
  // Alkanes
  'methane': { smiles: 'C', formula: 'CH4', weight: 16.04 },
  'ethane': { smiles: 'CC', formula: 'C2H6', weight: 30.07 },
  'propane': { smiles: 'CCC', formula: 'C3H8', weight: 44.10 },
  'butane': { smiles: 'CCCC', formula: 'C4H10', weight: 58.12 },
  'pentane': { smiles: 'CCCCC', formula: 'C5H12', weight: 72.15 },
  'hexane': { smiles: 'CCCCCC', formula: 'C6H14', weight: 86.18 },

  // Alkenes
  'ethene': { smiles: 'C=C', formula: 'C2H4', weight: 28.05 },
  'ethylene': { smiles: 'C=C', formula: 'C2H4', weight: 28.05 },
  'propene': { smiles: 'CC=C', formula: 'C3H6', weight: 42.08 },
  'propylene': { smiles: 'CC=C', formula: 'C3H6', weight: 42.08 },
  'ethyne': { smiles: 'C#C', formula: 'C2H2', weight: 26.04 },
  'acetylene': { smiles: 'C#C', formula: 'C2H2', weight: 26.04 },

  // Aromatics
  'benzene': { smiles: 'c1ccccc1', formula: 'C6H6', weight: 78.11 },
  'toluene': { smiles: 'Cc1ccccc1', formula: 'C7H8', weight: 92.14 },
  'phenol': { smiles: 'Oc1ccccc1', formula: 'C6H6O', weight: 94.11 },
  'aniline': { smiles: 'Nc1ccccc1', formula: 'C6H7N', weight: 93.13 },

  // Alcohols
  'methanol': { smiles: 'CO', formula: 'CH4O', weight: 32.04 },
  'ethanol': { smiles: 'CCO', formula: 'C2H6O', weight: 46.07 },
  'propanol': { smiles: 'CCCO', formula: 'C3H8O', weight: 60.10 },
  'isopropanol': { smiles: 'CC(C)O', formula: 'C3H8O', weight: 60.10 },
  'butanol': { smiles: 'CCCCO', formula: 'C4H10O', weight: 74.12 },
  'glycerol': { smiles: 'OCC(O)CO', formula: 'C3H8O3', weight: 92.09 },

  // Ketones and Aldehydes
  'acetone': { smiles: 'CC(=O)C', formula: 'C3H6O', weight: 58.08 },
  'acetaldehyde': { smiles: 'CC=O', formula: 'C2H4O', weight: 44.05 },
  'formaldehyde': { smiles: 'C=O', formula: 'CH2O', weight: 30.03 },

  // Acids
  'acetic acid': { smiles: 'CC(=O)O', formula: 'C2H4O2', weight: 60.05 },
  'formic acid': { smiles: 'C(=O)O', formula: 'CH2O2', weight: 46.03 },
  'propanoic acid': { smiles: 'CCC(=O)O', formula: 'C3H6O2', weight: 74.08 },

  // Amines
  'ammonia': { smiles: 'N', formula: 'NH3', weight: 17.03 },
  'methylamine': { smiles: 'CN', formula: 'CH5N', weight: 31.06 },
  'ethylamine': { smiles: 'CCN', formula: 'C2H7N', weight: 45.08 },

  // Sugars
  'glucose': { smiles: 'OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O', formula: 'C6H12O6', weight: 180.16 },
  'fructose': { smiles: 'OC[C@@H](O)[C@@H](O)[C@H](O)C(=O)CO', formula: 'C6H12O6', weight: 180.16 },
  'sucrose': { smiles: 'OC[C@H]1O[C@H]([C@H](O)[C@@H]1O)O[C@@H]2[C@@H](O[C@@H](O[C@H]2O)CO)CO', formula: 'C12H22O11', weight: 342.30 },

  // Pharmaceuticals
  'caffeine': { smiles: 'Cn1cnc2n(C)c(=O)n(C)c(=O)c12', formula: 'C8H10N4O2', weight: 194.19 },
  'aspirin': { smiles: 'CC(=O)Oc1ccccc1C(=O)O', formula: 'C9H8O4', weight: 180.16 },
  'ibuprofen': { smiles: 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O', formula: 'C13H18O2', weight: 206.29 },
  'paracetamol': { smiles: 'CC(=O)Nc1ccc(O)cc1', formula: 'C8H9NO2', weight: 151.16 },
  'acetaminophen': { smiles: 'CC(=O)Nc1ccc(O)cc1', formula: 'C8H9NO2', weight: 151.16 },

  // Other common compounds
  'water': { smiles: 'O', formula: 'H2O', weight: 18.02 },
  'carbon dioxide': { smiles: 'O=C=O', formula: 'CO2', weight: 44.01 },
  'co2': { smiles: 'O=C=O', formula: 'CO2', weight: 44.01 },
  'hydrogen': { smiles: '[H][H]', formula: 'H2', weight: 2.02 },
  'oxygen': { smiles: 'O=O', formula: 'O2', weight: 32.00 },
  'nitrogen': { smiles: 'N#N', formula: 'N2', weight: 28.01 },
  'hydrogen peroxide': { smiles: 'OO', formula: 'H2O2', weight: 34.01 },

  // Amino acids
  'glycine': { smiles: 'NCC(=O)O', formula: 'C2H5NO2', weight: 75.07 },
  'alanine': { smiles: 'N[C@@H](C)C(=O)O', formula: 'C3H7NO2', weight: 89.09 },
  'valine': { smiles: 'N[C@@H](C(C)C)C(=O)O', formula: 'C5H11NO2', weight: 117.15 },
  'leucine': { smiles: 'N[C@@H](CC(C)C)C(=O)O', formula: 'C6H13NO2', weight: 131.17 },
  'isoleucine': { smiles: 'N[C@@H]([C@@H](C)CC)C(=O)O', formula: 'C6H13NO2', weight: 131.17 },

  // Nucleic acid bases
  'adenine': { smiles: 'Nc1ncnc2ncnc12', formula: 'C5H5N5', weight: 135.13 },
  'guanine': { smiles: 'Nc1nc2c(=O)[nH]c(nc2[nH]c1=O)N', formula: 'C5H5N5O', weight: 151.13 },
  'cytosine': { smiles: 'Nc1cc[nH]c(=O)n1', formula: 'C4H5N3O', weight: 111.10 },
  'thymine': { smiles: 'Cc1c[nH]c(=O)[nH]c1=O', formula: 'C5H6N2O2', weight: 126.11 },
  'uracil': { smiles: 'O=c1cc[nH]c(=O)[nH]1', formula: 'C4H4N2O2', weight: 112.09 }
};

export interface RDKitMolecule {
  mol: any;
  smiles: string;
  name?: string;
  cid?: number;
}

export interface RDKit3DData {
  pdb: string;
  sdf: string;
  smiles: string;
  name?: string;
}

// Initialize RDKit WebAssembly module
export const initRDKit = async (): Promise<boolean> => {
  if (rdkitModule) return true;

  try {
    // Load RDKit from CDN
    if (!window.RDKit) {
      await loadRDKitScript();
    }

    rdkitModule = window.RDKit;
    console.log('✅ RDKit initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize RDKit:', error);
    return false;
  }
};

// Load RDKit script from CDN
const loadRDKitScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.RDKit) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@rdkit/rdkit@2023.9.6/Code/MinimalLib/dist/RDKit_minimal.js';
    script.onload = () => {
      // RDKit needs to initialize after script load
      window.RDKit.get_rdkit_module().then((module: any) => {
        window.RDKit = module;
        resolve();
      }).catch(reject);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// Generate 3D coordinates for a molecule from SMILES
export const generate3DStructure = async (smiles: string, name?: string): Promise<RDKit3DData | null> => {
  if (!rdkitModule) {
    const initialized = await initRDKit();
    if (!initialized) {
      return fetchPubChemFallback3D(smiles, name);
    }
  }

  try {
    console.log(` Generating 3D structure for: ${smiles}`);

    const mol = rdkitModule.get_mol(smiles);
    if (!mol) {
      console.error(' Failed to create molecule from SMILES');
      return fetchPubChemFallback3D(smiles, name);
    }

    mol.add_hs();

    const success = mol.embed_molecule(true);
    if (!success) {
      console.error(' Failed to generate 3D coordinates');
      mol.delete();
      return fetchPubChemFallback3D(smiles, name);
    }

    try {
      mol.mmff_optimize_molecule();
    } catch (error) {
      console.warn(' MMFF optimization failed, using raw coordinates');
    }

    const sdf = mol.get_sdf();
    const pdb = mol.get_pdb();
    mol.delete();

    return {
      pdb,
      sdf,
      smiles,
      name
    };
  } catch (error) {
    console.error(' Error generating 3D structure:', error);
    return fetchPubChemFallback3D(smiles, name);
  }
};

// Convert SMILES to 2D SVG
export const smilesToSVG = async (smiles: string, width: number = 300, height: number = 200): Promise<string | null> => {
  if (!rdkitModule) {
    const initialized = await initRDKit();
    if (!initialized) return null;
  }

  try {
    const mol = rdkitModule.get_mol(smiles);
    if (!mol) return null;

    const svg = mol.get_svg(width, height);
    mol.delete();

    return svg;
  } catch (error) {
    console.error('❌ Error converting SMILES to SVG:', error);
    return null;
  }
};

// Convert reaction SMILES to 2D SVG representation using HuggingFace API
export const reactionSmilesToSVGHuggingFace = async (reactionSmiles: string): Promise<string | null> => {
  try {
    // Send raw SMILES directly from Gemini to HF API
    // Add show_atom_numbers: false to prevent atom numbering
    const response = await fetch('https://smitathkr1-rdkit-smiles-to-reaction.hf.space/api/render/svg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        smiles: reactionSmiles,
        show_atom_numbers: false  // Disable atom numbering/labels
      })
    });

    if (!response.ok) {
      console.error('❌ HuggingFace API error:', response.statusText);
      return null;
    }

    const svgText = await response.text();
    return svgText;
  } catch (error) {
    console.error('❌ Error rendering reaction SVG via HuggingFace API:', error);
    return null;
  }
};

// Convert reaction SMILES to 2D SVG representation (local RDKit fallback)
export const reactionSmilesToSVG = async (reactionSmiles: string, width: number = 900, height: number = 320): Promise<string | null> => {
  if (!rdkitModule) {
    const initialized = await initRDKit();
    if (!initialized) {
      return null;
    }
  }

  try {
    if (typeof rdkitModule.get_rxn !== 'function') {
      console.warn('⚠️ RDKit reaction helpers are not available in the current build.');
      return null;
    }

    const rxn = rdkitModule.get_rxn(reactionSmiles);
    if (!rxn) {
      console.warn('⚠️ RDKit could not create reaction from SMILES');
      return null;
    }

    const svg = typeof rxn.get_svg === 'function' ? rxn.get_svg(width, height) : null;
    if (typeof rxn.delete === 'function') {
      rxn.delete();
    }

    return svg;
  } catch (error) {
    console.error('❌ Error rendering reaction SVG via RDKit:', error);
    return null;
  }
};

// Validate SMILES string
export const validateSMILES = async (smiles: string): Promise<boolean> => {
  if (!rdkitModule) {
    const initialized = await initRDKit();
    if (!initialized) return false;
  }

  try {
    const mol = rdkitModule.get_mol(smiles);
    if (!mol) return false;

    const isValid = mol.is_valid();
    mol.delete();

    return isValid;
  } catch (error) {
    return false;
  }
};

// Get molecular properties
export const getMolecularProperties = async (smiles: string): Promise<any> => {
  if (!rdkitModule) {
    const initialized = await initRDKit();
    if (!initialized) return null;
  }

  try {
    const mol = rdkitModule.get_mol(smiles);
    if (!mol) return null;

    const properties = {
      molecularWeight: mol.get_mw(),
      formula: mol.get_molecular_formula(),
      numAtoms: mol.get_num_atoms(),
      numBonds: mol.get_num_bonds(),
      numRings: mol.get_num_rings(),
      tpsa: mol.get_tpsa(),
      logp: mol.get_logp()
    };

    mol.delete();
    return properties;
  } catch (error) {
    console.error('❌ Error getting molecular properties:', error);
    return null;
  }
};

// Create 3D viewer URL (fallback to MolView if RDKit fails)
export const getRDKit3DViewerUrl = async (smiles: string, name?: string): Promise<string> => {
  // Try RDKit first
  const rdkitData = await generate3DStructure(smiles, name);
  if (rdkitData) {
    // For now, return MolView URL as fallback since we can't embed RDKit 3D viewer directly
    // In a full implementation, you'd integrate with 3Dmol.js or similar
    return `https://embed.molview.org/v1/?mode=balls&smiles=${encodeURIComponent(smiles)}`;
  }

  // Fallback to MolView
  return `https://embed.molview.org/v1/?mode=balls&smiles=${encodeURIComponent(smiles)}`;
};

// Check if RDKit is ready
export const isRDKitReady = (): boolean => {
  return rdkitModule !== null;
};

// Convert molecule name to SMILES using RDKit database
export const nameToSMILES = (moleculeName: string): string | null => {
  const lowerName = moleculeName.toLowerCase().trim();
  const molecule = COMMON_MOLECULES[lowerName];
  return molecule ? molecule.smiles : null;
};

// Get molecule data by name using RDKit (primary source)
export const getMoleculeByNameRDKit = async (moleculeName: string): Promise<MoleculeData | null> => {
  try {
    console.log(`🧪 === Fetching molecule from RDKit: ${moleculeName} ===`);

    // First try our built-in database
    const lowerName = moleculeName.toLowerCase().trim();
    const moleculeInfo = COMMON_MOLECULES[lowerName];

    if (moleculeInfo) {
      console.log(`✅ Found in RDKit database: ${moleculeInfo.smiles}`);

      // Validate SMILES with RDKit if available
      if (rdkitModule) {
        const isValid = await validateSMILES(moleculeInfo.smiles);
        if (!isValid) {
          console.warn(`⚠️ SMILES validation failed for ${moleculeName}, but using anyway`);
        }
      }

      // Generate 2D SVG if RDKit is available
      let svgData: string | undefined = undefined;
      if (rdkitModule) {
        svgData = await smilesToSVG(moleculeInfo.smiles) || undefined;
      }

      return {
        name: moleculeName,
        cid: 0, // No CID for RDKit-generated molecules
        molecularFormula: moleculeInfo.formula,
        molecularWeight: moleculeInfo.weight,
        svgUrl: '', // Will use svgData instead
        svgData: svgData,
        smiles: moleculeInfo.smiles,
        source: 'rdkit'
      };
    }

    // If not in database, try RDKit name recognition (limited capability)
    if (rdkitModule) {
      console.log(`📍 Not in database, trying RDKit name recognition...`);
      // RDKit has limited name-to-SMILES capability, but we can try some patterns
      const alternativeNames: Record<string, string> = {
        'h2o': 'O',
        'co2': 'O=C=O',
        'n2': 'N#N',
        'o2': 'O=O',
        'h2': '[H][H]',
        'nh3': 'N',
        'ch4': 'C'
      };

      const altSmiles = alternativeNames[lowerName];
      if (altSmiles) {
        const isValid = await validateSMILES(altSmiles);
        if (isValid) {
          const svgData = await smilesToSVG(altSmiles) || undefined;
          return {
            name: moleculeName,
            cid: 0,
            molecularFormula: 'Unknown', // Would need to calculate
            molecularWeight: 0, // Would need to calculate
            svgUrl: '',
            svgData: svgData,
            smiles: altSmiles,
            source: 'rdkit'
          };
        }
      }
    }

    console.error(`❌ Molecule "${moleculeName}" not found in RDKit database`);
    return null;

  } catch (error) {
    console.error('❌ Error fetching molecule from RDKit:', error);
    return null;
  }
};

// Get autocomplete suggestions from RDKit database
export const getRDKitAutocomplete = (query: string, limit: number = 8): string[] => {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];

  const matches = Object.keys(COMMON_MOLECULES)
    .filter(name => name.toLowerCase().includes(lowerQuery))
    .slice(0, limit);

  return matches;
};
