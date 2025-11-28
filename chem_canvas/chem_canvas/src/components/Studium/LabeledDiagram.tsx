/**
 * LabeledDiagram Component
 * 
 * Renders an educational image with SVG-based labels and arrows.
 * Since AI image generators cannot reliably render text, this component
 * takes a clean generated image and overlays positioned labels using SVG.
 */

import React, { useState, useRef, useEffect } from 'react';

interface LabelPosition {
  label: string;
  arrow_tip: { x: number; y: number };
  label_position: { x: number; y: number };
  arrow_direction: string;
}

interface LabeledDiagramProps {
  imageUrl: string;
  labelPositions: LabelPosition[];
  topic?: string;
  className?: string;
  showLabels?: boolean;
  labelStyle?: 'modern' | 'classic' | 'minimal';
  arrowColor?: string;
  labelBgColor?: string;
  labelTextColor?: string;
  onLabelClick?: (label: string) => void;
}

export const LabeledDiagram: React.FC<LabeledDiagramProps> = ({
  imageUrl,
  labelPositions,
  topic,
  className = '',
  showLabels = true,
  labelStyle = 'modern',
  arrowColor = '#1e40af',
  labelBgColor = '#ffffff',
  labelTextColor = '#1f2937',
  onLabelClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // Update dimensions when image loads or container resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [imageLoaded]);

  // Convert percentage to pixels
  const toPixelX = (percent: number) => (percent / 100) * dimensions.width;
  const toPixelY = (percent: number) => (percent / 100) * dimensions.height;

  // Generate arrow path based on direction
  const generateArrowPath = (pos: LabelPosition) => {
    const startX = toPixelX(pos.label_position.x);
    const startY = toPixelY(pos.label_position.y);
    const endX = toPixelX(pos.arrow_tip.x);
    const endY = toPixelY(pos.arrow_tip.y);

    // Calculate control point for a smooth curve
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Add slight curve based on direction
    let ctrlX = midX;
    let ctrlY = midY;

    switch (pos.arrow_direction) {
      case 'up':
      case 'down':
        ctrlX = startX;
        break;
      case 'left':
      case 'right':
        ctrlY = startY;
        break;
      default:
        // For diagonal directions, use a slight offset
        ctrlX = midX + (endX - startX) * 0.2;
        ctrlY = midY + (endY - startY) * 0.2;
    }

    return `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`;
  };

  // Generate arrowhead marker
  const ArrowHead = () => (
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon
          points="0 0, 10 3.5, 0 7"
          fill={arrowColor}
        />
      </marker>
      <marker
        id="arrowhead-hover"
        markerWidth="12"
        markerHeight="8"
        refX="11"
        refY="4"
        orient="auto"
      >
        <polygon
          points="0 0, 12 4, 0 8"
          fill="#3b82f6"
        />
      </marker>
      {/* Drop shadow filter */}
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="3" floodOpacity="0.3"/>
      </filter>
    </defs>
  );

  // Get style for label box based on labelStyle prop
  const getLabelBoxStyle = (isHovered: boolean) => {
    const baseStyle = {
      fill: isHovered ? '#3b82f6' : labelBgColor,
      stroke: isHovered ? '#1d4ed8' : arrowColor,
      strokeWidth: isHovered ? 2 : 1.5,
    };

    switch (labelStyle) {
      case 'classic':
        return { ...baseStyle, rx: 2, ry: 2 };
      case 'minimal':
        return { ...baseStyle, fill: 'transparent', stroke: 'transparent' };
      case 'modern':
      default:
        return { ...baseStyle, rx: 6, ry: 6 };
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative inline-block ${className}`}
      style={{ maxWidth: '100%' }}
    >
      {/* Base Image */}
      <img
        src={imageUrl}
        alt={topic || 'Educational diagram'}
        className="w-full h-auto block"
        onLoad={() => setImageLoaded(true)}
        style={{ display: imageLoaded ? 'block' : 'none' }}
      />

      {/* Loading placeholder */}
      {!imageLoaded && (
        <div className="w-full h-64 bg-gray-100 animate-pulse flex items-center justify-center">
          <span className="text-gray-500">Loading diagram...</span>
        </div>
      )}

      {/* SVG Overlay for Labels */}
      {imageLoaded && showLabels && dimensions.width > 0 && (
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ width: dimensions.width, height: dimensions.height }}
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        >
          <ArrowHead />

          {labelPositions.map((pos, index) => {
            const isHovered = hoveredLabel === pos.label;
            const labelX = toPixelX(pos.label_position.x);
            const labelY = toPixelY(pos.label_position.y);
            
            // Estimate label box dimensions
            const textLength = pos.label.length * 7 + 16;
            const boxHeight = 28;
            const boxX = labelX - textLength / 2;
            const boxY = labelY - boxHeight / 2;

            return (
              <g 
                key={index}
                className="pointer-events-auto cursor-pointer"
                onMouseEnter={() => setHoveredLabel(pos.label)}
                onMouseLeave={() => setHoveredLabel(null)}
                onClick={() => onLabelClick?.(pos.label)}
                style={{ transition: 'all 0.2s ease' }}
              >
                {/* Arrow/Line */}
                <path
                  d={generateArrowPath(pos)}
                  fill="none"
                  stroke={isHovered ? '#3b82f6' : arrowColor}
                  strokeWidth={isHovered ? 2.5 : 2}
                  markerEnd={isHovered ? 'url(#arrowhead-hover)' : 'url(#arrowhead)'}
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* Label background */}
                <rect
                  x={boxX}
                  y={boxY}
                  width={textLength}
                  height={boxHeight}
                  {...getLabelBoxStyle(isHovered)}
                  filter={labelStyle !== 'minimal' ? 'url(#shadow)' : undefined}
                  style={{ transition: 'all 0.2s ease' }}
                />

                {/* Label text */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isHovered ? '#ffffff' : labelTextColor}
                  fontSize="13"
                  fontWeight={isHovered ? '600' : '500'}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  style={{ 
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                  }}
                >
                  {pos.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* Toggle labels button */}
      <button
        className="absolute bottom-2 right-2 bg-white/90 hover:bg-white px-3 py-1.5 rounded-lg shadow-md text-sm font-medium text-gray-700 flex items-center gap-1.5 transition-all"
        onClick={(e) => {
          e.stopPropagation();
          // This would need to be controlled by parent
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        {labelPositions.length} Labels
      </button>
    </div>
  );
};

// Simpler version that uses the data directly from the API response
export const LabeledEducationalImage: React.FC<{
  imageUrl: string;
  labels?: { label_text: string; arrow_target: string }[];
  labelPositions?: LabelPosition[];
  topic?: string;
  className?: string;
}> = ({ imageUrl, labels, labelPositions, topic, className }) => {
  // If labelPositions are not provided but labels are, create fallback positions
  const positions = labelPositions || (labels?.map((l, i, arr) => {
    const angle = (i / arr.length) * 2 * Math.PI - Math.PI / 2;
    const radius = 40;
    return {
      label: l.label_text,
      arrow_tip: { 
        x: 50 + 20 * Math.cos(angle), 
        y: 50 + 20 * Math.sin(angle) 
      },
      label_position: { 
        x: 50 + radius * Math.cos(angle), 
        y: 50 + radius * Math.sin(angle) 
      },
      arrow_direction: 'auto'
    };
  }) || []);

  return (
    <LabeledDiagram
      imageUrl={imageUrl}
      labelPositions={positions}
      topic={topic}
      className={className}
    />
  );
};

export default LabeledDiagram;
