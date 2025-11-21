import React, { useState, useEffect, useCallback } from 'react';
import GeminiLiveAudioVisualizer from './GeminiLiveAudioVisualizer';
import GeminiLiveMessageList from './GeminiLiveMessageList';
import GeminiLiveVisualization from './GeminiLiveVisualization';
import GeminiLiveChatInterface from './GeminiLiveChatInterface';
import GeminiLivePDFViewer from './GeminiLivePDFViewer';
import { useGeminiLive as GeminiLiveUseGeminiLive } from './hooks/useGeminiLive';
import { ConnectionState, SupportedLanguage, VoiceType, ConceptImageRecord, LearningCanvasImage } from './types';
import {
  Mic,
  Loader2,
  MessageCircle,
  FileText,
  Globe,
  Volume2,
  Sparkles,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Bot,
  Waves
} from 'lucide-react';
import GeminiLiveConceptGallery from './GeminiLiveConceptGallery';
import GeminiLiveImageLightbox from './GeminiLiveImageLightbox';
import GeminiLiveVoiceStatus from './GeminiLiveVoiceStatus';
import GeminiLivePortalIcon from './GeminiLivePortalIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

type AppTab = 'VOICE' | 'TEXT';

interface GeminiLiveWorkspaceProps {
  onClose: () => void;
  apiKey: string;
}

