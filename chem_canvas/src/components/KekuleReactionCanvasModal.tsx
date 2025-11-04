import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { X, RefreshCw, Maximize2, Minimize2, Rotate3D, PenSquare, Compass } from 'lucide-react';
import { ensureKekuleLoaded } from '../services/kekuleLoader';

type KekuleReactionCanvasModalProps = {
  reactionSmiles?: string | null;
  onClose: () => void;
};

type RenderMode = '2D' | '3D';
type DisplayMode = 'reaction' | 'molecule';

const modalRootClass =
  'fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4 py-6';

const containerClass =
  'relative flex w-full max-w-6xl flex-col gap-3 rounded-2xl border border-slate-600/60 bg-slate-900/95 p-5 text-slate-100 shadow-2xl';

const viewerShellClass =
  'relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/80 shadow-inner';

const buildViewerOptions = (Kekule: any) => ({
  enableToolbar: true,
  enableDirectInteraction: true,
  enableOperHistory: false,
  renderType: Kekule.Render.RendererType.R2D,
  allowCoordOptimize: true
});

const applyViewerDisplayMode = (viewer: any, mode: DisplayMode, toolbarVisible: boolean) => {
  const inReactionMode = mode === 'reaction';
  viewer.setEnableToolbar?.(inReactionMode ? toolbarVisible : false);
  viewer.setEnableDirectInteraction?.(inReactionMode);
  viewer.setEnableEdit?.(false);
  viewer.setToolButtons?.(
    inReactionMode
      ? [
          'loadData',
          'saveData',
          'molDisplayType',
          'zoomIn',
          'zoomOut',
          'rotateLeft',
          'rotateRight',
          'reset',
          'openEditor'
        ]
      : []
  );
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

const KekuleReactionCanvasModal: React.FC<KekuleReactionCanvasModalProps> = ({ reactionSmiles, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('2D');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('reaction');
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const displayModeRef = useRef<DisplayMode>('reaction');
  const toolbarVisibleRef = useRef(isToolbarVisible);

  const trimmedSmiles = reactionSmiles?.trim();

  const controlsDisabled = useMemo(() => !trimmedSmiles || isLoading || !!error, [trimmedSmiles, isLoading, error]);

  useEffect(() => {
    displayModeRef.current = displayMode;
  }, [displayMode]);

  useEffect(() => {
    toolbarVisibleRef.current = isToolbarVisible;
  }, [isToolbarVisible]);

  useEffect(() => {
    const container = containerRef.current;

    viewerRef.current?.finalize?.();
    viewerRef.current = null;

    if (container) {
      container.innerHTML = '';
    }

    if (!trimmedSmiles) {
      setError('Provide a reaction SMILES to open the interactive canvas.');
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    ensureKekuleLoaded()
      .then(Kekule => {
        if (isCancelled || !containerRef.current) return;

        const viewer = new Kekule.ChemWidget.Viewer(containerRef.current, buildViewerOptions(Kekule));
        const width = containerRef.current?.clientWidth ?? 0;
        const heightPx = containerRef.current?.clientHeight ?? 420;
        const resolvedWidth = width > 0 ? `${width}px` : '960px';
        viewer.setDimension(resolvedWidth, `${heightPx}px`);
        viewer.setToolbarPos?.(Kekule.Widget?.Position?.TOP ?? 'top');
        viewer.setRenderType?.(Kekule.Render?.RendererType?.R2D ?? 0);
        viewer.setAutofit?.(true);
        viewer.setAllowCoordOptimize?.(true);
        viewer.setEnableEdit?.(false);
        viewer.setMoleculeDisplayType?.(
          Kekule.Render?.Molecule2DDisplayType?.SKELETAL ??
          Kekule.Render?.MoleculeDisplayType?.SKELETAL ??
          0
        );
        viewer.setBackgroundColor?.('transparent');
        applyViewerDisplayMode(viewer, displayModeRef.current, toolbarVisibleRef.current);

        try {
          let chemObj = Kekule.IO.loadFormatData(trimmedSmiles, 'smi');
          if (!chemObj && trimmedSmiles.includes('>')) {
            try {
              chemObj = Kekule.IO.loadFormatData(trimmedSmiles, 'rxn');
            } catch (rxnErr) {
              console.warn('RXN format load failed:', rxnErr);
            }

            if (!chemObj) {
              const normalized = normalizeReactionSmiles(trimmedSmiles);
              if (normalized !== trimmedSmiles) {
                try {
                  chemObj = Kekule.IO.loadFormatData(normalized, 'smi');
                } catch (normalizeErr) {
                  console.warn('Normalized reaction SMILES load failed:', normalizeErr);
                }
              }
            }
          }
          if (!chemObj) {
            throw new Error('Kekule was unable to parse the reaction.');
          }

          viewer.setChemObj(chemObj);
          if (viewer.resetView) {
            viewer.resetView();
          } else if (viewer.zoomToFit) {
            viewer.zoomToFit();
          }

          viewerRef.current = viewer;
        } catch (err) {
          viewer.finalize?.();
          viewerRef.current = null;
          const message = err instanceof Error ? err.message : 'Failed to load reaction in Kekule viewer.';
          setError(message);
        }
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : 'Unable to load Kekule.js resources.';
        setError(message);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      viewerRef.current?.finalize?.();
      viewerRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [trimmedSmiles]);

  const applyRenderMode = useCallback((mode: RenderMode) => {
    if (!viewerRef.current || typeof window === 'undefined' || !window.Kekule) return;

    try {
      const rendererTypeMap = window.Kekule.Render?.RendererType;
      if (!rendererTypeMap) return;
      const targetType = mode === '3D' ? rendererTypeMap.R3D ?? 1 : rendererTypeMap.R2D ?? 0;
      if (viewerRef.current.setRenderType) {
        viewerRef.current.setRenderType(targetType);
      }
      viewerRef.current.resetView?.();
    } catch (error_) {
      console.warn('Failed to apply render mode:', error_);
    }
  }, []);

  useEffect(() => {
    applyRenderMode(renderMode);
  }, [renderMode, applyRenderMode]);

  const handleZoomToFit = useCallback(() => {
    viewerRef.current?.resetView?.();
    viewerRef.current?.zoomToFit?.();
  }, []);

  const handleToggleToolbar = useCallback(() => {
    const next = !toolbarVisibleRef.current;
    toolbarVisibleRef.current = next;
    setIsToolbarVisible(next);
    if (displayModeRef.current === 'reaction') {
      viewerRef.current?.setEnableToolbar?.(next);
    }
  }, []);

  const handleSwitchDisplayMode = useCallback(
    (mode: DisplayMode) => {
      displayModeRef.current = mode;
      setDisplayMode(mode);
      if (!viewerRef.current) {
        return;
      }
      applyViewerDisplayMode(viewerRef.current, mode, toolbarVisibleRef.current);
      viewerRef.current.resetView?.();
      viewerRef.current.requestRepaint?.();
    },
    []
  );

  return (
    <div className={modalRootClass} role="dialog" aria-modal="true">
      <div className={containerClass}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Kekule Reaction Canvas</h2>
            <p className="mt-1 text-sm text-slate-300">
              Interactive viewer powered by <a className="text-sky-400 underline" href="https://partridgejiang.github.io/Kekule.js/documents/tutorial/content/chemViewer.html" target="_blank" rel="noreferrer">Kekule.js chemViewer</a>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600/60 bg-slate-800/80 text-slate-200 transition hover:bg-slate-700"
            aria-label="Close Kekule reaction canvas"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/60 p-3 text-xs">
          <span className="font-semibold uppercase tracking-wide text-slate-300">Render</span>
          {(['2D', '3D'] as RenderMode[]).map(mode => (
            <button
              key={mode}
              disabled={controlsDisabled}
              onClick={() => setRenderMode(mode)}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 transition',
                renderMode === mode
                  ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                  : 'border-slate-600 text-slate-200 hover:border-sky-400 hover:text-sky-200',
                controlsDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <Rotate3D size={14} className="opacity-80" /> {mode}
            </button>
          ))}

          <span className="ml-2 font-semibold uppercase tracking-wide text-slate-300">Display</span>
          {(['reaction', 'molecule'] as DisplayMode[]).map(mode => (
            <button
              key={mode}
              disabled={controlsDisabled}
              onClick={() => handleSwitchDisplayMode(mode)}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 transition capitalize',
                displayMode === mode
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                  : 'border-slate-600 text-slate-200 hover:border-emerald-400 hover:text-emerald-200',
                controlsDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <PenSquare size={14} className="opacity-80" /> {mode}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <button
              disabled={controlsDisabled}
              onClick={handleZoomToFit}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md border border-slate-600 px-2.5 py-1 text-slate-200 transition hover:border-sky-400 hover:text-sky-200',
                controlsDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <Compass size={14} className="opacity-80" />
              Fit
            </button>
            <button
              disabled={controlsDisabled}
              onClick={handleToggleToolbar}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md border border-slate-600 px-2.5 py-1 text-slate-200 transition hover:border-slate-400',
                controlsDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {isToolbarVisible ? (
                <>
                  <Minimize2 size={14} className="opacity-80" />
                  Hide tools
                </>
              ) : (
                <>
                  <Maximize2 size={14} className="opacity-80" />
                  Show tools
                </>
              )}
            </button>
            <button
              disabled={controlsDisabled}
              onClick={() => {
                viewerRef.current?.resetView?.();
              }}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md border border-slate-600 px-2.5 py-1 text-slate-200 transition hover:border-rose-400 hover:text-rose-200',
                controlsDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <RefreshCw size={14} className="opacity-80" />
              Reset
            </button>
          </div>
        </div>

        <div className={clsx(viewerShellClass, 'min-h-[420px]')}>
          <div ref={containerRef} className="h-[420px] w-full" />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm text-slate-200">
              Preparing Kekule canvas�
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 px-6 text-center text-sm text-rose-200">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KekuleReactionCanvasModal;
