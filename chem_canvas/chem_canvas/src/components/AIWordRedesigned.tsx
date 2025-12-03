import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  X, Wand2, Plus, Minus, FileText, Sparkles, RefreshCw, MessageSquare,
  ChevronDown, ChevronUp, Loader2, PenLine, Upload, Link, ChevronRight,
  Maximize2, Minimize2, Copy, Send, Trash2, Settings, ExternalLink, List,
  ArrowRight, Menu, Home
} from 'lucide-react';
import { generateContentWithGemini } from '../services/geminiService';

// ============ ANIMATION STYLES ============
const animationStyles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideInRight {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  @keyframes wave {
    0% { transform: translateY(0) scaleY(1); }
    50% { transform: translateY(-5px) scaleY(1.1); }
    100% { transform: translateY(0) scaleY(1); }
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgba(20, 240, 197, 0.3); }
    50% { box-shadow: 0 0 20px rgba(20, 240, 197, 0.6); }
  }

  @keyframes textReveal {
    from {
      clip-path: inset(0 100% 0 0);
    }
    to {
      clip-path: inset(0 0 0 0);
    }
  }

  @keyframes particleFloat {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(5px, -10px); }
    50% { transform: translate(-5px, -20px); }
    75% { transform: translate(10px, -10px); }
  }

  @keyframes logoSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes underlineExpand {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }

  .animate-fade-in-up {
    animation: fadeInUp 0.6s ease-out forwards;
  }

  .animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
  }

  .animate-slide-in-right {
    animation: slideInRight 0.5s ease-out forwards;
  }

  .animate-pulse-slow {
    animation: pulse 2s ease-in-out infinite;
  }

  .animate-bounce-slow {
    animation: bounce 2s ease-in-out infinite;
  }

  .animate-float {
    animation: float 6s ease-in-out infinite;
  }

  .animate-glow {
    animation: glow 2s ease-in-out infinite;
  }

  .animate-shimmer {
    background: linear-gradient(90deg, transparent, rgba(20, 240, 197, 0.1), transparent);
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  }

  .animate-scale-in {
    animation: scaleIn 0.4s ease-out forwards;
  }

  .stagger-1 { animation-delay: 0.1s; }
  .stagger-2 { animation-delay: 0.2s; }
  .stagger-3 { animation-delay: 0.3s; }
  .stagger-4 { animation-delay: 0.4s; }
  .stagger-5 { animation-delay: 0.5s; }
  .stagger-6 { animation-delay: 0.6s; }

  .hover-underline {
    position: relative;
  }

  .hover-underline::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 100%;
    height: 1px;
    background: #14f0c5;
    transform: scaleX(0);
    transform-origin: right;
    transition: transform 0.3s ease;
  }

  .hover-underline:hover::after {
    transform: scaleX(1);
    transform-origin: left;
  }

  .card-hover {
    transition: all 0.3s ease;
  }

  .card-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }
`;

// ============ 3D PARTICLE WAVE COMPONENT ============
const ParticleWave: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      
      ctx.clearRect(0, 0, width, height);
      
      const cols = 60;
      const rows = 30;
      const spacing = width / cols;
      const rowSpacing = height / rows;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing + spacing / 2;
          const baseY = j * rowSpacing + rowSpacing / 2;
          
          // Create wave effect
          const wave1 = Math.sin((i / cols) * Math.PI * 2 + time * 0.02) * 30;
          const wave2 = Math.sin((j / rows) * Math.PI * 2 + time * 0.015) * 20;
          const wave3 = Math.sin(((i + j) / (cols + rows)) * Math.PI * 4 + time * 0.01) * 15;
          
          const y = baseY + wave1 + wave2 + wave3;
          
          // Calculate opacity based on position
          const distFromCenter = Math.abs(j - rows / 2) / (rows / 2);
          const opacity = Math.max(0.1, 1 - distFromCenter * 0.8);
          
          // Color gradient from cyan to blue
          const hue = 170 + (i / cols) * 20;
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${opacity * 0.6})`;
          
          // Draw particle
          const size = 1.5 + Math.sin(time * 0.02 + i * 0.1) * 0.5;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      time++;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
};

