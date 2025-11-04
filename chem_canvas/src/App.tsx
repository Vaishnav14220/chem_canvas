import React, { useState, useEffect } from 'react';
import { FileText, Settings, Search, Sparkles, Beaker, FlaskConical, Edit3, Palette, MessageSquare, BookOpen, User, Plus, File, Video, Globe, Upload, Clipboard, Headphones, LineChart, Target, X, Menu, Clock, LogOut, Atom, ExternalLink } from 'lucide-react';
import Canvas from './components/Canvas';
import AIChat from './components/AIChat';
import LobeChat from './components/LobeChat';
import CommandPalette from './components/CommandPalette';
import StudyTools from './components/StudyTools';
import MoldrawEmbed from './components/MoldrawEmbed';
import Login from './components/Login';
import ProfileUpdate from './components/ProfileUpdate';
import Calculator from './components/Calculator';
import MolecularViewer from './components/MolecularViewer';
import PeriodicTable from './components/PeriodicTable';
import { getStoredAPIKey, storeAPIKey, initializeWithProvidedAPIKey } from './services/canvasAnalyzer';
import { UserProfile, setupAuthStateListener } from './firebase/auth';
import { checkApiKeysInitialized, displayAllApiKeys } from './firebase/apiKeys';
import { initializeFirebaseOnStartup } from './utils/initializeFirebase';
import { loadSession, saveSession, getSessionStatus, extendSession } from './utils/sessionStorage';
import * as geminiService from './services/geminiService';
import ChemistryWidgetPanel from './components/ChemistryWidgetPanel';
import DarkButtonWithIcon from './components/DarkButtonWithIcon';
import ArMobileView from './components/ArMobileView';
import SrlCoachWorkspace from './components/SrlCoachWorkspace';
import AdaptivePlan from './components/AdaptivePlan';
import FlippingInfo from './components/FlippingInfo';
import RdkitWorkspace from './components/RdkitWorkspace';
import type { AIInteraction, InteractionMode } from './types';

const NMR_ASSISTANT_PROMPT = `You are ChemAssist's NMR laboratory mentor embedded next to the NMRium spectrum viewer. Your job is to guide students through NMR data analysis, molecule preparation and interpretation. Always:
• Explain steps clearly and reference relevant controls inside NMRium when appropriate.
• Provide SMILES strings whenever asked for structures, together with short safety or usage notes.
• Suggest best practices for importing JCAMP-DX files, peak picking, assignments, integrations and spectrum overlays.
• Stay concise and student-friendly, but add detail if the learner asks for deeper explanations.`;

const RDKIT_ASSISTANT_PROMPT = `You are ChemAssist's RDKit workflow mentor embedded next to the RDKit.js analysis workspace. Always:
- Reference RDKit.js APIs (e.g., \`mol.get_descriptors()\`, \`get_svg()\`, \`get_substruct_matches()\`) when explaining steps.
- Suggest SMARTS patterns and descriptor strategies for the student to try in the workspace UI.
- Warn about sanitisation issues, stereochemistry handling, and large-molecule performance when relevant.
- Keep explanations concise and student-friendly, expanding when deeper detail is requested.`;

type StudyToolType =
  | 'audio'
  | 'video'
  | 'mindmap'
  | 'reports'
  | 'flashcards'
  | 'quiz'
  | 'notes'
  | 'documents'
  | 'designer'
  | 'chat'
  | 'tests';

