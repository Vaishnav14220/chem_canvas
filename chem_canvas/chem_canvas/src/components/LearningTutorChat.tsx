import React, { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Bot, User, Loader2, Copy, Mic, MicOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { extractJsonBlock, generateTextContent, isGeminiInitialized } from '../services/geminiService';
import type { SegmentedOption } from './SegmentedControl';
import { ConnectionState } from './GeminiLive/types';

type TutorMode = 'socratic' | 'feynman';

type TutorResponse = {
  assistant_message_md: string;
  mode: TutorMode;
  next_ui: {
    expected_input: 'free_text' | 'short_steps' | 'teach_back' | 'mcq';
    cta: 'Answer' | 'Try again' | 'Request hint' | 'Show solution' | 'Re-explain';
  };
  evaluation: {
    rubric_id: 'SOC-CORE-v1' | 'FEYN-v1';
    scores: Record<string, number>;
    detected_misconceptions: string[];
    missing_key_ideas: string[];
  };
  tutor_policy: {
    hint_level: number;
    should_switch_mode: boolean;
    switch_reason: string | null;
  };
  citations: Array<{ chunk_id: string; label: string }>;
  telemetry_emit: Array<{ event_name: string; properties: Record<string, any> }>;
};

type TutorMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: TutorResponse | null;
  autoDecision?: AutoDecision | null;
  error?: string | null;
};

type AutoDecision = {
  mode: TutorMode;
  reason: string;
  rule: string;
  switched: boolean;
  manualOverride?: boolean;
};

type GroundingSource = {
  id: string;
  title: string;
  content: string;
};

interface LearningTutorChatProps {
  mode: SegmentedOption;
  onRequireApiKey?: () => void;
  groundingSources?: GroundingSource[];
  onCanvasNote?: (note: string) => void;
  onOpenCanvas?: () => void;
  audioConnectionState?: ConnectionState;
  isListening?: boolean;
  isSpeaking?: boolean;
  onAudioConnect?: () => void;
  onAudioDisconnect?: () => void;
}

const SOCRATIC_PROMPT = `You are a Socratic tutor inside a learning app.

Non-negotiable rules:
1) Ask ONE question at a time. Keep it short.
2) Do NOT provide the full solution unless:
   - the learner has made >= 2 genuine attempts, OR
   - the learner explicitly requests "Show solution".
3) Always diagnose: identify misconceptions and missing prerequisites.
4) Use a hint ladder:
   L0: restate goal / clarify terms
   L1: leading question
   L2: small hint (one idea)
   L3: partial scaffold (fill-in-the-blank steps)
   L4: full solution + explanation + 2 retrieval questions
5) If grounded context is provided, stay consistent with it. If missing, ask a clarifying question rather than guessing.

Output MUST be valid JSON matching the tutor contract. assistant_message_md is learner-facing.`;

const FEYNMAN_PROMPT = `You are a Feynman Technique coach.

Non-negotiable rules:
1) Force teach-back first: the learner explains before you teach.
2) Require simple language: "Explain like I'm 12", short paragraphs, minimal jargon.
3) Detect gaps and misconceptions, then ask the learner to re-explain ONLY the gaps.
4) Provide a revised "gold" explanation only after scoring.
5) End with 2-4 retrieval questions and a one-line spaced repetition plan.

Output MUST be valid JSON matching the tutor contract.`;

const TUTOR_CONTRACT = `{
  "assistant_message_md": "...",
  "mode": "socratic | feynman",
  "next_ui": {
    "expected_input": "free_text | short_steps | teach_back | mcq",
    "cta": "Answer | Try again | Request hint | Show solution | Re-explain"
  },
  "evaluation": {
    "rubric_id": "SOC-CORE-v1 | FEYN-v1",
    "scores": { "dimension": 0 },
    "detected_misconceptions": ["..."],
    "missing_key_ideas": ["..."]
  },
  "tutor_policy": {
    "hint_level": 0,
    "should_switch_mode": false,
    "switch_reason": null
  },
  "citations": [
    { "chunk_id": "rag:chunk_id", "label": "PDF p.12" }
  ],
  "telemetry_emit": [
    { "event_name": "evaluation_created", "properties": { "rubric": "SOC-CORE-v1" } }
  ]
}`;

