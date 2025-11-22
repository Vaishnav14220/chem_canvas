// @ts-nocheck
import { useRef, useEffect, useState, useMemo, useCallback, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { MouseEvent as ReactMouseEvent, DragEvent as ReactDragEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ZoomIn, ZoomOut, Grid3x3, RotateCcw, CheckCircle, AlertCircle, Loader2, Trash2, Brain, Sparkles, Atom, Beaker, Moon, Sun, FlaskConical, Gem, Scan, ExternalLink, Database, FileText, Upload, X, Smartphone, Move, ListOrdered, Minimize2, Maximize2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { analyzeCanvasWithLLM, getStoredAPIKey, analyzeTextContent, extractDrawnText, type Correction, type CanvasAnalysisResult } from '../services/canvasAnalyzer';
import { convertCanvasToChemistry } from '../services/chemistryConverter';
import MineralSearch from './MineralSearch';
import MineralCrystalPreview from './MineralCrystalPreview';
import ProteinSearch from './ProteinSearch';
import ProteinCanvasViewer from './ProteinCanvasViewer';
import { type MoleculeData, type CrystalVisualData, parseSDF, type ParsedSDF, getMolViewUrl, getMolViewUrlFromSmiles, getMoleculeByCID, getMoleculeBySmiles, getMoleculeByName } from '../services/pubchemService';
import { buildCrystalVisualFromCif } from '../services/mineralService';
import { type PDBProteinData, fetchPDBStructure } from '../services/pdbService';
import { reactionSmilesToSVGHuggingFace } from '../services/rdkitService';
import { sanitizeReactionSmilesInput, stripAtomMappings } from '../utils/reactionSanitizer';
import type { StructuredReactionPayload } from '../services/structuredReactionService';
import type { ReactionComponentDetails } from '../services/reactionResolver';
import ChemistryToolbar from './ChemistryToolbar';
import ChemistryStructureViewer from './ChemistryStructureViewer';
import InlineMoleculeSearch from './InlineMoleculeSearch';
import InlineReactionSearch, { type ReactionSearchResult } from './InlineReactionSearch';
import PDBViewerEmbed from './PDBViewerEmbed';
import ChemistryWidgetPanel from './ChemistryWidgetPanel';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import { createTwoFilesPatch } from 'diff';
import 'react-diff-view/style/index.css';
import ReactFlow, {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  ReactFlowInstance
} from 'reactflow';
import type { Node, Edge, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { MessageSquare, FileText as FileTextIcon, Table, Image as ImageIcon, Video as VideoIcon, Mic, Globe, Binary } from 'lucide-react';
import {
  extractTextFromDocument,
  isAudioFile,
  isPdfFile,
  isSpreadsheetDocument,
  isSupportedTextDocument,
  isVideoFile,
  SheetPreview
} from '../utils/documentTextExtractor';

const MIN_TOOLBAR_WIDTH = 280;
const MAX_TOOLBAR_WIDTH = 480;
const DEFAULT_MOLECULE_3D_ROTATION = { x: -25, y: 35 } as const;
const DEFAULT_PDF_WIDTH = 520;
const DEFAULT_PDF_HEIGHT = 640;
const MIN_PDF_WIDTH = 320;
const MAX_PDF_WIDTH = 1400;
const MIN_PDF_HEIGHT = 320;
const MAX_PDF_HEIGHT = 2000;
const MARKDOWN_MIN_WIDTH = 320;
const MARKDOWN_MAX_WIDTH = 720;
const MARKDOWN_MIN_HEIGHT = 220;
const MARKDOWN_MAX_HEIGHT = 840;
const DEFAULT_PDB_DOWNLOAD_URL = 'https://files.rcsb.org/download';
const DEFAULT_PDB_ENTRY_FILES_URL = 'https://www.ebi.ac.uk/pdbe/entry-files';
const ATOM_COLORS: Record<string, string> = {
  C: '#e2e8f0',
  H: '#94a3b8',
  N: '#38bdf8',
  O: '#f87171',
  S: '#facc15',
  P: '#a855f7',
  Cl: '#34d399',
  Br: '#f472b6',
  F: '#22d3ee',
  I: '#a78bfa'
};

type QuickActionButton = {
  id: string;
  label: string;
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  badgeClass: string;
  active?: boolean;
  activeClass?: string;
  disabled?: boolean;
};

const DEFAULT_ANNOTATION_LABELS = [
  'Active center',
  'Leaving group',
  'Nucleophilic center',
  'Electrophilic center',
  'Transition state',
  'Intermediate',
  'Catalyst'
];

interface MoleculeAnnotation {
  id: string;
  atomIndex: number;
  label: string;
  color: string;
}

interface ReactionMetadata {
  originalQuery?: string;
  usedGemini?: boolean;
  components?: ReactionComponentDetails[];
  confidence?: number;
  notes?: string;
}

interface MarkdownEntry {
  id: string;
  title: string;
  steps: string[];
  createdAt: number;
}

export interface CanvasMoleculePlacementRequest {
  name?: string;
  smiles?: string;
  cid?: number | string;
  displayLabel?: string;
  role?: string;
  notes?: string;
}

export interface CanvasProteinPlacementRequest {
  entryId: string;
  title?: string;
  description?: string;
  organism?: string;
  method?: string;
  depositionDate?: string;
  displayName?: string;
}

export interface CanvasReactionPlacementRequest {
  reactionSmiles: string;
  title?: string;
  description?: string;
  includeSdf?: boolean;
}

export interface CanvasConceptImagePayload {
  url: string;
  title: string;
  concept?: string;
  topic?: string;
  prompt?: string;
  alt?: string;
}

export interface CanvasReactionPlacementRequest {
  reactionSmiles: string;
  title?: string;
  description?: string;
  includeSdf?: boolean;
  metadata?: ReactionMetadata;
}

export type CanvasMoleculeInsertionHandler = (request: CanvasMoleculePlacementRequest) => Promise<boolean> | boolean;
export type CanvasProteinInsertionHandler = (request: CanvasProteinPlacementRequest) => Promise<boolean> | boolean;
export type CanvasReactionInsertionHandler = (request: CanvasReactionPlacementRequest) => Promise<boolean> | boolean;

type DroppedDocumentType = 'pdf' | 'text' | 'image' | 'audio' | 'video' | 'spreadsheet';

interface CanvasDroppedDocument {
  id: string;
  name: string;
  type: DroppedDocumentType;
  content: string;
  preview?: string;
  viewerUrl?: string;
  sheetPreviews?: SheetPreview[];
  position: {
    x: number;
    y: number;
  };
  viewportWidth?: number;
  viewportHeight?: number;
  size: number;
  createdAt: number;
}

const connectorBaseStyle = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(244,114,182,0.95) 0%, rgba(15,23,42,1) 60%)',
  border: '3px solid rgba(244,114,182,0.9)',
  boxShadow: '0 0 20px rgba(244,114,182,0.8), 0 0 40px rgba(244,114,182,0.4)',
  zIndex: 10,
  cursor: 'crosshair',
};

const connectorBaseStyleOutput = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(59,130,246,0.95) 0%, rgba(15,23,42,1) 60%)',
  border: '3px solid rgba(59,130,246,0.9)',
  boxShadow: '0 0 20px rgba(59,130,246,0.8), 0 0 40px rgba(59,130,246,0.4)',
  zIndex: 10,
  cursor: 'crosshair',
};

const nodeHandleStyleLeft = {
  ...connectorBaseStyle,
  left: -14,
  top: '50%',
  transform: 'translate(-100%, -50%)',
};

const nodeHandleStyleRight = {
  ...connectorBaseStyleOutput,
  right: -14,
  left: 'auto',
  top: '50%',
  transform: 'translate(100%, -50%)',
};

const FlowResourceNode = ({ data, id }: any) => {
  const [docInput, setDocInput] = useState(data.input ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState(data.url ?? '');
  const isFileBased = ['pdf', 'doc', 'spreadsheet', 'csv'].includes(data.kind);
  const isUrlBased = ['url'].includes(data.kind);

  useEffect(() => {
    setDocInput(data.input ?? '');
    setUrl(data.url ?? '');
  }, [data]);

  return (
    <div className="min-w-[240px] rounded-3xl border border-slate-600/60 bg-gradient-to-br from-[#111836] via-[#0f172a] to-[#09111f] px-4 py-3 shadow-[0_10px_35px_rgba(15,23,42,0.7)] text-slate-100 space-y-3">
      <Handle style={nodeHandleStyleLeft} type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold truncate">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-slate-800/70 text-fuchsia-200">
            {data.icon ?? <FileTextIcon size={14} />}
          </span>
          {data.label}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-fuchsia-200/80">{data.kind?.toUpperCase()}</span>
      </div>
      <p className="text-[11px] text-slate-300">{data.description}</p>
      {!isFileBased && !isUrlBased && (
        <textarea
          value={docInput}
          onChange={(e) => setDocInput(e.target.value)}
          placeholder="Paste text or instructions…"
          className="w-full min-h-[72px] rounded-xl border border-slate-700 bg-slate-900/50 px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
        />
      )}
      {isUrlBased && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://resource"
          className="w-full rounded-xl border border-slate-700 bg-slate-900/50 px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
        />
      )}
      {isFileBased && (
        <label className="flex flex-col gap-1 rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-200 cursor-pointer hover:border-fuchsia-400">
          Upload file
          <input
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <span className="text-[10px] text-slate-400">{file.name}</span>
          ) : (
            <span className="text-[10px] text-slate-500">Drop or select a file</span>
          )}
        </label>
      )}
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>Node ID: {id}</span>
        <button className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800">
          View
        </button>
      </div>
      <div className="text-[10px] italic text-slate-500 flex items-center gap-1">
        <span className="inline-flex h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(244,114,182,0.9)]" />
        Drag from the glowing dot to connect this block.
      </div>
      <Handle style={nodeHandleStyleRight} type="source" position={Position.Right} />
    </div>
  );
};

const FlowNoteNode = ({ data }: any) => (
  <div className="min-w-[220px] rounded-3xl border border-purple-500/40 bg-gradient-to-br from-purple-950/80 via-[#1c0f33]/80 to-purple-900/40 px-4 py-3 text-xs text-purple-100 shadow-lg space-y-2">
    <Handle
      style={nodeHandleStyleLeft}
      type="target"
      position={Position.Left}
    />
    <div className="font-semibold text-sm flex items-center gap-2">
      <MessageSquare size={14} />
      {data.label || 'Notes Block'}
    </div>
    <p className="mt-1 text-[11px] text-purple-50/80">
      {data.description || 'Use this to add manual reasoning or prompts before executing the flow.'}
    </p>
    <Handle
      style={nodeHandleStyleRight}
      type="source"
      position={Position.Right}
    />
  </div>
);

const FlowOutputNode = ({ data }: any) => (
  <div className="min-w-[240px] rounded-3xl border border-emerald-500/50 bg-gradient-to-br from-emerald-950/80 to-emerald-900/40 px-4 py-3 text-xs text-emerald-50 shadow-lg space-y-2">
    <Handle
      style={nodeHandleStyleLeft}
      type="target"
      position={Position.Left}
    />
    <div className="font-semibold text-sm">{data.label || 'Final Output'}</div>
    <p className="mt-1 text-[11px] text-emerald-50/80">
      {data.description || 'Connect your sources to define what the assistant should produce.'}
    </p>
    <Handle style={nodeHandleStyleRight} type="source" position={Position.Right} />
  </div>
);

const resourceIconMap: Record<string, ReactNode> = {
  pdf: <FileTextIcon size={14} />,
  doc: <FileTextIcon size={14} />,
  text: <FileTextIcon size={14} />,
  spreadsheet: <Table size={14} />,
  image: <ImageIcon size={14} />,
  video: <VideoIcon size={14} />,
  audio: <Mic size={14} />,
  url: <Globe size={14} />,
  csv: <Binary size={14} />,
  default: <FileTextIcon size={14} />
};

const getResourceIcon = (kind: string) => resourceIconMap[kind] ?? resourceIconMap.default;

const mapDocumentTypeToResourceKind = (docType: DroppedDocumentType): string => {
  switch (docType) {
    case 'pdf':
      return 'pdf';
    case 'image':
      return 'image';
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
    case 'spreadsheet':
      return 'spreadsheet';
    default:
      return 'doc';
  }
};

// Custom node components for different types
const FlowInputTextNode = ({ data, id }: any) => {
  const [value, setValue] = useState(data.value || '');

  return (
    <div className="min-w-[200px] rounded-2xl border border-blue-500/40 bg-blue-900/30 px-4 py-3 shadow-lg">
      <Handle
        style={nodeHandleStyleLeft}
        type="target"
        position={Position.Left}
      />
      <div className="text-sm font-semibold text-blue-200 mb-2">{data.label}</div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter text here..."
        className="w-full h-20 bg-slate-800/50 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-400 resize-none"
      />
      <Handle
        style={nodeHandleStyleRight}
        type="source"
        position={Position.Right}
      />
    </div>
  );
};

const FlowInputFileNode = ({ data, id }: any) => {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
  };

  return (
    <div className="min-w-[200px] rounded-2xl border border-green-500/40 bg-green-900/30 px-4 py-3 shadow-lg">
      <Handle
        style={nodeHandleStyleLeft}
        type="target"
        position={Position.Left}
      />
      <div className="text-sm font-semibold text-green-200 mb-2">{data.label}</div>
      <div className="space-y-2">
        <input
          type="file"
          onChange={handleFileChange}
          className="w-full text-xs text-green-100 file:bg-green-700 file:text-green-100 file:border-0 file:rounded file:px-2 file:py-1 file:mr-2"
          accept=".pdf,.doc,.docx,.txt,.csv"
        />
        {file && (
          <div className="text-xs text-green-300">
            Selected: {file.name}
          </div>
        )}
      </div>
      <Handle
        style={nodeHandleStyleRight}
        type="source"
        position={Position.Right}
      />
    </div>
  );
};

const FlowInputUrlNode = ({ data, id }: any) => {
  const [value, setValue] = useState(data.value || '');

  return (
    <div className="min-w-[200px] rounded-2xl border border-purple-500/40 bg-purple-900/30 px-4 py-3 shadow-lg">
      <Handle
        style={nodeHandleStyleLeft}
        type="target"
        position={Position.Left}
      />
      <div className="text-sm font-semibold text-purple-200 mb-2">{data.label}</div>
      <input
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://example.com"
        className="w-full bg-slate-800/50 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-400"
      />
      <Handle
        style={nodeHandleStyleRight}
        type="source"
        position={Position.Right}
      />
    </div>
  );
};

const FlowProcessAiNode = ({ data, id }: any) => (
  <div className="min-w-[200px] rounded-2xl border border-orange-500/40 bg-orange-900/30 px-4 py-3 shadow-lg">
    <Handle
      style={nodeHandleStyleLeft}
      type="target"
      position={Position.Left}
    />
    <div className="text-sm font-semibold text-orange-200 mb-2">{data.label}</div>
    <div className="text-xs text-orange-300">
      Analyzes input with Gemini AI
    </div>
    <Handle
      style={nodeHandleStyleRight}
      type="source"
      position={Position.Right}
    />
  </div>
);

const FlowProcessChemistryNode = ({ data, id }: any) => (
  <div className="min-w-[200px] rounded-2xl border border-cyan-500/40 bg-cyan-900/30 px-4 py-3 shadow-lg">
    <Handle
      style={nodeHandleStyleLeft}
      type="target"
      position={Position.Left}
    />
    <div className="text-sm font-semibold text-cyan-200 mb-2">{data.label}</div>
    <div className="text-xs text-cyan-300">
      Chemical analysis & conversion
    </div>
    <Handle
      style={nodeHandleStyleRight}
      type="source"
      position={Position.Right}
    />
  </div>
);

const FlowOutputDisplayNode = ({ data, id }: any) => (
  <div className="min-w-[200px] rounded-2xl border border-emerald-500/40 bg-emerald-900/30 px-4 py-3 shadow-lg">
    <Handle
      style={nodeHandleStyleLeft}
      type="target"
      position={Position.Left}
    />
    <div className="text-sm font-semibold text-emerald-200 mb-2">{data.label}</div>
    <div className="text-xs text-emerald-300">
      Shows results in readable format
    </div>
    <Handle
      style={nodeHandleStyleRight}
      type="source"
      position={Position.Right}
    />
  </div>
);

const FlowOutputExportNode = ({ data, id }: any) => (
  <div className="min-w-[200px] rounded-2xl border border-pink-500/40 bg-pink-900/30 px-4 py-3 shadow-lg">
    <Handle
      style={nodeHandleStyleLeft}
      type="target"
      position={Position.Left}
    />
    <div className="text-sm font-semibold text-pink-200 mb-2">{data.label}</div>
    <div className="text-xs text-pink-300">
      Downloads results as file
    </div>
    <Handle
      style={nodeHandleStyleRight}
      type="source"
      position={Position.Right}
    />
  </div>
);

interface CanvasProps {
  currentTool: string;
  strokeWidth: number;
  strokeColor: string;
  onOpenCalculator?: () => void;
  onOpenMolView?: () => void;
  onOpenPeriodicTable?: () => void;
  onMoleculeInserted?: (moleculeData: any) => void;
  onDocumentCaptured?: (payload: { file: File; name: string; documentId: string }) => void;
  onDocumentAddToChat?: (payload: { documentId: string }) => void;
  onRegisterSnapshotHandler?: (handler: () => Promise<string | null>) => void;
  onRegisterTextInjectionHandler?: (handler: (text: string) => void) => void;
  onRegisterMoleculeInjectionHandler?: (handler: CanvasMoleculeInsertionHandler) => void;
  onRegisterProteinInjectionHandler?: (handler: CanvasProteinInsertionHandler) => void;
  onRegisterReactionInjectionHandler?: (handler: CanvasReactionInsertionHandler) => void;
  onRegisterMarkdownInjectionHandler?: (handler: (payload: { text: string; heading?: string }) => void) => void;
  isFullscreen?: boolean;
}

export type CanvasCommand =
  | { type: 'set-tool'; tool?: string }
  | { type: 'clear-canvas' }
  | { type: 'export-canvas' }
  | { type: 'toggle-grid' }
  | { type: 'insert-text'; text: string };

