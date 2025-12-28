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

// Animated Glucose (C6H12O6) Pyranose Ring Icon Component - Prominent and Complex
const MethaneIcon: React.FC<{ className?: string }> = ({ className }) => {
  const centerX = 12;
  const centerY = 12;
  const ringRadius = 5.5;
  
  // Glucose pyranose ring: 5 carbons + 1 oxygen in a 6-membered ring
  // Positions for ring atoms (chair conformation simplified to 2D)
  const ringAtoms = [
    { angle: 90, type: 'C', label: 'C1' },   // Top
    { angle: 30, type: 'C', label: 'C2' },   // Top-right
    { angle: -30, type: 'C', label: 'C3' },  // Bottom-right
    { angle: -90, type: 'C', label: 'C4' },  // Bottom
    { angle: -150, type: 'C', label: 'C5' }, // Bottom-left
    { angle: 150, type: 'O', label: 'O' }    // Top-left (oxygen)
  ];
  
  // Hydroxyl groups and substituents attached to each carbon
  const substituents = [
    { carbonIdx: 0, angle: 90, offset: 2.5, type: 'OH' },   // C1 - OH up
    { carbonIdx: 1, angle: 30, offset: 2.5, type: 'OH' },   // C2 - OH up
    { carbonIdx: 2, angle: -30, offset: 2.5, type: 'OH' },  // C3 - OH down
    { carbonIdx: 3, angle: -90, offset: 2.5, type: 'OH' },  // C4 - OH down
    { carbonIdx: 4, angle: -150, offset: 2.5, type: 'CH2OH' }, // C5 - CH2OH
  ];
  
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g style={{ transformOrigin: "12px 12px" }}>
        {/* Rotating glucose molecule */}
        <motion.g
          animate={{ rotate: [0, 360] }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          {/* Ring bonds */}
          {ringAtoms.map((atom, i) => {
            const nextAtom = ringAtoms[(i + 1) % 6];
            const angle1 = (atom.angle * Math.PI) / 180;
            const angle2 = (nextAtom.angle * Math.PI) / 180;
            const x1 = centerX + ringRadius * Math.cos(angle1);
            const y1 = centerY - ringRadius * Math.sin(angle1);
            const x2 = centerX + ringRadius * Math.cos(angle2);
            const y2 = centerY - ringRadius * Math.sin(angle2);
            
            return (
              <motion.line
                key={`bond-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={{
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut"
                }}
              />
            );
          })}
          
          {/* Ring atoms (Carbons and Oxygen) */}
          {ringAtoms.map((atom, i) => {
            const angle = (atom.angle * Math.PI) / 180;
            const x = centerX + ringRadius * Math.cos(angle);
            const y = centerY - ringRadius * Math.sin(angle);
            const isOxygen = atom.type === 'O';
            
            return (
              <motion.circle
                key={`ring-atom-${i}`}
                cx={x}
                cy={y}
                r={isOxygen ? "2.5" : "2"}
                fill="currentColor"
                stroke={isOxygen ? "currentColor" : "none"}
                strokeWidth={isOxygen ? "1" : "0"}
                opacity={isOxygen ? "0.9" : "1"}
                animate={{
                  scale: [1, isOxygen ? 1.25 : 1.15, 1],
                  opacity: [isOxygen ? 0.8 : 0.9, 1, isOxygen ? 0.8 : 0.9]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: "easeInOut"
                }}
              />
            );
          })}
          
          {/* Substituents (OH groups and CH2OH) */}
          {substituents.map((sub, i) => {
            const carbonAtom = ringAtoms[sub.carbonIdx];
            const carbonAngle = (carbonAtom.angle * Math.PI) / 180;
            const subAngle = (sub.angle * Math.PI) / 180;
            const carbonX = centerX + ringRadius * Math.cos(carbonAngle);
            const carbonY = centerY - ringRadius * Math.sin(carbonAngle);
            const subX = carbonX + sub.offset * Math.cos(subAngle);
            const subY = carbonY - sub.offset * Math.sin(subAngle);
            
            return (
              <g key={`sub-${i}`}>
                {/* Bond from carbon to substituent */}
                <motion.line
                  x1={carbonX}
                  y1={carbonY}
                  x2={subX}
                  y2={subY}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.6"
                  animate={{
                    opacity: [0.5, 0.7, 0.5]
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                />
                
                {/* OH group or CH2OH */}
                {sub.type === 'OH' ? (
                  <>
                    {/* Oxygen */}
                    <motion.circle
                      cx={subX}
                      cy={subY}
                      r="1.8"
                      fill="currentColor"
                      opacity="0.7"
                      animate={{
                        scale: [0.9, 1.1, 0.9],
                        opacity: [0.6, 0.8, 0.6]
                      }}
                      transition={{
                        duration: 1.3,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: "easeInOut"
                      }}
                    />
                    {/* Hydrogen (small dot) */}
                    <motion.circle
                      cx={subX + 1.2}
                      cy={subY}
                      r="0.8"
                      fill="currentColor"
                      opacity="0.5"
                      animate={{
                        scale: [0.7, 1, 0.7]
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: "easeInOut"
                      }}
                    />
                  </>
                ) : (
                  <>
                    {/* CH2OH - Carbon */}
                    <motion.circle
                      cx={subX}
                      cy={subY}
                      r="1.5"
                      fill="currentColor"
                      opacity="0.7"
                      animate={{
                        scale: [0.95, 1.1, 0.95]
                      }}
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        delay: i * 0.15,
                        ease: "easeInOut"
                      }}
                    />
                    {/* OH on CH2OH */}
                    <motion.circle
                      cx={subX + 1.5}
                      cy={subY}
                      r="1.3"
                      fill="currentColor"
                      opacity="0.6"
                      animate={{
                        scale: [0.9, 1.05, 0.9]
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: "easeInOut"
                      }}
                    />
                  </>
                )}
              </g>
            );
          })}
          
          {/* Additional hydrogens on ring carbons */}
          {[0, 1, 2, 3, 4].map((i) => {
            const atom = ringAtoms[i];
            const angle = (atom.angle * Math.PI) / 180;
            // Position hydrogen opposite to OH groups
            const hAngle = angle + Math.PI;
            const atomX = centerX + ringRadius * Math.cos(angle);
            const atomY = centerY - ringRadius * Math.sin(angle);
            const hX = atomX + 2 * Math.cos(hAngle);
            const hY = atomY - 2 * Math.sin(hAngle);
            
            return (
              <motion.circle
                key={`h-${i}`}
                cx={hX}
                cy={hY}
                r="0.9"
                fill="currentColor"
                opacity="0.5"
                animate={{
                  scale: [0.8, 1, 0.8],
                  opacity: [0.4, 0.6, 0.4]
                }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: "easeInOut"
                }}
              />
            );
          })}
        </motion.g>
      </g>
    </svg>
  );
};

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
  layout?: 'floating' | 'inline';
  enableKeyboardShortcuts?: boolean;
  forceCollapsed?: boolean;
  onChemistryToolsClick?: () => void;
  extraControls?: React.ReactNode;
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
  layout = 'floating',
  enableKeyboardShortcuts = true,
  forceCollapsed = false,
  onChemistryToolsClick,
  extraControls
}: DrawingToolsDockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const hasExtras = Boolean(extraControls);

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

  const collapseButtonClasses = cn(
    "flex items-center justify-center border border-cyan-500/30 bg-gradient-to-b from-[#1C2025]/95 via-[#22262B]/95 to-[#1C2025]/95",
    "text-cyan-400 hover:text-cyan-300 transition-all duration-300",
    "hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/20",
    isVertical ? "h-9 w-[52px] rounded-xl" : "h-9 w-9 rounded-full"
  );

  return (
    <div className={cn(
      `${layout === 'floating' ? 'fixed' : 'relative'} z-50 flex items-center gap-2`,
      layout === 'floating' ? positionClasses[position] : (position === 'left' || position === 'right' ? 'flex-col' : ''),
      className
    )}>
      {/* Collapse/Expand Button */}
      <motion.button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={collapseButtonClasses}
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
            <div
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border border-cyan-500/20",
                "bg-gradient-to-b from-[#1C2025]/95 via-[#22262B]/95 to-[#1C2025]/95",
                "shadow-2xl shadow-black/50 backdrop-blur-xl p-2",
                isVertical && "w-[56px]"
              )}
            >
              <Dock 
                iconSize={30} 
                iconMagnification={30} 
                iconDistance={80}
                disableMagnification={true}
                className={cn(
                  hasExtras ? "bg-transparent border-transparent shadow-none" : "bg-gradient-to-b from-[#1C2025]/95 via-[#22262B]/95 to-[#1C2025]/95 border border-cyan-500/20 shadow-2xl shadow-black/50",
                  isVertical && "flex-col h-auto w-[52px] !w-[52px] gap-0.5 p-1"
                )}
              >
                {/* Main Drawing Tools */}
                {tools.map((tool) => (
                  <DockIcon
                    key={tool.id}
                    onClick={() => onToolChange(tool.id)}
                    size={30}
                    className={cn(
                      "transition-all duration-200 relative group !w-[30px] !h-[30px]",
                      currentTool === tool.id 
                        ? "bg-gradient-to-br from-cyan-500/40 to-blue-500/30 text-cyan-300 ring-2 ring-cyan-500/60 shadow-lg shadow-cyan-500/20" 
                        : "text-slate-400 hover:text-cyan-300 hover:bg-slate-700/60"
                    )}
                  >
                    <tool.icon 
                      className="w-5 h-5 transition-all duration-200 relative z-10"
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
                  isVertical ? "h-px w-7 my-0.5" : "w-px h-7 mx-0.5"
                )} />

                {/* Shape Tools */}
                {shapeTools.map((tool) => (
                  <DockIcon
                    key={tool.id}
                    onClick={() => onToolChange(tool.id)}
                    size={30}
                    className={cn(
                      "transition-all duration-200 relative group !w-[30px] !h-[30px]",
                      currentTool === tool.id 
                        ? "bg-gradient-to-br from-purple-500/40 to-pink-500/30 text-purple-300 ring-2 ring-purple-500/60 shadow-lg shadow-purple-500/20" 
                        : "text-slate-400 hover:text-purple-300 hover:bg-slate-700/60"
                    )}
                  >
                    <tool.icon 
                      className="w-5 h-5 transition-all duration-200 relative z-10"
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
                {onChemistryToolsClick && (
                  <>
                <div className={cn(
                  "bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent",
                  isVertical ? "h-px w-7 my-0.5" : "w-px h-7 mx-0.5"
                )} />
                    
                    {/* Chemistry Tools Button */}
                    <DockIcon
                      onClick={onChemistryToolsClick}
                      size={30}
                      className={cn(
                        "transition-all duration-200 relative group !w-[30px] !h-[30px]",
                        "text-slate-400 hover:text-emerald-300 hover:bg-slate-700/60"
                      )}
                    >
                      <MethaneIcon 
                        className="w-5 h-5 transition-all duration-200 relative z-10"
                      />
                      <span className="sr-only">Chemistry Tools</span>
                      {/* Tooltip */}
                      <div className={cn(
                        "absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none",
                        "bg-gradient-to-b from-slate-800 to-slate-900 text-white text-xs px-2 py-1 rounded-md",
                        "border border-slate-600/50 shadow-lg whitespace-nowrap z-50",
                        isVertical 
                          ? (position === 'left' ? "left-full ml-2 top-1/2 -translate-y-1/2" : "right-full mr-2 top-1/2 -translate-y-1/2")
                          : (position === 'bottom' ? "bottom-full mb-2 left-1/2 -translate-x-1/2" : "top-full mt-2 left-1/2 -translate-x-1/2")
                      )}>
                        Chemistry Tools
                      </div>
                    </DockIcon>
                  </>
                )}
              </Dock>

              {extraControls && (
                <div className="w-full border-t border-cyan-500/20 pt-2">
                  {extraControls}
                </div>
              )}
            </div>
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
