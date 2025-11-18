import React, { useEffect, useRef } from 'react';
import { AudioVisualizerProps } from './types';

const GeminiLiveAudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, isConnected }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || !isConnected) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      // Clear with transparency for trail effect
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 3;
      // Create gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#14b8a6'); // Teal
      gradient.addColorStop(0.5, '#a855f7'); // Purple
      gradient.addColorStop(1, '#0ea5e9'); // Blue

      ctx.strokeStyle = gradient;
      ctx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // Normalize to [0, 2] (1 is center)
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isConnected]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
        if (canvasRef.current) {
            canvasRef.current.width = canvasRef.current.clientWidth;
            canvasRef.current.height = canvasRef.current.clientHeight;
        }
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-64 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-700 shadow-inner shadow-black/50">
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-sm">
          Start session to visualize audio
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={800}
        height={300}
      />
      {/* Decorative overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-slate-900/20 pointer-events-none"></div>
    </div>
  );
};

export default GeminiLiveAudioVisualizer;
