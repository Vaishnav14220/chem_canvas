"use client";

import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface ContextProps {
    tokens?: number;
    maxTokens?: number;
    cost?: number;
    className?: string;
    isStreaming?: boolean;
}

export function Context({
    tokens = 0,
    maxTokens = 1000000,
    cost,
    className,
    isStreaming = false
}: ContextProps) {
    const percentUsed = Math.min((tokens / maxTokens) * 100, 100);

    return (
        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
            <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className={cn("h-full bg-primary/50 transition-all duration-500", isStreaming && "animate-pulse")}
                        style={{ width: `${percentUsed}%` }}
                    />
                </div>
                <span>{tokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens</span>
            </div>
            {cost !== undefined && (
                <>
                    <span className="text-border">|</span>
                    <span>${cost.toFixed(4)}</span>
                </>
            )}
        </div>
    );
}
