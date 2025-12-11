import React, { useEffect, useState } from 'react';
import {
  Beaker,
  Layers3,
  Sparkles,
  Zap,
  Gem,
  Compass,
  RefreshCcw,
  ChevronRight,
  Download,
  Loader2,
  Waves,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import JSmolViewer from './JSmolViewer';
import SymmetryQuiz from './SymmetryQuiz';
import ReactionMechanismAnimator from './ReactionMechanismAnimator';
import ResolvedReactionPath from './ResolvedReactionPath';
import type { ReactionResolutionResult } from '../services/reactionResolver';
import { fetchCanonicalSmiles } from '../services/pubchemService';
import { initializeGemini, isGeminiInitialized, resolveMoleculeDescription } from '../services/geminiService';
import { generateTextContent } from '../services/geminiService';

const PDB_REFERENCE = 'https://files.rcsb.org/download/1CRN.pdb';
const NACL_CIF_INLINE = `
data_NaCl
_symmetry_space_group_name_H-M    'F m -3 m'
_cell_length_a    5.6402
_cell_length_b    5.6402
_cell_length_c    5.6402
_cell_angle_alpha 90
_cell_angle_beta  90
_cell_angle_gamma 90
_symmetry_Int_Tables_number 225

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Na1 Na 0.00000 0.00000 0.00000
Cl1 Cl 0.50000 0.50000 0.50000
`;

const QUARTZ_CIF = `
data_alpha_quartz
_symmetry_space_group_name_H-M 'P 3_1 2'
_cell_length_a 4.9133
_cell_length_b 4.9133
_cell_length_c 5.4053
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 120
_symmetry_Int_Tables_number 152

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Si1 Si 0.4697 0.0000 0.0000
Si2 Si 0.0000 0.4697 0.6667
O1  O  0.4133 0.2667 0.1188
O2  O  0.2667 0.4133 0.7855
`;

const CALCITE_CIF = `
data_calcite
_symmetry_space_group_name_H-M 'R -3 c'
_cell_length_a 4.9896
_cell_length_b 4.9896
_cell_length_c 17.0610
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 120
_symmetry_Int_Tables_number 167

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Ca1 Ca 0.0000 0.0000 0.2500
C1  C  0.0000 0.0000 0.0000
O1  O  0.2546 0.0000 0.1146
O2  O  0.0000 0.2546 0.8854
O3  O  0.7454 0.7454 0.1146
`;

const FLUORITE_CIF = `
data_fluorite
_symmetry_space_group_name_H-M 'F m -3 m'
_cell_length_a 5.463
_cell_length_b 5.463
_cell_length_c 5.463
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_symmetry_Int_Tables_number 225

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Ca1 Ca 0.0000 0.0000 0.0000
F1  F  0.2500 0.2500 0.2500
F2  F  0.7500 0.7500 0.7500
`;

const PEROVSKITE_CIF = `
data_perovskite
_symmetry_space_group_name_H-M 'P m -3 m'
_cell_length_a 3.905
_cell_length_b 3.905
_cell_length_c 3.905
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_symmetry_Int_Tables_number 221

loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Ca1 Ca 0.0000 0.0000 0.0000
Ti1 Ti 0.5000 0.5000 0.5000
O1  O  0.5000 0.5000 0.0000
O2  O  0.5000 0.0000 0.5000
O3  O  0.0000 0.5000 0.5000
`;

interface VisualizationDemo {
  id: string;
  title: string;
  description: string;
  script: string;
  tags: string[];
}

interface MineralStructure {
  id: string;
  name: string;
  formula: string;
  system: string;
  description: string;
  script: string;
}

const createCifScript = (cif: string, extraCommands = '') => `
      load data "CIF"
${cif.trim()}
END "CIF" {1 1 1};
      unitcell on;
      axes 3;
      boundbox on;
      set perspectiveDepth true;
      select all;
      spacefill 25%;
      wireframe 0.15;
      color atoms cpk;
      ${extraCommands}
      spin y 3;
    `;


const mineralStructures: MineralStructure[] = [
  // Crystal structures from COD (Crystallography Open Database)
  {
    id: 'nacl',
    name: 'NaCl (Rock Salt)',
    formula: 'NaCl',
    system: 'FCC',
    description: 'Classic ionic crystal - Na+ and Cl- in FCC lattice.',
    script: `
      load =cod/1000041 {1 1 1};
      unitcell on;
      axes 3;
      boundbox on;
      spacefill 25%;
      wireframe 0.15;
      color atoms cpk;
      spin y 3;
    `,
  },
  {
    id: 'iron-bcc',
    name: 'Iron (BCC)',
    formula: 'Fe',
    system: 'BCC',
    description: 'Body-centered cubic iron structure.',
    script: `
      load =cod/9008536 {1 1 1};
      unitcell on;
      axes 3;
      boundbox on;
      spacefill 30%;
      wireframe 0.15;
      color atoms cpk;
      spin y 3;
    `,
  },
  {
    id: 'copper-fcc',
    name: 'Copper (FCC)',
    formula: 'Cu',
    system: 'FCC',
    description: 'Face-centered cubic copper structure.',
    script: `
      load =cod/9008468 {1 1 1};
      unitcell on;
      axes 3;
      boundbox on;
      spacefill 30%;
      wireframe 0.15;
      color atoms [200,120,50];
      spin y 3;
    `,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    formula: 'C',
    system: 'Diamond cubic',
    description: 'Diamond cubic carbon structure with sp3 bonding.',
    script: `
      load =cod/9008565 {1 1 1};
      unitcell on;
      axes 3;
      boundbox on;
      spacefill 25%;
      wireframe 0.15;
      color atoms cpk;
      spin y 3;
    `,
  },
  {
    id: 'quartz',
    name: 'Quartz',
    formula: 'SiO₂',
    system: 'Trigonal',
    description: 'Silicon dioxide crystal structure.',
    script: `
      load =cod/9012602 {1 1 1};
      unitcell on;
      axes 3;
      boundbox on;
      spacefill 25%;
      wireframe 0.15;
      select silicon;
      color yellow;
      select oxygen;
      color [150,200,255];
      spin y 3;
    `,
  },
  {
    id: 'calcite',
    name: 'Calcite',
    formula: 'CaCO₃',
    system: 'Trigonal',
    description: 'Calcium carbonate mineral structure.',
    script: `
      load =cod/9000095 {1 1 1};
      unitcell on;
      axes 3;
      boundbox on;
      spacefill 25%;
      wireframe 0.15;
      color atoms cpk;
      spin y 3;
    `,
  },
  {
    id: 'fluorite',
    name: 'Fluorite',
    formula: 'CaF₂',
    system: 'Cubic',
    description: 'Calcium fluoride crystal structure.',
    script: `
      load =cod/1000043 {1 1 1};
      unitcell on;
      axes 3;
      boundbox on;
      spacefill 25%;
      wireframe 0.15;
      color atoms cpk;
      spin y 3;
    `,
  },
  {
    id: 'magnesium-hcp',
    name: 'Magnesium (HCP)',
    formula: 'Mg',
    system: 'HCP',
    description: 'Hexagonal close-packed magnesium.',
    script: `
      load =cod/9008506 {1 1 1};
      unitcell on;
      axes 3;
      boundbox on;
      spacefill 30%;
      wireframe 0.15;
      color atoms [180,180,180];
      spin y 3;
    `,
  },
];





const visualizationDemos: VisualizationDemo[] = [
  {
    id: 'ball-stick',
    title: 'Ball & Stick + CPK',
    description: 'Highlights covalent framework with subtle spacefill for atom radii.',
    tags: ['organic', 'fundamentals'],
    script: `
      load $caffeine;
      wireframe 0.18;
      spacefill 20%;
      select all;
      color cpk;
      spin y 5;
    `,
  },
  {
    id: 'spacefill',
    title: 'Spacefill Density',
    description: 'Van der Waals radii emphasize steric crowding in aromatic systems.',
    tags: ['sterics', 'vdW'],
    script: `
      load $benzene;
      wireframe off;
      spacefill 120%;
      color atoms cpk;
      spin x 4;
    `,
  },
  {
    id: 'cartoon',
    title: 'Cartoon Ribbons',
    description: 'Secondary structure ribbon coloring for quick protein folding context.',
    tags: ['proteins', 'cartoon'],
    script: `
      load "${PDB_REFERENCE}";
      cartoon only;
      color cartoon structure;
      set cartoonFancy true;
      spin y 3;
    `,
  },
  {
    id: 'surface',
    title: 'Solvent Accessible Surface',
    description: 'Transparent SAS overlay colored by B-factor/temperature.',
    tags: ['surface', 'solvent'],
    script: `
      load "${PDB_REFERENCE}";
      cartoon on;
      color cartoon [50,150,255];
      isosurface solvent 1.4 molecular translucent 0.35;
      color isosurface temperature;
      spin y 5;
    `,
  },
  {
    id: 'mesh',
    title: 'Mesh Surface + Stick Detail',
    description: 'Mesh isosurface with stick representation for active-site inspection.',
    tags: ['mesh', 'active site'],
    script: `
      load "${PDB_REFERENCE}";
      wireframe 0.12;
      select protein;
      color bonds [255,255,255];
      isosurface mesh molecular translucent 0.45;
      color isosurface yellow;
      spin x 6;
    `,
  },
  {
    id: 'symmetry',
    title: 'Crystal + Unit Cell',
    description: 'Unit cell, axes, and octahedral coordination polyhedra for NaCl.',
    tags: ['crystal', 'symmetry'],
    script: `
      load data "CIF"
${NACL_CIF_INLINE}
END "CIF";
      set unitcell {5.64 5.64 5.64 90 90 90};
      unitcell on;
      axes 3;
      boundbox on;
      polyhedra sodium (6) chloride translucent 0.4;
      color polyhedra yellow;
      spin y 5;
    `,
  },
];

const QUICK_MOLECULES = [
  { name: 'Water', detail: 'H₂O', smiles: 'O' },
  { name: 'Methane', detail: 'CH₄', smiles: 'C' },
  { name: 'Benzene', detail: 'C₆H₆', smiles: 'c1ccccc1' },
  { name: 'Caffeine', detail: 'Stimulant', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C' },
];

const SAMPLE_STRUCTURE_URL = 'https://files.rcsb.org/download/1CRN.pdb';

type WorkspaceCategory = 'molecule' | 'protein' | 'crystal' | 'reaction';

const CATEGORY_TABS: Array<{ id: WorkspaceCategory; label: string }> = [
  { id: 'molecule', label: 'Molecules' },
  { id: 'protein', label: 'Proteins' },
  { id: 'crystal', label: 'Crystals' },
  { id: 'reaction', label: 'Reaction Animator' },
];

const CATEGORY_HINTS: Record<WorkspaceCategory, string[]> = {
  molecule: [':aspirin', '$caffeine', 'Benzene', 'Glucose'],
  protein: ['=1CRN', '=1A3N', 'Hemoglobin', 'Insulin', 'DNA'],
  crystal: ['Quartz', 'Calcite', 'NaCl', 'Diamond'],
  reaction: ['Diels-Alder', 'Suzuki coupling', 'SN2', 'E2 elimination'],
};

const MolecularVisualizationWorkspace: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<string>(visualizationDemos[0].id);
  const [script, setScript] = useState<string>(visualizationDemos[0].script);
  const [jsmolCommand, setJsmolCommand] = useState<string>(''); // For one-off commands
  const [structureUrl, setStructureUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [selectedMineral, setSelectedMineral] = useState<string>(mineralStructures[0].id);
  const [selectedCategory, setSelectedCategory] = useState<WorkspaceCategory>('molecule');
  const [reactionSearchQuery, setReactionSearchQuery] = useState<string | null>(null);
  const [reactionSearchSeed, setReactionSearchSeed] = useState(0);
  const [reactionResolution, setReactionResolution] = useState<ReactionResolutionResult | null>(null);
  useEffect(() => {
    if (selectedCategory !== 'reaction') {
      setReactionResolution(null);
    }
  }, [selectedCategory]);
  const [quizOpen, setQuizOpen] = useState(false);
  const [aiCommand, setAiCommand] = useState('');
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Protein Analysis Panel State
  const [representation, setRepresentation] = useState<'cartoon' | 'surface' | 'ballstick' | 'spacefill' | 'wireframe'>('cartoon');
  const [colorScheme, setColorScheme] = useState<'structure' | 'chain' | 'cpk' | 'bfactor' | 'residue'>('structure');
  const [spinEnabled, setSpinEnabled] = useState(true);
  const [loadedPdbId, setLoadedPdbId] = useState<string | null>(null);

  // Apply representation change
  const applyRepresentation = (rep: typeof representation) => {
    setRepresentation(rep);
    const repScripts: Record<typeof representation, string> = {
      cartoon: 'cartoon only; set cartoonFancy true;',
      surface: 'isosurface sasurface translucent 0.4;',
      ballstick: 'wireframe 0.15; spacefill 20%;',
      spacefill: 'spacefill only;',
      wireframe: 'wireframe 0.1; spacefill off;',
    };
    setScript(prev => `${prev}\n${repScripts[rep]}`);
  };

  // Apply color scheme change
  const applyColorScheme = (scheme: typeof colorScheme) => {
    setColorScheme(scheme);
    const colorScripts: Record<typeof colorScheme, string> = {
      structure: 'color structure;',
      chain: 'color chain;',
      cpk: 'color cpk;',
      bfactor: 'color temperature;',
      residue: 'color amino;',
    };
    setScript(prev => `${prev}\n${colorScripts[scheme]}`);
  };

  // Toggle spin
  const toggleSpin = () => {
    setSpinEnabled(!spinEnabled);
    setScript(prev => `${prev}\n${spinEnabled ? 'spin off;' : 'spin y 5;'}`);
  };

  // Export image
  const exportImage = () => {
    setScript(prev => `${prev}\nwrite image PNG "structure.png";`);
  };

  // Execute a one-off JSmol command (for controls)
  const runJsmolCommand = (cmd: string) => {
    // Add timestamp to make command unique for change detection
    setJsmolCommand(`${cmd}; // ${Date.now()}`);
  };


  const handleRunDemo = (demo: VisualizationDemo) => {
    setActiveDemo(demo.id);
    setScript(demo.script);
  };

  const handleLoadMineral = (mineral: MineralStructure) => {
    setScript(mineral.script);
  };

  const handleResetView = () => {
    setActiveDemo(visualizationDemos[0].id);
    setScript(visualizationDemos[0].script);
    setStructureUrl('');
  };

  const loadSmilesIntoViewer = (smiles: string, label?: string) => {
    const sanitized = smiles.replace(/"/g, '').trim();
    if (!sanitized) {
      throw new Error('No SMILES string available to load.');
    }
    setScript(`load $${sanitized}; wireframe 0.15; spacefill 20%; color cpk; rotate best;`);
    if (label) {
      setSearchFeedback(`Loaded ${label}`);
    }
  };

  const loadQuickMolecule = (smiles: string) => {
    loadSmilesIntoViewer(smiles);
  };

  const loadSampleStructure = () => {
    setStructureUrl(SAMPLE_STRUCTURE_URL);
    setScript(`load "${SAMPLE_STRUCTURE_URL}"; spacefill off; wireframe 0.15; select all; color cpk;`);
  };

  const loadFromUrl = (overrideValue?: string) => {
    const value = (overrideValue ?? structureUrl).trim();
    if (!value) {
      return;
    }
    setScript(`load "${value}"; spacefill off; wireframe 0.15; color cpk;`);
  };

  const searchItems: Array<{
    id: string;
    label: string;
    keywords?: string[];
    action: () => void | Promise<void>;
  }> = [
      {
        id: 'sample-protein',
        label: 'Sample Protein (1CRN)',
        keywords: ['protein', '1crn', 'crambin'],
        action: () => loadSampleStructure(),
      },
      ...QUICK_MOLECULES.map((molecule) => ({
        id: `molecule-${molecule.name}`,
        label: molecule.name,
        keywords: [molecule.detail || '', 'molecule'],
        action: () => loadQuickMolecule(molecule.smiles),
      })),
      ...visualizationDemos.map((demo) => ({
        id: `demo-${demo.id}`,
        label: demo.title,
        keywords: demo.tags,
        action: () => handleRunDemo(demo),
      })),
      ...mineralStructures.map((mineral) => ({
        id: `mineral-${mineral.id}`,
        label: mineral.name,
        keywords: [mineral.system, mineral.formula, 'crystal'],
        action: () => {
          setSelectedMineral(mineral.id);
          handleLoadMineral(mineral);
        },
      })),
    ];

  const handleSearch = async (queryOverride?: string) => {
    const rawQuery = (queryOverride ?? searchQuery).trim();
    const query = rawQuery.toLowerCase();
    if (!query) {
      setSearchFeedback('Enter a molecule, preset, or URL to load.');
      return;
    }

    setIsSearchLoading(true);
    setSearchFeedback(null);

    try {
      // 1. Check for JSmol special prefixes for direct database loading
      // =PDB_ID - Load from RCSB PDB
      if (rawQuery.startsWith('=')) {
        const pdbId = rawQuery.substring(1).trim();
        setScript(`load =${pdbId}; cartoon only; color structure; spin y 3;`);
        setSearchFeedback(`Loaded protein ${pdbId.toUpperCase()} from RCSB PDB`);
        return;
      }

      // :compound - Load from PubChem
      if (rawQuery.startsWith(':')) {
        const compound = rawQuery.substring(1).trim();
        setScript(`load :${compound}; wireframe 0.15; spacefill 20%; color cpk; spin y 5;`);
        setSearchFeedback(`Loaded ${compound} from PubChem`);
        return;
      }

      // $compound - Load from NCI (National Cancer Institute)
      if (rawQuery.startsWith('$')) {
        const compound = rawQuery.substring(1).trim();
        setScript(`load $${compound}; wireframe 0.15; spacefill 20%; color cpk; spin y 5;`);
        setSearchFeedback(`Loaded ${compound} from NCI`);
        return;
      }

      // 2. Check for protein-related keywords
      const proteinKeywords = ['protein', 'enzyme', 'hemoglobin', 'insulin', 'lysozyme', 'dna', 'rna', 'antibody', 'receptor', 'kinase'];
      const isProteinQuery = proteinKeywords.some(kw => query.includes(kw)) || selectedCategory === 'protein';

      // 3. Check local preset matches
      const match = searchItems.find((item) => {
        if (item.label.toLowerCase().includes(query)) return true;
        return item.keywords?.some((keyword) => keyword.toLowerCase().includes(query));
      });

      if (match) {
        await Promise.resolve(match.action());
        setSearchFeedback(`Loaded ${match.label}`);
        return;
      }

      // 4. Handle URLs
      if (rawQuery.startsWith('http')) {
        setStructureUrl(rawQuery);
        loadFromUrl(rawQuery);
        setSearchFeedback('Loaded structure from URL');
        return;
      }

      // 5. Handle reactions
      if (selectedCategory === 'reaction') {
        setReactionSearchQuery(rawQuery);
        setReactionSearchSeed((seed) => seed + 1);
        setSearchFeedback(`Searching reaction "${rawQuery}"...`);
        setIsSearchLoading(false);
        return;
      }

      // 6. Try PubChem first for molecules
      const canonical = await fetchCanonicalSmiles(rawQuery);
      if (canonical) {
        loadSmilesIntoViewer(canonical, rawQuery);
        return;
      }

      // 7. Use AI to resolve the query (proteins, crystals, complex molecules)
      try {
        if (!isGeminiInitialized()) {
          initializeGemini();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gemini API key missing.';
        setSearchFeedback(message);
        return;
      }

      // Enhanced AI prompt for proteins and crystals
      if (isProteinQuery || selectedCategory === 'protein') {
        // First try direct lookup for common proteins (no API needed)
        const commonProteins: Record<string, string> = {
          'hemoglobin': '1A3N',
          'myoglobin': '1MBO',
          'insulin': '1MSO',
          'lysozyme': '1HEL',
          'crambin': '1CRN',
          'albumin': '1E78',
          'collagen': '1CAG',
          'keratin': '3TNU',
          'actin': '1ATN',
          'tubulin': '1TUB',
          'dna': '1BNA',
          'rna': '1EHZ',
          'antibody': '1IGT',
          'green fluorescent protein': '1GFL',
          'gfp': '1GFL',
          'ubiquitin': '1UBQ',
          'cytochrome': '1HRC',
          'rhodopsin': '1F88',
          'kinase': '1ATP',
          'atp synthase': '1E79',
          'polymerase': '1BPY',
          'ribosome': '4V6X',
          'histone': '1AOI',
        };

        // Check for direct match
        const directMatch = Object.entries(commonProteins).find(([name]) =>
          query.includes(name.toLowerCase())
        );

        if (directMatch) {
          const [proteinName, pdbId] = directMatch;
          setScript(`load =${pdbId}; cartoon only; color structure; set cartoonFancy true; spin y 3;`);
          setLoadedPdbId(pdbId);
          setSearchFeedback(`Loaded ${proteinName} (PDB: ${pdbId})`);
          return;
        }

        // If no direct match, try Gemini-based resolution
        try {
          if (!isGeminiInitialized()) {
            initializeGemini();
          }

          const pdbPrompt = `You are a biochemistry expert. The user wants to view: "${rawQuery}"
If this is a protein/enzyme/biomolecule, return ONLY the 4-letter PDB ID (e.g., "1CRN" for crambin, "1A3N" for hemoglobin).
If you're unsure, return the most famous/common PDB structure for that molecule.
Return ONLY the PDB ID, nothing else. No explanation.`;

          const pdbId = await generateTextContent(pdbPrompt);
          const cleanPdbId = pdbId?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

          if (cleanPdbId && cleanPdbId.length === 4) {
            setScript(`load =${cleanPdbId}; cartoon only; color structure; set cartoonFancy true; spin y 3;`);
            setLoadedPdbId(cleanPdbId);
            setSearchFeedback(`Loaded ${rawQuery} (PDB: ${cleanPdbId})`);
            return;
          }
        } catch (aiError) {
          console.warn('Gemini protein resolution failed:', aiError);
          // Continue to molecule fallback
        }
      }

      // Handle crystal/mineral queries with Gemini COD lookup
      const crystalKeywords = ['crystal', 'mineral', 'bcc', 'fcc', 'hcp', 'unit cell', 'lattice', 'quartz', 'calcite', 'diamond', 'graphite', 'halite', 'pyrite', 'fluorite', 'magnetite', 'galena', 'sphalerite', 'corundum', 'rutile', 'perovskite', 'spinel', 'garnet', 'olivine', 'feldspar', 'mica', 'zeolite'];
      const isCrystalQuery = crystalKeywords.some(kw => query.includes(kw)) || selectedCategory === 'crystal';

      if (isCrystalQuery) {
        // Common minerals with their COD IDs
        const commonMinerals: Record<string, { cod: string; name: string; structure: string }> = {
          'nacl': { cod: '1000041', name: 'Halite (NaCl)', structure: 'FCC' },
          'halite': { cod: '1000041', name: 'Halite (NaCl)', structure: 'FCC' },
          'rock salt': { cod: '1000041', name: 'Halite (NaCl)', structure: 'FCC' },
          'diamond': { cod: '9008565', name: 'Diamond', structure: 'Diamond cubic' },
          'graphite': { cod: '9000046', name: 'Graphite', structure: 'Hexagonal' },
          'quartz': { cod: '9012602', name: 'Quartz (SiO2)', structure: 'Trigonal' },
          'calcite': { cod: '9000095', name: 'Calcite (CaCO3)', structure: 'Trigonal' },
          'fluorite': { cod: '1000043', name: 'Fluorite (CaF2)', structure: 'FCC' },
          'pyrite': { cod: '1011023', name: 'Pyrite (FeS2)', structure: 'Cubic' },
          'magnetite': { cod: '9000926', name: 'Magnetite (Fe3O4)', structure: 'Spinel' },
          'corundum': { cod: '9000497', name: 'Corundum (Al2O3)', structure: 'Trigonal' },
          'rutile': { cod: '9004141', name: 'Rutile (TiO2)', structure: 'Tetragonal' },
          'perovskite': { cod: '1521529', name: 'Perovskite (CaTiO3)', structure: 'Cubic' },
          'iron': { cod: '9008536', name: 'Iron (BCC)', structure: 'BCC' },
          'bcc iron': { cod: '9008536', name: 'Iron (BCC)', structure: 'BCC' },
          'copper': { cod: '9008468', name: 'Copper (FCC)', structure: 'FCC' },
          'fcc copper': { cod: '9008468', name: 'Copper (FCC)', structure: 'FCC' },
          'gold': { cod: '9008463', name: 'Gold (FCC)', structure: 'FCC' },
          'silver': { cod: '9008459', name: 'Silver (FCC)', structure: 'FCC' },
          'aluminum': { cod: '9008460', name: 'Aluminum (FCC)', structure: 'FCC' },
          'magnesium': { cod: '9008506', name: 'Magnesium (HCP)', structure: 'HCP' },
          'zinc': { cod: '9008522', name: 'Zinc (HCP)', structure: 'HCP' },
          'titanium': { cod: '9008517', name: 'Titanium (HCP)', structure: 'HCP' },
          'ice': { cod: '1011023', name: 'Ice (H2O)', structure: 'Hexagonal' },
        };

        // Check for direct match
        const directMatch = Object.entries(commonMinerals).find(([name]) =>
          query.includes(name.toLowerCase())
        );

        if (directMatch) {
          const [, mineral] = directMatch;
          setSearchFeedback(`Loading ${mineral.name} (${mineral.structure}) from COD...`);
          setScript(`
            load =cod/${mineral.cod} {1 1 1};
            unitcell on;
            axes 3;
            boundbox on;
            spacefill 25%;
            wireframe 0.15;
            color atoms cpk;
            spin y 3;
          `);
          setSearchFeedback(`Loaded ${mineral.name} - ${mineral.structure} structure (COD: ${mineral.cod})`);
          return;
        }

        // If no direct match, use Gemini to find COD ID
        try {
          if (!isGeminiInitialized()) {
            initializeGemini();
          }

          const codPrompt = `You are a crystallography expert. The user wants to view the crystal structure of: "${rawQuery}"
Find the Crystallography Open Database (COD) ID for this mineral/crystal.
Return ONLY the numeric COD ID (e.g., "9008536" for iron, "1000041" for NaCl).
If you're unsure, return the COD ID for the most common form of this material.
Return ONLY the COD number, nothing else. No explanation, no text, just the numeric ID.`;

          const codId = await generateTextContent(codPrompt);
          const cleanCodId = codId?.trim().replace(/[^0-9]/g, '');

          if (cleanCodId && cleanCodId.length >= 6 && cleanCodId.length <= 8) {
            setSearchFeedback(`Loading ${rawQuery} structure from COD...`);
            setScript(`
              load =cod/${cleanCodId} {1 1 1};
              unitcell on;
              axes 3;
              boundbox on;
              spacefill 25%;
              wireframe 0.15;
              color atoms cpk;
              spin y 3;
            `);
            setSearchFeedback(`Loaded ${rawQuery} crystal structure (COD: ${cleanCodId})`);
            return;
          }
        } catch (aiError) {
          console.warn('Gemini crystal/COD resolution failed:', aiError);
          // Fall through to molecule fallback
        }
      }

      // Fallback to molecule resolution
      const resolved = await resolveMoleculeDescription(rawQuery);
      const smilesToLoad = resolved.canonicalSmiles ?? resolved.smiles;

      if (smilesToLoad) {
        loadSmilesIntoViewer(smilesToLoad, resolved.name ?? rawQuery);
        return;
      }

      setSearchFeedback(resolved.notes ? resolved.notes : 'Unable to resolve that molecule.');
    } catch (error) {
      console.error('Search error:', error);
      setSearchFeedback(
        error instanceof Error ? error.message : 'Unable to load that structure. Try a different query.'
      );
    } finally {
      setIsSearchLoading(false);
    }
  };

  // AI-driven JSmol command helper
  const runAiJsmolCommand = async (userCommand?: string) => {
    const cmd = (userCommand ?? aiCommand).trim();
    if (!cmd) {
      setAiFeedback('Enter an instruction to send to JSmol.');
      return;
    }
    setAiLoading(true);
    setAiFeedback(null);
    try {
      // Ensure Gemini is initialized with the shared key
      if (!isGeminiInitialized()) {
        await initializeGemini();
      }

      const prompt = `
You are a JSmol scripting assistant. Given a user instruction, return ONLY a concise JSmol script that applies to the currently loaded structure. Do not add explanations.
User instruction: ${cmd}
Ensure:
- keep it short
- do not clear the molecule unless asked
- prefer cpk/ball&stick, unitcell/axes when relevant
- allow animations (spin) if requested
Output: raw JSmol commands only.`;
      const raw = await generateTextContent(prompt);
      // Extract a usable JSmol script (strip code fences / prose)
      const extractScript = (text?: string) => {
        if (!text) return '';
        const fenced = text.match(/```(?:[a-zA-Z]*)?\s*([\s\S]*?)```/);
        if (fenced && fenced[1]) return fenced[1].trim();
        return text.trim();
      };
      const cleaned = extractScript(raw);
      if (cleaned) {
        // Append to current script so the view updates
        setScript((prev) => `${prev}\n${cleaned}`);
        setAiFeedback('Applied AI command to JSmol.');
      } else {
        setAiFeedback('No script returned. Try another instruction.');
      }
    } catch (err) {
      console.error('AI JSmol Copilot error:', err);
      setAiFeedback('Failed to run AI command. Please try again.');
    } finally {
      setAiLoading(false);
      setAiCommand('');
    }
  };

  const renderPresetCard = () => {
    // Filter demos based on selected category
    const categoryTagMap: Record<string, string[]> = {
      molecule: ['organic', 'fundamentals', 'sterics', 'vdW'],
      protein: ['proteins', 'cartoon', 'surface', 'solvent', 'mesh'],
      crystal: ['crystal', 'symmetry'],
      reaction: [],
    };

    const relevantTags = categoryTagMap[selectedCategory] || [];
    const filteredDemos = relevantTags.length > 0
      ? visualizationDemos.filter(demo => demo.tags.some(tag => relevantTags.includes(tag)))
      : visualizationDemos;

    if (filteredDemos.length === 0) {
      return null; // Don't show preset card if no relevant demos
    }

    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">
              {selectedCategory === 'protein' ? 'Protein Presets' :
                selectedCategory === 'crystal' ? 'Crystal Presets' :
                  selectedCategory === 'molecule' ? 'Molecule Presets' : 'Preset scenes'}
            </h4>
            <p className="text-xs text-slate-400">Curated JSmol scripts.</p>
          </div>
          <Sparkles className="w-5 h-5 text-purple-300" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {filteredDemos.map((demo) => (
            <button
              key={demo.id}
              onClick={() => handleRunDemo(demo)}
              className={`group rounded-2xl border px-4 py-4 text-left transition ${activeDemo === demo.id
                ? 'border-indigo-400/80 bg-indigo-900/40 text-white'
                : 'border-slate-800 bg-slate-900/50 hover:border-indigo-500/60 hover:bg-slate-900/80 text-slate-200'
                }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                <span>{demo.title}</span>
                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-300" />
              </div>
              <p className="mt-2 text-sm text-slate-300">{demo.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {demo.tags.map((tag) => (
                  <span key={tag} className="text-[10px] rounded-full border border-slate-700/70 bg-slate-950/70 px-2 py-0.5 uppercase tracking-wide text-slate-400">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  };


  const renderCrystalCard = () => (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">Crystal gallery</h4>
          <p className="text-xs text-slate-400">Inline CIF snippets.</p>
        </div>
        <Gem className="w-5 h-5 text-amber-300" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {mineralStructures.map((mineral) => (
          <button
            key={mineral.id}
            onClick={() => {
              setSelectedMineral(mineral.id);
              handleLoadMineral(mineral);
            }}
            className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-4 py-4 text-left transition hover:border-emerald-400/70 hover:bg-slate-900/90"
          >
            <div className="flex items-center justify-between text-sm font-semibold text-white">
              <span>{mineral.name}</span>
              <span className="text-xs text-emerald-300">{mineral.system}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{mineral.formula}</p>
            <p className="mt-2 text-sm text-slate-300">{mineral.description}</p>
          </button>
        ))}
      </div>

      {/* VChem3D-style Solid State Controls */}
      <div className="space-y-3 pt-3 border-t border-slate-800">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Crystal Visualization</p>

        {/* Unit Cell & Axes Controls */}
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => runJsmolCommand('unitcell 1')}
            className="rounded-lg bg-amber-700 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-amber-600"
          >
            Unit Cell On
          </button>
          <button
            onClick={() => runJsmolCommand('unitcell off')}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
          >
            Unit Cell Off
          </button>
          <button
            onClick={() => runJsmolCommand('axes 2')}
            className="rounded-lg bg-blue-700 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-blue-600"
          >
            Show Axes
          </button>
        </div>


        {/* Boundbox and Extras */}
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => runJsmolCommand('boundbox on')}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
          >
            Boundbox On
          </button>
          <button
            onClick={() => runJsmolCommand('boundbox off')}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
          >
            Boundbox Off
          </button>
          <button
            onClick={() => runJsmolCommand('axes off')}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
          >
            Axes Off
          </button>
        </div>

        {/* Display Mode */}
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400">Display Mode</p>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => runJsmolCommand('spacefill 100%; wireframe off')}
              className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-emerald-700 hover:text-white"
            >
              Spacefill
            </button>
            <button
              onClick={() => runJsmolCommand('spacefill 25%; wireframe 0.15')}
              className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-emerald-700 hover:text-white"
            >
              Ball & Stick
            </button>
            <button
              onClick={() => runJsmolCommand('spacefill off; wireframe 0.2')}
              className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-emerald-700 hover:text-white"
            >
              Wireframe
            </button>
          </div>
        </div>

        {/* Atom Labels */}
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => runJsmolCommand('select all; label %e; color labels white; set labeloffset 0 5')}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
          >
            Show Labels
          </button>
          <button
            onClick={() => runJsmolCommand('labels off')}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
          >
            Hide Labels
          </button>
        </div>

        {/* Color Options */}
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400">Color Scheme</p>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => runJsmolCommand('color atoms cpk')}
              className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
            >
              CPK
            </button>
            <button
              onClick={() => runJsmolCommand('color atoms property atomno')}
              className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
            >
              By Atom #
            </button>
            <button
              onClick={() => runJsmolCommand('color atoms symmetry')}
              className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
            >
              Symmetry
            </button>
          </div>
        </div>

        {/* Animation Controls */}
        <div className="grid grid-cols-2 gap-1">
          <button
            onClick={() => runJsmolCommand('spin on')}
            className="rounded-lg bg-violet-700 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-violet-600"
          >
            Spin On
          </button>
          <button
            onClick={() => runJsmolCommand('spin off')}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
          >
            Spin Off
          </button>
        </div>

        {/* Bonds Controls */}
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400">Bonds</p>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => runJsmolCommand('connect')}
              className="rounded-lg bg-emerald-700 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-emerald-600"
            >
              Display
            </button>
            <button
              onClick={() => runJsmolCommand('connect delete')}
              className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
            >
              Hide
            </button>
          </div>
        </div>

        {/* View Options (VChem3D style) */}
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400">View Options</p>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-600"
                onChange={(e) => runJsmolCommand(`set antialiasDisplay ${e.target.checked}`)}
              />
              Shade
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-600"
                onChange={(e) => runJsmolCommand(`set stereo ${e.target.checked ? 'on' : 'off'}`)}
              />
              Stereo
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-300">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-slate-600"
                onChange={(e) => runJsmolCommand(`set perspectiveDepth ${e.target.checked}`)}
              />
              Perspective depth
            </label>
          </div>
        </div>

        {/* Background Color */}
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400">Background</p>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => runJsmolCommand('background white')}
              className="rounded-lg bg-white px-2 py-1.5 text-[10px] font-medium text-slate-900 hover:bg-gray-100 border border-slate-300"
            >
              White
            </button>
            <button
              onClick={() => runJsmolCommand('background [200,200,200]')}
              className="rounded-lg bg-gray-300 px-2 py-1.5 text-[10px] font-medium text-slate-900 hover:bg-gray-400"
            >
              Gray
            </button>
            <button
              onClick={() => runJsmolCommand('background [15,23,42]')}
              className="rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-slate-800 border border-slate-600"
            >
              Dark
            </button>
          </div>
        </div>
      </div>


    </section>

  );


  const renderReactionAnimatorCard = () => (

    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-purple-300" />
        AI Reaction Animator
      </h4>
      <ReactionMechanismAnimator
        onScriptChange={setScript}
        initialQuery={reactionSearchQuery ?? undefined}
        searchTrigger={reactionSearchSeed}
        onResolutionChange={setReactionResolution}
      />
    </section>
  );

  const renderCategoryTools = () => {
    switch (selectedCategory) {
      case 'molecule':
        return renderPresetCard();
      case 'protein':
        return (
          <>
            {renderPresetCard()}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-white">Protein shortcuts</h4>
              <button
                onClick={loadSampleStructure}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-500/60 bg-purple-600/60 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-600"
              >
                <Download className="h-4 w-4" />
                Load Sample Protein (1CRN)
              </button>
            </section>
          </>
        );
      case 'crystal':
        return renderCrystalCard();
      case 'reaction':
        return (
          <>
            {renderReactionAnimatorCard()}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 text-slate-100">
      <Card className="border border-slate-800/70 bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80 shadow-2xl ring-1 ring-slate-900/50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Layers3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white leading-tight">3D Explorer</CardTitle>
                <CardDescription>Load molecules, proteins, crystals, or reactions with one tap.</CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-300">JSmol Live</span>
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-300">AI Assist</span>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full bg-indigo-600/80 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm shadow-indigo-500/30 hover:bg-indigo-600"
                onClick={loadSampleStructure}
              >
                <Download className="h-3.5 w-3.5" />
                Load sample
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {CATEGORY_TABS.map((tab) => (
                <Button
                  key={tab.id}
                  variant={selectedCategory === tab.id ? "default" : "outline"}
                  size="sm"
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${selectedCategory === tab.id ? '' : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:text-white'}`}
                  onClick={() => setSelectedCategory(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            {searchFeedback && (
              <span className="text-[11px] text-slate-400 bg-slate-900/70 border border-slate-800/70 px-2 py-1 rounded-full">
                {searchFeedback}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="Search molecules, proteins, crystals, or paste a URL..."
              className="flex-1 min-w-[260px] bg-slate-900/80 text-white placeholder:text-slate-500"
            />
            <Button
              onClick={() => void handleSearch()}
              disabled={isSearchLoading}
              className="inline-flex items-center gap-2"
            >
              {isSearchLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading
                </>
              ) : (
                'Load'
              )}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
            {CATEGORY_HINTS[selectedCategory].map((hint) => (
              <Button
                key={hint}
                variant="outline"
                size="sm"
                className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-slate-300 hover:border-indigo-400 hover:text-white"
                onClick={() => {
                  setSearchQuery(hint);
                  void handleSearch(hint);
                }}
              >
                {hint}
              </Button>
            ))}
          </div>

          {/* Compact preset dock */}
          <div className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/90 px-2 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:backdrop-blur-lg">
            {[
              { id: 'dock-ball', label: 'Ball & Stick', icon: Layers3 },
              { id: 'dock-density', label: 'Density', icon: Gem },
              { id: 'dock-surface', label: 'Surface', icon: Waves },
              { id: 'dock-reset', label: 'Reset', icon: RefreshCcw },
            ].map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className="group relative flex h-10 flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/80 text-[12px] font-semibold text-slate-200 transition hover:-translate-y-[1px] hover:border-slate-600 hover:bg-slate-800/80 hover:text-white"
                title={item.label}
                onClick={() => {
                  if (item.id === 'dock-ball') handleRunDemo(visualizationDemos[0]);
                  if (item.id === 'dock-density') setScript(visualizationDemos.find(d => d.id === 'electron_density')?.script || visualizationDemos[0].script);
                  if (item.id === 'dock-surface') setScript(visualizationDemos.find(d => d.id === 'solvent_surface')?.script || visualizationDemos[0].script);
                  if (item.id === 'dock-reset') handleResetView();
                }}
              >
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-blue-500/10 via-cyan-400/10 to-blue-600/10 blur-[12px] transition-opacity" />
                <div className="relative flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* Main canvas */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Live viewport</p>
                <h3 className="text-lg font-semibold text-white">JSmol canvas</h3>
                <p className="text-xs text-slate-400">Scripts run instantly as you load structures.</p>
              </div>
              <button
                onClick={handleResetView}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-indigo-400"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
            <JSmolViewer script={script} command={jsmolCommand} />
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <Compass className="h-4 w-4 text-emerald-300" />
                Active preset:&nbsp;
                <span className="text-white">
                  {visualizationDemos.find((demo) => demo.id === activeDemo)?.title ?? 'Custom script'}
                </span>
              </span>
              <span className="flex items-center gap-2 text-indigo-300">
                <Zap className="h-4 w-4" />
                Scripts run instantly
              </span>
            </div>
            {selectedCategory === 'reaction' && reactionResolution && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <ResolvedReactionPath resolution={reactionResolution} onScriptChange={setScript} />
              </div>
            )}
          </section>
        </div>

        {/* Sidebar: presets + quiz + AI */}
        <div className="space-y-4">
          {/* Protein Analysis Panel */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers3 className="h-5 w-5 text-blue-400" />
                <div>
                  <h4 className="text-sm font-semibold text-white">Structure Controls</h4>
                  <p className="text-[11px] text-slate-400">Representation & coloring</p>
                </div>
              </div>
            </div>

            {/* Representation */}
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Representation</p>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'cartoon', label: 'Cartoon' },
                  { id: 'surface', label: 'Surface' },
                  { id: 'ballstick', label: 'Ball & Stick' },
                  { id: 'spacefill', label: 'Spacefill' },
                  { id: 'wireframe', label: 'Wire' },
                ].map((rep) => (
                  <button
                    key={rep.id}
                    onClick={() => applyRepresentation(rep.id as typeof representation)}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${representation === rep.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                  >
                    {rep.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Scheme */}
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Color Scheme</p>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'structure', label: 'Structure' },
                  { id: 'chain', label: 'Chain' },
                  { id: 'cpk', label: 'CPK' },
                  { id: 'bfactor', label: 'B-factor' },
                  { id: 'residue', label: 'Residue' },
                ].map((color) => (
                  <button
                    key={color.id}
                    onClick={() => applyColorScheme(color.id as typeof colorScheme)}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${colorScheme === color.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={toggleSpin}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${spinEnabled
                  ? 'bg-amber-600/80 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
              >
                <RefreshCcw className="h-3 w-3" />
                {spinEnabled ? 'Spin On' : 'Spin Off'}
              </button>
              <button
                onClick={handleResetView}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700"
              >
                <Compass className="h-3 w-3" />
                Reset
              </button>
              <button
                onClick={exportImage}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700"
              >
                <Download className="h-3 w-3" />
                Export
              </button>
            </div>

            {/* RCSB PDB-style Selection Tools - PROTEIN ONLY */}
            {selectedCategory === 'protein' && (
              <>
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Selection (Proteins)</p>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => setScript(prev => `${prev}\nselect all; color cpk;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nselect protein; cartoon; color structure;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Protein
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nselect helix; color [255,100,100]; select sheet; color [100,100,255];`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Sec. Struct
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nselect ligand; spacefill 100%; wireframe off; color cpk;`)}
                      className="rounded-lg bg-purple-700 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-purple-600"
                    >
                      Ligands
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nselect water; spacefill 50%; color red;`)}
                      className="rounded-lg bg-cyan-700 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-cyan-600"
                    >
                      Waters
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nselect within(5.0, ligand); wireframe 0.2; color cpk;`)}
                      className="rounded-lg bg-emerald-700 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-emerald-600"
                    >
                      Active Site
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Visibility</p>
                  <div className="grid grid-cols-2 gap-1">

                    <button
                      onClick={() => setScript(prev => `${prev}\nselect sidechain; wireframe 0.15; spacefill 15%;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Show Sidechains
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nselect sidechain; wireframe off; spacefill off;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Hide Sidechains
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nset showHydrogens TRUE;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Show H atoms
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nset showHydrogens FALSE;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Hide H atoms
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nselect water; spacefill 50%;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Show Waters
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nselect water; hide selected;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Hide Waters
                    </button>
                  </div>
                </div>

                {/* Analysis Tools */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Analysis</p>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setScript(prev => `${prev}\nzoom *; center;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Zoom All
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nzoom ligand; center ligand;`)}
                      className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:bg-slate-700"
                    >
                      Zoom Ligand
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nset picking distance;`)}
                      className="rounded-lg bg-orange-700 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-orange-600"
                    >
                      Measure Distance
                    </button>
                    <button
                      onClick={() => setScript(prev => `${prev}\nset picking angle;`)}
                      className="rounded-lg bg-orange-700 px-2 py-1.5 text-[10px] font-medium text-white hover:bg-orange-600"
                    >
                      Measure Angle
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>



          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
            {renderCategoryTools()}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Beaker className="w-5 h-5 text-cyan-300" />
              <div>
                <h4 className="text-sm font-semibold text-white">Symmetry quiz</h4>
                <p className="text-xs text-slate-400">Launch when you want to test recognition.</p>
              </div>
            </div>
            {!quizOpen ? (
              <button
                onClick={() => setQuizOpen(true)}
                className="w-full rounded-xl border border-indigo-500/70 bg-indigo-600/80 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
              >
                Start Quiz
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    onClick={() => setQuizOpen(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Close quiz
                  </button>
                </div>
                <SymmetryQuiz onScriptChange={setScript} />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gem className="h-5 w-5 text-cyan-300" />
                <div>
                  <h4 className="text-sm font-semibold text-white">AI JSmol Copilot</h4>
                  <p className="text-[11px] text-slate-400">Type an instruction to manipulate the 3D scene.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiCommand}
                  onChange={(e) => setAiCommand(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void runAiJsmolCommand();
                    }
                  }}
                  placeholder="e.g., color carbons red and spin y 5"
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
                />
                <button
                  onClick={() => void runAiJsmolCommand()}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/70 bg-indigo-600/90 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Send
                </button>
              </div>
              {aiFeedback && <p className="text-[11px] text-slate-400">{aiFeedback}</p>}
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                {[
                  'color by element and show axes',
                  'ball and stick with light spin',
                  'show symmetry axes and unit cell',
                  'surface translucent and hide labels',
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => void runAiJsmolCommand(preset)}
                    className="rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 hover:border-indigo-400 hover:text-white"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default MolecularVisualizationWorkspace;
