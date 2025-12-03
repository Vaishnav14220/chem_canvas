import { useMemo, useState } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';

interface MineralCrystalPreviewProps {
  codId: string;
  name?: string;
  onClose: () => void;
}

const MOLVIEW_BASE_URL = 'https://molview.org/';

const buildMolViewUrl = (codId: string) => {
  const trimmed = codId.trim();
  if (!trimmed) {
    return MOLVIEW_BASE_URL;
  }
  const searchParams = new URLSearchParams({
    codid: trimmed,
    embed: '1',
  });
  return `${MOLVIEW_BASE_URL}?${searchParams.toString()}`;
};

export const MineralCrystalPreview = ({ codId, name, onClose }: MineralCrystalPreviewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const iframeSrc = useMemo(() => buildMolViewUrl(codId), [codId]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-purple-500/40 bg-slate-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-purple-500/20 bg-slate-900/80 px-5 py-3">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-300/80">Crystal Preview</p>
            <h2 className="text-lg font-semibold text-slate-50">
              {name || `COD ${codId}`}
            </h2>
            <p className="text-[11px] text-purple-200/80">
              Interactive MolView preview of the crystal structure (COD {codId}).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://molview.org/?codid=${encodeURIComponent(codId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-purple-400/40 bg-purple-600/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-purple-50 transition hover:bg-purple-600/40"
            >
              <ExternalLink size={14} />
              Open in New Tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-purple-100 transition hover:bg-purple-500/20"
              aria-label="Close crystal preview"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="relative flex-1 bg-slate-900">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/70 text-purple-100">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-xs uppercase tracking-wide">Loading MolView crystal</p>
              <p className="text-[11px] text-purple-200/70">
                If the viewer does not load, use the "Open in New Tab" button.
              </p>
            </div>
          )}
          <iframe
            src={iframeSrc}
            title={`MolView Crystal Preview ${codId}`}
            className="h-[70vh] w-full border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-popups allow-popups-to-escape-sandbox"
            allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
            onLoad={handleIframeLoad}
          />
        </div>
      </div>
    </div>
  );
};

export default MineralCrystalPreview;
