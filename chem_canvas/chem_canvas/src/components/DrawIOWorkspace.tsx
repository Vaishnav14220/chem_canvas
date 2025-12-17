import { useEffect, useMemo, useRef, useState } from 'react';
import { DrawIoEmbed } from 'react-drawio';
import type { DrawIoEmbedRef } from 'react-drawio';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import {
  ChevronLeft,
  Cloud,
  Download,
  FileText,
  History,
  Image as ImageIcon,
  Loader2,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Palette,
  Sparkles,
  Sun,
  Trash2
} from 'lucide-react';
import pako from 'pako';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import { streamTextContent } from '../services/geminiService';
import { extractTextFromDocument, isImageFile, isPdfFile, isPlainTextDocument } from '../utils/documentTextExtractor';

const DRAWIO_BASE_URL = import.meta.env.VITE_DRAWIO_BASE_URL || 'https://embed.diagrams.net';
const STORAGE_DRAWIO_UI_KEY = 'drawio-theme';
const STORAGE_DARK_MODE_KEY = 'next-ai-draw-io-dark-mode';
export const STORAGE_DIAGRAM_XML_KEY = 'next-ai-draw-io-diagram-xml';
const STORAGE_MESSAGES_KEY = 'next-ai-draw-io-messages';
const STORAGE_XML_SNAPSHOTS_KEY = 'next-ai-draw-io-xml-snapshots';
const STORAGE_STYLED_KEY = 'next-ai-draw-io-styled';

export type DrawIOChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  thought?: string;
};

type XmlSnapshot = { createdAt: number; prompt: string; xml: string };

type DrawIOWorkspaceProps = { onBack: () => void };

function extractDiagramXmlFromXmlSvg(xmlSvgDataUrl: string): string | null {
  try {
    const base64 = xmlSvgDataUrl.includes(',') ? xmlSvgDataUrl.split(',')[1] : xmlSvgDataUrl;
    if (!base64) return null;

    const svgString = atob(base64);
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) return null;

    const encodedContent = svgElement.getAttribute('content');
    if (!encodedContent) return null;

    const textarea = document.createElement('textarea');
    textarea.innerHTML = encodedContent;
    const xmlContent = textarea.value;

    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    const diagramElement = xmlDoc.querySelector('diagram');
    if (!diagramElement?.textContent) return null;

    const binaryString = atob(diagramElement.textContent);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

    const decompressedData = pako.inflate(bytes, { windowBits: -15 });
    const decoder = new TextDecoder('utf-8');
    const decodedString = decoder.decode(decompressedData);
    return decodeURIComponent(decodedString);
  } catch (e) {
    console.warn('Failed to extract draw.io XML from xmlsvg', e);
    return null;
  }
}

function normalizeXmlForDrawio(xml: string): string {
  const trimmed = xml.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('<mxfile')) return trimmed;
  if (trimmed.includes('<diagram') && trimmed.includes('<mxGraphModel')) {
    return `<mxfile host="app.diagrams.net">${trimmed}</mxfile>`;
  }
  if (trimmed.includes('<mxGraphModel')) {
    return `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="page-1">${trimmed}</diagram></mxfile>`;
  }
  return trimmed;
}

