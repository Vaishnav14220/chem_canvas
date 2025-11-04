import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Box, Camera, ChevronDown, ChevronUp, Loader2, Maximize2, Minimize2, Palette, RotateCcw, X } from 'lucide-react';
import clsx from 'clsx';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { PresetStructureRepresentations } from 'molstar/lib/mol-plugin-state/builder/structure/representation-preset';
import { Color } from 'molstar/lib/mol-util/color';
import type { Viewer } from 'molstar/build/viewer/molstar';
import 'molstar/build/viewer/molstar.css';

export type RepresentationPresetKey = keyof typeof PresetStructureRepresentations;

const REPRESENTATION_OPTIONS: Array<{ id: RepresentationPresetKey; label: string; description: string }> = [
  { id: 'auto', label: 'Auto', description: 'Automatic detail based on structure size' },
  { id: 'polymer-cartoon', label: 'Cartoon', description: 'Cartoon for polymers' },
  { id: 'polymer-and-ligand', label: 'Polymer & Ligand', description: 'Cartoon polymers with highlighted ligands' },
  { id: 'atomic-detail', label: 'Atomic', description: 'Ball & stick atomic detail' },
  { id: 'coarse-surface', label: 'Surface', description: 'Gaussian surface for large assemblies' },
  { id: 'illustrative', label: 'Illustrative', description: 'Stylised illustrative rendering' }
];

const COLOR_THEME_OPTIONS = [
  { id: 'chain-id' as const, label: 'By Chain', description: 'Color chains uniquely' },
  { id: 'element-symbol' as const, label: 'By Element', description: 'Element-based coloring' },
  { id: 'operator-name' as const, label: 'Symmetry', description: 'Highlight biological units' }
];

type ColorThemeKey = (typeof COLOR_THEME_OPTIONS)[number]['id'];

const BACKGROUND_OPTIONS = [
  { id: 'dark', label: 'Midnight', color: 0x0f172a },
  { id: 'slate', label: 'Slate', color: 0x1e293b },
  { id: 'light', label: 'Light', color: 0xf8fafc },
  { id: 'black', label: 'Black', color: 0x000000 }
];

type BackgroundKey = (typeof BACKGROUND_OPTIONS)[number]['id'];

