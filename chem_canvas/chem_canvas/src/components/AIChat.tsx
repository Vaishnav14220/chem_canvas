import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Loader2, Sparkles, FileText } from 'lucide-react';
import type { AIInteraction, InteractionMode } from '../types';
import { LLMMessage, VerifiedSmilesBlock } from './LLMResponseBlocks';
import AIToolResponseCard from './AIToolResponseCard';

interface AIChatProps {
  onSendMessage: (message: string, options?: { mode?: InteractionMode }) => Promise<void>;
  interactions: AIInteraction[];
  isLoading: boolean;
  documentName?: string;
  onOpenDocument?: () => void;
  onRequestVideoSearch?: (content: string) => void;
  mode?: InteractionMode;
}

const AIChat: React.FC<AIChatProps> = ({
  onSendMessage,
  interactions,
  isLoading,
  documentName,
  onOpenDocument,
  onRequestVideoSearch,
  mode = 'chat'
}) => {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatInteractions = useMemo(
    () => interactions.filter((interaction) => interaction.mode === mode),
    [interactions, mode]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatInteractions, isLoading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || isLoading) {
      return;
    }

    try {
      await onSendMessage(message, { mode });
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="bg-gray-800 rounded-2xl shadow-2xl flex flex-col h-full border border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-800 to-gray-750 text-white px-4 md:px-6 py-3 md:py-4 border-b border-gray-700 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2 rounded-lg">
            <Sparkles size={22} className="text-blue-400 animate-pulse-slow" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-white">Chemistry AI Assistant</h2>
            <p className="text-xs text-gray-400">Powered by Gemini 2.5 Flash</p>
          </div>
        </div>
        {documentName && (
          <div className="mt-3 bg-blue-900/30 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center justify-between border border-blue-700/50">
            <div className="flex items-center gap-2 text-sm">
              <FileText size={16} className="text-blue-400" />
              <span className="font-medium truncate max-w-md text-blue-200">Reference: {documentName}</span>
            </div>
            {onOpenDocument && (
              <button
                onClick={onOpenDocument}
                className="text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md transition-colors text-white"
              >
                Open
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-h-0 bg-gray-900">
        {documentName && chatInteractions.length > 0 && (
          <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-xl p-3 mb-4">
            <div className="flex items-start gap-3">
              <div className="bg-green-600/20 p-2 rounded-lg">
                <FileText size={16} className="text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-300 mb-1">
                  Document Analysis Active
                </p>
                <p className="text-xs text-green-200">
                  I'm analyzing <strong>{documentName}</strong>. Ask questions and I'll cite the exact pages!
                </p>
                <p className="text-xs text-green-400 mt-1">
                  Tip: Click on citation badges to view the referenced page.
                </p>
              </div>
            </div>
          </div>
        )}

        {chatInteractions.length === 0 ? (
          <div className="text-center mt-12 animate-fade-in">
            <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border border-blue-600/30">
              <Sparkles size={40} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Welcome to ChemCanvas AI!</h3>
            <p className="text-gray-400 mb-1">Ask me anything about your chemistry work</p>
            <p className="text-sm text-gray-500">I can help with molecules, reactions, equations, and more</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
              <div className="bg-gray-800/60 backdrop-blur-sm p-3 rounded-xl border border-blue-700/50 text-left hover:border-blue-600/70 transition-colors h-20 flex flex-col justify-between">
                <div className="text-blue-400 font-semibold text-sm mb-1">Sample prompt</div>
                <div className="text-xs text-gray-300">"Explain the combustion of methane (CH4)"</div>
              </div>
              <div className="bg-gray-800/60 backdrop-blur-sm p-3 rounded-xl border border-blue-700/50 text-left hover:border-blue-600/70 transition-colors h-20 flex flex-col justify-between">
                <div className="text-blue-400 font-semibold text-sm mb-1">Another prompt</div>
                <div className="text-xs text-gray-300">"What is the pH formula and how to calculate it?"</div>
              </div>
              <div className="bg-gray-800/60 backdrop-blur-sm p-3 rounded-xl border border-blue-700/50 text-left hover:border-blue-600/70 transition-colors h-20 flex flex-col justify-between">
                <div className="text-blue-400 font-semibold text-sm mb-1">Practice prompt</div>
                <div className="text-xs text-gray-300">"Show me the equilibrium constant equation"</div>
              </div>
              <div className="bg-gray-800/60 backdrop-blur-sm p-3 rounded-xl border border-blue-700/50 text-left hover:border-blue-600/70 transition-colors h-20 flex flex-col justify-between">
                <div className="text-blue-400 font-semibold text-sm mb-1">Challenge prompt</div>
                <div className="text-xs text-gray-300">"Explain Gibbs free energy with equations"</div>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-400 bg-blue-900/30 px-4 py-2 rounded-lg border border-blue-700/50">
              Note: <strong>Pro tip:</strong> {documentName ? 'I can analyze your document and provide citations!' : 'Upload a document to ask questions about it with citations!'}
            </div>
          </div>
        ) : (
          chatInteractions.map((interaction) => (
            <div key={interaction.id} className="space-y-3 animate-slide-up">
              {interaction.prompt?.trim() && (
                <div className="flex justify-end">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm p-4 max-w-[75ch] shadow-lg break-words">
                    <p className="text-xs font-semibold mb-1 opacity-90">You</p>
                    <p className="text-sm">{interaction.prompt}</p>
                  </div>
                </div>
              )}
              {(interaction.response?.trim() || interaction.toolResponses?.length) && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl rounded-tl-sm p-4 max-w-[75ch] shadow-md border border-gray-700 space-y-3 break-words">
                    <div className="flex items-center gap-2">
                      <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 p-1.5 rounded-lg">
                        <Sparkles size={14} className="text-blue-400" />
                      </div>
                      <p className="text-xs font-semibold text-gray-300">AI Assistant</p>
                    </div>
                    {interaction.toolResponses?.length ? (
                      <div className="space-y-3">
                        {interaction.toolResponses.map(tool => (
                          <AIToolResponseCard key={tool.id} response={tool} />
                        ))}
                      </div>
                    ) : null}
                    {interaction.response?.trim() && (
                      <>
                        <div className="text-sm text-gray-200">
                          <LLMMessage
                            content={interaction.response}
                            onCitationClick={onOpenDocument}
                          />
                        </div>
                        <VerifiedSmilesBlock sourceText={interaction.response} />
                        {onRequestVideoSearch && (
                          <button
                            type="button"
                            onClick={() => onRequestVideoSearch(interaction.response || '')}
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 transition-colors"
                          >
                            Find on YouTube
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSendMessage?.(interaction.response, { mode: interaction.mode })}
                          className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 transition-colors"
                        >
                          <span>Find on YouTube</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm p-4 shadow-md border border-gray-700">
              <div className="flex items-center gap-3 text-blue-400">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-sm font-medium">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700 bg-gray-800/80 backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask about your chemistry work..."
            className="flex-1 px-4 py-3 border-2 border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent transition-all bg-gray-700 text-white placeholder-gray-400 shadow-sm min-h-[48px]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !message.trim()}
            className="md:px-5 md:py-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
