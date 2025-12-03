import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { FlashcardItem } from '../types/srlCoach';

interface FlashCardDeckProps {
  cards: FlashcardItem[];
  activeIndex: number;
  isFlipped: boolean;
  isLoading: boolean;
  error: string | null;
  topic: string;
  onFlip: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
}

const FlashCardDeck = ({
  cards,
  activeIndex,
  isFlipped,
  isLoading,
  error,
  topic,
  onFlip,
  onNext,
  onPrevious,
  onRegenerate,
  onCancel
}: FlashCardDeckProps) => {
  const activeCard = cards[activeIndex] ?? null;
  const total = cards.length;
  const progressLabel = total ? `Card ${activeIndex + 1} of ${total}` : 'Preparing deck...';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-900/15 p-4">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Flash Card Sprint</p>
          <h4 className="text-sm font-semibold text-amber-100">{topic || 'Chemistry focus'}</h4>
        </div>
        <span className="text-[11px] uppercase tracking-wide text-amber-200/70">{progressLabel}</span>
      </div>

      <div className="mt-4 space-y-3">
        {error ? (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-200">
            <p className="font-semibold">Flash card deck unavailable</p>
            <p className="mt-1 text-xs text-rose-100/80">{error}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/60 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-100 transition hover:bg-rose-500/20"
              >
                <RefreshCw size={14} />
                Try Again
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-100 transition hover:border-rose-400/70 hover:bg-rose-500/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="relative h-56 w-full" style={{ perspective: '1200px' }}>
              <button
                type="button"
                onClick={onFlip}
                disabled={!activeCard || isLoading}
                className="group relative h-full w-full rounded-2xl focus:outline-none"
              >
                <div
                  className="relative h-full w-full rounded-2xl bg-gradient-to-br from-amber-600/60 via-amber-500/50 to-orange-500/50 shadow-lg transition-transform duration-700 [transform-style:preserve-3d]"
                  style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                >
                  <div className="absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl p-4 text-left text-amber-50 [backface-visibility:hidden]">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
                      <Sparkles size={14} />
                      Prompt
                    </div>
                    <p className="text-lg font-semibold leading-snug">
                      {activeCard ? activeCard.front : 'Generating flash cards...'}
                    </p>
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-amber-200/80">
                      <span>Tap to reveal answer</span>
                      {activeCard?.difficulty ? <span>{activeCard.difficulty}</span> : null}
                    </div>
                  </div>
                  <div
                    className="absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl p-4 text-left text-amber-50 [backface-visibility:hidden]"
                    style={{ transform: 'rotateY(180deg)' }}
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
                      <Sparkles size={14} />
                      Explanation
                    </div>
                    <div className="space-y-2 text-sm leading-relaxed text-amber-50/90">
                      <p>{activeCard ? activeCard.back : 'Hold tight while we finish the deck.'}</p>
                      {activeCard?.mnemonic ? (
                        <p className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
                          Mnemonic: {activeCard.mnemonic}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-amber-200/80">
                      <span>Tap to flip back</span>
                      {activeCard?.confidenceTag ? <span>{activeCard.confidenceTag}</span> : null}
                    </div>
                  </div>
                </div>
              </button>
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gray-950/30 backdrop-blur-sm">
                  <Loader2 size={28} className="animate-spin text-amber-200" />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {!error ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrevious}
                disabled={activeIndex <= 0 || !total || isLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={14} />
                Prev
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={activeIndex >= total - 1 || !total || isLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw size={14} />
                Refresh Deck
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FlashCardDeck;
