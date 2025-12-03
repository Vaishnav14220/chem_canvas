import React from 'react';
import { ConceptImageRecord } from './types';
import { AlertTriangle, Clock, Image as ImageIcon, Loader2, Maximize2 } from 'lucide-react';

interface GeminiLiveConceptGalleryProps {
  images: ConceptImageRecord[];
  onSelectImage?: (image: ConceptImageRecord) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    console.error('Invalid timestamp for concept gallery item:', err);
    return '';
  }
};

const GeminiLiveConceptGallery: React.FC<GeminiLiveConceptGalleryProps> = ({ images, onSelectImage, isOpen = true, onToggle }) => {
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full h-full min-h-[200px] rounded-2xl border border-slate-800/60 bg-slate-900/40 text-slate-200 flex flex-col items-center justify-center gap-2 hover:bg-slate-900/60 transition"
      >
        <ImageIcon size={20} className="text-cyan-300" />
        <span className="text-sm font-semibold">Open Visual Memory ({images.length})</span>
      </button>
    );
  }

  return (
    <div className="bg-slate-900/40 backdrop-blur border border-slate-800/50 rounded-2xl p-4 flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400/80 mb-1">Visual Memory</p>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <ImageIcon size={16} className="text-cyan-300" />
            Concept Gallery
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 font-medium">{images.length} saved</div>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg border border-slate-800/60"
            >
              Hide
            </button>
          )}
        </div>
      </div>

      {!images.length && (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-sm text-slate-500 gap-3">
          <ImageIcon size={32} className="text-slate-600" />
          <div>
            <p>No visuals yet</p>
            <p className="text-xs text-slate-500/80">Ask the tutor to generate a concept snapshot to populate this gallery.</p>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="flex-1 overflow-auto space-y-4 mt-4 pr-1">
          {images.map((image) => (
            <div
              key={image.id}
              className="group rounded-2xl border border-slate-800/60 bg-slate-950/40 shadow-lg shadow-slate-950/30 overflow-hidden"
            >
              <div className="relative w-full aspect-[4/3] bg-slate-950/70">
                {image.status === 'complete' && image.url && (
                  <img
                    src={image.url}
                    alt={image.alt || image.concept || 'Concept snapshot'}
                    className="object-cover w-full h-full group-hover:scale-[1.02] transition-transform duration-700"
                    loading="lazy"
                  />
                )}
                {image.status === 'complete' && image.url && onSelectImage && (
                  <button
                    type="button"
                    onClick={() => onSelectImage(image)}
                    className="absolute top-3 right-3 inline-flex items-center justify-center rounded-full bg-slate-900/80 text-slate-100 border border-slate-800/60 p-2 hover:bg-slate-900"
                    aria-label="Expand concept image"
                  >
                    <Maximize2 size={14} />
                  </button>
                )}

                {image.status === 'loading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#0f172a,_#020617)] opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shadow-sweep" />
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <Loader2 className="animate-spin text-cyan-300" size={20} />
                      <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Rendering Visual</p>
                    </div>
                  </div>
                )}

                {image.status === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/60 text-red-200">
                    <AlertTriangle size={20} />
                    <p className="text-xs font-semibold">Image failed</p>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent px-4 py-3">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-semibold text-white truncate pr-2">{image.concept || image.title}</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock size={12} />
                      {formatTime(image.updatedAt || image.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-2 text-xs text-slate-400">
                {image.prompt && (
                  <p className="text-slate-300 text-sm leading-relaxed">
                    <span className="text-cyan-300 font-semibold">Prompt:</span> {image.prompt}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-[0.7rem]">
                  {image.topic && (
                    <span className="px-2 py-1 rounded-full bg-slate-900 text-slate-200 border border-slate-800/70">{image.topic}</span>
                  )}
                  {image.style && (
                    <span className="px-2 py-1 rounded-full bg-slate-900/60 text-cyan-200 border border-cyan-500/20">{image.style}</span>
                  )}
                  {image.medium && (
                    <span className="px-2 py-1 rounded-full bg-slate-900/60 text-blue-200 border border-blue-500/20">{image.medium}</span>
                  )}
                </div>
                {image.status === 'complete' && (
                  <p className="text-[0.65rem] text-slate-500">Use this visual as reference when discussing related questions.</p>
                )}
                {image.status === 'loading' && (
                  <p className="text-[0.65rem] text-cyan-300/80 uppercase tracking-[0.2em]">Generating…</p>
                )}
                {image.status === 'error' && image.message && (
                  <p className="text-[0.65rem] text-red-300">{image.message}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GeminiLiveConceptGallery;