const HINT_LADDER = [
  { level: 0, label: 'L0 clarify goal' },
  { level: 1, label: 'L1 leading question' },
  { level: 2, label: 'L2 small hint' },
  { level: 3, label: 'L3 scaffold' },
  { level: 4, label: 'L4 full solution' },
];

const MODE_LABELS: Record<TutorMode, string> = {
  socratic: 'Socratic',
  feynman: 'Feynman',
};

const stripMarkdown = (value: string) => {
  return value
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[*_~>#-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const buildCanvasNote = (payload: {
  userInput?: string;
  response?: TutorResponse | null;
  decision?: AutoDecision | null;
}) => {
  const lines: string[] = [];
  if (payload.userInput) {
    lines.push(`Learner: ${stripMarkdown(payload.userInput)}`);
  }
  if (payload.response) {
    lines.push(`${MODE_LABELS[payload.response.mode]} mode`);
    if (payload.decision?.switched) {
      lines.push(`Auto switch: ${payload.decision.reason}`);
    }
    lines.push(`Tutor: ${stripMarkdown(payload.response.assistant_message_md)}`);
    if (payload.response.evaluation.missing_key_ideas.length) {
      lines.push(`Missing: ${payload.response.evaluation.missing_key_ideas.join('; ')}`);
    }
    if (payload.response.evaluation.detected_misconceptions.length) {
      lines.push(`Misconceptions: ${payload.response.evaluation.detected_misconceptions.join('; ')}`);
    }
    lines.push(`Next: ${payload.response.next_ui.cta}`);
  }
  return lines.filter(Boolean).join('\n');
};

const defaultResponse = (mode: TutorMode, hintLevel: number): TutorResponse => ({
  assistant_message_md: 'I had trouble formatting that response. Please try again.',
  mode,
  next_ui: { expected_input: 'free_text', cta: 'Answer' },
  evaluation: {
    rubric_id: mode === 'socratic' ? 'SOC-CORE-v1' : 'FEYN-v1',
    scores: {},
    detected_misconceptions: [],
    missing_key_ideas: [],
  },
  tutor_policy: {
    hint_level: hintLevel,
    should_switch_mode: false,
    switch_reason: null,
  },
  citations: [],
  telemetry_emit: [],
});

const normalizeResponse = (raw: Partial<TutorResponse>, mode: TutorMode, hintLevel: number): TutorResponse => ({
  assistant_message_md: raw.assistant_message_md || defaultResponse(mode, hintLevel).assistant_message_md,
  mode,
  next_ui: {
    expected_input: raw.next_ui?.expected_input || 'free_text',
    cta: raw.next_ui?.cta || 'Answer',
  },
  evaluation: {
    rubric_id: (raw.evaluation?.rubric_id as TutorResponse['evaluation']['rubric_id']) ||
      (mode === 'socratic' ? 'SOC-CORE-v1' : 'FEYN-v1'),
    scores: raw.evaluation?.scores || {},
    detected_misconceptions: raw.evaluation?.detected_misconceptions || [],
    missing_key_ideas: raw.evaluation?.missing_key_ideas || [],
  },
  tutor_policy: {
    hint_level: typeof raw.tutor_policy?.hint_level === 'number' ? raw.tutor_policy.hint_level : hintLevel,
    should_switch_mode: Boolean(raw.tutor_policy?.should_switch_mode),
    switch_reason: raw.tutor_policy?.switch_reason ?? null,
  },
  citations: Array.isArray(raw.citations) ? raw.citations : [],
  telemetry_emit: Array.isArray(raw.telemetry_emit) ? raw.telemetry_emit : [],
});

