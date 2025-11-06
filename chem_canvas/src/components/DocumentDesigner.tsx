import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  Position,
  Handle,
  NodeTypes,
  ReactFlowInstance
} from 'reactflow';
import 'reactflow/dist/style.css';

import {
  Sparkles,
  Type,
  Image,
  List,
  Table,
  Quote,
  Code,
  Calculator,
  FileText,
  Save,
  Plus,
  Trash2,
  Edit3,
  Upload,
  Download,
  Copy,
  MessageSquare,
  BookOpen,
  Settings,
  Search,
  Play,
  ChevronLeft,
  ChevronRight,
  X,
  HelpCircle,
  RefreshCw,
  Clock,
  Star,
  BookMarked,
  ExternalLink,
  ArrowUpRight,
  FileDown,
  Columns,
  LayoutTemplate,
  PenTool,
  Bot,
  PanelLeftClose,
  PanelRightOpen,
  History,
  Eye,
  AlignJustify,
  ClipboardCheck,
  ChevronUp,
  ChevronDown,
  PanelLeft,
  PanelRight,
  PanelRightClose,
  Layers,
  SlidersHorizontal,
  LayoutGrid,
  Monitor,
  LayoutPanelLeft,
  Rows4,
  BarChart3,
  Brain,
  Share2,
  Import,
  Scan,
  FlaskConical,
  ArrowRight,
  TestTube,
  Atom,
  Wand2,
  Beaker,
  Undo,
  Redo
} from 'lucide-react';

import { getMoleculeByName, get2DStructureUrl, type MoleculeData } from '../services/pubchemService';
import * as geminiService from '../services/geminiService';

