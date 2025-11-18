import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ensureKekuleLoaded } from '../services/kekuleLoader';
import { sanitizeReactionSmilesInput } from '../utils/reactionSanitizer';

type RenderType = 'R2D' | 'R3D';
type MoleculeDisplayType2D = 'SKELETAL' | 'CONDENSED';
type MoleculeDisplayType3D = 'WIRE' | 'STICKS' | 'BALL_STICK' | 'SPACE_FILL';

type KekuleReactionViewerProps = {
  reactionSmiles?: string | null;
  className?: string;
  height?: number;
  renderType?: RenderType;
  moleculeDisplayType?: MoleculeDisplayType2D | MoleculeDisplayType3D;
  enableToolbar?: boolean;
  enableDirectInteraction?: boolean;
  enableEdit?: boolean;
  autofit?: boolean;
  zoom?: number;
  backgroundColor?: string;
  preset?: 'fullFunc' | 'basic' | 'editOnly' | 'static';
  atomColor?: string;
  bondColor?: string;
  enableInput?: boolean;
  onSmilesChange?: (smiles: string) => void;
};

const normalizeReactionSmiles = (input: string): string => {
  if (!input || input.includes('>>')) {
    return input;
  }

  const parts = input.split('>');
  if (parts.length !== 3) {
    return input;
  }

  const [reactantsRaw, agentsRaw, productsRaw] = parts.map(part => part.trim());
  if (!agentsRaw) {
    return `${reactantsRaw}>>${productsRaw}`;
  }

  const agentTokens = agentsRaw
    .split('.')
    .map(token => token.trim())
    .filter(token => token.length > 0);

  const normalizedReactants = [reactantsRaw, ...agentTokens].filter(Boolean).join('.');
  const normalizedProducts = productsRaw;

  return `${normalizedReactants}>>${normalizedProducts}`;
};

const DEFAULT_HEIGHT = 360;

// Preset configurations based on Kekule.js documentation
const PRESETS = {
  fullFunc: {
    enableToolbar: true,
    enableDirectInteraction: true,
    enableEdit: true,
    toolButtons: [
      'loadData', 'saveData', 'molDisplayType', 'molHideHydrogens',
      'zoomIn', 'zoomOut',
      'rotateLeft', 'rotateRight', 'rotateX', 'rotateY', 'rotateZ',
      'reset', 'openEditor', 'config'
    ]
  },
  basic: {
    enableToolbar: true,
    enableDirectInteraction: true,
    enableEdit: false,
    toolButtons: ['saveData', 'molDisplayType', 'zoomIn', 'zoomOut']
  },
  editOnly: {
    enableToolbar: true,
    enableDirectInteraction: true,
    enableEdit: true,
    toolButtons: ['openEditor']
  },
  static: {
    enableToolbar: false,
    enableDirectInteraction: false,
    enableEdit: false,
    toolButtons: []
  }
};

