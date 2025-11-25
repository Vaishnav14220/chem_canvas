import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Wand2, Plus, Minus, FileText, Sparkles, RefreshCw, MessageSquare,
  ChevronDown, ChevronUp, Loader2, PenLine, Upload, Link, ChevronRight,
  Maximize2, Minimize2, Copy, Send, Trash2, Settings, ExternalLink, List
} from 'lucide-react';
import { generateContentWithGemini } from '../services/geminiService';

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

const AIWord: React.FC<AIWordProps> = ({ onClose }) => {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(true);
  const [isAIPanelMinimized, setIsAIPanelMinimized] = useState(false);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPromptInput, setShowCustomPromptInput] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'ai', content: string}>>([]);
  const [documentUrl, setDocumentUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">AI Document Editor</h1>
            <p className="text-xs text-slate-400">Powered by OnlyOffice + Gemini AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            title="Load document from URL"
          >
            <Link className="h-4 w-4" />
            Load URL
          </button>
          <button
            onClick={() => window.open(DOCUMENT_EDITOR_URL, '_blank')}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
              isAIPanelOpen 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            AI Panel
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* URL Input Bar */}
      {showUrlInput && (
        <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2">
          <input
            type="url"
            value={documentUrl}
            onChange={(e) => setDocumentUrl(e.target.value)}
            placeholder="Enter document URL (e.g., https://example.com/document.docx)"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLoadDocument();
            }}
          />
          <button
            onClick={handleLoadDocument}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Load
          </button>
          <button
            onClick={() => setShowUrlInput(false)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document Editor (OnlyOffice iframe) */}
        <div className={`flex-1 transition-all duration-300 ${isAIPanelOpen ? 'mr-0' : ''}`}>
          <iframe
            id="document-editor-frame"
            src={DOCUMENT_EDITOR_URL}
            className="h-full w-full border-none bg-white"
            title="Document Editor"
            allow="clipboard-read; clipboard-write"
          />
        </div>

        {/* AI Panel */}
        {isAIPanelOpen && (
          <div className={`flex flex-col border-l border-slate-800 bg-slate-900/95 transition-all duration-300 ${
            isAIPanelMinimized ? 'w-12' : 'w-96'
          }`}>
            {/* AI Panel Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              {!isAIPanelMinimized && (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-sm font-medium text-white">AI Assistant</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsAIPanelMinimized(!isAIPanelMinimized)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                  title={isAIPanelMinimized ? 'Expand' : 'Minimize'}
                >
                  {isAIPanelMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isAIPanelMinimized && (
              <>
                {/* Instructions */}
                <div className="border-b border-slate-800 bg-slate-800/50 px-3 py-2">
                  <p className="text-xs text-slate-400">
                    Copy text from the document, paste it below, and use AI actions to transform it. 
                    Then copy the result back into the document.
                  </p>
                </div>

                {/* Input Area */}
                <div className="border-b border-slate-800 p-3">
                  <label className="mb-1 block text-xs font-medium text-slate-400">Input Text</label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste text from document here..."
                    className="h-24 w-full resize-none rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-sm text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {/* AI Actions Grid */}
                <div className="border-b border-slate-800 p-3">
                  <label className="mb-2 block text-xs font-medium text-slate-400">Quick Actions</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {AI_ACTIONS.slice(0, 6).map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleAIAction(action)}
                        disabled={isProcessing}
                        className="flex flex-col items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-center hover:border-purple-500 hover:bg-slate-700 disabled:opacity-50"
                        title={action.description}
                      >
                        <span className="text-slate-400">{action.icon}</span>
                        <span className="text-xs text-slate-300">{action.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {AI_ACTIONS.slice(6).map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleAIAction(action)}
                        disabled={isProcessing}
                        className="flex flex-col items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-center hover:border-purple-500 hover:bg-slate-700 disabled:opacity-50"
                        title={action.description}
                      >
                        <span className="text-slate-400">{action.icon}</span>
                        <span className="text-xs text-slate-300">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Prompt */}
                <div className="border-b border-slate-800 p-3">
                  <button
                    onClick={() => setShowCustomPromptInput(!showCustomPromptInput)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="text-xs font-medium text-slate-400">Custom Prompt</span>
                    {showCustomPromptInput ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {showCustomPromptInput && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Enter your instruction..."
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCustomPrompt();
                        }}
                      />
                      <button
                        onClick={handleCustomPrompt}
                        disabled={isProcessing}
                        className="rounded-lg bg-purple-600 p-2 text-white hover:bg-purple-500 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Output Area */}
                <div className="flex-1 overflow-hidden p-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-400">Output</label>
                    <div className="flex gap-1">
                      <button
                        onClick={handleCopyOutput}
                        disabled={!outputText}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                        title="Copy output"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={handleClearChat}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        title="Clear all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div 
                    ref={chatContainerRef}
                    className="h-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/30 p-2"
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                      </div>
                    ) : outputText ? (
                      <div className="text-sm text-slate-300 whitespace-pre-wrap">{outputText}</div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Sparkles className="h-8 w-8 text-slate-600 mb-2" />
                        <p className="text-sm text-slate-500">AI output will appear here</p>
                        <p className="text-xs text-slate-600 mt-1">Paste text and click an action</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm text-white shadow-xl">
          {notification}
        </div>
      )}
    </div>
  );
};

export default AIWord;
