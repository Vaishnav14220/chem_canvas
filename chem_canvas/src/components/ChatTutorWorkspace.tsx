import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ImagePlus, Plus, Send, StickyNote, LayoutGrid, Paintbrush, LineChart, Sigma, Mic } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { v4 as uuidv4 } from 'uuid';
import { generateTextContent, streamTextContent } from '../services/geminiService';
import { ExcalidrawCanvas, type ExcalidrawCanvasRef } from './ExcalidrawCanvas';
import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import { getPreferredGeminiLanguage } from '../utils/geminiPreferences';
import { useGeminiLive } from './GeminiLive/hooks/useGeminiLive';
import { ConnectionState } from './GeminiLive/types';
import GeminiLiveVoiceStatus from './GeminiLive/GeminiLiveVoiceStatus';

const GEOGEBRA_SCRIPT_URL = 'https://www.geogebra.org/apps/deployggb.js';
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const MAX_HISTORY = 12;

type PageType = 'note' | 'mermaid' | 'ggb';

type Page = {
  id: string;
  title: string;
  type: PageType;
  content: string;
  notes: string;
};

type Attachment = {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'action';
  content: string;
  attachments?: Attachment[];
  actionType?: 'create' | 'update';
  pageType?: PageType;
  pageId?: string;
};

type Block = {
  type: 'mermaid' | 'ggbscript' | 'note';
  pageId: string;
  title?: string;
  content: string;
};

type ChatTutorWorkspaceProps = {
  onBack: () => void;
  initialTopic?: string;
  initialNotes?: string;
  model?: string;
};

const SYSTEM_PROMPT = [
  'You are a professional and rigorous STEM tutor with a digital whiteboard. The whiteboard has multiple pages. Use it naturally while teaching.',
  '',
  'WHITEBOARD RULES',
  '- Pages have a unique page id and a short title (under 20 characters).',
  '- Page ids must use only ASCII letters, digits, and underscores.',
  '- Use the tools below to create or update pages.',
  '- Keep explanations in plain text outside tool blocks.',
  '',
  'DOMAIN FORMATTING',
  '- Chemistry: include a reaction scheme and conditions when relevant.',
  '  Format:',
  '  Reaction:',
  '  Reactant(s) -> Product(s)',
  '  Conditions: solvent, catalyst, temperature.',
  '  Mechanism: numbered steps with brief arrow descriptions.',
  '  Use simple LaTeX for formulas, e.g., $CH_3CHO$, and avoid mhchem.',
  '- Math: show equations in LaTeX and list steps in order.',
  '- Coding: use fenced code blocks with a language tag.',
  '',
  'TOOLS',
  '1) Mermaid page (diagram)',
  '```mermaid[page_id;page_title]',
  'flowchart LR',
  'A[Start] --> B[Step]',
  '```',
  '',
  '2) GeoGebra page (interactive math)',
  '- Use GeoGebra command syntax with square brackets, not parentheses.',
  '```ggbscript[page_id;page_title]',
  'A=(0,0)',
  'B=(3,4)',
  'Line[A,B]',
  'f(x)=sin(x)',
  'Tangent[Point(f,0), f]',
  'Asymptote[f]',
  '```',
  '',
  '3) Page notes (short steps + key results)',
  '```note[page_id]',
  '### Key Steps',
  '1. Step and why it matters.',
  '2. Step and why it matters.',
  '### Key Results',
  '- Optional formulas or outcomes.',
  '```',
  '',
  'TEACHING STYLE',
  '- Be clear, step-by-step, and verify results.',
  '- Use the whiteboard when it helps understanding.',
  '- Prefer diagrams, graphs, and short notes over long lists.',
  '- If the student question is unclear, ask a brief clarifying question.',
].join('\n');

const buildPrompt = (history: Message[], input: string, pages: Page[], initialNotes?: string, initialTopic?: string) => {
  const recent = history.filter((message) => message.role !== 'action').slice(-MAX_HISTORY);
  const conversation = recent
    .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  const pageSummary = pages.length
    ? pages
        .map((page) => `- ${page.id} (${page.type}) "${page.title}"`)
        .join('\n')
    : 'None';

  const trimmedNotes = initialNotes?.trim().slice(0, 8000);
  const notesBlock = trimmedNotes
    ? `\nReference notes:\n${trimmedNotes}\n`
    : '';

  const topicBlock = initialTopic?.trim()
    ? `\nTopic focus: ${initialTopic.trim()}\n`
    : '';

  return `${SYSTEM_PROMPT}\n\nCurrent pages:\n${pageSummary}${topicBlock}${notesBlock}\nConversation:\n${conversation}\n\nUser: ${input}\nAssistant:`;
};

