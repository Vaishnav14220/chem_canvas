import React, { useEffect, useRef, useState } from 'react';
import { KineticsParams } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'REACTANT' | 'PRODUCT';
  radius: number;
}

interface GeminiLiveKineticsSimulationProps {
  params: KineticsParams;
}

const GeminiLiveKineticsSimulation: React.FC<GeminiLiveKineticsSimulationProps> = ({ params }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);

  // Stats for visualization
  const [stats, setStats] = useState({ reactants: 0, products: 0, reactionRate: 0 });
  const reactionCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  // Initialize or update particles based on concentration
  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();

    // Map concentration (0-100) to particle count (10-200)
    const targetCount = Math.floor(10 + (params.concentration / 100) * 190);

    const currentParticles = particlesRef.current;

    if (currentParticles.length < targetCount) {
      // Add particles
      for (let i = currentParticles.length; i < targetCount; i++) {
        currentParticles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          type: 'REACTANT',
          radius: 3 + Math.random() * 2
        });
      }
    } else if (currentParticles.length > targetCount) {
      // Remove particles
      currentParticles.length = targetCount;
    }

    // Reset types if concentration changes significantly to simulate fresh start
    // Or we could keep them. Let's keep them but maybe slowly revert products if eq shifts?
    // For kinetics demo, let's just keep current state.

  }, [params.concentration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Handle canvas sizing
    const updateSize = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Speed factor based on temperature (0-100) -> 0.2 to 5.0
      const speedFactor = 0.2 + (params.temperature / 100) * 4.8;

      // Ea threshold: Higher Ea means harder to react.
      // We'll simulate this by checking collision energy relative to this threshold.
      // Inverse mapping: High Ea (100) -> Low probability. Low Ea (0) -> High probability.
      const reactionThreshold = 0.1 + (params.activationEnergy / 100) * 0.9;

      ctx.clearRect(0, 0, width, height);

      // Draw Background Grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let x=0; x<width; x+=40) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
      for(let y=0; y<height; y+=40) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
      ctx.stroke();

      // Update and Draw Particles
      const particles = particlesRef.current;
      let reactantCount = 0;
      let productCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move
        p.x += p.vx * speedFactor;
        p.y += p.vy * speedFactor;

        // Wall bounce
        if (p.x < p.radius) { p.x = p.radius; p.vx *= -1; }
        if (p.x > width - p.radius) { p.x = width - p.radius; p.vx *= -1; }
        if (p.y < p.radius) { p.y = p.radius; p.vy *= -1; }
        if (p.y > height - p.radius) { p.y = height - p.radius; p.vy *= -1; }

        // Check Collisions (Simple O(N^2) for small N is fine)
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p2.x - p.x;
          const dy = p2.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < p.radius + p2.radius) {
            // Elastic collision response (simplified)
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle);
            const cos = Math.cos(angle);

            // Rotate velocities
            const vx1 = p.vx * cos + p.vy * sin;
            const vy1 = p.vy * cos - p.vx * sin;
            const vx2 = p2.vx * cos + p2.vy * sin;
            const vy2 = p2.vy * cos - p2.vx * sin;

            // Swap x velocities (conservation of momentum for equal mass)
            p.vx = vx2 * cos - vy1 * sin;
            p.vy = vy1 * cos + vx2 * sin;
            p2.vx = vx1 * cos - vy2 * sin;
            p2.vy = vy2 * cos + vx1 * sin;

            // Separation to prevent sticking
            const overlap = (p.radius + p2.radius - dist) / 2;
            p.x -= overlap * Math.cos(angle);
            p.y -= overlap * Math.sin(angle);
            p2.x += overlap * Math.cos(angle);
            p2.y += overlap * Math.sin(angle);

            // Chemical Reaction Logic
            // Only Reactant + Reactant -> Product
            if (p.type === 'REACTANT' && p2.type === 'REACTANT') {
               // Calculate relative kinetic energy roughly
               const relativeSpeed = Math.abs(vx1 - vx2); // simplified

               // Reaction probability based on Ea (threshold) and Speed (Energy)
               // If relative speed is high enough to overcome threshold
               // Actually, threshold is "Barrier". So if speed > barrier.
               // params.activationEnergy is 0-100.
               // Let's map barrier to speed units. Max speed approx 2 (base) * 5 (temp factor) = 10.
               const barrier = (params.activationEnergy / 100) * 8;

               // We multiply by speedFactor because p.vx is normalized base speed
               const actualImpactSpeed = relativeSpeed * speedFactor;

               if (actualImpactSpeed > barrier) {
                  p.type = 'PRODUCT';
                  p2.type = 'PRODUCT';
                  reactionCountRef.current += 1;

                  // Visual flare
                  ctx.fillStyle = '#fff';
                  ctx.beginPath();
                  ctx.arc((p.x+p2.x)/2, (p.y+p2.y)/2, 10, 0, Math.PI*2);
                  ctx.fill();
               }
            }
          }
        }

        // Draw Particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);

        if (p.type === 'REACTANT') {
           ctx.fillStyle = '#0ea5e9'; // Science Blue
           ctx.shadowBlur = 5;
           ctx.shadowColor = '#0ea5e9';
           reactantCount++;
        } else {
           ctx.fillStyle = '#f43f5e'; // Molecule Rose
           ctx.shadowBlur = 10;
           ctx.shadowColor = '#f43f5e';
           productCount++;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Stats update (throttled)
      const now = Date.now();
      if (now - lastTimeRef.current > 1000) {
         setStats({
            reactants: reactantCount,
            products: productCount,
            reactionRate: reactionCountRef.current
         });
         reactionCountRef.current = 0;
         lastTimeRef.current = now;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', updateSize);
    };
  }, [params]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[300px] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
       <canvas ref={canvasRef} className="w-full h-full" />

       {/* Overlay Data */}
       <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur p-3 rounded-lg border border-slate-800 text-xs font-mono pointer-events-none select-none">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-3 h-3 rounded-full bg-science-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]"></div>
             <span className="text-slate-300">Reactants: {stats.reactants}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
             <div className="w-3 h-3 rounded-full bg-molecule-rose shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
             <span className="text-slate-300">Products: {stats.products}</span>
          </div>
          <div className="h-px bg-slate-800 my-2"></div>
          <div className="text-slate-400">Rate: {stats.reactionRate} rxn/s</div>
       </div>

       {/* Parameters Overlay */}
       <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-4 bg-slate-950/90 backdrop-blur p-3 rounded-xl border border-slate-800 text-xs pointer-events-none">
          <div>
             <div className="text-slate-500 mb-1">Temperature</div>
             <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${params.temperature}%` }}></div>
             </div>
          </div>
          <div>
             <div className="text-slate-500 mb-1">Concentration</div>
             <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-science-500 transition-all duration-500" style={{ width: `${params.concentration}%` }}></div>
             </div>
          </div>
          <div>
             <div className="text-slate-500 mb-1">Activation Energy (Ea)</div>
             <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-molecule-purple transition-all duration-500" style={{ width: `${params.activationEnergy}%` }}></div>
             </div>
          </div>
       </div>
    </div>
  );
};

export default GeminiLiveKineticsSimulation;
