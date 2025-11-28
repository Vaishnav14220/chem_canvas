import React, { useState, useRef, useEffect } from 'react';
import { Send, Globe, Bot, User, Search, ExternalLink, X, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { sendStudiumChatMessage } from '../../services/geminiService';
import { ChatMessage } from '../../types/studium';
import { Spinner } from './Spinner';

const MarkdownText = ({ content }: { content: string }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
            p: ({ node, ...props }) => <span {...props} className="inline" />,
            a: ({ node, ...props }) => <a {...props} className="text-blue-600 underline" target="_blank" rel="noreferrer" />,
            ul: ({ node, ...props }) => <ul {...props} className="list-disc list-inside my-2" />,
            ol: ({ node, ...props }) => <ol {...props} className="list-decimal list-inside my-2" />,
            li: ({ node, ...props }) => <li {...props} className="my-1" />,
            h1: ({ node, ...props }) => <h1 {...props} className="text-xl font-bold my-2" />,
            h2: ({ node, ...props }) => <h2 {...props} className="text-lg font-bold my-2" />,
            h3: ({ node, ...props }) => <h3 {...props} className="text-md font-bold my-1" />,
            code: ({ node, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                return !match ? (
                    <code className="bg-slate-200 rounded px-1 py-0.5 text-sm font-mono text-slate-800" {...props}>
                        {children}
                    </code>
                ) : (
                    <div className="my-2 rounded-lg overflow-hidden bg-slate-800 text-slate-200 p-3 text-sm font-mono">
                        <code className={className} {...props}>
                            {children}
                        </code>
                    </div>
                );
            }
        }}
    >
        {content}
    </ReactMarkdown>
);

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
    const [activeCitation, setActiveCitation] = useState<{ url: string; title: string; snippet?: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

            // Log metadata for debugging
            if (response.groundingMetadata) {
                console.log("Grounding Metadata:", response.groundingMetadata);
            }

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
            return <MarkdownText content={msg.text} />;
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
                elements.push(
                    <MarkdownText key={`pre-${i}`} content={text.substring(lastIndex, startIndex)} />
                );
            }

            // Add the supported text segment
            const supportedText = text.substring(startIndex, endIndex);
            elements.push(
                <span key={`text-${i}`} className="bg-blue-50/50 rounded px-0.5">
                    <MarkdownText content={supportedText} />
                </span>
            );

            // Add citation markers
            if (support.groundingChunkIndices && support.groundingChunkIndices.length > 0) {
                support.groundingChunkIndices.forEach((chunkIndex, j) => {
                    const chunk = groundingMetadata.groundingChunks[chunkIndex];
                    const web = chunk?.web;
                    if (web) {
                        elements.push(
                            <button
                                key={`cite-${i}-${j}`}
                                className={`inline-flex items-center justify-center w-4 h-4 ml-0.5 text-[10px] font-bold rounded-full align-super transition-colors ${activeCitation?.url === web.uri
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                                    }`}
                                title={web.title}
                                onClick={() => setActiveCitation({
                                    url: web.uri,
                                    title: web.title,
                                    snippet: supportedText
                                })}
                                onMouseEnter={() => {
                                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                    hoverTimeoutRef.current = setTimeout(() => {
                                        setActiveCitation({
                                            url: web.uri,
                                            title: web.title,
                                            snippet: supportedText
                                        });
                                    }, 500); // 500ms delay to open
                                }}
                                onMouseLeave={() => {
                                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                }}
                            >
                                {chunkIndex + 1}
                            </button>
                        );
                    }
                });
            }

            lastIndex = endIndex;
        });

        // Add remaining text
        if (lastIndex < text.length) {
            elements.push(
                <MarkdownText key="post" content={text.substring(lastIndex)} />
            );
        }

        return <>{elements}</>;
    };

    // Heuristic to extract the most likely "quote" from the model's text
    const extractSmartSnippet = (text: string): string => {
        // Split by common linking words/phrases that the model uses to summarize
        const separators = [
            ' is ', ' are ', ' was ', ' were ',
            ' refers to ', ' defined as ', ' known as ',
            ' example of ', ' such as ', ' like ', ' including ',
            ' states that ', ' according to ', ' shows that ',
            ' used in ', ' made from ', ' consists of '
        ];

        // Create a regex from separators
        const regex = new RegExp(separators.join('|'), 'i');

        // Split the text
        const parts = text.split(regex);

        // Find the longest part (likely the noun phrase or list)
        let bestPart = parts[0];
        for (const part of parts) {
            if (part.length > bestPart.length) {
                bestPart = part;
            }
        }

        return bestPart.trim();
    };

    const getHighlightedUrl = (url: string, snippet?: string) => {
        if (!snippet) return url;

        // Use smart extraction to get a better search term
        const smartSnippet = extractSmartSnippet(snippet);

        // Clean snippet for URL fragment (remove special chars, limit length)
        const cleanSnippet = smartSnippet.replace(/[^\w\s,.-]/g, '').trim().substring(0, 100);

        if (cleanSnippet.length < 5) return url; // Too short to be useful

        return `${url}#:~:text=${encodeURIComponent(cleanSnippet)}`;
    };

    const handleCopySnippet = () => {
        if (activeCitation?.snippet) {
            navigator.clipboard.writeText(activeCitation.snippet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
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
                            <div className={`max-w-[85%] md:max-w-[90%] rounded-2xl p-4 ${msg.role === 'user'
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
                                        : <MarkdownText content={msg.text} />
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
                                                    <button
                                                        onClick={() => setActiveCitation({
                                                            url: source.uri,
                                                            title: source.title,
                                                        })}
                                                        className="text-xs text-blue-600 underline truncate block hover:text-blue-800 text-left w-full"
                                                    >
                                                        [{idx + 1}] {source.title || source.uri}
                                                    </button>
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

            {/* Side Panel Preview */}
            {activeCitation && (
                <div className="w-[45%] min-w-[400px] border-l border-slate-200 bg-white flex flex-col animate-in slide-in-from-right duration-300 shadow-xl z-10">
                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <div className="flex-1 min-w-0 mr-2">
                            <h4 className="font-semibold text-slate-800 text-sm truncate" title={activeCitation.title}>
                                {activeCitation.title}
                            </h4>
                            <p className="text-xs text-slate-500 truncate">{activeCitation.url}</p>
                        </div>
                        <div className="flex items-center gap-1">
                            <a
                                href={getHighlightedUrl(activeCitation.url, activeCitation.snippet)}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Open in new tab"
                            >
                                <ExternalLink size={16} />
                            </a>
                            <button
                                onClick={() => setActiveCitation(null)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Close preview"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {activeCitation.snippet && (
                        <div className="p-3 bg-indigo-50/50 border-b border-indigo-100">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">Referenced Context</p>
                                <button
                                    onClick={handleCopySnippet}
                                    className="text-[10px] flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition"
                                >
                                    {copied ? <Check size={10} /> : <Copy size={10} />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <p className="text-sm text-slate-700 italic border-l-2 border-indigo-300 pl-3 py-1">
                                "{activeCitation.snippet}"
                            </p>
                        </div>
                    )}

                    <div className="flex-1 bg-slate-100 relative">
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 flex-col gap-2">
                            <Globe size={32} className="opacity-20" />
                            <span className="text-sm">Loading preview...</span>
                        </div>
                        <iframe
                            src={getHighlightedUrl(activeCitation.url, activeCitation.snippet)}
                            className="absolute inset-0 w-full h-full border-none bg-white"
                            title="Website Preview"
                            sandbox="allow-scripts allow-same-origin"
                            loading="lazy"
                        />
                    </div>
                    <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400">
                            If the preview doesn't load, use the external link button above.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
