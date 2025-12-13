import React, { useEffect, useCallback, useState } from 'react';
import { Dock, DockIcon } from './ui/dock';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  PenTool, 
  Eraser, 
  Move, 
  RotateCw, 
  MousePointer2,
  Hand,
  Type,
  Square,
  Circle,
  Minus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';

export type DrawingTool = 
  | 'select' 
  | 'pen' 
  | 'eraser' 
  | 'move' 
  | 'rotate' 
  | 'pan'
  | 'textbox'
  | 'square'
  | 'circle'
  | 'minus';

interface DrawingToolsDockProps {
  currentTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  className?: string;
  position?: 'bottom' | 'left' | 'right' | 'bottom-right';
  enableKeyboardShortcuts?: boolean;
  forceCollapsed?: boolean;
}

const tools: { id: DrawingTool; icon: React.ElementType; label: string; shortcut?: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'pen', icon: PenTool, label: 'Pen', shortcut: 'P' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
  { id: 'move', icon: Move, label: 'Move', shortcut: 'M' },
  { id: 'rotate', icon: RotateCw, label: 'Rotate', shortcut: 'R' },
  { id: 'pan', icon: Hand, label: 'Pan', shortcut: 'H' },
];

const shapeTools: { id: DrawingTool; icon: React.ElementType; label: string; shortcut?: string }[] = [
  { id: 'textbox', icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'square', icon: Square, label: 'Rectangle', shortcut: 'U' },
  { id: 'circle', icon: Circle, label: 'Circle', shortcut: 'O' },
  { id: 'minus', icon: Minus, label: 'Line', shortcut: 'L' },
];

// Map keyboard shortcuts to tools
const shortcutMap: Record<string, DrawingTool> = {
  'v': 'select',
  'p': 'pen',
  'e': 'eraser',
  'm': 'move',
  'r': 'rotate',
  'h': 'pan',
  't': 'textbox',
  'u': 'square',
  'o': 'circle',
  'l': 'minus',
};