const parseBlocks = (text: string): { cleaned: string; blocks: Block[] } => {
  const regex = /```(mermaid|ggbscript|note)\[([^\];\n]+)(?:;([^\]\n]+))?\]\s*([\s\S]*?)```/g;
  const blocks: Block[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      type: match[1] as Block['type'],
      pageId: match[2].trim(),
      title: match[3]?.trim(),
      content: match[4].trim(),
    });
  }

  const cleaned = text.replace(regex, '').replace(/\n{3,}/g, '\n\n');
  return { cleaned, blocks };
};

const normalizePageId = (value: string) => value.trim().replace(/[^A-Za-z0-9_]/g, '_');
const normalizeTitle = (value: string, fallback: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return fallback.slice(0, 20);
  return trimmed.slice(0, 20);
};

const normalizeGgbScript = (script: string) => {
  return script
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const tangentMatch = trimmed.match(/^Tangent\s*\((.*)\)\s*$/);
      if (tangentMatch) {
        return `Tangent[${tangentMatch[1]}]`;
      }
      const asymptoteMatch = trimmed.match(/^Asymptote\s*\((.*)\)\s*$/);
      if (asymptoteMatch) {
        return `Asymptote[${asymptoteMatch[1]}]`;
      }
      return line;
    })
    .join('\n');
};

const buildAutoNotesPrompt = (input: {
  page: Page;
  assistantText: string;
  topic?: string;
}) => {
  const context = [
    `Page title: ${input.page.title || input.page.id}`,
    `Page type: ${input.page.type}`,
    input.page.content ? `Page content:\n${input.page.content}` : '',
    input.topic ? `Topic: ${input.topic}` : '',
    `Assistant explanation:\n${input.assistantText}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return [
    'You are creating page notes for a tutoring whiteboard.',
    'Return Markdown notes that fit in a narrow sidebar.',
    'Start with a short title line using "### ".',
    'Then provide 3-6 numbered steps (1., 2., ...) with the action and why it matters.',
    'If a formula or final result is essential, add a "### Key Results" section with bullets.',
    'If the content is chemistry, include a short "### Reaction" line and a "Conditions:" line.',
    'Only use LaTeX when essential, and keep it simple and balanced like $f(x)=sin(x)$.',
    'Do not include extra prose outside the notes format.',
    '',
    context,
  ].join('\n');
};

const sanitizeNotesMarkdown = (raw: string) => {
  let text = raw.replace(/\r/g, '').trim();
  if (!text) return '';
  text = text.replace(/```/g, '').replace(/\n{3,}/g, '\n\n').trim();
  const dollarMatches = text.match(/(^|[^\\])\$/g);
  if (dollarMatches && dollarMatches.length % 2 === 1) {
    text = text.replace(/\$/g, '');
  }
  return text.trim();
};

const hasListLines = (text: string) => {
  return text
    .split('\n')
    .some((line) => /^(\d+\.|\-|\*)\s+/.test(line.trim()));
};

const hasHeadingLines = (text: string) => {
  return text
    .split('\n')
    .some((line) => /^#{1,6}\s+/.test(line.trim()));
};

const ensureSentencePeriod = (line: string) => (line.endsWith('.') ? line : `${line}.`);

const ensureNumberedSteps = (text: string) => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const preserved: string[] = [];
  const narrative: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('###')) {
      preserved.push(line);
      return;
    }
    if (/^(reaction|conditions|mechanism)\s*:/i.test(line)) {
      preserved.push(line);
      return;
    }
    narrative.push(line);
  });

  const sentences = narrative
    .join(' ')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map(ensureSentencePeriod);

  if (sentences.length === 0) return text;

  const steps = [
    '### Key Steps',
    ...sentences.map((line, index) => `${index + 1}. ${line}`)
  ];

  return [...steps, ...preserved].join('\n');
};

