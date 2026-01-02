import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RefreshCw, SlidersHorizontal } from 'lucide-react';

interface ImmersiveInteractiveCanvasProps {
  title?: string;
  subtitle?: string;
}

const DEFAULTS = {
  amplitude: 1.4,
  frequency: 1.2,
  speed: 1,
};

export const ImmersiveInteractiveCanvas: React.FC<ImmersiveInteractiveCanvasProps> = ({
  title = 'Interactive signal canvas',
  subtitle = 'Adjust amplitude and frequency to see the waveform respond.',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const [isRunning, setIsRunning] = useState(true);
  const [amplitude, setAmplitude] = useState(DEFAULTS.amplitude);
  const [frequency, setFrequency] = useState(DEFAULTS.frequency);
  const [speed, setSpeed] = useState(DEFAULTS.speed);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = 1;
      const gridX = width / 10;
      const gridY = height / 6;
      for (let x = 0; x <= width; x += gridX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += gridY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#38bdf8');
      gradient.addColorStop(0.5, '#a855f7');
      gradient.addColorStop(1, '#f97316');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const amp = Math.max(0.2, amplitude);
      const freq = Math.max(0.2, frequency);
      const scale = height * 0.35;
      for (let px = 0; px <= width; px += 2) {
        const xNorm = px / width;
        const y = Math.sin(2 * Math.PI * (freq * xNorm + timeRef.current)) * amp;
        const yPixel = height / 2 - y * scale;
        if (px === 0) {
          ctx.moveTo(px, yPixel);
        } else {
          ctx.lineTo(px, yPixel);
        }
      }
      ctx.stroke();

      if (isRunning) {
        timeRef.current += 0.004 * speed;
      }
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [amplitude, frequency, speed, isRunning]);

  const handleReset = () => {
    setAmplitude(DEFAULTS.amplitude);
    setFrequency(DEFAULTS.frequency);
    setSpeed(DEFAULTS.speed);
    timeRef.current = 0;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-slate-900">{title}</h3>
          <p className="text-[13px] text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsRunning(prev => !prev)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isRunning ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-900/10 bg-slate-950">
        <canvas ref={canvasRef} className="h-56 w-full" />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Amplitude
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min="0.5"
              max="3.5"
              step="0.1"
              value={amplitude}
              onChange={(event) => setAmplitude(Number(event.target.value))}
              className="w-full accent-blue-500"
            />
            <span className="text-xs font-semibold text-slate-700">{amplitude.toFixed(1)}x</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Frequency
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={frequency}
              onChange={(event) => setFrequency(Number(event.target.value))}
              className="w-full accent-purple-500"
            />
            <span className="text-xs font-semibold text-slate-700">{frequency.toFixed(1)} Hz</span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Speed
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min="0.4"
              max="2"
              step="0.1"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="w-full accent-amber-500"
            />
            <span className="text-xs font-semibold text-slate-700">{speed.toFixed(1)}x</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImmersiveInteractiveCanvas;
