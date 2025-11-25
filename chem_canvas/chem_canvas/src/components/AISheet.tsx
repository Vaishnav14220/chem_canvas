import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Wand2, Table, Sparkles, ChevronDown, ChevronUp, Loader2,
  Calculator, Sigma, Hash, Link, ExternalLink, Maximize2, Minimize2,
  Copy, Send, Trash2, FileSpreadsheet, BarChart3, TrendingUp
} from 'lucide-react';
import { generateContentWithGemini } from '../services/geminiService';

interface AISheetProps {
  onClose: () => void;
  initialData?: string[][];
}

interface AITableAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: (context: string) => string;
  description: string;
}

const AI_TABLE_ACTIONS: AITableAction[] = [
  {
    id: 'generate-table',
    label: 'Generate Table',
    icon: <Table className="h-4 w-4" />,
    prompt: (context) => `Create a data table based on this description: ${context}\n\nFormat the response as a CSV-style table with headers in the first row. Use proper data formatting. Provide only the table data, no explanations.`,
    description: 'Create a table from description'
  },
  {
    id: 'add-calculations',
    label: 'Add Calculations',
    icon: <Calculator className="h-4 w-4" />,
    prompt: (context) => `Given this spreadsheet data, suggest Excel/spreadsheet formulas and calculations that would be useful:\n\n${context}\n\nProvide specific formulas with cell references (like =SUM(A1:A10)) and explain what each formula calculates.`,
    description: 'Suggest formulas and totals'
  },
  {
    id: 'analyze-data',
    label: 'Analyze Data',
    icon: <Sigma className="h-4 w-4" />,
    prompt: (context) => `Analyze this spreadsheet data and provide insights:\n\n${context}\n\nInclude: key statistics, trends, patterns, outliers, and actionable insights. Format with clear sections.`,
    description: 'Get insights from your data'
  },
  {
    id: 'fill-suggestions',
    label: 'Fill Suggestions',
    icon: <Wand2 className="h-4 w-4" />,
    prompt: (context) => `Based on this spreadsheet data, suggest values to fill in missing cells or extend the data:\n\n${context}\n\nProvide specific suggestions for what data should go in empty cells based on patterns.`,
    description: 'Suggest values for empty cells'
  },
  {
    id: 'format-guide',
    label: 'Format Guide',
    icon: <Hash className="h-4 w-4" />,
    prompt: (context) => `Suggest formatting improvements for this spreadsheet data:\n\n${context}\n\nInclude: number formats (currency, percentage, decimal places), date formats, conditional formatting rules, and column width suggestions.`,
    description: 'Suggest formatting improvements'
  },
  {
    id: 'chart-suggestions',
    label: 'Chart Ideas',
    icon: <BarChart3 className="h-4 w-4" />,
    prompt: (context) => `Based on this spreadsheet data, suggest the best chart types to visualize it:\n\n${context}\n\nRecommend specific chart types (bar, line, pie, etc.), which columns to use for each axis, and why each chart would be effective.`,
    description: 'Suggest visualization options'
  }
];

// OnlyOffice spreadsheet editor URL
const SPREADSHEET_EDITOR_URL = 'https://ranuts.github.io/document/?locale=en';

