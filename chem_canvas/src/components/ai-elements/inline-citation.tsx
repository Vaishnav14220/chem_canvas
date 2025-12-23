"use client";

import { cn } from "@/lib/utils";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger
} from "../ui/hover-card";

interface InlineCitationProps {
    children?: React.ReactNode;
    title: string;
    url?: string;
    description?: string;
    sourceId?: number;
    className?: string;
}

export function InlineCitation({
    children,
    title,
    url,
    description,
    sourceId,
    className,
}: InlineCitationProps) {
    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <a
                    href={url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                        "inline-flex items-center justify-center -translate-y-1 mx-0.5 min-w-[16px] h-4 px-1 rounded-sm bg-zinc-800 text-[10px] font-medium text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 no-underline cursor-help transition-all",
                        className
                    )}
                >
                    {sourceId || children || "ref"}
                </a>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 p-3 bg-zinc-950 border-zinc-800">
                <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-semibold leading-none text-zinc-100">{title}</h4>
                    {url && (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline break-all"
                        >
                            {url}
                        </a>
                    )}
                    {description && (
                        <p className="text-xs text-zinc-400 mt-1">
                            {description}
                        </p>
                    )}
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}
