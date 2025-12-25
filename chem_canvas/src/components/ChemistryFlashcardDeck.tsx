import React, { useState, useEffect } from 'react';
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

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      setInternalIsFlipped(false);
      setTimeout(() => {
        setInternalIndex((prev) => (prev + 1) % cards.length);
      }, 300);
    }
  };

  const handlePrev = () => {
    if (onPrevious) {
      onPrevious();
    } else {
      setInternalIsFlipped(false);
      setTimeout(() => {
        setInternalIndex((prev) => (prev - 1 + cards.length) % cards.length);
      }, 300);
    }
  };

  const handleFlip = () => {
    if (onFlip) {
      onFlip();
    } else {
      setInternalIsFlipped(!internalIsFlipped);
    }
  };

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
        className="flex-1 perspective-1000 relative min-h-[300px] cursor-pointer group"
        onClick={handleFlip}
      >
        <motion.div
          className="w-full h-full relative preserve-3d transition-all duration-500"
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div className="absolute inset-0 backface-hidden bg-white border-2 border-indigo-100/80 rounded-2xl shadow-sm flex flex-col items-center justify-center p-8 text-center hover:shadow-md hover:border-indigo-200 transition-all">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4">Term</span>
            <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">{currentCard?.front}</h3>
            <p className="absolute bottom-6 text-xs text-slate-400 font-medium group-hover:text-indigo-400 transition-colors">Click to flip</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 backface-hidden bg-gradient-to-br from-indigo-50 to-white border-2 border-indigo-200 rounded-2xl shadow-md flex flex-col items-center justify-center p-8 text-center"
            style={{ transform: 'rotateY(180deg)' }}
          >
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-4">Definition</span>
            <div className="prose prose-sm max-w-none">
              <p className="text-base md:text-lg text-slate-700 leading-relaxed font-medium">{currentCard?.back}</p>
            </div>
            {onNext && (
              <p className="absolute bottom-6 text-xs text-indigo-400/60 font-medium">Click to flip back</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-6 px-4">
        <button
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
          disabled={cards.length <= 1 || isLoading}
          title="Previous card"
        >
          <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        <div className="flex flex-col items-center">
          <span className="text-sm font-medium text-slate-700">
            {currentIndex + 1} <span className="text-slate-400">/</span> {cards.length}
          </span>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Card</span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
          disabled={cards.length <= 1 || isLoading}
          title="Next card"
        >
          <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
        </button>
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
