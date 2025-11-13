import React, { useState } from 'react';
import { Beaker, Layers3, Sparkles, Zap, Gem } from 'lucide-react';
import JSmolViewer from './JSmolViewer';
import MoleculeLoader from './MoleculeLoader';
import ReactionPath from './ReactionPath';
import SymmetryQuiz from './SymmetryQuiz';
import ReactionMechanismAnimator from './ReactionMechanismAnimator';

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

const MolecularVisualizationWorkspace: React.FC = () => {
  const [activeDemo, setActiveDemo] = useState<string>(visualizationDemos[0].id);
  const [script, setScript] = useState<string>(visualizationDemos[0].script);

  const handleRunDemo = (demo: VisualizationDemo) => {
    setActiveDemo(demo.id);
    setScript(demo.script);
  };

  const handleLoadMineral = (mineral: MineralStructure) => {
    setScript(mineral.script);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-gradient-to-r from-indigo-900/80 via-purple-900/80 to-slate-900 border border-indigo-800/40 rounded-2xl p-6 flex flex-col gap-3">
        <div className="flex items-center gap-3 text-white">
          <Layers3 className="w-6 h-6 text-cyan-300" />
          <div>
            <h2 className="text-lg font-semibold">3D Chemistry Explorer</h2>
            <p className="text-sm text-indigo-200/90">
              Switch between core JSmol visualizations, inject your own structures, and explore symmetry-focused learning activities.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-indigo-200/70">
          <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">Ball &amp; Stick</span>
          <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">Cartoon &amp; Ribbon</span>
          <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">Isosurface &amp; Mesh</span>
          <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">Crystal Symmetry</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <JSmolViewer script={script} />

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Visualization library</h3>
                <p className="text-xs text-slate-400">Tap a demo to push the corresponding JSmol script.</p>
              </div>
              <Sparkles className="w-5 h-5 text-purple-300" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {visualizationDemos.map((demo) => (
                <button
                  key={demo.id}
                  onClick={() => handleRunDemo(demo)}
                  className={`text-left rounded-xl border px-3 py-3 transition-colors ${
                    activeDemo === demo.id
                      ? 'border-purple-400/70 bg-purple-900/40 text-white'
                      : 'border-slate-700 bg-slate-800 hover:bg-slate-700/70 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                    <span className="font-semibold">{demo.title}</span>
                    <Zap className="w-4 h-4 text-amber-300" />
                  </div>
                  <p className="text-[13px] text-slate-300 mt-2">{demo.description}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {demo.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Mineral crystal gallery</h3>
                <p className="text-xs text-slate-400">Load common minerals with inline CIF data for offline viewing.</p>
              </div>
              <Gem className="w-5 h-5 text-amber-300" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {mineralStructures.map((mineral) => (
                <button
                  key={mineral.id}
                  onClick={() => handleLoadMineral(mineral)}
                  className="text-left rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700/70 transition-colors px-3 py-3 text-slate-200"
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-white">
                    <span>{mineral.name}</span>
                    <span className="text-xs text-amber-300">{mineral.system}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{mineral.formula}</p>
                  <p className="text-[13px] text-slate-300 mt-2">{mineral.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4 max-h-[900px] overflow-y-auto pr-1">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Beaker className="w-4 h-4 text-cyan-300" />
              <h3 className="text-sm font-semibold text-white">Structure inputs</h3>
            </div>
            <MoleculeLoader onScriptChange={setScript} />
          </div>

          <ReactionMechanismAnimator onScriptChange={setScript} />

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Layers3 className="w-4 h-4 text-emerald-300" />
              <h3 className="text-sm font-semibold text-white">Reaction coordinate explorer</h3>
            </div>
            <ReactionPath onScriptChange={setScript} />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-pink-300" />
              <h3 className="text-sm font-semibold text-white">Symmetry quiz mode</h3>
            </div>
            <SymmetryQuiz onScriptChange={setScript} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MolecularVisualizationWorkspace;
