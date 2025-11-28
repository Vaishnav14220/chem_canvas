import React, { useState, useRef, useEffect } from 'react';
import { Send, Globe, Bot, User, Search } from 'lucide-react';
import { sendStudiumChatMessage } from '../../services/geminiService';
import { ChatMessage } from '../../types/studium';
import { Spinner } from './Spinner';

export const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            role: 'model',
            text: "Hi! I'm your AI tutor. I can help answer questions or research topics for you using Google Search.",
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [useSearch, setUseSearch] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Build history for context
            const history = messages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const response = await sendStudiumChatMessage(userMsg.text, history, useSearch);

            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: response.text || "I couldn't generate a response.",
                sources: response.sources,
                groundingMetadata: response.groundingMetadata,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: "Sorry, I encountered an error connecting to the AI service.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const renderMessageWithCitations = (msg: ChatMessage) => {
        if (!msg.groundingMetadata || !msg.groundingMetadata.groundingSupports) {
            return msg.text;
        }

        const { text, groundingMetadata } = msg;
        const { groundingSupports } = groundingMetadata;

        let lastIndex = 0;
        const elements: React.ReactNode[] = [];

        // Sort supports by start index to be safe
        const sortedSupports = [...groundingSupports].sort((a, b) =>
            (a.segment.startIndex || 0) - (b.segment.startIndex || 0)
        );

        sortedSupports.forEach((support, i) => {
            const startIndex = support.segment.startIndex || 0;
            const endIndex = support.segment.endIndex || 0;

            // Add text before the supported segment
            if (startIndex > lastIndex) {
                elements.push(text.substring(lastIndex, startIndex));
            }

            // Add the supported text segment
            elements.push(
                <span key={`text-${i}`} className="bg-blue-50/50 rounded px-0.5">
                    {text.substring(startIndex, endIndex)}
                </span>
            );

            // Add citation markers
            if (support.groundingChunkIndices && support.groundingChunkIndices.length > 0) {
                support.groundingChunkIndices.forEach((chunkIndex, j) => {
                    const chunk = groundingMetadata.groundingChunks[chunkIndex];
                    if (chunk && chunk.web) {
                        elements.push(
                            <a
                                key={`cite-${i}-${j}`}
                                href={chunk.web.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center w-4 h-4 ml-0.5 text-[10px] font-bold text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 align-super no-underline"
                                title={chunk.web.title}
                            >
                                {chunkIndex + 1}
                            </a>
                        );
                    }
                });
            }

            lastIndex = endIndex;
        });

        // Add remaining text
        if (lastIndex < text.length) {
            elements.push(text.substring(lastIndex));
        }

        return <>{elements}</>;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Bot className="text-indigo-600" size={20} />
                    AI Assistant
                </h3>
                <button
                    onClick={() => setUseSearch(!useSearch)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition ${useSearch
                        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                >
                    <Globe size={14} />
                    Google Search {useSearch ? 'On' : 'Off'}
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-none'
                            : 'bg-slate-100 text-slate-800 rounded-bl-none'
                            }`}>
                            <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
                                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                <span>{msg.role === 'user' ? 'You' : 'EduBot'}</span>
                            </div>
                            <div className="whitespace-pre-wrap leading-relaxed">
                                {msg.groundingMetadata
                                    ? renderMessageWithCitations(msg)
                                    : msg.text
                                }
                            </div>

                            {/* Sources */}
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-200/50">
                                    <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                                        <Search size={10} /> Sources:
                                    </p>
                                    <ul className="space-y-1">
                                        {msg.sources.map((source, idx) => (
                                            <li key={idx}>
                                                <a
                                                    href={source.uri}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-blue-600 underline truncate block hover:text-blue-800"
                                                >
                                                    [{idx + 1}] {source.title || source.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-100 rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
                            <Spinner size="sm" color="text-slate-500" />
                            <span className="text-sm text-slate-500">Thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100">
                <div className="flex gap-2 relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={useSearch ? "Ask a question about current events..." : "Ask for study help..."}
                        className="flex-1 pl-4 pr-12 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition bg-slate-50 focus:bg-white text-gray-900 placeholder:text-gray-400"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
