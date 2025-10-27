import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  ReactFlowInstance,
  Panel,
  useReactFlow,
  Handle,
  Position,
} from 'reactflow';
import { Background, BackgroundVariant } from '@reactflow/background';
import 'reactflow/dist/style.css';
import * as geminiService from '../services/geminiService';
import { 
  X, 
  Save, 
  Download, 
  Upload, 
  Plus, 
  Type, 
  Image, 
  List, 
  Table, 
  Code, 
  FileText,
  Quote,
  Calculator,
  BookOpen,
  Zap,
  Settings,
  Trash2,
  Copy,
  Eye,
  Sparkles,
  Play,
  Wand2
} from 'lucide-react';

// Custom Node Components
const TextNode = ({ data, isConnectable }: any) => {
  const [content, setContent] = useState(data.content || 'Enter text here...');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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
            onClick={generateWithAI}
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
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 hover:bg-primary/20 rounded text-primary"
          >
            <Settings className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="p-3">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-20 resize-none border-none outline-none bg-transparent text-sm"
            placeholder="Enter text content..."
          />
        ) : (
          <div className="text-sm text-foreground whitespace-pre-wrap">{content}</div>
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

const ImageNode = ({ data, isConnectable }: any) => {
  const [imageUrl, setImageUrl] = useState(data.imageUrl || '');
  const [isEditing, setIsEditing] = useState(false);

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
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-green-500/20 rounded text-green-600"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>
      <div className="p-3">
        {isEditing ? (
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full p-2 border border-border rounded text-sm"
            placeholder="Enter image URL..."
          />
        ) : (
          <div className="w-full h-24 bg-muted rounded flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt="Content" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-muted-foreground text-xs">No image</span>
            )}
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

const ListNode = ({ data, isConnectable }: any) => {
  const [items, setItems] = useState(data.items || ['Item 1', 'Item 2', 'Item 3']);
  const [isEditing, setIsEditing] = useState(false);

  const addItem = () => {
    setItems([...items, `Item ${items.length + 1}`]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_item: string, currentIndex: number) => currentIndex !== index));
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
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-blue-500/20 rounded text-blue-600"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>
      <div className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            {items.map((item: string, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index] = e.target.value;
                    setItems(newItems);
                  }}
                  className="flex-1 p-1 border border-border rounded text-xs"
                />
                <button
                  onClick={() => removeItem(index)}
                  className="p-1 hover:bg-destructive/20 rounded text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addItem}
              className="w-full p-1 border border-dashed border-border rounded text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3 mx-auto" />
            </button>
          </div>
        ) : (
          <ul className="text-sm text-foreground space-y-1">
            {items.map((item: string, index: number) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
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

const TableNode = ({ data, isConnectable }: any) => {
  const [tableData, setTableData] = useState(data.tableData || [
    ['Header 1', 'Header 2', 'Header 3'],
    ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
    ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3']
  ]);
  const [isEditing, setIsEditing] = useState(false);

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
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-purple-500/20 rounded text-purple-600"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>
      <div className="p-3">
        {isEditing ? (
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
                    }}
                    className="flex-1 p-1 border border-border rounded text-xs"
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {tableData[0]?.map((header: string, index: number) => (
                    <th key={index} className="text-left p-2 font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.slice(1).map((row: string[], rowIndex: number) => (
                  <tr key={rowIndex} className="border-b border-border">
                    {row.map((cell: string, colIndex: number) => (
                      <td key={colIndex} className="p-2">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
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

const QuoteNode = ({ data, isConnectable }: any) => {
  const [quote, setQuote] = useState(data.quote || 'Enter quote here...');
  const [author, setAuthor] = useState(data.author || 'Author');
  const [isEditing, setIsEditing] = useState(false);

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
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-orange-500/20 rounded text-orange-600"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>
      <div className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className="w-full p-2 border border-border rounded text-sm"
              placeholder="Enter quote..."
            />
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full p-2 border border-border rounded text-sm"
              placeholder="Enter author..."
            />
          </div>
        ) : (
          <div>
            <blockquote className="text-sm italic text-foreground border-l-4 border-orange-500 pl-3 mb-2">
              "{quote}"
            </blockquote>
            <cite className="text-xs text-muted-foreground">— {author}</cite>
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

const CodeNode = ({ data, isConnectable }: any) => {
  const [code, setCode] = useState(data.code || '// Enter code here...');
  const [language, setLanguage] = useState(data.language || 'javascript');
  const [isEditing, setIsEditing] = useState(false);

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
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-gray-700 rounded text-gray-400"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>
      <div className="p-3 bg-gray-900">
        {isEditing ? (
          <div className="space-y-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="p-1 border border-border rounded text-xs bg-background"
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
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-20 resize-none border border-border rounded text-xs font-mono bg-gray-800 text-green-400"
              placeholder="Enter code..."
            />
          </div>
        ) : (
          <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">{code}</pre>
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

const FormulaNode = ({ data, isConnectable }: any) => {
  const [formula, setFormula] = useState(data.formula || 'E = mc²');
  const [isEditing, setIsEditing] = useState(false);

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
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-yellow-500/20 rounded text-yellow-600"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>
      <div className="p-3">
        {isEditing ? (
          <input
            type="text"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            className="w-full p-2 border border-border rounded text-sm font-mono"
            placeholder="Enter formula..."
          />
        ) : (
          <div className="text-lg font-mono text-center text-yellow-600 bg-yellow-500/10 p-3 rounded">
            {formula}
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

// Node Types
const nodeTypes: NodeTypes = {
  textNode: TextNode,
  imageNode: ImageNode,
  listNode: ListNode,
  tableNode: TableNode,
  quoteNode: QuoteNode,
  codeNode: CodeNode,
  formulaNode: FormulaNode,
  outputNode: OutputNode,
};

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
    const content = `# Document Generated by AI

**Generated on:** ${now.toLocaleString()}
**Created with:** Gemini 2.0 AI Document Designer

---

${outputNode.data.content}

---

*This document was automatically generated using AI-powered content compilation from connected building blocks.*
`;

    setMarkdownContent(content);
    setShowMarkdownPreview(true);
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
      <BuildingBlocksPanel onAddNode={setNodes} />
      
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Document Designer</h2>
            <p className="text-sm text-muted-foreground">Design your document with customizable building blocks</p>
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
            
            <button
              onClick={exportToMarkdown}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"
              title="Export Document as Markdown"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export MD</span>
            </button>
            
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
                    <h4 className="text-sm font-medium">Preview</h4>
                  </div>
                  <div 
                    className="flex-1 p-4 overflow-auto prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ 
                      __html: markdownContent
                        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                        .replace(/^\- (.*$)/gm, '<li>$1</li>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/`(.*?)`/g, '<code>$1</code>')
                        .replace(/^---$/gm, '<hr>')
                        .replace(/\n/g, '<br>')
                    }}
                  />
                </div>
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
