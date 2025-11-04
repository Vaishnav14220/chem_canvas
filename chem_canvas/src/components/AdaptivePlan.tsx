import { useState, useCallback, useMemo, useRef } from 'react';
import ReactFlow, { Background, BackgroundVariant, Controls, MiniMap, Edge, ReactFlowInstance, Node as FlowNode } from 'reactflow';
import 'reactflow/dist/style.css';
import { Wand2, Maximize2, Minimize2, Loader2, Target } from 'lucide-react';
import { generateTextContent } from '../services/geminiService';
import useMindMapStore from './mindMapStore';
import AnnotationNode from './AnnotationNode';
import MilestoneNode from './MilestoneNode';
import ButtonEdge from './ButtonEdge';
import type { PlanNode, PlanEdge } from '../types/srlCoach';

interface AdaptivePlanProps {
  onPlanGenerated?: (nodes: PlanNode[], edges: PlanEdge[]) => void;
  initialTopic?: string;
  onClose?: () => void;
}

interface LearningMilestone {
  id: string;
  title: string;
  description: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tools: string[];
  prerequisites: string[];
  learningObjectives: string[];
  resources: string[];
  status: 'pending' | 'in-progress' | 'completed';
}

const AdaptivePlan: React.FC<AdaptivePlanProps> = ({ onPlanGenerated, initialTopic = '' }) => {
  const [topic, setTopic] = useState(initialTopic);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [milestones, setMilestones] = useState<LearningMilestone[]>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const defaultFlowRef = useRef<ReactFlowInstance | null>(null);
  const fullscreenFlowRef = useRef<ReactFlowInstance | null>(null);

  // Use mind map store
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    setEdges
  } = useMindMapStore();

  const syncFlow = useCallback(
    (
      milestonesData: LearningMilestone[],
      options: { shouldFitView?: boolean } = {}
    ) => {
      const { shouldFitView = false } = options;

      const graphNodes: FlowNode[] = [];
      const graphEdges: Edge[] = [];

      graphNodes.push({
        id: 'root',
        type: 'annotation',
        position: { x: 0, y: -240 },
        data: { label: `Learning Plan: ${topic || 'Untitled Topic'}`, level: 1 }
      });

      const horizontalSpacing = 360;
      const baseY = 120;
      let previousNodeId = 'root';

      milestonesData.forEach((milestone, index) => {
        const nodeId = `milestone-${index + 1}`;
        const offset = index - (milestonesData.length - 1) / 2;

        graphNodes.push({
          id: nodeId,
          type: 'milestoneNode',
          position: { x: offset * horizontalSpacing, y: baseY },
          data: {
            milestone,
            index: index + 1,
            onUpdate: (updatedMilestone: LearningMilestone) => {
              setMilestones(prev => {
                const next = prev.map(item =>
                  item.id === updatedMilestone.id ? { ...updatedMilestone } : item
                );
                syncFlow(next);
                return next;
              });
            },
            onRemove: () => {
              setMilestones(prev => {
                const next = prev.filter(item => item.id !== milestone.id);
                syncFlow(next, { shouldFitView: true });
                return next;
              });
            }
          }
        });

        graphEdges.push({
          id: `edge-${previousNodeId}-${nodeId}`,
          source: previousNodeId,
          target: nodeId,
          type: 'button'
        });

        previousNodeId = nodeId;
      });

      setNodes(graphNodes);
      setEdges(graphEdges);

      if (shouldFitView) {
        setTimeout(() => {
          reactFlowInstance?.fitView({ padding: 0.25, duration: 400 });
        }, 0);
      }
    },
    [setNodes, setEdges, setMilestones, topic, reactFlowInstance]
  );

  const generateAdaptivePlan = useCallback(async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    try {
      const prompt = `Create a comprehensive, adaptive learning roadmap for the topic: "${topic}"

Please generate a structured learning plan in JSON format with the following requirements:

1. Break down the topic into 8-12 logical milestones with clear progression
2. Each milestone should have:
   - A clear, actionable title (keep under 50 characters)
   - Detailed description of what will be learned (2-3 sentences)
   - Estimated duration in minutes (20-45 minutes each)
   - Difficulty level (beginner/intermediate/advanced) - distribute evenly
   - Recommended ChemCanvas tools (choose from: MolView, NMR viewer, Canvas drawing, Periodic table, Calculator, 3D viewer)
   - Prerequisites from previous milestones
   - Specific learning objectives (3-5 per milestone, keep concise)
   - Recommended resources or activities

3. Ensure logical progression: 3-4 beginner, 3-4 intermediate, 2-4 advanced milestones
4. Include practical, hands-on activities with ChemCanvas tools
5. Consider common stumbling points and provide guidance
6. Make it chemistry-focused with appropriate tools and real-world applications

Return ONLY valid JSON in this exact format:
{
  "milestones": [
    {
      "id": "milestone-1",
      "title": "Foundational Concepts",
      "description": "Understanding the basic principles and terminology related to the topic",
      "duration": 25,
      "difficulty": "beginner",
      "tools": ["Canvas drawing", "MolView"],
      "prerequisites": [],
      "learningObjectives": [
        "Identify key terminology",
        "Understand basic relationships",
        "Recognize common patterns"
      ],
      "resources": [
        "Interactive molecule viewer",
        "Basic concept flashcards"
      ]
    }
  ]
}`;

      const response = await generateTextContent(prompt);

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI');
      }

      const planData = JSON.parse(jsonMatch[0]);
      const milestones: LearningMilestone[] = planData.milestones.map((m: any) => ({
        ...m,
        status: 'pending' as const
      }));

      setMilestones(milestones);
      syncFlow(milestones, { shouldFitView: true });

      // Convert to PlanNode format for parent component
      const planNodes: PlanNode[] = milestones.map(milestone => ({
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        status: 'pending',
        durationMinutes: milestone.duration,
        toolId: milestone.tools[0] || 'custom',
        resources: milestone.resources
      }));

      const planEdges: PlanEdge[] = [];
      let previousNodeRef = 'root';
      milestones.forEach((_, index) => {
        const nodeId = `milestone-${index + 1}`;
        planEdges.push({
          id: `edge-${previousNodeRef}-${nodeId}`,
          source: previousNodeRef,
          target: nodeId,
          label: 'next step'
        });
        previousNodeRef = nodeId;
      });

      onPlanGenerated?.(planNodes, planEdges);

    } catch (error) {
      console.error('Error generating adaptive plan:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [topic, setMilestones, syncFlow, onPlanGenerated]);

  const nodeTypes = useMemo(() => ({
    annotation: AnnotationNode,
    milestoneNode: MilestoneNode
  }), []);

  const edgeTypes = useMemo(() => ({
    button: ButtonEdge
  }), []);

  return (
    <>
      {/* Main Component */}
      <div className="relative w-full h-96 rounded-xl overflow-hidden border border-slate-800 bg-[#090f1d] shadow-lg">
        {/* Minimal Header */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 text-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Adaptive Learning Plan</h2>
              <p className="text-sm text-slate-400">AI-guided roadmap</p>
            </div>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-md"
              title={isFullscreen ? "Exit Fullscreen" : "Open Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>

          {/* Topic Input */}
          <div className="mt-3 flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                const value = e.target.value;
                setTopic(value);
                if (milestones.length > 0) {
                  syncFlow(milestones);
                }
              }}
              placeholder="Enter learning topic..."
              className="flex-1 px-3 py-2 border border-slate-700 rounded-md text-sm text-slate-100 placeholder-slate-500 bg-slate-900/70 focus:outline-none focus:ring-2 focus:ring-blue-500/80 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && generateAdaptivePlan()}
            />
            <button
              onClick={generateAdaptivePlan}
              disabled={isGenerating || !topic.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600/60 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate
                </>  
              )}
            </button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="w-full h-full pt-0 relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(96,165,250,0.24),rgba(9,15,29,0)_65%),radial-gradient(circle_at_85%_75%,rgba(244,114,182,0.18),rgba(9,15,29,0)_70%),radial-gradient(circle_at_60%_30%,rgba(251,191,36,0.12),rgba(9,15,29,0)_72%)]" />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            className="relative z-10 bg-transparent"
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            panOnDrag={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            panOnScroll={false}
            selectionKeyCode="Shift"
            minZoom={0.4}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            onInit={(instance) => {
              defaultFlowRef.current = instance;
              setReactFlowInstance(instance);
              setZoomLevel(Number(instance.getZoom().toFixed(2)));
            }}
            onMoveEnd={(_, viewport) => setZoomLevel(Number(viewport.zoom.toFixed(2)))}
          >
            <Background
              id="adaptive-plan-background"
              color="rgba(148,163,184,0.25)"
              gap={28}
              size={1.2}
              variant={BackgroundVariant.Dots}
            />
            <Controls
              className="bg-slate-900/90 border border-slate-700 text-slate-200 shadow-md"
              showZoom={true}
              showFitView={true}
              showInteractive={false}
            />
            <MiniMap
              className="bg-slate-900/90 border border-slate-700 text-slate-200"
              nodeColor="#fb7185"
              maskColor="rgba(9,15,29,0.78)"
            />
          </ReactFlow>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="absolute inset-4 bg-[#090f1d] rounded-xl overflow-hidden shadow-2xl border border-slate-800">
            <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 text-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Adaptive Learning Plan</h2>
                  <p className="text-sm text-slate-400">Fullscreen view</p>
                </div>
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-md"
                >
                  <Minimize2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="w-full h-full pt-0 relative" style={{ height: 'calc(100vh - 120px)' }}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(96,165,250,0.24),rgba(9,15,29,0)_65%),radial-gradient(circle_at_85%_75%,rgba(244,114,182,0.18),rgba(9,15,29,0)_70%),radial-gradient(circle_at_60%_30%,rgba(251,191,36,0.12),rgba(9,15,29,0)_72%)]" />
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                className="relative z-10 bg-transparent"
                nodesDraggable={true}
                nodesConnectable={true}
                elementsSelectable={true}
                panOnDrag={true}
                zoomOnScroll={true}
                zoomOnPinch={true}
                panOnScroll={false}
                selectionKeyCode="Shift"
                minZoom={0.4}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
                onInit={(instance) => {
                  fullscreenFlowRef.current = instance;
                  setReactFlowInstance(instance);
                  setZoomLevel(Number(instance.getZoom().toFixed(2)));
                }}
                onMoveEnd={(_, viewport) => setZoomLevel(Number(viewport.zoom.toFixed(2)))}
              >
                <Background
                  id="fullscreen-adaptive-plan-background"
                  color="rgba(148,163,184,0.25)"
                  gap={28}
                  size={1.2}
                  variant={BackgroundVariant.Dots}
                />
                <Controls
                  className="bg-slate-900/90 border border-slate-700 text-slate-200 shadow-md"
                  showZoom={true}
                  showFitView={true}
                  showInteractive={false}
                />
                <MiniMap
                  className="bg-slate-900/90 border border-slate-700 text-slate-200"
                  nodeColor="#fb7185"
                  maskColor="rgba(9,15,29,0.78)"
                />
              </ReactFlow>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {nodes.length === 0 && !isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/40 mx-auto mb-4">
              <Target className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Create Your Learning Journey</h3>
            <p className="text-slate-400 mb-6 max-w-md">
              Enter a topic above and let AI generate a personalized, adaptive learning roadmap
              with milestones, tools, and resources tailored to your chemistry studies.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default AdaptivePlan;