// ============ LOADING SCREEN COMPONENT ============
const LoadingScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExiting(true);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0f14] transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      {/* Logo */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#14f0c5] to-[#0ea5a0] flex items-center justify-center animate-pulse-slow">
          <FileText className="h-10 w-10 text-[#0a0f14]" />
        </div>
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-[#14f0c5]/20 animate-ping" style={{ animationDuration: '2s' }} />
      </div>
      
      {/* Brand name */}
      <div className="text-2xl font-semibold tracking-wide text-white mb-8 animate-fade-in">
        ai<span className="text-[#14f0c5]">word</span>
      </div>
      
      {/* Progress bar */}
      <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-[#14f0c5] to-[#0ea5a0] transition-all duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Progress text */}
      <div className="mt-4 text-sm text-gray-500 font-mono">
        {progress}%
      </div>

      {/* Loading particles */}
      <div className="absolute bottom-20 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div 
            key={i}
            className="w-2 h-2 rounded-full bg-[#14f0c5]"
            style={{
              animation: 'bounce 1s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface AIWordProps {
  onClose: () => void;
  initialContent?: string;
}

interface AIAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: (text: string) => string;
  description: string;
}

const AI_ACTIONS: AIAction[] = [
  {
    id: 'rephrase',
    label: 'Rephrase',
    icon: <RefreshCw className="h-4 w-4" />,
    prompt: (text) => `Rephrase the following text while maintaining its meaning. Make it clearer and more professional:\n\n${text}\n\nProvide only the rephrased text without any explanations.`,
    description: 'Rewrite text with better clarity'
  },
  {
    id: 'expand',
    label: 'Add More Info',
    icon: <Plus className="h-4 w-4" />,
    prompt: (text) => `Expand on the following text by adding more relevant information, examples, and details. Keep the same tone and style:\n\n${text}\n\nProvide the expanded version directly without any preamble.`,
    description: 'Add more details and examples'
  },
  {
    id: 'simplify',
    label: 'Simplify',
    icon: <Minus className="h-4 w-4" />,
    prompt: (text) => `Simplify the following text to make it easier to understand. Use simpler words and shorter sentences:\n\n${text}\n\nProvide only the simplified text.`,
    description: 'Make text easier to understand'
  },
  {
    id: 'formal',
    label: 'Make Formal',
    icon: <FileText className="h-4 w-4" />,
    prompt: (text) => `Rewrite the following text in a more formal, professional tone suitable for academic or business contexts:\n\n${text}\n\nProvide only the formal version.`,
    description: 'Convert to professional tone'
  },
  {
    id: 'casual',
    label: 'Make Casual',
    icon: <MessageSquare className="h-4 w-4" />,
    prompt: (text) => `Rewrite the following text in a more casual, friendly tone while keeping the meaning:\n\n${text}\n\nProvide only the casual version.`,
    description: 'Convert to friendly tone'
  },
  {
    id: 'bullets',
    label: 'Convert to Bullets',
    icon: <List className="h-4 w-4" />,
    prompt: (text) => `Convert the following text into a well-organized bullet point list. Extract key points and format them clearly:\n\n${text}\n\nProvide only the bullet points using - or • symbols.`,
    description: 'Convert to bullet points'
  },
  {
    id: 'improve',
    label: 'Improve Writing',
    icon: <Wand2 className="h-4 w-4" />,
    prompt: (text) => `Improve the following text by fixing grammar, improving word choice, and enhancing clarity. Make it more engaging:\n\n${text}\n\nProvide only the improved text.`,
    description: 'Fix grammar and enhance style'
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: <Minus className="h-4 w-4" />,
    prompt: (text) => `Summarize the following text concisely while capturing the main points:\n\n${text}\n\nProvide only the summary.`,
    description: 'Create a brief summary'
  },
  {
    id: 'continue',
    label: 'Continue Writing',
    icon: <PenLine className="h-4 w-4" />,
    prompt: (text) => `Continue writing from where this text leaves off. Match the style, tone, and topic. Write 2-3 more paragraphs:\n\n${text}\n\nProvide only the continuation.`,
    description: 'Auto-continue the text'
  }
];

const DOCUMENT_EDITOR_URL = 'https://ranuts.github.io/document/?locale=en';

// Spaced letter text component (like Raentrading headings)
const SpacedText: React.FC<{ text: string; className?: string }> = ({ text, className = '' }) => {
  return (
    <span className={className}>
      {text.split('').map((char, index) => (
        <span key={index} className="tracking-[0.15em]">
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};

const AIWordRedesigned: React.FC<AIWordProps> = ({ onClose }) => {
  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'editor' | 'ai'>('editor');
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(true);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPromptInput, setShowCustomPromptInput] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'ai', content: string}>>([]);
  const [documentUrl, setDocumentUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrollIndicator, setScrollIndicator] = useState(true);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Inject animation styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = animationStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Trigger content visibility after loading
  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => setIsContentVisible(true), 100);
    }
  }, [isLoading]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Hide scroll indicator on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (mainContentRef.current && mainContentRef.current.scrollTop > 50) {
        setScrollIndicator(false);
      }
    };
    const container = mainContentRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle AI action
  const handleAIAction = useCallback(async (action: AIAction) => {
    if (!inputText.trim()) {
      setNotification('Please paste some text in the input area first');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setIsProcessing(true);
    setChatHistory(prev => [...prev, { role: 'user', content: `${action.label}: ${inputText.substring(0, 100)}...` }]);

    try {
      const result = await generateContentWithGemini(action.prompt(inputText));
      if (result) {
        setOutputText(result);
        setChatHistory(prev => [...prev, { role: 'ai', content: result }]);
        setNotification(`✓ ${action.label} applied successfully`);
      }
    } catch (error) {
      console.error('AI action failed:', error);
      setNotification('Failed to process text. Please try again.');
      setChatHistory(prev => [...prev, { role: 'ai', content: 'Error: Failed to process request.' }]);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  }, [inputText]);

  // Handle custom prompt
  const handleCustomPrompt = useCallback(async () => {
    if (!customPrompt.trim()) {
      setNotification('Please enter an instruction');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const textToProcess = inputText.trim() || 'No input text provided';
    setIsProcessing(true);
    setChatHistory(prev => [...prev, { role: 'user', content: customPrompt }]);

    try {
      const fullPrompt = inputText.trim() 
        ? `${customPrompt}\n\nText to work with:\n${inputText}\n\nProvide the result directly.`
        : `${customPrompt}\n\nProvide the result directly.`;
      
      const result = await generateContentWithGemini(fullPrompt);
      if (result) {
        setOutputText(result);
        setChatHistory(prev => [...prev, { role: 'ai', content: result }]);
        setNotification('✓ Custom action applied');
        setCustomPrompt('');
        setShowCustomPromptInput(false);
      }
    } catch (error) {
      console.error('Custom AI action failed:', error);
      setNotification('Failed to process. Please try again.');
      setChatHistory(prev => [...prev, { role: 'ai', content: 'Error: Failed to process request.' }]);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  }, [inputText, customPrompt]);

  // Copy output to clipboard
  const handleCopyOutput = useCallback(() => {
    if (outputText) {
      navigator.clipboard.writeText(outputText);
      setNotification('✓ Copied to clipboard');
      setTimeout(() => setNotification(null), 2000);
    }
  }, [outputText]);

  // Clear chat
  const handleClearChat = useCallback(() => {
    setChatHistory([]);
    setInputText('');
    setOutputText('');
  }, []);

  // Load document from URL
  const handleLoadDocument = useCallback(() => {
    if (documentUrl.trim()) {
      const encodedUrl = encodeURIComponent(documentUrl);
      const newUrl = `${DOCUMENT_EDITOR_URL}&src=${encodedUrl}`;
      const iframe = document.getElementById('document-editor-frame') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = newUrl;
      }
      setShowUrlInput(false);
      setNotification('✓ Loading document...');
      setTimeout(() => setNotification(null), 2000);
    }
  }, [documentUrl]);

  // Show loading screen
  if (isLoading) {
    return <LoadingScreen onComplete={() => setIsLoading(false)} />;
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-[#0a0f14] text-white font-['Inter',sans-serif] ${isContentVisible ? 'animate-fade-in' : 'opacity-0'}`}>
      {/* ============ HEADER / NAVIGATION ============ */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 bg-[#0a0f14]/95 backdrop-blur-sm border-b border-white/5 animate-fade-in-up">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="flex items-center gap-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#14f0c5] to-[#0ea5a0] flex items-center justify-center animate-glow">
              <FileText className="h-4 w-4 text-[#0a0f14]" />
            </div>
            <span className="text-lg font-semibold tracking-wide text-white group-hover:text-[#14f0c5] transition-colors">
              ai<span className="text-[#14f0c5]">word</span>
            </span>
          </button>
          <span className="hidden md:block text-xs text-gray-500 uppercase tracking-wider ml-4">
            AI-Powered Document Editor
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => setActiveView('editor')}
            className={`text-sm tracking-wide transition-colors hover-underline ${
              activeView === 'editor' 
                ? 'text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveView('ai')}
            className={`text-sm tracking-wide transition-colors hover-underline ${
              activeView === 'ai' 
                ? 'text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            AI Tools
          </button>
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-sm text-gray-400 hover:text-white tracking-wide transition-colors"
          >
            Load URL
          </button>
          <a
            href={DOCUMENT_EDITOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-white tracking-wide transition-colors flex items-center gap-1"
          >
            Open External
            <ExternalLink className="h-3 w-3" />
          </a>
        </nav>

        {/* CTA and Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isAIPanelOpen
                ? 'bg-[#14f0c5] text-[#0a0f14] hover:bg-[#10d4ad]'
                : 'border border-[#14f0c5]/30 text-[#14f0c5] hover:bg-[#14f0c5]/10'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </button>
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-[#0d1218] border-b border-white/5 md:hidden">
          <div className="flex flex-col p-4 gap-3">
            <button
              onClick={() => { setActiveView('editor'); setIsMobileMenuOpen(false); }}
              className={`text-left px-4 py-2 rounded-lg ${activeView === 'editor' ? 'bg-[#14f0c5]/10 text-[#14f0c5]' : 'text-gray-400'}`}
            >
              Editor
            </button>
            <button
              onClick={() => { setActiveView('ai'); setIsMobileMenuOpen(false); }}
              className={`text-left px-4 py-2 rounded-lg ${activeView === 'ai' ? 'bg-[#14f0c5]/10 text-[#14f0c5]' : 'text-gray-400'}`}
            >
              AI Tools
            </button>
            <button
              onClick={() => { setShowUrlInput(true); setIsMobileMenuOpen(false); }}
              className="text-left px-4 py-2 rounded-lg text-gray-400"
            >
              Load URL
            </button>
            <button
              onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
              className={`text-left px-4 py-2 rounded-lg ${isAIPanelOpen ? 'bg-[#14f0c5] text-[#0a0f14]' : 'text-gray-400'}`}
            >
              {isAIPanelOpen ? 'Hide AI Panel' : 'Show AI Panel'}
            </button>
          </div>
        </div>
      )}

      {/* URL Input Bar */}
      {showUrlInput && (
        <div className="fixed top-16 left-0 right-0 z-40 flex items-center gap-3 px-6 lg:px-12 py-3 bg-[#0d1218] border-b border-white/5">
          <input
            type="url"
            value={documentUrl}
            onChange={(e) => setDocumentUrl(e.target.value)}
            placeholder="Enter document URL (e.g., https://example.com/document.docx)"
            className="flex-1 px-4 py-2 rounded-lg bg-[#151c24] border border-white/10 text-white placeholder:text-gray-500 focus:border-[#14f0c5]/50 focus:outline-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLoadDocument();
            }}
          />
          <button
            onClick={handleLoadDocument}
            className="px-5 py-2 rounded-lg bg-[#14f0c5] text-[#0a0f14] font-medium text-sm hover:bg-[#10d4ad] transition-colors"
          >
            Load
          </button>
          <button
            onClick={() => setShowUrlInput(false)}
            className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ============ MAIN CONTENT ============ */}
      <main 
        ref={mainContentRef}
        className="flex-1 flex mt-16 overflow-hidden"
        style={{ marginTop: showUrlInput ? '7.5rem' : '4rem' }}
      >
        {/* Document Editor Area */}
        <div className={`flex-1 flex flex-col transition-all duration-500 ${isAIPanelOpen ? 'lg:mr-0' : ''}`}>
          {/* Hero Section for Editor View */}
          {activeView === 'editor' && (
            <div className="relative">
              {/* Editor iframe with gradient overlay */}
              <div className="relative h-[calc(100vh-4rem)]">
                <iframe
                  id="document-editor-frame"
                  src={DOCUMENT_EDITOR_URL}
                  className="h-full w-full border-none bg-white"
                  title="Document Editor"
                  allow="clipboard-read; clipboard-write"
                />
              </div>
            </div>
          )}

          {/* AI Tools Full View */}
          {activeView === 'ai' && (
            <div className="h-full overflow-y-auto bg-[#0a0f14] px-6 lg:px-12 py-12">
              {/* Hero Section with Particle Wave */}
              <section className="relative min-h-[60vh] flex flex-col justify-center items-center text-center mb-16">
                {/* Particle Wave Background */}
                <div className="absolute inset-0 overflow-hidden">
                  <ParticleWave />
                  <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f14] via-transparent to-[#0a0f14]" />
                </div>
                
                <div className="relative z-10">
                  <p className="text-[#14f0c5] text-xs uppercase tracking-[0.3em] mb-6 animate-fade-in-up stagger-1 opacity-0" style={{animationFillMode: 'forwards'}}>
                    [ AI Writing Assistant ]
                  </p>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-light mb-6 animate-fade-in-up stagger-2 opacity-0" style={{animationFillMode: 'forwards'}}>
                    <span className="text-gray-400">Transform your writing with</span>{' '}
                    <span className="text-white font-medium">AI precision.</span>
                  </h1>
                  <p className="text-gray-400 max-w-2xl text-lg mb-8 animate-fade-in-up stagger-3 opacity-0" style={{animationFillMode: 'forwards'}}>
                    Paste your text below and use our AI-powered tools to rephrase, expand, simplify, 
                    or transform your content instantly.
                  </p>
                </div>
                
                {/* Scroll Indicator */}
                {scrollIndicator && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce-slow">
                    <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#14f0c5] to-transparent" />
                    <span className="text-xs text-[#14f0c5] uppercase tracking-wider">Scroll for More</span>
                  </div>
                )}
              </section>

              {/* Input Section */}
              <section className="max-w-4xl mx-auto mb-16 animate-fade-in-up stagger-4 opacity-0" style={{animationFillMode: 'forwards'}}>
                <div className="p-8 rounded-2xl bg-[#0d1218] border border-white/5 card-hover">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">Input Text</h3>
                    <span className="text-xs text-gray-500">{inputText.length} characters</span>
                  </div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste your text here to transform with AI..."
                    className="w-full h-48 p-4 rounded-xl bg-[#151c24] border border-white/10 text-white placeholder:text-gray-500 focus:border-[#14f0c5]/50 focus:outline-none resize-none text-sm leading-relaxed transition-all duration-300 focus:shadow-lg focus:shadow-[#14f0c5]/10"
                  />
                </div>
              </section>

              {/* AI Actions Grid */}
              <section className="max-w-4xl mx-auto mb-16 animate-fade-in-up stagger-5 opacity-0" style={{animationFillMode: 'forwards'}}>
                <p className="text-[#14f0c5] text-xs uppercase tracking-[0.3em] mb-4 text-center">
                  [ Quick Actions ]
                </p>
                <h2 className="text-2xl md:text-3xl font-light text-center mb-8">
                  <SpacedText text="Choose Your Transformation" className="text-gray-400" />
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {AI_ACTIONS.map((action, index) => (
                    <button
                      key={action.id}
                      onClick={() => handleAIAction(action)}
                      disabled={isProcessing}
                      className={`group relative p-6 rounded-xl bg-[#0d1218] border border-white/5 hover:border-[#14f0c5]/30 transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed card-hover animate-fade-in-up opacity-0`}
                      style={{ animationDelay: `${0.1 * index}s`, animationFillMode: 'forwards' }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 rounded-lg bg-[#14f0c5]/10 text-[#14f0c5] group-hover:bg-[#14f0c5]/20 transition-colors animate-pulse-subtle">
                          {action.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-white mb-1">{action.label}</h4>
                          <p className="text-xs text-gray-500">{action.description}</p>
                        </div>
                      </div>
                      <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 group-hover:text-[#14f0c5] group-hover:translate-x-1 transition-all opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </section>

              {/* Custom Prompt Section */}
              <section className="max-w-4xl mx-auto mb-16 animate-fade-in-up stagger-6 opacity-0" style={{animationFillMode: 'forwards'}}>
                <div className="p-8 rounded-2xl bg-gradient-to-br from-[#14f0c5]/5 to-transparent border border-[#14f0c5]/10 card-hover">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles className="h-5 w-5 text-[#14f0c5] animate-pulse-subtle" />
                    <h3 className="text-lg font-medium text-white">Custom Instruction</h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Enter your own instruction for the AI to follow.
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="E.g., Translate to Spanish, Make it sound like Shakespeare..."
                      className="flex-1 px-4 py-3 rounded-xl bg-[#151c24] border border-white/10 text-white placeholder:text-gray-500 focus:border-[#14f0c5]/50 focus:outline-none text-sm transition-all duration-300 focus:shadow-lg focus:shadow-[#14f0c5]/10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCustomPrompt();
                      }}
                    />
                    <button
                      onClick={handleCustomPrompt}
                      disabled={isProcessing}
                      className="px-6 py-3 rounded-xl bg-[#14f0c5] text-[#0a0f14] font-medium hover:bg-[#10d4ad] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#14f0c5]/20 hover:-translate-y-0.5"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </section>

              {/* Output Section */}
              <section className="max-w-4xl mx-auto mb-16 animate-fade-in-up stagger-7 opacity-0" style={{animationFillMode: 'forwards'}}>
                <div className="p-8 rounded-2xl bg-[#0d1218] border border-white/5 card-hover">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-white">Output</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyOutput}
                        disabled={!outputText}
                        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50 transition-all duration-300 hover:scale-110"
                        title="Copy output"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleClearChat}
                        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-300 hover:scale-110"
                        title="Clear all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="min-h-48 p-4 rounded-xl bg-[#151c24] border border-white/10">
                    {isProcessing ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="flex flex-col items-center gap-4">
                          {/* Enhanced Processing Animation */}
                          <div className="relative">
                            <div className="w-16 h-16 rounded-full border-2 border-[#14f0c5]/20 flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-[#14f0c5]" />
                            </div>
                            <div className="absolute inset-0 rounded-full border-2 border-t-[#14f0c5] border-r-transparent border-b-transparent border-l-transparent animate-spin" style={{animationDuration: '1.5s'}} />
                            <div className="absolute inset-[-4px] rounded-full border-2 border-t-transparent border-r-[#14f0c5]/50 border-b-transparent border-l-transparent animate-spin" style={{animationDuration: '2s', animationDirection: 'reverse'}} />
                          </div>
                          <p className="text-sm text-gray-400 animate-pulse">Processing your request...</p>
                          <div className="flex gap-1 mt-2">
                            <div className="w-2 h-2 rounded-full bg-[#14f0c5] animate-bounce" style={{animationDelay: '0s'}}></div>
                            <div className="w-2 h-2 rounded-full bg-[#14f0c5] animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 rounded-full bg-[#14f0c5] animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      </div>
                    ) : outputText ? (
                      <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed animate-fade-in">{outputText}</div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-full bg-[#14f0c5]/10 flex items-center justify-center mb-4 animate-pulse-subtle">
                          <Sparkles className="h-8 w-8 text-[#14f0c5]/50" />
                        </div>
                        <p className="text-gray-400 mb-2">AI output will appear here</p>
                        <p className="text-xs text-gray-500">Paste text and click an action to begin</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* CTA Section */}
              <section className="max-w-4xl mx-auto text-center py-16 border-t border-white/5">
                <h2 className="text-2xl md:text-3xl font-light mb-4">
                  <SpacedText text="Ready to enhance your writing?" className="text-gray-400" />
                </h2>
                <p className="text-gray-500 mb-8">
                  Switch to the Editor view to work on your documents directly.
                </p>
                <button
                  onClick={() => setActiveView('editor')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#14f0c5] text-[#0a0f14] font-medium hover:bg-[#10d4ad] transition-colors"
                >
                  Open Document Editor
                  <ArrowRight className="h-4 w-4" />
                </button>
              </section>
            </div>
          )}
        </div>

        {/* ============ AI SIDE PANEL ============ */}
        {isAIPanelOpen && activeView === 'editor' && (
          <aside className="hidden lg:flex flex-col w-96 bg-[#0d1218] border-l border-white/5">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#14f0c5]" />
                <span className="font-medium text-white">AI Assistant</span>
              </div>
              <button
                onClick={() => setIsAIPanelOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Instructions */}
            <div className="px-6 py-3 bg-[#151c24] border-b border-white/5">
              <p className="text-xs text-gray-400">
                Copy text from the document, paste it below, and use AI actions to transform it.
              </p>
            </div>

            {/* Input Area */}
            <div className="px-6 py-4 border-b border-white/5">
              <label className="block text-xs font-medium text-gray-400 mb-2">Input Text</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste text from document here..."
                className="w-full h-24 p-3 rounded-lg bg-[#151c24] border border-white/10 text-white text-sm placeholder:text-gray-500 focus:border-[#14f0c5]/50 focus:outline-none resize-none"
              />
            </div>

            {/* Quick Actions */}
            <div className="px-6 py-4 border-b border-white/5">
              <label className="block text-xs font-medium text-gray-400 mb-3">Quick Actions</label>
              <div className="grid grid-cols-3 gap-2">
                {AI_ACTIONS.slice(0, 6).map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleAIAction(action)}
                    disabled={isProcessing}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[#151c24] border border-white/5 hover:border-[#14f0c5]/30 text-center transition-colors disabled:opacity-50"
                    title={action.description}
                  >
                    <span className="text-[#14f0c5]">{action.icon}</span>
                    <span className="text-xs text-gray-400">{action.label}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {AI_ACTIONS.slice(6).map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleAIAction(action)}
                    disabled={isProcessing}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[#151c24] border border-white/5 hover:border-[#14f0c5]/30 text-center transition-colors disabled:opacity-50"
                    title={action.description}
                  >
                    <span className="text-[#14f0c5]">{action.icon}</span>
                    <span className="text-xs text-gray-400">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="px-6 py-4 border-b border-white/5">
              <button
                onClick={() => setShowCustomPromptInput(!showCustomPromptInput)}
                className="flex w-full items-center justify-between"
              >
                <span className="text-xs font-medium text-gray-400">Custom Prompt</span>
                {showCustomPromptInput ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {showCustomPromptInput && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Enter your instruction..."
                    className="flex-1 px-3 py-2 rounded-lg bg-[#151c24] border border-white/10 text-white text-sm placeholder:text-gray-500 focus:border-[#14f0c5]/50 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCustomPrompt();
                    }}
                  />
                  <button
                    onClick={handleCustomPrompt}
                    disabled={isProcessing}
                    className="p-2 rounded-lg bg-[#14f0c5] text-[#0a0f14] hover:bg-[#10d4ad] disabled:opacity-50 transition-colors"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Output Area */}
            <div className="flex-1 flex flex-col px-6 py-4 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-400">Output</label>
                <div className="flex gap-1">
                  <button
                    onClick={handleCopyOutput}
                    disabled={!outputText}
                    className="p-1 rounded text-gray-400 hover:text-white disabled:opacity-50"
                    title="Copy output"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleClearChat}
                    className="p-1 rounded text-gray-400 hover:text-white"
                    title="Clear all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto rounded-lg bg-[#151c24] border border-white/10 p-3"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[#14f0c5]" />
                  </div>
                ) : outputText ? (
                  <div className="text-sm text-gray-300 whitespace-pre-wrap">{outputText}</div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Sparkles className="h-8 w-8 text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">AI output will appear here</p>
                    <p className="text-xs text-gray-600 mt-1">Paste text and click an action</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="hidden lg:flex items-center justify-between px-6 lg:px-12 py-3 bg-[#0a0f14] border-t border-white/5 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>Powered by Gemini AI</span>
          <span>•</span>
          <span>© 2025 AI Word</span>
        </div>
        <div className="flex items-center gap-6">
          <span>[EDITOR MODE]</span>
          <span className="text-[#14f0c5]">●</span>
          <span>Ready</span>
        </div>
      </footer>

      {/* ============ NOTIFICATION TOAST ============ */}
      {notification && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded-full bg-[#14f0c5] text-[#0a0f14] font-medium text-sm shadow-lg shadow-[#14f0c5]/20">
          {notification}
        </div>
      )}
    </div>
  );
};

export default AIWordRedesigned;