interface MolstarProteinViewerProps {
  pdbId: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

const MolstarProteinViewer: React.FC<MolstarProteinViewerProps> = ({
  pdbId,
  isOpen,
  onClose,
  title,
  subtitle
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<RepresentationPresetKey>('auto');
  const [currentTheme, setCurrentTheme] = useState<ColorThemeKey>('chain-id');
  const [background, setBackground] = useState<BackgroundKey>('dark');
  const [showControls, setShowControls] = useState(true);
  const [viewerReady, setViewerReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentPresetRef = useRef<RepresentationPresetKey>('auto');

  const themedParams = useMemo(() => {
    switch (currentTheme) {
      case 'element-symbol':
        return {
          theme: {
            globalName: 'element-symbol' as const,
            carbonColor: 'element-symbol' as const
          }
        };
      case 'operator-name':
        return {
          theme: {
            globalName: 'operator-name' as const,
            carbonColor: 'operator-name' as const
          }
        };
      case 'chain-id':
      default:
        return {
          theme: {
            globalName: 'chain-id' as const,
            carbonColor: 'chain-id' as const
          }
        };
    }
  }, [currentTheme]);

  const disposeViewer = useCallback(() => {
    if (viewerRef.current) {
      try {
        viewerRef.current.dispose();
      } catch (err) {
        console.warn('Mol* viewer dispose failed:', err);
      }
      viewerRef.current = null;
    }
    setViewerReady(false);
  }, []);

  const applyCanvasSettings = useCallback((key: BackgroundKey) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const backgroundOption = BACKGROUND_OPTIONS.find(option => option.id === key) ?? BACKGROUND_OPTIONS[0];
    PluginCommands.Canvas3D.SetSettings(viewer.plugin, {
      settings: old => ({
        ...old,
        renderer: {
          ...old.renderer,
          backgroundColor: Color(backgroundOption.color),
          ambientIntensity: key === 'light' ? 0.35 : 0.5,
          directIntensity: key === 'light' ? 1.1 : 0.9
        }
      })
    });
  }, []);

  const applyRepresentation = useCallback(async (preset: RepresentationPresetKey) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const plugin = viewer.plugin;
    const structures = plugin.managers.structure.hierarchy.current.structures;
    if (!structures.length) return;

    await Promise.all(
      structures.map((struct: typeof structures[number]) =>
        plugin.builders.structure.representation.applyPreset(struct.cell.transform.ref, preset, themedParams)
      )
    );
    plugin.canvas3d?.requestDraw(true);
  }, [themedParams]);

  const clearExistingStructures = useCallback(async (viewer: Viewer) => {
    try {
      const structures = viewer.plugin.managers.structure.hierarchy.current.structures;
      if (structures.length) {
        await viewer.plugin.managers.structure.hierarchy.remove(structures);
      }
    } catch (cleanupError) {
      console.warn('Mol* structure cleanup failed:', cleanupError);
    }
  }, []);

  const applyPostLoadTweaks = useCallback(async () => {
    await applyRepresentation(currentPresetRef.current);
    applyCanvasSettings(background);
  }, [applyCanvasSettings, applyRepresentation, background]);

  const loadStructure = useCallback(async (id: string) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    setIsLoading(true);
    setHasError(false);
    setErrorMessage(null);

    const uppercaseId = id.toUpperCase();
    const lowercaseId = id.toLowerCase();

    const attempts: Array<{ label: string; run: () => Promise<void> }> = [
      {
        label: 'Mol* default provider',
        run: () => viewer.loadPdb(lowercaseId)
      },
      {
        label: 'RCSB mmCIF download',
        run: () => viewer.loadStructureFromUrl(`https://files.rcsb.org/download/${uppercaseId}.cif`, 'mmcif', false, { label: uppercaseId })
      },
      {
        label: 'RCSB BinaryCIF download',
        run: () => viewer.loadStructureFromUrl(`https://models.rcsb.org/${lowercaseId}.bcif`, 'mmcif', true, { label: uppercaseId })
      },
      {
        label: 'AlphaFold PDB download',
        run: () => {
          // Handle AlphaFold structures (AF_*)
          if (uppercaseId.startsWith('AF_')) {
            // AlphaFold URLs use the format: https://alphafold.ebi.ac.uk/files/AF-{id}-F1-model_v4.pdb
            // If the ID already includes -F1, use it as-is, otherwise add it
            const alphafoldId = uppercaseId.includes('-F1') ? uppercaseId : `${uppercaseId}-F1`;
            const alphafoldUrl = `https://alphafold.ebi.ac.uk/files/${alphafoldId}-model_v4.pdb`;
            return viewer.loadStructureFromUrl(alphafoldUrl, 'pdb', false, { label: uppercaseId });
          }
          // Skip this attempt for non-AlphaFold structures
          throw new Error('Not an AlphaFold structure');
        }
      },
      {
        label: 'AlphaFold mmCIF download',
        run: () => {
          // Handle AlphaFold structures (AF_*)
          if (uppercaseId.startsWith('AF_')) {
            // AlphaFold URLs use the format: https://alphafold.ebi.ac.uk/files/AF-{id}-F1-model_v4.cif
            const alphafoldId = uppercaseId.includes('-F1') ? uppercaseId : `${uppercaseId}-F1`;
            const alphafoldUrl = `https://alphafold.ebi.ac.uk/files/${alphafoldId}-model_v4.cif`;
            return viewer.loadStructureFromUrl(alphafoldUrl, 'mmcif', false, { label: uppercaseId });
          }
          // Skip this attempt for non-AlphaFold structures
          throw new Error('Not an AlphaFold structure');
        }
      }
    ];

    let lastError: unknown = null;

    await clearExistingStructures(viewer);

    // Attempt each loader until one succeeds.
    // eslint-disable-next-line no-restricted-syntax
    for (const attempt of attempts) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await attempt.run();
        // eslint-disable-next-line no-await-in-loop
        await applyPostLoadTweaks();
        setIsLoading(false);
        return;
      } catch (attemptError) {
        console.warn(`Mol* ${attempt.label} failed for ${uppercaseId}:`, attemptError);
        lastError = attemptError;
      }
    }

    const message =
      lastError instanceof Error
        ? lastError.message
        : typeof lastError === 'string'
          ? lastError
          : 'Unknown error while fetching the structure.';

