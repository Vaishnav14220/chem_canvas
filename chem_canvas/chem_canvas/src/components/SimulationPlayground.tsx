import React, { useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Play, Pause, RotateCcw, Settings2, Sparkles, Brain, Palette, Layout, Cpu, Layers, Send, Eye, Code2, FileCode, Loader2, Info, Upload, FileText, X, Gamepad2, Film, ChevronRight, MousePointer, Move3D, ZoomIn, RotateCw, Hand, ArrowLeft } from 'lucide-react';
import {
  runSimulationPipeline,
  subscribeToSimulationEvents,
  getSimulationArtifacts,
  type SimulationTaskEvent,
  type SimulationRequest,
  type SimulationOutput,
} from '../services/simulationAgentService';
import { View } from '../types/studium';
import { InteractiveCanvas } from './Studium/InteractiveCanvas';
import { ChatInterface } from './Studium/ChatInterface';
import { ImageAnalyzer } from './Studium/ImageAnalyzer';
import { BookOpen, MessageSquare, Image as ImageIcon } from 'lucide-react';

// Simulation tab type
type SimulationTab = 'tutorial' | 'interactive';

// ============================================
// CUSTOM NODE STYLES - React Flow Landing Style
// ============================================

// Agent Status Type
type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

// Agent Node Component - Represents each agent in the swarm
const AgentNode: React.FC<NodeProps> = ({ data, selected }) => {
  const statusColors: Record<AgentStatus, string> = {
    idle: 'bg-gray-100 border-gray-200',
    running: 'bg-blue-50 border-blue-300 animate-pulse',
    completed: 'bg-green-50 border-green-300',
    error: 'bg-red-50 border-red-300',
  };

  const statusDotColors: Record<AgentStatus, string> = {
    idle: 'bg-gray-400',
    running: 'bg-blue-500 animate-ping',
    completed: 'bg-green-500',
    error: 'bg-red-500',
  };

  const IconComponent = data.icon;
  const status: AgentStatus = data.status || 'idle';

  return (
    <div
      className={`rounded-2xl shadow-lg border-2 transition-all duration-300 ${statusColors[status]} ${selected ? 'ring-2 ring-pink-400 ring-offset-2' : ''
        }`}
      style={{ minWidth: 220, padding: '20px 24px' }}
    >
      {data.hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !shadow-md"
          style={{ left: -6 }}
        />
      )}

      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${data.iconBg || 'bg-gradient-to-br from-pink-500 to-purple-500'}`}>
          {IconComponent && <IconComponent className="w-6 h-6 text-white" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-800">{data.label}</h3>
            <div className={`w-2 h-2 rounded-full ${statusDotColors[status]}`} />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{data.role}</p>
        </div>
      </div>

      {data.message && (
        <div className="mt-3 px-3 py-2 bg-white/60 rounded-lg border border-white/40">
          <p className="text-xs text-gray-600 italic">{data.message}</p>
        </div>
      )}

      {data.hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !shadow-md"
          style={{ right: -6 }}
        />
      )}
    </div>
  );
};

// Input Node - Topic/Request Input
const TopicInputNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 ${selected ? 'border-pink-400 shadow-pink-100' : 'border-gray-100'
        }`}
      style={{ minWidth: 280, padding: '20px 24px' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Simulation Request</h3>
          <p className="text-xs text-gray-500">What do you want to visualize?</p>
        </div>
      </div>

      <textarea
        value={data.value || ''}
        onChange={(e) => data.onChange?.(e.target.value)}
        placeholder="e.g., Atomic orbital visualization, Chemical bonding animation..."
        className="w-full h-20 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-orange-400 !border-2 !border-white !shadow-md"
        style={{ right: -6 }}
      />
    </div>
  );
};

