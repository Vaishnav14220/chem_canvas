'use client';

import React, { useRef, useEffect, useState, useCallback } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  PhoneOff, 
  Loader2, 
  Activity, 
  Monitor,
  MonitorOff,
  Sparkles,
  Image as ImageIcon,
  Send,
  X,
  PenTool
} from "lucide-react";
import { getQuickAnswer } from "@/services/quickAnswerService";

// =============================================================================
// Dock Base Components (Magic UI style)
// =============================================================================

const DEFAULT_SIZE = 48;
const DEFAULT_MAGNIFICATION = 64;
const DEFAULT_DISTANCE = 140;

const dockVariants = cva(
  "mx-auto flex h-[68px] w-max items-center justify-center gap-2 rounded-2xl border p-2 backdrop-blur-xl bg-background/80 border-border/50 shadow-2xl"
);

interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string;
  iconSize?: number;
  iconMagnification?: number;
  iconDistance?: number;
  children: React.ReactNode;
}

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      iconSize = DEFAULT_SIZE,
      iconMagnification = DEFAULT_MAGNIFICATION,
      iconDistance = DEFAULT_DISTANCE,
      ...props
    },
    ref
  ) => {
    const mouseX = useMotionValue(Infinity);

    const renderChildren = () => {
      return React.Children.map(children, (child) => {
        if (React.isValidElement<DockIconProps>(child) && child.type === DockIcon) {
          return React.cloneElement(child, {
            ...child.props,
            mouseX: mouseX,
            size: iconSize,
            magnification: iconMagnification,
            distance: iconDistance,
          });
        }
        return child;
      });
    };

    return (
      <motion.div
        ref={ref}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className={cn(dockVariants({ className }))}
        {...props}
      >
        {renderChildren()}
      </motion.div>
    );
  }
);

Dock.displayName = "Dock";

interface DockIconProps {
  size?: number;
  magnification?: number;
  distance?: number;
  mouseX?: MotionValue<number>;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  badge?: boolean;
  badgeColor?: string;
}

const DockIcon = ({
  size = DEFAULT_SIZE,
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  mouseX,
  className,
  children,
  onClick,
  title,
  active,
  badge,
  badgeColor = "bg-emerald-500",
  ...props
}: DockIconProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const defaultMouseX = useMotionValue(Infinity);

  const distanceCalc = useTransform(mouseX ?? defaultMouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const sizeTransform = useTransform(
    distanceCalc,
    [-distance, 0, distance],
    [size, magnification, size]
  );

  const scaleSize = useSpring(sizeTransform, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  });

  return (
    <motion.div
      ref={ref}
      style={{ width: scaleSize, height: scaleSize }}
      className={cn(
        "relative flex aspect-square cursor-pointer items-center justify-center rounded-full transition-colors",
        active && "ring-2 ring-cyan-500/50",
        className
      )}
      onClick={onClick}
      title={title}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {children}
      {badge && (
        <span className={cn(
          "absolute -right-0.5 -top-0.5 flex h-3 w-3",
        )}>
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", badgeColor)} />
          <span className={cn("relative inline-flex h-3 w-3 rounded-full", badgeColor)} />
        </span>
      )}
    </motion.div>
  );
};

DockIcon.displayName = "DockIcon";

// =============================================================================
// Dock Separator
// =============================================================================

const DockSeparator = () => (
  <div className="mx-1 h-10 w-px bg-border/50" />
);

// =============================================================================
// Unified Dock Component
// =============================================================================

export interface Character {
  id?: string | number;
  emoji: string;
  name: string;
  online: boolean;
  backgroundColor?: string;
}

interface UnifiedDockProps {
  // Character/Messaging props
  characters?: Character[];
  onCharacterSelect?: (character: Character, index: number) => void;
  onMessageSend?: (message: string, character: Character) => void;
  
  // Write answer directly to canvas
  onWriteToCanvas?: (text: string) => void;
  
  // Callback when Gemini Live mic connects - use to open canvas
  onLiveConnect?: () => void;
  
  // Gemini Live props
  isConnected?: boolean;
  isConnecting?: boolean;
  isListening?: boolean;
  isSpeaking?: boolean;
  isScreenSharing?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  onShareCanvas?: () => void;
  showShareCanvas?: boolean;
  
  // Audio visualizer
  analyser?: AnalyserNode | null;
  
  className?: string;
}

const defaultCharacters: Character[] = [
  {
    emoji: "🧙‍♂️",
    name: "Wizard",
    online: true,
    backgroundColor: "bg-emerald-500/20",
  },
];

