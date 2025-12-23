import React, { useEffect, useMemo, useRef, useState } from 'react';

type HighlightColour = [number, number, number];

type MoleculeStructureProps = {
  id?: string;
  structure: string;
  subStructure?: string;
  width?: number;
  height?: number;
  legend?: string;
  svgMode?: boolean;
  className?: string;
  highlightColour?: string;
  extraDetails?: Record<string, unknown>;
};

const DEFAULT_DEBOUNCE = 120;

const normaliseColour = (hex?: string): HighlightColour | undefined => {
  if (!hex) {
    return undefined;
  }

  const cleaned = hex.trim().replace('#', '');
  let segments: string[] = [];

  if (cleaned.length === 3) {
    segments = cleaned.split('').map(segment => segment + segment);
  } else {
    const match = cleaned.match(/.{1,2}/g);
    if (match) {
      segments = match;
    }
  }

  if (segments.length < 3) {
    return undefined;
  }

  const rgb = segments.slice(0, 3).map(segment => {
    const value = Number.parseInt(segment, 16);
    if (!Number.isFinite(value)) {
      return 0;
    }
    const normalised = Math.max(0, Math.min(1, value / 255));
    return Number(normalised.toFixed(2));
  }) as HighlightColour;

  return rgb;
};

const mergeMatches = (matches: number[][]): { atoms: number[]; bonds: number[] } => {
  if (!Array.isArray(matches) || matches.length === 0) {
    return { atoms: [], bonds: [] };
  }

  const atoms = Array.from(
    new Set(
      matches
        .flat()
        .map(index => Number(index))
        .filter(index => Number.isInteger(index) && index >= 0)
    )
  );

  return { atoms, bonds: [] };
};

const MoleculeStructure: React.FC<MoleculeStructureProps> = ({
  id,
  structure,
  subStructure,
  width = 240,
  height = 200,
  legend,
  svgMode = true,
  className = '',
  highlightColour,
  extraDetails
}) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uniqueId = useMemo(() => id ?? 'molecule-' + Math.random().toString(16).slice(2), [id]);
  const detailsKey = useMemo(() => JSON.stringify(extraDetails || {}), [extraDetails]);

  useEffect(() => {
    let cancelled = false;

    const renderMolecule = async () => {
      const trimmed = structure?.trim();
      if (!trimmed) {
        setError('Missing structure.');
        setSvgContent(null);
        return;
      }

      setIsRendering(true);
      setError(null);
      setSvgContent(null);

      // RDKit functionality removed - using placeholder
      try {
        // Create a simple placeholder showing the molecule structure text
        if (svgMode) {
          const placeholderSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f3f4f6"/>
            <text x="50%" y="40%" text-anchor="middle" font-family="monospace" font-size="12" fill="#374151">${trimmed}</text>
            <text x="50%" y="60%" text-anchor="middle" font-size="10" fill="#6b7280">RDKit visualization removed</text>
          </svg>`;
          if (!cancelled) {
            setSvgContent(placeholderSvg);
          }
        } else {
          // For canvas mode, just show a placeholder
          if (!cancelled) {
            setSvgContent(null);
            setError('Canvas rendering not available (RDKit removed)');
          }
        }
      } catch (renderError) {
        if (!cancelled) {
          const message = renderError instanceof Error ? renderError.message : 'Renderer error.';
          setError(message);
          setSvgContent(null);
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    const handle = window.setTimeout(renderMolecule, DEFAULT_DEBOUNCE);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [structure, subStructure, svgMode, width, height, highlightColour, detailsKey]);

  const renderBody = () => {
    if (error) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-center text-xs text-rose-200">
          {error}
        </div>
      );
    }

    if (isRendering && !svgContent && svgMode) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-lg border border-slate-200/40 bg-slate-100/10 p-3 text-xs text-slate-400">
          Rendering...
        </div>
      );
    }

    if (svgMode && svgContent) {
      return (
        <div
          className="mx-auto"
          style={{ width, height }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      );
    }

    return (
      <canvas
        ref={canvasRef}
        id={uniqueId}
        width={width}
        height={height}
        className="mx-auto"
      />
    );
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className="flex items-center justify-center rounded-xl border border-slate-200/40 bg-white p-3 shadow-sm"
        style={{ width: width + 24, height: height + 24 }}
      >
        {renderBody()}
      </div>
      {legend && (
        <p className="max-w-[260px] text-center text-xs text-slate-500" title={legend}>
          {legend}
        </p>
      )}
    </div>
  );
};

export default MoleculeStructure;