function extractMxfileFromModelOutput(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;

  const start = raw.indexOf('<mxfile');
  if (start >= 0) {
    const end = raw.indexOf('</mxfile>', start);
    if (end >= 0) return normalizeXmlForDrawio(raw.slice(start, end + '</mxfile>'.length));
    return normalizeXmlForDrawio(raw.slice(start));
  }

  const fence = raw.match(/```(?:xml)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return extractMxfileFromModelOutput(fence[1]) ?? normalizeXmlForDrawio(fence[1]);
  }

  if (raw.includes('<mxGraphModel') || raw.includes('<diagram')) return normalizeXmlForDrawio(raw);
  return null;
}

function getEmptyDiagramXml(): string {
  return `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function formatFileHint(file: File): string {
  if (isPdfFile(file)) return 'PDF';
  if (isPlainTextDocument(file)) return 'Text';
  if (isImageFile(file)) return 'Image';
  return 'File';
}

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function DrawIOWorkspace({ onBack }: DrawIOWorkspaceProps) {
  const drawioRef = useRef<DrawIoEmbedRef | null>(null);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const exportResolverRef = useRef<((xml: string) => void) | null>(null);
  const pendingLoadXmlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [drawioUi, setDrawioUi] = useState<'min' | 'sketch'>('min');
  const [darkMode, setDarkMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDrawioReady, setIsDrawioReady] = useState(false);
  const hasLoadedDiagramRef = useRef(false);
  const [messages, setMessages] = useState<DrawIOChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [styledMode, setStyledMode] = useState(false);
  const [snapshots, setSnapshots] = useState<XmlSnapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  useEffect(() => {
    const savedUi = localStorage.getItem(STORAGE_DRAWIO_UI_KEY);
    if (savedUi === 'min' || savedUi === 'sketch') setDrawioUi(savedUi);

    const savedDarkMode = localStorage.getItem(STORAGE_DARK_MODE_KEY);
    if (savedDarkMode !== null) {
      const isDark = savedDarkMode === 'true';
      setDarkMode(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
      document.documentElement.classList.toggle('dark', prefersDark);
    }

    const savedStyled = localStorage.getItem(STORAGE_STYLED_KEY);
    if (savedStyled != null) setStyledMode(savedStyled === 'true');

    try {
      const storedMessages = localStorage.getItem(STORAGE_MESSAGES_KEY);
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages) as Array<Partial<DrawIOChatMessage>>;
        if (Array.isArray(parsed)) {
          setMessages(
            parsed
              .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant'))
              .map((msg) => ({
                id: msg.id ?? makeMessageId(),
                role: msg.role as 'user' | 'assistant',
                content: String(msg.content ?? ''),
                createdAt: typeof msg.createdAt === 'number' ? msg.createdAt : Date.now(),
                thought: typeof msg.thought === 'string' ? msg.thought : undefined
              }))
          );
        }
      }
    } catch (e) {
      console.warn('Failed to restore draw.io chat messages', e);
    }

    try {
      const storedSnapshots = localStorage.getItem(STORAGE_XML_SNAPSHOTS_KEY);
      if (storedSnapshots) {
        const parsed = JSON.parse(storedSnapshots) as XmlSnapshot[];
        if (Array.isArray(parsed)) setSnapshots(parsed);
      }
    } catch (e) {
      console.warn('Failed to restore draw.io history', e);
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages.slice(-200)));
      } catch {
        // ignore storage errors
      }
    }, 300);
    return () => clearTimeout(t);
  }, [messages]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_XML_SNAPSHOTS_KEY, JSON.stringify(snapshots.slice(-50)));
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(t);
  }, [snapshots]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleChatPanel = () => {
    const panel = chatPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setIsChatVisible(true);
    } else {
      panel.collapse();
      setIsChatVisible(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleChatPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const saveDiagramToStorage = async () => {
    try {
      const xml = await new Promise<string>((resolve, reject) => {
        const instance = drawioRef.current;
        if (!instance) return resolve('');

        exportResolverRef.current = resolve;
        const timeout = setTimeout(() => {
          exportResolverRef.current = null;
          reject(new Error('Export timeout'));
        }, 2500);

        // Wrap resolver to ensure timeout cleared.
        const originalResolver = exportResolverRef.current;
        exportResolverRef.current = (exportedXml) => {
          clearTimeout(timeout);
          originalResolver?.(exportedXml);
        };

        instance.exportDiagram({ format: 'xmlsvg' });
      });
      if (xml && xml.length > 20) {
        localStorage.setItem(STORAGE_DIAGRAM_XML_KEY, normalizeXmlForDrawio(xml));
      }
    } catch (e) {
      console.warn('Failed to save draw.io diagram before UI change', e);
    }
  };

  const exportCurrentDiagramXml = async (): Promise<string> => {
    const instance = drawioRef.current;
    if (!instance) return '';

    return await new Promise<string>((resolve, reject) => {
      exportResolverRef.current = resolve;
      const timeout = setTimeout(() => {
        exportResolverRef.current = null;
        reject(new Error('Export timeout'));
      }, 6000);

      const original = exportResolverRef.current;
      exportResolverRef.current = (xml) => {
        clearTimeout(timeout);
        original?.(xml);
      };

      instance.exportDiagram({ format: 'xmlsvg' });
    });
  };

  const loadDiagramXml = (xml: string) => {
    const normalized = normalizeXmlForDrawio(xml);
    try {
      localStorage.setItem(STORAGE_DIAGRAM_XML_KEY, normalized);
    } catch {
      // ignore
    }

    if (!isDrawioReady || !drawioRef.current) {
      pendingLoadXmlRef.current = normalized;
      return;
    }

    try {
      drawioRef.current.load({ xml: normalized });
    } catch (e) {
      console.warn('Failed to load diagram into draw.io', e);
    }
  };

  const handleDarkModeChange = async () => {
    await saveDiagramToStorage();
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem(STORAGE_DARK_MODE_KEY, String(next));
    document.documentElement.classList.toggle('dark', next);
    setIsDrawioReady(false);
    hasLoadedDiagramRef.current = false;
  };

  const handleDrawioUiChange = async () => {
    await saveDiagramToStorage();
    const next = drawioUi === 'min' ? 'sketch' : 'min';
    localStorage.setItem(STORAGE_DRAWIO_UI_KEY, next);
    setDrawioUi(next);
    setIsDrawioReady(false);
    hasLoadedDiagramRef.current = false;
  };

  const onDrawioLoad = () => {
    setIsDrawioReady(true);
  };

  const onDrawioExport = (data: any) => {
    const resolver = exportResolverRef.current;
    if (!resolver) return;
    exportResolverRef.current = null;

    const raw = String(data?.data ?? '');
    const extracted = raw ? extractDiagramXmlFromXmlSvg(raw) : null;
    resolver(normalizeXmlForDrawio(extracted ?? ''));
  };

  useEffect(() => {
    if (!isDrawioReady) return;
    if (hasLoadedDiagramRef.current) return;
    hasLoadedDiagramRef.current = true;

    const savedXml = localStorage.getItem(STORAGE_DIAGRAM_XML_KEY);
    if (savedXml && drawioRef.current) {
      try {
        drawioRef.current.load({ xml: normalizeXmlForDrawio(savedXml) });
      } catch (e) {
        console.warn('Failed to restore draw.io diagram from storage', e);
      }
    }

    if (pendingLoadXmlRef.current && drawioRef.current) {
      try {
        drawioRef.current.load({ xml: pendingLoadXmlRef.current });
        pendingLoadXmlRef.current = null;
      } catch (e) {
        console.warn('Failed to load pending diagram', e);
      }
    }
  }, [isDrawioReady]);

  const quickExamples = useMemo(
    () => [
      {
        id: 'paper',
        title: 'Paper to Diagram',
        badge: 'NEW',
        description: 'Upload .pdf, .txt, .md, .json, .csv, .py, .js, .ts and more',
        icon: FileText,
        action: () => {
          setInput('Create a clear diagram that summarizes the uploaded document.');
          fileInputRef.current?.click();
        }
      },
      {
        id: 'animated',
        title: 'Animated Diagram',
        description: 'Draw a transformer architecture with animated connectors',
        icon: Sparkles,
        action: () => {
          setInput('Draw a transformer architecture diagram with animated connectors.');
        }
      },
      {
        id: 'aws',
        title: 'AWS Architecture',
        description: 'Create a cloud architecture diagram with AWS icons',
        icon: Cloud,
        action: () => {
          setInput('Create an AWS cloud architecture diagram for a web app (ALB -> compute -> database) with clear boundaries.');
        }
      },
      {
        id: 'replicate',
        title: 'Replicate Flowchart',
        description: 'Upload and replicate an existing flowchart',
        icon: ImageIcon,
        action: () => {
          setInput('Replicate this flowchart as a draw.io diagram. Keep layout and labels.');
          fileInputRef.current?.click();
        }
      },
      {
        id: 'creative',
        title: 'Creative Drawing',
        description: 'Draw something fun and creative',
        icon: Sparkles,
        action: () => {
          setInput('Create a fun, creative doodle-style diagram with a title and a few playful elements.');
        }
      }
    ],
    []
  );

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachedFiles((prev) => [...prev, ...Array.from(files)].slice(0, 8));
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const buildDiagramPrompt = (params: { userPrompt: string; currentXml: string; documentText?: string; styled: boolean }) => {
    const styleSpec = params.styled
      ? `Style: use a modern, professional look (rounded rectangles, subtle shadows, consistent color palette, readable typography).`
      : `Style: minimal and clean (monochrome or light palette, simple shapes, no heavy styling).`;

    return `You are a draw.io diagram generator.
Return ONLY valid draw.io XML.

Hard requirements:
- Output must be a single <mxfile>...</mxfile> document.
- Use uncompressed mxGraphModel (no base64-encoded <diagram> content).
- Include <mxCell id="0"/> and <mxCell id="1" parent="0"/> in the root.
- Do NOT wrap output in markdown fences.

${styleSpec}

If CURRENT_XML is provided and not empty, treat this as an edit request: apply the user's request to the existing diagram and return the full updated mxfile.

USER_REQUEST:
${params.userPrompt}

${params.documentText ? `SOURCE_CONTENT:\\n${params.documentText}\\n` : ''}

CURRENT_XML:
${params.currentXml || ''}`;
  };

  const handleSend = async () => {
    if (isSending) return;
    const trimmed = input.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    setIsSending(true);
    const userMessage = trimmed || (attachedFiles.length ? `Create a diagram from ${attachedFiles.length} uploaded file(s).` : '');
    const userMessageId = makeMessageId();
    const assistantMessageId = makeMessageId();
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: 'user', content: userMessage, createdAt: Date.now() },
      { id: assistantMessageId, role: 'assistant', content: 'Thinking...', createdAt: Date.now(), thought: '' }
    ]);
    setInput('');

    try {
      const currentXml = await exportCurrentDiagramXml().catch(() => '');
      const normalizedCurrentXml = normalizeXmlForDrawio(currentXml);

      const hasImage = attachedFiles.some((f) => isImageFile(f));
      const nonImageFiles = attachedFiles.filter((f) => !isImageFile(f));

      let documentText = '';
      if (nonImageFiles.length > 0) {
        const pieces: string[] = [];
        for (const file of nonImageFiles) {
          try {
            const extracted = await extractTextFromDocument(file);
            const snippet = (extracted.text || '').slice(0, 12000);
            pieces.push(`[${formatFileHint(file)}: ${file.name}]\\n${snippet}`);
          } catch {
            pieces.push(`[File: ${file.name}] (failed to extract text)`);
          }
        }
        documentText = pieces.join('\\n\\n');
      }

      const prompt = buildDiagramPrompt({
        userPrompt: userMessage,
        currentXml: normalizedCurrentXml,
        documentText,
        styled: styledMode
      });

      const imageFile = hasImage ? attachedFiles.find((f) => isImageFile(f))! : null;
      const inlineData = imageFile
        ? { mimeType: imageFile.type || 'image/png', data: await fileToBase64(imageFile) }
        : undefined;

      let collectedThought = '';
      const onThought = (thoughtChunk: string) => {
        if (!thoughtChunk) return;
        collectedThought = (collectedThought + thoughtChunk).slice(-20000);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, thought: collectedThought }
              : msg
          )
        );
      };

      // We only need the final text to parse XML, but we still stream to capture thought parts.
      const modelOutput = await streamTextContent(
        prompt,
        () => {},
        {
          model: 'gemini-3-pro-preview',
          thinking: 'high',
          onThought,
          inlineData,
          timeout: 240000
        }
      );

      const xml = extractMxfileFromModelOutput(modelOutput);
      if (!xml) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: 'I could not produce valid draw.io XML. Try rephrasing the request or uploading a clearer file/image.'
                }
              : msg
          )
        );
        return;
      }

      loadDiagramXml(xml);
      setSnapshots((prev) => [...prev, { createdAt: Date.now(), prompt: userMessage, xml }].slice(-50));
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: 'Updated the diagram in the editor.' }
            : msg
        )
      );
    } catch (e: any) {
      console.error('Draw.io AI generation failed', e);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Sorry, something went wrong while generating the diagram. ${e?.message ? `(${e.message})` : ''}`
              }
            : msg
        )
      );
    } finally {
      setAttachedFiles([]);
      setIsSending(false);
    }
  };

  const handleDownload = async () => {
    try {
      const xml = await exportCurrentDiagramXml();
      const normalized = normalizeXmlForDrawio(xml);
      const blob = new Blob([normalized], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diagram.drawio';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Failed to download diagram', e);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setSnapshots([]);
    setAttachedFiles([]);
    setInput('');
    loadDiagramXml(getEmptyDiagramXml());
    try {
      localStorage.removeItem(STORAGE_MESSAGES_KEY);
      localStorage.removeItem(STORAGE_XML_SNAPSHOTS_KEY);
    } catch {
      // ignore
    }
  };

  const restoreSnapshot = (snapshot: XmlSnapshot) => {
    loadDiagramXml(snapshot.xml);
    setHistoryOpen(false);
  };

  return (
    <div className="flex flex-1 w-full h-full bg-background relative overflow-hidden">
      <ResizablePanelGroup
        id="drawio-workspace"
        key={isMobile ? 'mobile' : 'desktop'}
        direction={isMobile ? 'vertical' : 'horizontal'}
        className="h-full min-h-0"
      >
        <ResizablePanel id="drawio-panel" defaultSize={isMobile ? 55 : 67} minSize={20}>
          <div className={`h-full min-h-0 relative ${isMobile ? 'p-1' : 'p-2'}`}>
            <div className="h-full min-h-0 rounded-xl overflow-hidden shadow-lg border border-border/30 bg-background flex flex-col">
              <div className="h-12 flex items-center justify-between px-3 border-b border-border/40 bg-background/90">
                <div className="flex items-center gap-2">
                  <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                    title="Back to Mind Map"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  <div className="h-5 w-px bg-border" />
                  <span className="text-sm font-semibold text-foreground">Draw.io Workspace</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDrawioUiChange}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                    title="Toggle Draw.io UI (min/sketch)"
                  >
                    <Palette className="w-4 h-4" />
                    {drawioUi === 'min' ? 'Min' : 'Sketch'}
                  </button>
                  <button
                    onClick={handleDarkModeChange}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                    title="Toggle dark mode"
                  >
                    {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {darkMode ? 'Light' : 'Dark'}
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                {isLoaded ? (
                  <DrawIoEmbed
                    key={`${drawioUi}-${darkMode}`}
                    ref={drawioRef}
                    onExport={onDrawioExport}
                    onLoad={onDrawioLoad}
                    baseUrl={DRAWIO_BASE_URL}
                    urlParameters={{
                      ui: drawioUi,
                      spin: true,
                      libraries: false,
                      saveAndExit: false,
                      noExitBtn: true,
                      dark: darkMode
                    }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-background">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel
          id="chat-panel"
          ref={chatPanelRef}
          defaultSize={isMobile ? 45 : 33}
          minSize={isMobile ? 20 : 15}
          maxSize={isMobile ? 80 : 50}
          collapsible={!isMobile}
          collapsedSize={isMobile ? 0 : 3}
          onCollapse={() => setIsChatVisible(false)}
          onExpand={() => setIsChatVisible(true)}
        >
          <div className={`h-full min-h-0 ${isMobile ? 'p-1' : 'py-2 pr-2'}`}>
            <div className="h-full min-h-0 rounded-xl overflow-hidden border border-border/30 shadow-lg bg-background flex flex-col">
              <div className="h-12 border-b border-border/40 flex items-center justify-between px-3 bg-background/90">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">AI Assistant</span>
                </div>
                {!isMobile ? (
                  <button
                    onClick={toggleChatPanel}
                    className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Toggle chat panel (Ctrl/Cmd+B)"
                  >
                    {isChatVisible ? (
                      <PanelRightClose className="w-4 h-4" />
                    ) : (
                      <PanelRightOpen className="w-4 h-4" />
                    )}
                  </button>
                ) : null}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="space-y-4">
                    <a
                      href="https://github.com/DayuanJiang/next-ai-draw-io/tree/main/packages/mcp-server"
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-border/50 bg-gradient-to-r from-primary/10 via-background to-background px-4 py-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">MCP Server</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                                PREVIEW
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">Use in Claude Desktop, VS Code &amp; Cursor</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">Docs</span>
                      </div>
                    </a>

                    <div className="text-center pt-2">
                      <h3 className="text-lg font-semibold text-foreground">Create diagrams with AI</h3>
                      <p className="text-sm text-muted-foreground">
                        Describe what you want to create or upload an image to replicate
                      </p>
                    </div>

                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground tracking-wider">QUICK EXAMPLES</p>
                      <div className="mt-3 space-y-2">
                        {quickExamples.map((example) => {
                          const Icon = example.icon;
                          return (
                            <button
                              key={example.id}
                              type="button"
                              onClick={example.action}
                              className="w-full text-left rounded-2xl border border-border/50 bg-card/30 hover:bg-card/60 hover:border-primary/30 transition-colors px-4 py-3"
                            >
                              <div className="flex items-start gap-3">
                                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                  <Icon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-foreground">{example.title}</span>
                                    {(example as any).badge ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                                        {(example as any).badge}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">{example.description}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 text-center mt-3">
                        Examples are cached for instant response
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          {msg.role === 'assistant' && msg.thought ? (
                            <details className="mt-2 rounded-md border border-border/50 bg-background/40">
                              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-muted-foreground">
                                Thinking
                              </summary>
                              <pre className="max-h-56 overflow-auto px-3 pb-3 text-xs whitespace-pre-wrap text-muted-foreground">
                                {msg.thought}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {isSending ? (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <footer className="p-3 border-t border-border/40 bg-background/80">
                <form
                  className="w-full"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                >
                  <div className="relative rounded-2xl border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                    {attachedFiles.length ? (
                      <div className="px-3 pt-3 pb-2 flex flex-wrap gap-2">
                        {attachedFiles.map((file, idx) => (
                          <button
                            key={`${file.name}-${idx}`}
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground hover:bg-muted"
                            title="Remove file"
                          >
                            <span className="max-w-[180px] truncate">{file.name}</span>
                            <span className="text-[10px] text-muted-foreground">{formatFileHint(file)}</span>
                            <span className="text-muted-foreground">×</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <textarea
                      className="w-full min-h-[60px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                      placeholder="Describe your diagram or upload a file..."
                      aria-label="Chat input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={2}
                    />

                    <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="New chat / clear"
                          onClick={() => setConfirmResetOpen(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={styledMode}
                          className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted"
                          onClick={() => {
                            const next = !styledMode;
                            setStyledMode(next);
                            localStorage.setItem(STORAGE_STYLED_KEY, String(next));
                          }}
                        >
                          <span
                            className={`inline-flex h-[1.15rem] w-8 items-center rounded-full border border-transparent shadow-xs transition-all ${
                              styledMode ? 'bg-primary' : 'bg-input'
                            }`}
                          >
                            <span
                              className={`bg-background h-4 w-4 rounded-full transition-transform ${
                                styledMode ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0'
                              }`}
                            />
                          </span>
                          <span>Styled</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="History"
                          disabled={snapshots.length === 0}
                          onClick={() => setHistoryOpen(true)}
                        >
                          <History className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Download .drawio"
                          onClick={handleDownload}
                        >
                          <Download className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Upload image or file"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImageIcon className="h-4 w-4" />
                        </button>

                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,application/pdf,text/*,.md,.markdown,.json,.csv,.xml,.yaml,.yml,.toml,.py,.js,.ts"
                          multiple
                          onChange={(e) => handleFilesSelected(e.target.files)}
                        />

                        <div className="w-px h-5 bg-border mx-1" />

                        <button
                          type="submit"
                          aria-label="Send message"
                          disabled={isSending || (!input.trim() && attachedFiles.length === 0)}
                          className="inline-flex items-center justify-center h-8 px-4 rounded-xl font-medium shadow-sm bg-primary text-primary-foreground hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </footer>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {historyOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-xl border border-border bg-background p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">History</h3>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setHistoryOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="space-y-2">
                {snapshots
                  .slice()
                  .reverse()
                  .map((s, idx) => (
                    <button
                      key={`${s.createdAt}-${idx}`}
                      type="button"
                      className="w-full text-left rounded-lg border border-border bg-card/30 hover:bg-card/60 transition-colors px-3 py-2"
                      onClick={() => restoreSnapshot(s)}
                      title="Restore this diagram"
                    >
                      <div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</div>
                      <div className="text-sm text-foreground truncate">{s.prompt}</div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmResetOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmResetOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-foreground">Start a new chat?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This clears the sidebar conversation and resets the diagram.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted"
                  onClick={() => setConfirmResetOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    setConfirmResetOpen(false);
                    handleReset();
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
