import { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Copy, RotateCw } from 'lucide-react';

interface ResizeToolbarProps {
  selectedShape: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    rotation?: number;
  } | null;
  onResize: (width: number, height: number) => void;
  onRotate: (angle: number) => void;
}

export default function ResizeToolbar({ selectedShape, onResize, onRotate }: ResizeToolbarProps) {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    if (selectedShape) {
      const w = Math.abs(selectedShape.endX - selectedShape.startX);
      const h = Math.abs(selectedShape.endY - selectedShape.startY);
      setWidth(Math.round(w));
      setHeight(Math.round(h));
      setRotation(selectedShape.rotation || 0);
      setAspectRatio(w / h || 1);
    }
  }, [selectedShape]);

  const handleWidthChange = (newWidth: number) => {
    setWidth(newWidth);
    const newHeight = newWidth / aspectRatio;
    setHeight(Math.round(newHeight));
    onResize(newWidth, Math.round(newHeight));
  };

  const handleHeightChange = (newHeight: number) => {
    setHeight(newHeight);
    const newWidth = newHeight * aspectRatio;
    setWidth(Math.round(newWidth));
    onResize(Math.round(newWidth), newHeight);
  };

  const handleRotationChange = (newRotation: number) => {
    setRotation(newRotation);
    onRotate(newRotation);
  };

  if (!selectedShape) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-t border-slate-700 px-4 py-3 space-y-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-slate-300 min-w-20">Resize:</span>
        
        {/* Width Slider */}
        <div className="flex items-center gap-2 flex-1">
          <Maximize2 size={16} className="text-cyan-400" />
          <input
            type="range"
            min="20"
            max="600"
            value={width}
            onChange={(e) => handleWidthChange(Number(e.target.value))}
            className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <span className="text-xs text-slate-400 w-12">{width}px</span>
        </div>

        {/* Height Slider */}
        <div className="flex items-center gap-2 flex-1">
          <Minimize2 size={16} className="text-blue-400" />
          <input
            type="range"
            min="20"
            max="600"
            value={height}
            onChange={(e) => handleHeightChange(Number(e.target.value))}
            className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span className="text-xs text-slate-400 w-12">{height}px</span>
        </div>

        {/* Rotation Slider */}
        <div className="flex items-center gap-2 flex-1">
          <RotateCw size={16} className="text-purple-400" />
          <input
            type="range"
            min="0"
            max="360"
            value={rotation}
            onChange={(e) => handleRotationChange(Number(e.target.value))}
            className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <span className="text-xs text-slate-400 w-12">{rotation}°</span>
        </div>
      </div>

      {/* Preset Sizes */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-300">Presets:</span>
        <button
          onClick={() => handleWidthChange(100)}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded transition"
        >
          Small
        </button>
        <button
          onClick={() => handleWidthChange(200)}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded transition"
        >
          Medium
        </button>
        <button
          onClick={() => handleWidthChange(350)}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded transition"
        >
          Large
        </button>
        <button
          onClick={() => handleWidthChange(500)}
          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 rounded transition"
        >
          Extra Large
        </button>
      </div>

      {/* Info */}
      <div className="text-xs text-slate-400 flex gap-4">
        <span>📏 Width: {width}px × Height: {height}px</span>
        <span>🔄 Rotation: {rotation}°</span>
      </div>
    </div>
  );
}