const GeminiLiveWorkspace: React.FC<GeminiLiveWorkspaceProps> = ({ onClose, apiKey }) => {
  const {
    connect,
    disconnect,
    connectionState,
    transcripts,
    analyser,
    simulationState,
    conceptImages,
    error,
    selectedLanguage,
    setSelectedLanguage,
    selectedVoice,
    setSelectedVoice,
    pdfContent,
    setPdfContent,
    highlightedPDFText,
    setHighlightedPDFText,
    isListening,
    isSpeaking
  } = GeminiLiveUseGeminiLive(apiKey);

  const [activeTab, setActiveTab] = useState<AppTab>('VOICE');
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [currentPDFPageText, setCurrentPDFPageText] = useState<string>('');
  const [expandedImage, setExpandedImage] = useState<ConceptImageRecord | null>(null);

  useEffect(() => {
    if (currentPDFPageText && currentPDFPageText.trim().length > 0) {
      setPdfContent(currentPDFPageText);
    }
  }, [currentPDFPageText, setPdfContent]);

  const LANGUAGES: Record<SupportedLanguage, string> = {
    en: '🇺🇸 English',
    es: '🇪🇸 Español',
    fr: '🇫🇷 Français',
    de: '🇩🇪 Deutsch',
    it: '🇮🇹 Italiano',
    pt: '🇵🇹 Português',
    ja: '🇯🇵 日本語',
    zh: '🇨🇳 中文',
    ru: '🇷🇺 Русский',
    hi: '🇮🇳 हिंदी',
    ar: '🇸🇦 العربية'
  };

  const VOICES: Record<VoiceType, string> = {
    Fenrir: '🐺 Fenrir (Deep)',
    Puck: '✨ Puck (Bright)',
    Charon: '⚡ Charon (Warm)',
    Kore: '🌸 Kore (Soft)',
    Orion: '🌟 Orion (Bold)',
    Genie: '🧞 Genie (Mystical)',
    Juniper: '🌿 Juniper (Natural)',
    Zephyr: '🌬️ Zephyr (Gentle)'
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  const handleToggleConnection = () => {
    if (isConnected || isConnecting) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleGalleryImageSelect = useCallback((image: ConceptImageRecord) => {
    setExpandedImage(image);
  }, []);

  const handleCanvasImageExpand = useCallback(
    (image: LearningCanvasImage) => {
      if (!image || image.status !== 'complete' || !image.url) {
        return;
      }
      setExpandedImage({
        id: image.requestId || `canvas-${Date.now()}`,
        title: simulationState.learningCanvasParams?.title || image.concept || 'Concept Snapshot',
        createdAt: image.updatedAt || Date.now(),
        updatedAt: image.updatedAt || Date.now(),
        status: image.status,
        url: image.url,
        prompt: image.prompt,
        displayPrompt: image.prompt,
        concept: image.concept || simulationState.learningCanvasParams?.title,
        topic: image.topic || simulationState.learningCanvasParams?.topic,
        sourceTopic: simulationState.learningCanvasParams?.topic || image.topic,
        style: image.style,
        focus: image.focus,
        mood: image.mood,
        colorPalette: image.colorPalette,
        medium: image.medium,
        importantElements: image.importantElements,
        requestId: image.requestId || 'canvas-preview'
      });
    },
    [simulationState.learningCanvasParams]
  );

  const handleCloseLightbox = useCallback(() => {
    setExpandedImage(null);
  }, []);

  const connectionBadge = isConnecting
    ? { label: 'Connecting…', variant: 'warning' as const }
    : isConnected
    ? { label: 'Live', variant: 'success' as const }
    : { label: 'Offline', variant: 'outline' as const };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),transparent_35%),radial-gradient(circle_at_20%_20%,rgba(167,139,250,0.12),transparent_30%)]" />

      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 pb-10 pt-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/20 via-blue-600/10 to-purple-700/20 shadow-lg shadow-cyan-500/30">
              <BookOpen className="h-6 w-6 text-cyan-200" />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Gemini Live</p>
              <h1 className="text-2xl font-semibold text-white">ChemTutor Copilot</h1>
              <p className="text-sm text-slate-400">Real-time voice, visuals, and documents in one cockpit.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={connectionBadge.variant}>
              <span className="h-2 w-2 rounded-full bg-current opacity-80" />
              {connectionBadge.label}
            </Badge>
            <Button variant="ghost" size="icon" aria-label="Close workspace" onClick={onClose}>
              ✕
            </Button>
          </div>
        </header>

        <Card className="border-slate-800/70 bg-slate-950/70 rounded-3xl">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px] space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-cyan-300" />
                  Language
                </p>
                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 shadow-inner">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguage)}
                    disabled={isConnected}
                    className="w-full bg-transparent text-sm font-medium text-slate-100 outline-none"
                  >
                    {Object.entries(LANGUAGES).map(([code, label]) => (
                      <option key={code} value={code} className="bg-slate-900 text-white">
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="min-w-[240px] space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-purple-300" />
                  Voice
                </p>
                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 shadow-inner">
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value as VoiceType)}
                    disabled={isConnected}
                    className="w-full bg-transparent text-sm font-medium text-slate-100 outline-none"
                  >
                    {Object.entries(VOICES).map(([voice, label]) => (
                      <option key={voice} value={voice} className="bg-slate-900 text-white">
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={isPDFViewerOpen ? 'default' : 'outline'}
                  size="md"
                  onClick={() => setIsPDFViewerOpen((open) => !open)}
                >
                  <FileText className="h-4 w-4" />
                  {isPDFViewerOpen ? 'Hide PDF' : 'Open PDF'}
                </Button>

                <Button
                  variant={isGalleryOpen ? 'soft' : 'outline'}
                  size="md"
                  onClick={() => setIsGalleryOpen((prev) => !prev)}
                >
                  <ImageIcon className="h-4 w-4" />
                  {isGalleryOpen ? 'Hide Visual Memory' : 'Visual Memory'}
                  <Badge variant="secondary" className="ml-1">
                    {conceptImages.length}
                  </Badge>
                  {isGalleryOpen ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
                </Button>

                <Button
                  onClick={handleToggleConnection}
                  variant={isConnected ? 'outline' : 'default'}
                  size="md"
                  className={isConnected ? 'border-red-400/40 text-red-200 hover:bg-red-500/10' : ''}
                  disabled={isConnecting}
                >
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  {isConnecting ? 'Connecting' : isConnected ? 'End Session' : 'Start Session'}
                </Button>
              </div>

              <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                <Badge variant="secondary">Docs synced {pdfContent ? '• Ready' : '• Waiting'}</Badge>
                <Badge variant="secondary">Canvas {simulationState.isActive ? 'running' : 'idle'}</Badge>
              </div>
            </div>

            <Separator className="bg-slate-800/80" />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] min-h-0">
              <div className="space-y-4 min-h-0">
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => setActiveTab(val as AppTab)}
                  defaultValue="VOICE"
                  className="space-y-3 min-h-0 flex flex-col"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <TabsList>
                      <TabsTrigger value="VOICE">
                        <Waves className="h-4 w-4" />
                        Live Voice
                      </TabsTrigger>
                      {/* Text chat removed per request */}
                    </TabsList>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1">
                        <span className={`h-2 w-2 rounded-full ${isSpeaking ? 'bg-rose-400' : isListening ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                        {isSpeaking ? 'Speaking' : isListening ? 'Listening' : 'Idle'}
                      </span>
                      <span className="rounded-full bg-slate-900/70 px-3 py-1">Model · Gemini 2.5</span>
                    </div>
                  </div>

                  <TabsContent value="VOICE" className="space-y-4 flex-1 flex flex-col min-h-0">
                    <div className="grid gap-0 w-full flex-1 min-h-0">
                      <Card className="border-slate-800/60 bg-gradient-to-br from-slate-950/80 to-slate-900/70 rounded-2xl h-full flex flex-col overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                              <Sparkles className="h-4 w-4 text-cyan-300" />
                              {simulationState.isActive ? 'Learning Canvas' : 'Audio Analysis'}
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                              {simulationState.isActive ? 'See how Gemini reasons visually' : 'Live waveform from your mic'}
                            </CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0 h-full min-h-[360px]">
                          {simulationState.isActive ? (
                            <GeminiLiveVisualization visualizationState={simulationState} onExpandImage={handleCanvasImageExpand} />
                          ) : (
                            <div className="h-full rounded-b-2xl border-t border-slate-800/60 bg-slate-950">
                              <GeminiLiveAudioVisualizer analyser={analyser} isConnected={isConnected} isSpeaking={isSpeaking} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <GeminiLiveVoiceStatus
                      isListening={isListening}
                      isSpeaking={isSpeaking}
                      isConnected={connectionState === ConnectionState.CONNECTED}
                      isConnecting={isConnecting}
                      onToggleConnection={handleToggleConnection}
                      isButtonDisabled={false}
                      error={error}
                    />

                    <Card className="border-slate-800/60 bg-slate-950/70">
                      <CardContent className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4">
                          <p className="text-xs font-semibold text-slate-200">Ask with examples</p>
                          <p className="mt-1 text-sm text-slate-400">
                            “Walk me through the mechanism on page 3” · “Show a molecular sketch for this step”
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-800/60 bg-slate-900/70 p-4">
                          <p className="text-xs font-semibold text-slate-200">Upload PDFs</p>
                          <p className="mt-1 text-sm text-slate-400">
                            Upload a paper to keep the canvas and answers grounded to highlighted spans.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-4 min-h-0">
                <Card className="flex h-[calc(100vh-260px)] min-h-[520px] flex-col border-slate-800/60 bg-slate-950/70 overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                        <MessageCircle className="h-4 w-4 text-cyan-300" />
                        Live Conversation
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        Transcript of the ongoing voice session in chronological order
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
                    <GeminiLiveMessageList transcripts={transcripts} />
                  </CardContent>
                </Card>

                {isGalleryOpen && (
                  <Card className="border-slate-800/60 bg-slate-950/70">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                        <ImageIcon className="h-4 w-4 text-cyan-300" />
                        Visual Memory
                      </CardTitle>
                      <Button variant="ghost" size="sm" onClick={() => setIsGalleryOpen(false)}>
                        Hide
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <GeminiLiveConceptGallery
                        images={conceptImages}
                        onSelectImage={handleGalleryImageSelect}
                        isOpen={isGalleryOpen}
                        onToggle={() => setIsGalleryOpen(false)}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <GeminiLiveImageLightbox image={expandedImage} onClose={handleCloseLightbox} />

        {(connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) && (
          <div className="fixed left-6 bottom-24 z-40">
            <GeminiLivePortalIcon isActive />
          </div>
        )}

        {!isPDFViewerOpen && (
          <GeminiLivePDFViewer
            isOpen={false}
            onClose={() => setIsPDFViewerOpen(false)}
            onPDFLoaded={(loaded) => {
              setPdfContent(loaded);
            }}
            highlightText={highlightedPDFText}
            embedded={false}
          />
        )}

        <footer className="text-center text-xs text-slate-500">
          ChemTutor AI • Powered by Google Gemini 2.5 • Advanced Chemistry Tutoring
        </footer>
      </div>
    </div>
    </div>
  );
};

export default GeminiLiveWorkspace;
