import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';

import useMindMapStore from './mindMapStore';
import type { MindMapNodeData } from './mindMapStore';

const handleBase: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: '999px',
  border: '1.5px solid rgba(148, 163, 184, 0.7)',
  background: '#f8fafc'
};

const sourceHandleStyle: CSSProperties = {
  ...handleBase
};

const targetHandleStyle: CSSProperties = {
  ...handleBase,
  background: '#e2e8f0'
};

const getDifficultyAccent = (difficulty?: string) => {
  switch (difficulty) {
    case 'beginner':
      return {
        chip: 'bg-orange-100 text-orange-500 border border-orange-200',
        frame: 'border-orange-200 shadow-[0_12px_35px_rgba(253,186,116,0.25)]'
      };
    case 'intermediate':
      return {
        chip: 'bg-sky-100 text-sky-500 border border-sky-200',
        frame: 'border-sky-200 shadow-[0_12px_35px_rgba(125,211,252,0.25)]'
      };
    case 'advanced':
      return {
        chip: 'bg-purple-100 text-purple-500 border border-purple-200',
        frame: 'border-purple-200 shadow-[0_12px_35px_rgba(196,181,253,0.25)]'
      };
    default:
      return {
        chip: 'bg-slate-100 text-slate-500 border border-slate-200',
        frame: 'border-slate-200 shadow-[0_12px_30px_rgba(148,163,184,0.18)]'
      };
  }
};

const getStatusBadge = (status?: string) => {
  switch (status) {
    case 'completed':
      return { label: 'Completed', tone: 'bg-emerald-100 text-emerald-600 border border-emerald-200' };
    case 'in-progress':
      return { label: 'In progress', tone: 'bg-amber-100 text-amber-600 border border-amber-200' };
    default:
      return { label: 'Pending', tone: 'bg-slate-100 text-slate-500 border border-slate-200' };
  }
};

