import type { FC } from 'react';
import type { ReflectionEntry } from '../types/srlCoach';
import { NotebookPen, Image, Share2 } from 'lucide-react';

interface ReflectionTimelineProps {
  entries: ReflectionEntry[];
  onCreateReflection: () => void;
  onGenerateHighlightReel: () => void;
  isBusy?: boolean;
}

const ReflectionTimeline: FC<ReflectionTimelineProps> = ({
  entries,
  onCreateReflection,
  onGenerateHighlightReel,
  isBusy
}) => {
  return (
    <div className="rounded-2xl border border-purple-500/40 bg-purple-900/10 p-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-200">Reflection Studio</p>
          <h3 className="text-sm font-semibold text-purple-100">Capture insights and growth moments</h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCreateReflection}
            disabled={isBusy}
            className="inline-flex items-center gap-1 rounded-lg border border-purple-400/60 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-purple-100 transition hover:bg-purple-500/20 disabled:opacity-50"
          >
            <NotebookPen size={14} />
            New Reflection
          </button>
          <button
            type="button"
            onClick={onGenerateHighlightReel}
            className="inline-flex items-center gap-1 rounded-lg border border-pink-400/60 bg-pink-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-pink-100 transition hover:bg-pink-500/20"
          >
            <Image size={14} />
            Highlight Reel
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-purple-500/30 bg-purple-500/10 p-4 text-xs text-purple-100/80">
            Start your reflective practice by journaling what clicked, what felt tough, and where curiosity is pulling
            you next.
          </div>
        ) : (
          <ol className="relative border-l border-purple-400/40 pl-4">
            {entries.map((entry: ReflectionEntry) => (
              <li key={entry.id} className="mb-6 ml-2">
                <div className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full border border-purple-300 bg-purple-500/70 shadow" />
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs text-purple-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{entry.prompt || 'Reflection entry'}</span>
                    <span className="text-[11px] text-purple-200/80">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-purple-100/80">{entry.response}</p>
                  {entry.mood ? (
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-purple-200/80">Mood: {entry.mood}</p>
                  ) : null}
                  {entry.highlightMediaUrls && entry.highlightMediaUrls.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.highlightMediaUrls.map((url, mediaIndex) => (
                        <a
                          key={`${entry.id}-media-${mediaIndex}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-400/40 bg-purple-400/10 px-2 py-1 text-[11px] font-semibold text-purple-100 transition hover:bg-purple-400/20"
                        >
                          <Share2 size={12} />
                          Snapshot {mediaIndex + 1}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

export default ReflectionTimeline;
