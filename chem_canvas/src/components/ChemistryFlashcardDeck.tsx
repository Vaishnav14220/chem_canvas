import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, GraduationCap, Loader2, RefreshCw, XCircle } from 'lucide-react';


export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

interface FlashcardDeckProps {
  cards: Flashcard[];
  activeIndex?: number;
  isFlipped?: boolean;
  isLoading?: boolean;
  error?: string | null;
  topic?: string;
  onFlip?: () => void;
  onFlipStateChange?: (isFlipped: boolean) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onRegenerate?: () => Promise<void>;
  onCancel?: () => void;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  cards,
  activeIndex,
  isFlipped: controlledIsFlipped,
  isLoading = false,
  error = null,
  topic,
  onFlip,
  onFlipStateChange,
  onNext,
  onPrevious,
  onRegenerate,
  onCancel
}) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const [internalIsFlipped, setInternalIsFlipped] = useState(false);

  // Use controlled state if provided, otherwise internal state
  const currentIndex = activeIndex !== undefined ? activeIndex : internalIndex;
  const isFlipped = controlledIsFlipped !== undefined ? controlledIsFlipped : internalIsFlipped;

  const handleNext = useCallback(() => {
    if (onNext) {
      onNext();
    } else {
      setInternalIsFlipped(false);
      setTimeout(() => {
        setInternalIndex((prev) => (prev + 1) % cards.length);
      }, 300);
    }
  }, [cards.length, onNext]);

  const handlePrev = useCallback(() => {
    if (onPrevious) {
      onPrevious();
    } else {
      setInternalIsFlipped(false);
      setTimeout(() => {
        setInternalIndex((prev) => (prev - 1 + cards.length) % cards.length);
      }, 300);
    }
  }, [cards.length, onPrevious]);

  const handleFlip = useCallback(() => {
    if (onFlip) {
      onFlip();
      return;
    }

    setInternalIsFlipped(prev => {
      const next = !prev;
      onFlipStateChange?.(next);
      return next;
    });
  }, [onFlip, onFlipStateChange]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignor navigation if user is typing in chat
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.code) {
        case 'Space':
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          handleFlip();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleNext, handlePrev]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <Loader2 className="w-10 h-10 mb-3 text-indigo-400 animate-spin" />
        <p className="font-medium text-slate-500">Generating flashcards...</p>
        <p className="text-xs text-slate-400 mt-1">Crafting questions for "{topic || 'your topic'}"</p>
        {onCancel && (
          <button onClick={onCancel} className="mt-4 text-xs bg-white border border-slate-200 px-3 py-1 rounded-full text-slate-500 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-rose-400 p-8 text-center border-2 border-dashed border-rose-200 rounded-xl bg-rose-50/30">
        <XCircle className="w-10 h-10 mb-2 opacity-80" />
        <p className="text-slate-700 font-medium">Failed to generate cards</p>
        <p className="text-xs text-rose-500 mt-1 max-w-[200px] truncate">{error}</p>
        {onRegenerate && (
          <button
            onClick={() => void onRegenerate()}
            className="mt-4 flex items-center gap-2 text-xs bg-white border border-rose-200 px-3 py-1.5 rounded-full text-rose-600 hover:bg-rose-50 transition-colors font-medium"
          >
            <RefreshCw className="w-3 h-3" /> Try Again
          </button>
        )}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <GraduationCap className="w-12 h-12 mb-2 opacity-50" />
        <p>No flashcards available.</p>
        {topic && <p className="text-xs mt-1">Topic: {topic}</p>}
        {onRegenerate && (
          <button
            onClick={() => void onRegenerate()}
            className="mt-4 flex items-center gap-2 text-xs bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors font-medium"
          >
            <RefreshCw className="w-3 h-3" /> Generate Cards
          </button>
        )}
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="flex flex-col h-full max-w-md mx-auto p-4 w-full">
      <div
        className="flex-1 perspective-1000 relative min-h-[340px] cursor-pointer group"
        onClick={handleFlip}
      >
        <motion.div
          className="w-full h-full relative preserve-3d transition-all duration-500"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-[0_3px_12px_rgba(0,0,0,0.08)] border border-slate-100 flex flex-col items-center justify-center p-8 text-center hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:border-indigo-100 transition-all duration-300">
            <div className="absolute top-6 left-6 w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-50"></div>
            <div className="absolute top-6 right-6 w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-50"></div>
            <div className="absolute bottom-6 left-6 w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-50"></div>
            <div className="absolute bottom-6 right-6 w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-50"></div>

            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">Term</span>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-800 leading-tight tracking-tight">{currentCard?.front}</h3>
            <p className="absolute bottom-6 text-xs text-slate-300 font-medium group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-current"></span> Click to flip
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 backface-hidden bg-white rounded-3xl shadow-[0_3px_12px_rgba(0,0,0,0.08)] border-t-4 border-t-indigo-500 border-x border-b border-x-slate-100 border-b-slate-100 flex flex-col items-center justify-center p-8 text-center"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-6 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Definition</span>
            <div className="prose prose-lg max-w-none w-full flex items-center justify-center flex-1">
              <p className="text-lg md:text-xl text-slate-700 leading-relaxed font-medium">{currentCard?.back}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 mt-6 px-2">
        {/* Progress Bar */}
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed group active:scale-95 shadow-sm"
            disabled={cards.length <= 1 || isLoading}
            title="Previous card (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-slate-700 font-mono">
              {currentIndex + 1} / {cards.length}
            </span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed group active:scale-95 shadow-sm"
            disabled={cards.length <= 1 || isLoading}
            title="Next card (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {onRegenerate && !isLoading && (
        <div className="flex justify-center mt-4">
          <button
            onClick={(e) => { e.stopPropagation(); void onRegenerate(); }}
            className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-indigo-500 transition-colors px-3 py-1 rounded-full hover:bg-indigo-50"
          >
            <RefreshCw className="w-3 h-3" />
            Regenerate Deck
          </button>
        </div>
      )}
    </div>
  );
};
