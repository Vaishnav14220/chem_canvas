import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChatMessage, ChatMode, TranscriptionMessage } from './types';
import { Send, Image as ImageIcon, X, Loader2, Zap, BrainCircuit, Search, Bot, User, Compass, Lightbulb, MessageSquare, Code, Mic, Paperclip } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai/conversation';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';
import { GeminiModelId, getDefaultModelId } from '../../types/modelTypes';

interface GeminiLiveChatInterfaceProps {
  apiKey: string;
  liveTranscripts?: TranscriptionMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
  onModeChange?: (mode: ChatMode) => void;
  onModelChange?: (modelId: GeminiModelId) => void;
  initialMessages?: ChatMessage[];
  initialMode?: ChatMode;
  initialModel?: GeminiModelId;
  onStartVoiceSession?: () => void;
}

const GeminiLiveChatInterface: React.FC<GeminiLiveChatInterfaceProps> = ({
  apiKey,
  liveTranscripts = [],
  onMessagesChange,
  onModeChange,
  onModelChange,
  initialMessages = [],
  initialMode = 'FAST',
  initialModel,
  onStartVoiceSession
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>(initialMode);
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(initialModel || getDefaultModelId());
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync internal state with props callbacks
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    onModelChange?.(selectedModel);
  }, [selectedModel, onModelChange]);

  const allMessages = useMemo(() => {
    const transcriptMessages: ChatMessage[] = liveTranscripts.map(t => ({
      id: t.id,
      role: t.sender === 'user' ? 'user' : 'model',
      text: t.text,
      timestamp: t.timestamp
    }));

    return [...messages, ...transcriptMessages].sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
  }, [messages, liveTranscripts]);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [allMessages, scrollToBottom]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        // Switch to Pro mode automatically if image is attached
        if (mode === 'FAST') setMode('PRO');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (text: string = input) => {
    if ((!text.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      text: text,
      image: selectedImage || undefined,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);

    const currentInput = text;
    const currentImage = selectedImage;

    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    // Create placeholder for bot response
    const botMsgId = uuidv4();
    setMessages(prev => [...prev, {
      id: botMsgId,
      role: 'model',
      text: '',
      timestamp: new Date()
    }]);

    try {
      const { generateChatResponseStream } = await import('./services/chatService');

      const history = messages.map(m => ({
        role: m.role,
        parts: m.image
          ? [{ text: m.text }, { inlineData: { mimeType: m.image.split(';')[0].split(':')[1], data: m.image.split(',')[1] } }]
          : [{ text: m.text }]
      }));

      const stream = await generateChatResponseStream(history, currentInput, currentImage || null, mode, apiKey, selectedModel);

      let fullText = '';

      for await (const chunk of stream as AsyncIterable<any>) {
        const text = chunk.text || '';
        fullText += text;
        const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;

        setMessages(prev => prev.map(msg => {
          if (msg.id === botMsgId) {
            return {
              ...msg,
              text: fullText,
              groundingMetadata: groundingMetadata || msg.groundingMetadata
            };
          }
          return msg;
        }));
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg =>
        msg.id === botMsgId
          ? { ...msg, text: "Sorry, I encountered an error processing your request. Please try again." }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const SuggestionCard = ({ icon: Icon, text, onClick }: { icon: any, text: string, onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 p-4 rounded-xl bg-muted/40 hover:bg-muted/60 border border-border/50 text-left transition-all duration-200"
    >
      <Icon size={16} className="text-muted-foreground" />
      <span className="text-sm font-medium text-foreground leading-snug">{text}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Messages Area */}
      <div className="flex-1 min-h-0 relative">
        <Conversation
          className="h-full bg-transparent border-none"
          padding="md"
          initial="instant"
          resize="smooth"
        >
          <ConversationContent className="max-w-3xl mx-auto w-full px-4">
            {allMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center mt-12 mb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8 p-4 rounded-full bg-muted/50 ring-1 ring-border">
                  <Bot size={32} className="text-foreground" />
                </div>
                <h1 className="text-2xl font-semibold mb-2 text-foreground text-center">
                  How can I help you today?
                </h1>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mt-8">
                  <SuggestionCard
                    icon={Compass}
                    text="Explain the concept of orbital hybridization"
                    onClick={() => handleSend("Explain the concept of orbital hybridization")}
                  />
                  <SuggestionCard
                    icon={Code}
                    text="Write a Python script to balance equations"
                    onClick={() => handleSend("Write a Python script to balance equations")}
                  />
                  <SuggestionCard
                    icon={Lightbulb}
                    text="Brainstorm ideas for a chemistry project"
                    onClick={() => handleSend("Brainstorm ideas for a chemistry project")}
                  />
                  <SuggestionCard
                    icon={MessageSquare}
                    text="Draft a summary of thermodynamics laws"
                    onClick={() => handleSend("Draft a summary of thermodynamics laws")}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 py-6">
                {allMessages.map((msg) => (
                  <div key={`${msg.id}-${msg.timestamp.getTime()}`} className="flex gap-4 group">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border bg-muted/50",
                      msg.role === 'user' ? "text-muted-foreground" : "text-primary"
                    )}>
                      {msg.role === 'user' ? <User size={14} /> : <Zap size={14} />}
                    </div>

                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {msg.role === 'user' ? 'You' : 'Gemini'}
                        </span>
                        <span className="text-xs text-muted-foreground opacity-50">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-sm leading-relaxed text-foreground/90">
                        {msg.image && (
                          <div className="relative mb-3 rounded-lg overflow-hidden border border-border max-w-sm">
                            <img src={msg.image} alt="Uploaded content" className="w-full h-auto object-cover" />
                          </div>
                        )}

                        {msg.role === 'user' ? (
                          <div className="whitespace-pre-wrap">{msg.text}</div>
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4" />,
                              code: ({ node, className, children, ...props }) => {
                                const isInline = !className;
                                if (isInline) {
                                  return <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono text-foreground" {...props}>{children}</code>;
                                }
                                return <code className="block bg-muted/50 p-4 rounded-lg border border-border font-mono text-sm overflow-x-auto my-2" {...props}>{children}</code>;
                              },
                              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc pl-4 mb-3 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-4 mb-3 space-y-1">{children}</ol>,
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border bg-muted/50 text-primary">
                      <Zap size={14} />
                    </div>
                    <div className="flex items-center gap-2 py-1.5">
                      <div className="h-4 w-4 rounded-full bg-foreground/20 animate-pulse" />
                      <div className="h-4 w-4 rounded-full bg-foreground/20 animate-pulse delay-75" />
                      <div className="h-4 w-4 rounded-full bg-foreground/20 animate-pulse delay-150" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ConversationContent>
        </Conversation>
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 w-full max-w-3xl mx-auto">
        <div className="relative rounded-2xl border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">

          <div className="p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className="w-full bg-transparent border-none text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-0 resize-none max-h-48 min-h-[60px]"
              rows={1}
              style={{ height: 'auto', minHeight: '60px' }}
            />
          </div>

          {selectedImage && (
            <div className="px-3 pb-3">
              <div className="relative inline-flex items-center gap-2 bg-muted/50 rounded-lg p-1.5 pr-3 border border-border">
                <img src={selectedImage} alt="Preview" className="h-8 w-8 rounded object-cover" />
                <span className="text-xs text-muted-foreground">Image attached</span>
                <button onClick={() => setSelectedImage(null)} className="ml-1 p-0.5 hover:bg-background rounded-full transition-colors">
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-2 pt-0">
            <div className="flex items-center gap-1">
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                disabled={isLoading}
                compact={true}
              />

              <div className="h-4 w-px bg-border mx-1" />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>

              <button
                onClick={onStartVoiceSession}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="Voice input"
              >
                <Mic size={18} />
              </button>
            </div>

            <button
              onClick={() => handleSend()}
              disabled={isLoading || (!input.trim() && !selectedImage)}
              className={cn(
                "p-2 rounded-lg transition-all",
                input.trim() || selectedImage
                  ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-3">
          AI can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
};

export default GeminiLiveChatInterface;