export default function DrawingToolsDock({ 
  currentTool, 
  onToolChange, 
  className,
  position = 'bottom',
  enableKeyboardShortcuts = true,
  forceCollapsed = false
}: DrawingToolsDockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-collapse/expand based on forceCollapsed prop
  useEffect(() => {
    setIsCollapsed(forceCollapsed);
  }, [forceCollapsed]);

  // Keyboard shortcut handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger shortcuts if typing in an input
    if (e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    
    const key = e.key.toLowerCase();
    const tool = shortcutMap[key];
    if (tool) {
      e.preventDefault();
      onToolChange(tool);
    }
  }, [onToolChange]);

  useEffect(() => {
    if (enableKeyboardShortcuts) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enableKeyboardShortcuts, handleKeyDown]);

  const positionClasses = {
    bottom: 'bottom-6 left-1/2 -translate-x-1/2',
    left: 'left-6 top-1/2 -translate-y-1/2 flex-col',
    right: 'right-6 top-1/2 -translate-y-1/2 flex-col',
    'bottom-right': 'bottom-6 right-6'
  };

  const isVertical = position === 'left' || position === 'right';
  
  // Determine chevron icon based on position
  const ChevronIcon = isVertical 
    ? (position === 'left' ? ChevronRight : ChevronLeft)
    : (position === 'bottom' ? ChevronUp : ChevronDown);

  return (
    <div className={cn(
      'fixed z-50 flex items-center gap-2',
      positionClasses[position],
      className
    )}>
      {/* Collapse/Expand Button */}
      <motion.button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "flex items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300",
          "bg-gradient-to-b from-[#1C2025] via-[#22262B] to-[#1C2025]",
          "border-cyan-500/30 shadow-lg shadow-cyan-500/10",
          "hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/20",
          "text-cyan-400 hover:text-cyan-300",
          isVertical ? "h-10 w-10" : "h-10 w-10"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isCollapsed ? "Expand tools" : "Collapse tools"}
      >
        <motion.div
          animate={{ rotate: isCollapsed ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <ChevronIcon className="w-5 h-5" />
        </motion.div>
      </motion.button>

      {/* Dock with Tools */}
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: isVertical ? (position === 'left' ? -20 : 20) : 0, y: !isVertical ? (position === 'bottom' ? 20 : -20) : 0 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: isVertical ? (position === 'left' ? -20 : 20) : 0, y: !isVertical ? (position === 'bottom' ? 20 : -20) : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Dock 
              iconSize={36} 
              iconMagnification={36} 
              iconDistance={100}
              disableMagnification={true}
              className={cn(
                "bg-gradient-to-b from-[#1C2025]/95 via-[#22262B]/95 to-[#1C2025]/95",
                "border border-cyan-500/20 shadow-2xl shadow-black/50",
                "backdrop-blur-xl",
                isVertical && "flex-col h-auto w-[58px] !w-[58px]"
              )}
            >
              {/* Main Drawing Tools */}
              {tools.map((tool) => (
                <DockIcon
                  key={tool.id}
                  onClick={() => onToolChange(tool.id)}
                  className={cn(
                    "transition-all duration-200 relative group",
                    currentTool === tool.id 
                      ? "bg-gradient-to-br from-cyan-500/40 to-blue-500/30 text-cyan-300 ring-2 ring-cyan-500/60 shadow-lg shadow-cyan-500/20" 
                      : "text-slate-400 hover:text-cyan-300 hover:bg-slate-700/60"
                  )}
                >
                  <tool.icon 
                    className={cn(
                      "w-5 h-5 transition-transform duration-200 relative z-10",
                      currentTool === tool.id && "scale-110"
                    )} 
                  />
                  <span className="sr-only">{tool.label}</span>
                  {/* Tooltip */}
                  <div className={cn(
                    "absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none",
                    "bg-gradient-to-b from-slate-800 to-slate-900 text-white text-xs px-2 py-1 rounded-md",
                    "border border-slate-600/50 shadow-lg whitespace-nowrap z-50",
                    isVertical 
                      ? (position === 'left' ? "left-full ml-2 top-1/2 -translate-y-1/2" : "right-full mr-2 top-1/2 -translate-y-1/2")
                      : (position === 'bottom' ? "bottom-full mb-2 left-1/2 -translate-x-1/2" : "top-full mt-2 left-1/2 -translate-x-1/2")
                  )}>
                    {tool.label}
                    {tool.shortcut && (
                      <span className="ml-1.5 text-slate-400">({tool.shortcut})</span>
                    )}
                  </div>
                </DockIcon>
              ))}

              {/* Divider */}
              <div className={cn(
                "bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent",
                isVertical ? "h-px w-8 my-1" : "w-px h-8 mx-1"
              )} />

              {/* Shape Tools */}
              {shapeTools.map((tool) => (
                <DockIcon
                  key={tool.id}
                  onClick={() => onToolChange(tool.id)}
                  className={cn(
                    "transition-all duration-200 relative group",
                    currentTool === tool.id 
                      ? "bg-gradient-to-br from-purple-500/40 to-pink-500/30 text-purple-300 ring-2 ring-purple-500/60 shadow-lg shadow-purple-500/20" 
                      : "text-slate-400 hover:text-purple-300 hover:bg-slate-700/60"
                  )}
                >
                  <tool.icon 
                    className={cn(
                      "w-5 h-5 transition-transform duration-200 relative z-10",
                      currentTool === tool.id && "scale-110"
                    )} 
                  />
                  <span className="sr-only">{tool.label}</span>
                  {/* Tooltip */}
                  <div className={cn(
                    "absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none",
                    "bg-gradient-to-b from-slate-800 to-slate-900 text-white text-xs px-2 py-1 rounded-md",
                    "border border-slate-600/50 shadow-lg whitespace-nowrap z-50",
                    isVertical 
                      ? (position === 'left' ? "left-full ml-2 top-1/2 -translate-y-1/2" : "right-full mr-2 top-1/2 -translate-y-1/2")
                      : (position === 'bottom' ? "bottom-full mb-2 left-1/2 -translate-x-1/2" : "top-full mt-2 left-1/2 -translate-x-1/2")
                  )}>
                    {tool.label}
                    {tool.shortcut && (
                      <span className="ml-1.5 text-slate-400">({tool.shortcut})</span>
                    )}
                  </div>
                </DockIcon>
              ))}
            </Dock>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip showing current tool - only show when expanded */}
      {!isCollapsed && (
        <motion.div 
          key={currentTool}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "absolute text-xs bg-gradient-to-b from-slate-800/95 to-slate-900/95 text-slate-300 px-3 py-1.5 rounded-lg",
            "border border-cyan-500/30 shadow-xl backdrop-blur-md whitespace-nowrap",
            "font-medium",
            position === 'bottom' && "bottom-full mb-2 left-1/2 -translate-x-1/2",
            position === 'left' && "left-full ml-2 top-1/2 -translate-y-1/2",
            position === 'right' && "right-full mr-2 top-1/2 -translate-y-1/2"
          )}
        >
          {(() => {
            const tool = tools.find(t => t.id === currentTool) || shapeTools.find(t => t.id === currentTool);
            return (
              <>
                <span className="text-cyan-300">
                  {tool?.label || 'Select Tool'}
                </span>
                {tool?.shortcut && (
                  <span className="ml-2 text-slate-400">
                    ({tool.shortcut})
                  </span>
                )}
              </>
            );
          })()}
        </motion.div>
      )}
    </div>
  );
}

// Compact version for smaller screens or embedded use
export function DrawingToolsDockCompact({ 
  currentTool, 
  onToolChange, 
  className 
}: Omit<DrawingToolsDockProps, 'position'>) {
  const mainTools = tools.slice(0, 4); // Only show first 4 tools

  return (
    <div className={cn("flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-700/50", className)}>
      {mainTools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          className={cn(
            "p-2 rounded-lg transition-all duration-200",
            currentTool === tool.id 
              ? "bg-cyan-500/30 text-cyan-400" 
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          )}
          title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
        >
          <tool.icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