// Output Node - Final Simulation Preview
const SimulationOutputNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 ${selected ? 'border-pink-400 shadow-pink-100' : 'border-gray-100'
        }`}
      style={{ minWidth: 300, minHeight: 220, padding: '20px 24px' }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !shadow-md"
        style={{ left: -6 }}
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
          <Eye className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Simulation Output</h3>
          <p className="text-xs text-gray-500">Interactive 3D visualization</p>
        </div>
      </div>

      <div className="h-32 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center overflow-hidden relative">
        {data.status === 'ready' && data.htmlContent ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => data.onPreview?.()}
              className="px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-400 transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View Simulation
            </button>
          </div>
        ) : data.status === 'generating' ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
            <span className="text-xs text-gray-400">Generating...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <FileCode className="w-8 h-8 opacity-50" />
            <span className="text-xs">Awaiting generation</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Artifact Node - Shows generated artifacts
const ArtifactNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 ${selected ? 'border-pink-400 shadow-pink-100' : 'border-gray-100'
        }`}
      style={{ minWidth: 200, padding: '16px 20px' }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white !shadow-md"
        style={{ left: -5 }}
      />

      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.iconBg || 'bg-blue-100'}`}>
          <Code2 className={`w-4 h-4 ${data.iconColor || 'text-blue-600'}`} />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-700">{data.label}</h4>
          <p className="text-xs text-gray-400">{data.lines || 0} lines</p>
        </div>
      </div>

      {data.preview && (
        <div className="mt-2 p-2 bg-gray-50 rounded-lg">
          <code className="text-xs text-gray-600 line-clamp-2">{data.preview}</code>
        </div>
      )}
    </div>
  );
};

// Node Types Registration
const nodeTypes = {
  agent: AgentNode,
  topicInput: TopicInputNode,
  simulationOutput: SimulationOutputNode,
  artifact: ArtifactNode,
};

// Initial Agent Workflow Nodes
const createInitialNodes = (
  topic: string,
  onTopicChange: (value: string) => void,
  onPreview: () => void,
  outputStatus: 'idle' | 'generating' | 'ready',
  htmlContent: string | null,
  agentStatuses: Record<string, AgentStatus>,
  agentMessages: Record<string, string>
): Node[] => [
    // Input Node
    {
      id: 'input',
      type: 'topicInput',
      position: { x: 50, y: 200 },
      data: {
        value: topic,
        onChange: onTopicChange,
      },
    },
    // Architect Agent
    {
      id: 'architect',
      type: 'agent',
      position: { x: 400, y: 200 },
      data: {
        label: 'Architect',
        role: 'Project Manager & Domain Expert',
        icon: Brain,
        iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.architect || 'idle',
        message: agentMessages.architect,
      },
    },
    // Visualist Agent
    {
      id: 'visualist',
      type: 'agent',
      position: { x: 700, y: 80 },
      data: {
        label: 'Visualist',
        role: 'Three.js/WebGL Developer',
        icon: Palette,
        iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.visualist || 'idle',
        message: agentMessages.visualist,
      },
    },
    // Interface Designer Agent
    {
      id: 'interface',
      type: 'agent',
      position: { x: 700, y: 220 },
      data: {
        label: 'Interface Designer',
        role: 'UI/UX Specialist',
        icon: Layout,
        iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.interface || 'idle',
        message: agentMessages.interface,
      },
    },
    // Cognitive Engineer Agent
    {
      id: 'cognitive',
      type: 'agent',
      position: { x: 700, y: 360 },
      data: {
        label: 'Cognitive Engineer',
        role: 'Gemini API Integration',
        icon: Cpu,
        iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.cognitive || 'idle',
        message: agentMessages.cognitive,
      },
    },
    // Integrator Agent
    {
      id: 'integrator',
      type: 'agent',
      position: { x: 1000, y: 220 },
      data: {
        label: 'Integrator',
        role: 'Final Assembly Specialist',
        icon: Layers,
        iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.integrator || 'idle',
        message: agentMessages.integrator,
      },
    },
    // Output Node
    {
      id: 'output',
      type: 'simulationOutput',
      position: { x: 1300, y: 180 },
      data: {
        status: outputStatus,
        htmlContent,
        onPreview,
      },
    },
  ];

// Initial Edges - Agent Workflow Connections
const initialEdges: Edge[] = [
  // Input to Architect
  {
    id: 'e-input-architect',
    source: 'input',
    target: 'architect',
    animated: true,
    style: { stroke: '#a855f7', strokeWidth: 2 },
  },
  // Architect to parallel agents
  {
    id: 'e-architect-visualist',
    source: 'architect',
    target: 'visualist',
    style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
  },
  {
    id: 'e-architect-interface',
    source: 'architect',
    target: 'interface',
    style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
  },
  {
    id: 'e-architect-cognitive',
    source: 'architect',
    target: 'cognitive',
    style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
  },
  // Parallel agents to Integrator
  {
    id: 'e-visualist-integrator',
    source: 'visualist',
    target: 'integrator',
    style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
  },
  {
    id: 'e-interface-integrator',
    source: 'interface',
    target: 'integrator',
    style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
  },
  {
    id: 'e-cognitive-integrator',
    source: 'cognitive',
    target: 'integrator',
    style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
  },
  // Integrator to Output
  {
    id: 'e-integrator-output',
    source: 'integrator',
    target: 'output',
    animated: true,
    style: { stroke: '#22c55e', strokeWidth: 2 },
  },
];

interface SimulationPlaygroundProps {
  onClose?: () => void;
}

// Helper function to clean HTML content from markdown artifacts
const cleanHtmlContent = (html: string): string => {
  if (!html) return '';

  let cleaned = html
    // Remove markdown code fences
    .replace(/^```html?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .replace(/^```\s*\n?/i, '')
    .trim();

  // If content doesn't start with proper HTML, try to extract it
  if (!cleaned.toLowerCase().startsWith('<!doctype') && !cleaned.toLowerCase().startsWith('<html')) {
    const htmlMatch = cleaned.match(/<!DOCTYPE html>[\s\S]*<\/html>/i) ||
      cleaned.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch) {
      cleaned = htmlMatch[0];
    }
  }

  return cleaned;
};

// View mode type
type ViewMode = 'pipeline' | 'simulation' | 'split';

const SimulationPlayground: React.FC<SimulationPlaygroundProps> = ({ onClose }) => {
  // State
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputStatus, setOutputStatus] = useState<'idle' | 'generating' | 'ready'>('idle');
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [agentMessages, setAgentMessages] = useState<Record<string, string>>({});
  const [eventLog, setEventLog] = useState<SimulationTaskEvent[]>([]);

  // Studium State
  const [studiumView, setStudiumView] = useState<View | 'SIMULATION'>('SIMULATION');

  // PDF Upload State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulation interaction state
  const [simulationTab, setSimulationTab] = useState<SimulationTab>('tutorial');
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(true);
  const [showControlsPanel, setShowControlsPanel] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle PDF file selection
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setPdfFile(file);
    setIsPdfLoading(true);

    try {
      // Extract text from PDF using pdf.js
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import('pdfjs-dist');

      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }

      setPdfContent(fullText.trim());

      // Auto-suggest topic from PDF content if topic is empty
      if (!topic.trim() && fullText.length > 100) {
        // Extract first meaningful sentence or title
        const lines = fullText.split('\n').filter(l => l.trim().length > 10);
        if (lines.length > 0) {
          const suggestedTopic = lines[0].slice(0, 100).trim();
          setTopic(suggestedTopic);
        }
      }
    } catch (error) {
      console.error('Error extracting PDF content:', error);
      alert('Error reading PDF. Please try a different file.');
      setPdfFile(null);
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Remove uploaded PDF
  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Create nodes with current state
  const currentNodes = createInitialNodes(
    topic,
    setTopic,
    () => setViewMode('simulation'),
    outputStatus,
    htmlContent,
    agentStatuses,
    agentMessages
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(currentNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when state changes
  useEffect(() => {
    setNodes(createInitialNodes(
      topic,
      setTopic,
      () => setViewMode('simulation'),
      outputStatus,
      htmlContent,
      agentStatuses,
      agentMessages
    ));
  }, [topic, outputStatus, htmlContent, agentStatuses, agentMessages, setNodes]);

  // Subscribe to simulation events
  useEffect(() => {
    const unsubscribe = subscribeToSimulationEvents((event: SimulationTaskEvent) => {
      setEventLog(prev => [...prev, event]);

      // Map agent names to node IDs
      const agentNodeMap: Record<string, string> = {
        'Architect': 'architect',
        'Visualist': 'visualist',
        'InterfaceDesigner': 'interface',
        'CognitiveEngineer': 'cognitive',
        'Integrator': 'integrator',
        'Planner': 'architect',
        'Builder': 'integrator',
      };

      const nodeId = agentNodeMap[event.agentName];

      if (event.type === 'agent-start') {
        setAgentStatuses(prev => ({ ...prev, [nodeId]: 'running' }));
        setAgentMessages(prev => ({ ...prev, [nodeId]: 'Processing...' }));
      } else if (event.type === 'agent-complete') {
        setAgentStatuses(prev => ({ ...prev, [nodeId]: 'completed' }));
        setAgentMessages(prev => ({ ...prev, [nodeId]: 'Done ✓' }));
      } else if (event.type === 'agent-error') {
        setAgentStatuses(prev => ({ ...prev, [nodeId]: 'error' }));
        setAgentMessages(prev => ({ ...prev, [nodeId]: 'Error!' }));
      } else if (event.type === 'simulation-ready') {
        setOutputStatus('ready');
        if (event.data?.htmlContent) {
          setHtmlContent(event.data.htmlContent);
        }
      }
    });

    return unsubscribe;
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert('Please enter a simulation topic');
      return;
    }

    setIsGenerating(true);
    setOutputStatus('generating');
    setAgentStatuses({});
    setAgentMessages({});
    setEventLog([]);

    try {
      // Uses shared API key from Firebase automatically
      // Include PDF content if available for more precise simulation
      const result = await runSimulationPipeline({
        topic,
        style: 'interactive',
        complexity: 'medium',
        pdfContent: pdfContent || undefined,
        pdfFileName: pdfFile?.name,
      });

      setHtmlContent(result.htmlContent);
      setOutputStatus('ready');
    } catch (error) {
      console.error('Generation error:', error);
      setOutputStatus('idle');
      alert('Error generating simulation. Please ensure you are logged in and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = useCallback(() => {
    setTopic('');
    setOutputStatus('idle');
    setHtmlContent(null);
    setAgentStatuses({});
    setAgentMessages({});
    setEventLog([]);
    setIsGenerating(false);
    setPdfFile(null);
    setPdfContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div
      className="h-full w-full relative flex flex-col"
      style={{
        background: 'linear-gradient(135deg, #fdf2f8 0%, #f5f3ff 30%, #eff6ff 60%, #ffffff 100%)',
      }}
    >
      {/* Top Control Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/90 border-b border-gray-200 backdrop-blur-sm z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">Deep Agent Simulation</h2>
            <p className="text-xs text-gray-500">Powered by Gemini 3 Pro</p>
          </div>
        </div>

        {/* Studium Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setStudiumView('SIMULATION')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${studiumView === 'SIMULATION'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span className="flex items-center gap-1.5">
              <Brain className="w-4 h-4" />
              Simulation
            </span>
          </button>
          <button
            onClick={() => setStudiumView(View.GENERATOR)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${studiumView === View.GENERATOR
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              Lesson
            </span>
          </button>
          <button
            onClick={() => setStudiumView(View.CHAT)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${studiumView === View.CHAT
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              Tutor
            </span>
          </button>
          <button
            onClick={() => setStudiumView(View.ANALYZER)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${studiumView === View.ANALYZER
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" />
              Analyzer
            </span>
          </button>
        </div>

        {studiumView === 'SIMULATION' && (
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setViewMode('pipeline')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'pipeline'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  Pipeline
                </span>
              </button>
              <button
                onClick={() => setViewMode('simulation')}
                disabled={!htmlContent}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'simulation'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : htmlContent ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  Simulation
                </span>
              </button>
              <button
                onClick={() => setViewMode('split')}
                disabled={!htmlContent}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'split'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : htmlContent ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <Layout className="w-4 h-4" />
                  Split
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* PDF Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
                id="pdf-upload"
              />
              {pdfFile ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700 font-medium max-w-24 truncate" title={pdfFile.name}>
                    {pdfFile.name}
                  </span>
                  <button
                    onClick={handleRemovePdf}
                    className="p-0.5 hover:bg-green-100 rounded transition-colors"
                    title="Remove PDF"
                  >
                    <X className="w-3 h-3 text-green-600" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPdfLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-gray-600 shadow-md border border-gray-200 hover:bg-gray-50 hover:border-pink-300 transition-all text-sm"
                  title="Upload PDF for precise simulation"
                >
                  {isPdfLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">PDF</span>
                </button>
              )}

              {/* Topic Input (compact) */}
              <div className="relative">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={pdfFile ? "Topic from PDF..." : "Enter simulation topic..."}
                  className={`w-64 px-4 py-2 text-sm border rounded-xl focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 bg-white ${pdfFile ? 'border-green-200' : 'border-gray-200'
                    }`}
                />
                {pdfFile && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-white" title="Using PDF content" />
                )}
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim()}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl font-medium text-sm shadow-md transition-all ${isGenerating
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-400 hover:to-purple-400'
                  }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                className="p-2 rounded-xl bg-white text-gray-600 shadow-md border border-gray-200 hover:bg-gray-50 transition-all"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowModelInfo(true)}
                className="p-2 rounded-xl bg-white text-gray-600 shadow-md border border-gray-200 hover:bg-gray-50 transition-all"
                title="Model Information"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {studiumView === 'SIMULATION' ? (
        /* Original Simulation Content */
        <div className="flex-1 flex overflow-hidden">
          {/* Pipeline View */}
          {(viewMode === 'pipeline' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-1/3 border-r border-gray-200' : 'w-full'} h-full relative`}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
                maxZoom={1.5}
                defaultEdgeOptions={{
                  type: 'default',
                  style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
                }}
                connectionLineStyle={{
                  stroke: '#d1d5db',
                  strokeWidth: 1.5,
                  strokeDasharray: '5,5',
                }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={24}
                  size={1}
                  color="#e5e7eb"
                />
                {viewMode !== 'split' && (
                  <>
                    <Controls
                      className="!bg-white !border-gray-200 !shadow-lg !rounded-xl [&>button]:!bg-white [&>button]:!border-gray-200 [&>button]:!text-gray-600 [&>button:hover]:!bg-gray-50"
                    />
                    <MiniMap
                      nodeColor={(node) => {
                        if (node.type === 'agent') {
                          const status = node.data?.status as AgentStatus;
                          if (status === 'running') return '#3b82f6';
                          if (status === 'completed') return '#22c55e';
                          if (status === 'error') return '#ef4444';
                          return '#9ca3af';
                        }
                        if (node.type === 'topicInput') return '#f97316';
                        if (node.type === 'simulationOutput') return '#10b981';
                        return '#ff0071';
                      }}
                      maskColor="rgba(255, 255, 255, 0.8)"
                      className="!bg-white/80 !border-gray-200 !rounded-xl !shadow-lg"
                      style={{ width: 140, height: 90 }}
                    />
                  </>
                )}

                {/* Activity Log Panel */}
                <Panel position="bottom-right">
                  <div className="w-64 max-h-40 overflow-auto px-3 py-2 rounded-xl bg-white/95 border border-gray-100 shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`} />
                      <span className="text-xs font-semibold text-gray-600">Activity Log</span>
                    </div>
                    <div className="space-y-1">
                      {eventLog.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Enter a topic and click Generate...</p>
                      ) : (
                        eventLog.slice(-5).map((event, i) => (
                          <div key={i} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${event.status === 'completed' ? 'bg-green-500' :
                              event.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                              }`} />
                            <span className="line-clamp-2">{event.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Panel>

                {/* Agent Legend */}
                {viewMode !== 'split' && (
                  <Panel position="bottom-left">
                    <div className="px-4 py-3 rounded-xl bg-white/90 border border-gray-100 shadow-lg backdrop-blur-sm">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Agent Pipeline</p>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-gray-400" /> Idle
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Running
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500" /> Complete
                        </span>
                      </div>
                    </div>
                  </Panel>
                )}
              </ReactFlow>
            </div>
          )}

          {/* Simulation View */}
          {(viewMode === 'simulation' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-2/3' : 'w-full'} h-full flex flex-col bg-gray-900`}>
              {htmlContent ? (
                <>
                  {/* Simulation Header with Tabs */}
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center gap-4">
                      {/* Window controls */}
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                      </div>

                      {/* Tab Switcher */}
                      <div className="flex items-center gap-1 p-1 bg-gray-700/50 rounded-lg">
                        <button
                          onClick={() => setSimulationTab('tutorial')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${simulationTab === 'tutorial'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          Tutorial
                        </button>
                        <button
                          onClick={() => setSimulationTab('interactive')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${simulationTab === 'interactive'
                            ? 'bg-pink-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                          <Gamepad2 className="w-3.5 h-3.5" />
                          Interactive
                        </button>
                      </div>

                      <span className="text-sm text-gray-500">|</span>
                      <span className="text-sm text-gray-400">{topic}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowControlsPanel(!showControlsPanel)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${showControlsPanel
                          ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Controls
                      </button>
                      <button
                        onClick={() => {
                          const cleanedHtml = cleanHtmlContent(htmlContent);
                          const blob = new Blob([cleanedHtml], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${topic.replace(/\s+/g, '_')}_simulation.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs font-medium hover:bg-gray-600 transition-colors flex items-center gap-1.5"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        Download
                      </button>
                      <button
                        onClick={() => {
                          const cleanedHtml = cleanHtmlContent(htmlContent);
                          const blob = new Blob([cleanedHtml], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-pink-600 text-white text-xs font-medium hover:bg-pink-500 transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Fullscreen
                      </button>
                    </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1 flex overflow-hidden">
                    {/* Simulation iframe */}
                    <div className={`flex-1 overflow-hidden relative ${simulationTab === 'tutorial' ? '' : ''}`}>
                      <iframe
                        ref={iframeRef}
                        srcDoc={cleanHtmlContent(htmlContent)}
                        className="w-full h-full border-0"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                        allow="accelerometer; autoplay; camera; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; xr-spatial-tracking"
                        title="3D Simulation"
                      />

                      {/* Tutorial Overlay */}
                      {simulationTab === 'tutorial' && (
                        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
                          <div className="bg-black/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-700 pointer-events-auto">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Film className="w-5 h-5 text-purple-400" />
                                <span className="text-sm font-medium text-white">Understanding the Simulation</span>
                              </div>
                              <button
                                onClick={() => setSimulationTab('interactive')}
                                className="flex items-center gap-1 px-3 py-1 bg-pink-600 text-white text-xs font-medium rounded-lg hover:bg-pink-500 transition-colors"
                              >
                                Try it yourself
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-300 mb-3">
                              Watch how the simulation works. The 3D model demonstrates the key concepts of <span className="text-pink-400 font-medium">{topic}</span>.
                              Pay attention to the animations and interactions shown.
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span>Animation playing</span>
                              </div>
                              <span>•</span>
                              <span>Click "Interactive" tab to control the simulation yourself</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Controls Panel (Side Panel) */}
                    {showControlsPanel && simulationTab === 'interactive' && (
                      <div className="w-72 bg-gray-800 border-l border-gray-700 overflow-y-auto">
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-4">
                            <Gamepad2 className="w-5 h-5 text-pink-400" />
                            <h3 className="text-sm font-semibold text-white">Simulation Controls</h3>
                          </div>

                          {/* Mouse Controls */}
                          <div className="mb-5">
                            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Mouse Controls</h4>
                            <div className="space-y-2">
                              <div className="flex items-start gap-3 p-2 bg-gray-700/50 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                                  <RotateCw className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-white">Left Click + Drag</p>
                                  <p className="text-xs text-gray-400">Rotate the 3D view</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-2 bg-gray-700/50 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                                  <Move3D className="w-4 h-4 text-green-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-white">Right Click + Drag</p>
                                  <p className="text-xs text-gray-400">Pan the camera</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-2 bg-gray-700/50 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                                  <ZoomIn className="w-4 h-4 text-yellow-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-white">Scroll Wheel</p>
                                  <p className="text-xs text-gray-400">Zoom in/out</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-2 bg-gray-700/50 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                                  <MousePointer className="w-4 h-4 text-pink-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-white">Hover on Objects</p>
                                  <p className="text-xs text-gray-400">See component info</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Keyboard Shortcuts */}
                          <div className="mb-5">
                            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Keyboard Shortcuts</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                                <span className="text-xs text-gray-300">Play/Pause</span>
                                <kbd className="px-2 py-0.5 bg-gray-600 text-gray-200 text-xs rounded font-mono">Space</kbd>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                                <span className="text-xs text-gray-300">Reset View</span>
                                <kbd className="px-2 py-0.5 bg-gray-600 text-gray-200 text-xs rounded font-mono">R</kbd>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                                <span className="text-xs text-gray-300">Zoom In</span>
                                <kbd className="px-2 py-0.5 bg-gray-600 text-gray-200 text-xs rounded font-mono">+</kbd>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                                <span className="text-xs text-gray-300">Zoom Out</span>
                                <kbd className="px-2 py-0.5 bg-gray-600 text-gray-200 text-xs rounded font-mono">-</kbd>
                              </div>
                            </div>
                          </div>

                          {/* In-Simulation Controls */}
                          <div className="mb-5">
                            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">In-Simulation Controls</h4>
                            <p className="text-xs text-gray-400 mb-3">
                              The simulation has built-in controls at the bottom:
                            </p>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-gray-300">
                                <Play className="w-3.5 h-3.5 text-green-400" />
                                <span>Play/Pause animation</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-300">
                                <Settings2 className="w-3.5 h-3.5 text-blue-400" />
                                <span>Adjust animation speed</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-300">
                                <RotateCcw className="w-3.5 h-3.5 text-yellow-400" />
                                <span>Reset camera view</span>
                              </div>
                            </div>
                          </div>

                          {/* AI Features */}
                          <div className="p-3 bg-gradient-to-br from-pink-600/20 to-purple-600/20 rounded-xl border border-pink-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-4 h-4 text-pink-400" />
                              <span className="text-xs font-medium text-white">AI Features</span>
                            </div>
                            <p className="text-xs text-gray-300 mb-2">
                              Click objects in the simulation to get AI-powered explanations:
                            </p>
                            <div className="space-y-1.5 text-xs text-gray-400">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <span>Clinical Insights</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                <span>ELI5 (Simple explanation)</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                <span>Narrate (Audio explanation)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <FileCode className="w-16 h-16 mb-4 opacity-30" />
                  <h3 className="text-lg font-medium text-gray-400 mb-2">No Simulation Yet</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-md text-center">
                    Enter a topic (e.g., "DNA double helix", "Water molecule structure") and click Generate to create an interactive 3D simulation.
                  </p>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl border border-gray-700 mb-6">
                    <Upload className="w-4 h-4 text-pink-400" />
                    <span className="text-xs text-gray-400">
                      <span className="text-pink-400 font-medium">Pro tip:</span> Upload a PDF for more precise, document-based simulations
                    </span>
                  </div>
                  {isGenerating && (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
                      <span className="text-sm text-gray-400">
                        {pdfFile ? 'Analyzing PDF and generating simulation...' : 'Generating your simulation...'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Studium Content */
        <div className="flex-1 p-6 overflow-hidden bg-slate-50 flex flex-col">
          <div className="max-w-7xl mx-auto h-full w-full flex flex-col">
            <div className="mb-4">
              <button
                onClick={() => setStudiumView('SIMULATION')}
                className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Simulation
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {studiumView === View.GENERATOR && <InteractiveCanvas />}
              {studiumView === View.CHAT && <ChatInterface />}
              {studiumView === View.ANALYZER && <ImageAnalyzer />}
            </div>
          </div>
        </div>
      )}

      {/* Model Info Modal */}
      {
        showModelInfo && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-[24rem] shadow-2xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">🤖 AI Model</h3>
              <p className="text-sm text-gray-500 mb-4">
                This simulation system uses Google's Gemini 3 Pro model for generating interactive 3D educational content.
              </p>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100">
                  <Sparkles className="w-5 h-5 text-pink-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Gemini 3 Pro</p>
                    <p className="text-xs text-gray-500">Google's latest AI model</p>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-600 mb-2 font-medium">Features:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Modern Academic light mode UI</li>
                    <li>• Glassmorphism info panels</li>
                    <li>• Interactive 3D controls</li>
                    <li>• Raycasting hover effects</li>
                    <li>• AI-powered explanations</li>
                  </ul>
                </div>
              </div>
              <button
                onClick={() => setShowModelInfo(false)}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium text-sm hover:from-pink-400 hover:to-purple-400 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default SimulationPlayground;
