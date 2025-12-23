import { Pencil, Eraser, Circle, Square, Type, Palette, Calculator } from 'lucide-react';

interface ToolbarProps {
  currentTool: string;
  onToolChange: (tool: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  onOpenCalculator?: () => void;
}

export default function Toolbar({
  currentTool,
  onToolChange,
  strokeWidth,
  onStrokeWidthChange,
  strokeColor,
  onStrokeColorChange,
  onOpenCalculator,
}: ToolbarProps) {
  const tools = [
    { id: 'pen', icon: Pencil, label: 'Pen' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'square', icon: Square, label: 'Square' },
    { id: 'text', icon: Type, label: 'Text' },
  ];

  const colors = [
    '#1e293b', // Dark slate
    '#3b82f6', // Professional blue
    '#0ea5e9', // Sky blue
    '#06b6d4', // Cyan
    '#14b8a6', // Teal
    '#64748b', // Slate gray
    '#94a3b8', // Light gray
    '#ffffff', // White
    '#000000', // Black
  ];

  const buttonStyle = (isActive: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    border: isActive ? 'none' : '1px solid #ddd',
    backgroundColor: isActive ? '#3b82f6' : '#f5f5f5',
    color: isActive ? '#fff' : '#333',
    cursor: 'pointer',
    transition: 'all 0.2s',
    padding: '0',
    fontSize: '16px',
    fontWeight: '500',
    marginRight: '4px',
  });

  const colorButtonStyle = (isSelected: boolean, color: string) => ({
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: isSelected ? '3px solid #3b82f6' : '2px solid #ddd',
    backgroundColor: color,
    cursor: 'pointer',
    transition: 'all 0.2s',
    padding: '0',
    marginRight: '4px',
    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
  });

  const dividerStyle = {
    width: '1px',
    height: '24px',
    backgroundColor: '#ddd',
    margin: '0 12px',
  };

  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    flexWrap: 'wrap' as const,
  };

  const labelStyle = {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    marginRight: '8px',
  };

  return (
    <div style={containerStyle}>
      {/* Tools */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => {
                console.log('Toolbar: Changing tool to', tool.id);
                onToolChange(tool.id);
              }}
              style={buttonStyle(currentTool === tool.id)}
              title={tool.label}
              type="button"
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div style={dividerStyle}></div>

      {/* Colors */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={labelStyle}>Color</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => {
                console.log('Toolbar: Changing color to', color);
                onStrokeColorChange(color);
              }}
              style={colorButtonStyle(strokeColor === color, color)}
              title={color}
              type="button"
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={dividerStyle}></div>

      {/* Stroke Width */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={labelStyle}>Size</span>
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => {
            console.log('Toolbar: Changing stroke width to', e.target.value);
            onStrokeWidthChange(Number(e.target.value));
          }}
          style={{
            width: '100px',
            height: '8px',
            cursor: 'pointer',
          }}
        />
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#666', minWidth: '25px' }}>
          {strokeWidth}
        </span>
      </div>

      {/* Stroke Width Preview */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: `${Math.max(strokeWidth, 4)}px`,
            height: `${Math.max(strokeWidth, 4)}px`,
            borderRadius: '50%',
            backgroundColor: strokeColor,
            border: '1px solid #ddd',
          }}
        />
      </div>

      {/* Divider */}
      <div style={dividerStyle}></div>

      {/* Calculator Button */}
      <button
        onClick={() => {
          console.log('Toolbar: Opening calculator');
          if (onOpenCalculator) {
            onOpenCalculator();
          }
        }}
        style={buttonStyle(false)}
        title="Calculator"
        type="button"
      >
        <Calculator size={18} />
      </button>
    </div>
  );
}