const getScoreAverage = (scores: Record<string, number> | undefined) => {
  if (!scores) return 0;
  const values = Object.values(scores).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const decideAutoMode = (params: {
  lastEvaluation?: TutorResponse['evaluation'] | null;
  attempts: number;
  hintLevel: number;
  lastMode: TutorMode;
  manualOverride?: TutorMode | null;
}): AutoDecision => {
  if (params.manualOverride) {
    return {
      mode: params.manualOverride,
      reason: 'Manual override selected.',
      rule: 'manual_override',
      switched: params.manualOverride !== params.lastMode,
      manualOverride: true,
    };
  }

  const evaluation = params.lastEvaluation;
  if (!evaluation) {
    return {
      mode: 'socratic',
      reason: 'No prior evaluation. Start with diagnosis.',
      rule: 'default_start',
      switched: params.lastMode !== 'socratic',
    };
  }

  const scoreAverage = getScoreAverage(evaluation.scores);
  const missingCount = evaluation.missing_key_ideas?.length || 0;
  const misconceptionCount = evaluation.detected_misconceptions?.length || 0;
  const stucknessHigh = params.attempts >= 2 && (scoreAverage < 1.3 || params.hintLevel >= 2);
  const correctButShallow = scoreAverage >= 2 && missingCount > 0;
  const objectiveCompleted = scoreAverage >= 2.4 && missingCount === 0 && misconceptionCount === 0;

  if (correctButShallow) {
    return {
      mode: 'feynman',
      reason: 'Correct but shallow explanation. Consolidate with teach-back.',
      rule: 'correct_but_shallow_explanation',
      switched: params.lastMode !== 'feynman',
    };
  }

  if (stucknessHigh) {
    return {
      mode: 'socratic',
      reason: 'Stuckness is high. Use the hint ladder.',
      rule: 'stuckness_high',
      switched: params.lastMode !== 'socratic',
    };
  }

  if (objectiveCompleted) {
    return {
      mode: 'feynman',
      reason: 'Objective completed. Close with teach-back and transfer.',
      rule: 'objective_completed',
      switched: params.lastMode !== 'feynman',
    };
  }

  return {
    mode: 'socratic',
    reason: 'Default to Socratic for diagnosis.',
    rule: 'default',
    switched: params.lastMode !== 'socratic',
  };
};

const buildContextBlock = (sources?: GroundingSource[]) => {
  if (!sources?.length) return '';
  const trimmed = sources
    .filter((source) => source.content && source.content.trim())
    .slice(0, 3)
    .map((source, index) => {
      const chunkId = `doc:${source.id || index + 1}`;
      const snippet = source.content.trim().slice(0, 1600);
      return `Source ${index + 1} (chunk_id: ${chunkId}, label: ${source.title}):\n${snippet}`;
    })
    .join('\n\n');

  if (!trimmed) return '';
  return `Grounded context (use citations when you quote or rely on facts):\n${trimmed}`;
};

const LearningTutorChat: React.FC<LearningTutorChatProps> = ({
  mode,
  onRequireApiKey,
  groundingSources,
  onCanvasNote,
  onOpenCanvas,
  audioConnectionState,
  isListening,
  isSpeaking,
  onAudioConnect,
  onAudioDisconnect,
}) => {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const attemptsRef = useRef(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [lastEvaluation, setLastEvaluation] = useState<TutorResponse['evaluation'] | null>(null);
  const [lastMode, setLastMode] = useState<TutorMode>('socratic');
  const [manualOverride, setManualOverride] = useState<TutorMode | null>(null);

  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const rehypePlugins = useMemo(() => [[rehypeKatex, { strict: false, throwOnError: false, output: 'html' }]] as any, []);
  const isAudioConnected = audioConnectionState === ConnectionState.CONNECTED;
  const isAudioConnecting = audioConnectionState === ConnectionState.CONNECTING;

  const contextBlock = useMemo(() => buildContextBlock(groundingSources), [groundingSources]);

  const resolveMode = () => {
    if (mode === 'socratic' || mode === 'feynman') {
      return {
        decision: null,
        activeMode: mode,
      };
    }
    const decision = decideAutoMode({
      lastEvaluation,
      attempts: attemptsRef.current,
      hintLevel,
      lastMode,
      manualOverride,
    });
    return {
      decision,
      activeMode: decision.mode,
    };
  };

  const buildPrompt = (userInput: string, activeMode: TutorMode, allowFullSolution: boolean) => {
    const promptHeader = activeMode === 'socratic' ? SOCRATIC_PROMPT : FEYNMAN_PROMPT;
    const history = messages
      .slice(-6)
      .map((message) => {
        if (message.role === 'user') {
          return `User: ${message.text}`;
        }
        if (message.response?.assistant_message_md) {
          return `Tutor: ${message.response.assistant_message_md}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');

    return [
      promptHeader,
      `Tutor JSON contract:\n${TUTOR_CONTRACT}`,
      contextBlock,
      `Session state:\n- attempts: ${attemptsRef.current}\n- hint_level: ${hintLevel}\n- allow_full_solution: ${allowFullSolution}\n- required_mode: ${activeMode}`,
      history ? `Conversation history:\n${history}` : '',
      `User input:\n${userInput}`,
      'Return JSON only. Do not include markdown fences or extra text.',
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  const sendMessage = async (userInput: string) => {
    if (!userInput.trim()) return;
    if (!isGeminiInitialized()) {
      onRequireApiKey?.();
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          text: '',
          response: defaultResponse('socratic', hintLevel),
          error: 'API key required. Open Settings to configure Gemini.',
        },
      ]);
      return;
    }

    const { decision, activeMode } = resolveMode();
    const allowFullSolution = userInput.toLowerCase().includes('show solution');
    attemptsRef.current += 1;

    const userMessage: TutorMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: userInput,
    };
    const assistantId = `${Date.now()}-assistant`;
    const assistantMessage: TutorMessage = {
      id: assistantId,
      role: 'assistant',
      text: '',
      response: null,
      autoDecision: decision,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);
    if (onCanvasNote) {
      onOpenCanvas?.();
      onCanvasNote(buildCanvasNote({ userInput }));
    }

    try {
      const prompt = buildPrompt(userInput, activeMode, allowFullSolution);
      const raw = await generateTextContent(prompt, {
        model: 'gemini-3-flash-preview',
        maxOutputTokens: 1200,
      });
      const json = extractJsonBlock(raw);
      const parsed = JSON.parse(json);
      const normalized = normalizeResponse(parsed, activeMode, hintLevel);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                response: normalized,
                autoDecision: decision ? { ...decision, switched: decision.mode !== lastMode } : null,
              }
            : message
        )
      );

      setHintLevel(normalized.tutor_policy.hint_level);
      setLastEvaluation(normalized.evaluation);
      setLastMode(normalized.mode);
      setManualOverride(null);

      if (onCanvasNote) {
        onOpenCanvas?.();
        onCanvasNote(buildCanvasNote({ response: normalized, decision }));
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to generate response.';
      if (errorMessage.toLowerCase().includes('api key')) {
        onRequireApiKey?.();
      }
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, error: errorMessage, response: defaultResponse(activeMode, hintLevel) }
            : message
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleCta = (cta: string) => {
    if (!cta) return;
    setInput(cta);
  };

  const handleOverride = (nextMode: TutorMode) => {
    setManualOverride(nextMode);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col bg-[#171717] text-zinc-100">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Learning Tutor</div>
          <div className="text-[11px] text-zinc-500">Gemini 3 Flash Preview</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (isAudioConnected ? onAudioDisconnect?.() : onAudioConnect?.())}
            disabled={!onAudioConnect && !onAudioDisconnect}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide',
              isAudioConnected
                ? 'border-emerald-500/40 text-emerald-200'
                : 'border-zinc-700 text-zinc-300'
            )}
          >
            {isAudioConnected ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
            {isAudioConnecting ? 'Connecting' : isAudioConnected ? 'Audio On' : 'Audio Off'}
          </button>
          <div className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] uppercase tracking-wide text-zinc-300">
            {mode === 'auto' ? 'Auto' : MODE_LABELS[mode]}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-zinc-500 py-12">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
              <Bot className="h-5 w-5 text-zinc-400" />
            </div>
            <div className="text-sm font-medium text-zinc-200">Start a learning session</div>
            <div className="text-xs mt-1 max-w-xs">
              Ask a question or explain a concept. The tutor will respond using Socratic or Feynman coaching.
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="space-y-3">
            <div className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('flex max-w-[90%] gap-3', message.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-sm bg-zinc-800 text-zinc-400">
                  {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div className={cn('rounded-2xl px-4 py-3', message.role === 'user' ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-900/70 text-zinc-100')}>
                  {message.role === 'user' && <div className="text-sm whitespace-pre-wrap">{message.text}</div>}
                  {message.role === 'assistant' && message.response && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-full border border-zinc-700 px-2 py-0.5 uppercase tracking-wide">
                          {MODE_LABELS[message.response.mode]}
                        </span>
                        {message.autoDecision?.switched && (
                          <span className="rounded-full border border-cyan-500/40 px-2 py-0.5 text-cyan-200">
                            Switched in Auto
                          </span>
                        )}
                      </div>

                      <div className="prose max-w-none prose-invert text-zinc-100 [&_p]:mb-4 last:[&_p]:mb-0">
                        <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
                          {message.response.assistant_message_md}
                        </ReactMarkdown>
                      </div>

                      {message.autoDecision?.switched && (
                        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100">
                          Switched to {MODE_LABELS[message.autoDecision.mode]} because {message.autoDecision.reason}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleOverride('socratic')}
                              className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
                            >
                              Override: Socratic
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOverride('feynman')}
                              className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
                            >
                              Override: Feynman
                            </button>
                          </div>
                        </div>
                      )}

                      {message.response.mode === 'socratic' && (
                        <div className="flex flex-wrap gap-2 text-[10px] text-zinc-400">
                          {HINT_LADDER.map((hint) => (
                            <span
                              key={hint.level}
                              className={cn(
                                'rounded-full border px-2 py-0.5',
                                hint.level === message.response?.tutor_policy.hint_level
                                  ? 'border-amber-500/60 text-amber-200'
                                  : 'border-zinc-700'
                              )}
                            >
                              {hint.label}
                            </span>
                          ))}
                        </div>
                      )}

                      {message.response.citations?.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-[10px] text-zinc-400">
                          {message.response.citations.map((citation) => (
                            <span
                              key={citation.chunk_id}
                              className="rounded-full border border-zinc-700 px-2 py-0.5"
                            >
                              {citation.label}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-400">
                        <div className="font-semibold text-zinc-300">Evaluation</div>
                        <div>Rubric: {message.response.evaluation.rubric_id}</div>
                        <div className="mt-2 grid gap-1">
                          {Object.entries(message.response.evaluation.scores).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between">
                              <span>{key}</span>
                              <span className="text-zinc-200">{value}</span>
                            </div>
                          ))}
                        </div>
                        {(message.response.evaluation.missing_key_ideas.length > 0 ||
                          message.response.evaluation.detected_misconceptions.length > 0) && (
                          <div className="mt-2 space-y-1">
                            {message.response.evaluation.missing_key_ideas.length > 0 && (
                              <div>Missing: {message.response.evaluation.missing_key_ideas.join(', ')}</div>
                            )}
                            {message.response.evaluation.detected_misconceptions.length > 0 && (
                              <div>Misconceptions: {message.response.evaluation.detected_misconceptions.join(', ')}</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                        <div>Next input: {message.response.next_ui.expected_input}</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleCta(message.response?.next_ui?.cta)}
                            className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
                          >
                            <Copy className="h-3 w-3" />
                            {message.response.next_ui.cta}
                          </button>
                          {message.response.mode === 'socratic' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCta('Request hint')}
                                className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
                              >
                                Request hint
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCta('Show solution')}
                                className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
                              >
                                Show solution
                              </button>
                            </>
                          )}
                          {message.response.mode === 'feynman' && (
                            <button
                              type="button"
                              onClick={() => handleCta('Re-explain the gaps')}
                              className="rounded-full border border-zinc-700 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800"
                            >
                              Re-explain gaps
                            </button>
                          )}
                        </div>
                      </div>
                      {(isListening || isSpeaking) && (
                        <div className="text-[11px] text-emerald-300">
                          {isListening && 'Audio listening'}
                          {isListening && isSpeaking && ' - '}
                          {isSpeaking && 'Audio speaking'}
                        </div>
                      )}
                    </div>
                  )}
                  {message.error && (
                    <div className="mt-2 text-xs text-rose-300">Error: {message.error}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating coach response...
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a question or explain your thinking..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none min-h-[40px]"
            rows={1}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                (event.currentTarget.form as HTMLFormElement)?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-xl bg-zinc-100 text-zinc-900 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <div className="mt-2 text-[10px] text-zinc-600">
          Socratic mode asks one question at a time. Feynman mode scores teach-back and fills gaps.
        </div>
      </form>
    </div>
  );
};

export default LearningTutorChat;
