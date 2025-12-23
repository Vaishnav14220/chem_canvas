import React, { useEffect, useRef } from 'react';
import { Loader2, Mic, PhoneOff } from 'lucide-react';

interface GeminiLiveVoiceStatusProps {
  isListening: boolean;
  isSpeaking: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  onToggleConnection: () => void;
  isButtonDisabled?: boolean;
  error?: string | null;
}

const COLORS = [
  'rgba(32,133,252,',
  'rgba(94,252,169,',
  'rgba(253,71,103,',
];

const GeminiLiveVoiceStatus: React.FC<GeminiLiveVoiceStatusProps> = ({
  isListening,
  isSpeaking,
  isConnected,
  isConnecting,
  onToggleConnection,
  isButtonDisabled,
  error
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const phaseRef = useRef(0);
  const statusRef = useRef({ isListening, isSpeaking });

  useEffect(() => {
    statusRef.current = { isListening, isSpeaking };
  }, [isListening, isSpeaking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const deviceRatio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth * deviceRatio;
      const height = canvas.clientHeight * deviceRatio;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);
      const { isListening: listening, isSpeaking: speaking } = statusRef.current;
      const baseAmplitude = speaking ? 0.38 * height : listening ? 0.25 * height : 0.08 * height;
      const speed = speaking ? 0.025 : listening ? 0.015 : 0.006;
      const opacityBase = speaking ? 0.85 : listening ? 0.65 : 0.3;
      phaseRef.current += speed;

      COLORS.forEach((color, idx) => {
        ctx.beginPath();
        const localAmplitude = baseAmplitude * (0.7 + idx * 0.15);
        const frequency = 2 + idx * 0.6;
        const phaseOffset = idx * Math.PI * 0.5;
        for (let x = 0; x <= width; x += 4 * deviceRatio) {
          const progress = x / width;
          const easing = Math.pow(Math.sin(Math.PI * progress), 2);
          const y = height / 2 + Math.sin(progress * frequency + phaseRef.current + phaseOffset) * localAmplitude * easing;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = `${color}${opacityBase})`;
        ctx.lineWidth = speaking ? 4 : 3;
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'lighter';
        ctx.stroke();
      });

      ctx.globalCompositeOperation = 'source-over';
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const statusLabel = isSpeaking ? 'Speaking' : isListening ? 'Listening' : isConnected ? 'Ready' : 'Offline';
  const statusAccent = isSpeaking
    ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
    : isListening
    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
    : isConnected
    ? 'bg-slate-800/80 text-slate-200 border border-slate-700'
    : 'bg-slate-900/80 text-slate-500 border border-slate-800';

  const subcopy = isSpeaking
    ? 'Streaming answer to the student'
    : isListening
    ? 'Waiting for your next question'
    : isConnected
    ? 'Live session ready'
    : 'Start a session to engage';

  return (
    <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 md:p-5 backdrop-blur">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/70">Voice Presence</p>
          <p className="text-lg font-semibold text-white mt-1">{statusLabel}</p>
          <p className="text-xs text-slate-400 mt-1">{subcopy}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className={`px-4 py-1 rounded-full text-xs font-semibold ${statusAccent}`}>
            {statusLabel}
          </div>
          <button
            type="button"
            onClick={onToggleConnection}
            disabled={isButtonDisabled || isConnecting}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all ${
              isConnected
                ? 'bg-red-600/10 text-red-300 border border-red-500/40 hover:bg-red-600/20'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
            } ${isConnecting ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Connecting
              </>
            ) : isConnected ? (
              <>
                <PhoneOff className="w-4 h-4" /> End Session
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" /> Start Session
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="mt-4 h-16 relative">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />
      </div>
    </div>
  );
};

export default GeminiLiveVoiceStatus;
