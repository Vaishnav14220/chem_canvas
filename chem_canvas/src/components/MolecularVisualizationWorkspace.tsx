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
} from 'lucide-react';
import JSmolViewer from './JSmolViewer';
import SymmetryQuiz from './SymmetryQuiz';
import ReactionMechanismAnimator from './ReactionMechanismAnimator';
import ResolvedReactionPath from './ResolvedReactionPath';
import type { ReactionResolutionResult } from '../services/reactionResolver';
import { fetchCanonicalSmiles } from '../services/pubchemService';
import { initializeGemini, isGeminiInitialized, resolveMoleculeDescription } from '../services/geminiService';

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
END "CIF";
      unitcell on;
      axes 2;
      boundbox on;
      select all;
      color atoms cpk;
      set spinY 5;
      ${extraCommands}
      spin y 3;
    `;

const mineralStructures: MineralStructure[] = [
  {
    id: 'quartz',
    name: 'Quartz',
    formula: 'SiO₂',
    system: 'Trigonal',
    description: 'Helical SiO₄ network with screw-axis symmetry.',
    script: createCifScript(QUARTZ_CIF, 'set perspectiveModel 1; select Si; spacefill 120%; color yellow; select O; color [150,200,255];'),
  },
  {
    id: 'calcite',
    name: 'Calcite',
    formula: 'CaCO₃',
    system: 'Trigonal',
    description: 'Stacked carbonate layers with Ca-centered octahedra.',
    script: createCifScript(CALCITE_CIF, 'polyhedra calcium (6) oxygen translucent 0.5; color polyhedra [255,180,120];'),
  },
  {
    id: 'fluorite',
    name: 'Fluorite',
    formula: 'CaF₂',
    system: 'Isometric',
    description: 'Fluoride ions in a cubic network around Ca²⁺.',
    script: createCifScript(FLUORITE_CIF, 'polyhedra calcium (8) fluorine translucent 0.45; color polyhedra [120,200,255];'),
  },
  {
    id: 'perovskite',
    name: 'Perovskite',
    formula: 'CaTiO₃',
    system: 'Cubic',
    description: 'Corner-sharing TiO₆ octahedra with Ca in the cage.',
    script: createCifScript(PEROVSKITE_CIF, 'polyhedra titanium (6) oxygen translucent 0.55; color polyhedra [180,255,180];'),
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
  molecule: ['Water', 'Benzene', 'Caffeine', 'Aspirin'],
  protein: ['Sample Protein', 'Crambin', 'Insulin', 'Lysozyme'],
  crystal: ['Quartz', 'Calcite', 'NaCl', 'Perovskite'],
  reaction: ['Diels-Alder', 'Suzuki coupling', 'SN1', 'E2 elimination'],
};

const MolecularVisualizationWorkspace: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<string>(visualizationDemos[0].id);
  const [script, setScript] = useState<string>(visualizationDemos[0].script);
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
      const match = searchItems.find((item) => {
        if (item.label.toLowerCase().includes(query)) return true;
        return item.keywords?.some((keyword) => keyword.toLowerCase().includes(query));
      });

      if (match) {
        await Promise.resolve(match.action());
        setSearchFeedback(`Loaded ${match.label}`);
        return;
      }

      if (rawQuery.startsWith('http')) {
        setStructureUrl(rawQuery);
        loadFromUrl(rawQuery);
        setSearchFeedback('Loaded structure from URL');
        return;
      }

      if (selectedCategory === 'reaction') {
        setReactionSearchQuery(rawQuery);
        setReactionSearchSeed((seed) => seed + 1);
        setSearchFeedback(`Searching reaction "${rawQuery}"...`);
        setIsSearchLoading(false);
        return;
      }

      const canonical = await fetchCanonicalSmiles(rawQuery);
      if (canonical) {
        loadSmilesIntoViewer(canonical, rawQuery);
        return;
      }

      try {
        if (!isGeminiInitialized()) {
          initializeGemini();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gemini API key missing.';
        setSearchFeedback(message);
        return;
      }

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

  const renderPresetCard = () => (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">Preset scenes</h4>
          <p className="text-xs text-slate-400">Curated JSmol scripts.</p>
        </div>
        <Sparkles className="w-5 h-5 text-purple-300" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {visualizationDemos.map((demo) => (
          <button
            key={demo.id}
            onClick={() => handleRunDemo(demo)}
            className={`group rounded-2xl border px-4 py-4 text-left transition ${
              activeDemo === demo.id
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
      <section className="rounded-2xl border border-slate-800/70 bg-slate-950/80 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                selectedCategory === tab.id
                  ? 'border-indigo-500 bg-indigo-600/70 text-white'
                  : 'border-slate-700 text-slate-300 hover:border-indigo-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Search workspace</label>
        <div className="flex flex-wrap gap-2">
          <input
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
            className="flex-1 min-w-[240px] rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => void handleSearch()}
            disabled={isSearchLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/70 bg-indigo-600/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
          >
            {isSearchLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading
              </>
            ) : (
              'Load'
            )}
          </button>
        </div>
        {searchFeedback && (
          <p className="text-xs text-slate-400">{searchFeedback}</p>
        )}
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
          {CATEGORY_HINTS[selectedCategory].map((hint) => (
            <button
              key={hint}
              onClick={() => {
                setSearchQuery(hint);
                void handleSearch(hint);
              }}
              className="rounded-full border border-slate-700/70 px-3 py-1 hover:border-indigo-400 hover:text-white"
            >
              {hint}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
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
            <JSmolViewer script={script} />
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

          {renderCategoryTools()}
        </div>

        <div className="space-y-4">
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
        </div>
      </div>
    </div>
  );
};

export default MolecularVisualizationWorkspace;
