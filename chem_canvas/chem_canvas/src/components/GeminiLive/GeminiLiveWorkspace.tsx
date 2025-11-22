import React, { useState, useEffect, useCallback, useMemo } from 'react';
import GeminiLiveAudioVisualizer from './GeminiLiveAudioVisualizer';
import GeminiLiveMessageList from './GeminiLiveMessageList';
import GeminiLiveVisualization from './GeminiLiveVisualization';
import GeminiLiveChatInterface from './GeminiLiveChatInterface';
import GeminiLivePDFViewer from './GeminiLivePDFViewer';
import { useGeminiLive } from './hooks/useGeminiLive';
import { ConnectionState, SupportedLanguage, VoiceType, ConceptImageRecord, LearningCanvasImage, ChatMode, ChatMessage } from './types';
import { chatHistoryService, ChatSession } from '../../services/chatHistoryService';
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
  Waves,
  MessageSquare,
  Menu,
  Plus,
  History,
  HelpCircle,
  Settings,
  Activity,
  X
} from 'lucide-react';
import GeminiLiveConceptGallery from './GeminiLiveConceptGallery';
import GeminiLiveImageLightbox from './GeminiLiveImageLightbox';
import GeminiLiveVoiceStatus from './GeminiLiveVoiceStatus';
import GeminiLivePortalIcon from './GeminiLivePortalIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type AppTab = 'VOICE' | 'TEXT';

interface GeminiLiveWorkspaceProps {
  onClose: () => void;
  apiKey: string;
  geminiLiveState: ReturnType<typeof useGeminiLive>;
}

