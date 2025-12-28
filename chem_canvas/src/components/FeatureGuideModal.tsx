import { X } from 'lucide-react';
import type { FeatureItem } from './FeatureSidebar';

interface FeatureGuideModalProps {
  feature: FeatureItem | null;
  onClose: () => void;
  onOpen: (feature: FeatureItem) => void;
}

const FeatureGuideModal: React.FC<FeatureGuideModalProps> = ({ feature, onClose, onOpen }) => {
  if (!feature) return null;

  const Icon = feature.icon;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-[min(560px,92vw)] rounded-2xl border border-slate-800/80 bg-[#171717] p-6 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700/70 bg-[#111111] text-slate-200">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-white">{feature.label}</h3>
              <p className="mt-1 text-sm text-slate-400">{feature.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/70 bg-[#111111] text-slate-300 transition hover:text-white"
            aria-label="Close guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">How to use</p>
          <ol className="space-y-2 text-sm text-slate-300">
            {feature.steps.map((step, index) => (
              <li key={`${feature.id}-step-${index}`} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700/70 bg-[#111111] px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Close
          </button>
          {feature.action && (
            <button
              type="button"
              onClick={() => onOpen(feature)}
              className="rounded-lg border border-slate-600 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white"
            >
              Open feature
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeatureGuideModal;
