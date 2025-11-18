import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessage, ChatMode, TranscriptionMessage } from './types';
import { Send, Image as ImageIcon, X, Loader2, Zap, BrainCircuit, Search, Bot, User, Globe } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const getDomain = (url: string) => {
  try {
    const domain = new URL(url).hostname;
    return domain.replace(/^www\./, '');
  } catch (e) {
    return 'Source';
  }
};

interface GeminiLiveChatInterfaceProps {
  apiKey: string;
  liveTranscripts?: TranscriptionMessage[];
}

const GeminiLiveChatInterface: React.FC<GeminiLiveChatInterfaceProps> = ({ apiKey, liveTranscripts = [] }) => {
  // Note: This component is currently simplified. For a full implementation,
  // you would need to integrate with the actual Gemini API using the provided apiKey
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('FAST');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allMessages = useMemo(() => {
    const transcriptMessages: ChatMessage[] = liveTranscripts.map(t => ({
      id: t.id,
      role: t.sender === 'user' ? 'user' : 'model',
      text: t.text,
      timestamp: t.timestamp
    }));
    
    return [...messages, ...transcriptMessages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [messages, liveTranscripts]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

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

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      text: input,
      image: selectedImage || undefined,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);

    const currentInput = input;
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
      // Import the chat service
      const { generateChatResponseStream } = await import('./services/chatService');

      // Convert history for API (using current messages state which excludes the just-added user msg, which is correct as we pass it separately)
      const history = messages.map(m => ({
        role: m.role,
        parts: m.image
          ? [{ text: m.text }, { inlineData: { mimeType: m.image.split(';')[0].split(':')[1], data: m.image.split(',')[1] } }]
          : [{ text: m.text }]
      }));

      const stream = await generateChatResponseStream(history, currentInput, currentImage || null, mode, apiKey);

      let fullText = '';

      for await (const chunk of stream.stream) {
          const text = chunk.text || '';
          fullText += text;
          const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;

          setMessages(prev => prev.map(msg => {
              if (msg.id === botMsgId) {
                  return {
                      ...msg,
                      text: fullText,
                      // Update metadata if present, or keep existing if already received
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

  return (
    <div className="flex flex-col h-full bg-slate-900/30 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Toolbar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between backdrop-blur">
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setMode('FAST')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
              mode === 'FAST' ? 'bg-molecule-teal text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap size={14} />
            Fast
          </button>
          <button
            onClick={() => setMode('PRO')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
              mode === 'PRO' ? 'bg-molecule-purple text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BrainCircuit size={14} />
            Pro
          </button>
          <button
            onClick={() => setMode('SEARCH')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
              mode === 'SEARCH' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search size={14} />
            Search
          </button>
        </div>
        <div className="text-[10px] text-slate-500 font-mono hidden sm:block">
           {mode === 'FAST' && "Model: Gemini 2.5 Flash"}
           {mode === 'PRO' && "Model: Gemini 3.0 Pro"}
           {mode === 'SEARCH' && "Model: Gemini 2.5 Flash + Search"}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {allMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
            <BrainCircuit className="w-16 h-16 mb-4 stroke-1" />
            <p className="text-sm font-mono">Select a mode and ask a question</p>
          </div>
        )}
        {allMessages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'user' ? 'bg-slate-700' : 'bg-molecule-teal text-slate-900'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-slate-800 text-slate-200 rounded-tr-sm'
                  : 'bg-slate-950 border border-slate-800 text-slate-100 rounded-tl-sm shadow-sm'
              }`}>
                {msg.image && (
                  <img src={msg.image} alt="Uploaded content" className="max-w-full h-auto rounded-lg mb-3 border border-slate-700" />
                )}
                {msg.role === 'user' ? (
                   <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                   <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                     <ReactMarkdown
                       remarkPlugins={[remarkMath]}
                       rehypePlugins={[rehypeKatex]}
                       components={{
                          a: ({node, ...props}) => <a {...props} className="text-molecule-teal hover:underline break-all" target="_blank" rel="noopener noreferrer" />,
                          code: ({node, ...props}) => <code {...props} className="bg-slate-900 px-1 py-0.5 rounded text-molecule-purple font-mono text-xs" />,
                       }}
                     >
                       {msg.text}
                     </ReactMarkdown>
                   </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
           <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-molecule-teal text-slate-900 flex items-center justify-center">
                 <Bot size={16} />
              </div>
              <div className="bg-slate-950 border border-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm">
                 <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              </div>
           </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        {selectedImage && (
          <div className="flex items-center gap-2 mb-2 bg-slate-900 p-2 rounded-lg w-fit border border-slate-800">
            <div className="relative w-10 h-10 overflow-hidden rounded bg-black">
               <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <span className="text-xs text-slate-400 truncate max-w-[100px]">Image attached</span>
            <button onClick={() => setSelectedImage(null)} className="p-1 hover:bg-slate-800 rounded-full text-slate-500">
               <X size={14} />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-400 hover:text-molecule-teal hover:bg-slate-900 rounded-xl transition-colors border border-transparent hover:border-slate-800"
            title="Attach Image"
          >
            <ImageIcon size={20} />
          </button>
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
            placeholder={mode === 'PRO' ? "Ask complex questions or analyze images..." : "Ask a quick chemistry question..."}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-molecule-teal focus:ring-1 focus:ring-molecule-teal resize-none max-h-32 min-h-[46px]"
            rows={1}
            style={{ height: 'auto', minHeight: '46px' }}
          />

          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !selectedImage)}
            className="p-3 bg-molecule-teal text-slate-900 rounded-xl font-medium hover:bg-molecule-teal/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeminiLiveChatInterface;