const GeminiLiveWorkspace: React.FC<GeminiLiveWorkspaceProps> = ({ onClose, apiKey, geminiLiveState }) => {
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
    setRequestCanvasSnapshot,
    captureAndSendSnapshot,
    isListening,
    isSpeaking
  } = geminiLiveState;

  const [activeTab, setActiveTab] = useState<AppTab>('TEXT');
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [currentPDFPageText, setCurrentPDFPageText] = useState<string>('');
  const [expandedImage, setExpandedImage] = useState<ConceptImageRecord | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    return (localStorage.getItem('gemini_live_chat_mode') as ChatMode) || 'FAST';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Persist chat mode when it changes
  useEffect(() => {
    localStorage.setItem('gemini_live_chat_mode', chatMode);
  }, [chatMode]);

  // Load chat history on mount
  useEffect(() => {
    setChatHistory(chatHistoryService.getAllSessions());
  }, []);

  // Initialize new chat if needed or when explicitly requested
  const initializeNewChat = useCallback(() => {
    const newSession = chatHistoryService.createNewSession();
    setCurrentSessionId(newSession.id);
    setChatMessages([]);
    setActiveTab('TEXT');
    // Don't save yet, wait for first message
  }, []);

  // Auto-initialize first chat if history is empty or just as a default state
  useEffect(() => {
    if (!currentSessionId && chatHistory.length === 0) {
      initializeNewChat();
    }
  }, [currentSessionId, chatHistory.length, initializeNewChat]);

  // Handle messages change to persist chat
  const handleMessagesChange = useCallback((newMessages: ChatMessage[]) => {
    setChatMessages(newMessages);
    
    if (newMessages.length > 0 && currentSessionId) {
      // Find current session title or generate a new one
      const currentSession = chatHistoryService.getSession(currentSessionId);
      const title = currentSession ? currentSession.title : chatHistoryService.generateTitle(newMessages[0].text);

      const sessionToSave: ChatSession = {
        id: currentSessionId,
        title,
        updatedAt: Date.now(),
        preview: newMessages[newMessages.length - 1].text.slice(0, 60),
        messages: newMessages
      };
      chatHistoryService.saveSession(sessionToSave);
      setChatHistory(chatHistoryService.getAllSessions());
    }
  }, [currentSessionId]); // Removed chatHistory dependency to fix ReferenceError

  // Load a session from history
  const loadSession = useCallback((sessionId: string) => {
    const session = chatHistoryService.getSession(sessionId);
    if (session) {
      setCurrentSessionId(session.id);
      setChatMessages(session.messages);
      setActiveTab('TEXT');
    }
  }, []);

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

  const handleStartVoiceSession = () => {
    setActiveTab('VOICE');
    connect();
  };

  const handleEndVoiceSession = () => {
    disconnect();
    setActiveTab('TEXT');
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
    <div className="fixed inset-0 z-50 flex bg-[#131314] text-slate-100 font-sans">
      {/* Sidebar */}
      <div className={`flex flex-col justify-between py-6 px-4 bg-[#1e1f20] transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-20'} border-r border-[#28292a]`}>
        <div className="space-y-6">
          <div className="flex items-center gap-4 px-2">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-slate-200">
              <Menu size={24} />
            </button>
            {isSidebarOpen && <span className="text-xl font-medium text-slate-200">Gemini</span>}
          </div>
          
          <button 
            className={`flex items-center gap-3 px-4 py-3 rounded-full bg-[#28292a] text-slate-200 hover:bg-[#333537] transition-colors ${!isSidebarOpen ? 'justify-center px-0 w-12 h-12' : ''}`}
            onClick={initializeNewChat}
          >
            <Plus size={20} className="text-slate-300" />
            {isSidebarOpen && <span className="text-sm font-medium">New Chat</span>}
          </button>

          {isSidebarOpen && (
            <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
              <p className="px-4 text-xs font-medium text-slate-400 sticky top-0 bg-[#1e1f20] py-1">Recent</p>
              {chatHistory.map(session => (
                <div 
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`px-4 py-2 text-sm text-slate-300 hover:bg-[#28292a] rounded-full cursor-pointer truncate transition-colors ${currentSessionId === session.id ? 'bg-[#28292a] text-white' : ''}`}
                  title={session.title}
                >
                  {session.title}
                </div>
              ))}
              {chatHistory.length === 0 && (
                <div className="px-4 py-2 text-xs text-slate-500 italic">
                  No history yet
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button className={`flex items-center gap-3 px-4 py-2 rounded-full hover:bg-[#28292a] text-slate-300 transition-colors ${!isSidebarOpen ? 'justify-center' : ''}`}>
            <HelpCircle size={20} />
            {isSidebarOpen && <span className="text-sm">Help</span>}
          </button>
          <button className={`flex items-center gap-3 px-4 py-2 rounded-full hover:bg-[#28292a] text-slate-300 transition-colors ${!isSidebarOpen ? 'justify-center' : ''}`}>
            <Activity size={20} />
            {isSidebarOpen && <span className="text-sm">Activity</span>}
          </button>
          <button className={`flex items-center gap-3 px-4 py-2 rounded-full hover:bg-[#28292a] text-slate-300 transition-colors ${!isSidebarOpen ? 'justify-center' : ''}`}>
            <Settings size={20} />
            {isSidebarOpen && <span className="text-sm">Settings</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#131314]">
        <header className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-medium text-slate-200">{activeTab === 'VOICE' ? 'Gemini Live' : 'Gemini'}</span>
            {isConnected && (
               <button
                 onClick={() => captureAndSendSnapshot()}
                 className="ml-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-medium transition-colors border border-blue-600/30"
                 title="Share current canvas view with Gemini"
               >
                 <ImageIcon size={14} />
                 Share Canvas
               </button>
            )}
            {activeTab === 'VOICE' && (
               <Badge variant={connectionBadge.variant} className="ml-2">
                <span className="h-2 w-2 rounded-full bg-current opacity-80 mr-1.5" />
                {connectionBadge.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            {activeTab === 'VOICE' && (
               <Button variant="ghost" size="sm" onClick={handleEndVoiceSession} className="text-red-400 hover:text-red-300 hover:bg-red-950/30">
                 End Session
               </Button>
            )}
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shadow-md">
              D
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 ml-2">
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'TEXT' ? (
            <GeminiLiveChatInterface 
              apiKey={apiKey}
              liveTranscripts={transcripts}
              onMessagesChange={handleMessagesChange}
              onModeChange={setChatMode}
              initialMessages={chatMessages}
              initialMode={chatMode}
              onStartVoiceSession={handleStartVoiceSession}
              key={currentSessionId} // Re-mount when switching sessions to reset internal state if needed, though we pass initialMessages
            />
          ) : (
            <div className="h-full flex flex-col p-6 gap-6 animate-in fade-in duration-300">
               {/* Voice Mode Layout */}
               <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] flex-1 min-h-0">
                  <div className="flex flex-col gap-4">
                    <Card className="border-slate-800/60 bg-gradient-to-br from-slate-900 to-slate-900/50 flex-1 border-none shadow-2xl ring-1 ring-white/10">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                          <Sparkles className="h-4 w-4 text-cyan-300" />
                          {simulationState.isActive ? 'Learning Canvas' : 'Audio Visualizer'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 h-full min-h-[400px] relative">
                        {simulationState.isActive ? (
                          <GeminiLiveVisualization visualizationState={simulationState} onExpandImage={handleCanvasImageExpand} />
                        ) : (
                          <div className="h-full w-full rounded-b-xl overflow-hidden">
                            <GeminiLiveAudioVisualizer analyser={analyser} isConnected={isConnected} isSpeaking={isSpeaking} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    
                    <GeminiLiveVoiceStatus
                      isListening={isListening}
                      isSpeaking={isSpeaking}
                      isConnected={connectionState === ConnectionState.CONNECTED}
                      isConnecting={isConnecting}
                      onToggleConnection={handleToggleConnection}
                      isButtonDisabled={false}
                      error={error}
                    />
                  </div>

                  <div className="flex flex-col gap-4 h-full overflow-hidden">
                    <Card className="flex-1 flex flex-col border-slate-800/60 bg-slate-900/50 border-none shadow-xl ring-1 ring-white/10 overflow-hidden">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
                          <MessageCircle className="h-4 w-4 text-cyan-300" />
                          Live Transcript
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 p-0 overflow-hidden">
                        <GeminiLiveMessageList transcripts={transcripts} />
                      </CardContent>
                    </Card>
                  </div>
               </div>
            </div>
          )}
        </div>

        <GeminiLiveImageLightbox image={expandedImage} onClose={handleCloseLightbox} />

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
      </div>
    </div>
  );
};

export default GeminiLiveWorkspace;
