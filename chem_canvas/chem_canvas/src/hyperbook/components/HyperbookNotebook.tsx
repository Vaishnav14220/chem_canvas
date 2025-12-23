import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message, Source } from '../lib/types';
import { cn, generateId, normalizeUrl } from '../lib/utils';
import { useToast } from '../hooks/use-toast';
import { Toaster } from '../ui/toaster';
import { Navbar } from './Navbar';
import { SourcesPanel } from './SourcesPanel';
import { ChatInterface } from './ChatInterface';
import { OutputsPanel } from './OutputsPanel';
import { getOrCreateFileSearchStore, uploadTextToFileSearchStore } from '../services/fileSearchStore';
import { scrapeUrl } from '../services/scrape';
import { processUploadedFile } from '../services/upload';
import { generateSummaryFromSources } from '../services/summary';
import { generateSlidesFromSources } from '../services/slides';
import { generateMindmapFromSources } from '../services/mindmap';
import { chatWithSources } from '../services/chat';
import { generateAudioOverview } from '../services/audio';
import { downloadPptx } from '../services/pptx';

let didInitFileSearchStore = false;

type AudioLanguage = 'en' | 'hi' | 'de' | 'it';

export function HyperbookNotebook(props: {
  initialSource?: { title: string; text: string } | null;
  className?: string;
}) {
  const { toast } = useToast();

  const [sources, setSources] = useState<Source[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [slides, setSlides] = useState<any[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mindmapData, setMindmapData] = useState<any>(null);
  const [fileSearchStoreName, setFileSearchStoreName] = useState<string | null>(null);

  const [isScraping, setIsScraping] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [isGeneratingPptx, setIsGeneratingPptx] = useState(false);
  const [isGeneratingMindmap, setIsGeneratingMindmap] = useState(false);

  const lastAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (lastAudioUrlRef.current) URL.revokeObjectURL(lastAudioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (didInitFileSearchStore) return;
    didInitFileSearchStore = true;

    getOrCreateFileSearchStore()
      .then((store) => {
        if (!store?.name) return;
        setFileSearchStoreName(store.name);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.error('[HyperbookLM] FileSearch init failed:', err);
      });

    return () => {};
  }, []);

  const initialSourceMemo = useMemo(() => {
    const title = props.initialSource?.title?.trim();
    const text = props.initialSource?.text?.trim();
    if (!title || !text) return null;
    return { title, text };
  }, [props.initialSource?.text, props.initialSource?.title]);

  useEffect(() => {
    if (!initialSourceMemo) return;

    const id = `initial-${generateId()}`;
    const base: Source = {
      id,
      url: initialSourceMemo.title,
      title: initialSourceMemo.title,
      text: initialSourceMemo.text,
      content: initialSourceMemo.text,
      status: 'success',
      addedAt: Date.now(),
    };

    setSources((prev) => {
      if (prev.some((s) => s.id.startsWith('initial-'))) return prev;
      return [base, ...prev];
    });

    uploadTextToFileSearchStore({ title: initialSourceMemo.title, text: initialSourceMemo.text })
      .then((docName) => {
        if (!docName) return;
        setSources((prev) => prev.map((s) => (s.id === id ? { ...s, fileSearchDocumentName: docName } : s)));
      })
      .catch(() => {});
  }, [initialSourceMemo]);

  const clearNotebook = () => {
    setMessages([]);
    setSummary(null);
    setSlides([]);
    setMindmapData(null);
    setStreamingContent('');
    if (lastAudioUrlRef.current) URL.revokeObjectURL(lastAudioUrlRef.current);
    lastAudioUrlRef.current = null;
    setAudioUrl(null);
    setSources((prev) => prev.filter((s) => s.id.startsWith('initial-')));
  };

  const generateSummary = async (currentSources: Source[]) => {
    const successful = currentSources.filter((s) => s.status === 'success');
    if (successful.length === 0) return;
    try {
      setSummary('Generating summary...');
      const result = await generateSummaryFromSources(currentSources);
      setSummary(result);
    } catch (e) {
      console.error('Summary generation failed', e);
      setSummary('Failed to generate summary.');
      toast({
        title: 'Failed to generate summary',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const getNarrationText = async (): Promise<string | null> => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')?.content;
    const currentSummary = summary && summary !== 'Generating summary...' ? summary : null;

    if (currentSummary) return currentSummary;
    if (lastAssistant) return lastAssistant;

    const successfulSources = sources.filter((s) => s.status === 'success');
    if (successfulSources.length === 0) return null;

    const context = await generateSummaryFromSources(successfulSources);
    setSummary(context);
    return context;
  };

  const handleAddUrl = async (urlRaw: string) => {
    const url = normalizeUrl(urlRaw) || urlRaw.trim();
    setIsScraping(true);
    const tempId = `source-${Date.now()}`;
    const newSource: Source = { id: tempId, url, status: 'loading', addedAt: Date.now() };
    setSources((prev) => [...prev, newSource]);

    try {
      const data = await scrapeUrl(url);
      const updated: Source = {
        ...newSource,
        status: 'success',
        title: data.title,
        content: data.content,
        text: data.text,
        fileSearchDocumentName: data.fileSearchDocumentName ?? undefined,
      };
      setSources((prev) => prev.map((s) => (s.id === tempId ? updated : s)));
      toast({ title: 'Source added successfully' });
    } catch (error) {
      console.error(error);
      setSources((prev) =>
        prev.map((s) => (s.id === tempId ? { ...s, status: 'error', error: 'Failed to load' } : s))
      );
      toast({
        title: 'Failed to add source',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleAddFile = async (file: File) => {
    setIsScraping(true);
    const tempId = `file-${Date.now()}`;
    const newSource: Source = {
      id: tempId,
      url: file.name,
      title: file.name,
      status: 'loading',
      addedAt: Date.now(),
    };
    setSources((prev) => [...prev, newSource]);

    try {
      const data = await processUploadedFile(file);
      const updated: Source = {
        ...newSource,
        status: 'success',
        title: data.title || file.name,
        text: data.text,
        content: data.content,
        fileSearchDocumentName: data.fileSearchDocumentName ?? undefined,
      };
      setSources((prev) => prev.map((s) => (s.id === tempId ? updated : s)));
      toast({ title: 'PDF added successfully' });
    } catch (error) {
      console.error(error);
      setSources((prev) =>
        prev.map((s) => (s.id === tempId ? { ...s, status: 'error', error: 'Failed to process PDF' } : s))
      );
      toast({
        title: 'Failed to add PDF',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleAddText = async (title: string, text: string) => {
    const cleanedText = text.trim();
    if (!cleanedText) return;

    const cleanedTitle = title.trim() || `Notes ${new Date().toLocaleDateString()}`;
    const tempId = `notes-${generateId()}`;
    const newSource: Source = {
      id: tempId,
      url: cleanedTitle,
      title: cleanedTitle,
      status: 'loading',
      addedAt: Date.now(),
      content: cleanedText,
      text: cleanedText,
    };

    setIsScraping(true);
    setSources((prev) => [...prev, newSource]);

    try {
      const docName = await uploadTextToFileSearchStore({ title: cleanedTitle, text: cleanedText });
      setSources((prev) =>
        prev.map((s) =>
          s.id === tempId
            ? { ...s, status: 'success', fileSearchDocumentName: docName ?? s.fileSearchDocumentName }
            : s
        )
      );
      toast({ title: 'Notes added successfully' });
    } catch (error) {
      console.error(error);
      setSources((prev) => prev.map((s) => (s.id === tempId ? { ...s, status: 'success' } : s)));
      toast({
        title: 'Notes added locally',
        description: 'Search indexing is unavailable right now.',
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleRemoveSource = (id: string) => setSources((prev) => prev.filter((s) => s.id !== id));

  const handleAnalyzeSources = () => {
    void generateSummary(sources);
    void handleGenerateMindmap();
    void handleGenerateSlides();
  };

  const handleSendMessage = async (content: string) => {
    const newMessage: Message = { id: `msg-${Date.now()}`, role: 'user', content, timestamp: Date.now() };
    setMessages((prev) => [...prev, newMessage]);
    setIsChatting(true);
    setStreamingContent('');

    try {
      const response = await chatWithSources({
        messages: [...messages, newMessage].map((m) => ({ role: m.role, content: m.content })),
        sources,
        fileSearchStoreName,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: response.content || '',
          citations: response.citations || [],
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      console.error(error);
      toast({ title: 'Chat failed', variant: 'destructive' });
    } finally {
      setIsChatting(false);
    }
  };

  const handleGenerateAudio = async (mode: 'narration' | 'podcast' = 'narration', language: AudioLanguage = 'en') => {
    setIsGeneratingAudio(true);
    try {
      const narration = await getNarrationText();
      const textToSpeakRaw = narration || '';
      if (!textToSpeakRaw.trim()) {
        toast({ title: 'Nothing to narrate', description: 'Generate a summary or ask a question first.' });
        return;
      }

      const buf = await generateAudioOverview({ text: textToSpeakRaw, mode, language });
      const blob = new Blob([buf], { type: 'audio/wav' });

      if (lastAudioUrlRef.current) URL.revokeObjectURL(lastAudioUrlRef.current);
      const url = URL.createObjectURL(blob);
      lastAudioUrlRef.current = url;
      setAudioUrl(url);
      toast({ title: mode === 'podcast' ? 'Podcast audio generated' : 'Audio generated' });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Audio generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleGenerateSlides = async () => {
    if (sources.filter((s) => s.status === 'success').length === 0) {
      toast({ title: 'No sources available', description: 'Add sources to generate slides.' });
      return;
    }

    setIsGeneratingSlides(true);
    try {
      const newSlides = await generateSlidesFromSources(sources);
      setSlides(newSlides);
      toast({ title: 'Slides generated' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to generate slides', variant: 'destructive' });
    } finally {
      setIsGeneratingSlides(false);
    }
  };

  const handleDownloadPptx = async () => {
    if (slides.length === 0) {
      toast({ title: 'No slides available', description: 'Generate slides first.' });
      return;
    }

    setIsGeneratingPptx(true);
    try {
      await downloadPptx({ title: 'HyperbookLM Presentation', slides, sources });
      toast({ title: 'PPTX download started' });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Failed to generate PPTX',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPptx(false);
    }
  };

  const handleGenerateMindmap = async () => {
    if (sources.filter((s) => s.status === 'success').length === 0) {
      toast({ title: 'No sources available', description: 'Add sources to generate mindmap.' });
      return;
    }

    setIsGeneratingMindmap(true);
    try {
      const root = await generateMindmapFromSources(sources);
      setMindmapData(root);
      toast({ title: 'Mindmap generated' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Failed to generate mindmap', variant: 'destructive' });
    } finally {
      setIsGeneratingMindmap(false);
    }
  };

  const [mobileTab, setMobileTab] = useState<'sources' | 'chat' | 'outputs'>('sources');

  return (
    <div className={cn('flex flex-col h-full bg-white text-black font-sans overflow-hidden pb-[96px]', props.className)}>
      <Navbar onCreateNotebook={clearNotebook} />
      <Toaster />

      <div className="lg:hidden flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setMobileTab('sources')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            mobileTab === 'sources' ? 'bg-white border-b-2 border-black' : 'text-gray-500'
          }`}
        >
          Sources {sources.length > 0 && `(${sources.length})`}
        </button>
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            mobileTab === 'chat' ? 'bg-white border-b-2 border-black' : 'text-gray-500'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setMobileTab('outputs')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            mobileTab === 'outputs' ? 'bg-white border-b-2 border-black' : 'text-gray-500'
          }`}
        >
          Outputs
        </button>
      </div>

      <div className="flex-1 grid lg:grid-cols-12 gap-0 overflow-hidden">
        <div
          className={`${mobileTab === 'sources' ? 'block' : 'hidden'} lg:block lg:col-span-3 border-r border-gray-200 h-full overflow-hidden`}
        >
          <SourcesPanel
            sources={sources}
            onAddUrl={handleAddUrl}
            onAddFile={handleAddFile}
            onAddText={handleAddText}
            onRemoveSource={handleRemoveSource}
            onAnalyze={handleAnalyzeSources}
            isLoading={isScraping}
          />
        </div>

        <div
          className={`${mobileTab === 'chat' ? 'block' : 'hidden'} lg:block lg:col-span-5 border-r border-gray-200 h-full overflow-hidden`}
        >
          <ChatInterface
            messages={messages}
            streamingContent={streamingContent}
            isLoading={isChatting}
            onSendMessage={handleSendMessage}
            hasSource={sources.length > 0}
            sources={sources.filter((s) => s.status === 'success')}
          />
        </div>

        <div className={`${mobileTab === 'outputs' ? 'block' : 'hidden'} lg:block lg:col-span-4 h-full overflow-hidden bg-white`}>
          <div className="h-full overflow-y-auto">
            <OutputsPanel
              summary={summary}
              slides={slides}
              audioUrl={audioUrl}
              mindmapData={mindmapData}
              isGeneratingAudio={isGeneratingAudio}
              isGeneratingSlides={isGeneratingSlides}
              isGeneratingPptx={isGeneratingPptx}
              isGeneratingMindmap={isGeneratingMindmap}
              onGenerateAudio={handleGenerateAudio}
              onGenerateSlides={handleGenerateSlides}
              onDownloadPptx={handleDownloadPptx}
              onGenerateMindmap={handleGenerateMindmap}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