    setErrorMessage(message);
    setHasError(true);
    setIsLoading(false);
  }, [applyPostLoadTweaks, clearExistingStructures]);

  const initializeViewer = useCallback(async () => {
    if (!isOpen || !containerRef.current) return;
    if (viewerRef.current) return;

    setIsLoading(true);
    setHasError(false);

    try {
      const { Viewer } = await import('molstar/build/viewer/molstar');
      const viewer = await Viewer.create(containerRef.current, {
        layoutShowControls: false,
        layoutShowLog: false,
        layoutShowSequence: false,
        layoutShowRemoteState: false,
        viewportShowExpand: false,
        viewportShowSelectionMode: false,
        viewportShowSettings: false,
        collapseLeftPanel: true,
        collapseRightPanel: true,
        layoutIsExpanded: true,
        layoutShowLeftPanel: false
      });

      viewerRef.current = viewer;
      setViewerReady(true);
  await loadStructure(pdbId);
    } catch (error) {
      console.error('Mol* viewer initialization failed:', error);
      setHasError(true);
      setIsLoading(false);
    }
  }, [isOpen, loadStructure, pdbId]);

  useEffect(() => {
    if (!isOpen) {
      disposeViewer();
      return;
    }

    void initializeViewer();

    return () => {
      disposeViewer();
    };
  }, [disposeViewer, initializeViewer, isOpen]);

  useEffect(() => {
    if (!viewerReady || !pdbId || !isOpen) return;
    void loadStructure(pdbId);
  }, [isOpen, loadStructure, pdbId, viewerReady]);

  useEffect(() => {
    if (!viewerRef.current) return;
    applyCanvasSettings(background);
  }, [applyCanvasSettings, background]);

  useEffect(() => {
    currentPresetRef.current = currentPreset;
    if (!viewerRef.current || !viewerReady) return;
    void applyRepresentation(currentPreset);
  }, [applyRepresentation, currentPreset, viewerReady]);

  useEffect(() => {
    if (!viewerReady) return;
    const handleResize = () => {
      viewerRef.current?.handleResize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewerReady]);

  const toggleFullscreen = () => {
    setIsFullscreen(prev => {
      const next = !prev;
      setTimeout(() => viewerRef.current?.handleResize(), 200);
      return next;
    });
  };

  const resetCamera = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    PluginCommands.Camera.Reset(viewer.plugin, { durationMs: 500 });
  };

  if (!isOpen) return null;

  return (
    <div className={clsx('fixed inset-0 z-[120] flex items-center justify-center p-4 transition-colors duration-300', isFullscreen ? 'bg-slate-900' : 'bg-slate-900/80 backdrop-blur')}
      role="dialog"
      aria-modal="true"
      aria-label="Molstar protein viewer"
    >
      <div className={clsx('relative flex flex-col rounded-2xl border border-slate-700/60 bg-slate-900/95 shadow-2xl transition-all duration-300', isFullscreen ? 'h-full w-full max-h-full max-w-full' : 'h-[85vh] w-full max-w-6xl')}
        aria-live="polite"
      >
        <header className="flex items-center justify-between border-b border-slate-700/60 bg-slate-950/70 px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Box className="text-emerald-400" size={20} aria-hidden />
              <h2 className="text-lg font-semibold text-white">
                Mol* Viewer – {pdbId.toUpperCase()}
              </h2>
            </div>
            {title && <p className="text-sm text-slate-300">{title}</p>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowControls(prev => !prev)}
              className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-800/70 px-3 py-1.5 text-slate-300 transition hover:border-emerald-500/70 hover:text-white"
            >
              {showControls ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Controls
            </button>
            <button
              onClick={resetCamera}
              className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-2 text-slate-300 transition hover:border-sky-500/70 hover:text-white"
              title="Reset camera"
            >
              <Camera size={16} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-2 text-slate-300 transition hover:border-emerald-500/70 hover:text-white"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={() => {
                disposeViewer();
                onClose();
              }}
              className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-2 text-slate-300 transition hover:border-rose-500/70 hover:text-white"
              title="Close viewer"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {showControls && (
          <section className="grid grid-cols-1 gap-4 border-b border-slate-700/60 bg-slate-900/70 px-6 py-4 text-sm text-slate-200 md:grid-cols-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <LayersIcon />Representation
              </div>
              <div className="flex flex-wrap gap-2">
                {REPRESENTATION_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setCurrentPreset(option.id)}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-xs transition',
                      currentPreset === option.id
                        ? 'border-emerald-500/80 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700/60 bg-slate-800/70 text-slate-300 hover:border-emerald-500/50 hover:text-white'
                    )}
                    title={option.description}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <Palette size={16} aria-hidden />Color Theme
              </div>
              <div className="flex flex-wrap gap-2">
                {COLOR_THEME_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setCurrentTheme(option.id)}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-xs transition',
                      currentTheme === option.id
                        ? 'border-sky-500/80 bg-sky-500/10 text-sky-300'
                        : 'border-slate-700/60 bg-slate-800/70 text-slate-300 hover:border-sky-500/50 hover:text-white'
                    )}
                    title={option.description}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                <RotateCcw size={16} aria-hidden />Background
              </div>
              <div className="flex flex-wrap gap-2">
                {BACKGROUND_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setBackground(option.id)}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-xs transition',
                      background === option.id
                        ? 'border-purple-500/80 bg-purple-500/10 text-purple-300'
                        : 'border-slate-700/60 bg-slate-800/70 text-slate-300 hover:border-purple-500/50 hover:text-white'
                    )}
                    title={`Switch to ${option.label.toLowerCase()} background`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <main className="relative flex-1">
          <div
            ref={containerRef}
            className="h-full w-full"
          />

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/80">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
              <p className="text-sm text-slate-300">Loading PDB structure {pdbId.toUpperCase()}...</p>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/80 p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-rose-400" />
              <div>
                <h3 className="text-lg font-semibold text-white">Unable to load structure</h3>
                <p className="mt-2 text-sm text-slate-300">
                  We could not load the PDB entry {pdbId.toUpperCase()} into the Mol* viewer. Please check the identifier or try again later.
                </p>
                {errorMessage && (
                  <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {errorMessage}
                  </p>
                )}
              </div>
              <button
                onClick={() => loadStructure(pdbId)}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
              >
                Retry loading
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const LayersIcon: React.FC = () => (
  <svg
    className="h-4 w-4 text-slate-300"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <path
      d="M12 3L3 8L12 13L21 8L12 3Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 12L12 17L21 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 16L12 21L21 16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default MolstarProteinViewer;