const App: React.FC = () => {
  const isArRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/ar/');

  if (isArRoute) {
    return <ArMobileView />;
  }

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showProfileUpdate, setShowProfileUpdate] = useState(false);
  
  // Calculator state
  const [showCalculator, setShowCalculator] = useState(false);
  
  // MolView state
  const [showMolView, setShowMolView] = useState(false);
  
  // Periodic Table state
  const [showPeriodicTable, setShowPeriodicTable] = useState(false);
  
  // Canvas and UI state
  const [currentTool] = useState('pen');
  const [strokeWidth] = useState(2);
  const [strokeColor] = useState('#00FFFF');
  const [isMolecularMode, setIsMolecularMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // Sources state
  const [sources, setSources] = useState<Array<{
    id: string;
    type: 'document' | 'youtube' | 'weblink' | 'image' | 'paste';
    title: string;
    url?: string;
    content?: string;
    description?: string;
  }>>([]);
  const [activeSourceType, setActiveSourceType] = useState<'document' | 'youtube' | 'weblink' | 'image' | 'paste'>('document');
  const [showStudyTools, setShowStudyTools] = useState(false);
  const [selectedStudyTool, setSelectedStudyTool] = useState<StudyToolType>('mindmap');
  const [interactions, setInteractions] = useState<AIInteraction[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [isNmrAssistantActive, setIsNmrAssistantActive] = useState(false);
  const [showNmrAssistant, setShowNmrAssistant] = useState(false);
  const [showRdkitWorkspace, setShowRdkitWorkspace] = useState(false);
  const [showRdkitAssistant, setShowRdkitAssistant] = useState(false);
  const [isRdkitAssistantActive, setIsRdkitAssistantActive] = useState(false);
  const [rdkitStatus, setRdkitStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  
  // Panel sizes and visibility
  const [sourcesWidth, setSourcesWidth] = useState(384);
  const [chatWidth, setChatWidth] = useState(320);
  const CHAT_MIN_WIDTH = 280;
  const CHAT_MAX_WIDTH = 520;
  const [studyToolsWidth, setStudyToolsWidth] = useState(360);
  const [showStudyToolsPanel, setShowStudyToolsPanel] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showChemistryPanel, setShowChemistryPanel] = useState(false);
  const [chemistryPanelInitialView] = useState<'overview' | 'nmr'>('overview');
  const [showNmrFullscreen, setShowNmrFullscreen] = useState(false);
  const [showSrlCoachWorkspace, setShowSrlCoachWorkspace] = useState(false);
  const [showAdaptivePlan, setShowAdaptivePlan] = useState(false);
  
  // Resize states
  const [isResizing, setIsResizing] = useState<'sources' | 'chat' | 'studyTools' | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [apiKey, setApiKey] = useState('');

  // Load API key and check for existing session on component mount
  useEffect(() => {
    const initializeApp = async () => {
      // Initialize Firebase API keys first
      await initializeFirebaseOnStartup();
      
      let storedKey = getStoredAPIKey();
      if (!storedKey) {
        // Initialize with provided API key if none exists
        initializeWithProvidedAPIKey();
        storedKey = getStoredAPIKey();
      }
      
      if (storedKey) {
        setApiKey(storedKey);
      }
      // ⚠️ SECURITY: Never hardcode API keys in client code
      // Users should configure their own API keys via Settings
    };
    
    initializeApp();
    
    // Check for existing session
    const checkExistingSession = () => {
      const session = loadSession();
      if (session && session.isAuthenticated) {
        const sessionStatus = getSessionStatus();
        if (sessionStatus.isValid) {
          console.log(`Valid session found! Expires in ${sessionStatus.remainingHours} hours`);
          setUser(session.userProfile);
          setIsAuthenticated(true);
          
          // Set the user's API key if available
          if (session.userProfile.geminiApiKey) {
            setApiKey(session.userProfile.geminiApiKey);
            storeAPIKey(session.userProfile.geminiApiKey);
          }
        } else {
          console.log('Session expired, clearing...');
        }
      }
    };
    
    // Set up Firebase auth state listener
    const unsubscribe = setupAuthStateListener((userProfile) => {
      if (userProfile) {
        setUser(userProfile);
        setIsAuthenticated(true);
        
        // Set the user's API key if available
        if (userProfile.geminiApiKey) {
          setApiKey(userProfile.geminiApiKey);
          storeAPIKey(userProfile.geminiApiKey);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });
    
    // Check for existing session first
    checkExistingSession();
    
    // Initialize API keys in Firebase on app start
    const initApiKeys = async () => {
      try {
        const isInitialized = await checkApiKeysInitialized();
        if (!isInitialized) {
          console.log('API keys not initialized in Firebase - this is expected for client-side');
        } else {
          console.log('API keys initialized in Firebase');
        }
        
        // Display all API keys in console
        await displayAllApiKeys();
      } catch (error) {
        console.error('Error initializing API keys:', error);
      }
    };
    
    initApiKeys();
    
    // Cleanup function
    return () => {
      unsubscribe();
    };
  }, []);

  // Login handler
  const handleLogin = (userProfile: UserProfile) => {
    setUser(userProfile);
    setIsAuthenticated(true);
    
    // Save session for 2 days
    saveSession(userProfile);
    
    // Set the user's API key if available
    if (userProfile.geminiApiKey) {
      setApiKey(userProfile.geminiApiKey);
      storeAPIKey(userProfile.geminiApiKey);
      console.log('User API key loaded:', userProfile.geminiApiKey);
    }
    
    console.log('User logged in and session saved for 2 days');
  };

  // Logout handler
  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    console.log('User logged out and session cleared');
  };

  // Profile update handlers
  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setUser(updatedProfile);
  };

  const handleCloseProfileUpdate = () => {
    setShowProfileUpdate(false);
  };

  // Calculator handlers
  const handleOpenCalculator = () => {
    setShowCalculator(true);
  };

  const handleCloseCalculator = () => {
    setShowCalculator(false);
  };

  // MolView handlers
  const handleOpenMolView = () => {
    setShowMolView(true);
  };

  const handleCloseMolView = () => {
    setShowMolView(false);
  };

  // Periodic Table handlers
  const handleOpenPeriodicTable = () => {
    setShowPeriodicTable(true);
  };

  const handleClosePeriodicTable = () => {
    setShowPeriodicTable(false);
  };

  // Sources handlers
  const addSource = (type: 'document' | 'youtube' | 'weblink' | 'image' | 'paste', data: any) => {
    const newSource = {
      id: Date.now().toString(),
      type,
      title: data.title || 'Untitled',
      url: data.url,
      content: data.content,
      description: data.description
    };
    setSources(prev => [...prev, newSource]);
  };

  const removeSource = (id: string) => {
    setSources(prev => prev.filter(source => source.id !== id));
  };

  // Resize handlers
  const handleMouseDown = (panel: 'sources' | 'chat' | 'studyTools', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Mouse down on', panel, 'panel'); // Debug log
    setIsResizing(panel);
    setResizeStartX(e.clientX);
    setResizeStartWidth(
      panel === 'sources' ? sourcesWidth :
      panel === 'chat' ? chatWidth :
      studyToolsWidth
    );
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - resizeStartX;
    let newWidth;
    
    console.log('Mouse move, resizing:', isResizing, 'deltaX:', deltaX); // Debug log
    
    if (isResizing === 'sources') {
      newWidth = Math.max(250, Math.min(800, resizeStartWidth + deltaX));
      setSourcesWidth(newWidth);
    } else if (isResizing === 'chat') {
      // For chat panel: dragging right (positive deltaX) should increase width
      // Since resize handle is on the left of chat panel, we add deltaX
      newWidth = Math.max(280, Math.min(800, resizeStartWidth + deltaX));
      console.log('Chat resize - Start:', resizeStartWidth, 'Delta:', deltaX, 'New:', newWidth);
      const boundedWidth = Math.max(CHAT_MIN_WIDTH, Math.min(CHAT_MAX_WIDTH, newWidth));
      setChatWidth(boundedWidth);
    } else if (isResizing === 'studyTools') {
      newWidth = Math.max(250, Math.min(600, resizeStartWidth + deltaX));
      setStudyToolsWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(null);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resizeStartX, resizeStartWidth]);


  const handleSaveSettings = () => {
    storeAPIKey(apiKey);
    initializeWithProvidedAPIKey();
    geminiService.setApiKey(apiKey);
    // Also set for live chat compatibility
    localStorage.setItem('gemini-api-key', apiKey);
    setShowSettings(false);
    alert('Settings saved successfully!');
  };

  const handleSendMessage = async (
    message: string,
    options?: { mode?: InteractionMode }
  ) => {
    const mode: InteractionMode = options?.mode ?? 'chat';
    const setLoading = mode === 'coach' ? setCoachLoading : setChatLoading;
    setLoading(true);
    
    // Add user message immediately
    const userInteraction: AIInteraction = {
      id: Date.now().toString(),
      prompt: message,
      response: '', // Will be updated with AI response
      timestamp: new Date(),
      mode,
    };
    setInteractions(prev => [...prev, userInteraction]);
    
    try {
      // Check if Gemini API is configured
      if (!geminiService.isGeminiInitialized()) {
        const errorResponse = { 
          id: (Date.now() + 1).toString(),
          prompt: '',
          response: `🔑 **API Key Required**\n\nTo use the chat assistant, please configure your Gemini API key first.\n\n1. Click the Settings button (⚙️) in the toolbar\n2. Enter your Google Gemini API key\n3. Save the configuration\n\nGet your free API key at: https://makersuite.google.com/app/apikey`,
          timestamp: new Date(),
          mode,
        };
        setInteractions(prev => [...prev, errorResponse]);
          setLoading(false);
          return;
        }

      // Build context from sources if available
      let contextPrompt = '';
      if (sources.length > 0) {
        contextPrompt = '**Document Context:**\n';
        sources.forEach((source, index) => {
          contextPrompt += `\n**Source ${index + 1}: ${source.title}**\n${(source.content || '').substring(0, 2000)}...\n`;
        });
        contextPrompt += '\n**User Question:** ';
      }

      let assistantGuidance = message;
      if (isNmrAssistantActive) {
        assistantGuidance = `${NMR_ASSISTANT_PROMPT}

Here is the learner's question: ${message}`;
      } else if (isRdkitAssistantActive) {
        assistantGuidance = `${RDKIT_ASSISTANT_PROMPT}

Here is the learner's question: ${message}`;
      }

      const fullPrompt = contextPrompt + assistantGuidance;

      const assistantId = (Date.now() + 1).toString();
      const assistantInteraction: AIInteraction = {
        id: assistantId,
        prompt: '',
        response: '',
        timestamp: new Date(),
        mode,
      };
      setInteractions(prev => [...prev, assistantInteraction]);

      const finalResponse = await geminiService.streamTextContent(fullPrompt, (chunk) => {
        if (!chunk) return;
        setInteractions(prev => prev.map(interaction => {
          if (interaction.id === assistantId) {
            return {
              ...interaction,
              response: (interaction.response || '') + chunk
            };
          }
          return interaction;
        }));
      });

      setInteractions(prev => prev.map(interaction =>
        interaction.id === assistantId ? { ...interaction, response: finalResponse } : interaction
      ));
      
    } catch (error: any) {
      console.error('Gemini API error:', error);
      const errorResponse = { 
        id: (Date.now() + 1).toString(),
        prompt: '',
        response: `❌ **Error**: ${error.message || 'Failed to generate response'}\n\nPlease check:\n• Your API key is correct\n• You have internet connection\n• You haven't exceeded API quota`,
        timestamp: new Date(),
        mode,
      };
      setInteractions(prev => [...prev, errorResponse]);
    } finally {
      setLoading(false);
    }
    
    if (sources.length > 0 && message.toLowerCase().includes('source')) {
      setDocumentViewerOpen(true);
    }
  };

  const handleCommand = (command: string) => {
    setCommandPaletteOpen(false);
    
    switch (command) {
      case 'toggle-sources':
        setDocumentViewerOpen(!documentViewerOpen);
        break;
      case 'open-settings':
        setShowSettings(!showSettings);
        break;
      case 'generate-audio-overview':
        setSelectedStudyTool('audio');
        setShowStudyTools(true);
        break;
      case 'generate-video-overview':
        setSelectedStudyTool('video');
        setShowStudyTools(true);
        break;
      case 'create-mind-map':
        setSelectedStudyTool('mindmap');
        setShowStudyTools(true);
        break;
      case 'generate-reports':
        setSelectedStudyTool('reports');
        setShowStudyTools(true);
        break;
      case 'create-flashcards':
        setSelectedStudyTool('flashcards');
        setShowStudyTools(true);
        break;
      case 'generate-quiz':
        setSelectedStudyTool('quiz');
        setShowStudyTools(true);
        break;
      case 'open-notes':
        setSelectedStudyTool('notes');
        setShowStudyTools(true);
        break;
      case 'open-documents':
        setSelectedStudyTool('documents');
        setShowStudyTools(true);
        break;
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            setCommandPaletteOpen(true);
            break;
          case 'd':
            e.preventDefault();
            setDocumentViewerOpen(!documentViewerOpen);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documentViewerOpen]);

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center px-6">
          {/* Logo and Brand */}
          <div className="mr-8 flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="flex flex-col">
                <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Studium
                </span>
                <span className="text-xs text-muted-foreground">Chemistry Workspace</span>
              </div>
            </div>

            {/* AI Status Badge */}
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">AI Connected</span>
              <span className="text-xs text-muted-foreground">Gemini 2.0</span>
            </div>
          </div>

          {/* Main Navigation */}
          <div className="flex flex-1 items-center justify-between">
            {/* Primary Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md h-9 px-3"
              >
                <Search className="mr-2 h-4 w-4" />
                Search
                <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100">
                  <span className="text-xs">⌘K</span>
                </kbd>
              </button>

              <div className="hidden md:flex items-center space-x-1">
                <button
                  onClick={() => setDocumentViewerOpen(!documentViewerOpen)}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md h-9 px-3"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {documentViewerOpen ? 'Hide Sources' : 'Sources'}
                </button>

                <button
                  onClick={() => setShowStudyToolsPanel(!showStudyToolsPanel)}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md h-9 px-3"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Study Tools
                </button>
              </div>
            </div>

            {/* Flipping Info Display */}
            <div className="hidden lg:flex items-center">
              <FlippingInfo userName={user?.username || user?.displayName || 'User'} />
            </div>

            {/* Secondary Actions & User */}
            <div className="flex items-center space-x-2">
              {/* Tool Buttons - Collapsed on mobile */}
              <div className="hidden lg:flex items-center space-x-1">
                <button
                  onClick={() => setIsMolecularMode(!isMolecularMode)}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3 ${
                    isMolecularMode
                      ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  } hover:shadow-md`}
                >
                  {isMolecularMode ? <Beaker className="mr-2 h-4 w-4" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                  {isMolecularMode ? 'Simple' : 'Canvas'}
                </button>

                <button
                  onClick={() => {
                    setShowSrlCoachWorkspace(true);
                    setShowChatPanel(false);
                    setShowNmrFullscreen(false);
                    setShowRdkitWorkspace(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                  }}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md h-9 px-3"
                >
                  <Target className="mr-2 h-4 w-4" />
                  SRL
                </button>

                <button
                  onClick={() => {
                    setShowRdkitWorkspace(true);
                    setShowSrlCoachWorkspace(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                  }}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md h-9 px-3"
                >
                  <Atom className="mr-2 h-4 w-4" />
                  RDKit
                </button>

                <button
                  onClick={() => {
                    setShowNmrFullscreen(true);
                    setShowRdkitWorkspace(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setIsNmrAssistantActive(false);
                    setShowChatPanel(false);
                  }}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:shadow-md h-9 px-3"
                >
                  <LineChart className="mr-2 h-4 w-4" />
                  NMR
                </button>
              </div>

              {/* Mobile Menu Button */}
              <div className="lg:hidden">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </div>

              {/* Session Status */}
              {isAuthenticated && (() => {
                const sessionStatus = getSessionStatus();
                if (sessionStatus.isValid && sessionStatus.remainingHours) {
                  return (
                    <div className="hidden sm:flex items-center px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <Clock className="mr-1.5 h-3 w-3 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        {sessionStatus.remainingHours}h
                      </span>
                      {sessionStatus.remainingHours < 24 && (
                        <button
                          onClick={() => {
                            if (extendSession(2)) {
                              console.log('Session extended by 2 days');
                              window.location.reload();
                            }
                          }}
                          className="ml-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Extend
                        </button>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {/* User Menu */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowProfileUpdate(true)}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
                  title="Update Profile"
                >
                  <User className="h-4 w-4" />
                </button>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
                >
                  <Settings className="h-4 w-4" />
                </button>

                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 hover:shadow-md h-9 px-3"
                  title={`Logged in as ${user?.username || user?.displayName}`}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{user?.username || user?.displayName}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur">
            <div className="container py-4 px-6">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDocumentViewerOpen(!documentViewerOpen)}
                  className="flex items-center justify-center space-x-2 p-3 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Sources</span>
                </button>

                <button
                  onClick={() => setShowStudyToolsPanel(!showStudyToolsPanel)}
                  className="flex items-center justify-center space-x-2 p-3 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm">Study Tools</span>
                </button>

                <button
                  onClick={() => setIsMolecularMode(!isMolecularMode)}
                  className="flex items-center justify-center space-x-2 p-3 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                >
                  {isMolecularMode ? <Beaker className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
                  <span className="text-sm">{isMolecularMode ? 'Simple' : 'Canvas'}</span>
                </button>

                <button
                  onClick={() => {
                    setShowSrlCoachWorkspace(true);
                    setShowChatPanel(false);
                    setShowNmrFullscreen(false);
                    setShowRdkitWorkspace(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setRdkitStatus('idle');
                  }}
                  className="flex items-center justify-center space-x-2 p-3 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                >
                  <Target className="h-4 w-4" />
                  <span className="text-sm">SRL Coach</span>
                </button>

                <button
                  onClick={() => {
                    setShowRdkitWorkspace(true);
                    setShowSrlCoachWorkspace(false);
                    setShowNmrFullscreen(false);
                    setShowChemistryPanel(false);
                    setShowChatPanel(false);
                    setIsNmrAssistantActive(false);
                    setShowNmrAssistant(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                  }}
                  className="flex items-center justify-center space-x-2 p-3 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                >
                  <Atom className="h-4 w-4" />
                  <span className="text-sm">RDKit Workspace</span>
                </button>

                <button
                  onClick={() => {
                    setShowNmrFullscreen(true);
                    setShowRdkitWorkspace(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setIsNmrAssistantActive(false);
                    setShowChatPanel(false);
                  }}
                  className="flex items-center justify-center space-x-2 p-3 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                >
                  <LineChart className="h-4 w-4" />
                  <span className="text-sm">NMR Viewer</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onCommand={handleCommand}
      />

      {/* Study Tools Modal */}
      {showStudyTools && (
        <StudyTools
          isOpen={showStudyTools}
          onClose={() => setShowStudyTools(false)}
          sourceContent={sources.filter(s => s.content).map(s => s.content).join('\n\n')}
          sourceName={sources.length > 0 ? `${sources.length} sources` : 'No sources'}
          toolType={selectedStudyTool}
        />
      )}

      {/* Fullscreen NMR viewer */}
      {showSrlCoachWorkspace ? (
        <SrlCoachWorkspace
          interactions={interactions}
          onSendMessage={handleSendMessage}
          isLoading={coachLoading}
          documentName={sources.length > 0 ? `${sources.length} sources` : 'No sources'}
          onOpenDocument={() => setDocumentViewerOpen(true)}
          user={user}
        onClose={() => {
          setShowSrlCoachWorkspace(false);
          setShowChatPanel(false);
          setIsNmrAssistantActive(false);
          setShowNmrAssistant(false);
          setIsRdkitAssistantActive(false);
          setShowRdkitAssistant(false);
        }}
      />
      ) : showRdkitWorkspace ? (
        <div className="flex h-[calc(100vh-5rem)] flex-col">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-950 border-b border-slate-800 px-4 md:px-6 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">RDKit.js Workspace</h2>
              <p className="text-xs text-slate-400">
                {rdkitStatus === 'loading'
                  ? 'Parsing molecule with RDKit...'
                  : rdkitStatus === 'error'
                    ? 'An RDKit error occurred – check the workspace pane.'
                    : 'Interactively compute descriptors, SMARTS matches, and SVG depictions.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const next = !showRdkitAssistant;
                  setShowRdkitAssistant(next);
                  setIsRdkitAssistantActive(next);
                  setIsNmrAssistantActive(false);
                  setShowNmrAssistant(false);
                  setShowChatPanel(false);
                }}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded ${showRdkitAssistant ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800'}`}
              >
                <Headphones className="h-4 w-4" />
                {showRdkitAssistant ? 'Hide RDKit Assistant' : 'Open RDKit Assistant'}
              </button>
              <button
                onClick={() => window.open('https://docs.rdkitjs.com/', '_blank', 'noopener')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                <BookOpen className="h-4 w-4" /> Docs
              </button>
              <button
                onClick={() => window.open('https://www.rdkitjs.com/', '_blank', 'noopener')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                <ExternalLink className="h-4 w-4" /> Playground
              </button>
              <button
                onClick={() => {
                  setShowRdkitWorkspace(false);
                  setShowRdkitAssistant(false);
                  setIsRdkitAssistantActive(false);
                  setShowChatPanel(false);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-500"
              >
                Exit RDKit View
              </button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className={`flex-1 overflow-hidden ${showRdkitAssistant ? 'lg:pr-0' : ''}`}>
              <RdkitWorkspace onStatusChange={setRdkitStatus} />
            </div>
            {showRdkitAssistant && (
              <aside className="flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-950">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-white">RDKit Assistant</h3>
                    <p className="text-xs text-slate-400">Descriptor tips, SMARTS patterns, workflow help</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowRdkitAssistant(false);
                      setIsRdkitAssistantActive(false);
                      setShowChatPanel(false);
                    }}
                    className="text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-md"
                  >
                    Close Chat
                  </button>
                </div>
                <div className="flex-1 overflow-hidden bg-slate-950">
                  <AIChat
                    onSendMessage={handleSendMessage}
                    interactions={interactions}
                    isLoading={chatLoading}
                    documentName="RDKit Workspace"
                  />
                </div>
              </aside>
            )}
          </div>
        </div>
      ) : showNmrFullscreen ? (
        <div className="flex h-[calc(100vh-5rem)] flex-col">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">NMRium Viewer (Fullscreen)</h2>
              <p className="text-xs text-slate-400">Embedded from the NFDI4Chem public instance.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setShowNmrAssistant(prev => {
                    const next = !prev;
                    setIsNmrAssistantActive(next);
                    if (!next) {
                      setShowChatPanel(false);
                    }
                    return next;
                  });
                }}
                className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded ${showNmrAssistant ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700'}`}
              >
                <Headphones className="h-4 w-4" />
                {showNmrAssistant ? 'Hide NMR Assistant' : 'Open NMR Assistant'}
              </button>
              <button
                onClick={() => window.open('https://nmrium.nmrxiv.org?workspace=default', '_blank', 'noopener')}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700"
              >
                <LineChart className="h-4 w-4" /> Open in new tab
              </button>
              <button
                onClick={() => {
                  setShowNmrFullscreen(false);
                  setIsNmrAssistantActive(false);
                  setShowNmrAssistant(false);
                  setShowChatPanel(false);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-500"
              >
                Exit NMR View
              </button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className={`flex-1 overflow-hidden ${showNmrAssistant ? 'lg:pr-0' : ''}`}>
              <iframe
                title="nmrium-fullscreen"
                src="https://nmrium.nmrxiv.org?workspace=default"
                className="h-full w-full"
                allowFullScreen
              />
            </div>
            {showNmrAssistant && (
              <aside className="flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-900">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-white">NMR Assistant</h3>
                    <p className="text-xs text-slate-400">Guide, SMILES suggestions, and spectrum tips</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowNmrAssistant(false);
                      setIsNmrAssistantActive(false);
                      setShowChatPanel(false);
                    }}
                    className="text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-md"
                  >
                    Close Chat
                  </button>
                </div>
                <div className="flex-1 overflow-hidden bg-slate-900">
                  <AIChat
                    onSendMessage={handleSendMessage}
                    interactions={interactions}
                    isLoading={chatLoading}
                    documentName="NMRium Workspace"
                  />
                </div>
              </aside>
            )}
          </div>
        </div>
      ) : (
      <div className="flex h-[calc(100vh-5rem)]">
        {/* Sources Panel */}
        {documentViewerOpen && (
          <>
            <div 
              className="border-r-2 border-border bg-card flex flex-col shadow-lg"
              style={{ width: sourcesWidth }}
            >
              {/* Sources Header */}
              <div className="px-6 py-4 border-b border-border bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                      <FileText className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Sources</h3>
                      <p className="text-xs text-muted-foreground">Add documents, videos & links</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDocumentViewerOpen(false)}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Source Type Tabs */}
              <div className="px-6 py-3 border-b border-border">
                <div className="grid grid-cols-5 gap-1 bg-muted/30 rounded-lg p-1">
                  {[
                    { type: 'document', icon: File, label: 'Docs', color: 'text-blue-500' },
                    { type: 'youtube', icon: Video, label: 'Video', color: 'text-red-500' },
                    { type: 'weblink', icon: Globe, label: 'Web', color: 'text-green-500' },
                    { type: 'image', icon: Upload, label: 'Image', color: 'text-purple-500' },
                    { type: 'paste', icon: Clipboard, label: 'Paste', color: 'text-orange-500' }
                  ].map(({ type, icon: Icon, label, color }) => (
                    <button
                      key={type}
                      onClick={() => setActiveSourceType(type as any)}
                      className={`flex flex-col items-center justify-center py-3 px-2 rounded-md text-xs font-medium transition-all duration-200 ${
                        activeSourceType === type
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-1 ${activeSourceType === type ? 'text-primary-foreground' : color}`} />
                      <span className="text-xs">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Add Source Section */}
              <div className="p-6 border-b border-border">
                {activeSourceType === 'document' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <File className="h-5 w-5 text-blue-500" />
                      <span className="text-sm font-medium">Upload Document</span>
                    </div>
                    <label className="w-full cursor-pointer block">
                      <div className="border-2 border-dashed border-blue-300 hover:border-blue-400 bg-blue-50/10 hover:bg-blue-50/20 rounded-xl p-8 transition-all duration-300">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-500 shadow-lg">
                            <File className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-blue-600">Drop your document here</p>
                            <p className="text-xs text-muted-foreground mt-1">PDF, TXT, MD files supported</p>
                          </div>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.txt,.md"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.type === 'text/plain') {
                              const text = await file.text();
                              addSource('document', {
                                title: file.name,
                                content: text,
                                description: `${text.length} characters`
                              });
                            } else {
                              alert('PDF support coming soon! Try uploading a .txt file.');
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {activeSourceType === 'youtube' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Video className="h-5 w-5 text-red-500" />
                      <span className="text-sm font-medium">Add YouTube Video</span>
                    </div>
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Video title"
                          className="w-full px-4 py-3 bg-muted border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                          id="youtube-title"
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="url"
                          placeholder="YouTube URL (e.g., https://youtube.com/watch?v=...)"
                          className="w-full px-4 py-3 bg-muted border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                          id="youtube-url"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const title = (document.getElementById('youtube-title') as HTMLInputElement)?.value;
                          const url = (document.getElementById('youtube-url') as HTMLInputElement)?.value;
                          if (title && url) {
                            addSource('youtube', { title, url, description: 'YouTube video' });
                            (document.getElementById('youtube-title') as HTMLInputElement).value = '';
                            (document.getElementById('youtube-url') as HTMLInputElement).value = '';
                          }
                        }}
                        className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        Add Video
                      </button>
                    </div>
                  </div>
                )}

                {activeSourceType === 'weblink' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Globe className="h-5 w-5 text-green-500" />
                      <span className="text-sm font-medium">Add Web Link</span>
                    </div>
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Link title"
                          className="w-full px-4 py-3 bg-muted border border-green-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          id="link-title"
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="url"
                          placeholder="Website URL"
                          className="w-full px-4 py-3 bg-muted border border-green-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          id="link-url"
                        />
                      </div>
                      <div className="relative">
                        <textarea
                          placeholder="Description (optional)"
                          className="w-full px-4 py-3 bg-muted border border-green-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none transition-all"
                          rows={3}
                          id="link-description"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const title = (document.getElementById('link-title') as HTMLInputElement)?.value;
                          const url = (document.getElementById('link-url') as HTMLInputElement)?.value;
                          const description = (document.getElementById('link-description') as HTMLTextAreaElement)?.value;
                          if (title && url) {
                            addSource('weblink', { title, url, description });
                            (document.getElementById('link-title') as HTMLInputElement).value = '';
                            (document.getElementById('link-url') as HTMLInputElement).value = '';
                            (document.getElementById('link-description') as HTMLTextAreaElement).value = '';
                          }
                        }}
                        className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        Add Link
                      </button>
                    </div>
                  </div>
                )}

                {activeSourceType === 'image' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Upload className="h-5 w-5 text-purple-500" />
                      <span className="text-sm font-medium">Add Image</span>
                    </div>
                    <label className="w-full cursor-pointer block">
                      <div className="border-2 border-dashed border-purple-300 hover:border-purple-400 bg-purple-50/10 hover:bg-purple-50/20 rounded-xl p-8 transition-all duration-300">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-purple-500 shadow-lg">
                            <Upload className="h-8 w-8 text-white" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-purple-600">Drop your image here</p>
                            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF files supported</p>
                          </div>
                        </div>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              addSource('image', {
                                title: file.name,
                                url: event.target?.result as string,
                                description: `${file.size} bytes`
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                {activeSourceType === 'paste' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Clipboard className="h-5 w-5 text-orange-500" />
                      <span className="text-sm font-medium">Paste Your Material</span>
                    </div>
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Material title"
                          className="w-full px-4 py-3 bg-muted border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                          id="paste-title"
                        />
                      </div>
                      <div className="relative">
                        <textarea
                          placeholder="Paste your text content here... (notes, articles, code, etc.)"
                          className="w-full px-4 py-3 bg-muted border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition-all"
                          rows={8}
                          id="paste-content"
                        />
                      </div>
                      <div className="relative">
                        <textarea
                          placeholder="Description (optional)"
                          className="w-full px-4 py-3 bg-muted border border-orange-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition-all"
                          rows={2}
                          id="paste-description"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const title = (document.getElementById('paste-title') as HTMLInputElement)?.value;
                          const content = (document.getElementById('paste-content') as HTMLTextAreaElement)?.value;
                          const description = (document.getElementById('paste-description') as HTMLTextAreaElement)?.value;
                          if (title && content) {
                            addSource('paste', { 
                              title, 
                              content, 
                              description: description || `${content.length} characters`
                            });
                            (document.getElementById('paste-title') as HTMLInputElement).value = '';
                            (document.getElementById('paste-content') as HTMLTextAreaElement).value = '';
                            (document.getElementById('paste-description') as HTMLTextAreaElement).value = '';
                          }
                        }}
                        className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        Add Material
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sources List */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-3">
                  {sources.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted mx-auto mb-3">
                        <Plus className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No sources added yet</p>
                      <p className="text-xs text-muted-foreground">Add documents, videos, or links above</p>
                    </div>
                  ) : (
                    sources.map((source) => (
                      <div key={source.id} className="p-4 bg-gradient-to-r from-muted/30 to-muted/50 border border-border rounded-xl hover:shadow-md transition-all duration-200">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${
                              source.type === 'youtube' ? 'bg-red-500' :
                              source.type === 'weblink' ? 'bg-green-500' :
                              source.type === 'image' ? 'bg-purple-500' :
                              source.type === 'document' ? 'bg-blue-500' :
                              'bg-orange-500'
                            }`}>
                              {source.type === 'youtube' && <Video className="h-5 w-5 text-white" />}
                              {source.type === 'weblink' && <Globe className="h-5 w-5 text-white" />}
                              {source.type === 'image' && <Upload className="h-5 w-5 text-white" />}
                              {source.type === 'document' && <File className="h-5 w-5 text-white" />}
                              {source.type === 'paste' && <Clipboard className="h-5 w-5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold truncate text-foreground">{source.title}</h4>
                              {source.description && (
                                <p className="text-xs text-muted-foreground mt-1">{source.description}</p>
                              )}
                              {source.url && source.type !== 'image' && (
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-500 hover:text-blue-400 truncate block mt-1 underline"
                                >
                                  {source.url}
                                </a>
                              )}
                              {source.type === 'image' && source.url && (
                                <img
                                  src={source.url}
                                  alt={source.title}
                                  className="mt-2 max-w-full h-20 object-cover rounded-lg border border-border"
                                />
                              )}
                              {source.type === 'paste' && source.content && (
                                <div className="mt-2 p-2 bg-muted/50 rounded-lg border border-border">
                                  <p className="text-xs text-muted-foreground line-clamp-3">
                                    {source.content.substring(0, 100)}...
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeSource(source.id)}
                            className="ml-2 p-2 hover:bg-red-100 hover:text-red-600 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200"
                            title="Remove source"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
            
            {/* Resize Handle */}
            <div
              className="w-2 bg-muted hover:bg-primary/50 cursor-col-resize transition-colors border-r border-border"
              onMouseDown={(e) => handleMouseDown('sources', e)}
            />
          </>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-background/50">
          {/* Canvas, Chat, and Study Tools */}
          <div className="flex-1 flex">
            {/* Canvas */}
            <div className="flex-1 relative">
              {isMolecularMode ? (
                <MoldrawEmbed />
              ) : (
                <Canvas
                  currentTool={currentTool}
                  strokeWidth={strokeWidth}
                  strokeColor={strokeColor}
                  onOpenCalculator={handleOpenCalculator}
                  onOpenMolView={handleOpenMolView}
                  onOpenPeriodicTable={handleOpenPeriodicTable}
                />
              )}
              

              
            </div>




            {/* Study Tools Panel */}
            {showStudyToolsPanel && (
              <>
                <div 
                  className="border-l-2 border-border bg-card flex flex-col shadow-lg"
                  style={{ width: studyToolsWidth }}
                >
                  {/* Study Tools Header */}
                  <div className="px-6 py-4 border-b border-border bg-muted/50">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Study Tools</h3>
                        <p className="text-xs text-muted-foreground">Generate content</p>
                      </div>
                    </div>
                  </div>

                  {/* Study Tools Grid */}
                  <div className="flex-1 p-6">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { name: 'Audio Overview', icon: '🎵', toolType: 'audio' },
                        { name: 'Video Overview', icon: '▶️', toolType: 'video' },
                        { name: 'Mind Map', icon: '🧠', toolType: 'mindmap' },
                        { name: 'Reports', icon: '📊', toolType: 'reports' },
                        { name: 'Flashcards', icon: '📚', toolType: 'flashcards' },
                        { name: 'Quiz', icon: '❓', toolType: 'quiz' },
                        { name: 'Adaptive Learning Plan', icon: '🎯', toolType: 'adaptive' },
                      ].map((tool) => (
                        <DarkButtonWithIcon
                          key={tool.name}
                          onClick={() => {
                            if (tool.toolType === 'adaptive') {
                              setShowAdaptivePlan(true);
                            } else {
                              setSelectedStudyTool(tool.toolType as StudyToolType);
                              setShowStudyTools(true);
                            }
                          }}
                          className="flex flex-col items-center space-y-2 p-4 h-auto"
                        >
                          <div className={`flex h-10 w-10 items-center justify-center bg-primary/10 text-primary`}>
                            <span className="text-lg">{tool.icon}</span>
                          </div>
                          <p className="text-xs font-medium text-center text-foreground">{tool.name}</p>
                        </DarkButtonWithIcon>
                      ))}
                    </div>
                    
                    {/* Quick Access Tools */}
                    <div className="mt-6 pt-4 border-t border-border">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">Quick Access</h4>
                      
                      {/* Primary Tools */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <DarkButtonWithIcon
                          onClick={() => {
                            setIsNmrAssistantActive(false);
                            setIsRdkitAssistantActive(false);
                            setShowRdkitAssistant(false);
                            setShowChatPanel(true);
                          }}
                          className="flex flex-col items-center space-y-2 p-4 h-auto"
                        >
                          <div className="flex h-10 w-10 items-center justify-center bg-primary/10 text-primary">
                            <MessageSquare className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-medium text-center">Chat</p>
                        </DarkButtonWithIcon>

                        <DarkButtonWithIcon
                          onClick={() => {
                            setIsNmrAssistantActive(false);
                            setIsRdkitAssistantActive(false);
                            setShowRdkitAssistant(false);
                            setShowChatPanel(true);
                          }}
                          className="flex flex-col items-center space-y-2 p-4 h-auto"
                        >
                          <div className="flex h-10 w-10 items-center justify-center bg-purple-500/10 text-purple-400">
                            <Headphones className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-medium text-center">Canvas Chat</p>
                        </DarkButtonWithIcon>
                        
                        <DarkButtonWithIcon
                          onClick={() => {
                            setSelectedStudyTool('tests');
                            setShowStudyTools(true);
                            setTimeout(() => {
                              const testButton = document.querySelector('[data-tool="tests"]');
                              if (testButton) (testButton as HTMLElement).click();
                            }, 100);
                          }}
                          className="flex flex-col items-center space-y-2 p-4 h-auto"
                        >
                          <div className="flex h-10 w-10 items-center justify-center bg-primary/10 text-primary">
                            <BookOpen className="h-5 w-5" />
                          </div>
                          <p className="text-xs font-medium text-center">AI Tests</p>
                        </DarkButtonWithIcon>
                      </div>
                      
                      {/* Secondary Tools */}
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">Tools</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <DarkButtonWithIcon
                          onClick={() => {
                            setSelectedStudyTool('documents');
                            setShowStudyTools(true);
                            setTimeout(() => {
                              const docButton = document.querySelector('[data-tool="documents"]');
                              if (docButton) (docButton as HTMLElement).click();
                            }, 100);
                          }}
                          className="flex flex-col items-center space-y-2 p-3 h-auto"
                        >
                          <div className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <p className="text-xs font-medium text-center">Docs</p>
                        </DarkButtonWithIcon>
                        
                        <DarkButtonWithIcon
                          onClick={() => {
                            setSelectedStudyTool('notes');
                            setShowStudyTools(true);
                            setTimeout(() => {
                              const notesButton = document.querySelector('[data-tool="notes"]');
                              if (notesButton) (notesButton as HTMLElement).click();
                            }, 100);
                          }}
                          className="flex flex-col items-center space-y-2 p-3 h-auto"
                        >
                          <div className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary">
                            <Edit3 className="h-4 w-4" />
                          </div>
                          <p className="text-xs font-medium text-center">Notes</p>
                        </DarkButtonWithIcon>
                        
                        <DarkButtonWithIcon
                          onClick={() => {
                            setSelectedStudyTool('designer');
                            setShowStudyTools(true);
                            setTimeout(() => {
                              const designerButton = document.querySelector('[data-tool="designer"]');
                              if (designerButton) (designerButton as HTMLElement).click();
                            }, 100);
                          }}
                          className="flex flex-col items-center space-y-2 p-3 h-auto"
                        >
                          <div className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary">
                            <Palette className="h-4 w-4" />
                          </div>
                          <p className="text-xs font-medium text-center">Design</p>
                        </DarkButtonWithIcon>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Resize Handle */}
                <div
                  className="w-2 bg-muted hover:bg-primary/50 cursor-col-resize transition-colors border-l border-border"
                  onMouseDown={(e) => handleMouseDown('studyTools', e)}
                />
              </>
            )}

            {/* Chat Start Button - Floating */}
            {!showChatPanel && !showNmrFullscreen && !showSrlCoachWorkspace && !showRdkitWorkspace && (
              <div className="absolute top-28 right-8 z-10">
                <DarkButtonWithIcon
                  onClick={() => {
                    console.log('Starting chat panel...');
                    setIsNmrAssistantActive(false);
                    setIsRdkitAssistantActive(false);
                    setShowRdkitAssistant(false);
                    setShowChatPanel(true);
                  }}
                  className="shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <span className='mr-[10px]'>
                    <MessageSquare className="h-5 w-5" />
                  </span>
                  Start Chat
                </DarkButtonWithIcon>
              </div>
            )}

            {/* Chat Panel */}
            {showChatPanel && (
              <>
                <div
                  className="border-l-2 border-border bg-card flex flex-col shadow-lg"
                  style={{ width: chatWidth }}
                >
                  {/* Chat Header */}
                  <div className="px-4 py-3 border-b border-border bg-muted/70 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                        <MessageSquare className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">AI Chat</h3>
                        <p className="text-xs text-muted-foreground">Reference answers while you work</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline text-[11px] text-muted-foreground bg-muted px-2 py-1 rounded">
                        {Math.round(chatWidth)}px
                      </span>
                      <button
                        onClick={() => setShowChatPanel(false)}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                        aria-label="Close chat"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* Chat Content */}
                  <div className="flex-1 min-h-[240px]">
                    <LobeChat />
                  </div>
                </div>

                {/* Resize Handle */}
                <div
                  className="w-2 bg-muted hover:bg-primary/50 cursor-col-resize transition-colors border-l border-border"
                  onMouseDown={(e) => handleMouseDown('chat', e)}
                />
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Settings</h2>
            <div className="space-y-4">
              <div className="bg-accent/10 border border-accent/20 p-3 rounded-md text-xs text-accent dark:text-accent">
                <p className="font-semibold mb-1">🔒 Security Notice</p>
                <p>Your API key is stored locally in your browser and never sent to our servers. See <a href="./SECURITY_API_KEYS.md" className="underline hover:text-accent/80">Security Guide</a> for details.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter your Gemini API key (starts with AIzaSy...)"
                />
                {apiKey && (
                  <div className="bg-accent/10 border border-accent/20 p-2 rounded-md text-xs text-accent flex items-center gap-2 mt-2">
                    <span>✅ API Key format looks valid</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  <strong>How to get your key:</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1">
                    <li>Visit <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a></li>
                    <li>Create a new API key</li>
                    <li>Paste it here and click Save</li>
                    <li>Your key is stored securely on your device</li>
                  </ol>
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
                >
                  Save Securely
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Update Modal */}
      {showProfileUpdate && user && (
        <ProfileUpdate
          userProfile={user}
          onClose={handleCloseProfileUpdate}
          onUpdate={handleProfileUpdate}
        />
      )}

      {/* Calculator Modal */}
      <Calculator
        isOpen={showCalculator}
        onClose={handleCloseCalculator}
      />

      {/* Molecular Viewer Modal */}
      <MolecularViewer
        isOpen={showMolView}
        onClose={handleCloseMolView}
      />

      {/* Periodic Table Modal */}
      <PeriodicTable
        isOpen={showPeriodicTable}
        onClose={handleClosePeriodicTable}
      />

      {/* Chemistry Widget Panel */}
      {showChemistryPanel && !showNmrFullscreen && !showSrlCoachWorkspace && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <ChemistryWidgetPanel
              initialView={chemistryPanelInitialView}
              onClose={() => setShowChemistryPanel(false)}
            />
          </div>
        </div>
      )}

      {/* Adaptive Learning Plan */}
      {showAdaptivePlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-6xl h-[90vh] mx-4">
            <AdaptivePlan
              onClose={() => setShowAdaptivePlan(false)}
              initialTopic={sources.length > 0 ? sources.map(s => s.title).join(', ') : ''}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

