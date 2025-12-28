import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Gem,
  Scan,
  Eraser,
  Pen,
  Layers,
  Sparkles,
  Palette,
  Sliders,
  Clock
} from 'lucide-react';

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xl z-50 ${
        isCollapsed ? 'overflow-hidden p-2' : 'p-3'
      }`}
      style={{
        ...containerStyle,
        width: isCollapsed ? collapsedWidth : expandedWidth,
        maxHeight: isCollapsed ? 'auto' : '90vh',
        overflowY: isCollapsed ? 'hidden' : 'auto'
      }}
    >
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2 ${isCollapsed ? 'mb-0' : 'mb-2'}`}>
        <motion.div 
          className="flex items-center gap-2 min-w-0"
          whileHover={{ scale: 1.02 }}
        >
          <div className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30 flex-shrink-0 ${
            isCollapsed ? 'h-8 w-8' : 'h-8 w-8'
          }`}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Atom size={isCollapsed ? 18 : 18} />
            </motion.div>
          </div>
          {!isCollapsed && (
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent whitespace-nowrap"
            >
              Chemistry Tools
            </motion.span>
          )}
        </motion.div>
        {!isCollapsed && (
          <motion.button
            type="button"
            onClick={onToggleCollapse || (() => {})}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-gradient-to-br from-white to-slate-50 hover:from-slate-50 hover:to-slate-100 text-slate-600 hover:text-slate-900 h-8 w-8 transition-all shadow-md hover:shadow-lg flex-shrink-0"
            title="Collapse toolbar"
          >
            <ChevronLeft size={16} />
          </motion.button>
        )}
      </div>
      <AnimatePresence>
        {isCollapsed && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            type="button"
            onClick={onToggleCollapse || (() => {})}
            className="absolute right-2 top-2 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-600 hover:text-slate-900 h-7 w-7 transition-all shadow-md hover:shadow"
            title="Expand toolbar"
          >
            <ChevronRight size={14} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mt-2"
            aria-hidden={isCollapsed}
          >
            {/* Primary Tools - Horizontal Layout */}
            <motion.div 
              className="flex items-center gap-1 pb-3 border-b border-slate-200/60 flex-wrap"
            >
              {primaryTools.map((tool, index) => (
                <motion.button
                  key={tool.id}
                  onClick={() => onToolSelect(tool.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative inline-flex flex-col items-center justify-center rounded-xl p-2 min-w-[62px] transition-all ${
                    currentTool === tool.id
                      ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-400/50'
                      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-800'
                  }`}
                  title={tool.description}
                >
                  <tool.icon 
                    size={24} 
                    className={currentTool === tool.id ? 'text-white' : 'text-slate-600'} 
                  />
                  <span className={`text-[10px] mt-1 font-medium ${currentTool === tool.id ? 'text-white' : 'text-slate-500'}`}>
                    {tool.name}
                  </span>
                  {currentTool === tool.id && (
                    <motion.div
                      layoutId="activeTool"
                      className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 -z-10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
          
              {/* Stroke Color Dropdown */}
          <div className="relative" ref={strokeDropdownRef}>
            <motion.button
              onClick={() => {
                setShowStrokeDropdown(!showStrokeDropdown);
                setShowBrushDropdown(false);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center justify-center rounded-xl p-2 min-w-[62px] transition-all ${
                showStrokeDropdown ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <div className="relative">
                <div 
                  className="w-6 h-6 rounded-full border-2 border-slate-300 shadow-inner"
                  style={{ backgroundColor: strokeColor }}
                />
                {showStrokeDropdown && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full"
                    layoutId="strokeIndicator"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  />
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium text-slate-500">Stroke</span>
            </motion.button>
            <AnimatePresence>
              {showStrokeDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 mt-2 bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-2xl z-[60] w-72 p-4"
                >
                  {/* Current Selection Bar */}
                  <motion.div 
                    className="h-3 rounded-xl mb-4 shadow-inner"
                    style={{ backgroundColor: strokeColor }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                  />
                  
                  {/* Thickness */}
                  <div className="mb-4">
                    <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Sliders size={14} className="text-cyan-500" />
                      Thickness
                    </div>
                    <div className="flex items-center gap-3">
                      {thicknessOptions.slice(0, 6).map((size, idx) => (
                        <motion.button
                          key={size}
                          onClick={() => onSizeChange(size)}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.8 }}
                          className={`rounded-full border-2 transition-all ${
                            currentSize === size
                              ? 'border-cyan-500 ring-4 ring-cyan-500/20 shadow-lg'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                          style={{ 
                            width: Math.max(10, size / 1.8),
                            height: Math.max(10, size / 1.8)
                          }}
                          title={`${size}px`}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Recent Colors */}
                  {recentColors.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <Clock size={14} className="text-purple-500" />
                        Recent Colors
                      </div>
                      <div className="flex gap-2">
                        {recentColors.map((color, idx) => (
                          <motion.button
                            key={idx}
                            onClick={() => handleColorSelect(color, true)}
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            className={`w-8 h-8 rounded-xl border-2 transition-all ${
                              strokeColor === color
                                ? 'border-cyan-500 ring-4 ring-cyan-500/30 shadow-lg'
                                : 'border-slate-300 hover:border-slate-400'
                            }`}
                            style={{ backgroundColor: color }}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Colors Grid */}
                  <div>
                    <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <Palette size={14} className="text-pink-500" />
                      Colors
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {colors.map((color, idx) => (
                        <motion.button
                          key={idx}
                          onClick={() => {
                            handleColorSelect(color, true);
                            setShowStrokeDropdown(false);
                          }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className={`w-full aspect-square rounded-xl border-2 transition-all ${
                            strokeColor === color
                              ? 'border-cyan-500 ring-4 ring-cyan-500/30 shadow-lg'
                              : 'border-slate-300 hover:border-slate-400'
                          }`}
                          style={{ backgroundColor: color }}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.02 }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* More Colors Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-4 w-full text-xs font-semibold text-slate-600 hover:text-slate-900 py-2.5 flex items-center justify-center gap-2 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200"
                  >
                    <Plus size={14} />
                    More Colors
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

              {/* Brush Size Dropdown */}
          <div className="relative" ref={brushDropdownRef}>
            <motion.button
              onClick={() => {
                setShowBrushDropdown(!showBrushDropdown);
                setShowStrokeDropdown(false);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center justify-center rounded-xl p-2 min-w-[62px] transition-all ${
                showBrushDropdown ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <div className="relative">
                <div 
                  className="rounded-full border-2 border-slate-400 shadow-inner flex items-center justify-center" 
                  style={{ 
                    width: Math.max(20, currentSize / 1.5),
                    height: Math.max(20, currentSize / 1.5)
                  }} 
                />
                {showBrushDropdown && (
                  <motion.div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full"
                    layoutId="brushIndicator"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  />
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium text-slate-500">{currentSize}px</span>
            </motion.button>
            <AnimatePresence>
              {showBrushDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 mt-2 bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-2xl z-[60] w-64 p-4"
                >
                  <div className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Sliders size={14} className="text-cyan-500" />
                    Brush Size
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {thicknessOptions.map((size, idx) => (
                      <motion.button
                        key={size}
                        onClick={() => {
                          onSizeChange(size);
                          setShowBrushDropdown(false);
                        }}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.8 }}
                        className={`rounded-full border-2 transition-all flex-shrink-0 ${
                          currentSize === size
                            ? 'border-cyan-500 ring-4 ring-cyan-500/20 shadow-lg'
                            : 'border-slate-300 hover:border-slate-400'
                        }`}
                        style={{ 
                          width: Math.max(10, size / 1.6),
                          height: Math.max(10, size / 1.6)
                        }}
                        title={`${size}px`}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                      />
                    ))}
                    <motion.button 
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200 ml-auto"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Plus size={14} />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Additional Tools - Horizontal Layout */}
        <motion.div 
          className="flex items-center gap-1 pt-3 border-t border-slate-200/60 mt-3 flex-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {toolSections.flatMap((section, sectionIndex) => 
            section.tools.map((tool, toolIndex) => {
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
                <motion.button
                  key={tool.id}
                  onClick={handleClick}
                  disabled={tool.id === 'ar' && !selectedMoleculeCid}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (sectionIndex * 0.1) + (toolIndex * 0.05) }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative inline-flex flex-col items-center justify-center rounded-xl p-2 min-w-[62px] transition-all hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 disabled:opacity-40 disabled:cursor-not-allowed group"
                  title={tool.description}
                >
                  <div className="relative">
                    <tool.icon size={22} className="text-slate-600 group-hover:text-purple-600 transition-colors" />
                    <motion.div 
                      className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                  <span className="text-[10px] mt-1 font-medium text-slate-500 group-hover:text-purple-700 transition-colors">{tool.name}</span>
                </motion.button>
              );
            })
          )}
          
          {/* Shapes */}
          {shapes.map((shape, index) => (
            <motion.button
              key={shape.id}
              onClick={() => onToolSelect(shape.id)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + (index * 0.05) }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className={`relative inline-flex flex-col items-center justify-center rounded-xl p-2 min-w-[62px] transition-all ${
                currentTool === shape.id
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/50'
                  : 'hover:bg-gradient-to-br hover:from-emerald-50 hover:to-teal-50'
              }`}
              title={shape.description}
            >
              <shape.icon 
                size={22} 
                className={currentTool === shape.id ? 'text-white' : 'text-slate-600 hover:text-emerald-600 transition-colors'} 
              />
              <span className={`text-[10px] mt-1 font-medium ${currentTool === shape.id ? 'text-white' : 'text-slate-500 hover:text-emerald-700'} transition-colors`}>
                {shape.name}
              </span>
              {currentTool === shape.id && (
                <motion.div
                  layoutId="shapeActive"
                  className="absolute inset-0 rounded-xl -z-10"
                  initial={false}
                />
              )}
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  </motion.div>
  );
};

export default ChemistryToolbar;
