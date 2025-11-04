import React, { useState } from 'react';
import { 
  Atom, 
  Minus, 
  Plus, 
  ArrowRight, 
  Circle, 
  Square, 
  Triangle,
  Hexagon,
  Zap,
  Type,
  RotateCcw,
  Copy,
  Trash2,
  Download,
  Upload,
  Settings,
  Eye,
  EyeOff,
  Grid3x3,
  ZoomIn,
  ZoomOut,
  Move,
  Edit3,
  Eraser,
  Paintbrush,
  Palette,
  Layers,
  BookOpen,
  Calculator,
  FileText,
  Save,
  FolderOpen,
  Pen
} from 'lucide-react';

interface MolecularDrawingToolbarProps {
  onToolSelect: (tool: string) => void;
  currentTool: string;
  onColorChange: (color: string) => void;
  currentColor: string;
  onSizeChange: (size: number) => void;
  currentSize: number;
  onTemplateSelect: (template: string) => void;
  onPropertyCalculate: () => void;
  onSaveStructure: () => void;
  onLoadStructure: () => void;
}

const MolecularDrawingToolbar: React.FC<MolecularDrawingToolbarProps> = ({
  onToolSelect,
  currentTool,
  onColorChange,
  currentColor,
  onSizeChange,
  currentSize,
  onTemplateSelect,
  onPropertyCalculate,
  onSaveStructure,
  onLoadStructure
}) => {
  const [activeSection, setActiveSection] = useState<'draw' | 'templates' | 'properties' | 'tools'>('draw');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const drawingTools = [
    { id: 'select', name: 'Select', icon: Move, description: 'Select and move objects' },
    { id: 'textbox', name: 'Text Box', icon: Type, description: 'Insert text box' },
    { id: 'bond', name: 'Bond', icon: Minus, description: 'Draw bonds' },
    { id: 'arrow', name: 'Arrow', icon: ArrowRight, description: 'Reaction arrows' },
    { id: 'ring', name: 'Ring', icon: Hexagon, description: 'Aromatic rings' },
    { id: 'text', name: 'Text', icon: Type, description: 'Add text labels' },
    { id: 'eraser', name: 'Eraser', icon: Eraser, description: 'Erase objects' },
  ];

  const templates = [
    { id: 'benzene', name: 'Benzene', formula: 'C₆H₆', description: 'Aromatic ring' },
    { id: 'methane', name: 'Methane', formula: 'CH₄', description: 'Simple alkane' },
    { id: 'ethanol', name: 'Ethanol', formula: 'C₂H₅OH', description: 'Alcohol' },
    { id: 'acetone', name: 'Acetone', formula: 'CH₃COCH₃', description: 'Ketone' },
    { id: 'glucose', name: 'Glucose', formula: 'C₆H₁₂O₆', description: 'Sugar' },
    { id: 'caffeine', name: 'Caffeine', formula: 'C₈H₁₀N₄O₂', description: 'Alkaloid' },
  ];

  const molecularProperties = [
    { name: 'Molecular Weight', value: '180.16 g/mol' },
    { name: 'Formula', value: 'C₆H₁₂O₆' },
    { name: 'SMILES', value: 'C([C@@H]1[C@H]([C@@H]([C@H](C(O1)O)O)O)O)O' },
    { name: 'LogP', value: '-2.38' },
    { name: 'H-Bond Donors', value: '5' },
    { name: 'H-Bond Acceptors', value: '6' },
  ];

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#C0C0C0', '#800000',
    '#008000', '#000080', '#808000', '#800080', '#008080', '#FFD700', '#FF6347'
  ];


  return (
    <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl w-80 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Atom size={20} />
          Molecular Drawing Studio
        </h2>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-700/50">
        {[
          { id: 'draw', label: 'Draw', icon: Pen },
          { id: 'templates', label: 'Templates', icon: BookOpen },
          { id: 'properties', label: 'Properties', icon: Calculator },
          { id: 'tools', label: 'Tools', icon: Settings }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`flex-1 p-3 flex items-center justify-center gap-2 transition-colors ${
              activeSection === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <tab.icon size={16} />
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Drawing Tools Section */}
        {activeSection === 'draw' && (
          <>
            {/* Drawing Tools */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Paintbrush size={16} className="text-blue-400" />
                Drawing Tools
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {drawingTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => onToolSelect(tool.id)}
                    className={`p-3 rounded-lg transition-all ${
                      currentTool === tool.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                    }`}
                    title={tool.description}
                  >
                    <tool.icon size={20} className="mx-auto mb-1" />
                    <div className="text-xs font-medium">{tool.name}</div>
                  </button>
                ))}
              </div>
            </div>


            {/* Color Palette */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Palette size={16} className="text-purple-400" />
                Colors
              </h3>
              <div className="grid grid-cols-7 gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => onColorChange(color)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      currentColor === color ? 'border-white shadow-lg' : 'border-slate-600'
                    }`}
                    style={{ backgroundColor: color }}
                    title={`Color: ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Brush Size */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Brush Size</h3>
              <input
                type="range"
                min="1"
                max="20"
                value={currentSize}
                onChange={(e) => onSizeChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-thumb"
              />
              <div className="text-xs text-slate-400 mt-1 text-center">{currentSize}px</div>
            </div>
          </>
        )}

        {/* Templates Section */}
        {activeSection === 'templates' && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <BookOpen size={16} className="text-orange-400" />
              Molecular Templates
            </h3>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onTemplateSelect(template.id)}
                  className="w-full p-3 bg-slate-700/50 text-left rounded-lg hover:bg-slate-600/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{template.name}</div>
                      <div className="text-slate-400 text-sm">{template.formula}</div>
                    </div>
                    <div className="text-xs text-slate-500">{template.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Properties Section */}
        {activeSection === 'properties' && (
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Calculator size={16} className="text-green-400" />
              Molecular Properties
            </h3>
            <div className="space-y-2">
              {molecularProperties.map((prop, index) => (
                <div key={index} className="p-3 bg-slate-700/30 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">{prop.name}</div>
                  <div className="text-white font-mono text-sm">{prop.value}</div>
                </div>
              ))}
            </div>
            <button
              onClick={onPropertyCalculate}
              className="w-full mt-4 p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Calculator size={16} />
              Calculate Properties
            </button>
          </div>
        )}

        {/* Tools Section */}
        {activeSection === 'tools' && (
          <div className="space-y-4">
            {/* File Operations */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-blue-400" />
                File Operations
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onSaveStructure}
                  className="p-3 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-600/50 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  <span className="text-xs">Save</span>
                </button>
                <button
                  onClick={onLoadStructure}
                  className="p-3 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-600/50 transition-colors flex items-center justify-center gap-2"
                >
                  <FolderOpen size={16} />
                  <span className="text-xs">Load</span>
                </button>
              </div>
            </div>

            {/* View Controls */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Eye size={16} className="text-purple-400" />
                View Controls
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onToolSelect('grid')}
                  className="p-3 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-600/50 transition-colors flex items-center justify-center gap-2"
                >
                  <Grid3x3 size={16} />
                  <span className="text-xs">Grid</span>
                </button>
                <button
                  onClick={() => onToolSelect('zoom')}
                  className="p-3 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-600/50 transition-colors flex items-center justify-center gap-2"
                >
                  <ZoomIn size={16} />
                  <span className="text-xs">Zoom</span>
                </button>
              </div>
            </div>

            {/* Export Options */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Download size={16} className="text-orange-400" />
                Export
              </h3>
              <div className="space-y-2">
                <button className="w-full p-2 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50 transition-colors text-xs">
                  Export as PNG
                </button>
                <button className="w-full p-2 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50 transition-colors text-xs">
                  Export as SVG
                </button>
                <button className="w-full p-2 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50 transition-colors text-xs">
                  Export as PDF
                </button>
                <button className="w-full p-2 bg-slate-700/50 text-slate-300 rounded hover:bg-slate-600/50 transition-colors text-xs">
                  Copy SMILES
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MolecularDrawingToolbar;
