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
            className={cn("w-full border border-slate-300 rounded-lg bg-slate-100 my-2", className)}
        >
            <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 p-3 w-full text-left hover:bg-slate-200 transition-colors focus:outline-none rounded-lg group">
                    <Brain className="h-4 w-4 text-slate-600 group-hover:text-slate-700 transition-colors" />
                    <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 flex-1 transition-colors">
                        {isStreaming ? `Thinking (${duration}s)...` : `Thought for ${duration} seconds`}
                    </span>
                    <ChevronDown
                        className={cn(
                            "h-3 w-3 text-slate-600 transition-transform duration-200",
                            isOpen ? "rotate-180" : ""
                        )}
                    />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="px-3 pb-3 pt-0 text-xs text-slate-800 ml-[26px] border-l border-slate-300 pl-4 font-mono leading-relaxed max-h-[400px] overflow-y-auto">
                    <div className="prose prose-xs max-w-none [&_p]:my-1 [&_strong]:text-slate-900 [&_code]:bg-slate-200 [&_code]:text-slate-900">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                            components={{
                                pre: ({ ...props }) => <div className="not-prose" {...props} />, // Prevent double styling for pre
                                code: ({ inline, className, children, ...props }: any) => {
                                    return (
                                        <code
                                            className={cn("bg-slate-200 rounded px-1 py-0.5 text-slate-900", className)}
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
