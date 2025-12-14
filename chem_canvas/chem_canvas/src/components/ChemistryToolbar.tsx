// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  Atom, 
  Beaker, 
  ArrowRight, 
  Plus,
  Minus,
  Equal,
  Type,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Calculator,
  Grid3X3,
  Move,
  RotateCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Gem,
  Scan,
  Eraser,
  Pen
} from 'lucide-react';
import ResizeToolbar from './ResizeToolbar';

interface ChemistryToolbarProps {
  onToolSelect: (tool: string) => void;
  currentTool: string;
  onColorChange?: (color: string) => void;
  currentColor?: string;
  onStrokeColorChange: (color: string) => void;
  strokeColor: string;
  onFillToggle: (enabled: boolean) => void;
  fillEnabled: boolean;
  onFillColorChange: (color: string) => void;
  fillColor: string;
  onSizeChange: (size: number) => void;
  currentSize: number;
  onOpenCalculator?: () => void;
  onOpenMolView?: () => void;
  onOpenPeriodicTable?: () => void;
  onOpenMineralSearch?: () => void;
  onOpenArViewer?: () => void;
  onOpenChemistryWidgets?: () => void;
  selectedShape?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    rotation?: number;
  } | null;
  selectedMoleculeCid?: string | null;
  onResize?: (width: number, height: number) => void;
  onRotate?: (angle: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  width?: number;
  onResizeStart?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const ChemistryToolbar: React.FC<ChemistryToolbarProps> = ({
  onToolSelect,
  currentTool,
  onStrokeColorChange,
  strokeColor,
  onFillToggle,
  fillEnabled,
  onFillColorChange,
  fillColor,
  onSizeChange,
  currentSize,
  onOpenCalculator,
  onOpenMolView,
  onOpenPeriodicTable,
  onOpenMineralSearch,
  onOpenArViewer,
  onOpenChemistryWidgets,
  selectedShape,
  selectedMoleculeCid,
  onResize,
  onRotate,
  isCollapsed = false,
  onToggleCollapse,
  width,
  onResizeStart
}) => {
  const [openSections, setOpenSections] = useState({
    symbols: false,
    labs: false,
    transform: false,
    shapes: false,
    stroke: false,
    brush: false,
    resize: false,
    quick: false,
  });
  const [showStrokeDropdown, setShowStrokeDropdown] = useState(false);
  const [showBrushDropdown, setShowBrushDropdown] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const strokeDropdownRef = useRef<HTMLDivElement>(null);
  const brushDropdownRef = useRef<HTMLDivElement>(null);

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (strokeDropdownRef.current && !strokeDropdownRef.current.contains(event.target as Node)) {
        setShowStrokeDropdown(false);
      }
      if (brushDropdownRef.current && !brushDropdownRef.current.contains(event.target as Node)) {
        setShowBrushDropdown(false);
      }
    };

    if (showStrokeDropdown || showBrushDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStrokeDropdown, showBrushDropdown]);

  // MolView icon component
  const MolViewIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <path d="M12 2L2 7L12 12L22 7L12 2Z" />
      <path d="M2 17L12 22L22 17" />
      <path d="M2 12L12 17L22 12" />
    </svg>
  );

  const primaryTools = [
    { id: 'draw', name: 'Draw', icon: Pen, description: 'Free drawing tool' },
    { id: 'bond', name: 'Bond', icon: Minus, description: 'Draw chemical bonds' },
    { id: 'arrow', name: 'Arrow', icon: ArrowRight, description: 'Reaction arrows' },
    { id: 'textbox', name: 'Text', icon: Type, description: 'Insert text box' },
  ];

  const toolSections = [
    {
      key: 'symbols',
      title: 'Symbols & Notations',
      description: 'Ions, annotations, quick glyphs',
      tools: [
        { id: 'plus', name: 'Plus', icon: Plus, description: 'Plus sign for ions' },
        { id: 'minus', name: 'Minus', icon: Minus, description: 'Minus sign for ions' },
        { id: 'equal', name: 'Equal', icon: Equal, description: 'Equilibrium arrows' },
      ]
    },
    {
      key: 'labs',
      title: 'Lab Utilities',
      description: 'Reference data & AR tools',
      tools: [
        { id: 'calculator', name: 'Calculator', icon: Calculator, description: 'Quick calculations', action: 'calculator' },
        { id: 'molview', name: '3D Molecules', icon: MolViewIcon, description: '3D molecular viewer', action: 'molview' },
        { id: 'periodic', name: 'Periodic', icon: Grid3X3, description: 'Periodic table', action: 'periodic' },
        { id: 'minerals', name: 'Minerals', icon: Gem, description: 'Mineral explorer', action: 'minerals' },
        { id: 'widgets', name: 'Widgets', icon: Beaker, description: 'Interactive chemistry tools', action: 'widgets' },
        { id: 'ar', name: 'AR Viewer', icon: Scan, description: 'Place molecules in AR', action: 'ar' },
      ]
    },
    {
      key: 'transform',
      title: 'Transform & Arrange',
      description: 'Manipulate existing elements',
      tools: [
        { id: 'move', name: 'Move', icon: Move, description: 'Move elements' },
        { id: 'rotate', name: 'Rotate', icon: RotateCw, description: 'Rotate elements' },
      ]
    }
  ] as const;

  const shapes = [
    { id: 'circle', name: 'Circle', icon: Circle, description: 'Circular shapes' },
    { id: 'square', name: 'Square', icon: Square, description: 'Square shapes' },
    { id: 'triangle', name: 'Triangle', icon: Triangle, description: 'Triangular shapes' },
    { id: 'hexagon', name: 'Hexagon', icon: Hexagon, description: 'Hexagonal shapes' },
  ];

  const colors = [
    '#fbbf24', '#f97316', '#ec4899', '#ef4444', '#1e40af', // Row 1: Yellow, Orange, Hot Pink, Red, Dark Blue
    '#a855f7', '#6b21a8', '#60a5fa', '#6b7280', '#000000', // Row 2: Purple, Dark Purple, Light Blue, Gray, Black
    '#84cc16', '#166534', '#d1d5db', '#000000', // Row 3: Lime Green, Dark Green, Light Gray, Black
  ];

  const thicknessOptions = [1, 2, 4, 6, 8, 12, 16, 20];

  const handleColorSelect = (color: string, isStroke: boolean) => {
    if (isStroke) {
      onStrokeColorChange(color);
      setRecentColors(prev => {
        const filtered = prev.filter(c => c !== color);
        return [color, ...filtered].slice(0, 5);
      });
    } else {
      onFillColorChange(color);
    }
  };

  const containerStyle = width ? { width } : undefined;
  const widthLabel = typeof width === 'number' ? `${Math.round(width)}px` : null;
  const showShapes = openSections.shapes;


  const collapsedWidth = 80; // Width when collapsed (just icon)
  // Use a minimum expanded width that fits all tools, but constrain to reasonable max
  const minExpandedWidth = 600; // Minimum width to show all options
  const maxExpandedWidth = 1200; // Maximum width to prevent overlap
  const calculatedWidth = width && width >= minExpandedWidth ? width : minExpandedWidth;
  const expandedWidth = Math.min(calculatedWidth, maxExpandedWidth);

  return (
    <div
      className={`relative rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-sm shadow-xl z-50 ${
        isCollapsed ? 'overflow-hidden p-2' : 'p-3'
      }`}
      style={{
        ...containerStyle,
        width: isCollapsed ? collapsedWidth : expandedWidth,
        transition: 'width 0.2s ease-out',
        maxHeight: isCollapsed ? 'auto' : '90vh',
        overflowY: isCollapsed ? 'hidden' : 'auto'
      }}
    >
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2 ${isCollapsed ? 'mb-0' : 'mb-1'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md flex-shrink-0 ${
            isCollapsed ? 'h-8 w-8' : 'h-7 w-7'
          }`}>
            <Atom size={isCollapsed ? 18 : 16} />
          </div>
          {!isCollapsed && (
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Chemistry Tools
            </span>
          )}
        </div>
        {!isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse || (() => {})}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-600 hover:text-slate-900 h-7 w-7 transition-all shadow-sm hover:shadow flex-shrink-0"
            title="Collapse toolbar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>
      {isCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapse || (() => {})}
          className="absolute right-2 top-2 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-600 hover:text-slate-900 h-6 w-6 transition-all shadow-sm hover:shadow"
          title="Expand toolbar"
        >
          <ChevronRight size={14} />
        </button>
      )}

      <div
        className={`${
          isCollapsed ? 'hidden' : 'mt-2'
        }`}
        aria-hidden={isCollapsed}
      >
        {/* Primary Tools - Horizontal Layout */}
        <div className="flex items-center gap-0.5 pb-2 border-b border-slate-200 flex-wrap">
          {primaryTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolSelect(tool.id)}
              className={`relative inline-flex flex-col items-center justify-center rounded p-1.5 min-w-[56px] transition-all ${
                currentTool === tool.id
                  ? 'bg-slate-100'
                  : 'hover:bg-slate-50'
              }`}
              title={tool.description}
            >
              <tool.icon 
                size={22} 
                className={currentTool === tool.id ? 'text-slate-900' : 'text-slate-600'} 
              />
              <span className={`text-[10px] mt-0.5 ${currentTool === tool.id ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                {tool.name}
              </span>
            </button>
          ))}
          
          {/* Stroke Color Dropdown */}
          <div className="relative" ref={strokeDropdownRef}>
            <button
              onClick={() => {
                setShowStrokeDropdown(!showStrokeDropdown);
                setShowBrushDropdown(false);
              }}
              className={`flex flex-col items-center justify-center rounded p-1.5 min-w-[56px] transition-all ${
                showStrokeDropdown ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1">
                <div 
                  className="w-5 h-5 rounded border-2 border-slate-300"
                  style={{ backgroundColor: strokeColor }}
                />
              </div>
              <span className="text-[10px] mt-0.5 text-slate-500">Stroke</span>
            </button>
            {showStrokeDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[60] w-64 p-3">
                {/* Current Selection Bar */}
                <div className="h-2 rounded mb-3" style={{ backgroundColor: strokeColor }} />
                
                {/* Thickness */}
                <div className="mb-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Thickness</div>
                  <div className="flex items-center gap-2">
                    {thicknessOptions.slice(0, 5).map((size) => (
                      <button
                        key={size}
                        onClick={() => onSizeChange(size)}
                        className={`rounded-full border-2 transition-all ${
                          currentSize === size
                            ? 'border-slate-900 ring-2 ring-slate-200'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                        style={{ 
                          width: Math.max(8, size / 2),
                          height: Math.max(8, size / 2)
                        }}
                        title={`${size}px`}
                      />
                    ))}
                    <button className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Recent Colors */}
                {recentColors.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">Recent Colors</div>
                    <div className="flex gap-1.5">
                      {recentColors.map((color, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleColorSelect(color, true)}
                          className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                            strokeColor === color
                              ? 'border-slate-900 ring-2 ring-red-500'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Colors Grid */}
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-2">Colors</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {colors.map((color, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          handleColorSelect(color, true);
                          setShowStrokeDropdown(false);
                        }}
                        className={`w-full aspect-square rounded border-2 transition-all hover:scale-105 ${
                          strokeColor === color
                            ? 'border-slate-900 ring-2 ring-red-500'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* More Colors Button */}
                <button className="mt-3 w-full text-xs text-slate-600 hover:text-slate-900 py-1.5 flex items-center justify-center gap-1 hover:bg-slate-50 rounded">
                  <span>More Colors</span>
                </button>
              </div>
            )}
          </div>

          {/* Brush Size Dropdown */}
          <div className="relative" ref={brushDropdownRef}>
            <button
              onClick={() => {
                setShowBrushDropdown(!showBrushDropdown);
                setShowStrokeDropdown(false);
              }}
              className={`flex flex-col items-center justify-center rounded p-1.5 min-w-[56px] transition-all ${
                showBrushDropdown ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
            >
              <div className="w-5 h-5 rounded-full border-2 border-slate-700 flex items-center justify-center" style={{ 
                width: Math.max(6, currentSize / 3),
                height: Math.max(6, currentSize / 3)
              }} />
              <span className="text-[10px] mt-0.5 text-slate-500">{currentSize}px</span>
            </button>
            {showBrushDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[60] w-56 p-3">
                <div className="text-xs font-semibold text-slate-700 mb-3">Thickness</div>
                <div className="flex items-center gap-3">
                  {thicknessOptions.map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        onSizeChange(size);
                        setShowBrushDropdown(false);
                      }}
                      className={`rounded-full border-2 transition-all flex-shrink-0 ${
                        currentSize === size
                          ? 'border-slate-900 ring-2 ring-slate-200'
                          : 'border-slate-300 hover:border-slate-400'
                      }`}
                      style={{ 
                        width: Math.max(6, size / 2.5),
                        height: Math.max(6, size / 2.5)
                      }}
                      title={`${size}px`}
                    />
                  ))}
                  <button className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded ml-auto">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Additional Tools - Horizontal Layout */}
        <div className="flex items-center gap-0.5 pt-2 border-t border-slate-200 mt-2 flex-wrap">
          {toolSections.flatMap(section => 
            section.tools.map(tool => {
              const handleClick = () => {
                switch (tool.action) {
                  case 'calculator': return onOpenCalculator?.();
                  case 'molview': return onOpenMolView?.();
                  case 'periodic': return onOpenPeriodicTable?.();
                  case 'minerals': return onOpenMineralSearch?.();
                  case 'widgets': return onOpenChemistryWidgets?.();
                  case 'ar': return onOpenArViewer?.();
                  default: return onToolSelect(tool.id);
                }
              };
              return (
                <button
                  key={tool.id}
                  onClick={handleClick}
                  disabled={tool.id === 'ar' && !selectedMoleculeCid}
                  className="relative inline-flex flex-col items-center justify-center rounded p-1.5 min-w-[56px] transition-all hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={tool.description}
                >
                  <tool.icon size={22} className="text-slate-600" />
                  <span className="text-[10px] mt-0.5 text-slate-500">{tool.name}</span>
                </button>
              );
            })
          )}
          
          {/* Shapes */}
          {shapes.map((shape) => (
            <button
              key={shape.id}
              onClick={() => onToolSelect(shape.id)}
              className={`relative inline-flex flex-col items-center justify-center rounded p-1.5 min-w-[56px] transition-all ${
                currentTool === shape.id
                  ? 'bg-slate-100'
                  : 'hover:bg-slate-50'
              }`}
              title={shape.description}
            >
              <shape.icon 
                size={22} 
                className={currentTool === shape.id ? 'text-slate-900' : 'text-slate-600'} 
              />
              <span className={`text-[10px] mt-0.5 ${currentTool === shape.id ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                {shape.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChemistryToolbar;