export default function Canvas({
  currentTool,
  strokeWidth,
  strokeColor,
  onOpenCalculator,
  onOpenMolView,
  onOpenPeriodicTable,
  onMoleculeInserted,
  onDocumentCaptured,
  onDocumentAddToChat,
  onRegisterSnapshotHandler,
  onRegisterTextInjectionHandler,
  onRegisterMoleculeInjectionHandler,
  onRegisterProteinInjectionHandler,
  onRegisterReactionInjectionHandler,
  onRegisterMarkdownInjectionHandler,
  isFullscreen = false
}: CanvasProps) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (onRegisterSnapshotHandler) {
      onRegisterSnapshotHandler(async () => {
        if (!canvasRef.current) return null;
        try {
          // Simple data URL export.
          // If transparent, composite with white background?
          // Creating a temp canvas to composite if needed, but raw capture is usually okay for AI.
          return canvasRef.current.toDataURL('image/jpeg', 0.8);
        } catch (e) {
          console.error('Failed to capture canvas snapshot', e);
          return null;
        }
      });
    }
  }, [onRegisterSnapshotHandler]);


  const [isDrawing, setIsDrawing] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());
  const [flowNodes, setFlowNodes, onFlowNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onFlowEdgesChange] = useEdgesState([]);
  const [flowRunMessage, setFlowRunMessage] = useState<string | null>(null);
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState<string | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const flowNodeTypes = useMemo(
    () => ({
      resource: FlowResourceNode,
      note: FlowNoteNode,
      output: FlowOutputNode,
      'input-text': FlowInputTextNode,
      'input-file': FlowInputFileNode,
      'input-url': FlowInputUrlNode,
      'process-ai': FlowProcessAiNode,
      'process-chemistry': FlowProcessChemistryNode,
      'output-display': FlowOutputDisplayNode,
      'output-export': FlowOutputExportNode
    }),
    []
  );
  const selectedFlowNode = useMemo(
    () => flowNodes.find(node => node.id === selectedFlowNodeId) ?? null,
    [flowNodes, selectedFlowNodeId]
  );
  const [zoom, setZoom] = useState(1);
  const [showCorrections, setShowCorrections] = useState(false);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CanvasAnalysisResult | null>(null);
  const [showChemistryToolbar, setShowChemistryToolbar] = useState(false);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  const [arQrCid, setArQrCid] = useState<string | null>(null);
  const [arQrLabel, setArQrLabel] = useState('');
  const [activeMineralPreview, setActiveMineralPreview] = useState<{ codId: string; name?: string } | null>(null);
  const [toolbarWidth, setToolbarWidth] = useState(260);
  const [isResizingToolbar, setIsResizingToolbar] = useState(false);
  const toolbarResizeStateRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 360 });
  const [chemistryTool, setChemistryTool] = useState('draw');
  const [chemistryColor, setChemistryColor] = useState('#3b82f6');
  const [chemistryStrokeColor, setChemistryStrokeColor] = useState('#3b82f6');
  const [chemistrySize, setChemistrySize] = useState(2);
  const [chemistryFillEnabled, setChemistryFillEnabled] = useState(true);
  const [chemistryFillColor, setChemistryFillColor] = useState('#3b82f6');
  const [showChemistryViewer, setShowChemistryViewer] = useState(false);
  const [chemistryStructure, setChemistryStructure] = useState<any>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [canvasBackground, setCanvasBackground] = useState<'dark' | 'white'>('dark');
  const [showMineralSearch, setShowMineralSearch] = useState(false);
  const [showInlineReactionSearch, setShowInlineReactionSearch] = useState(false);
  const [showProteinSearch, setShowProteinSearch] = useState(false);
  const [forceRedraw, setForceRedraw] = useState(0); // New state for forcing redraw
  const [showChemistryWidgetPanel, setShowChemistryWidgetPanel] = useState(false);
  const [annotationLabelOptions, setAnnotationLabelOptions] = useState<string[]>(() => [...DEFAULT_ANNOTATION_LABELS]);
  const [annotationLabel, setAnnotationLabel] = useState(DEFAULT_ANNOTATION_LABELS[0]);
  const [customAnnotationLabel, setCustomAnnotationLabel] = useState('');
  const [annotationColor, setAnnotationColor] = useState('#f97316');
  const [annotationMode, setAnnotationMode] = useState<{
    shapeId: string;
    label: string;
    color: string;
  } | null>(null);
  const [annotationHint, setAnnotationHint] = useState<string | null>(null);
  const [isTextInputVisible, setIsTextInputVisible] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
  const [currentTextInput, setCurrentTextInput] = useState('');
  const [editingTextShapeId, setEditingTextShapeId] = useState<string | null>(null);
  const [reactionSdfLoadingId, setReactionSdfLoadingId] = useState<string | null>(null);
  const [reactionSdfError, setReactionSdfError] = useState<{ id: string; message: string } | null>(null);
  const [droppedDocuments, setDroppedDocuments] = useState<CanvasDroppedDocument[]>([]);
  const [isDocumentDragActive, setIsDocumentDragActive] = useState(false);
  const [documentDropFeedback, setDocumentDropFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const dragDepthRef = useRef(0);
  const dropFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const droppedDocumentsRef = useRef<CanvasDroppedDocument[]>([]);
  const documentDragStateRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const documentResizeStateRef = useRef<{ id: string; startWidth: number; startHeight: number; startX: number; startY: number } | null>(null);
  const [markdownEntries, setMarkdownEntries] = useState<MarkdownEntry[]>([]);
  const [isMarkdownVisible, setIsMarkdownVisible] = useState(false);
  const [isMarkdownCollapsed, setIsMarkdownCollapsed] = useState(false);
  const [markdownPanePosition, setMarkdownPanePosition] = useState({ x: 96, y: 160 });
  const [markdownPaneSize, setMarkdownPaneSize] = useState({ width: 420, height: 360 });
  const markdownDragStateRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const markdownResizeStateRef = useRef<{ startWidth: number; startHeight: number; startX: number; startY: number } | null>(null);
  const markdownRemarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const markdownRehypePlugins = useMemo(() => [rehypeKatex], []);
  const markdownComponents = useMemo<Components>(() => ({
    a: (props) => (
      <a
        {...props}
        target="_blank"
        rel="noreferrer"
        className="text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
      />
    ),
    p: (props) => (
      <p
        {...props}
        className="mb-2 text-sm leading-relaxed text-slate-100 last:mb-0"
      />
    ),
    ul: (props) => (
      <ul
        {...props}
        className="mb-2 list-disc pl-5 text-sm text-slate-100 last:mb-0"
      />
    ),
    ol: (props) => (
      <ol
        {...props}
        className="mb-2 list-decimal pl-5 text-sm text-slate-100 last:mb-0"
      />
    ),
    li: (props) => (
      <li
        {...props}
        className="mb-1 text-sm leading-relaxed text-slate-100 last:mb-0"
      />
    ),
    code: ({ inline, children, ...props }) => {
      if (inline) {
        return (
          <code
            {...props}
            className="rounded bg-slate-900/70 px-1 py-0.5 font-mono text-[12px] text-emerald-200"
          >
            {children}
          </code>
        );
      }
      return (
        <pre
          {...props}
          className="mb-2 overflow-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-[12px] text-emerald-200"
        >
          <code className="font-mono leading-relaxed">{children}</code>
        </pre>
      );
    },
    blockquote: (props) => (
      <blockquote
        {...props}
        className="mb-2 border-l-4 border-sky-500/70 pl-3 text-sm italic text-slate-200"
      />
    )
  }), []);
  const markdownStepCount = useMemo(() => {
    return markdownEntries.reduce((acc, entry) => acc + entry.steps.length, 0);
  }, [markdownEntries]);
  const latestMarkdownTimestamp = useMemo(() => {
    if (!markdownEntries.length) {
      return null;
    }
    return formatDocumentTimestamp(markdownEntries[markdownEntries.length - 1].createdAt);
  }, [markdownEntries]);

  const addCustomAnnotationLabel = () => {
    const trimmed = customAnnotationLabel.trim();
    if (!trimmed) {
      return;
    }

    setAnnotationLabel(trimmed);
    setAnnotationLabelOptions(prev => {
      if (prev.some(option => option.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return [...prev, trimmed];
    });
    setCustomAnnotationLabel('');
  };

  const getDroppedDocumentType = (file: File): DroppedDocumentType | null => {
    const mime = (file.type || '').toLowerCase();

    if (isPdfFile(file)) {
      return 'pdf';
    }

    if (isSupportedTextDocument(file) && !isSpreadsheetDocument(file)) {
      return 'text';
    }

    if (mime.startsWith('image/')) {
      return 'image';
    }

    if (isAudioFile(file)) {
      return 'audio';
    }

    if (isVideoFile(file)) {
      return 'video';
    }

    if (isSpreadsheetDocument(file)) {
      return 'spreadsheet';
    }

    return null;
  };

  function formatDocumentSize(bytes: number): string {
    if (!bytes) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB'];
    const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
  }

  function formatDocumentTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const clampValue = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
  };

  const parseTextIntoSteps = useCallback((text: string): string[] => {
    if (!text) {
      return [];
    }
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }
    const segments = normalized
      .split(/\n{2,}/)
      .map(segment => segment.trim())
      .filter(Boolean);
    if (segments.length > 0) {
      return segments;
    }
    return [normalized];
  }, []);

  const appendMarkdownEntry = useCallback(
    (text: string, heading?: string) => {
      const steps = parseTextIntoSteps(text);
      if (!steps.length) {
        return;
      }
      const entry: MarkdownEntry = {
        id: `markdown-${Date.now()}`,
        title: heading?.trim() || 'Canvas Explanation',
        steps,
        createdAt: Date.now()
      };
      setMarkdownEntries(prev => {
        const next = [...prev, entry];
        return next.slice(-6);
      });
      setIsMarkdownVisible(true);
      setIsMarkdownCollapsed(false);
    },
    [parseTextIntoSteps]
  );

  const clearMarkdownEntries = useCallback(() => {
    setMarkdownEntries([]);
  }, []);

  const createDroppedDocumentFromFile = useCallback(
    async (file: File, position: { x: number; y: number }): Promise<CanvasDroppedDocument | null> => {
      const documentType = getDroppedDocumentType(file);
      if (!documentType) {
        return null;
      }
      const timestamp = Date.now();
      const idSeed = Math.random().toString(36).slice(2, 8);
      const documentId = `${timestamp}-${idSeed}`;

      if (documentType === 'text' || documentType === 'spreadsheet') {
        let textContent = '';
        let sheetPreviews: SheetPreview[] | undefined;
        try {
          const extracted = await extractTextFromDocument(file);
          textContent = extracted.text || '';
          sheetPreviews = extracted.sheets;
        } catch (error) {
          console.error('Failed to extract document text:', error);
          try {
            textContent = await file.text();
          } catch (fallbackError) {
            console.warn('Failed to read document as plain text:', fallbackError);
            textContent = `Unable to extract text from ${file.name}.`;
          }
        }
        const finalText = textContent || `No readable text extracted from ${file.name}.`;
        try {
          onDocumentCaptured?.({ file, name: file.name, documentId });
        } catch (notifyError) {
          console.warn('Failed to notify document capture handler:', notifyError);
        }
        return {
          id: documentId,
          name: file.name,
          type: documentType,
          content: finalText,
          preview: finalText.slice(0, 1200),
          sheetPreviews,
          position,
          size: file.size,
          createdAt: timestamp
        };
      }

      const objectUrl = URL.createObjectURL(file);
      if (documentType === 'pdf') {
        try {
          onDocumentCaptured?.({ file, name: file.name, documentId });
        } catch (error) {
          console.warn('Failed to trigger document insight handler:', error);
        }
      }
      return {
        id: documentId,
        name: file.name,
        type: documentType,
        content: objectUrl,
        viewerUrl: objectUrl,
        position,
        size: file.size,
        createdAt: timestamp,
        viewportWidth: documentType === 'pdf' ? DEFAULT_PDF_WIDTH : undefined,
        viewportHeight: documentType === 'pdf' ? DEFAULT_PDF_HEIGHT : undefined
      };
    },
    [onDocumentCaptured]
  );

  const computeDropPosition = useCallback(
    (index: number, coords?: { clientX?: number; clientY?: number }): { x: number; y: number } => {
      const offsetStep = 28;
      const cardWidth = 360;
      const cardHeight = 300;
      const container = canvasContainerRef.current;
      const rect = container?.getBoundingClientRect();
      const fallbackX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const fallbackY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const clientX = coords?.clientX ?? fallbackX;
      const clientY = coords?.clientY ?? fallbackY;

      if (!rect) {
        return {
          x: clientX - cardWidth / 2 + index * offsetStep,
          y: clientY - cardHeight / 2 + index * offsetStep
        };
      }

      const relativeX = clientX - rect.left - cardWidth / 2;
      const relativeY = clientY - rect.top - cardHeight / 2;
      const maxX = Math.max(16, rect.width - cardWidth - 16);
      const maxY = Math.max(16, rect.height - cardHeight - 16);

      return {
        x: Math.min(Math.max(16, relativeX + index * offsetStep), maxX),
        y: Math.min(Math.max(16, relativeY + index * offsetStep), maxY)
      };
    },
    []
  );

  const showDocumentDropFeedback = (type: 'error' | 'success', message: string) => {
    if (dropFeedbackTimeoutRef.current) {
      clearTimeout(dropFeedbackTimeoutRef.current);
    }
    setDocumentDropFeedback({ type, message });
    dropFeedbackTimeoutRef.current = setTimeout(() => {
      setDocumentDropFeedback(null);
    }, 3600);
  };

  const addFilesToCanvas = useCallback(
    async (incomingFiles: File[], coords?: { clientX?: number; clientY?: number }) => {
      if (!incomingFiles.length) {
        return;
      }

      const supportedFiles = incomingFiles.filter(file => Boolean(getDroppedDocumentType(file)));
      if (!supportedFiles.length) {
        showDocumentDropFeedback('error', 'Only PDF, text, or image documents can be embedded right now.');
        return;
      }

      try {
        const parsedDocuments = await Promise.all(
          supportedFiles.map((file, index) =>
            createDroppedDocumentFromFile(file, computeDropPosition(index, coords))
          )
        );

        const validDocuments = parsedDocuments.filter(
          (doc): doc is CanvasDroppedDocument => Boolean(doc)
        );

        if (!validDocuments.length) {
          showDocumentDropFeedback('error', 'We could not load that file. Please try again.');
          return;
        }

        setDroppedDocuments(prev => [...prev, ...validDocuments]);
        const successMessage =
          validDocuments.length === 1
            ? `Added "${validDocuments[0].name}" to the canvas.`
            : `Added ${validDocuments.length} documents to the canvas.`;
        showDocumentDropFeedback('success', successMessage);
      } catch (error) {
        console.error('Failed to process uploaded files:', error);
        showDocumentDropFeedback('error', 'Something went wrong while checking that file.');
      }
    },
    [computeDropPosition, createDroppedDocumentFromFile, showDocumentDropFeedback]
  );
  const hasFiles = (dataTransfer: DataTransfer | null) => {
    if (!dataTransfer?.types) {
      return false;
    }
    return Array.from(dataTransfer.types).includes('Files');
  };

  const toggleDocumentExpansion = useCallback((docId: string) => {
    setExpandedDocuments(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const getDocumentTypeLabel = (docType: DroppedDocumentType): string => {
    switch (docType) {
      case 'pdf':
        return 'PDF';
      case 'text':
        return 'Notes';
      case 'image':
        return 'Image';
      case 'audio':
        return 'Audio';
      case 'video':
        return 'Video';
      case 'spreadsheet':
        return 'Spreadsheet';
      default:
        return 'Document';
    }
  };

  const removeDroppedDocument = (id: string) => {
    setDroppedDocuments(prev => {
      const target = prev.find(doc => doc.id === id);
      if (target?.viewerUrl) {
        URL.revokeObjectURL(target.viewerUrl);
      }
      return prev.filter(doc => doc.id !== id);
    });
  };

  const openDroppedDocument = (doc: CanvasDroppedDocument) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (doc.type === 'text' || doc.type === 'spreadsheet') {
      const blob = new Blob([doc.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return;
    }

    const targetUrl = doc.viewerUrl ?? doc.content;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDocumentDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDocumentDragActive(true);
  };

  const handleDocumentDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDocumentDragActive) {
      setIsDocumentDragActive(true);
    }
  };

  const handleDocumentDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDocumentDragActive(false);
    }
  };

  const handleDocumentDrop = async (event: ReactDragEvent<HTMLDivElement>) => {
    // Handle node drops first
    const nodeType = event.dataTransfer?.getData('text/plain');
    if (nodeType && nodeType.startsWith('input-') || nodeType.startsWith('process-') || nodeType.startsWith('output-')) {
      event.preventDefault();
      event.stopPropagation();

      const rect = canvasContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Create node based on type
      let nodeTypeToCreate = 'resource';
      let nodeData: any = { label: 'New Node' };

      switch (nodeType) {
        case 'input-text':
          nodeTypeToCreate = 'input-text';
          nodeData = { label: 'Text Input', type: 'text', value: '' };
          break;
        case 'input-file':
          nodeTypeToCreate = 'input-file';
          nodeData = { label: 'File Upload', type: 'file', value: null };
          break;
        case 'input-url':
          nodeTypeToCreate = 'input-url';
          nodeData = { label: 'URL Input', type: 'url', value: '' };
          break;
        case 'process-ai':
          nodeTypeToCreate = 'process-ai';
          nodeData = { label: 'AI Analysis', type: 'ai' };
          break;
        case 'process-chemistry':
          nodeTypeToCreate = 'process-chemistry';
          nodeData = { label: 'Chemistry', type: 'chemistry' };
          break;
        case 'output-display':
          nodeTypeToCreate = 'output-display';
          nodeData = { label: 'Display', type: 'display' };
          break;
        case 'output-export':
          nodeTypeToCreate = 'output-export';
          nodeData = { label: 'Export', type: 'export' };
          break;
      }

      const newNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeTypeToCreate,
        position: { x, y },
        data: nodeData
      };

      setFlowNodes((nodes) => [...nodes, newNode]);
      return;
    }

    // Handle file drops
    if (!hasFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDocumentDragActive(false);

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }
    await addFilesToCanvas(Array.from(files), { clientX: event.clientX, clientY: event.clientY });
  };

  useEffect(() => {
    return () => {
      if (dropFeedbackTimeoutRef.current) {
        clearTimeout(dropFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const handleDocumentDragMove = useCallback((event: MouseEvent) => {
    const dragState = documentDragStateRef.current;
    if (!dragState) {
      return;
    }

    const nextX = event.clientX - dragState.offsetX;
    const nextY = event.clientY - dragState.offsetY;

    setDroppedDocuments(prev =>
      prev.map(doc =>
        doc.id === dragState.id
          ? {
            ...doc,
            position: {
              x: nextX,
              y: nextY
            }
          }
          : doc
      )
    );
  }, []);

  const handleDocumentDragEnd = useCallback(() => {
    documentDragStateRef.current = null;
    window.removeEventListener('mousemove', handleDocumentDragMove as EventListener);
    window.removeEventListener('mouseup', handleDocumentDragEnd as EventListener);
  }, [handleDocumentDragMove]);

  const handleDocumentDragStart = useCallback(
    (event: ReactMouseEvent, docId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const targetDoc = droppedDocumentsRef.current.find(doc => doc.id === docId);
      if (!targetDoc) {
        return;
      }

      documentDragStateRef.current = {
        id: docId,
        offsetX: event.clientX - targetDoc.position.x,
        offsetY: event.clientY - targetDoc.position.y
      };

      window.addEventListener('mousemove', handleDocumentDragMove as EventListener);
      window.addEventListener('mouseup', handleDocumentDragEnd as EventListener);
    },
    [handleDocumentDragEnd, handleDocumentDragMove]
  );

  const handleDocumentResizeMove = useCallback((event: MouseEvent) => {
    const resizeState = documentResizeStateRef.current;
    if (!resizeState) {
      return;
    }

    const deltaX = event.clientX - resizeState.startX;
    const deltaY = event.clientY - resizeState.startY;

    const nextWidth = clampValue(resizeState.startWidth + deltaX, MIN_PDF_WIDTH, MAX_PDF_WIDTH);
    const nextHeight = clampValue(resizeState.startHeight + deltaY, MIN_PDF_HEIGHT, MAX_PDF_HEIGHT);

    setDroppedDocuments(prev =>
      prev.map(doc =>
        doc.id === resizeState.id
          ? {
            ...doc,
            viewportWidth: nextWidth,
            viewportHeight: nextHeight
          }
          : doc
      )
    );
  }, []);

  const handleDocumentResizeEnd = useCallback(() => {
    documentResizeStateRef.current = null;
    window.removeEventListener('mousemove', handleDocumentResizeMove as EventListener);
    window.removeEventListener('mouseup', handleDocumentResizeEnd as EventListener);
  }, [handleDocumentResizeMove]);

  const handleDocumentResizeStart = useCallback(
    (event: ReactMouseEvent, docId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const targetDoc = droppedDocumentsRef.current.find(doc => doc.id === docId);
      if (!targetDoc) {
        return;
      }

      documentResizeStateRef.current = {
        id: docId,
        startWidth: targetDoc.viewportWidth ?? DEFAULT_PDF_WIDTH,
        startHeight: targetDoc.viewportHeight ?? DEFAULT_PDF_HEIGHT,
        startX: event.clientX,
        startY: event.clientY
      };

      window.addEventListener('mousemove', handleDocumentResizeMove as EventListener);
      window.addEventListener('mouseup', handleDocumentResizeEnd as EventListener);
    },
    [handleDocumentResizeEnd, handleDocumentResizeMove]
  );

  const handleMarkdownDragMove = useCallback((event: MouseEvent) => {
    const dragState = markdownDragStateRef.current;
    if (!dragState) {
      return;
    }
    const nextX = Math.max(16, event.clientX - dragState.offsetX);
    const nextY = Math.max(80, event.clientY - dragState.offsetY);
    setMarkdownPanePosition({ x: nextX, y: nextY });
  }, []);

  const handleMarkdownDragEnd = useCallback(() => {
    markdownDragStateRef.current = null;
    window.removeEventListener('mousemove', handleMarkdownDragMove as EventListener);
    window.removeEventListener('mouseup', handleMarkdownDragEnd as EventListener);
  }, [handleMarkdownDragMove]);

  const handleMarkdownDragStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      markdownDragStateRef.current = {
        offsetX: event.clientX - markdownPanePosition.x,
        offsetY: event.clientY - markdownPanePosition.y
      };
      window.addEventListener('mousemove', handleMarkdownDragMove as EventListener);
      window.addEventListener('mouseup', handleMarkdownDragEnd as EventListener);
    },
    [handleMarkdownDragEnd, handleMarkdownDragMove, markdownPanePosition.x, markdownPanePosition.y]
  );

  const handleMarkdownResizeMove = useCallback((event: MouseEvent) => {
    const resizeState = markdownResizeStateRef.current;
    if (!resizeState) {
      return;
    }
    const deltaX = event.clientX - resizeState.startX;
    const deltaY = event.clientY - resizeState.startY;
    const width = clampValue(resizeState.startWidth + deltaX, MARKDOWN_MIN_WIDTH, MARKDOWN_MAX_WIDTH);
    const height = clampValue(resizeState.startHeight + deltaY, MARKDOWN_MIN_HEIGHT, MARKDOWN_MAX_HEIGHT);
    setMarkdownPaneSize({ width, height });
  }, []);

  const handleMarkdownResizeEnd = useCallback(() => {
    markdownResizeStateRef.current = null;
    window.removeEventListener('mousemove', handleMarkdownResizeMove as EventListener);
    window.removeEventListener('mouseup', handleMarkdownResizeEnd as EventListener);
  }, [handleMarkdownResizeMove]);

  const handleMarkdownResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement | HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      markdownResizeStateRef.current = {
        startWidth: markdownPaneSize.width,
        startHeight: markdownPaneSize.height,
        startX: event.clientX,
        startY: event.clientY
      };
      window.addEventListener('mousemove', handleMarkdownResizeMove as EventListener);
      window.addEventListener('mouseup', handleMarkdownResizeEnd as EventListener);
    },
    [handleMarkdownResizeEnd, handleMarkdownResizeMove, markdownPaneSize.height, markdownPaneSize.width]
  );

  useEffect(() => {
    const handleExternalUpload = (event: Event) => {
      const customEvent = event as CustomEvent<{ files?: File[] | FileList }>;
      const payload = customEvent.detail?.files;
      if (!payload) {
        return;
      }
      const filesArray = Array.isArray(payload) ? payload : Array.from(payload);
      if (!filesArray.length) {
        return;
      }
      void addFilesToCanvas(filesArray);
    };

    window.addEventListener('canvas-upload-files', handleExternalUpload as EventListener);
    return () => {
      window.removeEventListener('canvas-upload-files', handleExternalUpload as EventListener);
    };
  }, [addFilesToCanvas]);

  useEffect(() => {
    droppedDocumentsRef.current = droppedDocuments;
  }, [droppedDocuments]);

  useEffect(() => {
    return () => {
      handleDocumentDragEnd();
      handleDocumentResizeEnd();
      droppedDocumentsRef.current.forEach(doc => {
        if (doc.viewerUrl) {
          URL.revokeObjectURL(doc.viewerUrl);
        }
      });
    };
  }, [handleDocumentDragEnd, handleDocumentResizeEnd]);

  const onFlowConnect = useCallback(
    (connection: Connection) => {
      setFlowEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: '#38bdf8', strokeWidth: 2 }
          },
          eds
        )
      );
    },
    [setFlowEdges]
  );

  const addFlowNode = useCallback(
    (kind: 'note' | 'output') => {
      const id = `${kind}-${Date.now()}`;
      setFlowNodes((nodes) => [
        ...nodes,
        {
          id,
          type: kind === 'output' ? 'output' : 'note',
          position: { x: kind === 'output' ? 520 : 320, y: 80 + nodes.length * 60 },
          data: {
            label: kind === 'output' ? 'Final Output' : 'Notes Block',
            description: kind === 'output' ? 'Connect sources and notes to produce summary or answer' : 'Add custom notes or processing step'
          }
        }
      ]);
    },
    [setFlowNodes]
  );

  const addResourceFlowNode = useCallback(
    (resourceKind: string) => {
      const name =
        window.prompt(`Name for ${resourceKind.toUpperCase()} node`, `${resourceKind.toUpperCase()} source`) ||
        `${resourceKind.toUpperCase()} source`;
      const position = { x: 120 + Math.random() * 320, y: 80 + Math.random() * 320 };
      const id = `custom-${resourceKind}-${Date.now()}`;
      setFlowNodes((nodes) => [
        ...nodes,
        {
          id,
          type: 'resource',
          position,
          data: {
            label: name,
            description: `${resourceKind.toUpperCase()} source`,
            icon: getResourceIcon(resourceKind),
            kind: resourceKind
          }
        }
      ]);
    },
    [setFlowNodes]
  );

  const updateSelectedFlowNode = useCallback(
    (changes: Record<string, any>) => {
      if (!selectedFlowNodeId) return;
      setFlowNodes(nodes =>
        nodes.map(node =>
          node.id === selectedFlowNodeId ? { ...node, data: { ...node.data, ...changes } } : node
        )
      );
    },
    [selectedFlowNodeId, setFlowNodes]
  );

  const handlePaletteDragStart = useCallback((event: ReactDragEvent<HTMLButtonElement>, resourceKind: string) => {
    event.dataTransfer.setData('application/reactflow', resourceKind);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const runFlow = useCallback(() => {
    const connectionsToOutput = flowEdges.filter(edge => edge.target === 'flow-output').length;
    setFlowRunMessage(
      connectionsToOutput
        ? `Flow executed! ${connectionsToOutput} connection${connectionsToOutput === 1 ? '' : 's'} feed the output.`
        : 'Flow executed but no nodes were connected to the output.'
    );
    setTimeout(() => setFlowRunMessage(null), 4000);
  }, [flowEdges]);

  const handleFlowNodeDoubleClick = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      if (!node.id.startsWith('doc-')) {
        return;
      }
      const docId = node.id.replace('doc-', '');
      const target = droppedDocuments.find(doc => doc.id === docId);
      if (target) {
        openDroppedDocument(target);
      }
    },
    [droppedDocuments]
  );

  const onFlowDragOver = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onFlowDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const resourceKind = event.dataTransfer?.getData('application/reactflow');
      if (!resourceKind || !flowInstance || !flowWrapperRef.current) {
        return;
      }
      const bounds = flowWrapperRef.current.getBoundingClientRect();
      const position = flowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      const id = `drag-${resourceKind}-${Date.now()}`;
      setFlowNodes((nodes) => [
        ...nodes,
        {
          id,
          type: 'resource',
          position,
          data: {
            label: `${resourceKind.toUpperCase()} node`,
            description: `${resourceKind.toUpperCase()} source`,
            icon: getResourceIcon(resourceKind),
            kind: resourceKind
          }
        }
      ]);
    },
    [flowInstance, setFlowNodes]
  );

  // Arrow drawing state - single resizable arrow
  const [arrowState, setArrowState] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isDrawing: boolean;
  } | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);

  // Cache for rendered molecule images
  const moleculeImageCacheRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const crystalVisualCacheRef = useRef<Map<string, CrystalVisualData>>(new Map());

  type ReactionImageCacheEntry = {
    baseSvg?: string | null;
    baseImage?: HTMLImageElement;
    highlightSvg?: string | null;
    highlightImage?: HTMLImageElement;
  };

  const reactionImageCacheRef = useRef<Map<string, ReactionImageCacheEntry>>(new Map());

  // Cache for parsed SDF structures
  const sdfCacheRef = useRef<Map<string, ParsedSDF>>(new Map());

  // Cache for projected atom positions on canvas for annotation placement
  const moleculeProjectionRef = useRef<Map<string, Array<{ atomIndex: number; x: number; y: number }>>>(new Map());

  // Shape tracking for repositioning
  interface Shape {
    id: string;
    type: 'arrow' | 'circle' | 'square' | 'triangle' | 'hexagon' | 'plus' | 'minus' | 'molecule' | 'protein' | 'text' | 'reaction' | 'path';
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    color: string;
    strokeColor?: string;
    fillColor?: string;
    fillEnabled?: boolean;
    size: number;
    rotation: number;  // Rotation in degrees (0-360)
    maintainAspect?: boolean;
    aspectRatio?: number;
    originalWidth?: number;
    originalHeight?: number;
    // Text-specific properties
    text?: string;
    // Molecule-specific properties
    moleculeData?: MoleculeData & {
      displayName?: string;
    };
    // PDB Protein-specific properties
    proteinData?: PDBProteinData;
    // Reaction-specific properties
    reactionData?: {
      svg: string | null;
      highlightSvg?: string | null;
      previewSvg?: string | null;
      name?: string;
      description?: string;
      smiles: string;
      timestamp: number;
      includeSDF?: boolean;
      sdfShapeIds?: string[];
      metadata?: ReactionMetadata;
    };
    use3D?: boolean;
    rotation3D?: {
      x: number;
      y: number;
    };
    annotations?: MoleculeAnnotation[];
  }

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const selectedShape = selectedShapeId ? shapes.find(shape => shape.id === selectedShapeId) ?? null : null;
  const has3DStructure = Boolean(
    selectedShape &&
    selectedShape.type === 'molecule' &&
    selectedShape.moleculeData?.sdf3DData
  );
  const selectedMoleculeCid = (() => {
    if (!selectedShape || selectedShape.type !== 'molecule' || !selectedShape.moleculeData) {
      return null;
    }

    const { cid } = selectedShape.moleculeData;
    if (cid === undefined || cid === null) {
      return null;
    }

    const normalized = typeof cid === 'number' ? cid.toString() : `${cid}`.trim();
    return normalized.length ? normalized : null;
  })();
  const arQrUrl = useMemo(() => {
    if (!arQrCid) {
      return null;
    }
    if (typeof window === 'undefined') {
      return null;
    }
    return `${window.location.origin}/ar/${encodeURIComponent(arQrCid)}`;
  }, [arQrCid]);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [isRotatingShape, setIsRotatingShape] = useState(false);
  const [isRotating3DShape, setIsRotating3DShape] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasHistoryRef = useRef<Shape[]>([]);
  const rotate3DStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const externalTextPlacementRef = useRef<{ index: number }>({ index: 0 });

  useEffect(() => {
    if (!arQrCid) {
      return;
    }
    if (!selectedMoleculeCid) {
      setArQrCid(null);
      setArQrLabel('');
      return;
    }

    const nextLabel =
      selectedShape?.type === 'molecule'
        ? selectedShape.moleculeData?.displayName ?? selectedShape.moleculeData?.name ?? ''
        : '';

    if (selectedMoleculeCid !== arQrCid) {
      setArQrCid(selectedMoleculeCid);
    }

    if (nextLabel !== arQrLabel) {
      setArQrLabel(nextLabel);
    }
  }, [selectedMoleculeCid, selectedShape, arQrCid, arQrLabel]);

  // Resizing state - Canva-like
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | null>(null);
  const [areaEraseSelection, setAreaEraseSelection] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isActive: boolean;
  } | null>(null);

  // Lasso selection state for free-hand eraser
  const [lassoSelection, setLassoSelection] = useState<{
    points: { x: number; y: number }[];
    isActive: boolean;
  }>({
    points: [],
    isActive: false
  });

  const FILLABLE_SHAPES = new Set(['circle', 'square', 'triangle', 'hexagon']);

  const handleChemistryStrokeColorChange = (color: string) => {
    setChemistryStrokeColor(color);
    setChemistryColor(color);
  };

  const updateShapeById = (id: string, updater: (shape: Shape) => Shape) => {
    let didUpdate = false;
    const updated = canvasHistoryRef.current.map(shape => {
      if (shape.id === id) {
        didUpdate = true;
        return updater(shape);
      }
      return shape;
    });

    if (didUpdate) {
      canvasHistoryRef.current = updated;
      setShapes(updated);
    }
  };

  const openSelectedMoleculeIn3D = () => {
    if (!selectedShape || selectedShape.type !== 'molecule' || !selectedShape.moleculeData) {
      return;
    }

    const { cid, smiles, displayName, name } = selectedShape.moleculeData;
    let viewerUrl: string | null = null;

    if (typeof cid === 'number' && !Number.isNaN(cid)) {
      viewerUrl = getMolViewUrl(cid, 'balls');
    } else if (smiles && smiles.trim().length > 0) {
      viewerUrl = getMolViewUrlFromSmiles(smiles, 'balls');
    }

    if (!viewerUrl) {
      console.warn('No MolView URL available for molecule', displayName ?? name ?? cid);
      return;
    }

    window.open(viewerUrl, '_blank', 'noopener,noreferrer');

    if (onOpenMolView) {
      onOpenMolView();
    }
  };

  const openArViewer = () => {
    if (!selectedMoleculeCid) {
      return;
    }

    const label =
      selectedShape?.type === 'molecule'
        ? selectedShape.moleculeData?.displayName ?? selectedShape.moleculeData?.name ?? ''
        : '';

    setArQrLabel(label);
    setArQrCid(selectedMoleculeCid);
  };

  const closeArQrOverlay = () => {
    setArQrCid(null);
    setArQrLabel('');
  };

  const toggleSelectedMolecule3D = (enabled: boolean) => {
    if (!selectedShapeId || selectedShape?.type !== 'molecule') {
      return;
    }

    updateShapeById(selectedShapeId, shape => ({
      ...shape,
      use3D: enabled,
      rotation3D: enabled
        ? shape.rotation3D ?? { ...DEFAULT_MOLECULE_3D_ROTATION }
        : shape.rotation3D
    }));

    if (!enabled) {
      setAnnotationMode(prev => (prev && prev.shapeId === selectedShapeId ? null : prev));
      setAnnotationHint(null);
    }
  };

  const resetSelectedMolecule3DOrientation = () => {
    if (!selectedShapeId || selectedShape?.type !== 'molecule') {
      return;
    }

    updateShapeById(selectedShapeId, shape => ({
      ...shape,
      rotation3D: { ...DEFAULT_MOLECULE_3D_ROTATION }
    }));
  };

  const removeAnnotation = (shapeId: string, annotationId: string) => {
    updateShapeById(shapeId, shape => ({
      ...shape,
      annotations: (shape.annotations ?? []).filter(annotation => annotation.id !== annotationId)
    }));
  };

  // Intelligent color picker based on canvas background
  const getOptimalPenColor = () => {
    return canvasBackground === 'dark' ? '#0ea5e9' : '#000000';
  };

  // Update pen color when canvas background changes
  useEffect(() => {
    const optimalColor = getOptimalPenColor();
    setChemistryColor(optimalColor);
    setChemistryStrokeColor(optimalColor);
    setChemistryFillColor(optimalColor);
  }, [canvasBackground]);

  useEffect(() => {
    setAnnotationHint(null);
    setAnnotationMode(prev => (prev && prev.shapeId !== selectedShapeId ? null : prev));
  }, [selectedShapeId]);

  useEffect(() => {
    if (reactionSdfError && reactionSdfError.id !== (selectedShapeId ?? '')) {
      setReactionSdfError(null);
    }
  }, [reactionSdfError, selectedShapeId]);

  useEffect(() => {
    if (!isResizingToolbar) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - toolbarResizeStateRef.current.startX;
      const proposedWidth = toolbarResizeStateRef.current.startWidth + delta;
      const clampedWidth = Math.min(Math.max(proposedWidth, MIN_TOOLBAR_WIDTH), MAX_TOOLBAR_WIDTH);
      setToolbarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingToolbar(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingToolbar]);

  useEffect(() => {
    if (!showChemistryToolbar) {
      setIsResizingToolbar(false);
    }
  }, [showChemistryToolbar]);

  const resetExternalTextPlacement = useCallback(() => {
    externalTextPlacementRef.current.index = 0;
  }, []);

  const addTextShapeToCanvas = useCallback((textShape: Shape) => {
    setShapes(prev => {
      const updated = [...prev, textShape];
      canvasHistoryRef.current = updated;
      return updated;
    });
  }, []);

  const handleTextSubmit = () => {
    if (currentTextInput.trim()) {
      if (!canvasRef.current) return;

      const worldX = textInputPosition.x / zoom;
      const worldY = textInputPosition.y / zoom;

      if (editingTextShapeId) {
        // Update existing text shape
        const updatedShapes = canvasHistoryRef.current.map(shape => {
          if (shape.id === editingTextShapeId && shape.type === 'text') {
            return {
              ...shape,
              text: currentTextInput
            };
          }
          return shape;
        });
        setShapes(updatedShapes);
        canvasHistoryRef.current = updatedShapes;
      } else {
        // Create new text shape
        const textShape: Shape = {
          id: `text-${Date.now()}`,
          type: 'text',
          startX: worldX,
          startY: worldY,
          endX: worldX,
          endY: worldY,
          color: chemistryColor,
          strokeColor: chemistryStrokeColor,
          size: 24, // Larger default size for text readability on canvas
          fillEnabled: chemistryFillEnabled,
          fillColor: chemistryFillColor,
          text: currentTextInput,
          rotation: 0
        };
        addTextShapeToCanvas(textShape);
      }
    }
    setIsTextInputVisible(false);
    setCurrentTextInput('');
    setEditingTextShapeId(null);
  };

  const handleTextCancel = () => {
    setIsTextInputVisible(false);
    setCurrentTextInput('');
    setEditingTextShapeId(null);
  };

  const insertTextBlock = useCallback((text: string, options?: { autoPlacement?: boolean }) => {
    if (!text.trim()) {
      return;
    }

    const canvas = canvasRef.current;
    const defaultX = canvas ? (canvas.width / zoom) / 2 - 160 : 120;
    const defaultY = canvas ? (canvas.height / zoom) / 2 - 80 : 120;

    let targetX = defaultX;
    let targetY = defaultY;

    if (options?.autoPlacement && canvas) {
      const canvasWidth = canvas.width / zoom;
      const columns = 2;
      const columnSpacing = Math.min(360, canvasWidth / columns);
      const rowSpacing = 160;
      const index = externalTextPlacementRef.current.index;
      externalTextPlacementRef.current.index = index + 1;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const columnOffset = (column - (columns - 1) / 2) * columnSpacing;
      const topPadding = Math.max(64, (canvas.height / zoom) * 0.12);

      targetX = canvasWidth / 2 + columnOffset - 160;
      targetY = topPadding + row * rowSpacing;
    }

    const textShape: Shape = {
      id: `text-${Date.now()}`,
      type: 'text',
      startX: targetX,
      startY: targetY,
      endX: targetX,
      endY: targetY,
      color: chemistryColor,
      strokeColor: chemistryStrokeColor,
      size: 22,
      fillEnabled: chemistryFillEnabled,
      fillColor: chemistryFillColor,
      text,
      rotation: 0
    };

    addTextShapeToCanvas(textShape);
  }, [addTextShapeToCanvas, chemistryColor, chemistryFillColor, chemistryFillEnabled, chemistryStrokeColor, zoom]);

  const handleExternalTextInjection = useCallback((content: string) => {
    insertTextBlock(content, { autoPlacement: true });
  }, [insertTextBlock]);

  const handleExternalMarkdownInjection = useCallback((payload: { text: string; heading?: string }) => {
    if (!payload?.text?.trim()) {
      return;
    }
    appendMarkdownEntry(payload.text, payload.heading);
  }, [appendMarkdownEntry]);

  useEffect(() => {
    if (onRegisterTextInjectionHandler) {
      onRegisterTextInjectionHandler(handleExternalTextInjection);
    }
  }, [handleExternalTextInjection, onRegisterTextInjectionHandler]);

  useEffect(() => {
    if (onRegisterMarkdownInjectionHandler) {
      onRegisterMarkdownInjectionHandler(handleExternalMarkdownInjection);
    }
  }, [handleExternalMarkdownInjection, onRegisterMarkdownInjectionHandler]);

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom;
    const clickY = (e.clientY - rect.top) / zoom;

    // Find text shape at click position
    const clickedShape = canvasHistoryRef.current.find(shape => {
      if (shape.type !== 'text') return false;

      // Simple bounding box check for text (this could be improved with actual text measurement)
      const textWidth = (shape.text?.length || 0) * shape.size * 0.6; // Rough estimate
      const textHeight = shape.size * 1.2;

      return (
        clickX >= shape.startX &&
        clickX <= shape.startX + textWidth &&
        clickY >= shape.startY &&
        clickY <= shape.startY + textHeight
      );
    });

    if (clickedShape && clickedShape.type === 'text') {
      // Start editing this text shape
      setCurrentTextInput(clickedShape.text || '');
      // Position the overlay near the text shape (convert back to screen coordinates)
      setTextInputPosition({
        x: clickedShape.startX * zoom,
        y: clickedShape.startY * zoom
      });
      setEditingTextShapeId(clickedShape.id);
      setIsTextInputVisible(true);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const redraw = async () => {
      // Set canvas size
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // Fill canvas with background color
      ctx.fillStyle = canvasBackground === 'dark' ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid if enabled
      if (showGrid) {
        drawGrid(ctx, canvas.width, canvas.height);
      }

      // Redraw all saved shapes
      await redrawAllShapes(ctx);

      if (areaEraseSelection?.isActive) {
        drawAreaEraseOverlay(ctx, areaEraseSelection);
      }

      // Draw lasso selection if active
      if (lassoSelection.isActive && lassoSelection.points.length > 0) {
        drawLassoOverlay(ctx, lassoSelection.points);
      }
    };

    redraw();
  }, [showGrid, canvasBackground, shapes, forceRedraw, areaEraseSelection, lassoSelection]);

  // Delete selected shape
  const deleteSelectedShape = () => {
    if (!selectedShape) return;

    const updatedShapes = canvasHistoryRef.current.filter(shape => shape.id !== selectedShape.id);
    setShapes(updatedShapes);
    canvasHistoryRef.current = updatedShapes;
    setSelectedShapeId(null);

    // Clean up molecule projection cache if it was a molecule
    if (selectedShape.type === 'molecule') {
      moleculeProjectionRef.current.delete(selectedShape.id);
    }

    console.log('🗑️ Shape deleted:', selectedShape.id);
  };

  // Handle keyboard events for deletion
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle delete/backspace if a shape is selected and we're not typing in an input
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedShape) {
        // Check if we're not in an input field or textarea
        const target = event.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          event.preventDefault();
          deleteSelectedShape();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedShape]);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Adjust grid color based on canvas background
    ctx.strokeStyle = canvasBackground === 'dark' ? '#1e293b' : '#e5e7eb';
    ctx.lineWidth = 0.5;

    const gridSize = 20;

    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const getShapeBounds = (shape: Shape) => {
    const minX = Math.min(shape.startX, shape.endX);
    const maxX = Math.max(shape.startX, shape.endX);
    const minY = Math.min(shape.startY, shape.endY);
    const maxY = Math.max(shape.startY, shape.endY);
    return { minX, minY, maxX, maxY };
  };

  const doesShapeIntersectRect = (
    shape: Shape,
    rect: { minX: number; minY: number; maxX: number; maxY: number }
  ) => {
    const bounds = getShapeBounds(shape);
    return !(
      bounds.maxX < rect.minX ||
      bounds.minX > rect.maxX ||
      bounds.maxY < rect.minY ||
      bounds.minY > rect.maxY
    );
  };

  const isPointWithinShape = (shape: Shape, x: number, y: number) => {
    const bounds = getShapeBounds(shape);
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
  };

  // Ray casting algorithm to check if a point is inside a polygon (lasso)
  const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]) => {
    if (polygon.length < 3) return false;

    let inside = false;
    let p1x = polygon[0].x;
    let p1y = polygon[0].y;

    for (let i = 1; i <= polygon.length; i++) {
      const p2x = polygon[i % polygon.length].x;
      const p2y = polygon[i % polygon.length].y;

      if (point.y > Math.min(p1y, p2y)) {
        if (point.y <= Math.max(p1y, p2y)) {
          if (point.x <= Math.max(p1x, p2x)) {
            if (p1y !== p2y) {
              const xinters = (point.y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x;
              if (p1x === p2x || point.x <= xinters) {
                inside = !inside;
              }
            }
          }
        }
      }
      p1x = p2x;
      p1y = p2y;
    }

    return inside;
  };

  const isPointInRect = (
    point: { x: number; y: number },
    rect: { minX: number; minY: number; maxX: number; maxY: number }
  ) => {
    return (
      point.x >= rect.minX &&
      point.x <= rect.maxX &&
      point.y >= rect.minY &&
      point.y <= rect.maxY
    );
  };

  const orientation = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number }
  ) => {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < 0.000001) return 0;
    return val > 0 ? 1 : 2; // 1: clockwise, 2: counterclockwise
  };

  const onSegment = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number }
  ) => {
    return (
      q.x <= Math.max(p.x, r.x) &&
      q.x >= Math.min(p.x, r.x) &&
      q.y <= Math.max(p.y, r.y) &&
      q.y >= Math.min(p.y, r.y)
    );
  };

  const segmentsIntersect = (
    p1: { x: number; y: number },
    q1: { x: number; y: number },
    p2: { x: number; y: number },
    q2: { x: number; y: number }
  ) => {
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) {
      return true;
    }

    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
  };

  const doesPolygonIntersectRect = (
    polygon: { x: number; y: number }[],
    rect: { minX: number; minY: number; maxX: number; maxY: number }
  ) => {
    if (polygon.length < 3) return false;

    for (const point of polygon) {
      if (isPointInRect(point, rect)) {
        return true;
      }
    }

    const rectCorners = [
      { x: rect.minX, y: rect.minY },
      { x: rect.maxX, y: rect.minY },
      { x: rect.maxX, y: rect.maxY },
      { x: rect.minX, y: rect.maxY }
    ];

    for (const corner of rectCorners) {
      if (isPointInPolygon(corner, polygon)) {
        return true;
      }
    }

    const rectEdges: [
      { x: number; y: number },
      { x: number; y: number }
    ][] = [
        [rectCorners[0], rectCorners[1]],
        [rectCorners[1], rectCorners[2]],
        [rectCorners[2], rectCorners[3]],
        [rectCorners[3], rectCorners[0]]
      ];

    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];

      for (const [r1, r2] of rectEdges) {
        if (segmentsIntersect(p1, p2, r1, r2)) {
          return true;
        }
      }
    }

    return false;
  };

  const getSvgAspectRatio = (svgContent?: string | null) => {
    if (!svgContent) return 1;

    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/i);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return parts[2] / parts[3];
      }
    }

    const widthMatch = svgContent.match(/width="([\d.]+)(px)?"/i);
    const heightMatch = svgContent.match(/height="([\d.]+)(px)?"/i);
    if (widthMatch && heightMatch) {
      const width = parseFloat(widthMatch[1]);
      const height = parseFloat(heightMatch[1]);
      if (!Number.isNaN(width) && !Number.isNaN(height) && height > 0) {
        return width / height;
      }
    }

    return 1;
  };

  const ensureCompleteMoleculeData = async (data: MoleculeData): Promise<MoleculeData> => {
    const needsHydration = !data.svgData || !data.sdfData || !data.sdf3DData;
    if (!needsHydration) {
      return data;
    }

    try {
      const refreshed = await getMoleculeByCID(data.cid);
      if (!refreshed) {
        console.warn('?? Reagent hydration returned null for CID', data.cid);
        return data;
      }

      const hydrated = {
        ...refreshed,
        // Preserve any enhanced/sanitised fields from the original payload
        name: data.name || refreshed.name,
        svgData: data.svgData ?? refreshed.svgData,
        sdfData: data.sdfData ?? refreshed.sdfData,
        sdf3DData: data.sdf3DData ?? refreshed.sdf3DData,
        role: data.role ?? refreshed.role,
        sourceQuery: data.sourceQuery ?? refreshed.sourceQuery,
        displayName: data.displayName ?? refreshed.displayName,
      };

      console.log(
        '? Hydrated molecule',
        hydrated.cid,
        {
          hasSVG: Boolean(hydrated.svgData),
          hasSDF2D: Boolean(hydrated.sdfData),
          hasSDF3D: Boolean(hydrated.sdf3DData),
          role: hydrated.role,
        }
      );
      return hydrated;
    } catch (error) {
      console.warn('?? Failed to hydrate molecule assets from PubChem, using existing payload', error);
      return data;
    }
  };

  const insertMoleculeToCanvas = async (incomingData: MoleculeData) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const moleculeData = await ensureCompleteMoleculeData(incomingData);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    let aspectRatio = getSvgAspectRatio(moleculeData.svgData);
    if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      const parsed = moleculeData.sdfData ? parseSDF(moleculeData.sdfData) : null;
      if (parsed && parsed.atoms.length > 0) {
        const bounds = parsed.atoms.reduce(
          (acc, atom) => ({
            minX: Math.min(acc.minX, atom.x),
            maxX: Math.max(acc.maxX, atom.x),
            minY: Math.min(acc.minY, atom.y),
            maxY: Math.max(acc.maxY, atom.y),
          }),
          {
            minX: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY,
          }
        );
        const width = Math.max(1, bounds.maxX - bounds.minX);
        const height = Math.max(1, bounds.maxY - bounds.minY);
        aspectRatio = width / height || 1;
      }
    }

    if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
      aspectRatio = 1;
    }

    const baseHeight = 180;
    const baseWidth = baseHeight * aspectRatio;
    const startX = centerX - baseWidth / 2;
    const startY = centerY - baseHeight / 2;
    const endX = centerX + baseWidth / 2;
    const endY = centerY + baseHeight / 2;

    const baseDisplayName =
      moleculeData.displayName ?? moleculeData.name ?? `CID ${moleculeData.cid}`;

    const displayName =
      moleculeData.role === 'reagent' &&
        baseDisplayName &&
        !baseDisplayName.toLowerCase().includes('reagent')
        ? `${baseDisplayName} (Reagent)`
        : baseDisplayName;

    const has3DSDF = Boolean(moleculeData.sdf3DData && moleculeData.sdf3DData.trim().length > 0);

    const newMolecule: Shape = {
      id: `molecule-${Date.now()}`,
      type: 'molecule',
      startX,
      startY,
      endX,
      endY,
      color: chemistryColor,
      strokeColor: chemistryStrokeColor,
      size: Math.max(baseWidth, baseHeight),
      rotation: 0,
      maintainAspect: true,
      aspectRatio,
      originalWidth: baseWidth,
      originalHeight: baseHeight,
      use3D: has3DSDF,
      rotation3D: { ...DEFAULT_MOLECULE_3D_ROTATION },
      moleculeData: {
        ...moleculeData,
        displayName,
      },
    };

    const updatedShapes = [...canvasHistoryRef.current, newMolecule];
    setShapes(updatedShapes);
    canvasHistoryRef.current = updatedShapes;
    setSelectedShapeId(newMolecule.id);
    setChemistryTool('move');

    if (moleculeData.role === 'mineral' || moleculeData.isCrystal) {
      if (moleculeData.codId) {
        setActiveMineralPreview({
          codId: moleculeData.codId,
          name: moleculeData.displayName ?? moleculeData.name,
        });
      }
    }

    if (onMoleculeInserted) {
      onMoleculeInserted(moleculeData);
    }

    console.log('? Molecule added to canvas:', newMolecule);
  };

  const insertProteinToCanvas = async (proteinData: PDBProteinData) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Fetch the PDB structure data
    try {
      const structure = await fetchPDBStructure(proteinData.entryId, 'pdb');
      if (!structure) {
        throw new Error('Failed to fetch PDB structure');
      }

      proteinData.pdbData = structure.data;
      proteinData.structureFormat = structure.format;
    } catch (error) {
      console.warn('Failed to fetch PDB structure, proceeding without it:', error);
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // For PDB proteins, use a fixed aspect ratio and size
    const aspectRatio = 1.5; // Typical protein structure aspect ratio
    const baseHeight = 200;
    const baseWidth = baseHeight * aspectRatio;
    const startX = centerX - baseWidth / 2;
    const startY = centerY - baseHeight / 2;
    const endX = centerX + baseWidth / 2;
    const endY = centerY + baseHeight / 2;

    const newProtein: Shape = {
      id: `protein-${Date.now()}`,
      type: 'protein',
      startX,
      startY,
      endX,
      endY,
      color: '#f97316', // Orange color for proteins
      strokeColor: '#f97316',
      size: Math.max(baseWidth, baseHeight),
      rotation: 0,
      maintainAspect: true,
      aspectRatio,
      originalWidth: baseWidth,
      originalHeight: baseHeight,
      use3D: true, // PDB structures are always 3D
      rotation3D: { ...DEFAULT_MOLECULE_3D_ROTATION },
      proteinData,
    };

    const updatedShapes = [...canvasHistoryRef.current, newProtein];
    setShapes(updatedShapes);
    canvasHistoryRef.current = updatedShapes;
    setSelectedShapeId(newProtein.id);
    setChemistryTool('move');

    console.log('🧬 PDB Protein added to canvas:', newProtein);
  };

  const buildFallbackReactionComponents = useCallback((smiles: string): ReactionComponentDetails[] => {
    if (!smiles || typeof smiles !== 'string') {
      return [];
    }

    const parts = smiles.split('>');
    const reactantSection = parts[0] ?? '';
    const agentSection = parts.length === 3 ? parts[1] ?? '' : '';
    const productSection = parts.length === 3 ? parts[2] ?? '' : parts[1] ?? '';

    const tokenize = (section: string, role: ReactionComponentDetails['role']): ReactionComponentDetails[] =>
      section
        .split('.')
        .map(token => token.trim())
        .filter(token => token.length > 0)
        .map(token => ({ role, original: token, smiles: token }));

    return [
      ...tokenize(reactantSection, 'reactant'),
      ...tokenize(agentSection, 'agent'),
      ...tokenize(productSection, 'product')
    ];
  }, []);

  interface ResolvedReactionComponent {
    component: ReactionComponentDetails;
    molecule: MoleculeData;
    sdfData: string | null;
  }

  const resolveReactionComponentsForSdf = useCallback(async (reactionData: any): Promise<ResolvedReactionComponent[]> => {
    const candidates: ReactionComponentDetails[] = Array.isArray(reactionData?.metadata?.components) && reactionData.metadata.components.length
      ? reactionData.metadata.components
      : buildFallbackReactionComponents(typeof reactionData?.smiles === 'string' ? reactionData.smiles : '');

    if (!candidates.length) {
      return [];
    }

    const resolved = await Promise.all(
      candidates.map(async (component) => {
        const identifiers = Array.from(
          new Set(
            [
              component.canonicalSmiles,
              component.smiles,
              component.label,
              component.original
            ].filter((value): value is string => Boolean(value))
          )
        );

        for (const candidate of identifiers) {
          try {
            const molecule = (await getMoleculeBySmiles(candidate)) ?? (await getMoleculeByName(candidate));
            if (!molecule) {
              continue;
            }

            const sdfPayload = molecule.sdf3DData ?? molecule.sdfData ?? null;
            if (sdfPayload) {
              component.smiles = molecule.smiles ?? component.smiles ?? candidate;
              component.canonicalSmiles = molecule.smiles ?? component.canonicalSmiles ?? null;
              return { component, molecule, sdfData: sdfPayload } as ResolvedReactionComponent;
            }

            component.smiles = molecule.smiles ?? component.smiles ?? candidate;
            component.canonicalSmiles = molecule.smiles ?? component.canonicalSmiles ?? null;
            return { component, molecule, sdfData: null } as ResolvedReactionComponent;
          } catch (candidateError) {
            console.warn('Failed to resolve reaction component:', candidate, candidateError);
          }
        }

        return null;
      })
    );

    return resolved.filter((entry): entry is ResolvedReactionComponent => Boolean(entry));
  }, [buildFallbackReactionComponents]);

  const createSdfShapesForReaction = useCallback((reactionShape: Shape & { type: 'reaction' }, resolvedComponents: ResolvedReactionComponent[]) => {
    if (!resolvedComponents.length) {
      return { shapes: [] as Shape[], shapeIds: [] as string[] };
    }

    const roleStyles: Record<ReactionComponentDetails['role'], { fill: string; stroke: string }> = {
      reactant: { fill: '#3b82f6', stroke: '#3b82f6' },
      product: { fill: '#10b981', stroke: '#10b981' },
      agent: { fill: '#a855f7', stroke: '#a855f7' }
    };

    const startX = Math.min(reactionShape.startX, reactionShape.endX);
    const endX = Math.max(reactionShape.startX, reactionShape.endX);
    const startY = Math.min(reactionShape.startY, reactionShape.endY);
    const endY = Math.max(reactionShape.startY, reactionShape.endY);
    const centerX = (startX + endX) / 2;
    const reactionHeight = endY - startY;
    const reactionWidth = endX - startX;

    const total = resolvedComponents.length;
    const moleculesPerRow = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(total))));
    const rows = Math.ceil(total / moleculesPerRow);
    const baseSize = Math.min(120, Math.max(72, reactionWidth / (moleculesPerRow + 1)));
    const horizontalSpacing = baseSize + 40;
    const verticalSpacing = baseSize + 40;
    const initialOffsetY = reactionHeight >= 0 ? endY + 60 : startY + 60;

    const shapes: Shape[] = [];
    const shapeIds: string[] = [];

    resolvedComponents.forEach((entry, index) => {
      if (!entry.sdfData) {
        return;
      }

      const row = Math.floor(index / moleculesPerRow);
      const col = index % moleculesPerRow;
      const offsetX = (col - (moleculesPerRow - 1) / 2) * horizontalSpacing;
      const centerY = initialOffsetY + row * verticalSpacing;
      const halfSize = baseSize / 2;

      const moleculeId = `reaction-molecule-${reactionShape.id}-${Date.now()}-${index}`;
      const palette = roleStyles[entry.component.role] ?? roleStyles.reactant;
      const displayLabel = entry.component.label || entry.component.original || `${entry.component.role} ${index + 1}`;

      const moleculeShape: Shape = {
        id: moleculeId,
        type: 'molecule',
        startX: centerX + offsetX - halfSize,
        startY: centerY - halfSize,
        endX: centerX + offsetX + halfSize,
        endY: centerY + halfSize,
        color: palette.fill,
        strokeColor: palette.stroke,
        size: baseSize,
        rotation: 0,
        maintainAspect: true,
        aspectRatio: 1,
        originalWidth: baseSize,
        originalHeight: baseSize,
        use3D: true,
        rotation3D: { ...DEFAULT_MOLECULE_3D_ROTATION },
        moleculeData: {
          ...entry.molecule,
          sdfData: entry.molecule.sdf3DData ?? entry.molecule.sdfData ?? entry.sdfData,
          sdf3DData: entry.molecule.sdf3DData ?? entry.molecule.sdfData ?? entry.sdfData,
          displayName: displayLabel,
          smiles: entry.component.canonicalSmiles ?? entry.component.smiles ?? entry.molecule.smiles ?? ''
        }
      };

      shapes.push(moleculeShape);
      shapeIds.push(moleculeId);
    });

    return { shapes, shapeIds };
  }, []);

  const insertReactionToCanvas = async (reactionData: ReactionSearchResult | any) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // For reactions, use a wider aspect ratio to accommodate reaction schemes
    const aspectRatio = 2.5; // Wider aspect ratio for reactions
    const baseHeight = 150;
    const baseWidth = baseHeight * aspectRatio;
    const startX = centerX - baseWidth / 2;
    const startY = centerY - baseHeight / 2;
    const endX = centerX + baseWidth / 2;
    const endY = centerY + baseHeight / 2;

    const reactionId = `reaction-${Date.now()}`;

    // Handle new ReactionSearchResult structure with payload and svgData
    const processedReactionData = reactionData.payload && reactionData.svgData ? {
      type: 'reaction',
      svg: reactionData.svgData,
      smiles: reactionData.payload['reaction smiles'],
      name: reactionData.payload['reaction name '],
      description: reactionData.payload['Reaction Description'],
      reactants: reactionData.payload.reactants,
      products: reactionData.payload.products,
      conditions: reactionData.payload.condition,
      timestamp: Date.now(),
      includeSDF: Boolean(reactionData.includeSDF ?? reactionData.includeSdf),
      metadata: reactionData.metadata
    } : {
      ...reactionData,
      includeSDF: Boolean(reactionData.includeSDF),
      sdfShapeIds: Array.isArray(reactionData.sdfShapeIds) ? [...reactionData.sdfShapeIds] : [],
      metadata: reactionData.metadata
    };

    const baseReactionData = {
      ...processedReactionData,
      includeSDF: Boolean(processedReactionData.includeSDF),
      sdfShapeIds: Array.isArray(processedReactionData.sdfShapeIds) ? [...processedReactionData.sdfShapeIds] : []
    };

    let sdfMoleculeShapes: Shape[] = [];

    const newReaction: Shape = {
      id: reactionId,
      type: 'reaction',
      startX,
      startY,
      endX,
      endY,
      color: '#ea580c',
      strokeColor: '#ea580c',
      size: Math.max(baseWidth, baseHeight),
      rotation: 0,
      maintainAspect: true,
      aspectRatio,
      originalWidth: baseWidth,
      originalHeight: baseHeight,
      use3D: false,
      reactionData: baseReactionData,
    };

    if (baseReactionData.includeSDF) {
      try {
        const resolvedComponents = await resolveReactionComponentsForSdf(baseReactionData);
        const { shapes: generatedShapes, shapeIds } = createSdfShapesForReaction(newReaction as Shape & { type: 'reaction' }, resolvedComponents);
        sdfMoleculeShapes = generatedShapes;
        baseReactionData.sdfShapeIds = shapeIds;
      } catch (error) {
        console.warn('Failed to fetch SDF models for reaction:', error);
      }
    }

    const finalizedReaction: Shape = {
      ...newReaction,
      reactionData: {
        ...baseReactionData,
      }
    };

    const updatedShapes = [...canvasHistoryRef.current.filter(shape => shape.id !== reactionId), finalizedReaction, ...sdfMoleculeShapes];
    setShapes(updatedShapes);
    canvasHistoryRef.current = updatedShapes;
    setSelectedShapeId(finalizedReaction.id);
    setChemistryTool('move');

    console.log('⚗️ Reaction added to canvas:', finalizedReaction);
  };

  const handleExternalMoleculeInsertion = useCallback(async (request: CanvasMoleculePlacementRequest) => {
    if (!request || (!request.cid && !request.smiles && !request.name)) {
      console.warn('Molecule insertion request missing identifiers', request);
      return false;
    }

    try {
      let resolved: MoleculeData | null = null;

      if (request.cid !== undefined && request.cid !== null) {
        const numericCid = typeof request.cid === 'string' ? Number(request.cid) : request.cid;
        if (!Number.isNaN(numericCid)) {
          resolved = await getMoleculeByCID(numericCid);
        }
      }

      if (!resolved && request.smiles) {
        resolved = await getMoleculeBySmiles(request.smiles);
      }

      if (!resolved && request.name) {
        resolved = await getMoleculeByName(request.name);
      }

      if (!resolved) {
        console.warn('Unable to resolve molecule for canvas insertion', request);
        return false;
      }

      const displayName = request.displayLabel || request.name || resolved.displayName || resolved.name;

      await insertMoleculeToCanvas({
        ...resolved,
        displayName,
        role: request.role || resolved.role
      });

      return true;
    } catch (error) {
      console.error('Failed to insert molecule requested by Gemini Live', error);
      return false;
    }
  }, [insertMoleculeToCanvas]);

  const handleExternalProteinInsertion = useCallback(async (request: CanvasProteinPlacementRequest) => {
    if (!request?.entryId) {
      return false;
    }

    const trimmedId = request.entryId.trim();
    if (!trimmedId) {
      return false;
    }

    const entryId = trimmedId.toUpperCase();
    const lowerId = entryId.toLowerCase();
    const displayName = request.displayName || request.title || `PDB ${entryId}`;

    const proteinPayload: PDBProteinData = {
      entryId,
      title: request.title || displayName,
      description: request.description || '',
      organism: request.organism || 'Unknown',
      method: request.method || 'Unknown',
      depositionDate: request.depositionDate || '',
      pdbUrl: `${DEFAULT_PDB_DOWNLOAD_URL}/${entryId}.pdb`,
      cifUrl: `${DEFAULT_PDB_ENTRY_FILES_URL}/${lowerId}.cif`,
      mmcifUrl: `${DEFAULT_PDB_ENTRY_FILES_URL}/${lowerId}.cif`,
      displayName,
      source: 'pdb',
      type: 'protein'
    };

    try {
      await insertProteinToCanvas(proteinPayload);
      return true;
    } catch (error) {
      console.error('Failed to insert protein requested by Gemini Live', error);
      return false;
    }
  }, [insertProteinToCanvas]);

  const handleExternalReactionInsertion = useCallback(async (request: CanvasReactionPlacementRequest) => {
    if (!request?.reactionSmiles) {
      return false;
    }

    try {
      const sanitized = sanitizeReactionSmilesInput(request.reactionSmiles) || request.reactionSmiles;
      const stripped = stripAtomMappings(sanitized);
      if (!stripped || !stripped.includes('>')) {
        console.warn('Reaction request does not contain a valid SMILES arrow', request.reactionSmiles);
        return false;
      }

      const svg = await reactionSmilesToSVGHuggingFace(stripped);
      if (!svg) {
        console.warn('Failed to render reaction SVG for canvas insertion');
        return false;
      }

      const payload: StructuredReactionPayload = {
        'reaction name ': request.title || 'Reaction scheme',
        'reaction smiles': stripped,
        condition: [],
        reactants: [],
        products: [],
        'reaction smiles with conditions': stripped,
        'Reaction Description': request.description || ''
      };

      await insertReactionToCanvas({
        payload,
        svgData: svg,
        includeSDF: Boolean(request.includeSdf),
        metadata: request.metadata
      });

      return true;
    } catch (error) {
      console.error('Failed to insert reaction requested by Gemini Live', error);
      return false;
    }
  }, [insertReactionToCanvas]);

  useEffect(() => {
    if (onRegisterMoleculeInjectionHandler) {
      onRegisterMoleculeInjectionHandler(handleExternalMoleculeInsertion);
    }
  }, [handleExternalMoleculeInsertion, onRegisterMoleculeInjectionHandler]);

  useEffect(() => {
    if (onRegisterProteinInjectionHandler) {
      onRegisterProteinInjectionHandler(handleExternalProteinInsertion);
    }
  }, [handleExternalProteinInsertion, onRegisterProteinInjectionHandler]);

  useEffect(() => {
    if (onRegisterReactionInjectionHandler) {
      onRegisterReactionInjectionHandler(handleExternalReactionInsertion);
    }
  }, [handleExternalReactionInsertion, onRegisterReactionInjectionHandler]);

  const handleAddSdfModelsToReaction = useCallback(async (reactionShapeId: string) => {
    setReactionSdfError(null);
    setReactionSdfLoadingId(reactionShapeId);

    try {
      const reactionShape = canvasHistoryRef.current.find(shape => shape.id === reactionShapeId && shape.type === 'reaction');
      if (!reactionShape || !reactionShape.reactionData) {
        throw new Error('Could not locate the selected reaction on the canvas.');
      }

      const existingSdfIds = Array.isArray(reactionShape.reactionData.sdfShapeIds)
        ? reactionShape.reactionData.sdfShapeIds
        : [];

      let workingShapes = canvasHistoryRef.current.filter(shape => !existingSdfIds.includes(shape.id));

      const resolvedComponents = await resolveReactionComponentsForSdf(reactionShape.reactionData);
      if (!resolvedComponents.length) {
        throw new Error('Unable to resolve molecular components for this reaction.');
      }

      const { shapes: newSdfShapes, shapeIds } = createSdfShapesForReaction(reactionShape as Shape & { type: 'reaction' }, resolvedComponents);
      if (!newSdfShapes.length) {
        throw new Error('No 3D models were returned for this reaction.');
      }

      const updatedReaction: Shape = {
        ...reactionShape,
        reactionData: {
          ...reactionShape.reactionData,
          includeSDF: true,
          sdfShapeIds: shapeIds
        }
      };

      workingShapes = workingShapes.map(shape => (shape.id === reactionShapeId ? updatedReaction : shape));

      const updatedShapes = [...workingShapes, ...newSdfShapes];
      canvasHistoryRef.current = updatedShapes;
      setShapes(updatedShapes);
      setSelectedShapeId(reactionShapeId);
    } catch (error) {
      console.error('Failed to add SDF models for reaction:', error);
      setReactionSdfError({
        id: reactionShapeId,
        message: error instanceof Error ? error.message : 'Failed to add 3D models for this reaction.'
      });
    } finally {
      setReactionSdfLoadingId(null);
    }
  }, [createSdfShapesForReaction, resolveReactionComponentsForSdf]);

  const drawAreaEraseOverlay = (
    ctx: CanvasRenderingContext2D,
    selection: { startX: number; startY: number; currentX: number; currentY: number }
  ) => {
    const minX = Math.min(selection.startX, selection.currentX);
    const minY = Math.min(selection.startY, selection.currentY);
    const width = Math.abs(selection.currentX - selection.startX);
    const height = Math.abs(selection.currentY - selection.startY);

    ctx.save();
    ctx.strokeStyle = '#f87171';
    ctx.fillStyle = 'rgba(248, 113, 113, 0.15)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(minX, minY, width, height);
    ctx.fillRect(minX, minY, width, height);
    ctx.restore();
  };

  // Draw lasso selection path
  const drawLassoOverlay = (ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) => {
    if (points.length < 2) return;

    ctx.save();

    // Draw lasso path line
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Draw semi-transparent fill inside lasso
    if (points.length >= 3) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Draw start point indicator
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, 4, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
  };

  // Helper function to detect which resize handle is being clicked
  const detectResizeHandle = (
    x: number,
    y: number,
    shape: Shape
  ): 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' | null => {
    const handleSize = 12;
    const { minX, minY, maxX, maxY } = getShapeBounds(shape);

    // Define handle positions using normalized bounds
    const handles = {
      tl: { x: minX, y: minY },
      tr: { x: maxX, y: minY },
      bl: { x: minX, y: maxY },
      br: { x: maxX, y: maxY },
      t: { x: (minX + maxX) / 2, y: minY },
      b: { x: (minX + maxX) / 2, y: maxY },
      l: { x: minX, y: (minY + maxY) / 2 },
      r: { x: maxX, y: (minY + maxY) / 2 }
    };

    // Check which handle is closest to the click
    for (const [handleName, handlePos] of Object.entries(handles)) {
      const dist = Math.sqrt(
        Math.pow(x - handlePos.x, 2) + Math.pow(y - handlePos.y, 2)
      );
      if (dist < handleSize) {
        return handleName as 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
      }
    }
    return null;
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Check if clicking on empty canvas space (not on shapes) for deselection
    let clickedOnShape = false;
    for (let i = canvasHistoryRef.current.length - 1; i >= 0; i--) {
      const shape = canvasHistoryRef.current[i];
      const bounds = getShapeBounds(shape);
      if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) {
        clickedOnShape = true;
        break;
      }
    }

    // If not clicking on a shape, deselect current selection
    if (!clickedOnShape) {
      setSelectedShapeId(null);
      // Don't return here - allow other logic to run if needed
    }

    if (annotationMode && annotationMode.shapeId === selectedShapeId && e.button === 0) {
      e.preventDefault();
      const projections = moleculeProjectionRef.current.get(annotationMode.shapeId) || [];
      if (projections.length === 0) {
        setAnnotationHint('No molecular coordinates available yet. Try again after the structure renders.');
        setAnnotationMode(null);
        return;
      }

      let nearest = { index: -1, distance: Number.POSITIVE_INFINITY };
      projections.forEach(point => {
        const dist = Math.hypot(point.x - x, point.y - y);
        if (dist < nearest.distance) {
          nearest = { index: point.atomIndex, distance: dist };
        }
      });

      const MAX_DISTANCE = 48;
      if (nearest.index === -1 || nearest.distance > MAX_DISTANCE) {
        setAnnotationHint('Click closer to the atom you want to annotate.');
        return;
      }

      updateShapeById(annotationMode.shapeId, shape => ({
        ...shape,
        annotations: [
          ...(shape.annotations ?? []),
          {
            id: `annotation-${Date.now()}`,
            atomIndex: nearest.index,
            label: annotationMode.label.trim() || 'Annotation',
            color: annotationMode.color,
          }
        ]
      }));

      setAnnotationHint('Annotation added.');
      setAnnotationMode(null);
      setIsDrawing(false);
      return;
    }

    const activeTool = showChemistryToolbar ? chemistryTool : currentTool;

    // Lasso selection for eraser (free-hand lasso mode with Ctrl key)
    if (activeTool === 'eraser' && e.ctrlKey) {
      console.log('Lasso selection started at:', { x, y });
      setLassoSelection({
        points: [{ x, y }],
        isActive: true
      });
      setIsDrawing(false);
      return;
    }

    if (activeTool === 'eraser' && e.shiftKey) {
      setAreaEraseSelection({
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        isActive: true
      });
      setIsDrawing(false);
      return;
    }

    // Handle textbox tool - show text input overlay
    if (activeTool === 'textbox') {
      setTextInputPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsTextInputVisible(true);
      setIsDrawing(false);
      return;
    }

    // Handle Rotate tool - supports 3D orbit (left drag) and 2D rotation (right drag)
    if (activeTool === 'rotate') {
      for (let i = canvasHistoryRef.current.length - 1; i >= 0; i--) {
        const shape = canvasHistoryRef.current[i];
        const dx = shape.endX - shape.startX;
        const dy = shape.endY - shape.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const centerX = shape.startX + dx / 2;
        const centerY = shape.startY + dy / 2;
        const tolerance = Math.max(distance / 2 + 10, 20);
        const distToShape = Math.hypot(x - centerX, y - centerY);

        if (distToShape < tolerance) {
          setSelectedShapeId(shape.id);

          const has3DData =
            shape.type === 'molecule' &&
            shape.moleculeData?.sdf3DData &&
            shape.use3D;

          if (has3DData && e.button === 0 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setIsRotating3DShape(true);
            rotate3DStateRef.current = {
              startClientX: e.clientX,
              startClientY: e.clientY,
              baseX: shape.rotation3D?.x ?? -25,
              baseY: shape.rotation3D?.y ?? 35
            };
            return;
          }

          if (e.button === 2 || e.ctrlKey) {
            e.preventDefault();
            setIsRotatingShape(true);
            setDragOffset({ x: x - centerX, y: y - centerY });
            return;
          }

          break;
        }
      }

      // If rotate tool was used without qualifying click, do nothing further
      return;
    }

    // Handle Move/Select tool - move and resize existing shapes
    if (activeTool === 'move') {
      for (let i = canvasHistoryRef.current.length - 1; i >= 0; i--) {
        const shape = canvasHistoryRef.current[i];
        const bounds = getShapeBounds(shape);
        const centerX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
        const centerY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
        const isWithinBounds =
          x >= bounds.minX &&
          x <= bounds.maxX &&
          y >= bounds.minY &&
          y <= bounds.maxY;

        // If shape already selected, check for resize handle interaction first
        if (selectedShapeId === shape.id) {
          const handle = detectResizeHandle(x, y, shape);
          if (handle) {
            setResizeHandle(handle);
            setIsResizing(true);
            return;
          }
        }

        if (isWithinBounds) {
          setSelectedShapeId(shape.id);
          setIsDraggingShape(true);
          setDragOffset({ x: x - centerX, y: y - centerY });
          return;
        }
      }

      setSelectedShapeId(null);
      return;
    }

    // Special handling for textbox tool
    if (activeTool === 'textbox') {
      setTextInputPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setCurrentTextInput('');
      setIsTextInputVisible(true);
      setIsDrawing(false);
      return;
    }

    // Special handling for shape tools - create resizable single shape
    const shapeTools = ['arrow', 'circle', 'square', 'triangle', 'hexagon', 'plus', 'minus'];
    if (shapeTools.includes(activeTool)) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Save current canvas state for redrawing
      imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

      setArrowState({
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        isDrawing: true
      });
      return;
    }

    // Normal drawing for other tools
    setIsDrawing(true);
    setLastX(x);
    setLastY(y);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    if (annotationMode && annotationMode.shapeId === selectedShapeId) {
      return;
    }

    if (isRotating3DShape && selectedShapeId && rotate3DStateRef.current) {
      const start = rotate3DStateRef.current;
      const deltaX = e.clientX - start.startClientX;
      const deltaY = e.clientY - start.startClientY;
      const sensitivity = 0.45;

      const nextRotationX = start.baseX + deltaY * sensitivity;
      const nextRotationY = start.baseY + deltaX * sensitivity;

      updateShapeById(selectedShapeId, shape => ({
        ...shape,
        rotation3D: {
          x: Math.max(-180, Math.min(180, nextRotationX)),
          y: ((nextRotationY % 360) + 360) % 360
        }
      }));

      return;
    }

    // Handle lasso selection for eraser
    if (lassoSelection.isActive) {
      console.log('Lasso point added:', { x, y }, 'Total points:', lassoSelection.points.length + 1);
      setLassoSelection(prev => ({
        ...prev,
        points: [...prev.points, { x, y }]
      }));
      return;
    }

    if (areaEraseSelection?.isActive) {
      setAreaEraseSelection(prev =>
        prev ? { ...prev, currentX: x, currentY: y } : prev
      );
      return;
    }

    const activeTool = showChemistryToolbar ? chemistryTool : currentTool;
    const activeStrokeColor = showChemistryToolbar ? chemistryStrokeColor : strokeColor;
    const activeFillColor = showChemistryToolbar ? chemistryFillColor : activeStrokeColor;
    const activeFillEnabled = showChemistryToolbar ? chemistryFillEnabled : true;
    const activeSize = showChemistryToolbar ? chemistrySize : strokeWidth;
    const fillConfig = {
      fillColor: activeFillColor,
      fillEnabled: activeFillEnabled && FILLABLE_SHAPES.has(activeTool),
    };

    // Handle moving existing shape
    if (isDraggingShape && selectedShapeId) {
      // Update shape position
      const updatedShapes = canvasHistoryRef.current.map(shape => {
        if (shape.id === selectedShapeId) {
          const newCenterX = x - dragOffset.x;
          const newCenterY = y - dragOffset.y;
          const dx = shape.endX - shape.startX;
          const dy = shape.endY - shape.startY;

          return {
            ...shape,
            startX: newCenterX - dx / 2,
            startY: newCenterY - dy / 2,
            endX: newCenterX + dx / 2,
            endY: newCenterY + dy / 2
          };
        }
        return shape;
      });

      setShapes(updatedShapes);
      canvasHistoryRef.current = updatedShapes;
      return;
    }

    // Handle rotating existing shape
    if (isRotatingShape && selectedShapeId) {
      // Calculate rotation angle from center
      const shape = canvasHistoryRef.current.find(s => s.id === selectedShapeId);
      if (shape) {
        const dx = shape.endX - shape.startX;
        const dy = shape.endY - shape.startY;
        const centerX = shape.startX + dx / 2;
        const centerY = shape.startY + dy / 2;

        // Calculate angle from center to current mouse position
        const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);

        // Update shape rotation
        const updatedShapes = canvasHistoryRef.current.map(s => {
          if (s.id === selectedShapeId) {
            return {
              ...s,
              rotation: (angle + 90) % 360  // Adjust angle so 0 is up
            };
          }
          return s;
        });

        setShapes(updatedShapes);
        canvasHistoryRef.current = updatedShapes;
      }
      return;
    }

    // Handle resizing existing shape
    if (isResizing && selectedShapeId && resizeHandle) {
      const shapeIndex = canvasHistoryRef.current.findIndex(s => s.id === selectedShapeId);
      if (shapeIndex >= 0) {
        const shape = canvasHistoryRef.current[shapeIndex];
        const bounds = getShapeBounds(shape);
        let newMinX = bounds.minX;
        let newMaxX = bounds.maxX;
        let newMinY = bounds.minY;
        let newMaxY = bounds.maxY;
        const MIN_SIZE = 16;

        if (resizeHandle.includes('l')) {
          newMinX = Math.min(x, newMaxX - MIN_SIZE);
        }
        if (resizeHandle.includes('r')) {
          newMaxX = Math.max(x, newMinX + MIN_SIZE);
        }
        if (resizeHandle.includes('t')) {
          newMinY = Math.min(y, newMaxY - MIN_SIZE);
        }
        if (resizeHandle.includes('b')) {
          newMaxY = Math.max(y, newMinY + MIN_SIZE);
        }

        if (resizeHandle === 'l') {
          newMaxX = bounds.maxX;
        } else if (resizeHandle === 'r') {
          newMinX = bounds.minX;
        }

        if (resizeHandle === 't') {
          newMaxY = bounds.maxY;
        } else if (resizeHandle === 'b') {
          newMinY = bounds.minY;
        }

        // Recompute width/height ensuring minimum size
        let finalMinX = Math.min(newMinX, newMaxX);
        let finalMaxX = Math.max(newMinX, newMaxX);
        let finalMinY = Math.min(newMinY, newMaxY);
        let finalMaxY = Math.max(newMinY, newMaxY);
        let width = Math.max(MIN_SIZE, finalMaxX - finalMinX);
        let height = Math.max(MIN_SIZE, finalMaxY - finalMinY);

        if (shape.maintainAspect && shape.aspectRatio) {
          const aspect = shape.aspectRatio;
          const horizontalHandle = resizeHandle.includes('l') ? 'l' : resizeHandle.includes('r') ? 'r' : null;
          const verticalHandle = resizeHandle.includes('t') ? 't' : resizeHandle.includes('b') ? 'b' : null;

          if (resizeHandle === 't' || resizeHandle === 'b') {
            width = Math.max(MIN_SIZE, height * aspect);
          } else if (resizeHandle === 'l' || resizeHandle === 'r') {
            height = Math.max(MIN_SIZE, width / aspect);
          } else {
            const heightFromWidth = width / aspect;
            const widthFromHeight = height * aspect;
            if (heightFromWidth > height) {
              height = Math.max(MIN_SIZE, heightFromWidth);
            } else {
              width = Math.max(MIN_SIZE, widthFromHeight);
            }
          }

          if (!horizontalHandle) {
            const centerX = (finalMinX + finalMaxX) / 2;
            finalMinX = centerX - width / 2;
            finalMaxX = centerX + width / 2;
          } else if (horizontalHandle === 'l') {
            finalMaxX = Math.max(finalMaxX, finalMinX);
            finalMinX = finalMaxX - width;
          } else if (horizontalHandle === 'r') {
            finalMinX = Math.min(finalMinX, finalMaxX);
            finalMaxX = finalMinX + width;
          }

          if (!verticalHandle) {
            const centerY = (finalMinY + finalMaxY) / 2;
            finalMinY = centerY - height / 2;
            finalMaxY = centerY + height / 2;
          } else if (verticalHandle === 't') {
            finalMaxY = Math.max(finalMaxY, finalMinY);
            finalMinY = finalMaxY - height;
          } else if (verticalHandle === 'b') {
            finalMinY = Math.min(finalMinY, finalMaxY);
            finalMaxY = finalMinY + height;
          }
        }

        finalMinX = Math.min(finalMinX, finalMaxX);
        finalMaxX = Math.max(finalMinX, finalMaxX);
        finalMinY = Math.min(finalMinY, finalMaxY);
        finalMaxY = Math.max(finalMinY, finalMaxY);
        width = Math.max(MIN_SIZE, finalMaxX - finalMinX);
        height = Math.max(MIN_SIZE, finalMaxY - finalMinY);

        const updatedShape: Shape = {
          ...shape,
          startX: finalMinX,
          startY: finalMinY,
          endX: finalMaxX,
          endY: finalMaxY,
          size: Math.max(width, height)
        };

        const updatedShapes = [...canvasHistoryRef.current];
        updatedShapes[shapeIndex] = updatedShape;
        canvasHistoryRef.current = updatedShapes;
        setShapes(updatedShapes);
      }
      return;
    }

    // Handle shape preview while dragging (arrow, circle, square, triangle, hexagon, plus, minus)
    const shapeTools = ['arrow', 'circle', 'square', 'triangle', 'hexagon', 'plus', 'minus'];
    if (shapeTools.includes(activeTool) && arrowState && arrowState.isDrawing && imageDataRef.current) {
      // Restore previous canvas state
      ctx.putImageData(imageDataRef.current, 0, 0);

      // Redraw grid if needed
      if (showGrid) {
        drawGrid(ctx, canvas.width, canvas.height);
      }

      // Update shape end position
      setArrowState({
        ...arrowState,
        endX: x,
        endY: y
      });

      // Calculate size based on distance from start to end
      const dx = x - arrowState.startX;
      const dy = y - arrowState.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const centerX = arrowState.startX + dx / 2;
      const centerY = arrowState.startY + dy / 2;

      // Draw preview based on active tool
      if (activeTool === 'arrow') {
        drawArrow(ctx, arrowState.startX, arrowState.startY, x, y, activeSize, activeStrokeColor);
      } else if (activeTool === 'circle') {
        drawCircle(ctx, centerX, centerY, distance / 2, activeStrokeColor, fillConfig);
      } else if (activeTool === 'square') {
        drawSquare(ctx, centerX, centerY, distance, activeStrokeColor, fillConfig);
      } else if (activeTool === 'triangle') {
        drawTriangle(ctx, centerX, centerY, distance, activeStrokeColor, fillConfig);
      } else if (activeTool === 'hexagon') {
        drawHexagon(ctx, centerX, centerY, distance / 2, activeStrokeColor, fillConfig);
      } else if (activeTool === 'plus') {
        drawPlus(ctx, centerX, centerY, distance / 2, activeSize, activeStrokeColor);
      } else if (activeTool === 'minus') {
        drawMinus(ctx, centerX, centerY, distance / 2, activeSize, activeStrokeColor);
      }
      return;
    }

    // Normal drawing for other tools
    if (!isDrawing) return;

    // Use chemistry tool settings if chemistry toolbar is active
    const activeColorNormal = activeStrokeColor;
    const activeSizeNormal = showChemistryToolbar ? chemistrySize : strokeWidth;
    const activeToolNormal = showChemistryToolbar ? chemistryTool : currentTool;
    const fillConfigNormal = {
      fillColor: activeFillColor,
      fillEnabled: activeFillEnabled && FILLABLE_SHAPES.has(activeToolNormal),
    };

    if (activeToolNormal === 'pen' || activeToolNormal === 'draw') {
      ctx.strokeStyle = activeColorNormal;
      ctx.lineWidth = activeSizeNormal;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (activeToolNormal === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = activeSizeNormal * 2;
      ctx.lineCap = 'round';

      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
    } else if (activeToolNormal === 'atom') {
      drawAtom(ctx, x, y, activeSizeNormal, activeColorNormal);
    } else if (activeToolNormal === 'bond') {
      drawBond(ctx, lastX, lastY, x, y, activeSizeNormal, activeColorNormal);
    } else if (activeToolNormal === 'electron') {
      drawElectron(ctx, x, y, activeSizeNormal, activeColorNormal);
    } else if (activeToolNormal === 'circle') {
      drawCircle(ctx, x, y, activeSizeNormal * 3, activeColorNormal, fillConfigNormal);
    } else if (activeToolNormal === 'square') {
      drawSquare(ctx, x, y, activeSizeNormal * 3, activeColorNormal, fillConfigNormal);
    } else if (activeToolNormal === 'triangle') {
      drawTriangle(ctx, x, y, activeSizeNormal * 3, activeColorNormal, fillConfigNormal);
    } else if (activeToolNormal === 'hexagon') {
      drawHexagon(ctx, x, y, activeSizeNormal * 3, activeColorNormal, fillConfigNormal);
    }

    setLastX(x);
    setLastY(y);
  };

  // Chemistry drawing functions
  interface ShapeDrawOptions {
    fillColor?: string;
    fillEnabled?: boolean;
    strokeWidth?: number;
  }

  const drawAtom = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size * 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  };

  const drawBond = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, size: number, color: string) => {
    const headlen = Math.max(size * 8, 15); // Proportional arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw arrow line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw filled arrowhead (triangle)
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  const drawElectron = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
    ctx.fill();
  };

  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
    options?: ShapeDrawOptions
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = options?.strokeWidth ?? 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    if (options?.fillEnabled !== false) {
      ctx.fillStyle = options?.fillColor ?? color;
      ctx.fill();
    }
    ctx.stroke();
  };

  const drawSquare = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    options?: ShapeDrawOptions
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = options?.strokeWidth ?? 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.rect(x - size / 2, y - size / 2, size, size);
    if (options?.fillEnabled !== false) {
      ctx.fillStyle = options?.fillColor ?? color;
      ctx.fill();
    }
    ctx.stroke();
  };

  const drawTriangle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    options?: ShapeDrawOptions
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = options?.strokeWidth ?? 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - size / 2);
    ctx.lineTo(x - size / 2, y + size / 2);
    ctx.lineTo(x + size / 2, y + size / 2);
    ctx.closePath();
    if (options?.fillEnabled !== false) {
      ctx.fillStyle = options?.fillColor ?? color;
      ctx.fill();
    }
    ctx.stroke();
  };

  const drawHexagon = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    color: string,
    options?: ShapeDrawOptions
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = options?.strokeWidth ?? 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    if (options?.fillEnabled !== false) {
      ctx.fillStyle = options?.fillColor ?? color;
      ctx.fill();
    }
    ctx.stroke();
  };

  const drawPlus = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, strokeWidth: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.stroke();
  };

  const drawMinus = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, strokeWidth: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.stroke();
  };

  const drawMolecule = async (ctx: CanvasRenderingContext2D, shape: Shape) => {
    const data = shape.moleculeData;
    if (!data) {
      console.warn('Molecule data not available for shape:', shape);
      return;
    }

    const width = Math.abs(shape.endX - shape.startX);
    const height = Math.abs(shape.endY - shape.startY);
    const centerX = shape.startX + width / 2;
    const centerY = shape.startY + height / 2;
    const rotation = (shape.rotation ?? 0) * (Math.PI / 180);
    const is3DMode = Boolean(shape.use3D && data.sdf3DData);
    const cosRotation = Math.cos(rotation);
    const sinRotation = Math.sin(rotation);

    const storeProjection = (projected: Array<{ atomIndex: number; x: number; y: number }>) => {
      if (!projected.length) {
        moleculeProjectionRef.current.delete(shape.id);
        return;
      }

      const globalPoints = projected.map(point => ({
        atomIndex: point.atomIndex,
        x: centerX + point.x * cosRotation - point.y * sinRotation,
        y: centerY + point.x * sinRotation + point.y * cosRotation
      }));

      moleculeProjectionRef.current.set(shape.id, globalPoints);
    };

    const renderAnnotationsOverlay = () => {
      const annotations = shape.annotations ?? [];
      if (!annotations.length) return;

      const projection = moleculeProjectionRef.current.get(shape.id);
      if (!projection || projection.length === 0) return;

      ctx.save();
      annotations.forEach(annotation => {
        const target = projection.find(point => point.atomIndex === annotation.atomIndex);
        if (!target) return;

        const markerRadius = 7;
        const labelPadding = 6;
        const labelHeight = 18;
        const labelOffsetX = 14;
        const labelOffsetY = -22;
        const labelText = annotation.label || 'Annotation';

        ctx.fillStyle = annotation.color;
        ctx.beginPath();
        ctx.arc(target.x, target.y, markerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        const labelX = target.x + labelOffsetX;
        const labelY = target.y + labelOffsetY;
        ctx.font = '12px "Inter", sans-serif';
        const metrics = ctx.measureText(labelText);
        const labelWidth = metrics.width + labelPadding * 2;

        ctx.beginPath();
        ctx.moveTo(target.x + markerRadius, target.y);
        ctx.lineTo(labelX, labelY + labelHeight / 2);
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(labelX, labelY, labelWidth, labelHeight);

        ctx.fillStyle = '#e2e8f0';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, labelX + labelPadding, labelY + labelHeight / 2);
      });
      ctx.restore();
    };

    const render2DStructure = (parsed: ParsedSDF) => {
      if (!parsed.atoms.length) return;

      const atomBounds = parsed.atoms.reduce(
        (acc, atom) => ({
          minX: Math.min(acc.minX, atom.x),
          maxX: Math.max(acc.maxX, atom.x),
          minY: Math.min(acc.minY, atom.y),
          maxY: Math.max(acc.maxY, atom.y)
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY
        }
      );

      const structureWidth = Math.max(1, atomBounds.maxX - atomBounds.minX);
      const structureHeight = Math.max(1, atomBounds.maxY - atomBounds.minY);
      const padding = Math.min(width, height) * 0.1;
      const availableWidth = Math.max(10, width - padding * 2);
      const availableHeight = Math.max(10, height - padding * 2);
      const scale = Math.min(availableWidth / structureWidth, availableHeight / structureHeight);

      const centerAtomX = (atomBounds.minX + atomBounds.maxX) / 2;
      const centerAtomY = (atomBounds.minY + atomBounds.maxY) / 2;
      const bondStrokeWidth = Math.max(1.2, Math.min(width, height) * 0.02);
      const multipleBondOffset = bondStrokeWidth;
      const atomRadius = Math.max(3, Math.min(width, height) * 0.04);

      const project = (atom: { x: number; y: number }) => ({
        x: (atom.x - centerAtomX) * scale,
        y: (centerAtomY - atom.y) * scale
      });

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const projectedAtoms = parsed.atoms.map((atom, index) => ({
        atomIndex: index,
        ...project(atom)
      }));

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = bondStrokeWidth;

      parsed.bonds.forEach(bond => {
        const atom1 = projectedAtoms[bond.from];
        const atom2 = projectedAtoms[bond.to];
        if (!atom1 || !atom2) return;

        const drawBondLine = (offsetX: number, offsetY: number) => {
          ctx.beginPath();
          ctx.moveTo(atom1.x + offsetX, atom1.y + offsetY);
          ctx.lineTo(atom2.x + offsetX, atom2.y + offsetY);
          ctx.stroke();
        };

        drawBondLine(0, 0);

        if (bond.type === 2 || bond.type === 3) {
          const dx = atom2.x - atom1.x;
          const dy = atom2.y - atom1.y;
          const len = Math.hypot(dx, dy) || 1;
          const offsetX = (-dy / len) * multipleBondOffset;
          const offsetY = (dx / len) * multipleBondOffset;

          drawBondLine(offsetX, offsetY);

          if (bond.type === 3) {
            drawBondLine(-offsetX, -offsetY);
          }
        }
      });

      projectedAtoms.forEach(atom => {
        const color = ATOM_COLORS[parsed.atoms[atom.atomIndex].element] || '#cbd5f5';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, atomRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();

        const elementSymbol = parsed.atoms[atom.atomIndex].element;
        if (elementSymbol !== 'H') {
          ctx.fillStyle = '#0f172a';
          ctx.font = `${Math.max(10, atomRadius * 1.8)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(elementSymbol, atom.x, atom.y);
        }
      });

      ctx.restore();

      const projectionPayload = projectedAtoms.map(atom => ({
        atomIndex: atom.atomIndex,
        x: atom.x,
        y: atom.y
      }));
      storeProjection(projectionPayload);
      renderAnnotationsOverlay();
    };

    const render3DStructure = (parsed: ParsedSDF) => {
      if (!parsed.atoms.length) return;

      const bounds = parsed.atoms.reduce(
        (acc, atom) => ({
          minX: Math.min(acc.minX, atom.x),
          maxX: Math.max(acc.maxX, atom.x),
          minY: Math.min(acc.minY, atom.y),
          maxY: Math.max(acc.maxY, atom.y),
          minZ: Math.min(acc.minZ, atom.z),
          maxZ: Math.max(acc.maxZ, atom.z)
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
          minZ: Number.POSITIVE_INFINITY,
          maxZ: Number.NEGATIVE_INFINITY
        }
      );

      const rotation3D = shape.rotation3D ?? { ...DEFAULT_MOLECULE_3D_ROTATION };
      const yaw = (rotation3D.y * Math.PI) / 180;
      const pitch = (rotation3D.x * Math.PI) / 180;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosX = Math.cos(pitch);
      const sinX = Math.sin(pitch);

      const centerX3D = (bounds.minX + bounds.maxX) / 2;
      const centerY3D = (bounds.minY + bounds.maxY) / 2;
      const centerZ3D = (bounds.minZ + bounds.maxZ) / 2;

      const rotatedAtoms = parsed.atoms.map((atom, index) => {
        const x = atom.x - centerX3D;
        const y = atom.y - centerY3D;
        const z = atom.z - centerZ3D;

        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;

        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        return {
          x: x1,
          y: y1,
          z: z2,
          element: atom.element,
          index
        };
      });

      const rotatedBounds = rotatedAtoms.reduce(
        (acc, atom) => ({
          minX: Math.min(acc.minX, atom.x),
          maxX: Math.max(acc.maxX, atom.x),
          minY: Math.min(acc.minY, atom.y),
          maxY: Math.max(acc.maxY, atom.y),
          minZ: Math.min(acc.minZ, atom.z),
          maxZ: Math.max(acc.maxZ, atom.z)
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
          minZ: Number.POSITIVE_INFINITY,
          maxZ: Number.NEGATIVE_INFINITY
        }
      );

      const structureWidth = Math.max(1, rotatedBounds.maxX - rotatedBounds.minX);
      const structureHeight = Math.max(1, rotatedBounds.maxY - rotatedBounds.minY);
      const padding = Math.min(width, height) * 0.12;
      const availableWidth = Math.max(10, width - padding * 2);
      const availableHeight = Math.max(10, height - padding * 2);
      const scale = Math.min(availableWidth / structureWidth, availableHeight / structureHeight);

      const centerXRotated = (rotatedBounds.minX + rotatedBounds.maxX) / 2;
      const centerYRotated = (rotatedBounds.minY + rotatedBounds.maxY) / 2;

      const projectedAtoms = rotatedAtoms.map(atom => ({
        x: (atom.x - centerXRotated) * scale,
        y: (centerYRotated - atom.y) * scale,
        z: atom.z,
        element: atom.element,
        index: atom.index
      }));

      const minDepth = rotatedBounds.minZ;
      const maxDepth = rotatedBounds.maxZ;
      const depthRange = Math.max(0.0001, maxDepth - minDepth);

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const bondsSorted = parsed.bonds
        .map(bond => {
          const atom1 = projectedAtoms[bond.from];
          const atom2 = projectedAtoms[bond.to];
          const depth = ((atom1?.z ?? 0) + (atom2?.z ?? 0)) / 2;
          return { bond, depth };
        })
        .sort((a, b) => a.depth - b.depth);

      bondsSorted.forEach(({ bond }) => {
        const atom1 = projectedAtoms[bond.from];
        const atom2 = projectedAtoms[bond.to];
        if (!atom1 || !atom2) return;

        const avgDepth = (atom1.z + atom2.z) / 2;
        const depthFactor = 1 - (avgDepth - minDepth) / depthRange;
        const bondStrokeWidth = Math.max(1.2, Math.min(width, height) * 0.02) * (0.65 + depthFactor * 0.7);
        const opacity = 0.35 + depthFactor * 0.55;

        const dx = atom2.x - atom1.x;
        const dy = atom2.y - atom1.y;
        const len = Math.hypot(dx, dy) || 1;
        const offsetBase = bondStrokeWidth * 0.8;
        const offsetX = (-dy / len) * offsetBase;
        const offsetY = (dx / len) * offsetBase;

        const drawBondLine = (ox: number, oy: number) => {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(148, 163, 184, ${opacity.toFixed(3)})`;
          ctx.lineWidth = bondStrokeWidth;
          ctx.moveTo(atom1.x + ox, atom1.y + oy);
          ctx.lineTo(atom2.x + ox, atom2.y + oy);
          ctx.stroke();
        };

        drawBondLine(0, 0);

        if (bond.type === 2 || bond.type === 3) {
          drawBondLine(offsetX, offsetY);
          if (bond.type === 3) {
            drawBondLine(-offsetX, -offsetY);
          }
        }
      });

      const atomsSorted = projectedAtoms.slice().sort((a, b) => a.z - b.z);
      atomsSorted.forEach(atom => {
        const depthFactor = 1 - (atom.z - minDepth) / depthRange;
        const radius = Math.max(3, Math.min(width, height) * 0.035) * (0.65 + depthFactor * 0.6);
        const color = ATOM_COLORS[atom.element] || '#cbd5f5';
        const shading = Math.min(0.3 + depthFactor * 0.7, 1);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(atom.x, atom.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(15, 23, 42, ${0.55 + shading * 0.35})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        if (atom.element !== 'H') {
          ctx.fillStyle = '#0f172a';
          ctx.font = `${Math.max(10, radius * 1.6)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(atom.element, atom.x, atom.y);
        }
      });

      ctx.restore();

      const projectionPayload = projectedAtoms.map(atom => ({
        atomIndex: atom.index,
        x: atom.x,
        y: atom.y
      }));
      storeProjection(projectionPayload);
      renderAnnotationsOverlay();
    };

    // Render crystal structure as primary (for minerals)
    const renderCrystalPrimary = (crystal: CrystalVisualData) => {
      if (!crystal || !crystal.atoms || crystal.atoms.length === 0) return;

      // Use full shape bounds
      const width = Math.abs(shape.endX - shape.startX);
      const height = Math.abs(shape.endY - shape.startY);
      const cx = shape.startX + width / 2;
      const cy = shape.startY + height / 2;

      ctx.save();
      // Background panel subtle
      ctx.fillStyle = 'rgba(2,6,23,0.65)';
      ctx.strokeStyle = 'rgba(56,189,248,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(shape.startX, shape.startY, width, height, 10);
      ctx.fill();
      ctx.stroke();

      // Rotation based on shape.rotation3D
      const rot = (shape.rotation3D ?? { x: 25, y: 35, z: 0 }) as { x: number; y: number; z?: number };
      const rx = (rot.x * Math.PI) / 180;
      const ry = (rot.y * Math.PI) / 180;
      const rz = ((rot.z ?? 0) * Math.PI) / 180;

      const cosx = Math.cos(rx), sinx = Math.sin(rx);
      const cosy = Math.cos(ry), siny = Math.sin(ry);
      const cosz = Math.cos(rz), sinz = Math.sin(rz);

      const rotate3D = (x: number, y: number, z: number) => {
        // Y rotation
        let nx = x * cosy + z * siny;
        let nz = -x * siny + z * cosy;
        let ny = y;
        // X rotation
        const ny2 = ny * cosx - nz * sinx;
        const nz2 = ny * sinx + nz * cosx;
        nx = nx;
        // Z rotation
        const x3 = nx * cosz - ny2 * sinz;
        const y3 = nx * sinz + ny2 * cosz;
        return { x: x3, y: y3, z: nz2 };
      };

      // Normalize positions to [-0.5, 0.5]
      const xs = crystal.atoms.map(a => a.x);
      const ys = crystal.atoms.map(a => a.y);
      const zs = crystal.atoms.map(a => a.z);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const sx = maxX - minX || 1;
      const sy = maxY - minY || 1;
      const sz = maxZ - minZ || 1;

      const projected = crystal.atoms.map((a, idx) => {
        const px = (a.x - minX) / sx - 0.5;
        const py = (a.y - minY) / sy - 0.5;
        const pz = (a.z - minZ) / sz - 0.5;
        const r = rotate3D(px, py, pz);
        return { index: idx, element: a.element, x: r.x, y: r.y, z: r.z };
      });

      // Scale to fit bounding box with margin
      const scale = Math.min(width, height) * 0.85;

      // Depth sort for painter's algorithm
      projected.sort((a, b) => a.z - b.z);

      // Draw bonds first
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(203,213,225,0.85)';
      crystal.bonds?.forEach(b => {
        const a1 = projected[b.from];
        const a2 = projected[b.to];
        if (!a1 || !a2) return;
        ctx.beginPath();
        ctx.moveTo(cx + a1.x * scale, cy + a1.y * scale);
        ctx.lineTo(cx + a2.x * scale, cy + a2.y * scale);
        ctx.stroke();
      });

      // Element colors (subset)
      const E: Record<string, string> = {
        C: '#94a3b8', H: '#cbd5e1', N: '#38bdf8', O: '#f87171',
        S: '#facc15', P: '#a855f7', Cl: '#34d399', Fe: '#ef4444',
        Ca: '#67e8f9', Na: '#60a5fa', K: '#22c55e', Mg: '#22d3ee',
        Si: '#f59e0b', Al: '#f472b6', Cu: '#8b5cf6', Zn: '#10b981'
      };

      // Draw atoms
      projected.forEach(a => {
        const r = Math.max(3, Math.min(width, height) * 0.028);
        ctx.beginPath();
        ctx.fillStyle = E[a.element] || '#e2e8f0';
        ctx.arc(cx + a.x * scale, cy + a.y * scale, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(15,23,42,0.9)';
        ctx.lineWidth = 0.9;
        ctx.stroke();
      });

      // Unit cell
      if (crystal.cellEdges && crystal.cellVertices && crystal.cellEdges.length && crystal.cellVertices.length) {
        const verts = crystal.cellVertices.map(v => rotate3D(
          (v.x - minX) / sx - 0.5,
          (v.y - minY) / sy - 0.5,
          (v.z - minZ) / sz - 0.5,
        ));
        ctx.strokeStyle = 'rgba(56,189,248,0.9)';
        ctx.lineWidth = 1.2;
        crystal.cellEdges.forEach(edge => {
          const v1 = verts[edge[0]];
          const v2 = verts[edge[1]];
          if (!v1 || !v2) return;
          ctx.beginPath();
          ctx.moveTo(cx + v1.x * scale, cy + v1.y * scale);
          ctx.lineTo(cx + v2.x * scale, cy + v2.y * scale);
          ctx.stroke();
        });
      }
      ctx.restore();
    };

    // Render crystal structure inset (for minerals)
    const renderCrystalInset = (crystal: CrystalVisualData) => {
      if (!crystal || !crystal.atoms || crystal.atoms.length === 0) return;

      const insetMargin = 8;
      const insetSize = Math.min(width, height) * 0.6;
      const insetX = shape.startX + width - insetSize - insetMargin;
      const insetY = shape.startY + insetMargin;

      // Panel background
      ctx.save();
      ctx.fillStyle = 'rgba(2,6,23,0.85)';
      ctx.strokeStyle = 'rgba(56,189,248,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(insetX - 2, insetY - 2, insetSize + 4, insetSize + 4, 8);
      ctx.fill();
      ctx.stroke();

      // Simple orthographic projection using rotation3D
      const rot = (shape.rotation3D ?? { x: 25, y: 35, z: 0 }) as { x: number; y: number; z?: number };
      const rx = (rot.x * Math.PI) / 180;
      const ry = (rot.y * Math.PI) / 180;
      const rz = ((rot.z ?? 0) * Math.PI) / 180;

      const cosx = Math.cos(rx), sinx = Math.sin(rx);
      const cosy = Math.cos(ry), siny = Math.sin(ry);
      const cosz = Math.cos(rz), sinz = Math.sin(rz);

      const rotate3D = (x: number, y: number, z: number) => {
        // Y rotation
        let nx = x * cosy + z * siny;
        let nz = -x * siny + z * cosy;
        let ny = y;
        // X rotation
        const ny2 = ny * cosx - nz * sinx;
        const nz2 = ny * sinx + nz * cosx;
        nx = nx;
        // Z rotation
        const x3 = nx * cosz - ny2 * sinz;
        const y3 = nx * sinz + ny2 * cosz;
        return { x: x3, y: y3, z: nz2 };
      };

      // Normalize positions
      const xs = crystal.atoms.map(a => a.x);
      const ys = crystal.atoms.map(a => a.y);
      const zs = crystal.atoms.map(a => a.z);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const sx = maxX - minX || 1;
      const sy = maxY - minY || 1;
      const sz = maxZ - minZ || 1;

      const projected = crystal.atoms.map((a, idx) => {
        const px = (a.x - minX) / sx - 0.5;
        const py = (a.y - minY) / sy - 0.5;
        const pz = (a.z - minZ) / sz - 0.5;
        const r = rotate3D(px, py, pz);
        return { index: idx, element: a.element, x: r.x, y: r.y, z: r.z };
      });

      // Scale to inset
      const scale = insetSize * 0.9;
      const cx = insetX + insetSize / 2;
      const cy = insetY + insetSize / 2;

      // Depth sort
      projected.sort((a, b) => a.z - b.z);

      // Draw bonds first
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(203,213,225,0.7)';
      crystal.bonds?.forEach(b => {
        const a1 = projected[b.from];
        const a2 = projected[b.to];
        if (!a1 || !a2) return;
        ctx.beginPath();
        ctx.moveTo(cx + a1.x * scale, cy + a1.y * scale);
        ctx.lineTo(cx + a2.x * scale, cy + a2.y * scale);
        ctx.stroke();
      });

      // Element colors (subset)
      const E: Record<string, string> = {
        H: '#cbd5e1', C: '#94a3b8', N: '#60a5fa', O: '#f87171',
        S: '#facc15', P: '#f59e0b', Cl: '#34d399', Fe: '#fb923c', Si: '#a78bfa'
      };

      // Draw atoms
      projected.forEach(a => {
        const r = 4 + (a.z + 0.5) * 2; // depth cue
        ctx.beginPath();
        ctx.fillStyle = E[a.element] || '#e2e8f0';
        ctx.arc(cx + a.x * scale, cy + a.y * scale, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(15,23,42,0.9)';
        ctx.lineWidth = 0.75;
        ctx.stroke();
      });

      // Unit cell if available
      if (crystal.cellEdges && crystal.cellVertices && crystal.cellEdges.length && crystal.cellVertices.length) {
        const verts = crystal.cellVertices.map(v => rotate3D(
          (v.x - minX) / sx - 0.5,
          (v.y - minY) / sy - 0.5,
          (v.z - minZ) / sz - 0.5,
        ));
        ctx.strokeStyle = 'rgba(56,189,248,0.7)';
        ctx.lineWidth = 1;
        crystal.cellEdges.forEach(edge => {
          const v1 = verts[edge[0]];
          const v2 = verts[edge[1]];
          if (!v1 || !v2) return;
          ctx.beginPath();
          ctx.moveTo(cx + v1.x * scale, cy + v1.y * scale);
          ctx.lineTo(cx + v2.x * scale, cy + v2.y * scale);
          ctx.stroke();
        });
      }
      ctx.restore();
    };

    // If this is a crystal from COD and we have crystalData, render it as the primary view
    if (data.isCrystal && data.crystalData) {
      renderCrystalPrimary(data.crystalData);
      // Also store a simplistic projection map to enable annotations roughly at atom centers
      const width = Math.abs(shape.endX - shape.startX);
      const height = Math.abs(shape.endY - shape.startY);
      const cx = shape.startX + width / 2;
      const cy = shape.startY + height / 2;
      const atoms = data.crystalData.atoms;
      if (atoms && atoms.length) {
        // Project to 2D similar to render logic to support annotations
        const xs = atoms.map(a => a.x);
        const ys = atoms.map(a => a.y);
        const zs = atoms.map(a => a.z);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const minZ = Math.min(...zs), maxZ = Math.max(...zs);
        const sx = maxX - minX || 1;
        const sy = maxY - minY || 1;
        const sz = maxZ - minZ || 1;
        const rot = (shape.rotation3D ?? { x: 25, y: 35, z: 0 }) as { x: number; y: number; z?: number };
        const rx = (rot.x * Math.PI) / 180;
        const ry = (rot.y * Math.PI) / 180;
        const rz = ((rot.z ?? 0) * Math.PI) / 180;
        const cosx = Math.cos(rx), sinx = Math.sin(rx);
        const cosy = Math.cos(ry), siny = Math.sin(ry);
        const cosz = Math.cos(rz), sinz = Math.sin(rz);
        const rotate3D = (x: number, y: number, z: number) => {
          let nx = x * cosy + z * siny;
          let nz = -x * siny + z * cosy;
          let ny = y;
          const ny2 = ny * cosx - nz * sinx;
          const nz2 = ny * sinx + nz * cosx;
          const x3 = nx * cosz - ny2 * sinz;
          const y3 = nx * sinz + ny2 * cosz;
          return { x: x3, y: y3, z: nz2 };
        };
        const projected = atoms.map((a, idx) => {
          const px = (a.x - minX) / sx - 0.5;
          const py = (a.y - minY) / sy - 0.5;
          const pz = (a.z - minZ) / sz - 0.5;
          const r = rotate3D(px, py, pz);
          return { atomIndex: idx, x: cx + r.x * Math.min(width, height) * 0.85, y: cy + r.y * Math.min(width, height) * 0.85 };
        });
        moleculeProjectionRef.current.set(shape.id, projected);
      }
      renderAnnotationsOverlay();
      return; // Skip SDF/SVG path for crystals
    }

    const sdfSource = (is3DMode ? data.sdf3DData : data.sdfData)?.trim();
    if (sdfSource) {
      const cacheKey = `${data.cid ?? data.name}-${is3DMode ? '3d' : '2d'}`;
      let parsed = sdfCacheRef.current.get(cacheKey);

      if (!parsed) {
        try {
          parsed = parseSDF(sdfSource) ?? undefined;
          if (parsed) {
            sdfCacheRef.current.set(cacheKey, parsed);
          } else {
            console.warn('?? parseSDF returned null for molecule', data.cid, 'mode', is3DMode ? '3D' : '2D');
          }
        } catch (error) {
          console.warn('Error parsing SDF for molecule:', data.name, error);
        }
      }

      if (parsed) {
        if (is3DMode && parsed.atoms.some(atom => Math.abs(atom.z) > 0.0001)) {
          render3DStructure(parsed);
          return;
        }

        render2DStructure(parsed);
        return;
      }

      if (is3DMode && data.sdfData && data.sdfData.trim().length > 0) {
        console.warn('?? Falling back to 2D SDF rendering for molecule', data.cid);
        const cacheKey2D = `${data.cid ?? data.name}-2d`;
        let parsed2D = sdfCacheRef.current.get(cacheKey2D);
        if (!parsed2D) {
          try {
            parsed2D = parseSDF(data.sdfData) ?? undefined;
            if (parsed2D) {
              sdfCacheRef.current.set(cacheKey2D, parsed2D);
            }
          } catch (error) {
            console.warn('Error parsing fallback 2D SDF for molecule:', data.name, error);
          }
        }

        if (parsed2D) {
          render2DStructure(parsed2D);
          return;
        }
      }
    }

    moleculeProjectionRef.current.delete(shape.id);

    const cid = data.cid;
    const cache = moleculeImageCacheRef.current;


    if (cache.has(cid)) {
      const img = cache.get(cid);
      if (img && img.complete) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        ctx.restore();
        return;
      }
    }

    if (data.svgData) {
      const svg = data.svgData;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        cache.set(cid, img);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        ctx.restore();
        setForceRedraw(prev => prev + 1);
      };
      img.onerror = () => {
        console.warn('Failed to load SVG for molecule:', data.displayName ?? data.name ?? 'Unknown');
        loadMoleculePNG(ctx, shape, centerX, centerY, width, height);
      };
      img.src = url;
    } else {
      loadMoleculePNG(ctx, shape, centerX, centerY, width, height);
    }
  };

  // Helper function to load molecule as PNG (fallback)
  const loadMoleculePNG = (
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    centerX: number,
    centerY: number,
    width: number,
    height: number
  ) => {
    const cid = shape.moleculeData?.cid;
    if (!cid) return;

    const cache = moleculeImageCacheRef.current;

    // Check cache first
    if (cache.has(cid)) {
      const img = cache.get(cid);
      if (img && img.complete) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((shape.rotation * Math.PI) / 180);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        ctx.restore();
        return;
      }
    }

    // Load PNG from PubChem
    const pngUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/CID/${cid}/PNG?image_size=400x400`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cache.set(cid, img);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((shape.rotation * Math.PI) / 180);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();

      // Trigger redraw to ensure canvas updates
      setForceRedraw(prev => prev + 1);
    };
    img.onerror = () => {
      console.warn('Failed to load molecule PNG:', shape.moleculeData?.displayName ?? shape.moleculeData?.name ?? 'Unknown');
      // Draw placeholder
      ctx.save();
      ctx.fillStyle = '#3b82f6';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(shape.startX, shape.startY, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 1;
      ctx.fillText(shape.moleculeData?.molecularFormula || 'Molecule', centerX, centerY);
      ctx.restore();
    };
    img.src = pngUrl;
  };

  const drawProtein = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    const data = shape.proteinData;
    if (!data) {
      console.warn('Protein data not available for shape:', shape);
      return;
    }

    const width = Math.abs(shape.endX - shape.startX);
    const height = Math.abs(shape.endY - shape.startY);
    const centerX = shape.startX + width / 2;
    const centerY = shape.startY + height / 2;

    // If we have PDB data, render a basic 3D representation
    if (data.pdbData && data.structureFormat !== 'cif') {
      try {
        const pdbAtoms = parsePDBAtoms(data.pdbData);
        if (pdbAtoms.length > 0) {
          renderPDBStructure(ctx, shape, pdbAtoms, centerX, centerY, width, height);
          return;
        }
      } catch (error) {
        console.warn('Failed to parse PDB data:', error);
      }
    }

    // Fallback: Draw placeholder
    ctx.save();
    ctx.fillStyle = '#dc2626'; // Red color for proteins
    ctx.globalAlpha = 0.3;
    ctx.fillRect(shape.startX, shape.startY, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    ctx.fillText(data.title || 'Protein Structure', centerX, centerY);
    ctx.restore();
  };

  const drawReaction = (ctx: CanvasRenderingContext2D, shape: Shape) => {
    const data = shape.reactionData;
    if (!data) {
      console.warn('Reaction data not available for shape:', shape);
      return;
    }

    const width = Math.abs(shape.endX - shape.startX);
    const height = Math.abs(shape.endY - shape.startY);
    const centerX = shape.startX + width / 2;
    const centerY = shape.startY + height / 2;

    const labelText =
      (typeof data.name === 'string' && data.name.trim()) ||
      (data.metadata?.originalQuery && data.metadata.originalQuery.trim()) ||
      'Chemical Reaction';

    const description = data.description || '';

    // Helper to wrap text for canvas
    const wrapText = (text: string, maxWidth: number): string[] => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      words.forEach(word => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    };

    const renderLabelAndDescription = (svgHeight: number) => {
      ctx.save();

      // Draw reaction name/title
      ctx.fillStyle = '#a855f7'; // Purple color for reaction name
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(labelText, centerX, shape.startY - 25);

      // Description rendering disabled - only show SVG

      ctx.restore();
    };

    let baseSvg = data.svg;
    let overlaySvg = data.highlightSvg ?? null;

    if (!baseSvg && overlaySvg) {
      baseSvg = overlaySvg;
      overlaySvg = null;
    }

    const cacheKey = `${shape.id}|${data.timestamp}|${baseSvg ? baseSvg.length : 0}|${overlaySvg ? overlaySvg.length : 0}`;
    reactionImageCacheRef.current.forEach((_, existingKey) => {
      if (existingKey !== cacheKey && existingKey.startsWith(`${shape.id}|`)) {
        reactionImageCacheRef.current.delete(existingKey);
      }
    });
    let cacheEntry = reactionImageCacheRef.current.get(cacheKey);
    if (!cacheEntry) {
      cacheEntry = {};
      reactionImageCacheRef.current.set(cacheKey, cacheEntry);
    }

    const drawFromImages = (baseImage: HTMLImageElement, highlightImage?: HTMLImageElement | null) => {
      ctx.save();

      // No space reserved for description (description disabled)
      const descHeight = 0;

      // Calculate available space for SVG
      const maxWidth = width * 0.95; // Increased from 0.92 for better zoom
      const maxSvgHeight = (height * 0.85) - descHeight; // Reserve space for description
      const gap = highlightImage ? 20 : 0;

      // Improved scaling - maintain aspect ratio better
      const baseScaleByWidth = Math.min(1.2, maxWidth / baseImage.width); // Allow 1.2x zoom
      let baseDrawWidth = baseImage.width * baseScaleByWidth;
      let baseDrawHeight = baseImage.height * baseScaleByWidth;

      let highlightDrawWidth = 0;
      let highlightDrawHeight = 0;

      if (!highlightImage) {
        // Scale to fit available height
        if (baseDrawHeight > maxSvgHeight) {
          const scaleFactor = maxSvgHeight / baseDrawHeight;
          baseDrawWidth *= scaleFactor;
          baseDrawHeight *= scaleFactor;
        }

        const baseStartY = shape.startY + 40; // Start below the title
        const baseX = centerX - baseDrawWidth / 2;

        // Draw with smooth rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(baseImage, baseX, baseStartY, baseDrawWidth, baseDrawHeight);

        ctx.restore();
        renderLabelAndDescription(baseDrawHeight + 40);
        return;
      }

      const highlightScaleByWidth = Math.min(1.2, maxWidth / highlightImage.width);
      highlightDrawWidth = highlightImage.width * highlightScaleByWidth;
      highlightDrawHeight = highlightImage.height * highlightScaleByWidth;

      const currentTotalHeight = baseDrawHeight + gap + highlightDrawHeight;

      if (currentTotalHeight > maxSvgHeight) {
        const scaleFactor = maxSvgHeight / currentTotalHeight;
        baseDrawWidth *= scaleFactor;
        baseDrawHeight *= scaleFactor;
        highlightDrawWidth *= scaleFactor;
        highlightDrawHeight *= scaleFactor;
      }

      const totalDrawHeight = baseDrawHeight + gap + highlightDrawHeight;
      const startY = shape.startY + 40;

      const baseX = centerX - baseDrawWidth / 2;

      // Enable high quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(baseImage, baseX, startY, baseDrawWidth, baseDrawHeight);

      const highlightX = centerX - highlightDrawWidth / 2;
      const highlightY = startY + baseDrawHeight + gap;
      ctx.drawImage(highlightImage, highlightX, highlightY, highlightDrawWidth, highlightDrawHeight);

      ctx.restore();
      renderLabelAndDescription(totalDrawHeight + 40);
    };

    const baseImage = cacheEntry.baseImage;
    const baseReady = baseImage?.complete;
    const highlightImage = overlaySvg ? cacheEntry.highlightImage : null;
    const highlightReady = overlaySvg ? Boolean(highlightImage && highlightImage.complete) : false;

    if (baseReady) {
      drawFromImages(baseImage!, overlaySvg ? (highlightReady ? highlightImage : null) : null);
      if (overlaySvg && !highlightReady) {
        // Highlight image still loading; redraw once it completes
        // No-op here, the onload handler triggers a redraw
      }
      return;
    }

    const createImageFromSvg = (svgContent: string, onLoad: (img: HTMLImageElement) => void, onError: () => void) => {
      const url = URL.createObjectURL(new Blob([svgContent], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        onLoad(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        onError();
      };
      img.src = url;
      return img;
    };

    if (baseSvg) {
      if (!cacheEntry.baseImage || cacheEntry.baseSvg !== baseSvg) {
        cacheEntry.baseSvg = baseSvg;
        cacheEntry.baseImage = createImageFromSvg(
          baseSvg,
          img => {
            cacheEntry.baseImage = img;
            setForceRedraw(prev => prev + 1);
          },
          () => {
            cacheEntry.baseImage = undefined;
            cacheEntry.baseSvg = undefined;
            console.warn('Failed to render reaction SVG image');
          }
        );
      }
    }

    if (overlaySvg) {
      if (!cacheEntry.highlightImage || cacheEntry.highlightSvg !== overlaySvg) {
        cacheEntry.highlightSvg = overlaySvg;
        cacheEntry.highlightImage = createImageFromSvg(
          overlaySvg,
          img => {
            cacheEntry.highlightImage = img;
            setForceRedraw(prev => prev + 1);
          },
          () => {
            cacheEntry.highlightImage = undefined;
            cacheEntry.highlightSvg = undefined;
            console.warn('Failed to render reaction highlight SVG image');
          }
        );
      }
    } else {
      cacheEntry.highlightImage = undefined;
      cacheEntry.highlightSvg = undefined;
    }

    ctx.save();
    ctx.fillStyle = '#ea580c';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(shape.startX, shape.startY, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    ctx.fillText(labelText, centerX, centerY);
    ctx.restore();
    renderLabelAndDescription(0);
  };

  // PDB parsing and rendering utilities
  interface PDBAtom {
    serial: number;
    name: string;
    altLoc: string;
    resName: string;
    chainID: string;
    resSeq: number;
    iCode: string;
    x: number;
    y: number;
    z: number;
    occupancy: number;
    tempFactor: number;
    element: string;
    charge: string;
  }

  const parsePDBAtoms = (pdbData: string): PDBAtom[] => {
    const atoms: PDBAtom[] = [];
    const lines = pdbData.split('\n');

    for (const line of lines) {
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        try {
          const atom: PDBAtom = {
            serial: parseInt(line.substring(6, 11).trim()) || 0,
            name: line.substring(12, 16).trim(),
            altLoc: line.substring(16, 17).trim(),
            resName: line.substring(17, 20).trim(),
            chainID: line.substring(21, 22).trim(),
            resSeq: parseInt(line.substring(22, 26).trim()) || 0,
            iCode: line.substring(26, 27).trim(),
            x: parseFloat(line.substring(30, 38).trim()) || 0,
            y: parseFloat(line.substring(38, 46).trim()) || 0,
            z: parseFloat(line.substring(46, 54).trim()) || 0,
            occupancy: parseFloat(line.substring(54, 60).trim()) || 1.0,
            tempFactor: parseFloat(line.substring(60, 66).trim()) || 0.0,
            element: line.substring(76, 78).trim(),
            charge: line.substring(78, 80).trim(),
          };
          atoms.push(atom);
        } catch (error) {
          console.warn('Failed to parse PDB atom line:', line, error);
        }
      }
    }

    return atoms;
  };

  const renderPDBStructure = (
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    atoms: PDBAtom[],
    centerX: number,
    centerY: number,
    width: number,
    height: number
  ) => {
    if (atoms.length === 0) return;

    // Calculate bounds of the protein structure
    const bounds = atoms.reduce(
      (acc, atom) => ({
        minX: Math.min(acc.minX, atom.x),
        maxX: Math.max(acc.maxX, atom.x),
        minY: Math.min(acc.minY, atom.y),
        maxY: Math.max(acc.maxY, atom.y),
        minZ: Math.min(acc.minZ, atom.z),
        maxZ: Math.max(acc.maxZ, atom.z)
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
        minZ: Number.POSITIVE_INFINITY,
        maxZ: Number.NEGATIVE_INFINITY
      }
    );

    const structureWidth = bounds.maxX - bounds.minX;
    const structureHeight = bounds.maxY - bounds.minY;

    // Calculate scale to fit within the shape bounds
    const padding = Math.min(width, height) * 0.1;
    const availableWidth = width - padding * 2;
    const availableHeight = height - padding * 2;
    const scaleX = availableWidth / structureWidth;
    const scaleY = availableHeight / structureHeight;
    const scale = Math.min(scaleX, scaleY, 2); // Limit max scale

    // Center the structure
    const centerAtomX = (bounds.minX + bounds.maxX) / 2;
    const centerAtomY = (bounds.minY + bounds.maxY) / 2;
    const centerAtomZ = (bounds.minZ + bounds.maxZ) / 2;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Group atoms by residue for better visualization
    const residues: Record<string, PDBAtom[]> = {};
    atoms.forEach(atom => {
      const key = `${atom.chainID}-${atom.resSeq}`;
      if (!residues[key]) residues[key] = [];
      residues[key].push(atom);
    });

    // Render backbone atoms (CA, N, C) as connected structure
    const backboneAtoms = atoms.filter(atom =>
      atom.name === 'CA' || atom.name === 'N' || atom.name === 'C'
    );

    // Sort backbone atoms by residue sequence for proper connection
    backboneAtoms.sort((a, b) => {
      if (a.chainID !== b.chainID) return a.chainID.localeCompare(b.chainID);
      return a.resSeq - b.resSeq;
    });

    // Draw backbone connections
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1, scale * 0.5);
    ctx.beginPath();

    for (let i = 0; i < backboneAtoms.length - 1; i++) {
      const atom1 = backboneAtoms[i];
      const atom2 = backboneAtoms[i + 1];

      // Only connect atoms from the same chain and consecutive residues
      if (atom1.chainID === atom2.chainID && Math.abs(atom1.resSeq - atom2.resSeq) === 1) {
        // Apply 3D rotation and projection
        const x1 = (atom1.x - centerAtomX) * scale;
        const y1 = (atom1.y - centerAtomY) * scale;
        const z1 = (atom1.z - centerAtomZ) * scale;

        const x2 = (atom2.x - centerAtomX) * scale;
        const y2 = (atom2.y - centerAtomY) * scale;
        const z2 = (atom2.z - centerAtomZ) * scale;

        // Simple 3D to 2D projection (isometric-like)
        const projX1 = x1 * 0.866 - y1 * 0.866; // cos(30°) and sin(30°)
        const projY1 = x1 * 0.5 + y1 * 0.5 - z1 * 0.707; // cos(45°) for depth

        const projX2 = x2 * 0.866 - y2 * 0.866;
        const projY2 = x2 * 0.5 + y2 * 0.5 - z2 * 0.707;

        if (i === 0) {
          ctx.moveTo(projX1, projY1);
        }
        ctx.lineTo(projX2, projY2);
      }
    }
    ctx.stroke();

    // Draw atoms
    const atomRadius = Math.max(2, Math.min(width, height) * 0.008);

    // Draw CA atoms (alpha carbons) as larger spheres
    backboneAtoms.forEach(atom => {
      if (atom.name === 'CA') {
        const x = (atom.x - centerAtomX) * scale;
        const y = (atom.y - centerAtomY) * scale;
        const z = (atom.z - centerAtomZ) * scale;

        // Simple 3D projection
        const projX = x * 0.866 - y * 0.866;
        const projY = x * 0.5 + y * 0.5 - z * 0.707;

        // Color based on secondary structure (simplified)
        ctx.fillStyle = '#3b82f6'; // Blue for alpha carbons
        ctx.beginPath();
        ctx.arc(projX, projY, atomRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Add subtle shadow/highlight for 3D effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(projX - atomRadius * 0.5, projY - atomRadius * 0.5, atomRadius * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw side chain atoms as smaller spheres
    const sideChainAtoms = atoms.filter(atom =>
      !['CA', 'N', 'C', 'O'].includes(atom.name) && atom.name !== 'H'
    );

    sideChainAtoms.forEach(atom => {
      const x = (atom.x - centerAtomX) * scale;
      const y = (atom.y - centerAtomY) * scale;
      const z = (atom.z - centerAtomZ) * scale;

      const projX = x * 0.866 - y * 0.866;
      const projY = x * 0.5 + y * 0.5 - z * 0.707;

      // Color based on element
      const color = ATOM_COLORS[atom.element] || '#cbd5f5';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(projX, projY, atomRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    // Draw label
    ctx.fillStyle = '#dc2626';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(shape.proteinData?.title || 'Protein', centerX, shape.startY - 10);
  };

  const stopDrawing = () => {
    // Handle lasso selection for eraser
    if (lassoSelection.isActive && lassoSelection.points.length > 3) {
      console.log('Lasso selection complete with', lassoSelection.points.length, 'points');
      const updatedShapes = canvasHistoryRef.current.filter(shape => {
        const dx = shape.endX - shape.startX;
        const dy = shape.endY - shape.startY;
        const centerX = shape.startX + dx / 2;
        const centerY = shape.startY + dy / 2;
        const bounds = getShapeBounds(shape);

        const centerInside = isPointInPolygon({ x: centerX, y: centerY }, lassoSelection.points);
        const boundsIntersect = doesPolygonIntersectRect(lassoSelection.points, bounds);
        const shouldErase = centerInside || boundsIntersect;

        console.log(
          'Shape at',
          centerX,
          centerY,
          'removed by lasso:',
          shouldErase,
          { centerInside, boundsIntersect }
        );

        return !shouldErase;
      });

      console.log('Shapes before:', canvasHistoryRef.current.length, 'Shapes after:', updatedShapes.length);
      if (updatedShapes.length !== canvasHistoryRef.current.length) {
        setShapes(updatedShapes);
        canvasHistoryRef.current = updatedShapes;
        setSelectedShapeId(null);
      }

      setLassoSelection({ points: [], isActive: false });
      setIsDrawing(false);
      return;
    }

    if (areaEraseSelection?.isActive) {
      const { startX, startY, currentX, currentY } = areaEraseSelection;
      const minX = Math.min(startX, currentX);
      const maxX = Math.max(startX, currentX);
      const minY = Math.min(startY, currentY);
      const maxY = Math.max(startY, currentY);
      const width = maxX - minX;
      const height = maxY - minY;

      let updatedShapes = canvasHistoryRef.current;
      if (width < 5 && height < 5) {
        for (let i = canvasHistoryRef.current.length - 1; i >= 0; i--) {
          const shape = canvasHistoryRef.current[i];
          if (isPointWithinShape(shape, startX, startY)) {
            updatedShapes = canvasHistoryRef.current.filter((_, index) => index !== i);
            break;
          }
        }
      } else {
        const selectionRect = { minX, minY, maxX, maxY };
        updatedShapes = canvasHistoryRef.current.filter(
          (shape) => !doesShapeIntersectRect(shape, selectionRect)
        );
      }

      if (updatedShapes.length !== canvasHistoryRef.current.length) {
        setShapes(updatedShapes);
        canvasHistoryRef.current = updatedShapes;
        setSelectedShapeId(null);
      }

      setAreaEraseSelection(null);
      setIsDrawing(false);
      return;
    }

    // Stop rotating shape
    if (isRotating3DShape) {
      setIsRotating3DShape(false);
      rotate3DStateRef.current = null;
      return;
    }

    if (isRotatingShape) {
      setIsRotatingShape(false);
      return;
    }

    // Stop dragging shape
    if (isDraggingShape) {
      setIsDraggingShape(false);
      return;
    }

    // Stop resizing shape
    if (isResizing) {
      setIsResizing(false);
      setResizeHandle(null);
      // Keep selected for next operation
      return;
    }

    // Save shape if it was being drawn
    if (arrowState && arrowState.isDrawing) {
      const activeTool = showChemistryToolbar ? chemistryTool : currentTool;
      const activeStroke = showChemistryToolbar ? chemistryStrokeColor : strokeColor;
      const activeFill = showChemistryToolbar ? chemistryFillColor : activeStroke;
      const fillEnabled =
        showChemistryToolbar ? chemistryFillEnabled && FILLABLE_SHAPES.has(activeTool) : FILLABLE_SHAPES.has(activeTool);
      const activeSize = showChemistryToolbar ? chemistrySize : strokeWidth;

      // Create shape object
      const newShape: Shape = {
        id: Date.now().toString(),
        type: activeTool as any,
        startX: arrowState.startX,
        startY: arrowState.startY,
        endX: arrowState.endX,
        endY: arrowState.endY,
        color: activeStroke,
        strokeColor: activeStroke,
        fillColor: fillEnabled ? activeFill : undefined,
        fillEnabled,
        size: activeSize,
        rotation: 0 // Default rotation
      };

      // Add to shapes history
      const updatedShapes = [...shapes, newShape];
      setShapes(updatedShapes);
      canvasHistoryRef.current = updatedShapes;

      setArrowState({
        ...arrowState,
        isDrawing: false
      });
      imageDataRef.current = null;
      return;
    }

    setIsDrawing(false);
  };

  const drawText = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, size: number) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${size}px "Inter", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Handle multi-line text
    const lines = text.split('\n');
    const lineHeight = size * 1.2; // Line height with some spacing

    lines.forEach((line, index) => {
      const lineY = y + (index * lineHeight);
      ctx.fillText(line, x, lineY);
    });

    ctx.restore();
  };

  const drawTextWithHighlights = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
    baseColor: string,
    size: number,
    corrections: Correction[]
  ) => {
    ctx.save();
    ctx.font = `${size}px "Inter", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Handle multi-line text
    const lines = text.split('\n');
    const lineHeight = size * 1.2;

    lines.forEach((line, lineIndex) => {
      const lineY = y + (lineIndex * lineHeight);
      let currentX = x;

      // If no corrections for this text, render normally
      if (!corrections || corrections.length === 0) {
        ctx.fillStyle = baseColor;
        ctx.fillText(line, currentX, lineY);
        return;
      }

      // Sort corrections by startChar for this line
      const lineStartChar = lines.slice(0, lineIndex).reduce((sum, l) => sum + l.length + 1, 0); // +1 for newline
      const lineEndChar = lineStartChar + line.length;

      const lineCorrections = corrections.filter(correction =>
        correction.startChar !== undefined &&
        correction.endChar !== undefined &&
        correction.startChar < lineEndChar &&
        correction.endChar > lineStartChar
      );

      if (lineCorrections.length === 0) {
        // No corrections for this line, render normally
        ctx.fillStyle = baseColor;
        ctx.fillText(line, currentX, lineY);
        return;
      }

      // Render line with highlights
      let charIndex = 0;
      while (charIndex < line.length) {
        const char = line[charIndex];
        const globalCharIndex = lineStartChar + charIndex;

        // Find correction that applies to this character
        const applicableCorrection = lineCorrections.find(correction =>
          globalCharIndex >= correction.startChar! &&
          globalCharIndex < correction.endChar!
        );

        if (applicableCorrection && applicableCorrection.highlightColor) {
          // Render with highlight background first
          const charWidth = ctx.measureText(char).width;
          ctx.fillStyle = applicableCorrection.highlightColor + '40'; // Add transparency
          ctx.fillRect(currentX, lineY, charWidth, size);

          // Render character with highlight color
          ctx.fillStyle = applicableCorrection.highlightColor;
          ctx.fillText(char, currentX, lineY);
          currentX += charWidth;
        } else {
          // Render normally
          ctx.fillStyle = baseColor;
          ctx.fillText(char, currentX, lineY);
          currentX += ctx.measureText(char).width;
        }

        charIndex++;
      }
    });

    ctx.restore();
  };

  const textCorrectionOverlays = useMemo(() => {
    if (!showCorrections) {
      return [] as Array<{
        id: string;
        left: number;
        top: number;
        originalText: string;
        corrections: Correction[];
        isDrawn: boolean;
      }>;
    }

    const overlays: Array<{
      id: string;
      left: number;
      top: number;
      originalText: string;
      corrections: Correction[];
      isDrawn: boolean;
    }> = [];

    const groupedByTextShape = new Map<string, Correction[]>();
    corrections.forEach((correction) => {
      if (!correction.textShapeId) return;
      const existing = groupedByTextShape.get(correction.textShapeId) || [];
      existing.push(correction);
      groupedByTextShape.set(correction.textShapeId, existing);
    });

    const textShapes = shapes.filter((shape) => shape.type === 'text');
    const textShapeMap = new Map(textShapes.map((shape) => [shape.id, shape]));

    groupedByTextShape.forEach((groupCorrections, textShapeId) => {
      if (groupCorrections.length === 0) return;

      const baseCorrection = groupCorrections[0];

      if (baseCorrection.isDrawnText) {
        const correctionX = baseCorrection.x ?? 0;
        const correctionY = baseCorrection.y ?? 0;
        const originalText = baseCorrection.originalText || '';
        if (!originalText.trim()) {
          return;
        }

        overlays.push({
          id: textShapeId,
          left: correctionX * zoom,
          top: (correctionY + 60) * zoom,
          originalText,
          corrections: groupCorrections,
          isDrawn: true
        });
      } else {
        const shape = textShapeMap.get(textShapeId);
        if (!shape) return;
        const originalText = shape.text || '';
        if (!originalText.trim()) {
          return;
        }

        const textHeight = (shape.size || 16) * 1.2;
        overlays.push({
          id: textShapeId,
          left: shape.startX * zoom,
          top: (shape.startY + textHeight + 16) * zoom,
          originalText,
          corrections: groupCorrections,
          isDrawn: false
        });
      }
    });

    return overlays;
  }, [showCorrections, corrections, shapes, zoom]);

  // Function to redraw all saved shapes
  const redrawAllShapes = async (ctx: CanvasRenderingContext2D) => {
    for (const shape of canvasHistoryRef.current) {
      const dx = shape.endX - shape.startX;
      const dy = shape.endY - shape.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const centerX = shape.startX + dx / 2;
      const centerY = shape.startY + dy / 2;

      // Apply rotation if shape has rotation
      if (shape.rotation !== 0) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((shape.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);
      }

      const strokeColor = shape.strokeColor ?? shape.color;
      const shapeSupportsFill = FILLABLE_SHAPES.has(shape.type);
      const fillEnabled = shapeSupportsFill && shape.fillEnabled !== false;
      const fillOptions: ShapeDrawOptions = {
        fillColor: fillEnabled ? shape.fillColor ?? strokeColor : undefined,
        fillEnabled,
      };

      if (shape.type === 'arrow') {
        drawArrow(ctx, shape.startX, shape.startY, shape.endX, shape.endY, shape.size, strokeColor);
      } else if (shape.type === 'circle') {
        drawCircle(ctx, centerX, centerY, distance / 2, strokeColor, fillOptions);
      } else if (shape.type === 'square') {
        drawSquare(ctx, centerX, centerY, distance, strokeColor, fillOptions);
      } else if (shape.type === 'triangle') {
        drawTriangle(ctx, centerX, centerY, distance, strokeColor, fillOptions);
      } else if (shape.type === 'hexagon') {
        drawHexagon(ctx, centerX, centerY, distance / 2, strokeColor, fillOptions);
      } else if (shape.type === 'plus') {
        drawPlus(ctx, centerX, centerY, distance / 2, shape.size, strokeColor);
      } else if (shape.type === 'minus') {
        drawMinus(ctx, centerX, centerY, distance / 2, shape.size, strokeColor);
      } else if (shape.type === 'molecule') {
        await drawMolecule(ctx, shape);
      } else if (shape.type === 'protein') {
        drawProtein(ctx, shape);
      } else if (shape.type === 'reaction') {
        drawReaction(ctx, shape);
      } else if (shape.type === 'text') {
        // Check if there are corrections for this text shape
        const textCorrections = corrections.filter(c => c.textShapeId === shape.id);
        if (textCorrections.length > 0) {
          drawTextWithHighlights(ctx, shape.startX, shape.startY, shape.text || '', shape.color, shape.size, textCorrections);
        } else {
          drawText(ctx, shape.startX, shape.startY, shape.text || '', shape.color, shape.size);
        }
      }

      // Restore context if rotation was applied
      if (shape.rotation !== 0) {
        ctx.restore();
      }

      // Draw selection indicator if shape is selected
      if (selectedShapeId === shape.id) {
        // Draw selection box
        ctx.strokeStyle = '#0ea5e9';  // Cyan selection color
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);  // Dashed line
        ctx.globalAlpha = 0.8;

        const tolerance = Math.max(distance / 2 + 15, 25);
        ctx.beginPath();
        ctx.arc(centerX, centerY, tolerance, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.setLineDash([]);  // Reset to solid

        // Draw resize handles (corners and edges)
        const handleSize = 12;
        const handlePositions = [
          // Corners
          { x: shape.startX, y: shape.startY },
          { x: shape.endX, y: shape.startY },
          { x: shape.endX, y: shape.endY },
          { x: shape.startX, y: shape.endY },
          // Edges
          { x: (shape.startX + shape.endX) / 2, y: shape.startY },
          { x: shape.endX, y: (shape.startY + shape.endY) / 2 },
          { x: (shape.startX + shape.endX) / 2, y: shape.endY },
          { x: shape.startX, y: (shape.startY + shape.endY) / 2 },
        ];

        // Draw each handle
        handlePositions.forEach((pos) => {
          ctx.fillStyle = '#0ea5e9';  // Cyan handles
          ctx.fillRect(
            pos.x - handleSize / 2,
            pos.y - handleSize / 2,
            handleSize,
            handleSize
          );

          // White border for contrast
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            pos.x - handleSize / 2,
            pos.y - handleSize / 2,
            handleSize,
            handleSize
          );
        });

        ctx.globalAlpha = 1;

        // Draw label
        ctx.fillStyle = '#0ea5e9';
        ctx.font = '12px Arial';
        ctx.fillText('Drag corners to resize', shape.startX, shape.startY - 20);
      }
    }
  };

  // Touch event handlers
  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: (touch.clientX - rect.left) / zoom,
      y: (touch.clientY - rect.top) / zoom
    };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getTouchPos(e);

    setIsDrawing(true);
    setLastX(x);
    setLastY(y);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getTouchPos(e);

    // Use chemistry tool settings if chemistry toolbar is active
    const activeStrokeColor = showChemistryToolbar ? chemistryStrokeColor : strokeColor;
    const activeFillColor = showChemistryToolbar ? chemistryFillColor : activeStrokeColor;
    const activeFillEnabled = showChemistryToolbar ? chemistryFillEnabled : true;
    const activeSize = showChemistryToolbar ? chemistrySize : strokeWidth;
    const activeTool = showChemistryToolbar ? chemistryTool : currentTool;
    const fillConfig = {
      fillColor: activeFillColor,
      fillEnabled: activeFillEnabled && FILLABLE_SHAPES.has(activeTool),
    };

    if (activeTool === 'pen' || activeTool === 'draw') {
      ctx.strokeStyle = activeStrokeColor;
      ctx.lineWidth = activeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = activeSize * 2;
      ctx.lineCap = 'round';

      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
    } else if (activeTool === 'atom') {
      drawAtom(ctx, x, y, activeSize, activeStrokeColor);
    } else if (activeTool === 'bond') {
      drawBond(ctx, lastX, lastY, x, y, activeSize, activeStrokeColor);
    } else if (activeTool === 'arrow') {
      drawArrow(ctx, lastX, lastY, x, y, activeSize, activeStrokeColor);
    } else if (activeTool === 'electron') {
      drawElectron(ctx, x, y, activeSize, activeStrokeColor);
    } else if (activeTool === 'circle') {
      drawCircle(ctx, x, y, activeSize * 3, activeStrokeColor, fillConfig);
    } else if (activeTool === 'square') {
      drawSquare(ctx, x, y, activeSize * 3, activeStrokeColor, fillConfig);
    } else if (activeTool === 'triangle') {
      drawTriangle(ctx, x, y, activeSize * 3, activeStrokeColor, fillConfig);
    } else if (activeTool === 'hexagon') {
      drawHexagon(ctx, x, y, activeSize * 3, activeStrokeColor, fillConfig);
    }

    setLastX(x);
    setLastY(y);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
  };

  const clearCanvas = useCallback(() => {
    if (!window.confirm('Are you sure you want to clear the canvas? This will remove all drawings and analysis results.')) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height);
    }

    setCorrections([]);
    setShowCorrections(false);
    setAnalysisResult(null);
    resetExternalTextPlacement();
  }, [resetExternalTextPlacement, showGrid]);

  const exportCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      alert('Canvas is not ready yet. Please try again.');
      return;
    }

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png', 1);
    link.download = `chem-canvas-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.click();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleCanvasCommand = (event: Event) => {
      const detail = (event as CustomEvent<CanvasCommand>).detail;
      if (!detail) {
        return;
      }

      switch (detail.type) {
        case 'set-tool':
          if (detail.tool) {
            setShowChemistryToolbar(true);
            setChemistryTool(detail.tool);
          }
          break;
        case 'clear-canvas':
          clearCanvas();
          break;
        case 'export-canvas':
          exportCanvas();
          break;
        case 'toggle-grid':
          setShowGrid(prev => !prev);
          break;
        case 'insert-text':
          insertTextBlock(detail.text);
          break;
        default:
          break;
      }
    };

    window.addEventListener('canvas-command', handleCanvasCommand as EventListener);
    return () => window.removeEventListener('canvas-command', handleCanvasCommand as EventListener);
  }, [clearCanvas, exportCanvas]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const analyzeCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const apiKey = getStoredAPIKey();
    if (!apiKey) {
      alert('Please add your Gemini API key in the settings to use the canvas analysis feature.');
      return;
    }

    setIsAnalyzing(true);

    try {
      // Convert canvas to base64 image
      const canvasData = canvas.toDataURL('image/png', 0.8);

      // Debug: Check if canvas has content
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imageData.data.some(pixel => pixel !== 0);
        console.log('Canvas analysis debug:', {
          canvasSize: { width: canvas.width, height: canvas.height },
          hasVisibleContent: hasContent,
          shapesCount: canvasHistoryRef.current.length,
          textShapesCount: canvasHistoryRef.current.filter(s => s.type === 'text').length,
          pathShapesCount: canvasHistoryRef.current.filter(s => s.type === 'path').length,
          zoom: zoom,
          background: canvasBackground
        });

        // If no content detected, try to force a redraw to ensure content is visible
        if (!hasContent && canvasHistoryRef.current.length > 0) {
          console.log('Forcing redraw to ensure content is visible...');
          setForceRedraw(prev => prev + 1);
          // Wait a bit for redraw
          await new Promise(resolve => setTimeout(resolve, 100));
          const newCanvasData = canvas.toDataURL('image/png', 0.8);
          const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const newHasContent = newImageData.data.some(pixel => pixel !== 0);
          console.log('After redraw:', { hasContent: newHasContent });
          if (newHasContent) {
            return analyzeCanvas(); // Retry analysis
          }
        }
      }

      // Analyze with LLM for general canvas content
      const result = await analyzeCanvasWithLLM(canvasData, apiKey, 'chemistry');
      console.log('Canvas analysis result:', result);

      // Additionally analyze text shapes specifically for inline corrections
      const textShapes = canvasHistoryRef.current.filter(shape => shape.type === 'text');
      const textCorrections: Correction[] = [];

      for (const textShape of textShapes) {
        if (textShape.text && textShape.text.trim()) {
          console.log('Analyzing text shape:', textShape.text);
          const shapeCorrections = await analyzeTextContent(
            textShape.text,
            textShape.id,
            apiKey,
            'chemistry'
          );
          textCorrections.push(...shapeCorrections);
        }
      }

      // Extract and analyze drawn text from path shapes
      const pathShapes = canvasHistoryRef.current.filter(shape => shape.type === 'path');
      if (pathShapes.length > 0) {
        console.log('Found path shapes, attempting to extract drawn text...');
        try {
          const drawnTextResult = await extractDrawnText(canvasData, apiKey);
          if (drawnTextResult.extractedTexts && drawnTextResult.extractedTexts.length > 0) {
            console.log('Extracted drawn text:', drawnTextResult.extractedTexts);

            // Create virtual text shapes for drawn text analysis
            for (let i = 0; i < drawnTextResult.extractedTexts.length; i++) {
              const drawnText = drawnTextResult.extractedTexts[i];
              if (drawnText.text && drawnText.text.trim()) {
                // Create a virtual text shape ID for drawn text
                const virtualTextShapeId = `drawn-text-${i}-${Date.now()}`;

                // Analyze the drawn text
                const drawnTextCorrections = await analyzeTextContent(
                  drawnText.text,
                  virtualTextShapeId,
                  apiKey,
                  'chemistry'
                );

                // Add position information if available
                const correctionsWithPosition = drawnTextCorrections.map(correction => ({
                  ...correction,
                  x: drawnText.x || 100,
                  y: drawnText.y || 100,
                  textShapeId: virtualTextShapeId,
                  originalText: drawnText.text,
                  // Mark as drawn text for different display
                  isDrawnText: true
                }));

                textCorrections.push(...correctionsWithPosition);
              }
            }
          }
        } catch (drawnTextError) {
          console.warn('Failed to extract drawn text:', drawnTextError);
        }
      }

      // Combine general corrections with text-specific corrections
      const allCorrections = [...result.corrections, ...textCorrections];

      setAnalysisResult(result);
      setCorrections(allCorrections);
      setShowCorrections(true);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Failed to analyze canvas content. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }; const clearCorrections = () => {
    setCorrections([]);
    setShowCorrections(false);
    setAnalysisResult(null);
  };

  const convertToChemistry = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const apiKey = getStoredAPIKey();
    if (!apiKey) {
      alert('Please add your Gemini API key in settings to use the chemistry conversion feature.');
      return;
    }

    setIsConverting(true);
    try {
      // Convert canvas to base64
      const canvasData = canvas.toDataURL('image/png', 0.8);

      // Convert to chemistry structure
      const result = await convertCanvasToChemistry(canvasData, apiKey);

      if (result.success && result.structure) {
        setChemistryStructure(result.structure);
        setShowChemistryViewer(true);
      } else {
        alert(result.error || 'Failed to convert to chemistry structure');
      }
    } catch (error) {
      console.error('Chemistry conversion failed:', error);
      alert('Failed to convert to chemistry structure. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleToolbarResizeStart = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    toolbarResizeStateRef.current = {
      startX: event.clientX,
      startWidth: toolbarWidth,
    };
    setIsResizingToolbar(true);
  };

  // Text Correction Diff Component - GitHub-style inline highlighting
  const TextCorrectionDiff = ({
    originalText,
    corrections,
    isDrawn,
  }: {
    originalText: string;
    corrections: Correction[];
    isDrawn?: boolean;
  }) => {
    const sortedCorrections = useMemo(
      () => [...corrections].sort((a, b) => (a.startChar ?? 0) - (b.startChar ?? 0)),
      [corrections]
    );

    if (sortedCorrections.length === 0) {
      return (
        <div className="pointer-events-auto overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/95 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 bg-slate-800/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-full bg-red-500" />
                <span className="h-3 w-3 rounded-full bg-yellow-500" />
                <span className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                {isDrawn ? 'Drawn Text Correction' : 'Text Correction'}
              </div>
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wide text-slate-400">0 issues</span>
          </div>
          <div className="px-4 py-3">
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-200">
              {originalText || 'No corrections needed.'}
            </pre>
          </div>
        </div>
      );
    }

    const clampIndex = (value: number | undefined) => {
      if (!Number.isFinite(value)) return 0;
      return Math.max(0, Math.min(originalText.length, value ?? 0));
    };

    const correctedText = useMemo(() => {
      if (!originalText) return '';

      let result = '';
      let cursor = 0;

      sortedCorrections.forEach((correction) => {
        const start = clampIndex(correction.startChar);
        const end = Math.max(start, clampIndex(correction.endChar));

        result += originalText.slice(cursor, start);

        if (typeof correction.replacementText === 'string') {
          result += correction.replacementText;
        } else {
          result += originalText.slice(start, end);
        }

        cursor = end;
      });

      result += originalText.slice(cursor);
      return result;
    }, [originalText, sortedCorrections]);

    const hasMeaningfulReplacement = useMemo(() => {
      return sortedCorrections.some((correction) => {
        if (typeof correction.replacementText !== 'string') return false;
        const start = clampIndex(correction.startChar);
        const end = Math.max(start, clampIndex(correction.endChar));
        const originalSegment = originalText.slice(start, end);
        return correction.replacementText.trim() !== originalSegment.trim();
      });
    }, [sortedCorrections, originalText]);

    const diffHunks = useMemo(() => {
      if (!hasMeaningfulReplacement) {
        return [];
      }

      const originalNormalized = originalText.endsWith('\n') ? originalText : `${originalText}\n`;
      const correctedNormalized = correctedText.endsWith('\n') ? correctedText : `${correctedText}\n`;

      try {
        const patch = createTwoFilesPatch(
          'Student Work',
          'Suggested Fix',
          originalNormalized,
          correctedNormalized,
          '',
          ''
        );
        const files = parseDiff(patch);
        if (files.length > 0) {
          return files[0].hunks;
        }
      } catch (error) {
        console.warn('Failed to generate diff for text correction overlay:', error);
      }

      return [];
    }, [originalText, correctedText, hasMeaningfulReplacement]);

    const renderHighlightedText = () => {
      if (!originalText) return null;

      const segments: JSX.Element[] = [];
      let cursor = 0;

      sortedCorrections.forEach((correction, index) => {
        const start = clampIndex(correction.startChar);
        const end = Math.max(start, clampIndex(correction.endChar));

        if (start > cursor) {
          segments.push(
            <span key={`normal-${index}`} className="text-slate-200">
              {originalText.slice(cursor, start)}
            </span>
          );
        }

        const highlightClass = correction.type === 'error'
          ? 'bg-red-500/20 text-red-200 border-b border-red-500/60'
          : correction.type === 'warning'
            ? 'bg-yellow-500/20 text-yellow-200 border-b border-yellow-500/60'
            : 'bg-blue-500/20 text-blue-200 border-b border-blue-500/60';

        const highlightedText = originalText.slice(start, end) || correction.replacementText || '';

        segments.push(
          <span
            key={`highlight-${index}`}
            className={`${highlightClass} relative rounded-sm px-1 py-0.5 text-sm leading-relaxed`}
          >
            {highlightedText}
          </span>
        );

        cursor = end;
      });

      if (cursor < originalText.length) {
        segments.push(
          <span key="remainder" className="text-slate-200">
            {originalText.slice(cursor)}
          </span>
        );
      }

      return segments;
    };

    const typeBadgeClass = (type: Correction['type']) => {
      if (type === 'error') return 'bg-red-500/20 text-red-200 border border-red-500/40';
      if (type === 'warning') return 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/40';
      return 'bg-blue-500/20 text-blue-200 border border-blue-500/40';
    };

    return (
      <div className="pointer-events-auto overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/95 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 bg-slate-800/70 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              {isDrawn ? 'Drawn Text Correction' : 'Text Correction'}
            </div>
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wide text-slate-400">
            {sortedCorrections.length} issue{sortedCorrections.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="diff max-h-60 overflow-auto border-b border-slate-700/60 px-4 py-3">
          {diffHunks.length > 0 ? (
            <Diff viewType="split" diffType="modify" hunks={diffHunks}>
              {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
            </Diff>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-200">
              {renderHighlightedText()}
            </pre>
          )}
        </div>

        <div className="space-y-3 px-4 py-3">
          {sortedCorrections.map((correction) => (
            <div
              key={correction.id}
              className="rounded-lg border border-slate-700/70 bg-slate-800/60 px-3 py-2 shadow-inner"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                <span className={`rounded-full px-2 py-0.5 ${typeBadgeClass(correction.type)}`}>
                  {correction.type}
                </span>
                <span className="rounded-full border border-slate-600/50 px-2 py-0.5 text-slate-200/80">
                  {correction.severity}
                </span>
                <span className="rounded-full border border-slate-600/50 px-2 py-0.5 text-slate-200/70">
                  {correction.category}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-100">
                {correction.message}
              </p>
              {typeof correction.replacementText === 'string' && (
                <div className="mt-2 rounded border border-slate-700/60 bg-slate-900/70 px-2 py-1 text-[11px] font-mono text-slate-300">
                  Suggestion: <span className="text-slate-100">{correction.replacementText || '⌀ (remove text)'}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const quickActionButtons: QuickActionButton[] = [
    {
      id: 'minerals',
      label: 'Minerals',
      icon: Gem,
      title: 'Search Minerals (COD 3D)',
      onClick: () => setShowMineralSearch(true),
      badgeClass: 'bg-emerald-500/15 text-emerald-300'
    },
    {
      id: 'reactions',
      label: 'Reactions',
      icon: FlaskConical,
      title: 'Search Reactions',
      onClick: () => setShowInlineReactionSearch((prev) => !prev),
      badgeClass: 'bg-orange-500/15 text-orange-300',
      active: showInlineReactionSearch,
      activeClass: 'ring-1 ring-orange-500/40 border-orange-500/60'
    },
    {
      id: 'proteins',
      label: 'Proteins',
      icon: Atom,
      title: 'Browse PDB Proteins',
      onClick: () => setShowProteinSearch(true),
      badgeClass: 'bg-rose-500/15 text-rose-300'
    },
    {
      id: 'ar',
      label: 'AR',
      icon: Scan,
      title: selectedMoleculeCid
        ? 'View selected molecule in AR'
        : 'Select a molecule on the canvas to enable AR viewer',
      onClick: openArViewer,
      badgeClass: 'bg-purple-500/15 text-purple-300',
      disabled: !selectedMoleculeCid
    }
  ];

  return (
    <div
      ref={canvasContainerRef}
      className="relative w-full h-full bg-slate-900"
      onDragEnter={handleDocumentDragEnter}
      onDragOver={handleDocumentDragOver}
      onDragLeave={handleDocumentDragLeave}
      onDrop={handleDocumentDrop}
    >
      {/* Chemistry Toolbar Toggle Button */}
      <div className="absolute top-8 left-8 z-10">
        <button
          onClick={() => setShowChemistryToolbar(!showChemistryToolbar)}
          className={`p-2 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-lg transition-all ${showChemistryToolbar ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'
            }`}
          title={showChemistryToolbar ? "Hide Chemistry Tools" : "Show Chemistry Tools"}
          onDoubleClick={() => openDocumentOnCanvas(doc.id)}
        >
          <Atom size={18} />
        </button>
      </div>

      {arQrCid && arQrUrl ? (
        <div className="absolute top-24 left-1/2 z-40 w-[min(320px,90vw)] -translate-x-1/2 sm:left-auto sm:right-8 sm:translate-x-0">
          <div className="rounded-2xl border border-purple-500/40 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-purple-300/80">AR Ready</p>
                <p className="text-sm font-semibold text-slate-50">
                  {arQrLabel || `PubChem CID ${arQrCid}`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeArQrOverlay}
                className="rounded-full p-1 text-purple-100 transition hover:bg-purple-500/20"
                aria-label="Close AR QR overlay"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mt-3 flex flex-col items-center gap-3">
              <div className="rounded-xl border border-purple-400/30 bg-slate-900/80 p-3">
                <QRCodeSVG value={arQrUrl} size={184} includeMargin />
              </div>
              <p className="text-center text-[11px] leading-relaxed text-purple-100/80">
                Scan with your phone's camera or a QR app to launch the ChemCanvas AR viewer and place this molecule in your space.
              </p>
              <div className="w-full rounded-lg border border-purple-400/20 bg-slate-900/70 p-2 text-center">
                <p className="select-all text-[10px] font-mono text-purple-200/80 break-all">{arQrUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!arQrUrl || typeof window === 'undefined') {
                    return;
                  }
                  window.open(arQrUrl, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-purple-400/40 bg-purple-600/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-purple-50 transition hover:bg-purple-600/40"
              >
                <Smartphone size={14} />
                Open Link
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeMineralPreview ? (
        <MineralCrystalPreview
          codId={activeMineralPreview.codId}
          name={activeMineralPreview.name}
          onClose={() => setActiveMineralPreview(null)}
        />
      ) : null}

      {/* Chemistry Toolbar */}
      {showChemistryToolbar && (
        <div className="absolute top-4 left-8 z-10">
          <ChemistryToolbar
            onToolSelect={setChemistryTool}
            currentTool={chemistryTool}
            onColorChange={setChemistryColor}
            onStrokeColorChange={handleChemistryStrokeColorChange}
            strokeColor={chemistryStrokeColor}
            fillEnabled={chemistryFillEnabled}
            onFillToggle={setChemistryFillEnabled}
            fillColor={chemistryFillColor}
            onFillColorChange={setChemistryFillColor}
            currentColor={chemistryColor}
            onSizeChange={setChemistrySize}
            currentSize={chemistrySize}
            onOpenCalculator={onOpenCalculator}
            onOpenMolView={onOpenMolView}
            onOpenPeriodicTable={onOpenPeriodicTable}
            onOpenMineralSearch={() => setShowMineralSearch(true)}
            onOpenArViewer={openArViewer}
            onOpenChemistryWidgets={() => setShowChemistryWidgetPanel(true)}
            isCollapsed={isToolbarCollapsed}
            onToggleCollapse={() => setIsToolbarCollapsed((prev) => !prev)}
            width={toolbarWidth}
            onResizeStart={handleToolbarResizeStart}
            selectedMoleculeCid={selectedMoleculeCid}
          />
        </div>
      )}

      {/* Canvas Controls - Compact Header Layout */}
      <div className="absolute top-4 left-1/2 z-50 w-full max-w-4xl -translate-x-1/2 px-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur-lg lg:flex-row lg:items-center lg:gap-4">
          <div className="flex flex-wrap items-center gap-2.5 lg:flex-nowrap lg:overflow-x-auto">
            {quickActionButtons.map((button) => {
              const IconComponent = button.icon;
              const baseClasses = 'group inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold transition-all duration-200';
              const activeClasses = button.active
                ? `bg-slate-800/95 text-white border-slate-500/80 shadow-lg ${button.activeClass ?? ''}`
                : 'bg-slate-900/40 text-slate-200 border-slate-700/60 hover:border-slate-500/50 hover:bg-slate-800/70 hover:text-white';
              const disabledClasses = button.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '';

              return (
                <button
                  key={button.id}
                  onClick={button.onClick}
                  title={button.title}
                  className={`${baseClasses} ${activeClasses} ${disabledClasses}`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] ${button.badgeClass}`}>
                    <IconComponent size={14} />
                  </span>
                  <span>{button.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-[220px]">
            <InlineMoleculeSearch
              className="w-full"
              onSelectMolecule={(moleculeData) => {
                void (async () => {
                  try {
                    await insertMoleculeToCanvas(moleculeData);
                  } catch (error) {
                    console.error('Failed to insert molecule from search:', error);
                  }
                })();
              }}
            />
          </div>
        </div>
      </div>

      {/* Reaction Search - Below Header */}
      {showInlineReactionSearch && (
        <div className="absolute top-20 left-1/2 z-10 transform -translate-x-1/2">
          <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-lg p-4">
            <InlineReactionSearch
              onSelectReaction={(reactionData) => {
                void (async () => {
                  try {
                    await insertReactionToCanvas(reactionData);
                    setShowInlineReactionSearch(false); // Hide search after insertion
                  } catch (error) {
                    console.error('Failed to insert reaction from search:', error);
                  }
                })();
              }}
            />
          </div>
        </div>
      )}

      {/* Right-side Controls - Consolidated */}
      <div className="absolute right-8 top-1/2 z-10 flex -translate-y-1/2 flex-col items-end gap-3 transform">
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 shadow-lg space-y-3">

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`w-full p-2 rounded-lg transition-all flex items-center justify-center ${showGrid
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700/50'
              }`}
            title="Toggle Grid"
          >
            <Grid3x3 size={16} />
          </button>

          {/* Background Toggle */}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setCanvasBackground('dark')}
              className={`p-2 rounded-lg transition-all ${canvasBackground === 'dark'
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50'
                }`}
              title="Dark Canvas"
            >
              <Moon size={14} />
            </button>
            <button
              onClick={() => setCanvasBackground('white')}
              className={`p-2 rounded-lg transition-all ${canvasBackground === 'white'
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50'
                }`}
              title="Light Canvas"
            >
              <Sun size={14} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex flex-col gap-1">
            <button
              onClick={handleZoomIn}
              className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-all"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-all"
              title="Reset Zoom"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 text-slate-400 hover:bg-slate-700/50 rounded-lg transition-all"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
          </div>

          {/* Clear Canvas */}
          <button
            onClick={clearCanvas}
            className="w-full p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition-all"
            title="Clear Canvas"
          >
            <Trash2 size={14} />
          </button>

        </div>

        {/* Chemistry Controls */}
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-xl p-2 shadow-lg space-y-2">

          {/* Chemistry Conversion Button */}
          <button
            onClick={convertToChemistry}
            disabled={isConverting}
            className={`w-full p-2 rounded-lg transition-all flex items-center justify-center gap-2 ${isConverting
                ? 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            title={isConverting ? "Converting..." : "Convert to Chemistry Structure"}
          >
            {isConverting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Beaker size={14} />
            )}
          </button>

          {/* Correction Button */}
          <button
            onClick={showCorrections ? clearCorrections : analyzeCanvas}
            disabled={isAnalyzing}
            className={`w-full p-2 rounded-lg transition-all flex items-center justify-center gap-2 ${isAnalyzing
                ? 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                : showCorrections
                  ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            title={isAnalyzing ? "Analyzing..." : showCorrections ? "Clear Corrections" : "Check My Work"}
          >
            {isAnalyzing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : showCorrections ? (
              <CheckCircle size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
          </button>

        </div>

      </div>

      {/* Zoom Indicator */}
      <div className="absolute bottom-8 right-8 z-10 rounded-lg border border-slate-700/50 bg-slate-800/90 px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="text-xs font-medium text-slate-300">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          touchAction: 'none'
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Dropped document cards */}
      {droppedDocuments.map(doc => {
        const pdfWidth = doc.viewportWidth ?? DEFAULT_PDF_WIDTH;
        const pdfHeight = doc.viewportHeight ?? DEFAULT_PDF_HEIGHT;
        const isExpanded = expandedDocuments.has(doc.id);
        return (
          <div
            key={doc.id}
            className="absolute z-30"
            style={{
              left: `${doc.position.x}px`,
              top: `${doc.position.y}px`
            }}
          >
            {doc.type === 'pdf' ? (
              <div
                className="group relative max-w-[92vw] rounded-xl shadow-xl"
                style={{ width: pdfWidth, height: pdfHeight }}
              >
                <div
                  className="pointer-events-auto absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80 opacity-0 transition group-hover:opacity-100 cursor-move"
                  onMouseDown={(event) => handleDocumentDragStart(event, doc.id)}
                >
                  <Move size={12} />
                  Drag
                </div>
                <iframe
                  title={doc.name}
                  src={doc.content}
                  className="block h-full w-full rounded-xl border border-slate-700/60 bg-white"
                  onDoubleClick={() => openDroppedDocument(doc)}
                />
                <div className="absolute top-2 right-2 flex flex-wrap gap-2 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (onDocumentAddToChat) {
                        onDocumentAddToChat({ documentId: doc.id });
                      }
                    }}
                    className="rounded-full bg-emerald-600/80 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    Add to Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => openDroppedDocument(doc)}
                    className="rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white hover:bg-black"
                  >
                    Open Tab
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDroppedDocument(doc.id)}
                    className="rounded-full bg-black/70 p-1 text-white/80 hover:bg-black hover:text-white"
                    aria-label={`Remove ${doc.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  className="pointer-events-auto absolute bottom-2 right-2 h-4 w-4 cursor-se-resize rounded-full border border-white/70 bg-black/60 opacity-0 transition group-hover:opacity-100"
                  onMouseDown={(event) => handleDocumentResizeStart(event, doc.id)}
                  aria-label="Resize document"
                />
              </div>
            ) : (
              <div
                className="w-[420px] max-w-[92vw] rounded-3xl border border-slate-700/80 bg-slate-950/90 text-slate-50 shadow-2xl backdrop-blur"
                onDoubleClick={() => openDroppedDocument(doc)}
                title="Double-click to open in a new tab"
              >
                <div
                  className="flex items-center justify-between gap-3 border-b border-slate-700/70 px-5 py-3 cursor-move select-none"
                  onMouseDown={(event) => handleDocumentDragStart(event, doc.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-blue-200">
                      <FileText size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{doc.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {getDocumentTypeLabel(doc.type)} • {formatDocumentSize(doc.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDroppedDocument(doc.id)}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    aria-label={`Remove ${doc.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-3 px-5 py-4">
                  {doc.type === 'text' && (
                    <div
                      className={`overflow-auto rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 text-sm text-slate-100 ${isExpanded ? 'max-h-[26rem]' : 'max-h-48'
                        }`}
                    >
                      <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed">
                        {doc.preview || doc.content || 'Document appears to be empty.'}
                      </pre>
                    </div>
                  )}

                  {doc.type === 'image' && (
                    <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3">
                      <img
                        src={doc.content}
                        alt={doc.name}
                        className="max-h-full w-full rounded-xl object-contain"
                      />
                    </div>
                  )}

                  {doc.type === 'spreadsheet' && (
                    <div className="space-y-2">
                      {doc.sheetPreviews?.length ? (
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                            <span>
                              Sheet: <span className="font-semibold text-slate-200">{doc.sheetPreviews[0].name}</span>
                            </span>
                            <span>
                              Showing first {doc.sheetPreviews[0].rows.length}{' '}
                              {doc.sheetPreviews[0].rows.length === 1 ? 'row' : 'rows'}
                            </span>
                          </div>
                          <div
                            className={`overflow-auto rounded-2xl border border-slate-700/70 bg-slate-900/80 ${isExpanded ? 'max-h-[28rem]' : 'max-h-60'
                              }`}
                          >
                            <table className="w-full text-xs text-left text-slate-200">
                              <thead className="sticky top-0 bg-slate-800/90">
                                <tr>
                                  {doc.sheetPreviews[0].headers.map((header, idx) => (
                                    <th key={idx} className="px-3 py-2 font-semibold border-b border-slate-700/60">
                                      {header || `Col ${idx + 1}`}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {doc.sheetPreviews[0].rows.map((row, rowIndex) => (
                                  <tr key={rowIndex} className="even:bg-slate-800/40">
                                    {row.map((cell, cellIdx) => (
                                      <td key={cellIdx} className="px-3 py-2 border-b border-slate-800/60 text-[11px]">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 text-xs text-slate-300">
                          Could not generate a table preview for this spreadsheet.
                        </div>
                      )}
                      {doc.preview && (
                        <p className="text-[11px] text-slate-400">
                          Summary excerpt:{' '}
                          <span className="text-slate-200">{doc.preview.slice(0, 160)}{doc.preview.length > 160 ? '…' : ''}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {doc.type === 'audio' && (
                    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
                      <audio controls className="w-full" src={doc.viewerUrl ?? doc.content}>
                        Your browser does not support the audio element.
                      </audio>
                      <p className="mt-2 text-xs text-slate-400">Audio preview</p>
                    </div>
                  )}

                  {doc.type === 'video' && (
                    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-3">
                      <video
                        controls
                        className="max-h-[320px] w-full rounded-xl bg-black object-contain"
                        src={doc.viewerUrl ?? doc.content}
                      >
                        Your browser does not support the video tag.
                      </video>
                      <p className="mt-2 text-xs text-slate-400">Video preview</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="text-slate-400/90">{formatDocumentTimestamp(doc.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => openDroppedDocument(doc)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-600/60 px-3 py-1 font-semibold text-slate-100 transition hover:border-blue-500/80 hover:text-white"
                    >
                      <ExternalLink size={12} />
                      Open in Tab
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDocumentExpansion(doc.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-600/60 px-3 py-1 font-semibold text-slate-100 transition hover:border-blue-500/80 hover:text-white"
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Drop overlay */}
      {isDocumentDragActive && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-400/60 bg-slate-950/80 text-center text-blue-100 backdrop-blur">
          <Upload className="mb-3 h-10 w-10" />
          <p className="text-base font-semibold">Drop resources anywhere on the canvas</p>
          <p className="text-xs text-blue-100/80">PDFs, docs, spreadsheets, audio/video, links, and notes are all supported.</p>
        </div>
      )}

      {documentDropFeedback && (
        <div
          className={`pointer-events-none absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg ${documentDropFeedback.type === 'success'
              ? 'bg-emerald-500/90 text-white'
              : 'bg-rose-500/90 text-white'
            }`}
        >
          {documentDropFeedback.message}
        </div>
      )}

      {isMarkdownVisible && (
        <div
          className="group absolute z-40 max-w-[92vw] pointer-events-auto"
          style={{
            left: `${markdownPanePosition.x}px`,
            top: `${markdownPanePosition.y}px`
          }}
        >
          <div
            className="relative flex flex-col rounded-3xl border border-sky-500/50 bg-slate-950/95 text-slate-100 shadow-[0_20px_60px_rgba(8,15,40,0.85)] backdrop-blur-xl"
            style={{
              width: `${markdownPaneSize.width}px`,
              height: isMarkdownCollapsed ? 'auto' : `${markdownPaneSize.height}px`
            }}
          >
            <div
              className="flex items-center gap-3 rounded-t-3xl border-b border-slate-800/70 bg-slate-900/70 px-4 py-3 cursor-move select-none"
              onMouseDown={handleMarkdownDragStart}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-sky-400/70 bg-sky-500/20 text-sky-200">
                <ListOrdered size={16} />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Canvas Explanations</span>
                <span className="text-[11px] text-slate-400">
                  {markdownEntries.length ? `${markdownEntries.length} card${markdownEntries.length === 1 ? '' : 's'} · ${markdownStepCount} step${markdownStepCount === 1 ? '' : 's'}` : 'Waiting for updates…'}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMarkdownCollapsed(prev => !prev)}
                  className="rounded-full border border-slate-700/70 bg-slate-900/80 p-1 text-slate-300 transition hover:border-sky-400 hover:text-white"
                  aria-label={isMarkdownCollapsed ? 'Expand explanations panel' : 'Collapse explanations panel'}
                >
                  {isMarkdownCollapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                </button>
                <button
                  type="button"
                  onClick={clearMarkdownEntries}
                  disabled={!markdownEntries.length}
                  className={`rounded-full border border-slate-700/70 bg-slate-900/80 p-1 text-slate-300 transition ${markdownEntries.length ? 'hover:border-rose-400 hover:text-rose-200' : 'opacity-40 cursor-not-allowed'
                    }`}
                  aria-label="Clear explanation cards"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMarkdownVisible(false)}
                  className="rounded-full border border-slate-700/70 bg-slate-900/80 p-1 text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                  aria-label="Hide explanations panel"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {!isMarkdownCollapsed && (
              <>
                <div className="flex items-center justify-between border-b border-slate-800/70 bg-slate-950/60 px-4 py-2 text-[11px] text-slate-400">
                  <span>{latestMarkdownTimestamp ? `Last update • ${latestMarkdownTimestamp}` : 'Live feed idle'}</span>
                  <span>{markdownStepCount} step{markdownStepCount === 1 ? '' : 's'}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {markdownEntries.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/70 px-4 py-8 text-center text-sm text-slate-400">
                      When Gemini explains something, it will land here with full Markdown + LaTeX support.
                    </div>
                  ) : (
                    markdownEntries.map(entry => (
                      <div key={entry.id} className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-inner">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                          <span className="text-slate-100">{entry.title}</span>
                          <span>{formatDocumentTimestamp(entry.createdAt)}</span>
                        </div>
                        <div className="space-y-2">
                          {entry.steps.map((step, stepIndex) => (
                            <div key={`${entry.id}-step-${stepIndex}`} className="rounded-2xl border border-slate-800/50 bg-slate-950/60 p-3">
                              <ReactMarkdown
                                remarkPlugins={markdownRemarkPlugins}
                                rehypePlugins={markdownRehypePlugins}
                                components={markdownComponents}
                              >
                                {step}
                              </ReactMarkdown>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className="absolute bottom-2 right-3 h-4 w-4 cursor-se-resize rounded-full border border-slate-600/70 bg-slate-800/80 opacity-0 transition group-hover:opacity-100"
                  onMouseDown={handleMarkdownResizeStart}
                  aria-label="Resize explanations panel"
                />
              </>
            )}
          </div>
        </div>
      )}

      {!isMarkdownVisible && markdownEntries.length > 0 && (
        <button
          type="button"
          className="absolute bottom-8 left-8 z-20 inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 shadow-lg backdrop-blur hover:border-sky-400 hover:text-white"
          onClick={() => {
            setIsMarkdownVisible(true);
            setIsMarkdownCollapsed(false);
          }}
        >
          <ListOrdered size={14} />
          View Explanations
        </button>
      )}

      {/* Text Input Overlay */}
      {isTextInputVisible && (
        <div
          className="absolute z-30"
          style={{
            left: textInputPosition.x,
            top: textInputPosition.y,
          }}
        >
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-xl min-w-96 max-w-lg">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-slate-200 mb-2">
                {editingTextShapeId ? 'Edit Text Note' : 'Add Text Note'}
              </h3>
              <textarea
                value={currentTextInput}
                onChange={(e) => setCurrentTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleTextSubmit();
                  } else if (e.key === 'Escape') {
                    handleTextCancel();
                  }
                }}
                placeholder={editingTextShapeId ? "Edit your text here..." : "Write your notes, answers, or text here...&#10;&#10;Press Ctrl+Enter to submit&#10;Press Escape to cancel"}
                className="w-full bg-slate-700 text-white px-3 py-3 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none resize-both min-h-32 max-h-96"
                autoFocus
                rows={8}
              />
            </div>
            <div className="flex justify-between items-center">
              <div className="text-xs text-slate-400">
                Ctrl+Enter to submit • Escape to cancel
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTextCancel}
                  className="px-3 py-1.5 bg-slate-600 text-white text-sm rounded hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTextSubmit}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  {editingTextShapeId ? 'Update Text' : 'Add Text'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedShape?.type === 'molecule' && selectedShape.moleculeData && (
        <div className="absolute top-8 right-8 z-20 flex flex-col gap-3 max-w-xs">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/90 backdrop-blur-sm p-4 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Selected Molecule</p>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-400/40">
                <Atom className="text-cyan-300" size={18} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-slate-200 leading-tight">
                  {selectedShape.moleculeData.displayName || selectedShape.moleculeData.name || `CID ${selectedShape.moleculeData.cid}`}
                </p>
                {selectedShape.moleculeData.molecularFormula && (
                  <p className="text-xs text-slate-400">{selectedShape.moleculeData.molecularFormula}</p>
                )}
              </div>
            </div>

            {has3DStructure ? (
              <div className="mt-3 space-y-3">
                <button
                  type="button"
                  onClick={() => toggleSelectedMolecule3D(!selectedShape.use3D)}
                  className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${selectedShape.use3D
                      ? 'bg-cyan-500/90 text-slate-900 hover:bg-cyan-400'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 hover:bg-slate-800'
                    }`}
                  title={selectedShape.use3D ? 'Disable 3D orbit mode' : 'Enable 3D orbit mode'}
                >
                  <RotateCcw size={16} />
                  {selectedShape.use3D ? 'Disable 3D Orbit' : 'Enable 3D Orbit'}
                </button>

                {selectedShape.use3D && (
                  <>
                    {(() => {
                      const rotation3D = selectedShape.rotation3D ?? { ...DEFAULT_MOLECULE_3D_ROTATION };
                      return (
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Pitch: {Math.round(rotation3D.x)}°</span>
                          <span>Yaw: {Math.round(rotation3D.y)}°</span>
                        </div>
                      );
                    })()}

                    <div className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-3 text-[11px] leading-relaxed text-slate-300">
                      Use the Rotate tool (🔄) and left-drag on the molecule to orbit it in 3D. Right-drag still spins the 2D orientation.
                    </div>

                    <button
                      type="button"
                      onClick={resetSelectedMolecule3DOrientation}
                      className="w-full rounded-lg border border-slate-700/60 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
                    >
                      Reset 3D Orientation
                    </button>
                  </>
                )}

                {selectedShape.use3D && (
                  <div className="rounded-lg border border-slate-700/60 bg-slate-800/70 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300 mb-2">Annotations</p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400">Label</label>
                        <input
                          type="text"
                          value={annotationLabel}
                          onChange={(event) => setAnnotationLabel(event.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                          placeholder="e.g., Active site"
                        />
                      </div>

                      <div className="space-y-2">
                        <span className="text-[11px] text-slate-400">Quick labels</span>
                        <div className="flex flex-wrap gap-2">
                          {annotationLabelOptions.map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setAnnotationLabel(option)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${annotationLabel.toLowerCase() === option.toLowerCase()
                                  ? 'bg-cyan-500/90 text-slate-900 border-cyan-400 hover:bg-cyan-400'
                                  : 'bg-slate-900/60 text-slate-200 border-slate-700/60 hover:bg-slate-800'
                                }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customAnnotationLabel}
                            onChange={(event) => setCustomAnnotationLabel(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                addCustomAnnotationLabel();
                              }
                            }}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                            placeholder="Add custom label"
                          />
                          <button
                            type="button"
                            onClick={addCustomAnnotationLabel}
                            disabled={!customAnnotationLabel.trim()}
                            className="rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-400">Color</span>
                        <div className="flex flex-wrap gap-2">
                          {['#f97316', '#facc15', '#38bdf8', '#22d3ee', '#a855f7', '#34d399'].map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setAnnotationColor(color)}
                              className={`h-6 w-6 rounded-full border-2 ${annotationColor === color ? 'border-white' : 'border-transparent'} shadow-lg`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedShapeId) return;
                            setAnnotationMode({
                              shapeId: selectedShapeId,
                              label: annotationLabel,
                              color: annotationColor
                            });
                            setAnnotationHint('Click on the atom you want to highlight.');
                          }}
                          className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${annotationMode?.shapeId === selectedShapeId
                              ? 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'
                              : 'bg-slate-900/80 text-slate-200 border border-slate-700/60 hover:bg-slate-800'
                            }`}
                        >
                          {annotationMode?.shapeId === selectedShapeId ? 'Annotation Mode Active' : 'Mark Active Centre'}
                        </button>
                        {annotationMode?.shapeId === selectedShapeId && (
                          <button
                            type="button"
                            onClick={() => {
                              setAnnotationMode(null);
                              setAnnotationHint(null);
                            }}
                            className="w-full rounded-lg border border-slate-700/60 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                          >
                            Cancel Annotation
                          </button>
                        )}
                        {annotationHint && (
                          <p className="text-[11px] text-cyan-300">{annotationHint}</p>
                        )}
                      </div>

                      {selectedShape.annotations && selectedShape.annotations.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-400 uppercase tracking-wide">Current highlights</p>
                          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                            {selectedShape.annotations.map(annotation => (
                              <div
                                key={annotation.id}
                                className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-900/80 px-2 py-2 text-xs text-slate-200"
                              >
                                <span className="flex items-center gap-2">
                                  <span
                                    className="inline-flex h-3 w-3 rounded-full"
                                    style={{ backgroundColor: annotation.color }}
                                  />
                                  {annotation.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeAnnotation(selectedShape.id, annotation.id)}
                                  className="text-slate-400 hover:text-red-400"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                3D orbit controls will appear once a 3D structure is available for this molecule.
              </p>
            )}

            <button
              type="button"
              onClick={openSelectedMoleculeIn3D}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/80 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
              title="Open interactive MolView tab"
            >
              View in MolView
            </button>
          </div>
        </div>
      )}

      {/* Selected Protein Display */}
      {selectedShape?.type === 'protein' && selectedShape.proteinData && (
        <div className="absolute top-8 right-8 z-20 flex flex-col gap-3 max-w-xs">
          <div className="rounded-3xl border border-slate-700/60 bg-slate-900/90 backdrop-blur-sm p-3 shadow-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected Protein</p>
            <div className="rounded-2xl border border-white/5 overflow-hidden">
              <ProteinCanvasViewer
                pdbId={selectedShape.proteinData.entryId}
                pdbData={selectedShape.proteinData.pdbData}
                structureFormat={selectedShape.proteinData.structureFormat}
                cifUrl={selectedShape.proteinData.cifUrl}
                height={220}
                isInteractive
                title={selectedShape.proteinData.displayName}
              />
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-400/40">
                <Atom className="text-rose-300" size={18} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-slate-200 leading-tight">
                  {selectedShape.proteinData.displayName || `PDB ${selectedShape.proteinData.entryId}`}
                </p>
                <p className="text-xs text-slate-400">{selectedShape.proteinData.title}</p>
                {selectedShape.proteinData.organism && (
                  <p className="text-xs text-slate-500">{selectedShape.proteinData.organism}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  window.open(`https://www.rcsb.org/3d-view/${selectedShape.proteinData!.entryId.toUpperCase()}`, '_blank');
                }}
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-rose-600/90 text-white hover:bg-rose-500"
                title="Open interactive 3D Mol* viewer on RCSB"
              >
                <Database size={16} />
                View 3D Structure (Mol*)
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(`https://www.rcsb.org/structure/${selectedShape.proteinData!.entryId.toUpperCase()}`, '_blank');
                }}
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-slate-800/80 text-slate-200 border border-slate-700/60 hover:bg-slate-800"
                title="Open PDB entry page"
              >
                <ExternalLink size={16} />
                PDB Entry Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Reaction Display */}
      {selectedShape?.type === 'reaction' && selectedShape.reactionData && (
        <div className="absolute top-8 right-8 z-20 flex flex-col gap-3 max-w-xs">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/90 backdrop-blur-sm p-4 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Selected Reaction</p>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/20 border border-orange-400/40">
                <FlaskConical className="text-orange-300" size={18} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-slate-200 leading-tight">
                  Chemical Reaction
                </p>
                <p className="text-xs text-slate-400">SMILES: {selectedShape.reactionData.smiles}</p>
                <p className="text-xs text-slate-500">
                  Added: {new Date(selectedShape.reactionData.timestamp).toLocaleString()}
                </p>
                {selectedShape.reactionData.metadata?.originalQuery && (
                  <p className="text-[11px] text-slate-500">
                    Query: {selectedShape.reactionData.metadata.originalQuery}
                  </p>
                )}
                {typeof selectedShape.reactionData.metadata?.confidence === 'number' && (
                  <p className="text-[11px] text-slate-500">
                    Confidence: {(selectedShape.reactionData.metadata.confidence * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={() => {
                  // Copy SMILES to clipboard
                  navigator.clipboard.writeText(selectedShape.reactionData!.smiles);
                }}
                className="w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-slate-800/80 text-slate-200 border border-slate-700/60 hover:bg-slate-800"
                title="Copy reaction SMILES"
              >
                Copy SMILES
              </button>

              <button
                type="button"
                onClick={() => handleAddSdfModelsToReaction(selectedShape.id)}
                disabled={reactionSdfLoadingId === selectedShape.id}
                className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-2 border ${selectedShape.reactionData?.sdfShapeIds?.length
                    ? 'border-blue-500/70 bg-blue-600 text-white hover:bg-blue-500'
                    : 'border-emerald-500/70 bg-emerald-600 text-white hover:bg-emerald-500'
                  } ${reactionSdfLoadingId === selectedShape.id ? 'opacity-80 cursor-wait' : ''}`}
                title={selectedShape.reactionData?.sdfShapeIds?.length
                  ? 'Rebuild 3D SDF tiles beneath the reaction'
                  : 'Generate 3D SDF tiles for this reaction'}
              >
                {reactionSdfLoadingId === selectedShape.id ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Database size={16} />
                )}
                {selectedShape.reactionData?.sdfShapeIds?.length ? 'Rebuild 3D Models' : 'Add 3D Models'}
              </button>

              {reactionSdfError?.id === selectedShape.id && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                  {reactionSdfError.message}
                </div>
              )}

              {selectedShape.reactionData.metadata?.components && selectedShape.reactionData.metadata.components.length > 0 && (
                <div className="space-y-1 rounded-lg border border-slate-700/60 bg-slate-900/80 p-3">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide">Components</p>
                  <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {selectedShape.reactionData.metadata.components.map((component, index) => {
                      const name = component.label || component.original || component.smiles || `Component ${index + 1}`;
                      return (
                        <li key={`${component.role}-${index}`} className="text-[11px] text-slate-300">
                          <span className="uppercase text-slate-500">{component.role}</span>{' '}
                          {name}
                          {component.smiles && <span className="text-emerald-300"> · {component.smiles}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Correction Markers - Simplified (only for non-text corrections) */}
      {showCorrections && corrections
        .filter(correction => !correction.textShapeId)
        .map((correction) => (
          <div
            key={correction.id}
            className="absolute z-20 pointer-events-none"
            style={{
              left: correction.x * zoom,
              top: correction.y * zoom,
            }}
          >
            {/* Simple Marker */}
            <div className={`w-3 h-3 rounded-full border-2 ${correction.type === 'error' ? 'bg-red-500 border-red-600' :
                correction.type === 'warning' ? 'bg-yellow-500 border-yellow-600' :
                  'bg-blue-500 border-blue-600'
              } shadow-lg animate-pulse`} />
          </div>
        ))}

      {/* Text Correction Suggestions */}
      {showCorrections && textCorrectionOverlays.map((overlay) => (
        <div
          key={`text-correction-overlay-${overlay.id}`}
          className="absolute z-30 max-w-sm pointer-events-auto"
          style={{
            left: overlay.left,
            top: overlay.top
          }}
        >
          <TextCorrectionDiff
            originalText={overlay.originalText}
            corrections={overlay.corrections}
            isDrawn={overlay.isDrawn}
          />
        </div>
      ))}

      {/* Analysis Results Panel - Side-by-Side Layout */}
      {showCorrections && analysisResult && (
        <div className="absolute bottom-4 right-4 z-10 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl analysis-panel" style={{ width: '1000px', height: '700px' }}>
          {/* Header with Score */}
          <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-white flex items-center gap-3">
                <AlertCircle size={20} className="text-orange-400" />
                Canvas Analysis Results
              </h4>
              <div className="flex items-center gap-4">
                <div className={`px-4 py-2 rounded-lg text-sm font-bold ${analysisResult.overallScore >= 80 ? 'bg-green-600 text-green-100' :
                    analysisResult.overallScore >= 60 ? 'bg-yellow-600 text-yellow-100' :
                      'bg-red-600 text-red-100'
                  }`}>
                  {analysisResult.overallScore}%
                </div>
                <button
                  onClick={clearCorrections}
                  className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm rounded-lg transition-colors"
                  title="Close Analysis"
                >
                  ✕ Close
                </button>
                <div className="text-xs text-slate-400 mt-2">
                  Analysis Status: {isAnalyzing ? 'Analyzing...' : 'Complete'} |
                  Corrections: {corrections.length} |
                  Score: {analysisResult?.overallScore || 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Content */}
          <div className="flex analysis-content">
            {/* Left Panel - Errors & Corrections */}
            <div className="flex-1 p-8 border-r border-slate-700/50 analysis-sidebar">
              {/* Overall Feedback */}
              {analysisResult.feedback && (
                <div className="mb-8 p-5 bg-gradient-to-r from-slate-700/50 to-slate-600/30 rounded-lg border border-slate-600/30">
                  <h5 className="text-base font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Brain size={18} className="text-blue-400" />
                    Overall Feedback
                  </h5>
                  <p className="text-base text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {analysisResult.feedback}
                  </p>
                </div>
              )}

              {/* Corrections */}
              <div>
                <h5 className="text-base font-semibold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-400" />
                  Errors & Corrections ({corrections.length})
                </h5>

                {/* Text Corrections with Diff View */}
                {(() => {
                  // Group corrections by text shape
                  const textCorrections = corrections.filter(c => c.textShapeId);
                  const nonTextCorrections = corrections.filter(c => !c.textShapeId);

                  // Get unique text shapes that have corrections
                  const correctedTextShapes = Array.from(new Set(textCorrections.map(c => c.textShapeId)))
                    .map(shapeId => {
                      const shape = canvasHistoryRef.current.find(s => s.id === shapeId);
                      const shapeCorrections = textCorrections.filter(c => c.textShapeId === shapeId);
                      return { shape, corrections: shapeCorrections };
                    })
                    .filter(item => item.shape);

                  return (
                    <>
                      {/* Text Diff Views */}
                      {correctedTextShapes.map(({ shape, corrections: shapeCorrections }) => (
                        <div key={shape!.id} className="mb-6">
                          <div className="mb-3">
                            <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                              Text Corrections
                            </span>
                          </div>
                          <TextCorrectionDiff
                            originalText={shape!.text || ''}
                            corrections={shapeCorrections}
                          />
                        </div>
                      ))}

                      {/* Individual Correction Details */}
                      {(textCorrections.length > 0 || nonTextCorrections.length > 0) ? (
                        <div className="space-y-3">
                          {[...textCorrections, ...nonTextCorrections].map((correction) => (
                            <div key={correction.id} className="correction-item p-4 bg-slate-700/30 rounded-lg border border-slate-600/30 hover:bg-slate-700/40 transition-colors">
                              <div className="flex items-center gap-3 mb-3">
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${correction.type === 'error' ? 'bg-red-500' :
                                    correction.type === 'warning' ? 'bg-yellow-500' :
                                      'bg-blue-500'
                                  }`}>
                                  <span className="text-white text-xs font-bold">
                                    {correction.type === 'error' ? '!' : correction.type === 'warning' ? '⚠' : 'i'}
                                  </span>
                                </div>
                                <span className={`text-sm font-medium px-3 py-1 rounded ${correction.type === 'error' ? 'bg-red-600 text-red-100' :
                                    correction.type === 'warning' ? 'bg-yellow-600 text-yellow-100' :
                                      'bg-blue-600 text-blue-100'
                                  }`}>
                                  {correction.type.toUpperCase()}
                                </span>
                                <span className={`text-sm px-3 py-1 rounded ${correction.severity === 'high' ? 'bg-red-500/20 text-red-300' :
                                    correction.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                      'bg-blue-500/20 text-blue-300'
                                  }`}>
                                  {correction.severity.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-sm text-slate-300 leading-relaxed">
                                {correction.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-5 bg-green-900/20 rounded-lg border border-green-600/30">
                          <div className="flex items-center gap-3 mb-2">
                            <CheckCircle size={18} className="text-green-400" />
                            <span className="text-base font-medium text-green-300">No Errors Found!</span>
                          </div>
                          <p className="text-base text-green-200">
                            Great job! Your chemical formulas and equations appear to be correct.
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Right Panel - Suggestions & Tips */}
            <div className="flex-1 p-8 analysis-sidebar">
              {/* Suggestions */}
              {analysisResult.suggestions && analysisResult.suggestions.length > 0 && (
                <div>
                  <h5 className="text-base font-semibold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                    <Sparkles size={18} className="text-purple-400" />
                    Study Tips & Suggestions
                  </h5>
                  <div className="space-y-5">
                    {analysisResult.suggestions.map((suggestion, index) => (
                      <div key={index} className="suggestion-item p-5 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-600/30 hover:bg-purple-900/30 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-4 h-4 rounded-full bg-purple-400 mt-1 flex-shrink-0" />
                          <p className="text-base text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {suggestion}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Study Guide */}
              <div className="mt-8 p-5 bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-lg border border-green-600/30">
                <h6 className="text-base font-semibold text-green-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-400" />
                  Quick Study Guide
                </h6>
                <div className="space-y-4 text-base text-slate-300">
                  <div className="flex items-center gap-4">
                    <span className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0"></span>
                    <span>Review chemical notation and subscript placement</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0"></span>
                    <span>Practice balancing equations step by step</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0"></span>
                    <span>Double-check molecular formulas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chemistry Structure Viewer */}
      {showChemistryViewer && chemistryStructure && (
        <ChemistryStructureViewer
          structure={chemistryStructure}
          onClose={() => setShowChemistryViewer(false)}
          onRegenerate={convertToChemistry}
        />
      )}



      {showMineralSearch && (
        <MineralSearch
          onClose={() => setShowMineralSearch(false)}
          onSelectMineral={(moleculeData) => {
            void (async () => {
              try {
                await insertMoleculeToCanvas(moleculeData);
              } catch (error) {
                console.error('Failed to insert mineral structure:', error);
              } finally {
                setShowMineralSearch(false);
              }
            })();
          }}
        />
      )}

      {/* Protein Search Modal */}
      {showProteinSearch && (
        <ProteinSearch
          onClose={() => setShowProteinSearch(false)}
          onSelectProtein={(proteinData) => {
            void (async () => {
              try {
                await insertProteinToCanvas(proteinData);
              } catch (error) {
                console.error('Failed to insert PDB protein:', error);
              } finally {
                setShowProteinSearch(false);
              }
            })();
          }}
        />
      )}

      {/* Text Input Overlay */}
      {isTextInputVisible && (
        <div
          className="fixed z-50"
          style={{
            left: textInputPosition.x,
            top: textInputPosition.y,
          }}
        >
          <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 shadow-2xl min-w-64">
            <input
              type="text"
              value={currentTextInput}
              onChange={(e) => setCurrentTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTextSubmit();
                } else if (e.key === 'Escape') {
                  setIsTextInputVisible(false);
                  setCurrentTextInput('');
                  setEditingTextShapeId(null);
                }
              }}
              placeholder="Enter your text..."
              className="w-full bg-slate-900/80 border border-slate-600 rounded px-3 py-2 text-slate-200 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleTextSubmit}
                disabled={!currentTextInput.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Add Text
              </button>
              <button
                onClick={() => {
                  setIsTextInputVisible(false);
                  setCurrentTextInput('');
                  setEditingTextShapeId(null);
                }}
                className="bg-slate-600 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chemistry Widget Panel Modal */}
      {showChemistryWidgetPanel && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/80 shadow-lg">
            <h2 className="text-lg font-semibold text-white">Chemistry Toolkit</h2>
            <button
              onClick={() => setShowChemistryWidgetPanel(false)}
              className="flex items-center gap-2 rounded-full border border-white/40 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChemistryWidgetPanel onClose={() => setShowChemistryWidgetPanel(false)} />
          </div>
        </div>
      )}

    </div>
  );
}
