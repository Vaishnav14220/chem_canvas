import React, { useEffect, useCallback } from 'react';
import { Dock, DockIcon } from './ui/dock';
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
  Minus
} from 'lucide-react';
import { cn } from '../lib/utils';

export type DrawingTool = 
  | 'select' 
  | 'pen' 
  | 'eraser' 
  | 'move' 
  | 'rotate' 
  | 'pan'
  | 'text'
  | 'rectangle'
  | 'circle'
  | 'line';

interface DrawingToolsDockProps {
  currentTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  className?: string;
  position?: 'bottom' | 'left' | 'right' | 'bottom-right';
  enableKeyboardShortcuts?: boolean;
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
  { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'rectangle', icon: Square, label: 'Rectangle', shortcut: 'U' },
  { id: 'circle', icon: Circle, label: 'Circle', shortcut: 'O' },
  { id: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
];

// Map keyboard shortcuts to tools
const shortcutMap: Record<string, DrawingTool> = {
  'v': 'select',
  'p': 'pen',
  'e': 'eraser',
  'm': 'move',
  'r': 'rotate',
  'h': 'pan',
  't': 'text',
  'u': 'rectangle',
  'o': 'circle',
  'l': 'line',
};

export default function DrawingToolsDock({ 
  currentTool, 
  onToolChange, 
  className,
  position = 'bottom',
  enableKeyboardShortcuts = true
}: DrawingToolsDockProps) {
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

  return (
    <div className={cn(
      'fixed z-50',
      positionClasses[position],
      className
    )}>
      <Dock 
        iconSize={36} 
        iconMagnification={52} 
        iconDistance={100}
        className={cn(
          "bg-slate-900/90 border-slate-700/50 shadow-2xl shadow-black/50",
          isVertical && "flex-col h-auto w-[58px]"
        )}
      >
        {/* Main Drawing Tools */}
        {tools.map((tool) => (
          <DockIcon
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={cn(
              "transition-all duration-200",
              currentTool === tool.id 
                ? "bg-cyan-500/30 text-cyan-400 ring-2 ring-cyan-500/50" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            )}
          >
            <tool.icon 
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                currentTool === tool.id && "scale-110"
              )} 
            />
            <span className="sr-only">{tool.label}</span>
          </DockIcon>
        ))}

        {/* Divider */}
        <div className={cn(
          "bg-slate-600/50",
          isVertical ? "h-px w-8 my-1" : "w-px h-8 mx-1"
        )} />

        {/* Shape Tools */}
        {shapeTools.map((tool) => (
          <DockIcon
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={cn(
              "transition-all duration-200",
              currentTool === tool.id 
                ? "bg-purple-500/30 text-purple-400 ring-2 ring-purple-500/50" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            )}
          >
            <tool.icon 
              className={cn(
                "w-5 h-5 transition-transform duration-200",
                currentTool === tool.id && "scale-110"
              )} 
            />
            <span className="sr-only">{tool.label}</span>
          </DockIcon>
        ))}
      </Dock>

      {/* Tooltip showing current tool */}
      <div className={cn(
        "absolute text-xs text-slate-400 bg-slate-800/90 px-2 py-1 rounded-md border border-slate-700/50 whitespace-nowrap",
        position === 'bottom' && "bottom-full mb-2 left-1/2 -translate-x-1/2",
        position === 'left' && "left-full ml-2 top-1/2 -translate-y-1/2",
        position === 'right' && "right-full mr-2 top-1/2 -translate-y-1/2"
      )}>
        <span className="font-medium text-slate-300">
          {tools.find(t => t.id === currentTool)?.label || 
           shapeTools.find(t => t.id === currentTool)?.label || 
           'Select Tool'}
        </span>
        {(tools.find(t => t.id === currentTool)?.shortcut || 
          shapeTools.find(t => t.id === currentTool)?.shortcut) && (
          <span className="ml-2 text-slate-500">
            ({tools.find(t => t.id === currentTool)?.shortcut || 
              shapeTools.find(t => t.id === currentTool)?.shortcut})
          </span>
        )}
      </div>
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
