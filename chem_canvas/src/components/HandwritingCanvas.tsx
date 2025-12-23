'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Vara from 'vara';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HandwritingCanvasProps {
  text: string;
  isVisible: boolean;
  onClose: () => void;
  isLoading?: boolean;
  fontSize?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

// Available Vara.js fonts
const VARA_FONTS = {
  satisfy: 'https://raw.githubusercontent.com/akzhy/Vara/master/fonts/Satisfy/SatisfySL.json',
  pacifico: 'https://raw.githubusercontent.com/akzhy/Vara/master/fonts/Pacifico/PacificoSLO.json',
  shadowsIntoLight: 'https://raw.githubusercontent.com/akzhy/Vara/master/fonts/Shadows-Into-Light/ShadowsIntoLightTwo.json',
  patrickHand: 'https://raw.githubusercontent.com/akzhy/Vara/master/fonts/Patrick-Hand/PatrickHandSC.json',
};

export const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({
  text,
  isVisible,
  onClose,
  isLoading = false,
  fontSize = 28,
  strokeWidth = 1.2,
  color = '#22d3ee',
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const varaRef = useRef<any>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentFont, setCurrentFont] = useState<keyof typeof VARA_FONTS>('satisfy');

  // Split text into lines for better display
  const formatTextForHandwriting = useCallback((inputText: string): string[] => {
    // Split by newlines and filter empty lines
    const lines = inputText.split('\n').filter(line => line.trim());
    
    // Further split long lines (max ~60 chars per line for readability)
    const formattedLines: string[] = [];
    lines.forEach(line => {
      if (line.length > 60) {
        // Split at word boundaries
        const words = line.split(' ');
        let currentLine = '';
        words.forEach(word => {
          if ((currentLine + ' ' + word).length > 60) {
            if (currentLine) formattedLines.push(currentLine.trim());
            currentLine = word;
          } else {
            currentLine += (currentLine ? ' ' : '') + word;
          }
        });
        if (currentLine) formattedLines.push(currentLine.trim());
      } else {
        formattedLines.push(line);
      }
    });
    
    return formattedLines;
  }, []);

  // Initialize Vara.js animation
  const initVara = useCallback(() => {
    if (!containerRef.current || !text || isLoading) return;

    // Clear previous content
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    setIsAnimating(true);

    const lines = formatTextForHandwriting(text);
    
    // Create text objects for Vara
    const textObjects = lines.map((line, index) => ({
      text: line,
      fontSize: fontSize,
      strokeWidth: strokeWidth,
      color: color,
      y: index * (fontSize + 20), // Vertical spacing
      duration: 2000 + (line.length * 30), // Duration based on text length
      textAlign: 'left' as const,
    }));

    try {
      varaRef.current = new Vara(
        '#handwriting-container',
        VARA_FONTS[currentFont],
        textObjects,
        {
          strokeWidth: strokeWidth,
          color: color,
          fontSize: fontSize,
          textAlign: 'left',
        }
      );

      // Listen for animation complete
      varaRef.current.ready(() => {
        setIsAnimating(false);
      });
    } catch (error) {
      console.error('Vara.js initialization error:', error);
      setIsAnimating(false);
    }
  }, [text, isLoading, fontSize, strokeWidth, color, currentFont, formatTextForHandwriting]);

  // Re-initialize when text or visibility changes
  useEffect(() => {
    if (isVisible && text && !isLoading) {
      // Small delay to ensure container is mounted
      const timer = setTimeout(initVara, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, text, isLoading, initVara]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  const handleReplay = () => {
    initVara();
  };

  const handleClear = () => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  };

  const handleFontChange = (font: keyof typeof VARA_FONTS) => {
    setCurrentFont(font);
    setTimeout(initVara, 100);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm",
            className
          )}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: 30 }}
            animate={{ y: 0 }}
            className="relative w-[90vw] max-w-4xl h-[70vh] bg-slate-950/95 rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 z-10">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✍️</span>
                <span className="text-sm font-medium text-slate-300">Handwritten Answer</span>
                {isAnimating && (
                  <span className="text-xs text-cyan-400 animate-pulse">Writing...</span>
                )}
              </div>
              
              {/* Font selector */}
              <div className="flex items-center gap-2">
                <select
                  value={currentFont}
                  onChange={(e) => handleFontChange(e.target.value as keyof typeof VARA_FONTS)}
                  className="bg-slate-800/80 text-xs text-slate-300 rounded-lg px-2 py-1 border border-slate-600/50 outline-none focus:ring-2 focus:ring-cyan-500/30"
                >
                  <option value="satisfy">Satisfy</option>
                  <option value="pacifico">Pacifico</option>
                  <option value="shadowsIntoLight">Shadows Into Light</option>
                  <option value="patrickHand">Patrick Hand</option>
                </select>

                <button
                  onClick={handleReplay}
                  disabled={isAnimating || isLoading}
                  className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-cyan-400 hover:bg-slate-700/80 transition-colors disabled:opacity-50"
                  title="Replay animation"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button
                  onClick={handleClear}
                  className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-red-400 hover:bg-slate-700/80 transition-colors"
                  title="Clear canvas"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div className="absolute top-14 bottom-0 left-0 right-0 overflow-auto p-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  <span className="text-sm text-slate-400">Thinking...</span>
                </div>
              ) : (
                <div
                  id="handwriting-container"
                  ref={containerRef}
                  className="w-full min-h-full"
                  style={{
                    background: 'repeating-linear-gradient(transparent, transparent 35px, rgba(100, 116, 139, 0.1) 35px, rgba(100, 116, 139, 0.1) 36px)',
                  }}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default HandwritingCanvas;
