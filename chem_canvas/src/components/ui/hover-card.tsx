"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

const HoverCard = ({ children }: { children: React.ReactNode }) => {
    const [open, setOpen] = React.useState(false)
    const timeoutRef = React.useRef<NodeJS.Timeout>()

    const handleMouseEnter = () => {
        clearTimeout(timeoutRef.current)
        setOpen(true)
    }

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setOpen(false), 300)
    }

    return (
        <div className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {React.Children.map(children, child => {
                if (React.isValidElement(child)) {
                    // @ts-ignore
                    return React.cloneElement(child, { open })
                }
                return child
            })}
        </div>
    )
}

const HoverCardTrigger = React.forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, ...props }, ref) => (
    <a
        ref={ref}
        className={cn("cursor-pointer", className)}
        {...props}
    />
))
HoverCardTrigger.displayName = "HoverCardTrigger"

const HoverCardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { align?: "center" | "start" | "end", sideOffset?: number, open?: boolean }
>(({ className, align = "center", sideOffset = 4, open, ...props }, ref) => {
    if (!open) return null
    return (
        <div
            ref={ref}
            className={cn(
                "z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-950 border-slate-800",
                className
            )}
            {...props}
        />
    )
})
HoverCardContent.displayName = "HoverCardContent"

export { HoverCard, HoverCardTrigger, HoverCardContent }
