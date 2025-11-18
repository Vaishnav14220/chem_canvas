import React, { useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface AnnotationNodeData {
  label: string;
  level: number;
  arrowStyle?: string;
}

const AnnotationNode: React.FC<NodeProps<AnnotationNodeData>> = ({ data }) => {
  const handleStyle = useMemo<React.CSSProperties>(() => ({
    width: 12,
    height: 12,
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #38bdf8 0%, #ec4899 60%, #f97316 100%)',
    border: '2px solid rgba(12,18,34,0.95)',
    boxShadow: '0 0 12px rgba(56,189,248,0.45)',
  }), []);

  return (
    <div className="relative w-[360px] overflow-hidden rounded-2xl shadow-[0_18px_38px_rgba(15,23,42,0.45)]">
      <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.28),_rgba(12,18,34,0.95))] opacity-90" />
      <div className="relative z-10 rounded-2xl border border-slate-700/70 bg-slate-900/85 px-6 py-5 text-slate-100 backdrop-blur">
        <div className="flex items-center gap-3 text-xs tracking-[0.35em] uppercase text-slate-400/80">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900/70 font-semibold text-sky-300 shadow-inner">
            {data.level}
          </span>
          <span>Learning Plan Overview</span>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white leading-tight">{data.label}</h2>
        {data.arrowStyle && (
          <div className="mt-4 text-sm text-slate-300/80">
            {data.arrowStyle}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
};

export default AnnotationNode;