const AISheet: React.FC<AISheetProps> = ({ onClose }) => {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(true);
  const [isAIPanelMinimized, setIsAIPanelMinimized] = useState(false);
  const [inputData, setInputData] = useState('');
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
  const handleAIAction = useCallback(async (action: AITableAction) => {
    const contextData = inputData.trim() || 'No specific data provided - generate example data';
    
    setIsProcessing(true);
    setChatHistory(prev => [...prev, { role: 'user', content: `${action.label}${inputData ? `: Working with provided data` : ''}` }]);

    try {
      const result = await generateContentWithGemini(action.prompt(contextData));
      if (result) {
        setOutputText(result);
        setChatHistory(prev => [...prev, { role: 'ai', content: result }]);
        setNotification(`✓ ${action.label} completed`);
      }
    } catch (error) {
      console.error('AI action failed:', error);
      setNotification('Failed to process. Please try again.');
      setChatHistory(prev => [...prev, { role: 'ai', content: 'Error: Failed to process request.' }]);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  }, [inputData]);

  // Handle custom prompt
  const handleCustomPrompt = useCallback(async () => {
    if (!customPrompt.trim()) {
      setNotification('Please enter an instruction');
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setIsProcessing(true);
    setChatHistory(prev => [...prev, { role: 'user', content: customPrompt }]);

    try {
      const fullPrompt = inputData.trim() 
        ? `${customPrompt}\n\nSpreadsheet data:\n${inputData}\n\nProvide helpful results for a spreadsheet context.`
        : `${customPrompt}\n\nProvide helpful results for a spreadsheet context.`;
      
      const result = await generateContentWithGemini(fullPrompt);
      if (result) {
        setOutputText(result);
        setChatHistory(prev => [...prev, { role: 'ai', content: result }]);
        setNotification('✓ Custom action completed');
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
  }, [inputData, customPrompt]);

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
    setInputData('');
    setOutputText('');
  }, []);

  // Load document from URL
  const handleLoadDocument = useCallback(() => {
    if (documentUrl.trim()) {
      const encodedUrl = encodeURIComponent(documentUrl);
      const newUrl = `${SPREADSHEET_EDITOR_URL}&src=${encodedUrl}`;
      const iframe = document.getElementById('spreadsheet-editor-frame') as HTMLIFrameElement;
      if (iframe) {
        iframe.src = newUrl;
      }
      setShowUrlInput(false);
      setNotification('✓ Loading spreadsheet...');
      setTimeout(() => setNotification(null), 2000);
    }
  }, [documentUrl]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
            <FileSpreadsheet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">AI Spreadsheet</h1>
            <p className="text-xs text-slate-400">Powered by OnlyOffice + Gemini AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            title="Load spreadsheet from URL"
          >
            <Link className="h-4 w-4" />
            Load URL
          </button>
          <button
            onClick={() => window.open(SPREADSHEET_EDITOR_URL, '_blank')}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
              isAIPanelOpen 
                ? 'bg-emerald-600 text-white' 
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
            placeholder="Enter spreadsheet URL (e.g., https://example.com/data.xlsx)"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLoadDocument();
            }}
          />
          <button
            onClick={handleLoadDocument}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
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
        {/* Spreadsheet Editor (OnlyOffice iframe) */}
        <div className={`flex-1 transition-all duration-300 ${isAIPanelOpen ? 'mr-0' : ''}`}>
          <iframe
            id="spreadsheet-editor-frame"
            src={SPREADSHEET_EDITOR_URL}
            className="h-full w-full border-none bg-white"
            title="Spreadsheet Editor"
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
                  <Sparkles className="h-4 w-4 text-emerald-400" />
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
                    Copy data from your spreadsheet, paste it below, and use AI to generate tables, 
                    formulas, and analysis. Copy results back to your spreadsheet.
                  </p>
                </div>

                {/* Input Area */}
                <div className="border-b border-slate-800 p-3">
                  <label className="mb-1 block text-xs font-medium text-slate-400">Data Input (CSV or paste cells)</label>
                  <textarea
                    value={inputData}
                    onChange={(e) => setInputData(e.target.value)}
                    placeholder="Paste spreadsheet data or describe what table you want to create..."
                    className="h-24 w-full resize-none rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                {/* AI Actions Grid */}
                <div className="border-b border-slate-800 p-3">
                  <label className="mb-2 block text-xs font-medium text-slate-400">Spreadsheet Actions</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {AI_TABLE_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleAIAction(action)}
                        disabled={isProcessing}
                        className="flex flex-col items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-center hover:border-emerald-500 hover:bg-slate-700 disabled:opacity-50"
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
                        placeholder="Ask about spreadsheet data..."
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCustomPrompt();
                        }}
                      />
                      <button
                        onClick={handleCustomPrompt}
                        disabled={isProcessing}
                        className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-500 disabled:opacity-50"
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
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                      </div>
                    ) : outputText ? (
                      <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{outputText}</div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <TrendingUp className="h-8 w-8 text-slate-600 mb-2" />
                        <p className="text-sm text-slate-500">AI output will appear here</p>
                        <p className="text-xs text-slate-600 mt-1">Generate tables, formulas & analysis</p>
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

export default AISheet;
