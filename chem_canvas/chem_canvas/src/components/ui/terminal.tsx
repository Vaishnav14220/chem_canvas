"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TerminalProps {
  children: React.ReactNode;
  className?: string;
}

export function Terminal({ children, className }: TerminalProps) {
  return (
    <div
      className={cn(
        "z-0 w-full rounded-xl border border-slate-700 bg-slate-950 overflow-hidden shadow-2xl",
        className
      )}
    >
      {/* Terminal Header */}
      <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-4 py-2">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <div className="h-3 w-3 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-slate-400 ml-2">gemini-learning</span>
      </div>
      {/* Terminal Content */}
      <div className="p-4 font-mono text-sm min-h-[300px] max-h-[400px] overflow-y-auto">
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );
}

interface AnimatedSpanProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedSpan({ children, className, delay = 0 }: AnimatedSpanProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "animate-fadeIn",
        className
      )}
      style={{
        animation: "fadeIn 0.3s ease-out forwards",
      }}
    >
      {children}
    </div>
  );
}

interface TypingAnimationProps {
  children: string;
  className?: string;
  duration?: number;
  delay?: number;
}

export function TypingAnimation({
  children,
  className,
  duration = 30,
  delay = 0,
}: TypingAnimationProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setIsStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!isStarted) return;

    let currentIndex = 0;
    const text = children;

    const interval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayedText(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
      }
    }, duration);

    return () => clearInterval(interval);
  }, [isStarted, children, duration]);

  if (!isStarted) return null;

  return (
    <span className={cn("text-slate-300", className)}>
      {displayedText}
      {!isComplete && (
        <span className="inline-block w-2 h-4 bg-green-400 ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

// Progress Terminal - specialized for showing processing progress
interface ProgressTerminalProps {
  stages: {
    id: string;
    label: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    subSteps?: string[];
  }[];
  className?: string;
  title?: string;
}

export function ProgressTerminal({
  stages,
  className,
  title = "Processing Document",
}: ProgressTerminalProps) {
  return (
    <div
      className={cn(
        "w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-950 overflow-hidden shadow-2xl",
        className
      )}
    >
      {/* Terminal Header */}
      <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors cursor-pointer" />
          <div className="h-3 w-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors cursor-pointer" />
          <div className="h-3 w-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors cursor-pointer" />
        </div>
        <span className="text-sm text-slate-300 ml-3 font-medium">{title}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-slate-400">Running</span>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="p-4 font-mono text-sm space-y-2 max-h-[350px] overflow-y-auto">
        {/* Command prompt */}
        <div className="flex items-center gap-2 text-slate-400 mb-3">
          <span className="text-green-400">➜</span>
          <span className="text-cyan-400">~/immersive-learning</span>
          <span className="text-slate-500">$</span>
          <span className="text-slate-300">process document.pdf</span>
        </div>

        {/* Stages */}
        {stages.map((stage, idx) => (
          <div key={stage.id} className="space-y-1">
            <div className="flex items-center gap-2">
              {stage.status === 'pending' && (
                <span className="text-slate-500">○</span>
              )}
              {stage.status === 'running' && (
                <span className="text-yellow-400 animate-spin">◐</span>
              )}
              {stage.status === 'completed' && (
                <span className="text-green-400">✔</span>
              )}
              {stage.status === 'error' && (
                <span className="text-red-400">✖</span>
              )}
              <span
                className={cn(
                  "transition-colors duration-300",
                  stage.status === 'pending' && "text-slate-500",
                  stage.status === 'running' && "text-yellow-300",
                  stage.status === 'completed' && "text-green-300",
                  stage.status === 'error' && "text-red-300"
                )}
              >
                {stage.label}
              </span>
              {stage.status === 'running' && (
                <span className="text-slate-500 animate-pulse">...</span>
              )}
            </div>

            {/* Sub-steps for running stage */}
            {stage.status === 'running' && stage.subSteps && (
              <div className="ml-6 space-y-1 border-l border-slate-700 pl-3">
                {stage.subSteps.map((step, stepIdx) => (
                  <div
                    key={stepIdx}
                    className="text-xs text-slate-400 animate-fade-in flex items-center gap-2"
                    style={{ animationDelay: `${stepIdx * 100}ms` }}
                  >
                    <span className="text-cyan-500">→</span>
                    {step}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Progress bar */}
        {stages.some(s => s.status === 'running' || s.status === 'pending') && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Progress</span>
              <span>
                {stages.filter(s => s.status === 'completed').length}/{stages.length} stages
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${(stages.filter(s => s.status === 'completed').length / stages.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Completion message */}
        {stages.every(s => s.status === 'completed') && (
          <div className="mt-4 pt-3 border-t border-slate-800 animate-fade-in">
            <div className="flex items-center gap-2 text-green-400">
              <span>✨</span>
              <span className="font-medium">All stages completed successfully!</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 ml-6">
              Your immersive learning experience is ready.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Terminal;
