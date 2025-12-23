import React, { useMemo } from 'react';
import { EdgeProps, EdgeLabelRenderer, getBezierPath } from 'reactflow';

const ButtonEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const gradientId = useMemo(() => `edge-gradient-${id}`, [id]);
  const glowId = useMemo(() => `edge-glow-${id}`, [id]);

  return (
    <g className="react-flow__edge">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(56,189,248,0.75)" />
          <stop offset="40%" stopColor="rgba(248,113,113,0.95)" />
          <stop offset="100%" stopColor="rgba(251,191,36,0.95)" />
        </linearGradient>
        <linearGradient id={glowId} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(56,189,248,0.55)" />
          <stop offset="50%" stopColor="rgba(236,72,153,0.5)" />
          <stop offset="100%" stopColor="rgba(251,191,36,0.45)" />
        </linearGradient>
      </defs>

      <path
        d={edgePath}
        className="edge-glow-path"
        fill="none"
        stroke={`url(#${glowId})`}
        strokeWidth={16}
        strokeDasharray="28 32"
        strokeLinecap="round"
        opacity={0.55}
      />
      <path
        d={edgePath}
        className="edge-core-path edge-animated"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={9}
        strokeDasharray="18 18"
        strokeLinecap="round"
      />
      <path
        d={edgePath}
        className="edge-sparkle edge-animated-reverse"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={2}
        strokeDasharray="2 22"
        strokeLinecap="round"
        opacity={0.9}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'none',
          }}
        >
          <span className="edge-marker inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 via-rose-400 to-amber-300 shadow-[0_0_18px_rgba(251,113,133,0.85)]" />
        </div>
      </EdgeLabelRenderer>
    </g>
  );
};

export default ButtonEdge;