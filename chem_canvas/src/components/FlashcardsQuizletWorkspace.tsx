import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { extractTextFromPdf } from '../utils/pdfTextExtractor';
import {
  generateFlashcardDeck,
  generateVisionContent,
  type GeneratedFlashcard,
} from '../services/geminiService';
import FlashcardArray from './quizletFlashcards/FlashcardArray';
import { useFlashcardArray } from './quizletFlashcards/useFlashcardArray';
import type { IFlashcard } from './quizletFlashcards/types';

interface FlashcardsQuizletWorkspaceProps {
  fileData?: { mimeType: string; data: string } | null;
  fileContent?: string | null;
  fileName?: string | null;
  topic?: string;
  onBack?: () => void;
}

const CARD_COUNT_OPTIONS = [8, 10, 12, 14, 16, 18, 20];
const FLASHCARD_MODEL = 'gemini-3-pro-preview';

const base64ToFile = (base64: string, mimeType: string, name: string): File => {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new File([byteArray], name, { type: mimeType });
};

export const FlashcardsQuizletWorkspace: React.FC<FlashcardsQuizletWorkspaceProps> = ({
  fileData,
  fileContent,
  fileName,
  topic = '',
  onBack,
}) => {
  const [localTopic, setLocalTopic] = useState(topic);
  const [cardCount, setCardCount] = useState(14);
  const [cards, setCards] = useState<GeneratedFlashcard[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setLocalTopic(topic);
  }, [topic]);

  const fallbackTopic = useMemo(() => {
    if (fileName) {
      return fileName.replace(/\.[^/.]+$/, '');
    }
    return 'Exam preparation';
  }, [fileName]);

  const hasSource = Boolean(fileContent?.trim() || fileData);
  const hasTopicInput = Boolean(localTopic.trim());
  const resolvedTopic = hasTopicInput ? localTopic.trim() : fallbackTopic;

  const buildSourceText = useCallback(async () => {
    if (fileContent?.trim()) {
      return fileContent.trim();
    }
    if (!fileData) {
      return '';
    }

    if (fileData.mimeType === 'application/pdf') {
      setStatus('Extracting text from PDF...');
      const sourceName = fileName || 'assignment.pdf';
      const file = base64ToFile(fileData.data, fileData.mimeType, sourceName);
      const extracted = await extractTextFromPdf(file, 10, true);
      return extracted?.trim() ?? '';
    }

    if (fileData.mimeType.startsWith('image/')) {
      setStatus('Reading text from image...');
      const prompt = 'Extract all readable text from this image for study notes.';
      const extracted = await generateVisionContent(prompt, fileData.data, fileData.mimeType);
      return extracted?.trim() ?? '';
    }

    return '';
  }, [fileContent, fileData, fileName]);

  const handleGenerate = useCallback(async () => {
    if (!hasTopicInput && !hasSource) {
      setError('Add a topic or upload notes to generate flashcards.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatus('Preparing sources...');
    setCards([]);

    try {
      const sourceText = await buildSourceText();
      setStatus('Generating flashcards with Gemini 3 Pro...');

      const deck = await generateFlashcardDeck({
        topic: resolvedTopic || 'Exam preparation',
        count: cardCount,
        learnerLevel: 'intermediate',
        sourceText,
        model: FLASHCARD_MODEL,
        thinking: 'high',
      });

      setCards(deck);
      setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate flashcards.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedTopic, hasSource, cardCount, buildSourceText]);

  const deck = useMemo<IFlashcard[]>(() => {
    return cards.map((card) => {
      const meta = [card.difficulty, card.confidenceTag].filter(Boolean).join(' - ');
      return {
        className: 'quizlet-card',
        front: {
          html: (
            <div className="quizlet-card-face">
              <div className="quizlet-card-accent" />
              <div className="quizlet-card-label">Prompt</div>
              <div className="quizlet-card-text">{card.front}</div>
              {meta && <div className="quizlet-card-meta">{meta}</div>}
              {card.tags?.length ? (
                <div className="quizlet-card-tags">
                  {card.tags.map((tag) => (
                    <span key={tag} className="quizlet-card-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="quizlet-card-hint">Tap to reveal</div>
            </div>
          ),
          style: {
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
          },
        },
        back: {
          html: (
            <div className="quizlet-card-face">
              <div className="quizlet-card-accent" />
              <div className="quizlet-card-label">Answer</div>
              <div className="quizlet-card-text">{card.back}</div>
              {card.mnemonic ? (
                <div className="quizlet-card-subtext">Mnemonic: {card.mnemonic}</div>
              ) : null}
              <div className="quizlet-card-hint">Tap to return</div>
            </div>
          ),
          style: {
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
          },
        },
      };
    });
  }, [cards]);

  const flipArrayHook = useFlashcardArray({
    deckLength: deck.length,
    showControls: true,
    showCount: true,
    showProgressBar: true,
  });

  const canGenerate = Boolean(hasTopicInput || hasSource);

  return (
    <div className="flashcards-workspace flex h-full w-full">
      <aside className="flashcards-sidebar w-80 text-white flex flex-col p-6 gap-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </button>

        <div>
          <h2 className="text-xl font-semibold text-white">Flashcards</h2>
          <p className="text-xs text-slate-400 mt-1">
            Gemini 3 Pro Preview - High thinking
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Topic focus
          </label>
          <input
            type="text"
            value={localTopic}
            onChange={(event) => setLocalTopic(event.target.value)}
            placeholder={fallbackTopic}
            className="flashcards-input w-full rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <p className="text-[11px] text-slate-500">
            Leave empty to use the uploaded file title.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Card count
          </label>
          <div className="grid grid-cols-4 gap-2">
            {CARD_COUNT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCardCount(option)}
                className={`flashcards-count-btn ${option === cardCount ? 'is-active' : ''}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-wider text-[11px] font-semibold">Source</span>
            {fileName ? <span className="text-[11px] text-slate-500">{fileName}</span> : null}
          </div>
          <div className="flashcards-panel rounded-lg p-3">
            {hasSource ? (
              <p className="text-slate-300">
                Using the uploaded notes to ground the flashcards.
              </p>
            ) : (
              <p className="text-slate-500">
                No notes uploaded. Flashcards will be generated from the topic alone.
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!canGenerate || isLoading}
          className={`flashcards-primary-btn mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${!canGenerate || isLoading ? 'is-disabled' : ''}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate flashcards
            </>
          )}
        </button>

        {cards.length > 0 && !isLoading && (
          <button
            onClick={handleGenerate}
            className="flashcards-secondary-btn inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate deck
          </button>
        )}
      </aside>

      <main className="flashcards-stage flex-1 flex flex-col overflow-auto px-6 py-8">
        <div className="flashcards-stage-header">
          <div>
            <p className="flashcards-stage-eyebrow">Deck focus</p>
            <h3 className="flashcards-stage-title">{resolvedTopic || fallbackTopic}</h3>
          </div>
          <div className="flashcards-stage-meta">
            <span className="flashcards-chip">
              {hasSource ? 'Grounded in notes' : 'Topic only'}
            </span>
            <span className="flashcards-chip">
              {deck.length > 0 ? `${deck.length} cards` : `${cardCount} cards`}
            </span>
          </div>
        </div>

        <div className="flashcards-stage-body">
          {isLoading ? (
            <div className="flashcards-status-card">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
              <p className="text-sm font-semibold">{status || 'Generating flashcards...'}</p>
            </div>
          ) : error ? (
            <div className="flashcards-status-card">
              <div className="flashcards-error-icon">!</div>
              <p className="text-sm font-semibold text-slate-700">Unable to generate flashcards</p>
              <p className="text-xs text-slate-500">{error}</p>
            </div>
          ) : deck.length > 0 ? (
            <div className="flex flex-col items-center gap-6">
              <div className="flashcards-deck-shell">
                <FlashcardArray
                  deck={deck}
                  flipArrayHook={flipArrayHook}
                  className="max-w-full"
                  style={{ width: 'min(560px, 90vw)' }}
                />
              </div>
              <p className="text-xs text-slate-500">
                Click a card to flip. Use arrows or keyboard navigation to move between cards.
              </p>
            </div>
          ) : (
            <div className="flashcards-status-card">
              <div className="flashcards-empty-icon">
                <BookOpen className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Ready for a flashcard sprint</p>
              <p className="text-xs text-slate-500">
                Generate a deck from your topic or uploaded notes, then flip through Quizlet-style cards.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FlashcardsQuizletWorkspace;
