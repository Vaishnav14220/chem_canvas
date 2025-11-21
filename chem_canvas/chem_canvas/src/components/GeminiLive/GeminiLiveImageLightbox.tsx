import React, { useEffect } from 'react';
import { ConceptImageRecord } from './types';
import { X } from 'lucide-react';

interface GeminiLiveImageLightboxProps {
  image: ConceptImageRecord | null;
  onClose: () => void;
}

const GeminiLiveImageLightbox: React.FC<GeminiLiveImageLightboxProps> = ({ image, onClose }) => {
  useEffect(() => {
    if (!image) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [image, onClose]);

  if (!image) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative z-[71] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-slate-900 text-slate-200 flex items-center justify-center border border-slate-700 hover:bg-slate-800"
          aria-label="Close image preview"
        >
          <X size={20} />
        </button>
        <div className="bg-slate-950/80 rounded-3xl border border-slate-800/70 overflow-hidden shadow-2xl">
          <div className="bg-black flex items-center justify-center max-h-[70vh]">
            {image.url ? (
              <img
                src={image.url}
                alt={image.alt || image.concept || 'Concept visual'}
                className="w-full object-contain max-h-[70vh]"
              />
            ) : (
              <div className="text-slate-400 text-sm p-6">Image unavailable.</div>
            )}
          </div>
          <div className="p-6 space-y-2 text-slate-200">
            <div>
              <p className="text-lg font-semibold">{image.concept || image.title}</p>
              {image.topic && <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">{image.topic}</p>}
            </div>
            {image.prompt && <p className="text-sm text-slate-300 leading-relaxed">{image.prompt}</p>}
            <div className="flex flex-wrap gap-2 text-[0.7rem] text-slate-300">
              {image.style && <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-700/70">{image.style}</span>}
              {image.medium && <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-700/70">{image.medium}</span>}
              {image.colorPalette && <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-700/70">{image.colorPalette}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiLiveImageLightbox;
