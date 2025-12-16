"use client";

import { ChevronDown, Brain } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { cn } from "../../lib/utils";

interface ChainOfThoughtProps {
    children?: React.ReactNode;
    isStreaming?: boolean;
    className?: string;
    defaultOpen?: boolean;
}

export function ChainOfThought({
    children,
    isStreaming = false,
    className,
    defaultOpen = false,
}: ChainOfThoughtProps) {
    // If streaming, default to open to show thoughts as they appear
    const [isOpen, setIsOpen] = useState(defaultOpen || isStreaming);

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className={cn("w-full border rounded-md bg-muted/30 my-2", className)}
        >
            <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 p-3 w-full text-left hover:bg-muted/50 transition-colors focus:outline-none">
                    <Brain className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground flex-1">
                        {isStreaming ? "Thinking..." : "Reasoning Process"}
                    </span>
                    <ChevronDown
                        className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform duration-200",
                            isOpen ? "rotate-180" : ""
                        )}
                    />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="p-3 pt-0 text-sm text-muted-foreground/90 border-t border-border/50 bg-background/50 rounded-b-md whitespace-pre-wrap font-mono text-xs">
                    {children}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