export function UnifiedDock({
  characters = defaultCharacters,
  onCharacterSelect,
  onMessageSend,
  onWriteToCanvas,
  onLiveConnect,
  isConnected = false,
  isConnecting = false,
  isListening = false,
  isSpeaking = false,
  isScreenSharing = false,
  onConnect,
  onDisconnect,
  onStartScreenShare,
  onStopScreenShare,
  onShareCanvas,
  showShareCanvas = true,
  analyser,
  className,
}: UnifiedDockProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  
  // Loading state for getting answer
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);

  // Audio visualizer effect
  useEffect(() => {
    if (!analyser || !canvasRef.current || !isConnected) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw circular visualizer
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = 16;
      const bars = 24;

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const barIndex = Math.floor((i / bars) * bufferLength);
        const barHeight = (dataArray[barIndex] / 255) * 12;

        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isSpeaking ? '#22d3ee' : isListening ? '#f472b6' : '#6ee7b7';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isConnected, isListening, isSpeaking]);

  const handleCharacterClick = (index: number) => {
    const character = characters[index];
    if (selectedCharacter === index) {
      setSelectedCharacter(null);
      setIsExpanded(false);
    } else {
      setSelectedCharacter(index);
      setIsExpanded(true);
      onCharacterSelect?.(character, index);
    }
  };

  // Handle sending message and writing answer directly to canvas
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || selectedCharacter === null) return;
    
    const question = messageInput.trim();
    const character = characters[selectedCharacter];
    
    // Notify parent if callback exists
    onMessageSend?.(question, character);
    
    // Clear input and close popup
    setMessageInput("");
    setSelectedCharacter(null);
    setIsExpanded(false);
    
    // Show loading state
    setIsLoadingAnswer(true);
    
    try {
      // Get answer from Gemini 2.5 Flash
      const answer = await getQuickAnswer(question);
      
      // Write answer directly to canvas (smart placement)
      if (onWriteToCanvas) {
        onWriteToCanvas(answer);
      }
    } catch (error) {
      console.error('Error getting answer:', error);
      // Write error message to canvas
      if (onWriteToCanvas) {
        onWriteToCanvas("Sorry, I couldn't get an answer. Please try again.");
      }
    } finally {
      setIsLoadingAnswer(false);
    }
  }, [messageInput, selectedCharacter, characters, onMessageSend, onWriteToCanvas]);

  const handleConnectionToggle = () => {
    if (isConnected || isConnecting) {
      onDisconnect?.();
    } else {
      onConnect?.();
      // Trigger callback to open canvas when mic connects
      onLiveConnect?.();
    }
  };

  return (
    <div className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50", className)}>
      <AnimatePresence>
        {isExpanded && selectedCharacter !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80"
          >
            <div className="bg-background/95 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{characters[selectedCharacter].emoji}</span>
                <span className="font-medium text-sm">{characters[selectedCharacter].name}</span>
                <div className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">
                  <PenTool className="w-3 h-3" />
                  <span className="text-[10px]">Handwritten</span>
                </div>
                <button 
                  onClick={() => { setSelectedCharacter(null); setIsExpanded(false); }}
                  className="ml-auto p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Ask a question...`}
                  className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm border-none outline-none focus:ring-2 focus:ring-cyan-500/30"
                  autoFocus
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-2 rounded-lg bg-cyan-500/20 text-cyan-500 hover:bg-cyan-500/30 disabled:opacity-50 transition-colors"
                  title="Get handwritten answer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Answer will be written on canvas ✍️</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dock iconSize={48} iconMagnification={64} iconDistance={140}>
        {/* Gemini Live Connection Button */}
        <DockIcon
          onClick={handleConnectionToggle}
          title={isConnected ? 'Disconnect Gemini Live' : 'Connect Gemini Live'}
          active={isConnected}
          badge={isConnected}
          badgeColor="bg-emerald-500"
          className={cn(
            "relative",
            isConnected ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800/80 text-slate-400 hover:bg-slate-700/80"
          )}
        >
          {isConnecting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : isConnected ? (
            <div className="relative">
              {analyser ? (
                <canvas ref={canvasRef} width={48} height={48} className="absolute inset-0" />
              ) : null}
              <Activity className={cn("w-6 h-6 relative z-10", isSpeaking && "animate-pulse text-emerald-400")} />
            </div>
          ) : (
            <Sparkles className="w-6 h-6" />
          )}
        </DockIcon>

        {/* Screen Share Button - Always visible */}
        <DockIcon
          onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
          title={isScreenSharing ? 'Stop Screen Share' : 'Start Screen Share'}
          active={isScreenSharing}
          className={cn(
            isScreenSharing 
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" 
              : "bg-slate-800/80 text-slate-400 hover:bg-slate-700/80"
          )}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-5 h-5" />
          ) : (
            <Monitor className="w-5 h-5" />
          )}
        </DockIcon>

        {/* Share Canvas Button (only when connected) */}
        {isConnected && showShareCanvas && (
          <DockIcon
            onClick={onShareCanvas}
            title="Share Canvas"
            className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
          >
            <ImageIcon className="w-5 h-5" />
          </DockIcon>
        )}

        {/* Disconnect Button (only when connected) */}
        {isConnected && (
          <DockIcon
            onClick={onDisconnect}
            title="Disconnect"
            className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
          >
            <PhoneOff className="w-5 h-5" />
          </DockIcon>
        )}

        <DockSeparator />

        {/* Character Avatars */}
        {characters.map((character, index) => (
          <DockIcon
            key={character.name}
            onClick={() => handleCharacterClick(index)}
            title={`Message ${character.name}`}
            active={selectedCharacter === index}
            badge={character.online}
            badgeColor="bg-emerald-500"
            className={cn(
              character.backgroundColor || "bg-slate-800/80",
              "hover:scale-110 transition-transform"
            )}
          >
            <span className="text-2xl">{character.emoji}</span>
          </DockIcon>
        ))}
      </Dock>

      {/* Loading indicator when getting answer */}
      {isLoadingAnswer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2"
        >
          <div className="bg-background/95 backdrop-blur-xl rounded-xl border border-border/50 shadow-2xl px-4 py-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span className="text-sm text-slate-300">Writing answer on canvas...</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export { Dock, DockIcon, DockSeparator, dockVariants };
