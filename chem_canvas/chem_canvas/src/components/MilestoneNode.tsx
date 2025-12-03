import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

interface MilestoneNodeData {
  milestone: {
    id: string;
    title: string;
    description: string;
    duration: number;
    difficulty: Difficulty;
    tools: string[];
    prerequisites: string[];
    learningObjectives: string[];
    resources: string[];
    status: 'pending' | 'in-progress' | 'completed';
  };
  index: number;
  onUpdate?: (milestone: MilestoneNodeData['milestone']) => void;
  onRemove?: () => void;
}

const difficultyBadgeStyles: Record<Difficulty, string> = {
  beginner: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40',
  intermediate: 'bg-sky-500/10 text-sky-200 border border-sky-500/40',
  advanced: 'bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-500/40'
};

const MilestoneNode: React.FC<NodeProps<MilestoneNodeData>> = ({ data, id }) => {
  const { milestone, index, onUpdate, onRemove } = data;

  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description);
  const [duration, setDuration] = useState(String(milestone.duration));
  const [difficulty, setDifficulty] = useState<Difficulty>(milestone.difficulty);
  const [toolsInput, setToolsInput] = useState(milestone.tools.join('\n'));
  const [resourcesInput, setResourcesInput] = useState(milestone.resources.join('\n'));
  const [prerequisitesInput, setPrerequisitesInput] = useState(milestone.prerequisites.join('\n'));
  const [learningObjectivesInput, setLearningObjectivesInput] = useState(milestone.learningObjectives.join('\n'));

  useEffect(() => {
    setTitle(milestone.title);
    setDescription(milestone.description);
    setDuration(String(milestone.duration));
    setDifficulty(milestone.difficulty);
    setToolsInput(milestone.tools.join('\n'));
    setResourcesInput(milestone.resources.join('\n'));
    setPrerequisitesInput(milestone.prerequisites.join('\n'));
    setLearningObjectivesInput(milestone.learningObjectives.join('\n'));
  }, [milestone]);

  const parseList = useCallback((value: string) => (
    value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  ), []);

  const objectivesList = useMemo(() => parseList(learningObjectivesInput), [learningObjectivesInput, parseList]);
  const resourcesList = useMemo(() => parseList(resourcesInput), [resourcesInput, parseList]);
  const prerequisitesList = useMemo(() => parseList(prerequisitesInput), [prerequisitesInput, parseList]);
  const toolTags = useMemo(() => parseList(toolsInput), [toolsInput, parseList]);

  const triggerUpdate = useCallback((overrides: Partial<MilestoneNodeData['milestone']> = {}) => {
    if (!onUpdate) return;

    const normalizedDuration = Math.max(0, Number(duration) || 0);

    onUpdate({
      ...milestone,
      title,
      description,
      duration: normalizedDuration,
      difficulty,
      tools: toolTags,
      prerequisites: prerequisitesList,
      learningObjectives: objectivesList,
      resources: resourcesList,
      ...overrides,
    });
  }, [onUpdate, milestone, title, description, duration, difficulty, toolTags, prerequisitesList, objectivesList, resourcesList]);

  const handleStyle = useMemo<React.CSSProperties>(() => ({
    width: 12,
    height: 12,
    borderRadius: '999px',
    background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #38bdf8 100%)',
    border: '2px solid rgba(15,23,42,0.9)',
    boxShadow: '0 0 12px rgba(236,72,153,0.45)',
  }), []);

  return (
    <div className="relative">
      <div className="w-[320px] rounded-2xl border border-slate-700/80 bg-slate-800/95 p-5 text-slate-100 shadow-[0_20px_45px_rgba(15,23,42,0.55)] backdrop-blur">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-pink-300/80 font-semibold">
              Milestone {index}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white leading-tight">
              {title || 'Untitled Milestone'}
            </h3>
          </div>
          <span className={`ml-3 rounded-full px-3 py-1 text-xs font-medium ${difficultyBadgeStyles[difficulty]}`}>
            {difficulty}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400/70">
              Block Label
            </label>
            <input
              value={title}
              onChange={(event) => {
                const value = event.target.value;
                setTitle(value);
                triggerUpdate({ title: value });
              }}
              className="w-full rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400/70">
              Description
            </label>
            <textarea
              value={description}
              onChange={(event) => {
                const value = event.target.value;
                setDescription(value);
                triggerUpdate({ description: value });
              }}
              rows={3}
              className="w-full rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:outline-none"
            />
            <textarea
              value={learningObjectivesInput}
              onChange={(event) => {
                const value = event.target.value;
                setLearningObjectivesInput(value);
                triggerUpdate({ learningObjectives: parseList(value) });
              }}
              rows={3}
              className="mt-3 w-full rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:outline-none"
              placeholder="Learning objectives (newline separated)"
            />
            <textarea
              value={resourcesInput}
              onChange={(event) => {
                const value = event.target.value;
                setResourcesInput(value);
                triggerUpdate({ resources: parseList(value) });
              }}
              rows={2}
              className="mt-3 w-full rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:outline-none"
              placeholder="Resources"
            />
            <textarea
              value={prerequisitesInput}
              onChange={(event) => {
                const value = event.target.value;
                setPrerequisitesInput(value);
                triggerUpdate({ prerequisites: parseList(value) });
              }}
              rows={2}
              className="mt-3 w-full rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:outline-none"
              placeholder="Prerequisites"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300/90">
          <span className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1">
            Duration:
            <input
              type="number"
              min={5}
              max={240}
              value={duration}
              onChange={(event) => {
                const value = event.target.value;
                setDuration(value);
                const nextDuration = Math.max(0, Number(value) || 0);
                triggerUpdate({ duration: nextDuration });
              }}
              className="ml-2 w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
            />
            min
          </span>
          <select
            value={difficulty}
            onChange={(event) => {
              const value = event.target.value as Difficulty;
              setDifficulty(value);
              triggerUpdate({ difficulty: value });
            }}
            className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1 text-slate-200 focus:outline-none"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          {toolTags.map((tool, toolIndex) => (
            <span
              key={`${id}-tool-${toolIndex}-${tool}`}
              className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-indigo-200"
            >
              {tool}
            </span>
          ))}
        </div>

        <textarea
          value={toolsInput}
          onChange={(event) => {
            const value = event.target.value;
            setToolsInput(value);
            triggerUpdate({ tools: parseList(value) });
          }}
          rows={2}
          className="mt-3 w-full rounded-lg border border-slate-700/70 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 shadow-inner focus:outline-none"
          placeholder="Tools (newline separated)"
        />

        {(objectivesList.length > 0 || resourcesList.length > 0 || prerequisitesList.length > 0) && (
          <div className="mt-4 space-y-3 text-xs text-slate-200/90">
            {objectivesList.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/80">Learning Objectives</p>
                <ul className="list-disc space-y-1 pl-4 text-slate-200/80">
                  {objectivesList.map((objective, objectiveIndex) => (
                    <li key={`${id}-objective-${objectiveIndex}`}>{objective}</li>
                  ))}
                </ul>
              </div>
            )}
            {resourcesList.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/80">Resources</p>
                <ul className="list-disc space-y-1 pl-4 text-slate-200/80">
                  {resourcesList.map((resource, resourceIndex) => (
                    <li key={`${id}-resource-${resourceIndex}`}>{resource}</li>
                  ))}
                </ul>
              </div>
            )}
            {prerequisitesList.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400/80">Prerequisites</p>
                <p>{prerequisitesList.join(', ')}</p>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20"
        >
          Remove Block
        </button>
      </div>

      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </div>
  );
};

export default MilestoneNode;