const MindMapNode = ({ id, data }: NodeProps<MindMapNodeData>) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNodeLabel = useMindMapStore((state) => state.updateNodeLabel);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (data.variant === 'generic') {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 1);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [data.variant]);

  useLayoutEffect(() => {
    if (data.variant === 'generic' && inputRef.current) {
      inputRef.current.style.width = `${Math.max(data.label.length * 8, 140)}px`;
    }
  }, [data.label.length, data.variant]);

  const variant = useMemo<'root' | 'branch' | 'milestone' | 'note' | 'generic'>(() => {
    if (data.variant) {
      return data.variant;
    }
    if (data.note) {
      return 'note';
    }
    if (data.milestone) {
      return 'milestone';
    }
    return 'generic';
  }, [data.variant, data.note, data.milestone]);

  const Handles = () => (
    <>
      <Handle type="source" position={Position.Top} id={`${id}-source-top`} style={sourceHandleStyle} />
      <Handle type="target" position={Position.Top} id={`${id}-target-top`} style={targetHandleStyle} />
      <Handle type="source" position={Position.Right} id={`${id}-source-right`} style={sourceHandleStyle} />
      <Handle type="target" position={Position.Right} id={`${id}-target-right`} style={targetHandleStyle} />
      <Handle type="source" position={Position.Bottom} id={`${id}-source-bottom`} style={sourceHandleStyle} />
      <Handle type="target" position={Position.Bottom} id={`${id}-target-bottom`} style={targetHandleStyle} />
      <Handle type="source" position={Position.Left} id={`${id}-source-left`} style={sourceHandleStyle} />
      <Handle type="target" position={Position.Left} id={`${id}-target-left`} style={targetHandleStyle} />
    </>
  );

  if (variant === 'root' && data.milestone) {
    return (
      <>
        <div className="dragHandle cursor-grab active:cursor-grabbing w-[17rem] rounded-[18px] border border-slate-200 bg-white/95 px-4 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Plan overview</p>
              <h2 className="mt-2 text-lg font-semibold leading-tight text-slate-900">{data.label}</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 border border-slate-200">
              {data.milestone.learningObjectives.length} goals
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Duration</p>
              <p className="text-base font-semibold text-slate-900">{data.milestone.duration}m</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Tools</p>
              <p className="text-sm font-medium text-slate-800 leading-tight">{data.milestone.tools.slice(0, 2).join(', ') || 'Configure'}</p>
            </div>
          </div>
        </div>

        <Handles />
      </>
    );
  }

  if (variant === 'branch' && data.milestone) {
    const accent = getDifficultyAccent(data.milestone.difficulty);

    return (
      <>
        <div className={`dragHandle cursor-grab active:cursor-grabbing w-[15rem] rounded-[18px] border ${accent.frame} bg-white px-4 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.12)]`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Track</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-900 leading-tight line-clamp-2">{data.milestone.title}</h3>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wide font-semibold ${accent.chip}`}>
              {data.milestone.difficulty}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate-600 leading-relaxed line-clamp-5">{data.milestone.description}</p>
          <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500">
            <span className="uppercase tracking-[0.2em]">{data.milestone.tools.length} tools</span>
            <span className="flex items-center gap-1">⏱️ {data.milestone.duration}m</span>
          </div>
        </div>

        <Handles />
      </>
    );
  }

  if (variant === 'milestone' && data.milestone) {
    const accent = getDifficultyAccent(data.milestone.difficulty);
    const status = getStatusBadge(data.milestone.status);

    return (
      <>
        <div className={`dragHandle cursor-grab active:cursor-grabbing w-64 rounded-[18px] border ${accent.frame} bg-white px-4 py-5 shadow-[0_20px_55px_rgba(15,23,42,0.14)] transition-shadow duration-200 hover:shadow-[0_24px_70px_rgba(15,23,42,0.18)]`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Milestone</p>
              <h3 className="mt-2 text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{data.label}</h3>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wide font-semibold ${accent.chip}`}>
                {data.milestone.difficulty}
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">⏱️ {data.milestone.duration}m</span>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-600 leading-relaxed line-clamp-5">{data.milestone.description}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 text-[10px] text-slate-600">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="uppercase tracking-[0.2em] text-slate-400">Status</p>
              <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${status.tone}`}>
                {status.label}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="uppercase tracking-[0.2em] text-slate-400">Objectives</p>
              <p className="text-sm font-medium text-slate-800">{data.milestone.learningObjectives.length}</p>
            </div>
          </div>

          {data.milestone.tools.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 mb-2">Tools</p>
              <div className="flex flex-wrap gap-2">
                {data.milestone.tools.slice(0, 4).map((tool: string, idx: number) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-600">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <Handles />
      </>
    );
  }

  if (variant === 'note' && data.note) {
    return (
      <>
        <div className="dragHandle cursor-grab active:cursor-grabbing w-64 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-4 shadow-[0_16px_40px_rgba(252,165,165,0.28)]">
          <p className="text-[10px] uppercase tracking-[0.3em] text-rose-400">Custom block</p>
          <h3 className="mt-2 text-sm font-semibold text-rose-600 leading-snug line-clamp-2">{data.label || 'New note block'}</h3>
          <p className="mt-3 text-[11px] text-rose-500 leading-relaxed whitespace-pre-wrap line-clamp-6">
            {data.note.content || 'Add your notes in the editor'}
          </p>
        </div>

        <Handles />
      </>
    );
  }

  return (
    <>
      <div className="dragHandle cursor-text w-60 rounded-[18px] border border-slate-200 bg-white px-4 py-4 shadow-[0_15px_35px_rgba(148,163,184,0.22)]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Node label</p>
        <input
          value={data.label}
          onChange={(evt) => updateNodeLabel(id, evt.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
          ref={inputRef}
          placeholder="Click to edit..."
        />
        {isEditing ? (
          <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">Editing…</p>
        ) : (
          <p className="mt-2 text-[11px] text-slate-500">Use this block to draft ideas or quick tasks.</p>
        )}
      </div>

      <Handles />
    </>
  );
};

export default MindMapNode;