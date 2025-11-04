import React, { useEffect, useRef, useState } from 'react';
import { ensureKekuleLoaded } from '../services/kekuleLoader';
import { Loader2 } from 'lucide-react';

interface KekuleReactionWidgetProps {
  reactionSmiles?: string | null;
  className?: string;
  height?: number;
}

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

const KekuleReactionWidget: React.FC<KekuleReactionWidgetProps> = ({
  reactionSmiles,
  className = '',
  height = 400
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const trimmedSmiles = reactionSmiles?.trim();

    // Cleanup previous widget
    if (widgetRef.current) {
      try {
        if (typeof widgetRef.current.finalize === 'function') {
          widgetRef.current.finalize();
        } else if (typeof widgetRef.current.dispose === 'function') {
          widgetRef.current.dispose();
        }
      } catch (err) {
        console.warn('Error disposing Kekule widget:', err);
      }
      widgetRef.current = null;
    }

    if (container) {
      container.innerHTML = '';
    }

    if (!container || !trimmedSmiles) {
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    ensureKekuleLoaded()
      .then((Kekule) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        try {
          // Create a Viewer widget for reactions
          const viewer = new Kekule.ChemWidget.Viewer(containerRef.current);

          // Configure viewer using documented APIs
          const width = containerRef.current?.clientWidth ?? 0;
          const resolvedWidth = width > 0 ? `${width}px` : '640px';
          viewer.setDimension(resolvedWidth, `${height}px`);
          viewer.setRenderType(Kekule.Render.RendererType.R2D);
          viewer.setEnableDirectInteraction?.(true);
          viewer.setEnableToolbar?.(false);
          viewer.setEnableEdit?.(false);
          viewer.setAllowCoordOptimize?.(true);
          viewer.setAutofit?.(true);
          viewer.setMoleculeDisplayType?.(
            Kekule.Render?.Molecule2DDisplayType?.SKELETAL ??
            Kekule.Render?.MoleculeDisplayType?.SKELETAL ??
            0
          );

          // Align background with the surrounding panel
          viewer.setBackgroundColor('transparent');

          // Load reaction from SMILES
          // Kekule.js should handle reaction SMILES with >> format
          let chemObj = null;
          let loadError: Error | null = null;
          
          try {
            // Try standard SMILES loading - Kekule should recognize >> as reaction delimiter
            chemObj = Kekule.IO.loadFormatData(trimmedSmiles, 'smi');
            
            // If we got null, it might have silently failed
            if (!chemObj && trimmedSmiles.includes('>')) {
              // Try explicitly as reaction format
              try {
                chemObj = Kekule.IO.loadFormatData(trimmedSmiles, 'rxn');
              } catch (rxnErr) {
                console.warn('RXN format failed:', rxnErr);
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
          } catch (err) {
            loadError = err instanceof Error ? err : new Error(String(err));
            console.warn('SMILES load failed:', err);
            
            // If standard load failed, try creating reaction manually
            if (trimmedSmiles.includes('>')) {
              try {
                // Parse reaction SMILES: reactants>agents>products
                const parts = trimmedSmiles.split('>');
                if (parts.length >= 2) {
                  const reactantSmiles = parts[0].trim();
                  const productSmiles = parts[parts.length - 1].trim();
                  
                  // Create reaction object using Kekule API
                  const reaction = new Kekule.Structure.Reaction();
                  
                  // Load and add reactants
                  if (reactantSmiles) {
                    const reactantList = reactantSmiles.split('.').filter(s => s.trim());
                    for (const rSmiles of reactantList) {
                      const mol = Kekule.IO.loadFormatData(rSmiles.trim(), 'smi');
                      if (mol) {
                        reaction.appendNode(mol);
                      }
                    }
                  }
                  
                  // Add arrow (reaction symbol)
                  const arrow = new Kekule.Structure.ReactionArrow();
                  reaction.appendNode(arrow);
                  
                  // Load and add products
                  if (productSmiles) {
                    const productList = productSmiles.split('.').filter(s => s.trim());
                    for (const pSmiles of productList) {
                      const mol = Kekule.IO.loadFormatData(pSmiles.trim(), 'smi');
                      if (mol) {
                        reaction.appendNode(mol);
                      }
                    }
                  }
                  
                  if (reaction && reaction.getNodeCount() > 0) {
                    chemObj = reaction;
                  }
                }
              } catch (manualError) {
                console.error('Manual reaction creation failed:', manualError);
              }
            }
          }
          
          if (!chemObj) {
            const errorMsg = loadError?.message || loadError?.toString() || 'Unknown error';
            throw new Error(
              `Unable to parse reaction SMILES: "${trimmedSmiles}". ` +
              `Original error: ${errorMsg}. ` +
              `Please ensure the SMILES format is correct (e.g., "CCO.CCO>>CCOC(=O)CCO").`
            );
          }

          // Set the chemical object in the viewer
          viewer.setChemObj(chemObj);
          
          // Request repaint to ensure the viewer updates
          if (typeof viewer.requestRepaint === 'function') {
            viewer.requestRepaint();
          }
          
          // Use autofit to make the reaction fulfill all space (2D mode only)
          if (typeof viewer.setAutofit === 'function') {
            viewer.setAutofit(true);
          }
          
          // Zoom to fit the reaction - defer to ensure viewer layout is ready
          setTimeout(() => {
            if (cancelled) {
              return;
            }
            if (typeof viewer.zoomToFit === 'function') {
              viewer.zoomToFit();
            } else if (typeof viewer.resetView === 'function') {
              viewer.resetView();
            }
            viewer.requestRepaint?.();
          }, 200);

          widgetRef.current = viewer;
          setError(null);
        } catch (err) {
          console.error('Kekule reaction widget setup failed:', err);
          const message =
            err instanceof Error ? err.message : 'Failed to initialize Kekule reaction widget.';
          setError(message);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to load Kekule.js:', err);
        const message =
          err instanceof Error ? err.message : 'Failed to load Kekule.js for reaction widget.';
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (widgetRef.current) {
        try {
          if (typeof widgetRef.current.finalize === 'function') {
            widgetRef.current.finalize();
          } else if (typeof widgetRef.current.dispose === 'function') {
            widgetRef.current.dispose();
          }
        } catch (err) {
          console.warn('Error disposing Kekule widget in cleanup:', err);
        }
        widgetRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [reactionSmiles, height]);

  return (
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      <div
        className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60"
        style={{ minHeight: height, width: '100%' }}
      >
        <div 
          ref={containerRef} 
          className="h-full w-full" 
          style={{ minHeight: height, width: '100%', display: 'block' }} 
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-sm text-slate-300 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading Kekule reaction widget...</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}
    </div>
  );
};

export default KekuleReactionWidget;