// Custom Node Components
const TextNode = ({ data, isConnectable, id }: any) => {
  const { setNodes, getNodes } = useReactFlow();
  const [content, setContent] = useState(data.content || 'Enter text here...');
  const [isGenerating, setIsGenerating] = useState(false);

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const generateWithAI = async () => {
    if (!geminiService.isGeminiInitialized()) {
      const configure = window.confirm(
        '🔑 Gemini API Key Required\n\n' +
        'To use AI features, you need to configure your Google Gemini API key.\n\n' +
        'Click OK to learn how to get your free API key, or Cancel to continue without AI.'
      );
      if (configure) {
        window.open('https://makersuite.google.com/app/apikey', '_blank');
      }
      return;
    }
    
    setIsGenerating(true);
    try {
      const prompt = content || 'Generate a professional paragraph for a chemistry study document';
      const generatedText = await geminiService.generateTextContent(prompt);
      setContent(generatedText);
      updateNodeData({ content: generatedText });
    } catch (error: any) {
      console.error('AI generation error:', error);
      alert(
        '❌ AI Generation Failed\n\n' +
        'Error: ' + (error?.message || 'Unknown error') + '\n\n' +
        'Please check:\n' +
        '• Your API key is correct\n' +
        '• You have internet connection\n' +
        '• You haven\'t exceeded API quota'
      );
    }
    setIsGenerating(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[200px] min-h-[100px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-primary/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-primary">Text Block</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              generateWithAI();
            }}
            disabled={isGenerating}
            className="p-1 hover:bg-purple-500/20 rounded text-purple-600 disabled:opacity-50"
            title="Generate with AI"
          >
            {isGenerating ? (
              <Sparkles className="h-3 w-3 animate-pulse" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
      <div className="p-3">
        <textarea
          value={content}
          onChange={(e) => {
            const newContent = e.target.value;
            setContent(newContent);
            updateNodeData({ content: newContent });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full h-20 resize-none border-none outline-none bg-transparent text-sm placeholder-gray-400 focus:ring-2 focus:ring-primary/50 rounded px-1"
          placeholder="Click and type your text here..."
        />
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const ImageNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [imageUrl, setImageUrl] = useState(data.imageUrl || '');

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[250px] min-h-[150px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-green-500/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-green-600" />
          <span className="text-xs font-medium text-green-600">Image Block</span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => {
            const newValue = e.target.value;
            setImageUrl(newValue);
            updateNodeData({ imageUrl: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full p-2 border border-border rounded text-sm placeholder-gray-400 focus:ring-2 focus:ring-green-500/50"
          placeholder="Paste image URL here..."
        />
        <div className="w-full h-24 bg-muted rounded flex items-center justify-center">
          {imageUrl ? (
            <img src={imageUrl} alt="Content" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-muted-foreground text-xs">Image preview</span>
          )}
        </div>
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const ListNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [items, setItems] = useState(data.items || ['Item 1', 'Item 2', 'Item 3']);

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const addItem = () => {
    const newItems = [...items, `Item ${items.length + 1}`];
    setItems(newItems);
    updateNodeData({ items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_item: string, currentIndex: number) => currentIndex !== index);
    setItems(newItems);
    updateNodeData({ items: newItems });
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[200px] min-h-[100px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-blue-500/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-medium text-blue-600">List Block</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            addItem();
          }}
          className="p-1 hover:bg-blue-500/20 rounded text-blue-600"
          title="Add item"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div className="p-3 space-y-2">
        {items.map((item: string, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-blue-600 font-medium">•</span>
            <input
              type="text"
              value={item}
              onChange={(e) => {
                const newItems = [...items];
                newItems[index] = e.target.value;
                setItems(newItems);
                updateNodeData({ items: newItems });
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex-1 p-1 border border-border rounded text-xs placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50"
              placeholder="Enter list item..."
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeItem(index);
              }}
              className="p-1 hover:bg-destructive/20 rounded text-destructive"
              title="Delete item"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const TableNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [tableData, setTableData] = useState(data.tableData || [
    ['Header 1', 'Header 2', 'Header 3'],
    ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
    ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3']
  ]);

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[300px] min-h-[150px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-purple-500/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table className="h-4 w-4 text-purple-600" />
          <span className="text-xs font-medium text-purple-600">Table Block</span>
        </div>
      </div>
      <div className="p-3">
        <div className="space-y-2">
          {tableData.map((row: string[], rowIndex: number) => (
            <div key={rowIndex} className="flex gap-1">
              {row.map((cell: string, colIndex: number) => (
                <input
                  key={colIndex}
                  type="text"
                  value={cell}
                  onChange={(e) => {
                    const newData = [...tableData];
                    newData[rowIndex][colIndex] = e.target.value;
                    setTableData(newData);
                    updateNodeData({ tableData: newData });
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex-1 p-1 border border-border rounded text-xs placeholder-gray-400 focus:ring-2 focus:ring-purple-500/50"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const QuoteNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [quote, setQuote] = useState(data.quote || 'Enter quote here...');
  const [author, setAuthor] = useState(data.author || 'Author');

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[250px] min-h-[120px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-orange-500/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Quote className="h-4 w-4 text-orange-600" />
          <span className="text-xs font-medium text-orange-600">Quote Block</span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <textarea
          value={quote}
          onChange={(e) => {
            const newValue = e.target.value;
            setQuote(newValue);
            updateNodeData({ quote: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full p-2 border border-border rounded text-sm placeholder-gray-400 focus:ring-2 focus:ring-orange-500/50 resize-none"
          rows={2}
          placeholder="Enter quote..."
        />
        <input
          type="text"
          value={author}
          onChange={(e) => {
            const newValue = e.target.value;
            setAuthor(newValue);
            updateNodeData({ author: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full p-2 border border-border rounded text-sm placeholder-gray-400 focus:ring-2 focus:ring-orange-500/50"
          placeholder="Enter author..."
        />
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const CodeNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [code, setCode] = useState(data.code || '// Enter code here...');
  const [language, setLanguage] = useState(data.language || 'javascript');

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[300px] min-h-[150px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-gray-800 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-green-400" />
          <span className="text-xs font-medium text-green-400">Code Block</span>
          <span className="text-xs text-gray-400">({language})</span>
        </div>
      </div>
      <div className="p-3 bg-gray-900 space-y-2">
        <select
          value={language}
          onChange={(e) => {
            const newValue = e.target.value;
            setLanguage(newValue);
            updateNodeData({ language: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="p-1 border border-border rounded text-xs bg-gray-800 text-gray-100 focus:ring-2 focus:ring-green-500/50"
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
        </select>
        <textarea
          value={code}
          onChange={(e) => {
            const newValue = e.target.value;
            setCode(newValue);
            updateNodeData({ code: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full h-20 resize-none border border-border rounded text-xs font-mono bg-gray-800 text-green-400 placeholder-gray-500 focus:ring-2 focus:ring-green-500/50"
          placeholder="Enter code..."
        />
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const FormulaNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [formula, setFormula] = useState(data.formula || 'E = mc²');

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[200px] min-h-[100px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-yellow-500/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-yellow-600" />
          <span className="text-xs font-medium text-yellow-600">Formula Block</span>
        </div>
      </div>
      <div className="p-3">
        <input
          type="text"
          value={formula}
          onChange={(e) => {
            const newValue = e.target.value;
            setFormula(newValue);
            updateNodeData({ formula: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full p-2 border border-border rounded text-sm font-mono placeholder-gray-400 focus:ring-2 focus:ring-yellow-500/50"
          placeholder="Enter formula (e.g., E = mc²)..."
        />
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const MoleculeNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [moleculeName, setMoleculeName] = useState(data.moleculeName || '');
  const [smiles, setSmiles] = useState(data.smiles || '');
  const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(data.moleculeData || null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const loadMolecule = async () => {
    if (!moleculeName.trim() && !smiles.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      let data: MoleculeData | null = null;

      if (smiles.trim()) {
        // For SMILES, we'll create a basic structure
        data = {
          cid: 0,
          name: moleculeName || 'Custom Molecule',
          displayName: moleculeName || 'Custom Molecule',
          molecularFormula: '',
          molecularWeight: 0,
          svgUrl: '',
          smiles: smiles.trim(),
          sourceQuery: 'custom:smiles'
        };
      } else if (moleculeName.trim()) {
        data = await getMoleculeByName(moleculeName.trim());
      }

      if (data) {
        setMoleculeData(data);
        updateNodeData({ moleculeData: data });
      } else {
        setError('Molecule not found');
      }
    } catch (err) {
      console.error('Error loading molecule:', err);
      setError('Failed to load molecule');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (data.moleculeData) {
      setMoleculeData(data.moleculeData);
    } else if (data.moleculeName || data.smiles) {
      loadMolecule();
    }
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[280px] min-h-[200px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-cyan-500/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Atom className="h-4 w-4 text-cyan-600" />
          <span className="text-xs font-medium text-cyan-600">Molecule Block</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              loadMolecule();
            }}
            disabled={isLoading}
            className="p-1 hover:bg-cyan-500/20 rounded text-cyan-600 disabled:opacity-50"
            title="Load molecule"
          >
            {isLoading ? (
              <Sparkles className="h-3 w-3 animate-pulse" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(!isEditing);
            }}
            className="p-1 hover:bg-cyan-500/20 rounded text-cyan-600"
          >
            <Settings className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="space-y-2">
          <input
            type="text"
            value={moleculeName}
            onChange={(e) => {
              const newValue = e.target.value;
              setMoleculeName(newValue);
              updateNodeData({ moleculeName: newValue });
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full p-2 border border-border rounded text-sm placeholder-gray-400 focus:ring-2 focus:ring-cyan-500/50"
            placeholder="Molecule name (e.g., aspirin)"
          />
          <input
            type="text"
            value={smiles}
            onChange={(e) => {
              const newValue = e.target.value;
              setSmiles(newValue);
              updateNodeData({ smiles: newValue });
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full p-2 border border-border rounded text-sm font-mono placeholder-gray-400 focus:ring-2 focus:ring-cyan-500/50"
            placeholder="SMILES string (optional)"
          />
        </div>
        {moleculeData ? (
          <>
            <div className="text-sm font-medium text-center">{moleculeData.displayName}</div>
            {moleculeData.molecularFormula && (
              <div className="text-xs text-muted-foreground text-center">{moleculeData.molecularFormula}</div>
            )}
            <div className="w-full h-24 bg-muted rounded flex items-center justify-center">
              {moleculeData.svgUrl ? (
                <img 
                  src={moleculeData.svgUrl} 
                  alt={moleculeData.displayName} 
                  className="max-w-full max-h-full object-contain" 
                />
              ) : moleculeData.smiles ? (
                <div className="text-xs font-mono text-center p-2">{moleculeData.smiles}</div>
              ) : (
                <span className="text-muted-foreground text-xs">No structure</span>
              )}
            </div>
          </>
        ) : error ? (
          <div className="text-xs text-destructive text-center p-4">{error}</div>
        ) : (
          <div className="text-xs text-muted-foreground text-center p-4">
            Enter molecule name or SMILES and click load
          </div>
        )}
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const ChemicalEquationNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [equation, setEquation] = useState(data.equation || '2H₂ + O₂ → 2H₂O');
  const [description, setDescription] = useState(data.description || '');

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[300px] min-h-[120px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-indigo-500/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-medium text-indigo-600">Chemical Equation</span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <input
          type="text"
          value={equation}
          onChange={(e) => {
            const newValue = e.target.value;
            setEquation(newValue);
            updateNodeData({ equation: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full p-2 border border-border rounded text-sm font-mono placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/50"
          placeholder="Chemical equation (e.g., 2H₂ + O₂ → 2H₂O)..."
        />
        <input
          type="text"
          value={description}
          onChange={(e) => {
            const newValue = e.target.value;
            setDescription(newValue);
            updateNodeData({ description: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full p-2 border border-border rounded text-sm placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/50"
          placeholder="Description (optional)"
        />
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const LabProcedureNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [title, setTitle] = useState(data.title || 'Lab Procedure');
  const [steps, setSteps] = useState(data.steps || ['Step 1', 'Step 2', 'Step 3']);
  const [materials, setMaterials] = useState(data.materials || []);
  const [isEditing, setIsEditing] = useState(false);

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const addStep = () => {
    const newSteps = [...steps, `Step ${steps.length + 1}`];
    setSteps(newSteps);
    updateNodeData({ steps: newSteps });
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_: string, currentIndex: number) => currentIndex !== index);
    setSteps(newSteps);
    updateNodeData({ steps: newSteps });
  };

  const addMaterial = () => {
    const newMaterials = [...materials, 'New material'];
    setMaterials(newMaterials);
    updateNodeData({ materials: newMaterials });
  };

  const removeMaterial = (index: number) => {
    const newMaterials = materials.filter((_: string, currentIndex: number) => currentIndex !== index);
    setMaterials(newMaterials);
    updateNodeData({ materials: newMaterials });
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[320px] min-h-[200px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-emerald-500/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-600">Lab Procedure</span>
        </div>
      </div>
      <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            const newValue = e.target.value;
            setTitle(newValue);
            updateNodeData({ title: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full p-2 border border-border rounded text-sm font-medium placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50"
          placeholder="Procedure title..."
        />
        
        <div>
          <div className="text-xs font-medium mb-1">Materials:</div>
          {materials.map((material: string, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <input
                type="text"
                value={material}
                onChange={(e) => {
                  const newMaterials = [...materials];
                  newMaterials[index] = e.target.value;
                  setMaterials(newMaterials);
                  updateNodeData({ materials: newMaterials });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex-1 p-1 border border-border rounded text-xs placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Material..."
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeMaterial(index);
                }}
                className="p-1 hover:bg-destructive/20 rounded text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              addMaterial();
            }}
            className="w-full p-1 border border-dashed border-border rounded text-xs hover:bg-muted"
          >
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>

        <div>
          <div className="text-xs font-medium mb-1">Steps:</div>
          {steps.map((step: string, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
              <input
                type="text"
                value={step}
                onChange={(e) => {
                  const newSteps = [...steps];
                  newSteps[index] = e.target.value;
                  setSteps(newSteps);
                  updateNodeData({ steps: newSteps });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex-1 p-1 border border-border rounded text-xs placeholder-gray-400 focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Step..."
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeStep(index);
                }}
                className="p-1 hover:bg-destructive/20 rounded text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              addStep();
            }}
            className="w-full p-1 border border-dashed border-border rounded text-xs hover:bg-muted"
          >
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

const ReactionSchemeNode = ({ data, isConnectable, id }: any) => {
  const { setNodes } = useReactFlow();
  const [title, setTitle] = useState(data.title || 'Reaction Scheme');
  const [reactants, setReactants] = useState(data.reactants || ['Reactant A', 'Reactant B']);
  const [products, setProducts] = useState(data.products || ['Product C']);
  const [conditions, setConditions] = useState(data.conditions || 'Conditions');
  const [isEditing, setIsEditing] = useState(false);

  const updateNodeData = (newData: any) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const addReactant = () => {
    const newReactants = [...reactants, `Reactant ${reactants.length + 1}`];
    setReactants(newReactants);
    updateNodeData({ reactants: newReactants });
  };

  const removeReactant = (index: number) => {
    const newReactants = reactants.filter((_: string, currentIndex: number) => currentIndex !== index);
    setReactants(newReactants);
    updateNodeData({ reactants: newReactants });
  };

  const addProduct = () => {
    const newProducts = [...products, `Product ${products.length + 1}`];
    setProducts(newProducts);
    updateNodeData({ products: newProducts });
  };

  const removeProduct = (index: number) => {
    const newProducts = products.filter((_: string, currentIndex: number) => currentIndex !== index);
    setProducts(newProducts);
    updateNodeData({ products: newProducts });
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg min-w-[350px] min-h-[150px] relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-primary border-2 border-background"
        isConnectable={isConnectable}
      />
      
      <div className="bg-rose-500/10 px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TestTube className="h-4 w-4 text-rose-600" />
          <span className="text-xs font-medium text-rose-600">Reaction Scheme</span>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            const newValue = e.target.value;
            setTitle(newValue);
            updateNodeData({ title: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full p-2 border border-border rounded text-sm font-medium placeholder-gray-400 focus:ring-2 focus:ring-rose-500/50"
          placeholder="Scheme title..."
        />
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium mb-1">Reactants:</div>
            {reactants.map((reactant: string, index: number) => (
              <div key={index} className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={reactant}
                  onChange={(e) => {
                    const newReactants = [...reactants];
                    newReactants[index] = e.target.value;
                    setReactants(newReactants);
                    updateNodeData({ reactants: newReactants });
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex-1 p-1 border border-border rounded text-xs placeholder-gray-400 focus:ring-2 focus:ring-rose-500/50"
                  placeholder="Reactant..."
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeReactant(index);
                  }}
                  className="p-1 hover:bg-destructive/20 rounded text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                addReactant();
              }}
              className="w-full p-1 border border-dashed border-border rounded text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3 mx-auto" />
            </button>
          </div>

          <div>
            <div className="text-xs font-medium mb-1">Products:</div>
            {products.map((product: string, index: number) => (
              <div key={index} className="flex items-center gap-2 mb-1">
                <input
                  type="text"
                  value={product}
                  onChange={(e) => {
                    const newProducts = [...products];
                    newProducts[index] = e.target.value;
                    setProducts(newProducts);
                    updateNodeData({ products: newProducts });
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex-1 p-1 border border-border rounded text-xs placeholder-gray-400 focus:ring-2 focus:ring-rose-500/50"
                  placeholder="Product..."
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeProduct(index);
                  }}
                  className="p-1 hover:bg-destructive/20 rounded text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                addProduct();
              }}
              className="w-full p-1 border border-dashed border-border rounded text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3 mx-auto" />
            </button>
          </div>
        </div>

        <input
          type="text"
          value={conditions}
          onChange={(e) => {
            const newValue = e.target.value;
            setConditions(newValue);
            updateNodeData({ conditions: newValue });
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full p-2 border border-border rounded text-sm placeholder-gray-400 focus:ring-2 focus:ring-rose-500/50"
          placeholder="Reaction conditions..."
        />
      </div>
      
      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="w-3 h-3 bg-green-500 border-2 border-background"
        isConnectable={isConnectable}
      />
    </div>
  );
};

// Output Node Component
const OutputNode = ({ data, isConnectable }: any) => {
  return (
    <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg shadow-lg min-w-[300px] min-h-[200px] p-4 relative">
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="w-3 h-3 bg-white border-2 border-green-500"
        isConnectable={isConnectable}
      />
      
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">Document Output</span>
      </div>
      <div className="bg-white/10 rounded p-3 h-full overflow-auto">
        <div className="text-xs text-green-100 whitespace-pre-wrap">
          {data.content || 'Connect blocks to see your document output here...'}
        </div>
      </div>
    </div>
  );
};

// Node Types will be defined inside the component

// Building Blocks Sidebar
const BuildingBlocksPanel = ({ onAddNode }: any) => {
  const buildingBlocks = [
    { type: 'textNode', label: 'Text', icon: Type, description: 'Add text content' },
    { type: 'imageNode', label: 'Image', icon: Image, description: 'Add images' },
    { type: 'listNode', label: 'List', icon: List, description: 'Create lists' },
    { type: 'tableNode', label: 'Table', icon: Table, description: 'Add tables' },
    { type: 'quoteNode', label: 'Quote', icon: Quote, description: 'Add quotes' },
    { type: 'codeNode', label: 'Code', icon: Code, description: 'Code blocks' },
    { type: 'formulaNode', label: 'Formula', icon: Calculator, description: 'Math formulas' },
    { type: 'moleculeNode', label: 'Molecule', icon: Atom, description: 'Chemical structures' },
    { type: 'chemicalEquationNode', label: 'Equation', icon: ArrowRight, description: 'Chemical equations' },
    { type: 'labProcedureNode', label: 'Lab Procedure', icon: FlaskConical, description: 'Lab protocols' },
    { type: 'reactionSchemeNode', label: 'Reaction', icon: TestTube, description: 'Reaction schemes' },
    { type: 'outputNode', label: 'Output', icon: Eye, description: 'Document output' },
  ];

  return (
    <div className="w-64 bg-muted/50 border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm">Building Blocks</h3>
        <p className="text-xs text-muted-foreground">Drag to canvas</p>
      </div>
      
      <div className="p-2 space-y-2 overflow-y-auto flex-1">
        {buildingBlocks.map((block) => {
          const Icon = block.icon;
          return (
            <div
              key={block.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', block.type);
                e.dataTransfer.effectAllowed = 'move';
              }}
              className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{block.label}</div>
                <div className="text-xs text-muted-foreground">{block.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Templates Panel
const TemplatesPanel = ({ onLoadTemplate }: { onLoadTemplate: (nodes: Node[], edges: Edge[]) => void }) => {
  const templates = [
    {
      id: 'lab-report',
      name: 'Lab Report',
      description: 'Complete lab report template',
      icon: FlaskConical,
      nodes: [
        {
          id: 'title-1',
          type: 'textNode',
          position: { x: 100, y: 50 },
          data: { content: '# Lab Report Title\n\n**Course:** Chemistry 101\n**Date:** [Date]\n**Lab Partner:** [Name]' },
        },
        {
          id: 'objective-1',
          type: 'textNode',
          position: { x: 100, y: 200 },
          data: { content: '## Objective\n\n[Describe the purpose of this experiment]' },
        },
        {
          id: 'materials-1',
          type: 'labProcedureNode',
          position: { x: 100, y: 350 },
          data: { 
            title: 'Materials & Equipment',
            materials: ['[List materials]', '[List equipment]'],
            steps: []
          },
        },
        {
          id: 'procedure-1',
          type: 'labProcedureNode',
          position: { x: 100, y: 550 },
          data: { 
            title: 'Procedure',
            materials: [],
            steps: ['[Step 1]', '[Step 2]', '[Step 3]']
          },
        },
        {
          id: 'data-1',
          type: 'tableNode',
          position: { x: 100, y: 750 },
          data: { 
            tableData: [
              ['Observation', 'Measurement'],
              ['[Data point 1]', '[Value 1]'],
              ['[Data point 2]', '[Value 2]']
            ]
          },
        },
        {
          id: 'results-1',
          type: 'textNode',
          position: { x: 100, y: 950 },
          data: { content: '## Results & Discussion\n\n[Analyze your data and discuss findings]' },
        },
        {
          id: 'conclusion-1',
          type: 'textNode',
          position: { x: 100, y: 1100 },
          data: { content: '## Conclusion\n\n[Summarize what was learned and any sources of error]' },
        },
        {
          id: 'output-1',
          type: 'outputNode',
          position: { x: 600, y: 600 },
          data: { content: 'Connect blocks to see your compiled lab report...' },
        },
      ],
      edges: []
    },
    {
      id: 'reaction-analysis',
      name: 'Reaction Analysis',
      description: 'Analyze chemical reactions',
      icon: TestTube,
      nodes: [
        {
          id: 'reaction-1',
          type: 'reactionSchemeNode',
          position: { x: 100, y: 50 },
          data: { 
            title: 'Chemical Reaction',
            reactants: ['Reactant A', 'Reactant B'],
            products: ['Product C'],
            conditions: 'Temperature, Solvent, Catalyst'
          },
        },
        {
          id: 'mechanism-1',
          type: 'textNode',
          position: { x: 100, y: 250 },
          data: { content: '## Reaction Mechanism\n\n[Describe the step-by-step mechanism]' },
        },
        {
          id: 'molecule-1',
          type: 'moleculeNode',
          position: { x: 100, y: 400 },
          data: { moleculeName: 'Search for a molecule...' },
        },
        {
          id: 'equation-1',
          type: 'chemicalEquationNode',
          position: { x: 100, y: 600 },
          data: { 
            equation: 'A + B → C',
            description: 'Balanced chemical equation'
          },
        },
        {
          id: 'analysis-1',
          type: 'textNode',
          position: { x: 100, y: 750 },
          data: { content: '## Analysis\n\n[Discuss reaction kinetics, thermodynamics, stereochemistry]' },
        },
        {
          id: 'output-1',
          type: 'outputNode',
          position: { x: 600, y: 400 },
          data: { content: 'Connect blocks to see your reaction analysis...' },
        },
      ],
      edges: []
    },
    {
      id: 'study-guide',
      name: 'Study Guide',
      description: 'Organize study materials',
      icon: BookOpen,
      nodes: [
        {
          id: 'topic-1',
          type: 'textNode',
          position: { x: 100, y: 50 },
          data: { content: '# Study Guide: [Topic]\n\n**Key Concepts:**\n- Concept 1\n- Concept 2\n- Concept 3' },
        },
        {
          id: 'definitions-1',
          type: 'listNode',
          position: { x: 100, y: 200 },
          data: { items: ['Term 1: Definition', 'Term 2: Definition', 'Term 3: Definition'] },
        },
        {
          id: 'formulas-1',
          type: 'formulaNode',
          position: { x: 100, y: 350 },
          data: { formula: 'E = mc²' },
        },
        {
          id: 'examples-1',
          type: 'textNode',
          position: { x: 100, y: 450 },
          data: { content: '## Examples\n\n[Include worked examples and practice problems]' },
        },
        {
          id: 'summary-1',
          type: 'quoteNode',
          position: { x: 100, y: 600 },
          data: { 
            quote: 'Key takeaway or important principle',
            author: 'Source or textbook'
          },
        },
        {
          id: 'output-1',
          type: 'outputNode',
          position: { x: 600, y: 300 },
          data: { content: 'Connect blocks to see your study guide...' },
        },
      ],
      edges: []
    },
    {
      id: 'molecule-profile',
      name: 'Molecule Profile',
      description: 'Document molecule properties',
      icon: Atom,
      nodes: [
        {
          id: 'molecule-1',
          type: 'moleculeNode',
          position: { x: 100, y: 50 },
          data: { moleculeName: 'Enter molecule name...' },
        },
        {
          id: 'properties-1',
          type: 'tableNode',
          position: { x: 100, y: 250 },
          data: { 
            tableData: [
              ['Property', 'Value'],
              ['Molecular Formula', ''],
              ['Molecular Weight', ''],
              ['Boiling Point', ''],
              ['Melting Point', ''],
              ['Solubility', '']
            ]
          },
        },
        {
          id: 'structure-1',
          type: 'textNode',
          position: { x: 100, y: 450 },
          data: { content: '## Structural Analysis\n\n[Describe molecular structure, functional groups, bonding]' },
        },
        {
          id: 'uses-1',
          type: 'listNode',
          position: { x: 100, y: 600 },
          data: { items: ['Industrial use 1', 'Biological use 1', 'Other applications'] },
        },
        {
          id: 'reactions-1',
          type: 'textNode',
          position: { x: 100, y: 750 },
          data: { content: '## Common Reactions\n\n[List important chemical reactions this molecule participates in]' },
        },
        {
          id: 'output-1',
          type: 'outputNode',
          position: { x: 600, y: 400 },
          data: { content: 'Connect blocks to see your molecule profile...' },
        },
      ],
      edges: []
    }
  ];

  return (
    <div className="w-64 bg-muted/50 border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-sm">Templates</h3>
        <p className="text-xs text-muted-foreground">Pre-built documents</p>
      </div>
      
      <div className="p-2 space-y-2 overflow-y-auto flex-1">
        {templates.map((template) => {
          const Icon = template.icon;
          return (
            <button
              key={template.id}
              onClick={() => onLoadTemplate(template.nodes, template.edges)}
              className="w-full flex items-center gap-3 p-3 bg-background border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{template.name}</div>
                <div className="text-xs text-muted-foreground">{template.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Main Document Designer Component
const DocumentDesignerContent = ({ onClose }: { onClose: () => void }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([
    {
      id: 'output-1',
      type: 'outputNode',
      position: { x: 800, y: 100 },
      data: { content: 'Connect blocks to see your document output here...' },
    },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState(geminiService.getApiKey() || '');
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(geminiService.isGeminiInitialized());
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activePanel, setActivePanel] = useState<'blocks' | 'templates'>('blocks');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  
  // Simple undo/redo state (placeholder - full implementation needed)
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  
  const undo = () => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      // Restore state from history
    }
  };
  
  const redo = () => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      // Restore state from history
    }
  };

  // Memoized node types to prevent React Flow warnings
  const nodeTypes = useMemo<NodeTypes>(() => ({
    textNode: TextNode,
    imageNode: ImageNode,
    listNode: ListNode,
    tableNode: TableNode,
    quoteNode: QuoteNode,
    codeNode: CodeNode,
    formulaNode: FormulaNode,
    moleculeNode: MoleculeNode,
    chemicalEquationNode: ChemicalEquationNode,
    labProcedureNode: LabProcedureNode,
    reactionSchemeNode: ReactionSchemeNode,
    outputNode: OutputNode,
  }), []);

  // Auto-save functionality
  useEffect(() => {
    const autoSave = () => {
      const documentData = {
        nodes,
        edges,
        timestamp: new Date().toISOString(),
        activePanel,
      };
      
      localStorage.setItem('chemistry-document-designer-autosave', JSON.stringify(documentData));
      setLastSaved(new Date());
    };

    const interval = setInterval(autoSave, 30000); // Auto-save every 30 seconds
    
    // Also save on changes
    const timeout = setTimeout(autoSave, 5000); // Save after 5 seconds of no changes

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [nodes, edges, activePanel]);

  // Load auto-saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem('chemistry-document-designer-autosave');
    if (saved) {
      try {
        const documentData = JSON.parse(saved);
        if (documentData.nodes && documentData.edges) {
          setNodes(documentData.nodes);
          setEdges(documentData.edges);
          if (documentData.activePanel) {
            setActivePanel(documentData.activePanel);
          }
          setLastSaved(new Date(documentData.timestamp));
        }
      } catch (error) {
        console.error('Error loading auto-saved data:', error);
      }
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          if (canUndo) undo();
        } else if ((event.key === 'y') || (event.key === 'z' && event.shiftKey)) {
          event.preventDefault();
          if (canRedo) redo();
        }
      }
      
      // Delete selected nodes
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter(node => node.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          setNodes(nodes => nodes.filter(node => !node.selected));
          setEdges(edges => edges.filter(edge => 
            !selectedNodes.some(node => node.id === edge.source || node.id === edge.target)
          ));
        }
      }
      
      // Quick add nodes with keyboard shortcuts
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const key = event.key.toLowerCase();
        let nodeType = '';
        
        switch (key) {
          case 't': nodeType = 'textNode'; break;
          case 'i': nodeType = 'imageNode'; break;
          case 'l': nodeType = 'listNode'; break;
          case 'b': nodeType = 'tableNode'; break;
          case 'q': nodeType = 'quoteNode'; break;
          case 'c': nodeType = 'codeNode'; break;
          case 'f': nodeType = 'formulaNode'; break;
          case 'm': nodeType = 'moleculeNode'; break;
          case 'e': nodeType = 'chemicalEquationNode'; break;
          case 'p': nodeType = 'labProcedureNode'; break;
          case 'r': nodeType = 'reactionSchemeNode'; break;
          case 'o': nodeType = 'outputNode'; break;
        }
        
        if (nodeType) {
          event.preventDefault();
          const center = reactFlowInstance?.getViewport() || { x: 0, y: 0, zoom: 1 };
          const position = reactFlowInstance?.screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          }) || { x: 400, y: 300 };
          
          const newNode: Node = {
            id: `${nodeType}-${Date.now()}`,
            type: nodeType,
            position,
            data: { label: `${nodeType} node` },
          };
          
          setNodes(nds => nds.concat(newNode));
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [nodes, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (position) {
        const newNode: Node = {
          id: `${type}-${Date.now()}`,
          type,
          position,
          data: { label: `${type} node` },
        };

        setNodes((nds) => nds.concat(newNode));
      }
    },
    [reactFlowInstance, setNodes]
  );

  const saveDocument = () => {
    const documentData = {
      nodes,
      edges,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(documentData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document-design.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadDocument = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const documentData = JSON.parse(e.target?.result as string);
        setNodes(documentData.nodes || []);
        setEdges(documentData.edges || []);
      } catch (error) {
        console.error('Error loading document:', error);
      }
    };
    reader.readAsText(file);
  };

  const loadTemplate = (templateNodes: Node[], templateEdges: Edge[]) => {
    // Clear existing nodes and edges except the output node
    const outputNode = nodes.find(node => node.type === 'outputNode');
    const newNodes = outputNode ? [outputNode] : [];
    
    // Add template nodes with offset positions to avoid overlap
    const offsetNodes = templateNodes.map(node => ({
      ...node,
      id: `${node.id}-${Date.now()}`, // Make IDs unique
      position: {
        x: node.position.x + Math.random() * 100, // Add some random offset
        y: node.position.y + Math.random() * 100
      }
    }));
    
    setNodes([...newNodes, ...offsetNodes]);
    setEdges(templateEdges);
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      geminiService.setApiKey(apiKey.trim());
      setIsApiKeyConfigured(true);
      setShowApiKeyModal(false);
      alert('API Key saved successfully!');
    } else {
      alert('Please enter a valid API key');
    }
  };

  const handleRemoveApiKey = () => {
    if (confirm('Are you sure you want to remove the API key?')) {
      geminiService.removeApiKey();
      setApiKey('');
      setIsApiKeyConfigured(false);
      setShowApiKeyModal(false);
    }
  };

  const exportToMarkdown = () => {
    // Find the output node
    const outputNode = nodes.find(node => node.type === 'outputNode');
    if (!outputNode || !outputNode.data.content) {
      alert('⚠️ No document output available to export.\n\nPlease run the document first by clicking the "Run" button.');
      return;
    }

    // Get current date for filename
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
    
    // Create markdown content with proper formatting
    const title = outputNode.data.content.split('\n')[0] || 'Chemistry Document';
    const content = `# ${title}

**Generated on:** ${now.toLocaleString()}
**Created with:** Chemistry Document Designer

---

${outputNode.data.content}

---

*This document was automatically generated using AI-powered content compilation from connected building blocks.*
*Includes chemistry-specific elements: molecules, equations, lab procedures, and reaction schemes.*
`;

    setMarkdownContent(content);
    setShowMarkdownPreview(true);
  };

  const exportToHTML = () => {
    const outputNode = nodes.find(node => node.type === 'outputNode');
    if (!outputNode || !outputNode.data.content) {
      alert('⚠️ No document output available to export.\n\nPlease run the document first by clicking the "Run" button.');
      return;
    }

    const now = new Date();
    const title = outputNode.data.content.split('\n')[0] || 'Chemistry Document';
    
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3 { color: #2c3e50; }
        h1 { border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; font-family: 'Monaco', 'Consolas', monospace; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        blockquote { border-left: 4px solid #3498db; padding-left: 15px; margin-left: 0; font-style: italic; }
        .metadata { color: #666; font-size: 0.9em; margin-bottom: 30px; }
        hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
    </style>
</head>
<body>
    <div class="metadata">
        <p><strong>Generated on:</strong> ${now.toLocaleString()}</p>
        <p><strong>Created with:</strong> Chemistry Document Designer</p>
    </div>
    
    ${outputNode.data.content
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^```(\w+)?\n([\s\S]*?)\n```/gm, (match, lang, code) => 
        `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
      )
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<li>.*<\/li>)<\/p>/g, '<ul>$1</ul>')
      .replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>')
      .replace(/<p><ul>/g, '<ul>')
      .replace(/<\/ul><\/p>/g, '</ul>')
    }
    
    <hr>
    <p style="color: #666; font-size: 0.8em;">
        This document was automatically generated using AI-powered content compilation from connected building blocks.
        Includes chemistry-specific elements: molecules, equations, lab procedures, and reaction schemes.
    </p>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chemistry-document-${now.toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('✅ Document exported successfully as HTML!');
  };

  const downloadMarkdown = () => {
    // Get current date for filename
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format

    // Create and download the file
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-document-${dateStr}-${timeStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Close preview and show success message
    setShowMarkdownPreview(false);
    alert('✅ Document exported successfully!\n\nFile saved as: ai-document-' + dateStr + '-' + timeStr + '.md');
  };

  const runDocument = async () => {
    if (!geminiService.isGeminiInitialized()) {
      setShowApiKeyModal(true);
      return;
    }

    // Find the output node
    const outputNode = nodes.find(node => node.type === 'outputNode');
    if (!outputNode) return;

    // Show loading state
    setNodes(nds =>
      nds.map(node =>
        node.id === outputNode.id
          ? { ...node, data: { ...node.data, content: '⏳ Processing with AI... Please wait...' } }
          : node
      )
    );

    // Find all nodes connected to the output node
    const connectedNodeIds = edges
      .filter(edge => edge.target === outputNode.id)
      .map(edge => edge.source);

    // Get all connected nodes
    const connectedBlocks = connectedNodeIds
      .map(nodeId => nodes.find(n => n.id === nodeId))
      .filter(node => node !== undefined);

    if (connectedBlocks.length === 0) {
      setNodes(nds =>
        nds.map(node =>
          node.id === outputNode.id
            ? { ...node, data: { ...node.data, content: '⚠️ No content connected. Please connect building blocks to this output node and click Run.' } }
            : node
        )
      );
      return;
    }

    try {
      // Use Gemini to compile the document intelligently
      const compiledContent = await geminiService.compileDocumentOutput(connectedBlocks);
      
      // Update the output node with the AI-compiled content
      setNodes(nds =>
        nds.map(node =>
          node.id === outputNode.id
            ? { ...node, data: { ...node.data, content: compiledContent } }
            : node
        )
      );
    } catch (error) {
      console.error('Error compiling document:', error);
      setNodes(nds =>
        nds.map(node =>
          node.id === outputNode.id
            ? { ...node, data: { ...node.data, content: '❌ Error generating output. Please check your API key and try again.' } }
            : node
        )
      );
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar with Panel Switching */}
      <div className="w-64 bg-muted/50 border-r border-border flex flex-col">
        {/* Panel Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActivePanel('blocks')}
            className={`flex-1 p-3 text-sm font-medium transition-colors ${
              activePanel === 'blocks' 
                ? 'bg-background border-b-2 border-primary text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Blocks
          </button>
          <button
            onClick={() => setActivePanel('templates')}
            className={`flex-1 p-3 text-sm font-medium transition-colors ${
              activePanel === 'templates' 
                ? 'bg-background border-b-2 border-primary text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Templates
          </button>
        </div>
        
        {/* Panel Content */}
        {activePanel === 'blocks' ? (
          <BuildingBlocksPanel onAddNode={setNodes} />
        ) : (
          <TemplatesPanel onLoadTemplate={loadTemplate} />
        )}
      </div>
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Document Designer</h2>
            <p className="text-sm text-muted-foreground">Design your document with customizable building blocks</p>
            {lastSaved && (
              <p className="text-xs text-muted-foreground">
                Last saved: {lastSaved.toLocaleTimeString()}
              </p>
            )}
            {!isApiKeyConfigured && (
              <div className="mt-2 bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 px-3 py-2 rounded-md text-xs flex items-center gap-2">
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>AI Features Disabled:</strong> Configure your Gemini API key to enable AI-powered content generation and document compilation.
                  <button 
                    onClick={() => setShowApiKeyModal(true)}
                    className="ml-2 underline hover:no-underline font-medium"
                  >
                    Configure Now
                  </button>
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
              title="Undo"
            >
              <Undo className="h-4 w-4" />
            </button>
            
            <button
              onClick={redo}
              disabled={!canRedo}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
              title="Redo"
            >
              <Redo className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => setShowApiKeyModal(true)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-3 gap-2 ${
                isApiKeyConfigured 
                  ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground' 
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
              title={isApiKeyConfigured ? 'API Key Configured' : 'Configure API Key'}
            >
              <Settings className="h-4 w-4" />
              {!isApiKeyConfigured && <span className="hidden sm:inline">API Key</span>}
            </button>
            
            <button
              onClick={runDocument}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-9 px-4 gap-2"
            >
              <Play className="h-4 w-4" />
              Run
            </button>
            
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"
              >
                <Download className="h-4 w-4" />
                Export
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-md shadow-lg z-50 export-menu">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        exportToMarkdown();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Export as Markdown
                    </button>
                    <button
                      onClick={() => {
                        exportToHTML();
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    >
                      <Code className="h-4 w-4" />
                      Export as HTML
                    </button>
                    <button
                      onClick={() => {
                        setShowMarkdownPreview(true);
                        setShowExportMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Preview Document
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <label className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2 cursor-pointer">
              <Upload className="h-4 w-4" />
              Load
              <input
                type="file"
                accept=".json"
                onChange={loadDocument}
                className="hidden"
              />
            </label>
            
            <button
              onClick={saveDocument}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            
            <button
              onClick={() => setShowKeyboardShortcuts(true)}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9"
              title="Keyboard Shortcuts"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            className="bg-background"
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </div>
      </div>

      {/* API Key Configuration Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowApiKeyModal(false)}>
          <div className="bg-card border border-border rounded-lg shadow-xl p-6 w-[500px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Gemini 2.0 API Configuration
              </h3>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Enter your Google Gemini 2.0 API key to enable advanced AI-powered content generation and document compilation.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key"
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                />
              </div>
              
              <div className="bg-muted/50 p-3 rounded-md text-xs space-y-2">
                <p className="font-medium">How to get your API key:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Visit <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Google AI Studio</a></li>
                  <li>Sign in with your Google account</li>
                  <li>Click "Get API Key" or "Create API Key"</li>
                  <li>Copy the key and paste it here</li>
                </ol>
                <p className="text-muted-foreground mt-2 pt-2 border-t border-border">
                  <strong>Note:</strong> Your API key is stored locally and never shared with anyone except Google's Gemini API.
                </p>
              </div>
              
              {isApiKeyConfigured && (
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-md text-xs text-green-700 dark:text-green-400 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>API Key is configured and ready to use!</span>
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={handleSaveApiKey}
                  className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save API Key
                </button>
                
                {isApiKeyConfigured && (
                  <button
                    onClick={handleRemoveApiKey}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-10 px-4"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Markdown Preview Modal */}
      {showMarkdownPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowMarkdownPreview(false)}>
          <div className="bg-card border border-border rounded-lg shadow-xl w-[90vw] h-[90vh] max-w-4xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Markdown Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadMarkdown}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button
                  onClick={() => setShowMarkdownPreview(false)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <div className="h-full flex">
                {/* Raw Markdown */}
                <div className="w-1/2 border-r border-border flex flex-col">
                  <div className="p-3 border-b border-border bg-muted/50">
                    <h4 className="text-sm font-medium">Raw Markdown</h4>
                  </div>
                  <textarea
                    value={markdownContent}
                    readOnly
                    className="flex-1 p-4 font-mono text-sm bg-background text-foreground resize-none border-none outline-none"
                    style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
                  />
                </div>
                
                {/* Rendered Preview */}
                <div className="w-1/2 flex flex-col">
                  <div className="p-3 border-b border-border bg-muted/50">
                    <h4 className="text-sm font-medium">Live Preview</h4>
                  </div>
                  <div 
                    className="flex-1 p-4 overflow-auto prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ 
                      __html: markdownContent
                        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/`(.*?)`/g, '<code>$1</code>')
                        .replace(/^```(\w+)?\n([\s\S]*?)\n```/gm, (match, lang, code) => 
                          `<pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto"><code class="language-${lang || 'text'}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
                        )
                        .replace(/^\- (.*$)/gm, '<li>$1</li>')
                        .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
                        .replace(/^---$/gm, '<hr>')
                        .replace(/\n\n/g, '</p><p>')
                        .replace(/\n/g, '<br>')
                        .replace(/^/, '<p>')
                        .replace(/$/, '</p>')
                        .replace(/<p><\/p>/g, '')
                        .replace(/<p>(<li>.*<\/li>)<\/p>/g, '<ul>$1</ul>')
                        .replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>')
                        .replace(/<p><ul>/g, '<ul>')
                        .replace(/<\/ul><\/p>/g, '</ul>')
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowKeyboardShortcuts(false)}>
          <div className="bg-card border border-border rounded-lg shadow-xl p-6 w-[600px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600" />
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowKeyboardShortcuts(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">General</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Undo</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+Z</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Redo</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">Ctrl+Y</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Delete Selected</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">Del</kbd>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Quick Add Nodes</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Text Block</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">T</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Molecule</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">M</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Chemical Equation</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">E</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Lab Procedure</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">P</kbd>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">More Nodes</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Image</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">I</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>List</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">L</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Table</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">B</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Quote</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">Q</kbd>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Advanced</h4>
                  <div className="space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Code Block</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">C</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Formula</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">F</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Reaction Scheme</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">R</kbd>
                    </div>
                    <div className="flex justify-between">
                      <span>Output</span>
                      <kbd className="px-2 py-1 bg-muted rounded text-xs">O</kbd>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/50 p-3 rounded-md text-xs text-muted-foreground">
                <strong>Tip:</strong> Click on any node to select it, then use Delete to remove it. 
                Use the quick keys to rapidly add new nodes to your canvas.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Document Designer with React Flow Provider
const DocumentDesigner = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-card border border-border rounded-lg shadow-lg w-[95vw] h-[90vh] flex flex-col animate-slide-up">
        <ReactFlowProvider>
          <DocumentDesignerContent onClose={onClose} />
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default DocumentDesigner;
