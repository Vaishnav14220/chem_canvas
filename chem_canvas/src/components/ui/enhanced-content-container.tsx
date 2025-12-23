"use client"

import React from "react"
import { AnimatedGridPattern } from "./animated-grid-pattern"
import { FlickeringGrid } from "./flickering-grid"
import { BlurFade } from "./blur-fade"
import { cn } from "@/lib/utils"

interface EnhancedContentContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: "grid" | "flickering" | "minimal" | "gradient"
  enableAnimation?: boolean
  enableBlurFade?: boolean
  glowColor?: string
  className?: string
}

/**
 * Enhanced Content Container Component
 * 
 * Wraps content with Magic UI effects including:
 * - Animated grid patterns
 * - Flickering effects
 * - Blur fade animations
 * - Custom glowing effects
 * 
 * Perfect for chat interfaces, canvas areas, and content displays
 */
export const EnhancedContentContainer = React.forwardRef<
  HTMLDivElement,
  EnhancedContentContainerProps
>(
  (
    {
      children,
      variant = "grid",
      enableAnimation = true,
      enableBlurFade = true,
      glowColor = "rgba(59, 130, 246, 0.15)",
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative w-full h-full overflow-hidden bg-slate-900",
          className
        )}
        {...props}
      >
        {/* Background Effects Layer */}
        {enableAnimation && (
          <>
            {variant === "grid" && (
              <>
                {/* Animated grid pattern */}
                <div className="absolute inset-0 pointer-events-none opacity-40">
                  <AnimatedGridPattern
                    width={40}
                    height={40}
                    numSquares={30}
                    maxOpacity={0.3}
                    duration={3}
                    className="text-slate-600"
                  />
                </div>

                {/* Glow effect */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-50"
                  style={{
                    background: `radial-gradient(circle at 20% 30%, ${glowColor}, transparent 60%),
                                radial-gradient(circle at 80% 70%, ${glowColor}, transparent 60%)`,
                  }}
                />
              </>
            )}

            {variant === "flickering" && (
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <FlickeringGrid
                  squareSize={6}
                  gridGap={3}
                  flickerChance={0.2}
                  color="rgba(100, 116, 139, 0.5)"
                  maxOpacity={0.25}
                />
              </div>
            )}

            {variant === "gradient" && (
              <div className="absolute inset-0 pointer-events-none opacity-40">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-400/20 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-indigo-400/20 rounded-full blur-3xl" />
              </div>
            )}

            {variant === "minimal" && (
              <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute inset-0 bg-gradient-to-b from-slate-700/20 to-transparent" />
              </div>
            )}
          </>
        )}

        {/* Content with optional blur fade */}
        {enableBlurFade ? (
          <BlurFade
            duration={0.5}
            delay={0.1}
            inView={false}
            className="relative z-10 w-full h-full"
          >
            {children}
          </BlurFade>
        ) : (
          <div className="relative z-10 w-full h-full">{children}</div>
        )}
      </div>
    )
  }
)

EnhancedContentContainer.displayName = "EnhancedContentContainer"
