import { useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { Wand2, PlusCircle, Rocket, Maximize2, Minimize2 } from 'lucide-react';
import type { PlanEdge, PlanNode, PlanScenario } from '../types/srlCoach';

interface PlanningMindMapProps {
  nodes: PlanNode[];
  edges: PlanEdge[];
  scenarios: PlanScenario[];
  onAddStep: () => void;
  onUpdateStatus: (nodeId: string, status: PlanNode['status']) => void;
  onRunSimulation: () => void;
  onNewPlan?: () => void;
  isBusy?: boolean;
}

const statusColor: Record<PlanNode['status'], string> = {
  pending: 'bg-slate-700 text-slate-100',
  'in-progress': 'bg-blue-700 text-blue-100',
  completed: 'bg-emerald-700 text-emerald-100'
};

const PlanningMindMap = ({
  nodes,
  edges,
  scenarios,
  onAddStep,
  onUpdateStatus,
  onRunSimulation,
  onNewPlan,
  isBusy
}: PlanningMindMapProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const flowNodes = useMemo(() => {
    if (nodes.length === 0) {
      return [
        {
          id: 'empty',
          data: {
            label: (
              <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-xs text-blue-100">
                Add your first milestone to generate an adaptive roadmap.
              </div>
            )
          },
          position: { x: 0, y: 0 }
        }
      ];
    }

    return nodes.map((node, index) => ({
      id: node.id,
      position: {
        x: (index % 3) * 240,
        y: Math.floor(index / 3) * 160
      },
      data: {
        label: (
          <div className="w-56 rounded-xl border border-blue-500/30 bg-blue-900/20 p-3 text-xs text-blue-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-100">{node.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor[node.status]}`}>
                {node.status.replace('-', ' ')}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-blue-200/80">{node.description}</p>
            {node.durationMinutes ? (
              <p className="mt-2 text-[11px] text-blue-200/70">
                ⏱ {node.durationMinutes} min • {node.toolId ?? 'Custom resource'}
              </p>
            ) : null}
            {node.resources && node.resources.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] text-blue-200/80">
                {node.resources.map((resource, idx) => (
                  <li key={`${node.id}-resource-${idx}`} className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <span>{resource}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onUpdateStatus(node.id, node.status === 'completed' ? 'pending' : 'completed')}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-blue-400/70 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-100 transition hover:bg-blue-500/20"
              >
                Toggle Done
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(node.id, node.status === 'in-progress' ? 'pending' : 'in-progress')}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-indigo-400/70 bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-100 transition hover:bg-indigo-500/20"
              >
                Focus
              </button>
            </div>
          </div>
        )
      }
    }));
  }, [nodes, onUpdateStatus]);

  const flowEdges = useMemo(() => {
    if (flowNodes.length <= 1) {
      return [];
    }
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      style: { stroke: '#60a5fa' },
      labelStyle: { fill: '#bfdbfe', fontSize: 11 }
    }));
  }, [edges, flowNodes.length]);

  return (
    <div className={`rounded-2xl border border-blue-500/40 bg-slate-900/70 p-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-6' : ''}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Adaptive Plan</p>
          <h3 className="text-sm font-semibold text-blue-100">Visual roadmap for your study sprint</h3>
        </div>
        <div className="flex gap-2">
          {onNewPlan && (
            <button
              type="button"
              onClick={onNewPlan}
              disabled={isBusy}
              className="inline-flex items-center gap-1 rounded-lg border border-red-400/60 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              <Wand2 size={14} />
              New Plan
            </button>
          )}
          <button
            type="button"
            onClick={onAddStep}
            disabled={isBusy}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-400/60 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-50"
          >
            <PlusCircle size={14} />
            Add Milestone
          </button>
          <button
            type="button"
            onClick={onRunSimulation}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-400/60 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-100 transition hover:bg-indigo-500/20"
          >
            <Rocket size={14} />
            What-if Simulation
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="inline-flex items-center gap-1 rounded-lg border border-purple-400/60 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-purple-100 transition hover:bg-purple-500/20"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      <div className={`mt-4 rounded-xl border border-blue-500/30 bg-slate-950/70 ${isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-72'}`}>
        <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
          <Background gap={16} size={1} color="#1e293b" />
        </ReactFlow>
      </div>

      <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-900/20 p-3">
        <div className="flex items-center gap-2">
          <Wand2 size={18} className="text-indigo-300" />
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200">Scenario Forecasts</p>
        </div>
        {scenarios.length === 0 ? (
          <p className="mt-2 text-xs text-indigo-100/80">
            Launch the what-if simulator to compare alternate study routes before you commit.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {scenarios.map((scenario) => (
              <li
                key={scenario.id}
                className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2 text-xs text-indigo-100"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{scenario.title}</span>
                  <span className="text-[11px] text-indigo-200/80">
                    {new Date(scenario.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-indigo-100/80">{scenario.description}</p>
                <p className="mt-2 text-indigo-200/80">{scenario.impactSummary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PlanningMindMap;

