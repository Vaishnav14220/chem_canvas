import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Copy, ThumbsUp, ThumbsDown, RotateCcw, History, ChevronLeft, Trash2, Pin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import * as geminiService from '../services/geminiService';
import { detectToolCalls, executeToolCalls } from '../services/aiToolOrchestrator';
import type { AIToolResponse } from '../types';
import AIToolResponseCard from './AIToolResponseCard';
import { useChatPersistence } from '../hooks';
import 'katex/dist/katex.min.css';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  toolResponses?: AIToolResponse[];
}

interface LobeChatProps {
  onRequireApiKey?: () => void;
  onRequestVideoSearch?: (content: string) => void;
  showHeader?: boolean;
}

const LobeChat: React.FC<LobeChatProps> = ({ onRequireApiKey, onRequestVideoSearch, showHeader = true }) => {
  const RESPONSE_STYLE_PROMPT = `You are ChemAssist, a professional chemistry tutor. Always respond in properly formatted Markdown with LaTeX math expressions. Rules:
- Begin with a one-sentence overview of the answer.
- Use Markdown headings (## / ###) for major sections and bullet lists (-) for enumerations.
- Render ALL math and chemistry expressions with LaTeX:
  * Inline math: $...$ (e.g., $E = mc^2$, $K_{eq}$, $\\Delta H$)
  * Display math: $$...$$ for equations
  * Chemical formulas: Use subscripts like H_{2}O, Fe_{2}O_{3}, CH_{3}COOH
  * Reactions: Use LaTeX arrows like → or ⇌ (e.g., $$CH_{4} + 2O_{2} \\rightarrow CO_{2} + 2H_{2}O$$)
- Use proper Markdown formatting: **bold**, *italic*, \`code\`, > blockquotes
- For chemical structures, describe them clearly and suggest SMILES when relevant
- Provide concise but comprehensive explanations
- Include safety notes for hazardous reactions or compounds when applicable`;

  // Chat persistence hook
  const {
    chats,
    currentChat,
    messages: persistedMessages,
    isLoadingChats,
    isLoadingMessages,
    loadChats,
    loadChat,
    createNewChat,
    saveExchange,
    deleteCurrentChat,
    clearCurrentChat,
    pinChat,
  } = useChatPersistence({
    chatType: 'general',
    enableRealtime: true,
    onError: (error) => console.error('Chat persistence error:', error),
  });

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m ChemAssist, your AI chemistry assistant. Ask me anything about chemistry, molecules, reactions, or scientific concepts!',
      role: 'assistant',
      timestamp: new Date(),
    },
  ]);

  // Combine persisted messages with local state
  const messages = currentChat ? persistedMessages.map(m => ({
    id: m.id,
    content: m.content,
    role: m.role as 'user' | 'assistant',
    timestamp: m.timestamp?.toDate?.() || new Date(),
    toolResponses: m.toolCalls?.filter(tc => tc.output).map(tc => tc.output as AIToolResponse),
  })) : localMessages;

  const setMessages = currentChat 
    ? () => {} // Don't allow direct modification when using persisted chat
    : setLocalMessages;

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start a new chat
  const handleNewChat = useCallback(async () => {
    try {
      await createNewChat();
      setShowHistory(false);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  }, [createNewChat]);

  // Load a chat from history
  const handleLoadChat = useCallback(async (chatId: string) => {
    try {
      await loadChat(chatId);
      setShowHistory(false);
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  }, [loadChat]);

  // Delete a chat
  const handleDeleteChat = useCallback(async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this chat?')) return;
    try {
      // If deleting current chat, clear it
      if (currentChat?.id === chatId) {
        await deleteCurrentChat();
      }
      await loadChats();
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  }, [currentChat, deleteCurrentChat, loadChats]);

  // Pin a chat
  const handlePinChat = useCallback(async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await pinChat(chatId);
    } catch (error) {
      console.error('Error pinning chat:', error);
    }
  }, [pinChat]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessageContent = input;
    const userMessage: Message = {
      id: Date.now().toString(),
      content: userMessageContent,
      role: 'user',
      timestamp: new Date(),
    };

    // For local state (when not using persisted chat)
    if (!currentChat) {
      setLocalMessages(prev => [...prev, userMessage]);
    }
    
    setInput('');
    setIsLoading(true);
    let assistantMessageId: string | null = null;
    let finalResponse = '';
    let toolResponses: AIToolResponse[] = [];

    try {
      // Check if Gemini API is initialized
      if (!geminiService.isGeminiInitialized()) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: '🔑 **API Key Required**\n\nTo use the chat assistant, please configure your Gemini API key first.\n\n1. Click the Settings button (⚙️) in the toolbar\n2. Enter your Google Gemini API key\n3. Save the configuration\n\nGet your free API key at: https://makersuite.google.com/app/apikey',
          role: 'assistant',
          timestamp: new Date(),
        };
        if (!currentChat) {
          setLocalMessages(prev => [...prev, errorMessage]);
        }
        setIsLoading(false);
        return;
      }

      try {
        const plans = await detectToolCalls(userMessageContent);
        if (plans.length) {
          toolResponses = await executeToolCalls(plans);
        }
      } catch (toolError) {
        console.warn('Tool orchestration failed in LobeChat:', toolError);
      }

      assistantMessageId = `assistant-${Date.now()}`;
      const placeholderMessage: Message = {
        id: assistantMessageId,
        content: '',
        role: 'assistant',
        timestamp: new Date(),
      };
      
      if (!currentChat) {
        setLocalMessages(prev => [...prev, placeholderMessage]);
      }

      // Call Gemini API with streaming updates
      finalResponse = await geminiService.streamTextContent(
        `${RESPONSE_STYLE_PROMPT}

User question: ${userMessageContent}`,
        (chunk) => {
          if (!currentChat) {
            setLocalMessages(prev =>
              prev.map(message =>
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${chunk}` }
                  : message
              )
            );
          }
        },
        { model: 'gemini-2.5-flash' }
      );

      if (!currentChat) {
        setLocalMessages(prev =>
          prev.map(message =>
            message.id === assistantMessageId
              ? { ...message, content: finalResponse, toolResponses }
              : message
          )
        );
      }

      // Save to Firebase - this will persist the exchange
      try {
        await saveExchange(userMessageContent, finalResponse, toolResponses);
        console.log('✅ Chat saved to Firebase');
      } catch (saveError) {
        console.error('Failed to save chat to Firebase:', saveError);
        // Still show the response even if saving fails
      }
    } catch (error: any) {
      console.error('Gemini API error:', error);
      const message = error?.message || '';
      const lower = message.toLowerCase();
      const shouldPrompt =
        error?.code === 'USER_KEY_REQUIRED' ||
        error?.code === 'USER_KEY_INVALID' ||
        error?.code === 'USER_KEY_RATE_LIMITED' ||
        lower.includes('add your own gemini api key') ||
        lower.includes('personal gemini api key');
      if (shouldPrompt) {
        window.alert(message || 'Please add your Gemini API key in Settings to continue.');
        onRequireApiKey?.();
      }
      if (assistantMessageId && !currentChat) {
        setLocalMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
      }
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `❌ **Error**: ${error.message || 'Failed to generate response'}\n\nPlease check:\n• Your API key is correct\n• You have internet connection\n• You haven't exceeded API quota`,
        role: 'assistant',
        timestamp: new Date(),
      };
      if (!currentChat) {
        setLocalMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Chat history panel
  const renderHistoryPanel = () => (
    <div className="absolute inset-0 z-20 bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(false)}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-slate-400" />
          </button>
          <h3 className="text-sm font-semibold text-slate-100">Chat History</h3>
        </div>
        <button
          onClick={handleNewChat}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoadingChats ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No chat history yet</p>
            <p className="text-xs text-slate-600 mt-1">Start a conversation to save it</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleLoadChat(chat.id)}
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                currentChat?.id === chat.id
                  ? 'bg-blue-600/20 border-blue-500/50'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {chat.isPinned && <Pin className="h-3 w-3 inline-block mr-1 text-yellow-500" />}
                    {chat.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {chat.messageCount || 0} messages • {chat.updatedAt?.toDate?.()?.toLocaleDateString() || 'Just now'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handlePinChat(chat.id, e)}
                    className={`p-1 rounded hover:bg-slate-700 transition-colors ${chat.isPinned ? 'text-yellow-500' : 'text-slate-500'}`}
                    title={chat.isPinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    className="p-1 rounded hover:bg-red-900/50 text-slate-500 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950 text-slate-100 relative">
      {showHistory && renderHistoryPanel()}
      
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur">
          <div className="flex items-center space-x-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {currentChat?.title || 'ChemAssist'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Gemini 2.5 Flash</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                loadChats();
                setShowHistory(true);
              }}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Chat history"
            >
              <History className="h-4 w-4 text-slate-500" />
            </button>
            <button
              onClick={async () => {
                if (currentChat) {
                  await clearCurrentChat();
                } else {
                  setLocalMessages([localMessages[0]]);
                }
              }}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title="Clear conversation"
            >
              <RotateCcw className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>
      )}

      {/* Chat mode indicator when not showing header */}
      {!showHeader && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadChats();
                setShowHistory(true);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              title="Chat history"
            >
              <History className="h-4 w-4 text-slate-400" />
            </button>
            <span className="text-xs text-slate-500">
              {currentChat ? currentChat.title : 'New Chat'}
            </span>
          </div>
          <button
            onClick={async () => {
              if (currentChat) {
                await clearCurrentChat();
              } else {
                setLocalMessages([localMessages[0]]);
              }
            }}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Clear"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-slate-950/50" ref={messagesContainerRef}>
        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`flex w-full max-w-[560px] items-start gap-3 ${isUser ? 'flex-row-reverse text-right' : 'text-left'}`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full shadow-lg ${
                    isUser ? 'bg-slate-100 text-slate-900' : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div
                  className={`w-full rounded-2xl border px-4 py-3 shadow-sm ${
                    isUser
                      ? 'bg-white text-slate-900 border-slate-200'
                      : 'bg-slate-900/80 text-slate-100 border-slate-800'
                  }`}
                >
                {message.content && (
                  <div className={`text-[0.93rem] leading-relaxed break-words ${isUser ? 'text-slate-900' : 'text-slate-100/90'}`}>
                    <div
                      className={`prose prose-sm max-w-[520px] space-y-3 [&_*]:text-inherit ${
                        isUser ? '' : 'prose-invert'
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          a: ({ node, ...linkProps }: any) => (
                            <a
                              {...linkProps}
                              className="text-blue-400 hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          ),
                          code: ({ inline, className, children, ...codeProps }: any) => {
                            const { node, ...rest } = codeProps;
                            const match = /language-(\w+)/.exec(className || '');
                            if (!inline && match) {
                              return (
                                <pre
                                  className="bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-x-auto text-xs"
                                  {...rest}
                                >
                                  <code className={className}>{children}</code>
                                </pre>
                              );
                            }
                            return (
                              <code
                                className="bg-slate-800/80 border border-slate-700 rounded px-1.5 py-0.5 text-xs"
                                {...rest}
                              >
                                {children}
                              </code>
                            );
                          },
                          table: ({ node, children, ...tableProps }: any) => (
                            <div className="overflow-x-auto">
                              <table
                                className="w-full text-left border-collapse border border-slate-700"
                                {...tableProps}
                              >
                                {children}
                              </table>
                            </div>
                          ),
                          th: ({ node, children, ...thProps }: any) => (
                            <th
                              className="border border-slate-700 px-3 py-2 bg-slate-800 font-semibold text-sm"
                              {...thProps}
                            >
                              {children}
                            </th>
                          ),
                          td: ({ node, children, ...tdProps }: any) => (
                            <td className="border border-slate-700 px-3 py-2 text-sm" {...tdProps}>
                              {children}
                            </td>
                          ),
                          li: ({ node, children, ...liProps }: any) => (
                            <li className="mb-1" {...liProps}>
                              {children}
                            </li>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                {message.toolResponses?.length ? (
                  <div className="mt-3 space-y-3">
                    {message.toolResponses.map(tool => (
                      <AIToolResponseCard key={tool.id} response={tool} />
                    ))}
                  </div>
                ) : null}
                <div
                  className={`mt-3 flex items-center justify-between text-[11px] ${
                    isUser ? 'text-slate-500 flex-row-reverse' : 'text-slate-300'
                  }`}
                >
                  <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {!isUser && (
                    <div className="flex items-center gap-1">
                      {onRequestVideoSearch && (
                        <button
                          onClick={() => onRequestVideoSearch(message.content)}
                          className="mr-2 inline-flex items-center gap-1 rounded-lg border border-blue-500/40 px-2 py-1 text-[10px] font-semibold text-blue-200 hover:bg-blue-500/20 transition-colors"
                        >
                          <span>Find on YouTube</span>
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="p-1 rounded hover:bg-slate-800 transition-colors"
                        title="Copy message"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button className="p-1 rounded hover:bg-slate-800 transition-colors">
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button className="p-1 rounded hover:bg-slate-800 transition-colors">
                        <ThumbsDown className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm mr-12">
              <div className="flex items-center space-x-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
                  <Bot className="h-3 w-3 text-white" />
                </div>
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/90 backdrop-blur-sm">
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about chemistry..."
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 pr-12 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px] max-h-32 placeholder:text-slate-500"
              rows={1}
              style={{ height: 'auto', minHeight: '44px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 text-white shadow-lg transition-all duration-200 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
          <span>Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  );
};

export default LobeChat;