const KekuleReactionViewer: React.FC<KekuleReactionViewerProps> = ({
  reactionSmiles,
  className,
  height = DEFAULT_HEIGHT,
  renderType = 'R2D',
  moleculeDisplayType = 'SKELETAL',
  enableToolbar = false,
  enableDirectInteraction = true,
  enableEdit = false,
  autofit = true,
  zoom = 1.0,
  backgroundColor = 'transparent',
  preset,
  atomColor,
  bondColor,
  enableInput = false,
  onSmilesChange
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputSmiles, setInputSmiles] = useState(reactionSmiles || '');

  // Update input when reactionSmiles prop changes
  useEffect(() => {
    if (!enableInput) {
      setInputSmiles(reactionSmiles || '');
    }
  }, [reactionSmiles, enableInput]);

  const handleSmilesChange = (value: string) => {
    setInputSmiles(value);
    onSmilesChange?.(value);
  };

  // Control methods that can be exposed via ref or callbacks
  const zoomIn = (factor: number = 1.2) => {
    if (viewerRef.current) {
      const currentZoom = viewerRef.current.getZoom?.() ?? 1.0;
      viewerRef.current.setZoom(currentZoom * factor);
    }
  };

  const zoomOut = (factor: number = 0.8) => {
    if (viewerRef.current) {
      const currentZoom = viewerRef.current.getZoom?.() ?? 1.0;
      viewerRef.current.setZoom(currentZoom * factor);
    }
  };

  const resetZoom = () => {
    if (viewerRef.current) {
      viewerRef.current.setZoom(1.0);
      if (typeof viewerRef.current.resetView === 'function') {
        viewerRef.current.resetView();
      }
    }
  };

  const rotate2D = (angle: number) => {
    if (viewerRef.current && renderType === 'R2D') {
      viewerRef.current.rotate2DBy?.(angle);
    }
  };

  const rotate3D = (dx: number, dy: number, dz: number) => {
    if (viewerRef.current && renderType === 'R3D') {
      viewerRef.current.rotate3DBy?.(dx, dy, dz);
    }
  };

  const setCustomColors = (atomColor?: string, bondColor?: string) => {
    if (viewerRef.current) {
      const renderConfigs = viewerRef.current.getRenderConfigs?.();
      if (renderConfigs) {
        const colorConfigs = renderConfigs.getColorConfigs?.();
        if (colorConfigs) {
          if (atomColor) colorConfigs.setAtomColor?.(atomColor);
          if (bondColor) colorConfigs.setBondColor?.(bondColor);
          viewerRef.current.requestRepaint?.();
        }
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;

    viewerRef.current?.finalize?.();
    viewerRef.current = null;

    if (container) {
      container.innerHTML = '';
    }

    const currentSmiles = enableInput ? inputSmiles : reactionSmiles;
    const trimmedSmiles = currentSmiles?.trim();
    const sanitizedSmiles = trimmedSmiles ? sanitizeReactionSmilesInput(trimmedSmiles) ?? trimmedSmiles : null;
    if (!container || !sanitizedSmiles) {
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const run = async () => {
      try {
        const Kekule = await ensureKekuleLoaded();
        if (cancelled || !containerRef.current) {
          return;
        }

        const formatError = (err: unknown): string => {
          const raw = err instanceof Error ? err.message : String(err ?? '');
          const normalized = raw.replace(/\s+/g, ' ').trim();
          return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
        };

        const parseErrors: string[] = [];
        const recordError = (context: string, err: unknown) => {
          const message = formatError(err);
          if (!message) {
            return;
          }
          parseErrors.push(`${context} (${message})`);
        };

        const viewer = new Kekule.ChemWidget.Viewer(containerRef.current);
        const width = containerRef.current?.clientWidth ?? 0;
        const resolvedWidth = width > 0 ? `${width}px` : '640px';
        viewer.setDimension(resolvedWidth, `${height}px`);

        let config = {
          enableToolbar,
          enableDirectInteraction,
          enableEdit,
          autofit,
          zoom,
          backgroundColor,
          toolButtons: [] as string[]
        };

        if (preset && PRESETS[preset]) {
          config = { ...config, ...PRESETS[preset] };
        }

        const renderTypeValue = renderType === 'R3D'
          ? Kekule.Render.RendererType.R3D
          : Kekule.Render.RendererType.R2D;
        viewer.setRenderType(renderTypeValue);

        let displayTypeValue;
        if (renderType === 'R2D') {
          displayTypeValue = moleculeDisplayType === 'CONDENSED'
            ? Kekule.Render.Molecule2DDisplayType.CONDENSED
            : Kekule.Render.Molecule2DDisplayType.SKELETAL;
        } else {
          switch (moleculeDisplayType) {
            case 'WIRE':
              displayTypeValue = Kekule.Render.Molecule3DDisplayType.WIRE;
              break;
            case 'STICKS':
              displayTypeValue = Kekule.Render.Molecule3DDisplayType.STICKS;
              break;
            case 'BALL_STICK':
              displayTypeValue = Kekule.Render.Molecule3DDisplayType.BALL_STICK;
              break;
            case 'SPACE_FILL':
              displayTypeValue = Kekule.Render.Molecule3DDisplayType.SPACE_FILL;
              break;
            default:
              displayTypeValue = Kekule.Render.Molecule3DDisplayType.WIRE;
          }
        }
        viewer.setMoleculeDisplayType(displayTypeValue);

        viewer.setEnableToolbar(config.enableToolbar);
        viewer.setEnableDirectInteraction(config.enableDirectInteraction);
        viewer.setEnableEdit(config.enableEdit);
        viewer.setAutofit(config.autofit);
        viewer.setZoom(config.zoom);
        viewer.setBackgroundColor(config.backgroundColor);

        if (config.enableToolbar && config.toolButtons) {
          viewer.setToolButtons(config.toolButtons);
        }

        let chemObj: any = null;

        try {
          if (sanitizedSmiles.includes('>>')) {
            const [reactantsPart, productsPart] = sanitizedSmiles.split('>>');
            const reactants = reactantsPart.split('.').filter(s => s.trim());
            const products = productsPart.split('.').filter(s => s.trim());

            const reaction = new Kekule.Reaction();

            reactants.forEach(smiles => {
              try {
                const mol = Kekule.IO.loadFormatData(smiles.trim(), 'smi');
                if (mol) {
                  reaction.appendReactant(mol);
                }
              } catch (err) {
                recordError(`Reactant ${smiles.trim() || '[unspecified]'}`, err);
                console.warn(`Failed to load reactant SMILES: ${smiles}`, err);
              }
            });

            products.forEach(smiles => {
              try {
                const mol = Kekule.IO.loadFormatData(smiles.trim(), 'smi');
                if (mol) {
                  reaction.appendProduct(mol);
                }
              } catch (err) {
                recordError(`Product ${smiles.trim() || '[unspecified]'}`, err);
                console.warn(`Failed to load product SMILES: ${smiles}`, err);
              }
            });

            if (reaction.getReactantCount() > 0 || reaction.getProductCount() > 0) {
              chemObj = reaction;
            }
          }
        } catch (reactionErr) {
          recordError('Reaction assembly', reactionErr);
          console.warn('Reaction parsing failed:', reactionErr);
        }

        if (!chemObj) {
          try {
            chemObj = Kekule.IO.loadFormatData(sanitizedSmiles, 'smi');
          } catch (smiErr) {
            recordError('Direct SMILES parsing', smiErr);
            console.warn('SMILES loading failed:', smiErr);
          }
        }

        if (!chemObj && sanitizedSmiles.includes('>')) {
          try {
            chemObj = Kekule.IO.loadFormatData(sanitizedSmiles, 'rxn');
          } catch (rxnErr) {
            recordError('Direct RXN loading', rxnErr);
            console.warn('RXN format load failed:', rxnErr);
          }
        }

        if (!chemObj && sanitizedSmiles.includes('>')) {
          try {
            const normalized = normalizeReactionSmiles(sanitizedSmiles);
            if (normalized !== sanitizedSmiles) {
              chemObj = Kekule.IO.loadFormatData(normalized, 'smi');
            }
          } catch (normalizeErr) {
            recordError('Normalized SMILES parsing', normalizeErr);
            console.warn('Normalized reaction SMILES load failed:', normalizeErr);
          }
        }

        if (!chemObj) {
          const details = parseErrors.length
            ? ` Details: ${Array.from(new Set(parseErrors)).slice(0, 3).join(' | ')}`
            : '';
          throw new Error(`Unable to parse the supplied reaction. Tried SMILES parsing.${details}`);
        }

        viewer.setChemObj(chemObj);

        if (atomColor || bondColor) {
          const renderConfigs = viewer.getRenderConfigs?.();
          if (renderConfigs) {
            const colorConfigs = renderConfigs.getColorConfigs?.();
            if (colorConfigs) {
              if (atomColor) colorConfigs.setAtomColor?.(atomColor);
              if (bondColor) colorConfigs.setBondColor?.(bondColor);
            }
          }
        }

        if (config.autofit) {
          if (typeof viewer.zoomToFit === 'function') {
            viewer.zoomToFit();
          } else if (typeof viewer.resetView === 'function') {
            viewer.resetView();
          }
        }

        viewerRef.current = viewer;
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        console.error('Kekule viewer setup failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to initialise Kekule reaction viewer.';
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      viewerRef.current?.finalize?.();
      viewerRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [reactionSmiles, height, renderType, moleculeDisplayType, enableToolbar, enableDirectInteraction, enableEdit, autofit, zoom, backgroundColor, preset, atomColor, bondColor, enableInput, ...(enableInput ? [inputSmiles] : [])]);

  return (
    <div className={clsx('flex w-full flex-col gap-3', className)}>
      {/* Header with SMILES input */}
      <header className="flex flex-col gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3 md:flex-row md:items-center md:justify-between rounded-t-lg">
        <div>
          <h3 className="text-sm font-semibold text-white">Kekule.js Reaction Widget</h3>
          <p className="text-xs text-slate-400">Interactive reaction viewer using Kekule.js widget - zoom, rotate, and explore.</p>
        </div>
        {enableInput && (
          <div className="flex flex-col gap-2 md:min-w-[400px]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                SMILES Input
              </label>
              <button
                onClick={() => handleSmilesChange('')}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Clear
              </button>
            </div>
            <input
              type="text"
              value={inputSmiles}
              onChange={(e) => handleSmilesChange(e.target.value)}
              placeholder="Paste SMILES: CCO.O=C=O>>CCOC(=O)CCO"
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-mono text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2 text-xs">
              <button onClick={() => handleSmilesChange('CCO.O=C=O>>CCOC(=O)CCO')} className="text-blue-400 hover:text-blue-300 hover:underline">Esterification</button>
              <span className="text-slate-600">|</span>
              <button onClick={() => handleSmilesChange('CC(C)C.O=C=O>>CC(C)OC(=O)CCO')} className="text-blue-400 hover:text-blue-300 hover:underline">Isobutanol</button>
            </div>
          </div>
        )}
      </header>

      <div
        className="relative overflow-hidden rounded-b-lg border border-slate-200/60 bg-white shadow-sm"
        style={{ minHeight: height }}
      >
        <div ref={containerRef} className="h-full w-full" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-slate-600 backdrop-blur-sm">
            Loading Kekule viewer...
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
};

export default KekuleReactionViewer;
