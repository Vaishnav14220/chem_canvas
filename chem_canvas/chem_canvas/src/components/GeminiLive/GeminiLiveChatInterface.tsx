import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChatMessage, ChatMode, TranscriptionMessage } from './types';
import { Send, Image as ImageIcon, X, Loader2, Zap, BrainCircuit, Search, Bot, User, Compass, Lightbulb, MessageSquare, Code, Mic } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai/conversation';
import { cn } from '@/lib/utils';

interface GeminiLiveChatInterfaceProps {
  apiKey: string;
  liveTranscripts?: TranscriptionMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
  onModeChange?: (mode: ChatMode) => void;
  initialMessages?: ChatMessage[];
  initialMode?: ChatMode;
  onStartVoiceSession?: () => void;
}

const GeminiLiveChatInterface: React.FC<GeminiLiveChatInterfaceProps> = ({ 
  apiKey, 
  liveTranscripts = [],
  onMessagesChange,
  onModeChange,
  initialMessages = [],
  initialMode = 'FAST',
  onStartVoiceSession
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>(initialMode);
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

      const stream = await generateChatResponseStream(history, currentInput, currentImage || null, mode, apiKey);

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
      className="flex flex-col gap-3 p-4 rounded-xl bg-[#1e1f20] hover:bg-[#333537] text-left transition-colors h-full"
    >
      <div className="p-2 w-fit rounded-full bg-[#131314] text-slate-200">
        <Icon size={18} />
      </div>
      <span className="text-sm text-slate-300 font-medium">{text}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[#131314] overflow-hidden relative">
      {/* Messages Area */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <Conversation
          className="h-full bg-transparent border-none"
          padding="md"
          initial="instant"
          resize="smooth"
        >
          <ConversationContent className="max-w-3xl mx-auto w-full">
            {allMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center mt-12 mb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <h1 className="text-5xl md:text-6xl font-medium mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-rose-400 pb-2 text-center">
                   Hello, Dev.
                 </h1>
                 <h2 className="text-4xl md:text-5xl font-medium text-slate-500 mb-16 text-center">
                   How can I help you today?
                 </h2>

                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-4xl px-4">
                    <SuggestionCard 
                      icon={Compass} 
                      text="Explain the concept of orbital hybridization" 
                      onClick={() => handleSend("Explain the concept of orbital hybridization")}
                    />
                    <SuggestionCard 
                      icon={Lightbulb} 
                      text="Briefly summarize the laws of thermodynamics" 
                      onClick={() => handleSend("Briefly summarize the laws of thermodynamics")}
                    />
                    <SuggestionCard 
                      icon={MessageSquare} 
                      text="Brainstorm ideas for a chemistry project" 
                      onClick={() => handleSend("Brainstorm ideas for a chemistry project")}
                    />
                    <SuggestionCard 
                      icon={Code} 
                      text="Write a Python script to balance equations" 
                      onClick={() => handleSend("Write a Python script to balance equations")}
                    />
                 </div>
              </div>
            ) : (
              <div className="flex flex-col gap-8 pb-4 pt-8">
                {allMessages.map((msg) => (
                  <div key={`${msg.id}-${msg.timestamp.getTime()}`} className={cn("flex gap-6 group", msg.role === 'user' ? 'flex-row-reverse' : '')}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                      msg.role === 'user' 
                        ? "bg-slate-700 text-slate-200" 
                        : "bg-gradient-to-br from-blue-500 to-purple-600 text-white"
                    )}>
                      {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    
                    <div className={cn("flex flex-col gap-2 max-w-[85%]", msg.role === 'user' ? 'items-end' : 'items-start')}>
                      {/* Message Bubble */}
                      <div className={cn(
                        "text-base leading-relaxed",
                        msg.role === 'user'
                          ? "text-slate-100 bg-[#28292a] px-5 py-3 rounded-3xl rounded-tr-sm"
                          : "text-slate-200"
                      )}>
                        {msg.image && (
                          <div className="relative mb-3 rounded-xl overflow-hidden border border-slate-700/50 group-image">
                            <img src={msg.image} alt="Uploaded content" className="max-w-full h-auto max-h-[300px] object-cover" />
                          </div>
                        )}
                        
                        {msg.role === 'user' ? (
                           <div className="whitespace-pre-wrap">{msg.text}</div>
                        ) : (
                           <div className="max-w-none">
                             <ReactMarkdown
                               remarkPlugins={[remarkMath]}
                               rehypePlugins={[rehypeKatex]}
                               components={{
                                  a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="no-underline border-b border-blue-500/30 hover:border-blue-500 transition-colors" />,
                                  code: ({node, inline, className, children, ...props}) => {
                                    if (inline) {
                                      return <code className="bg-[#1e1f20] px-1.5 py-0.5 rounded border border-slate-800/50 font-mono text-[13px]" {...props}>{children}</code>;
                                    }
                                    // Code block
                                    return <code className="block bg-[#1e1f20] p-4 rounded-xl border border-slate-800/50 font-mono text-sm text-blue-300 whitespace-pre-wrap overflow-x-auto" {...props}>{children}</code>;
                                  },
                                  pre: ({node, children, ...props}) => <pre className="my-3" {...props}>{children}</pre>,
                               }}
                             >
                               {msg.text}
                             </ReactMarkdown>
                           </div>
                        )}
                      </div>
                      
                      {/* Metadata / Timestamp */}
                      <div className="text-[10px] text-slate-500 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                   <div className="flex gap-6">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center">
                         <Bot size={16} />
                      </div>
                      <div className="flex items-center gap-2 py-2">
                         <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                   </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton className="bg-[#28292a] hover:bg-[#333537] text-slate-200 border-slate-700 shadow-xl mb-4" />
        </Conversation>
      </div>

      {/* Input Area */}
      <div className="flex-none p-6 bg-[#131314] border-t border-slate-800/50 z-10">
        <div className="max-w-3xl mx-auto">
          {selectedImage && (
            <div className="absolute bottom-full left-0 mb-4 flex items-center gap-2 bg-[#1e1f20] p-2 rounded-xl border border-[#28292a]">
              <div className="relative w-12 h-12 overflow-hidden rounded-lg bg-black/20 border border-white/10">
                 <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col px-2">
                <span className="text-xs font-medium text-slate-200">Image attached</span>
                <span className="text-[10px] text-slate-400">Ready to analyze</span>
              </div>
              <button onClick={() => setSelectedImage(null)} className="p-1.5 hover:bg-[#333537] rounded-full text-slate-400 hover:text-slate-200 transition-colors ml-2">
                 <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-[#1e1f20] rounded-full p-2 pl-6 border border-[#28292a] shadow-lg focus-within:ring-1 focus-within:ring-slate-600 transition-all">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a prompt here"
              className="flex-1 bg-transparent border-none py-3 text-base text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-0 resize-none max-h-32 min-h-[24px] leading-relaxed"
              rows={1}
              style={{ height: 'auto' }}
            />

            <div className="flex items-center gap-1 pr-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-[#333537] rounded-full transition-all"
                title="Upload Image"
              >
                <ImageIcon size={20} />
              </button>
              
              {input.trim() || selectedImage ? (
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading}
                  className="p-2.5 bg-slate-200 text-slate-900 hover:bg-white rounded-full transition-all"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} className="ml-0.5" />}
                </button>
              ) : (
                <button
                  onClick={onStartVoiceSession}
                  className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-[#333537] rounded-full transition-all"
                  title="Use Microphone"
                >
                  <Mic size={20} />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex justify-center mt-3">
            <p className="text-[11px] text-slate-500">
              Gemini may display inaccurate info, including about people, so double-check its responses. Your privacy and Gemini Apps
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiLiveChatInterface;
