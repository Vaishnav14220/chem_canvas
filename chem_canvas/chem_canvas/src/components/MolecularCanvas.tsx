import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Grid3x3, 
  Move, 
  Eye, 
  EyeOff,
  Download,
  Upload,
  Save,
  Trash2,
  Undo,
  Redo,
  Copy,
  Settings,
  Maximize2,
  Minimize2
} from 'lucide-react';

interface MolecularCanvasProps {
  currentTool: string;
  strokeWidth: number;
  strokeColor: string;
  onToolChange: (tool: string) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
}

interface MolecularObject {
  id: string;
  type: 'atom' | 'bond' | 'text' | 'arrow' | 'ring';
  x: number;
  y: number;
  element?: string;
  charge?: number;
  from?: string;
  to?: string;
  bondType?: 'single' | 'double' | 'triple' | 'aromatic';
  text?: string;
  color: string;
  size: number;
}

const MolecularCanvas: React.FC<MolecularCanvasProps> = ({
  currentTool,
  strokeWidth,
  strokeColor,
  onToolChange,
  onColorChange,
  onSizeChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [molecularObjects, setMolecularObjects] = useState<MolecularObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [history, setHistory] = useState<MolecularObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTextInputVisible, setIsTextInputVisible] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
  const [currentTextInput, setCurrentTextInput] = useState('');

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    redrawCanvas();
  }, [molecularObjects, zoom, showGrid]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height);
    }

    // Draw molecular objects
    molecularObjects.forEach(obj => {
      drawMolecularObject(ctx, obj);
    });

    // Draw selection highlight
    if (selectedObject) {
      const obj = molecularObjects.find(o => o.id === selectedObject);
      if (obj) {
        drawSelectionHighlight(ctx, obj);
      }
    }
  }, [molecularObjects, showGrid, selectedObject, zoom]);

  const clearCanvas = useCallback(() => {
    setMolecularObjects([]);
    setSelectedObject(null);
    setHistory([]);
    setHistoryIndex(-1);
    redrawCanvas();
  }, []);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    
    const gridSize = 20 * zoom;
    
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
    
    ctx.setLineDash([]);
  };

  const drawMolecularObject = (ctx: CanvasRenderingContext2D, obj: MolecularObject) => {
    ctx.save();
    ctx.scale(zoom, zoom);

    switch (obj.type) {
      case 'atom':
        drawAtom(ctx, obj);
        break;
      case 'bond':
        drawBond(ctx, obj);
        break;
      case 'text':
        drawText(ctx, obj);
        break;
      case 'arrow':
        drawArrow(ctx, obj);
        break;
      case 'ring':
        drawRing(ctx, obj);
        break;
    }

    ctx.restore();
  };

  const drawAtom = (ctx: CanvasRenderingContext2D, atom: MolecularObject) => {
    const radius = (atom.size || 15) * zoom;
    
    // Atom circle
    ctx.fillStyle = atom.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(atom.x, atom.y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Element symbol
    if (atom.element) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${radius * 0.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(atom.element, atom.x, atom.y);
    }

    // Charge
    if (atom.charge && atom.charge !== 0) {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = `${radius * 0.5}px Arial`;
      ctx.fillText(
        atom.charge > 0 ? `+${atom.charge}` : `${atom.charge}`,
        atom.x + radius * 0.7,
        atom.y - radius * 0.7
      );
    }
  };

  const drawBond = (ctx: CanvasRenderingContext2D, bond: MolecularObject) => {
    const fromAtom = molecularObjects.find(a => a.id === bond.from);
    const toAtom = molecularObjects.find(a => a.id === bond.to);
    
    if (!fromAtom || !toAtom) return;

    ctx.strokeStyle = bond.color;
    ctx.lineWidth = (bond.size || 3) * zoom;
    ctx.lineCap = 'round';

    switch (bond.bondType) {
      case 'single':
        ctx.beginPath();
        ctx.moveTo(fromAtom.x, fromAtom.y);
        ctx.lineTo(toAtom.x, toAtom.y);
        ctx.stroke();
        break;
      case 'double':
        const dx = toAtom.x - fromAtom.x;
        const dy = toAtom.y - fromAtom.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / length * 3;
        const perpY = dx / length * 3;
        
        ctx.beginPath();
        ctx.moveTo(fromAtom.x + perpX, fromAtom.y + perpY);
        ctx.lineTo(toAtom.x + perpX, toAtom.y + perpY);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(fromAtom.x - perpX, fromAtom.y - perpY);
        ctx.lineTo(toAtom.x - perpX, toAtom.y - perpY);
        ctx.stroke();
        break;
      case 'triple':
        const dx2 = toAtom.x - fromAtom.x;
        const dy2 = toAtom.y - fromAtom.y;
        const length2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const perpX2 = -dy2 / length2 * 5;
        const perpY2 = dx2 / length2 * 5;
        
        ctx.beginPath();
        ctx.moveTo(fromAtom.x, fromAtom.y);
        ctx.lineTo(toAtom.x, toAtom.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(fromAtom.x + perpX2, fromAtom.y + perpY2);
        ctx.lineTo(toAtom.x + perpX2, toAtom.y + perpY2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(fromAtom.x - perpX2, fromAtom.y - perpY2);
        ctx.lineTo(toAtom.x - perpX2, toAtom.y - perpY2);
        ctx.stroke();
        break;
    }
  };

  const drawText = (ctx: CanvasRenderingContext2D, text: MolecularObject) => {
    ctx.fillStyle = text.color;
    ctx.font = `${(text.size || 16) * zoom}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text.text || '', text.x, text.y);
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, arrow: MolecularObject) => {
    const fromAtom = molecularObjects.find(a => a.id === arrow.from);
    const toAtom = molecularObjects.find(a => a.id === arrow.to);
    
    if (!fromAtom || !toAtom) return;

    const dx = toAtom.x - fromAtom.x;
    const dy = toAtom.y - fromAtom.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    const headLength = 15 * zoom;
    const headAngle = Math.PI / 6;

    ctx.strokeStyle = arrow.color;
    ctx.lineWidth = (arrow.size || 3) * zoom;
    ctx.lineCap = 'round';

    // Arrow line
    ctx.beginPath();
    ctx.moveTo(fromAtom.x, fromAtom.y);
    ctx.lineTo(toAtom.x - headLength * Math.cos(angle), toAtom.y - headLength * Math.sin(angle));
    ctx.stroke();

    // Arrow head
    ctx.beginPath();
    ctx.moveTo(toAtom.x, toAtom.y);
    ctx.lineTo(
      toAtom.x - headLength * Math.cos(angle - headAngle),
      toAtom.y - headLength * Math.sin(angle - headAngle)
    );
    ctx.moveTo(toAtom.x, toAtom.y);
    ctx.lineTo(
      toAtom.x - headLength * Math.cos(angle + headAngle),
      toAtom.y - headLength * Math.sin(angle + headAngle)
    );
    ctx.stroke();
  };

  const drawRing = (ctx: CanvasRenderingContext2D, ring: MolecularObject) => {
    const radius = (ring.size || 30) * zoom;
    const sides = 6; // Hexagon for benzene ring

    ctx.strokeStyle = ring.color;
    ctx.lineWidth = (ring.size || 3) * zoom;
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      const x = ring.x + radius * Math.cos(angle);
      const y = ring.y + radius * Math.sin(angle);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();

    // Draw alternating double bonds for aromatic ring
    ctx.setLineDash([5, 5]);
    for (let i = 0; i < sides; i += 2) {
      const angle1 = (i * 2 * Math.PI) / sides;
      const angle2 = ((i + 1) * 2 * Math.PI) / sides;
      const x1 = ring.x + radius * Math.cos(angle1);
      const y1 = ring.y + radius * Math.sin(angle1);
      const x2 = ring.x + radius * Math.cos(angle2);
      const y2 = ring.y + radius * Math.sin(angle2);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  const drawSelectionHighlight = (ctx: CanvasRenderingContext2D, obj: MolecularObject) => {
    ctx.save();
    ctx.scale(zoom, zoom);
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    
    const radius = (obj.size || 15) + 5;
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.restore();
  };

  const addToHistory = useCallback((objects: MolecularObject[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...objects]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setMolecularObjects([...history[historyIndex - 1]]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setMolecularObjects([...history[historyIndex + 1]]);
    }
  };

  const handleTextSubmit = () => {
    if (currentTextInput.trim()) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (textInputPosition.x) / zoom;
      const y = (textInputPosition.y) / zoom;

      const newText: MolecularObject = {
        id: `text-${Date.now()}`,
        type: 'text',
        x,
        y,
        text: currentTextInput,
        color: strokeColor,
        size: 24 // Larger fixed size for text readability on canvas
      };

      const newObjects = [...molecularObjects, newText];
      setMolecularObjects(newObjects);
      addToHistory(newObjects);
    }
    setIsTextInputVisible(false);
    setCurrentTextInput('');
  };

  const handleTextCancel = () => {
    setIsTextInputVisible(false);
    setCurrentTextInput('');
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    setIsDrawing(true);
    setLastX(x);
    setLastY(y);

    if (currentTool === 'atom') {
      const newAtom: MolecularObject = {
        id: `atom-${Date.now()}`,
        type: 'atom',
        x,
        y,
        element: 'C',
        color: strokeColor,
        size: strokeWidth
      };
      
      const newObjects = [...molecularObjects, newAtom];
      setMolecularObjects(newObjects);
      addToHistory(newObjects);
    } else if (currentTool === 'textbox') {
      // Show text input at clicked position
      setTextInputPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setCurrentTextInput('');
      setIsTextInputVisible(true);
      setIsDrawing(false); // Don't continue drawing for text input
      return;
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Handle different drawing tools
    if (currentTool === 'bond') {
      // Find nearest atom to start bond
      const nearestAtom = molecularObjects
        .filter(obj => obj.type === 'atom')
        .reduce((nearest, atom) => {
          const dist = Math.sqrt((atom.x - x) ** 2 + (atom.y - y) ** 2);
          const nearestDist = nearest ? Math.sqrt((nearest.x - x) ** 2 + (nearest.y - y) ** 2) : Infinity;
          return dist < nearestDist ? atom : nearest;
        }, null as MolecularObject | null);

      if (nearestAtom) {
        const newBond: MolecularObject = {
          id: `bond-${Date.now()}`,
          type: 'bond',
          x: 0,
          y: 0,
          from: nearestAtom.id,
          to: `temp-${Date.now()}`,
          bondType: 'single',
          color: strokeColor,
          size: strokeWidth
        };
        
        const newObjects = [...molecularObjects, newBond];
        setMolecularObjects(newObjects);
      }
    }

    setLastX(x);
    setLastY(y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);

  const exportCanvas = (format: 'png' | 'svg' | 'pdf') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    switch (format) {
      case 'png':
        const link = document.createElement('a');
        link.download = 'molecular-structure.png';
        link.href = canvas.toDataURL();
        link.click();
        break;
      case 'svg':
        // SVG export would require more complex implementation
        console.log('SVG export not implemented yet');
        break;
      case 'pdf':
        // PDF export would require jsPDF library
        console.log('PDF export not implemented yet');
        break;
    }
  };

  return (
    <div className={`relative w-full h-full bg-slate-900 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Top Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/50 p-2">
        <div className="flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
              title="Undo"
            >
              <Undo size={18} />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
              title="Redo"
            >
              <Redo size={18} />
            </button>
            <div className="w-px h-6 bg-slate-600 mx-2" />
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-lg transition-colors ${
                showGrid ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700/50'
              }`}
              title="Toggle Grid"
            >
              <Grid3x3 size={18} />
            </button>
          </div>

          {/* Center Info */}
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <span>Objects: {molecularObjects.length}</span>
            <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
            <span>Tool: {currentTool}</span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
            <div className="w-px h-6 bg-slate-600 mx-2" />
            <button
              onClick={() => exportCanvas('png')}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Export PNG"
            >
              <Download size={18} />
            </button>
            <button
              onClick={clearCanvas}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Clear Canvas"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          marginTop: '60px', // Account for top toolbar
          height: 'calc(100% - 60px)'
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />

      {/* Text Input Overlay */}
      {isTextInputVisible && (
        <div
          className="absolute z-20"
          style={{
            left: textInputPosition.x,
            top: textInputPosition.y + 60, // Account for top toolbar
          }}
        >
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-lg">
            <input
              type="text"
              value={currentTextInput}
              onChange={(e) => setCurrentTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTextSubmit();
                } else if (e.key === 'Escape') {
                  handleTextCancel();
                }
              }}
              placeholder="Enter text..."
              className="bg-slate-700 text-white px-3 py-1 rounded text-sm border border-slate-600 focus:border-blue-500 focus:outline-none min-w-32"
              autoFocus
            />
            <div className="flex gap-1 mt-2">
              <button
                onClick={handleTextSubmit}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                OK
              </button>
              <button
                onClick={handleTextCancel}
                className="px-2 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-slate-800/95 backdrop-blur-sm border-t border-slate-700/50 p-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>Ready</span>
            <span>•</span>
            <span>Professional Molecular Drawing</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Click to add atoms</span>
            <span>•</span>
            <span>Drag to create bonds</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MolecularCanvas;