const normalizeNotes = (raw: string) => {
  const cleaned = sanitizeNotesMarkdown(raw);
  if (!cleaned) return '';
  if (!hasListLines(cleaned)) {
    return ensureNumberedSteps(cleaned);
  }
  if (hasHeadingLines(cleaned) || hasListLines(cleaned)) return cleaned;

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map(ensureSentencePeriod);

  if (sentences.length === 0) return cleaned;
  return sentences.map((line, index) => `${index + 1}. ${line}`).join('\n');
};

const countListItems = (notes: string) => {
  return notes
    .split('\n')
    .filter((line) => /^(\d+\.|\-|\*)\s+/.test(line.trim()))
    .length;
};

const buildFallbackNotesPrompt = (input: {
  page: Page;
  assistantText: string;
  topic?: string;
}) => {
  const context = [
    `Page title: ${input.page.title || input.page.id}`,
    `Page type: ${input.page.type}`,
    input.page.content ? `Page content:\n${input.page.content}` : '',
    input.topic ? `Topic: ${input.topic}` : '',
    `Assistant explanation:\n${input.assistantText}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return [
    'Write study notes in plain English.',
    'Start with "### Key Steps".',
    'Return 4-8 numbered steps describing the action and why it matters.',
    'Add a "### Key Results" section with bullets if a result or formula is essential.',
    'If the content is chemistry, add a "### Reaction" line and a "Conditions:" line.',
    'Keep the format compact and avoid extra prose.',
    '',
    context,
  ].join('\n');
};

const is3dScript = (script: string) => {
  const text = script.toLowerCase();
  if (/\(([^,\n]+),([^,\n]+),([^)\n]+)\)/.test(text)) return true;
  return /(surface|sphere|cone|cylinder|plane|curve|vector3d|point3d|z\s*=|z=)/i.test(text);
};

const ensureGeoGebraScript = () => {
  if ((window as any).GGBApplet) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GEOGEBRA_SCRIPT_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GeoGebra script failed to load.')));
      return;
    }

    const script = document.createElement('script');
    script.src = GEOGEBRA_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('GeoGebra script failed to load.')));
    document.body.appendChild(script);
  });
};

const GeoGebraPage: React.FC<{ pageId: string; script: string }> = ({ pageId, script }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<any>(null);
  const executedRef = useRef('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>(is3dScript(script) ? '3d' : '2d');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const inferred = is3dScript(script) ? '3d' : '2d';
    setViewMode(inferred);
  }, [script]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        setLoading(true);
        await ensureGeoGebraScript();
        if (!isMounted || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        executedRef.current = '';
        setReady(false);

        const rect = containerRef.current.getBoundingClientRect();
        const width = Math.max(320, Math.floor(rect.width || 640));
        const height = Math.max(240, Math.floor(rect.height || 480));

        const params = {
          id: `ggb-${pageId}`,
          appName: viewMode === '3d' ? '3d' : 'graphing',
          width,
          height,
          showToolBar: true,
          showMenuBar: false,
          showAlgebraInput: true,
          enableRightClick: true,
          enableShiftDragZoom: true,
          showZoomButtons: true,
          appletOnLoad: (api: any) => {
            if (!isMounted) return;
            appRef.current = api;
            setReady(true);
            setLoading(false);
          },
        };

        const applet = new (window as any).GGBApplet(params, true);
        applet.inject(containerRef.current);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'GeoGebra failed to load.');
        setLoading(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      appRef.current = null;
      setReady(false);
    };
  }, [pageId, viewMode]);

  useEffect(() => {
    if (!ready || !appRef.current) return;
    const normalized = script.replace(/\r/g, '').trim();
    if (!normalized) return;

    let delta = normalized;
    if (executedRef.current && normalized.startsWith(executedRef.current)) {
      delta = normalized.slice(executedRef.current.length);
    }

    const commands = delta
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    commands.forEach((cmd) => {
      try {
        appRef.current?.evalCommand(cmd);
      } catch (err) {
        console.warn('GeoGebra command failed:', err);
      }
    });

    executedRef.current = normalized;
  }, [ready, script]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50 text-sm text-rose-600">
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
        <button
          type="button"
          onClick={() => setViewMode('2d')}
          className={`rounded-full px-2 py-1 transition ${viewMode === '2d' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}
        >
          2D
        </button>
        <button
          type="button"
          onClick={() => setViewMode('3d')}
          className={`rounded-full px-2 py-1 transition ${viewMode === '3d' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}
        >
          3D
        </button>
      </div>
      {loading && (
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-white/70 text-xs font-semibold text-slate-500">
          Loading GeoGebra {viewMode.toUpperCase()}…
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
};

const MermaidPage: React.FC<{ code: string }> = ({ code }) => {
  const excalidrawRef = useRef<ExcalidrawCanvasRef>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    const attempts = [150, 400, 800];

    const draw = async (delay: number) => {
      if (cancelled) return;
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (cancelled || !excalidrawRef.current) return;
      excalidrawRef.current.clearCanvas();
      void excalidrawRef.current.drawMermaid(code);
    };

    attempts.forEach((delay) => void draw(delay));

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <ExcalidrawCanvas
      ref={excalidrawRef}
      isOpen
      embedded
      onClose={() => undefined}
      className="h-full w-full"
      title="Mermaid Diagram"
    />
  );
};

const NotePage: React.FC<{ content: string }> = ({ content }) => (
  <div className="h-full w-full overflow-auto rounded-xl bg-white p-6 text-sm text-slate-700 shadow-inner">
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {content || 'No notes yet. Ask the tutor to add notes to this page.'}
    </ReactMarkdown>
  </div>
);

const ChatTutorWorkspace: React.FC<ChatTutorWorkspaceProps> = ({
  onBack,
  initialTopic,
  initialNotes,
  model = DEFAULT_MODEL,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [voiceChatApiKey, setVoiceChatApiKey] = useState('');
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const processedBlocksRef = useRef(new Set<string>());
  const processedActionsRef = useRef(new Set<string>());
  const autoNotesGeneratedRef = useRef(new Set<string>());
  const autoNotesRunningRef = useRef(false);
  const autoNotesQueueRef = useRef<Set<string>>(new Set());
  const pagesRef = useRef<Page[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentPage = useMemo(() => pages.find((page) => page.id === currentPageId) || pages[0], [pages, currentPageId]);
  const preferredGeminiLanguage = getPreferredGeminiLanguage();
  const geminiLive = useGeminiLive(voiceChatApiKey, preferredGeminiLanguage, {
    systemInstructionOverride: `You are the ChatTutor voice assistant. Keep responses concise and instructional.
Focus on helping the student solve problems step-by-step, and ask a brief follow-up question when needed.
If the student requests a visual, suggest adding it to the whiteboard.`,
  });

  useEffect(() => {
    let isActive = true;
    getSharedGeminiApiKey().then((key) => {
      if (isActive) setVoiceChatApiKey(key || '');
    });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (geminiLive.connectionState === ConnectionState.CONNECTED || geminiLive.connectionState === ConnectionState.CONNECTING) {
        geminiLive.disconnect();
      }
    };
  }, [geminiLive]);

  const updatePages = useCallback((updater: (prev: Page[]) => Page[]) => {
    setPages((prev) => {
      const next = updater(prev);
      pagesRef.current = next;
      return next;
    });
  }, []);

  const ensurePage = useCallback((pageId: string, type: PageType, title?: string) => {
    const normalizedId = normalizePageId(pageId) || `page_${pagesRef.current.length + 1}`;
    const normalizedTitle = normalizeTitle(title || normalizedId, normalizedId);
    const existed = pagesRef.current.some((page) => page.id === normalizedId);

    updatePages((prev) => {
      const existingIndex = prev.findIndex((page) => page.id === normalizedId);
      if (existingIndex === -1) {
        const next = [...prev, {
          id: normalizedId,
          title: normalizedTitle,
          type,
          content: '',
          notes: '',
        }];
        if (!currentPageId) {
          setCurrentPageId(normalizedId);
        }
        return next;
      }

      const next = [...prev];
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        type,
        title: existing.title || normalizedTitle,
      };
      return next;
    });

    return { id: normalizedId, created: !existed };
  }, [currentPageId, updatePages]);

  const appendPageNotes = useCallback((pageId: string, noteContent: string) => {
    const normalizedNotes = normalizeNotes(noteContent);
    if (!normalizedNotes) return;
    updatePages((prev) => {
      const normalizedId = normalizePageId(pageId);
      const index = prev.findIndex((page) => page.id === normalizedId);
      if (index === -1) {
        return [...prev, {
          id: normalizedId,
          title: normalizeTitle(normalizedId, normalizedId),
          type: 'note',
          content: '',
          notes: normalizedNotes,
        }];
      }

      const next = [...prev];
      const existing = next[index];
      const combined = existing.notes ? `${existing.notes}\n\n${normalizedNotes}` : normalizedNotes;
      next[index] = {
        ...existing,
        notes: combined,
        content: existing.type === 'note' ? combined : existing.content,
      };
      return next;
    });
  }, [updatePages]);

  const updatePageContent = useCallback((pageId: string, type: PageType, content: string, title?: string) => {
    updatePages((prev) => {
      const normalizedId = normalizePageId(pageId);
      const normalizedTitle = normalizeTitle(title || normalizedId, normalizedId);
      const index = prev.findIndex((page) => page.id === normalizedId);
      if (index === -1) {
        return [...prev, {
          id: normalizedId,
          title: normalizedTitle,
          type,
          content,
          notes: '',
        }];
      }

      const next = [...prev];
      const existing = next[index];
      const nextContent = type === 'ggb' && existing.content
        ? `${existing.content}\n${content}`
        : content;
      next[index] = {
        ...existing,
        title: existing.title || normalizedTitle,
        type,
        content: nextContent,
      };
      return next;
    });
  }, [updatePages]);

  const pushAction = useCallback((message: Message) => {
    const key = `${message.actionType}:${message.pageType}:${message.pageId}:${message.content}`;
    if (processedActionsRef.current.has(key)) return;
    processedActionsRef.current.add(key);
    setMessages((prev) => [...prev, message]);
  }, []);

  const queueAutoNotes = useCallback((pageId: string) => {
    autoNotesQueueRef.current.add(pageId);
  }, []);

  const applyBlocks = useCallback((blocks: Block[]) => {
    blocks.forEach((block) => {
      const key = `${block.type}:${block.pageId}:${block.content}`;
      if (processedBlocksRef.current.has(key)) return;
      processedBlocksRef.current.add(key);

      if (block.type === 'note') {
        const normalizedId = normalizePageId(block.pageId);
        const existed = pagesRef.current.some((page) => page.id === normalizedId);
        appendPageNotes(normalizedId, block.content);
        pushAction({
          id: uuidv4(),
          role: 'action',
          content: existed ? `Updated notes on ${normalizedId}` : 'Created a canvas page',
          actionType: existed ? 'update' : 'create',
          pageType: 'note',
          pageId: normalizedId,
        });
        return;
      }

      if (block.type === 'mermaid') {
        const result = ensurePage(block.pageId, 'mermaid', block.title);
        updatePageContent(result.id, 'mermaid', block.content, block.title);
        setCurrentPageId(result.id);
        queueAutoNotes(result.id);
        pushAction({
          id: uuidv4(),
          role: 'action',
          content: result.created ? 'Created a mermaid page' : `Painted on ${result.id}`,
          actionType: result.created ? 'create' : 'update',
          pageType: 'mermaid',
          pageId: result.id,
        });
        return;
      }

      if (block.type === 'ggbscript') {
        const result = ensurePage(block.pageId, 'ggb', block.title);
        updatePageContent(result.id, 'ggb', normalizeGgbScript(block.content), block.title);
        setCurrentPageId(result.id);
        queueAutoNotes(result.id);
        pushAction({
          id: uuidv4(),
          role: 'action',
          content: result.created ? 'Created a GeoGebra page' : `Painted on ${result.id}`,
          actionType: result.created ? 'create' : 'update',
          pageType: 'ggb',
          pageId: result.id,
        });
      }
    });
  }, [appendPageNotes, ensurePage, pushAction, queueAutoNotes, updatePageContent]);

  useEffect(() => {
    if (!initialNotes?.trim()) return;
    if (pagesRef.current.length > 0) return;

    const seededId = 'source_notes';
    updatePages((prev) => [...prev, {
      id: seededId,
      title: 'Source Notes',
      type: 'note',
      content: initialNotes.trim(),
      notes: '',
    }]);
    setCurrentPageId(seededId);
  }, [initialNotes, updatePages]);

  const drainAutoNotes = useCallback(async (assistant: Message, fallbackText?: string) => {
    if (autoNotesRunningRef.current) return;
    autoNotesRunningRef.current = true;

    try {
      while (autoNotesQueueRef.current.size > 0) {
        const [pageId] = autoNotesQueueRef.current;
        autoNotesQueueRef.current.delete(pageId);

        const page = pagesRef.current.find((item) => item.id === pageId);
        if (!page || page.type === 'note' || page.notes.trim()) continue;

        const key = `${assistant.id}:${page.id}`;
        if (autoNotesGeneratedRef.current.has(key)) continue;

        const assistantText = assistant.content.trim().slice(0, 2200);
        const fallbackContext = fallbackText?.trim() || page.content.trim();
        const promptAssistantText = assistantText || fallbackContext;
        if (!promptAssistantText) continue;

        const prompt = buildAutoNotesPrompt({
          page,
          assistantText: promptAssistantText,
          topic: initialTopic,
        });

        let response = await generateTextContent(prompt, {
          model,
          maxOutputTokens: 320,
          applyPreferences: false,
        });

        let normalized = normalizeNotes(response);
        if (countListItems(normalized) < 3) {
          response = await generateTextContent(buildFallbackNotesPrompt({
            page,
            assistantText: promptAssistantText,
            topic: initialTopic,
          }), {
            model,
            maxOutputTokens: 320,
            applyPreferences: false,
          });
          normalized = normalizeNotes(response);
        }
        if (countListItems(normalized) < 3) continue;

        appendPageNotes(page.id, normalized);
        autoNotesGeneratedRef.current.add(key);
      }
    } catch (error) {
      console.warn('Auto notes generation failed:', error);
    } finally {
      autoNotesRunningRef.current = false;
    }
  }, [appendPageNotes, initialTopic, model]);

  useEffect(() => {
    if (isStreaming || autoNotesQueueRef.current.size === 0) return;
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.content.trim());
    if (!lastAssistant) return;
    const lastUser = [...messages].reverse().find((message) => message.role === 'user' && message.content.trim());
    void drainAutoNotes(lastAssistant, lastUser?.content);
  }, [drainAutoNotes, isStreaming, messages]);

  useEffect(() => {
    if (isStreaming) return;
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.content.trim());
    if (!lastAssistant) return;
    const targetPage = currentPage || pagesRef.current.find((page) => page.type !== 'note');
    if (!targetPage || targetPage.type === 'note') return;
    if (targetPage.notes.trim()) return;
    const key = `${lastAssistant.id}:${targetPage.id}`;
    if (autoNotesGeneratedRef.current.has(key)) return;
    autoNotesQueueRef.current.add(targetPage.id);
    const lastUser = [...messages].reverse().find((message) => message.role === 'user' && message.content.trim());
    void drainAutoNotes(lastAssistant, lastUser?.content);
  }, [currentPage, drainAutoNotes, isStreaming, messages]);

  const handleAddPage = () => {
    const pageId = `page_${pages.length + 1}`;
    const title = `Page ${pages.length + 1}`;
    updatePages((prev) => [...prev, {
      id: pageId,
      title,
      type: 'note',
      content: '',
      notes: '',
    }]);
    setCurrentPageId(pageId);
    pushAction({
      id: uuidv4(),
      role: 'action',
      content: 'Created a canvas page',
      actionType: 'create',
      pageType: 'note',
      pageId,
    });
  };

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files) return;

    const newItems: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.readAsDataURL(file);
      });

      newItems.push({
        id: uuidv4(),
        name: file.name,
        dataUrl,
        mimeType: file.type,
      });
    }

    setAttachments((prev) => [...prev, ...newItems]);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      attachments,
    };

    const assistantId = uuidv4();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setAttachments([]);
    setIsStreaming(true);

    let rawText = '';

    const prompt = buildPrompt(messages.concat(userMessage), userMessage.content, pagesRef.current, initialNotes, initialTopic);

    const inlineDataList = userMessage.attachments?.map((attachment) => ({
      mimeType: attachment.mimeType,
      data: attachment.dataUrl.split(',')[1],
    }));

    try {
      await streamTextContent(
        prompt,
        (chunk) => {
          rawText += chunk;
          const { cleaned, blocks } = parseBlocks(rawText);
          applyBlocks(blocks);
          setMessages((prev) => prev.map((msg) => (
            msg.id === assistantId ? { ...msg, content: cleaned } : msg
          )));
        },
        {
          model,
          applyPreferences: false,
          inlineDataList,
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate response.';
      setMessages((prev) => prev.map((msg) => (
        msg.id === assistantId ? { ...msg, content: message } : msg
      )));
    } finally {
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void handleSend();
    }
  };

  const renderPage = () => {
    if (!currentPage) {
      return (
        <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
          Ask the tutor to create a page, or add one with the + button.
        </div>
      );
    }

    if (currentPage.type === 'mermaid') {
      return <MermaidPage code={currentPage.content} />;
    }

    if (currentPage.type === 'ggb') {
      return <GeoGebraPage pageId={currentPage.id} script={currentPage.content} />;
    }

    return <NotePage content={currentPage.content} />;
  };

  const renderNotesPanel = () => (
    <div className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <StickyNote className="h-3.5 w-3.5" />
        Page Notes
      </div>
      <div className="prose prose-sm mt-3 flex-1 max-w-none overflow-auto text-slate-700">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
          {currentPage?.notes?.trim() || 'No notes yet.'}
        </ReactMarkdown>
      </div>
    </div>
  );

  const actionIcon = (message: Message) => {
    if (message.pageType === 'ggb') return <Sigma className="h-4 w-4 text-indigo-500" />;
    if (message.pageType === 'mermaid') return <LineChart className="h-4 w-4 text-indigo-500" />;
    return <Paintbrush className="h-4 w-4 text-indigo-500" />;
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-800">ChatTutor Whiteboard</p>
            <p className="text-xs text-slate-500">Model: {model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddPage}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300"
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            New Page
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {currentPage?.type === 'ggb' || currentPage?.type === 'mermaid' ? (
              <div className="flex min-h-0 flex-1 gap-3">
                <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {renderPage()}
                </div>
                <div className="w-full max-w-xs min-w-[220px]">
                  {renderNotesPanel()}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {renderPage()}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <LayoutGrid className="h-3.5 w-3.5" />
              Pages
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {pages.map((page, index) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setCurrentPageId(page.id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    currentPage?.id === page.id
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <span className="uppercase">{page.type}</span>
                  <span className="truncate">{page.title || page.id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex w-full max-w-md flex-col border-l border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Tutor Chat</div>
              <button
                type="button"
                onClick={() => setShowVoicePanel((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                <Mic className="h-3.5 w-3.5" />
                Live Audio
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {showVoicePanel && (
              <div className="mb-4">
                <GeminiLiveVoiceStatus
                  isListening={geminiLive.isListening}
                  isSpeaking={geminiLive.isSpeaking}
                  isConnected={geminiLive.connectionState === ConnectionState.CONNECTED}
                  isConnecting={geminiLive.connectionState === ConnectionState.CONNECTING}
                  onToggleConnection={() => {
                    if (geminiLive.connectionState === ConnectionState.CONNECTED || geminiLive.connectionState === ConnectionState.CONNECTING) {
                      geminiLive.disconnect();
                    } else {
                      geminiLive.connect();
                    }
                  }}
                  isButtonDisabled={!voiceChatApiKey}
                  error={geminiLive.error}
                />
              </div>
            )}
            {messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                Ask a question and the tutor will respond with whiteboard actions.
              </div>
            )}
            <div className="space-y-4">
              {messages.map((message) => (
                message.role === 'action' ? (
                  <div
                    key={message.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                  >
                    <div className="flex items-center gap-2">
                      {actionIcon(message)}
                      <span className="font-semibold text-slate-700">{message.content}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    key={message.id}
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-indigo-50 text-indigo-900'
                        : 'bg-slate-50 text-slate-800'
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {message.content}
                    </ReactMarkdown>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.attachments.map((attachment) => (
                          <img
                            key={attachment.id}
                            src={attachment.dataUrl}
                            alt={attachment.name}
                            className="h-12 w-12 rounded-md object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 p-3">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="relative">
                    <img
                      src={attachment.dataUrl}
                      alt={attachment.name}
                      className="h-10 w-10 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                      className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-slate-700 text-[10px] text-white"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={initialTopic ? `Ask about ${initialTopic}...` : 'Ask a question...'}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none"
                rows={3}
                disabled={isStreaming}
              />
              <div className="flex flex-col gap-2">
                <label className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-slate-300">
                  <ImagePlus className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => void handleAttachFiles(event.target.files)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isStreaming || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatTutorWorkspace;
