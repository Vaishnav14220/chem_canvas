import React, { useMemo, useState } from 'react';
import { Droplet, Palette, RotateCcw, Sparkles } from 'lucide-react';
import JSmolViewer from './JSmolViewer';

type RepresentationStyle = 'cartoon' | 'surface' | 'backbone' | 'sticks';
type ColorScheme = 'structure' | 'chain' | 'group';
type BackgroundTheme = 'night' | 'slate' | 'light';

const REPRESENTATION_OPTIONS: Array<{ id: RepresentationStyle; label: string; tooltip: string }> = [
  { id: 'cartoon', label: 'Cartoon', tooltip: 'Focus on helices and sheets' },
  { id: 'surface', label: 'Surface', tooltip: 'Molecular surface context' },
  { id: 'backbone', label: 'Backbone', tooltip: 'Trace structural backbone only' },
  { id: 'sticks', label: 'Sticks', tooltip: 'Ball-and-stick detail' }
];

const COLOR_OPTIONS: Array<{ id: ColorScheme; label: string }> = [
  { id: 'structure', label: 'Secondary' },
  { id: 'chain', label: 'Chain' },
  { id: 'group', label: 'Residue' }
];

const BACKGROUND_OPTIONS: Array<{ id: BackgroundTheme; label: string; hex: string }> = [
  { id: 'night', label: 'Night', hex: '#020617' },
  { id: 'slate', label: 'Slate', hex: '#1e293b' },
  { id: 'light', label: 'Light', hex: '#f8fafc' }
];

const MIN_VIEWER_HEIGHT = 200;

const buildJSmolScript = (
  pdbId: string,
  pdbData: string | undefined,
  dataFormat: 'pdb' | 'cif' | undefined,
  cifUrlOverride: string | undefined,
  representation: RepresentationStyle,
  colorScheme: ColorScheme,
  background: BackgroundTheme,
  spin: boolean
) => {
  const structureId = pdbId.trim().toUpperCase();
  const pdbUrl = `https://files.rcsb.org/download/${structureId}.pdb`;
  const cifUrl = cifUrlOverride || `https://www.ebi.ac.uk/pdbe/entry-files/${structureId.toLowerCase()}.cif`;
  const backgroundCmd = `background ${BACKGROUND_OPTIONS.find(bg => bg.id === background)?.hex ?? '#020617'};`;

  const representationCmd = (() => {
    switch (representation) {
      case 'surface':
        return `
isosurface delete;
isosurface molecular;
spacefill off;
wireframe off;
cartoons off;
`;
      case 'backbone':
        return `
select protein;
backbone only;
wireframe 0.45;
spacefill off;
cartoons off;
`;
      case 'sticks':
        return `
select protein;
wireframe 0.25;
spacefill 20%;
cartoons off;
`;
      case 'cartoon':
      default:
        return `
cartoons only;
set cartoonFancy true;
wireframe off;
spacefill off;
`;
    }
  })();

  const colorCmd = (() => {
    switch (colorScheme) {
      case 'chain':
        return 'color chain;';
      case 'group':
        return 'color group;';
      case 'structure':
      default:
        return 'color structure;';
    }
  })();

  const loadBlock = (() => {
    if (pdbData && dataFormat !== 'cif') {
      return `
zap;
load DATA "inline";
${pdbData.trim()}
END "inline";
`;
    }

    // Prefer CIF source when no inline PDB data is available
    if (dataFormat === 'cif') {
      return `
zap;
load "${cifUrl}";
`;
    }

    return `
zap;
load "${pdbUrl}";
if ({_modelTitle} == "") {
  load "${cifUrl}";
}
`;
  })();

  return `
set antialiasDisplay true;
set defaultColors RasMol;
set ambientPercent 40;
set diffusePercent 60;
set specularPercent 25;
${backgroundCmd}
${loadBlock}
select protein;
${representationCmd}
${colorCmd}
${spin ? 'spin y 3;' : 'spin off;'}
`;
};

interface ProteinCanvasViewerProps {
  pdbId: string;
  title?: string;
  isInteractive: boolean;
  height: number;
  pdbData?: string;
  structureFormat?: 'pdb' | 'cif';
  cifUrl?: string;
}

const ProteinCanvasViewer: React.FC<ProteinCanvasViewerProps> = ({
  pdbId,
  title,
  isInteractive,
  height,
  pdbData,
  structureFormat,
  cifUrl
}) => {
  const [representation, setRepresentation] = useState<RepresentationStyle>('cartoon');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('structure');
  const [background, setBackground] = useState<BackgroundTheme>('night');
  const [spinEnabled, setSpinEnabled] = useState(true);
  const renderHeight = height > 0 ? height : MIN_VIEWER_HEIGHT;
  const script = useMemo(
    () => buildJSmolScript(pdbId, pdbData, structureFormat, cifUrl, representation, colorScheme, background, spinEnabled),
    [pdbId, pdbData, structureFormat, cifUrl, representation, colorScheme, background, spinEnabled]
  );
  const backgroundHex = BACKGROUND_OPTIONS.find(option => option.id === background)?.hex ?? '#020617';

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-black/50 shadow-2xl backdrop-blur">
      <JSmolViewer script={script} height={renderHeight} backgroundColor={backgroundHex} />

      {!isInteractive && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80">
          {title || `PDB ${pdbId.toUpperCase()}`}
        </div>
      )}

      {isInteractive && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-slate-950/90 p-3 text-[11px] text-slate-200 shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Sparkles size={12} className="text-amber-300" />
            Representation
          </div>
          <div className="grid grid-cols-2 gap-2">
            {REPRESENTATION_OPTIONS.map(option => (
              <button
                key={option.id}
                onClick={() => setRepresentation(option.id)}
                className={`rounded-lg border px-2 py-1 text-left text-xs font-medium transition ${
                  representation === option.id
                    ? 'border-rose-400 bg-rose-500/20 text-white'
                    : 'border-white/10 text-slate-300 hover:border-rose-200/80 hover:bg-white/10'
                }`}
                title={option.tooltip}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Palette size={12} className="text-sky-300" />
            Coloring
          </div>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map(option => (
              <button
                key={option.id}
                onClick={() => setColorScheme(option.id)}
                className={`flex-1 rounded-full border px-2 py-1 text-xs font-semibold transition ${
                  colorScheme === option.id
                    ? 'border-sky-400 bg-sky-500/20 text-white'
                    : 'border-white/10 text-slate-300 hover:border-sky-200/80 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Droplet size={12} className="text-emerald-300" />
            Background
          </div>
          <div className="flex gap-2">
            {BACKGROUND_OPTIONS.map(option => (
              <button
                key={option.id}
                onClick={() => setBackground(option.id)}
                className={`flex-1 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                  background === option.id
                    ? 'border-emerald-400 bg-emerald-500/20 text-white'
                    : 'border-white/10 text-slate-300 hover:border-emerald-200/80 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setSpinEnabled(prev => !prev)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                spinEnabled ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/70' : 'bg-slate-800 text-slate-200 border border-white/10'
              }`}
            >
              {spinEnabled ? 'Spinning' : 'Static'}
            </button>
            <button
              onClick={() => {
                setRepresentation('cartoon');
                setColorScheme('structure');
                setBackground('night');
                setSpinEnabled(true);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/40 hover:bg-white/10"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProteinCanvasViewer;
