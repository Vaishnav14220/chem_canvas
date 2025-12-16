"use client";

import { ChevronDown, Brain } from "lucide-react";
import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { cn } from "../../lib/utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ReasoningProps {
    children?: string; // Changed to string to ensure markdown compatibility
    isStreaming?: boolean;
    className?: string;
}

export function Reasoning({
    children,
    isStreaming = false,
    className,
}: ReasoningProps) {
    const [isOpen, setIsOpen] = useState(isStreaming);
    const [startTime] = useState<number>(Date.now());
    const [duration, setDuration] = useState<number>(0);

    useEffect(() => {
        if (isStreaming) {
            setIsOpen(true);
            const interval = setInterval(() => {
                setDuration(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isStreaming, startTime]);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={cn("w-full border border-zinc-800 rounded-lg bg-zinc-900/50 my-2", className)}
        >
            <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 p-3 w-full text-left hover:bg-zinc-800/50 transition-colors focus:outline-none rounded-lg group">
                    <Brain className="h-4 w-4 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                    <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-400 flex-1 transition-colors">
                        {isStreaming ? `Thinking (${duration}s)...` : `Thought for ${duration} seconds`}
                    </span>
                    <ChevronDown
                        className={cn(
                            "h-3 w-3 text-zinc-500 transition-transform duration-200",
                            isOpen ? "rotate-180" : ""
                        )}
                    />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="px-3 pb-3 pt-0 text-xs text-zinc-400 ml-[26px] border-l border-zinc-800 pl-4 font-mono leading-relaxed">
                    <div className="prose prose-xs prose-invert max-w-none [&_p]:my-1 [&_strong]:text-zinc-300">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                            components={{
                                pre: ({ ...props }) => <div className="not-prose" {...props} />, // Prevent double styling for pre
                                code: ({ inline, className, children, ...props }: any) => {
                                    return (
                                        <code
                                            className={cn("bg-zinc-800/50 rounded px-1 py-0.5", className)}
                                            {...props}
                                        >
                                            {children}
                                        </code>
                                    );
                                },
                            }}
                        >
                            {children || ''}
                        </ReactMarkdown>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
