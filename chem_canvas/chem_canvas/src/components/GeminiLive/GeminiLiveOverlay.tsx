import React, { useState, useEffect, useRef } from 'react';
import { Mic, PhoneOff, Loader2, X, Maximize2, Minimize2, Sparkles, Activity, GripHorizontal } from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import { useGeminiLive } from './hooks/useGeminiLive';
import GeminiLiveLearningCanvas from './GeminiLiveLearningCanvas';
import { ConnectionState, LearningCanvasImage } from './types';

interface GeminiLiveOverlayProps {
  geminiLiveState: ReturnType<typeof useGeminiLive>;
  activeWorkspaceId: string;
  onExpandImage: (image: LearningCanvasImage) => void;
}

const GeminiLiveOverlay: React.FC<GeminiLiveOverlayProps> = ({ geminiLiveState, activeWorkspaceId, onExpandImage }) => {
  const dragControls = useDragControls();

  // Resize state
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isWidgetExpanded, setIsWidgetExpanded] = useState(true);

  const {
    connect,
    disconnect,
    connectionState,
    analyser,
    simulationState,
    error,
    isListening,
    isSpeaking,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    simplifyStep
  } = geminiLiveState;

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  // Simple visualizer for the widget
  useEffect(() => {
    if (!analyser || !canvasRef.current || !isWidgetExpanded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#22d3ee'); // Cyan
        gradient.addColorStop(1, '#3b82f6'); // Blue

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isWidgetExpanded]);

  const handleToggleConnection = () => {
    if (isConnected || isConnecting) {
      disconnect();
    } else {
      connect();
    }
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: size.width,
      startHeight: size.height
    };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizeRef.current) return;
    const deltaX = e.clientX - resizeRef.current.startX;
    const deltaY = e.clientY - resizeRef.current.startY;

    setSize({
      width: Math.max(400, resizeRef.current.startWidth + deltaX),
      height: Math.max(300, resizeRef.current.startHeight + deltaY)
    });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    resizeRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const shouldShowLearningCanvas =
    simulationState.isActive &&
    simulationState.type === 'LEARNING_CANVAS' &&
    simulationState.learningCanvasParams &&
    simulationState.learningCanvasParams;

  return (
    <>
      {/* Floating Voice Widget */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-end gap-4">
          {/* Error Toast */}
          {error && (
            <div className="mb-2 max-w-xs rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-3 text-xs text-red-200 shadow-xl backdrop-blur-md">
              {error}
            </div>
          )}

          {/* Main Widget */}
          <div className={`transition-all duration-300 ease-in-out ${isWidgetExpanded ? 'w-72' : 'w-auto'} rounded-3xl border border-slate-800/60 bg-slate-950/80 shadow-2xl backdrop-blur-xl`}>
            <div className="flex items-center justify-between p-2 pl-4">
              <div className="flex items-center gap-3">
                <div className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isConnected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                  {isConnecting ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : isConnected ? (
                    <Activity size={20} className={isSpeaking ? 'animate-pulse text-emerald-400' : ''} />
                  ) : (
                    <Mic size={20} />
                  )}
                  {isConnected && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                    </span>
                  )}
                </div>

                {isWidgetExpanded && (
                  <div>
                    <p className="text-xs font-bold text-slate-200">Gemini Live</p>
                    <p className="text-[10px] text-slate-400">
                      {isConnecting ? 'Connecting...' : isConnected ? (isSpeaking ? 'Speaking...' : 'Listening...') : 'Ready to connect'}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  className={`p-2 rounded-full transition-all duration-300 ${isScreenSharing
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
                >
                  {isScreenSharing ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={handleToggleConnection}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${isConnected
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                    }`}
                  title={isConnected ? 'Disconnect' : 'Connect'}
                >
                  {isConnected ? <PhoneOff size={14} /> : <Mic size={14} />}
                </button>
                <button
                  onClick={() => setIsWidgetExpanded(!isWidgetExpanded)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  {isWidgetExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>

            {/* Visualizer Area (only when expanded and connected) */}
            {isWidgetExpanded && isConnected && (
              <div className="border-t border-slate-800/50 px-4 py-3">
                <div className="h-12 w-full overflow-hidden rounded-lg bg-slate-900/50">
                  <canvas ref={canvasRef} width={250} height={48} className="h-full w-full" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Learning Canvas Overlay - Draggable & Resizable */}
      {shouldShowLearningCanvas && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <motion.div
            drag
            dragListener={false}
            dragControls={dragControls}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            style={{ width: size.width, height: size.height }}
            className="pointer-events-auto relative flex flex-col overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-950/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Minimal Drag Handle - Top Right */}
            <div
              className="absolute top-0 left-0 right-0 h-8 z-10 flex justify-end px-4 py-2 opacity-0 hover:opacity-100 transition-opacity cursor-move"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="flex items-center gap-2 bg-slate-900/80 rounded-full px-2 py-1 backdrop-blur-md border border-slate-700/50">
                <GripHorizontal className="text-slate-400" size={16} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 cursor-default relative" onPointerDown={(e) => e.stopPropagation()}>
              <GeminiLiveLearningCanvas
                params={simulationState.learningCanvasParams!}
                onExpandImage={onExpandImage}
                onRequestSimplification={simplifyStep}
              />
            </div>

            {/* Resize Handle */}
            <div
              className="absolute bottom-0 right-0 h-6 w-6 cursor-se-resize flex items-center justify-center"
              onMouseDown={handleResizeStart}
            >
              <div className="h-2 w-2 rounded-full bg-slate-600/50" />
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default GeminiLiveOverlay;
