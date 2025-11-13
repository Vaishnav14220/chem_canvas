import React, { useState, useEffect } from 'react';
import { PlayCircle, SkipBack, SkipForward } from 'lucide-react';

interface ReactionPathProps {
  onScriptChange: (script: string) => void;
}

const reactant = `4
reactant
C  0.0  0.0  0.0
C  1.5  0.0  0.0
H  -0.5  0.9  0.0
H  2.0  0.9  0.0
`;

const product = `4
product
C  0.0  0.0  0.0
O  1.2  0.0  0.0
H  -0.5  0.9  0.0
H  -0.5 -0.9  0.0
`;

const reactions = [
  {
    name: 'C-C to C-O bond conversion',
    description: 'CH₃-CH₃ → CH₃-OH',
    reactant,
    product,
    question: 'When the C-O distance is ~1.4 Å, what is the approximate C-C distance?',
  },
  {
    name: 'SN2 Reaction',
    description: 'Nucleophilic substitution',
    reactant: `5
reactant
C  0.0  0.0  0.0
Cl  1.8  0.0  0.0
H  -0.5  0.9  0.0
H  -0.5 -0.9  0.0
Br -3.0  0.0  0.0
`,
    product: `5
product
C  0.0  0.0  0.0
Br  1.9  0.0  0.0
H  -0.5  0.9  0.0
H  -0.5 -0.9  0.0
Cl  3.2  0.0  0.0
`,
    question: 'At what interpolation value does the C atom appear roughly equidistant from both Cl and Br?',
  },
];

const ReactionPath: React.FC<ReactionPathProps> = ({ onScriptChange }) => {
  const [frac, setFrac] = useState(0);
  const [currentReaction, setCurrentReaction] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const interpolate = (f: number, reactionIdx: number) => {
    const reaction = reactions[reactionIdx];
    const linesR = reaction.reactant.split('\n');
    const linesP = reaction.product.split('\n');
    const n = parseInt(linesR[0]);

    let mol = `${n}\ninterpolated\n`;
    for (let i = 2; i < 2 + n; i++) {
      const partsR = linesR[i].trim().split(/\s+/);
      const partsP = linesP[i].trim().split(/\s+/);
      
      if (partsR.length < 4 || partsP.length < 4) continue;
      
      const atom = partsR[0];
      const x1 = parseFloat(partsR[1]);
      const y1 = parseFloat(partsR[2]);
      const z1 = parseFloat(partsR[3]);
      const x2 = parseFloat(partsP[1]);
      const y2 = parseFloat(partsP[2]);
      const z2 = parseFloat(partsP[3]);
      
      const x = x1 * (1 - f) + x2 * f;
      const y = y1 * (1 - f) + y2 * f;
      const z = z1 * (1 - f) + z2 * f;
      
      mol += `${atom.padEnd(2)} ${x.toFixed(4).padStart(8)} ${y.toFixed(4).padStart(8)} ${z.toFixed(4).padStart(8)}\n`;
    }

    const cmd = `load inline "${mol}"; wireframe 0.2; spacefill 0.3; select *; color cpk; set measurements angstroms;`;
    onScriptChange(cmd);
  };

  useEffect(() => {
    interpolate(frac, currentReaction);
  }, []);

  const handleSliderChange = (value: number) => {
    const newFrac = value / 100;
    setFrac(newFrac);
    interpolate(newFrac, currentReaction);
  };

  const animate = () => {
    setIsAnimating(true);
    let f = 0;
    const interval = setInterval(() => {
      f += 0.02;
      if (f >= 1) {
        f = 0;
      }
      setFrac(f);
      interpolate(f, currentReaction);
    }, 50);

    setTimeout(() => {
      clearInterval(interval);
      setIsAnimating(false);
    }, 5000);
  };

  const switchReaction = (idx: number) => {
    setCurrentReaction(idx);
    setFrac(0);
    interpolate(0, idx);
  };

  const reaction = reactions[currentReaction];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-900 to-cyan-900 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          Reaction Path Visualization
        </h3>
        <p className="text-blue-200 text-sm mb-2">
          {reaction.name}: {reaction.description}
        </p>
        <p className="text-blue-100 text-xs">
          Use the slider to interpolate between reactant and product geometries
        </p>
      </div>

      <div className="bg-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-3">
          Select Reaction:
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {reactions.map((r, idx) => (
            <button
              key={idx}
              onClick={() => switchReaction(idx)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                currentReaction === idx
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-600 hover:bg-slate-500 text-gray-200'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-white">
            Progress: {frac.toFixed(2)}
          </label>
          <div className="flex gap-2 text-xs text-gray-400">
            <span>Reactant</span>
            <span>→</span>
            <span>Product</span>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          value={frac * 100}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${frac * 100}%, #475569 ${frac * 100}%, #475569 100%)`
          }}
        />

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { setFrac(0); interpolate(0, currentReaction); }}
            className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <SkipBack className="w-4 h-4" />
            Reactant
          </button>
          <button
            onClick={animate}
            disabled={isAnimating}
            className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-4 h-4" />
            Animate
          </button>
          <button
            onClick={() => { setFrac(1); interpolate(1, currentReaction); }}
            className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
          >
            <SkipForward className="w-4 h-4" />
            Product
          </button>
        </div>
      </div>

      <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-amber-100 mb-2">
          Analysis Question:
        </h4>
        <p className="text-sm text-amber-50 mb-2">
          {reaction.question}
        </p>
        <p className="text-xs text-amber-200">
          <strong>Tip:</strong> Use JSmol's measurement tools - click two atoms to measure distance, or use the console command: <code className="bg-slate-800 px-1 py-0.5 rounded">measure {"{atom1}"} {"{atom2}"}</code>
        </p>
      </div>
    </div>
  );
};

export default ReactionPath;
