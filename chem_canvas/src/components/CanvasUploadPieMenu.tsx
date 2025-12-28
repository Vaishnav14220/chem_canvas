import React, { useEffect, useMemo, useState } from 'react';
import { type LucideIcon, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type PieMenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  color?: string;
  gradientStart?: string;
  gradientEnd?: string;
  onSelect: () => void;
};

interface CanvasUploadPieMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onCenterClick: () => void;
  items: PieMenuItem[];
  centerLabel?: string;
}

const MENU_RADIUS = 120;
const INNER_RADIUS = 50;
const BUTTON_SIZE = 64;

export const CanvasUploadPieMenu: React.FC<CanvasUploadPieMenuProps> = ({
  isOpen,
  x,
  y,
  onClose,
  onCenterClick,
  items,
  centerLabel = 'Upload'
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const sectors = useMemo(() => {
    if (!items.length) return [];
    const count = items.length;
    const angleStep = 360 / count;
    const startOffset = -90 - (angleStep / 2);

    return items.map((item, index) => {
      const startAngle = startOffset + index * angleStep;
      const endAngle = startAngle + angleStep;
      const toRad = (deg: number) => (deg * Math.PI) / 180;

      const x1 = Math.cos(toRad(startAngle)) * MENU_RADIUS;
      const y1 = Math.sin(toRad(startAngle)) * MENU_RADIUS;
      const x2 = Math.cos(toRad(endAngle)) * MENU_RADIUS;
      const y2 = Math.sin(toRad(endAngle)) * MENU_RADIUS;

      const xi1 = Math.cos(toRad(startAngle)) * INNER_RADIUS;
      const yi1 = Math.sin(toRad(startAngle)) * INNER_RADIUS;
      const xi2 = Math.cos(toRad(endAngle)) * INNER_RADIUS;
      const yi2 = Math.sin(toRad(endAngle)) * INNER_RADIUS;

      const largeArc = angleStep > 180 ? 1 : 0;

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${MENU_RADIUS} ${MENU_RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${xi2} ${yi2}`,
        `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 0 ${xi1} ${yi1}`,
        'Z'
      ].join(' ');

      const midAngle = startAngle + angleStep / 2;
      const iconDist = (MENU_RADIUS + INNER_RADIUS) / 2;
      const iconX = Math.cos(toRad(midAngle)) * iconDist;
      const iconY = Math.sin(toRad(midAngle)) * iconDist;

      return { item, path: pathData, iconX, iconY };
    });
  }, [items]);

  // Determine center text
  const currentCenterLabel = useMemo(() => {
    if (hoveredId) {
      const item = items.find(i => i.id === hoveredId);
      return item ? item.label : centerLabel;
    }
    return centerLabel;
  }, [hoveredId, items, centerLabel]);

  // Determine active color
  const activeColor = useMemo(() => {
    if (hoveredId) {
      const item = items.find(i => i.id === hoveredId);
      return item?.color || '#3b82f6';
    }
    return '#64748b'; // slate-500 default
  }, [hoveredId, items]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] cursor-default"
      onMouseDown={() => onClose()}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"
      />

      <div className="absolute w-0 h-0" style={{ left: x, top: y }}>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative flex items-center justify-center"
            >
              {/* Glassmorphism Background Disc */}
              <div
                className="absolute rounded-full backdrop-blur-md border border-white/20"
                style={{
                  width: MENU_RADIUS * 2,
                  height: MENU_RADIUS * 2,
                  background: 'rgba(20, 25, 40, 0.4)', // Dark semi-transparent base
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                }}
              />

              <svg
                width={MENU_RADIUS * 2 + 4}
                height={MENU_RADIUS * 2 + 4}
                viewBox={`-${MENU_RADIUS + 2} -${MENU_RADIUS + 2} ${MENU_RADIUS * 2 + 4} ${MENU_RADIUS * 2 + 4}`}
                className="relative z-10 overflow-visible"
              >
                <defs>
                  {/* Gradient definitions for transparency */}
                  {items.map((item) => (
                    <linearGradient key={`t-grad-${item.id}`} id={`t-grad-${item.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={item.gradientStart || item.color || '#333'} stopOpacity="0.85" />
                      <stop offset="100%" stopColor={item.gradientEnd || item.color || '#111'} stopOpacity="0.5" />
                    </linearGradient>
                  ))}
                </defs>

                {sectors.map(({ item, path, iconX, iconY }) => {
                  const isHovered = hoveredId === item.id;
                  const Icon = item.icon;

                  return (
                    <g
                      key={item.id}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => { item.onSelect(); onClose(); }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Transparent Colored Sector */}
                      <motion.path
                        d={path}
                        fill={`url(#t-grad-${item.id})`}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth={isHovered ? 2 : 1}
                        initial={{ opacity: 0 }}
                        animate={{
                          opacity: 1,
                          scale: isHovered ? 1.05 : 1,
                          filter: isHovered ? 'brightness(1.2)' : 'brightness(1)'
                        }}
                        transition={{ duration: 0.15 }}
                      />

                      <foreignObject
                        x={iconX - 24}
                        y={iconY - 24}
                        width="48"
                        height="48"
                        style={{ pointerEvents: 'none' }}
                      >
                        <div className="flex items-center justify-center w-full h-full text-white">
                          <Icon
                            size={isHovered ? 28 : 24}
                            className={`drop-shadow-md transition-all duration-200 ${isHovered ? 'text-white' : 'text-white/80'}`}
                          />
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>

              {/* Center Info Circle - Semi-transparent */}
              <motion.div
                className="absolute z-20 flex flex-col items-center justify-center rounded-full text-white backdrop-blur-xl border border-white/20 overflow-hidden shadow-lg"
                style={{
                  width: INNER_RADIUS * 2 - 4,
                  height: INNER_RADIUS * 2 - 4,
                  background: hoveredId ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.1)'
                }}
                animate={{ scale: hoveredId ? 1.05 : 1 }}
              >
                <div className="relative flex items-center justify-center w-full h-full px-2 text-center">
                  {hoveredId ? (
                    <motion.div
                      key="label"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex flex-col items-center"
                    >
                      {/* Glowing dot */}
                      <div
                        className="w-1.5 h-1.5 rounded-full mb-1.5 shadow-[0_0_8px_currentColor]"
                        style={{ backgroundColor: activeColor, color: activeColor }}
                      />
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider leading-tight drop-shadow-sm"
                        style={{ color: activeColor }}
                      >
                        {currentCenterLabel}
                      </span>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="upload"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => { onCenterClick(); onClose(); }}
                      className="flex flex-col items-center gap-1 group w-full h-full justify-center"
                    >
                      <Plus size={20} className="text-white/70 group-hover:text-white transition-colors" />
                      <span className="text-[9px] font-semibold text-white/50 group-hover:text-white/90 uppercase tracking-widest">
                        {centerLabel}
                      </span>
                    </motion.button>
                  )}
                </div>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
