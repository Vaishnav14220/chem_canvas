import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import * as lua from 'fengari/src/lua';
import * as lauxlib from 'fengari/src/lauxlib';
import * as defs from 'fengari/src/defs';
import * as lbaselib from 'fengari/src/lbaselib';
import * as lmathlib from 'fengari/src/lmathlib';
import { extractJsonBlock, generateTextContent, getApiKey } from '../services/geminiService';

type Voxel = {
  x: number;
  y: number;
  z: number;
  index: number;
  color: string;
};

type Example = {
  title: string;
  code: string;
  source?: 'built-in' | 'ai';
};

type Puzzle = {
  id: string;
  name: string;
  description: string;
  range: { min: number; max: number };
  palette: string[];
  targetFn?: (x: number, y: number, z: number) => number;
  targetVoxels?: Voxel[];
  solution?: string;
  starter: string;
  examples: Example[];
  hints: string[];
};

const PUZZLES: Puzzle[] = [
  {
    id: 'shell',
    name: 'Shell + Plinth',
    description: 'Build a room shell and a stepped plinth inside it.',
    range: { min: -3, max: 3 },
    palette: ['#000000', '#f472b6', '#94a3b8', '#60a5fa', '#22c55e'],
    targetFn: (x, y, z) => {
      const min = -3;
      const max = 3;
      if (z === min) return 2;
      if ((x === min || y === min) && z > min) return 2;
      if (x >= -1 && y >= -1 && z >= -1 && x <= 1 && y <= 1) return 1;
      if (x === 2 && y >= -1 && y <= 1 && z === -1) return 3;
      return 0;
    },
    starter: `-- Define voxel(x, y, z) to return 0 (empty) or a color index
-- Coordinates are from -3 to 3 on each axis.
function voxel(x, y, z)
  -- Example: floor
  if z == -3 then
    return 2
  end
  return 0
end`,
    examples: [
      {
        title: 'Room shell',
        source: 'built-in',
        code: `function voxel(x, y, z)
  if z == -3 then return 2 end
  if (x == -3 or y == -3) and z > -3 then return 2 end
  return 0
end`,
      },
      {
        title: 'Small platform',
        source: 'built-in',
        code: `function voxel(x, y, z)
  if z == -3 then return 2 end
  if x >= -1 and x <= 1 and y >= -1 and y <= 1 and z == -2 then return 1 end
  return 0
end`,
      },
      {
        title: 'Door frame',
        source: 'built-in',
        code: `function voxel(x, y, z)
  if z == -3 then return 2 end
  if x == -3 and z >= -2 then return 2 end
  if y == -3 and z >= -2 then return 2 end
  if x == -2 and y == -3 and z >= -1 then return 1 end
  return 0
end`,
      },
      {
        title: 'Corner pillar',
        source: 'built-in',
        code: `function voxel(x, y, z)
  if z == -3 then return 2 end
  if x == -2 and y == -2 and z >= -2 then return 3 end
  return 0
end`,
      },
    ],
    hints: [
      'Start with the floor: if z == -3 then return 2.',
      'Walls: if x == -3 or y == -3 and z > -3 then return 2.',
      'Add a small block: use a 3x3 area with x,y in [-1,1].',
    ],
  },
  {
    id: 'pyramid',
    name: 'Voxel Pyramid',
    description: 'Match a stepped pyramid centered in the room.',
    range: { min: -3, max: 3 },
    palette: ['#000000', '#f97316', '#eab308', '#22c55e', '#60a5fa'],
    targetFn: (x, y, z) => {
      const level = 3 - Math.max(Math.abs(x), Math.abs(y));
      if (z === -3) return 2;
      if (level >= 0 && z === -3 + level) return 1;
      return 0;
    },
    starter: `-- Build a pyramid. Hint: use abs(x) and abs(y)
function voxel(x, y, z)
  if z == -3 then
    return 2
  end
  return 0
end`,
    examples: [
      {
        title: 'Pyramid step',
        source: 'built-in',
        code: `function voxel(x, y, z)
  if z == -3 then return 2 end
  local level = 3 - math.max(math.abs(x), math.abs(y))
  if level >= 0 and z == -3 + level then return 1 end
  return 0
end`,
      },
      {
        title: 'Flat plateau',
        source: 'built-in',
        code: `function voxel(x, y, z)
  if z == -3 then return 2 end
  if math.abs(x) <= 2 and math.abs(y) <= 2 and z == -2 then return 1 end
  return 0
end`,
      },
      {
        title: 'Ring pyramid',
        source: 'built-in',
        code: `function voxel(x, y, z)
  if z == -3 then return 2 end
  local r = math.max(math.abs(x), math.abs(y))
  if r <= 2 and z == -2 then return 2 end
  if r <= 1 and z == -1 then return 1 end
  return 0
end`,
      },
      {
        title: 'Peak column',
        source: 'built-in',
        code: `function voxel(x, y, z)
  if z == -3 then return 2 end
  if x == 0 and y == 0 and z >= -2 then return 4 end
  return 0
end`,
      },
    ],
    hints: [
      'Use math.abs(x) and math.abs(y) to create concentric squares.',
      'Compute level = 3 - max(abs(x), abs(y)).',
      'Place a block when z == -3 + level.',
    ],
  },
];

const FALLBACK_PALETTE = ['#000000', '#f472b6', '#94a3b8', '#60a5fa', '#22c55e', '#f97316'];
const GEOGEBRA_SCRIPT_URL = 'https://www.geogebra.org/apps/deployggb.js';
const GEOGEBRA_APP_ID = 'replicubeGgb';

const normalizePalette = (palette?: string[]) => {
  const cleaned = (palette || [])
    .filter((color) => typeof color === 'string' && color.trim().length > 0)
    .map((color) => color.trim());
  const base = cleaned.length > 0 ? cleaned : FALLBACK_PALETTE.slice(1);
  const unique = Array.from(new Set(base));
  const withEmpty = unique[0] === '#000000' ? unique : ['#000000', ...unique];
  return withEmpty.slice(0, 6);
};

const normalizeRange = (range?: { min?: number; max?: number }) => {
  const min = Number.isFinite(range?.min) ? Number(range?.min) : -3;
  const max = Number.isFinite(range?.max) ? Number(range?.max) : 3;
  const clampedMin = Math.max(-6, Math.min(min, max));
  const clampedMax = Math.min(6, Math.max(max, min));
  return { min: clampedMin, max: clampedMax };
};

const normalizeExamples = (examples: any): Example[] => {
  if (!Array.isArray(examples)) return [];
  return examples
    .filter((example) => example && typeof example.code === 'string')
    .map((example, idx) => ({
      title: typeof example.title === 'string' && example.title.trim().length > 0 ? example.title.trim() : `Example ${idx + 1}`,
      code: example.code.trim(),
      source: 'ai' as const,
    }))
    .filter((example) => example.code.length > 0);
};

const normalizeHints = (hints: any): string[] => {
  if (!Array.isArray(hints)) return [];
  return hints
    .filter((hint) => typeof hint === 'string' && hint.trim().length > 0)
    .map((hint) => hint.trim())
    .slice(0, 4);
};

const toJsExpression = (expression: string) => {
  let expr = expression.trim();
  expr = expr.replace(/[\u2212\u2013\u2014]/g, '-');
  expr = expr.replace(/\s+/g, ' ');
  const fnMap: Record<string, string> = {
    sin: 'Math.sin',
    cos: 'Math.cos',
    tan: 'Math.tan',
    asin: 'Math.asin',
    acos: 'Math.acos',
    atan: 'Math.atan',
    sqrt: 'Math.sqrt',
    abs: 'Math.abs',
    floor: 'Math.floor',
    ceil: 'Math.ceil',
    min: 'Math.min',
    max: 'Math.max',
    ln: 'Math.log',
    log: 'Math.log10',
    exp: 'Math.exp',
  };
  Object.entries(fnMap).forEach(([name, jsName]) => {
    const regex = new RegExp(`\\b${name}\\s*\\(`, 'gi');
    expr = expr.replace(regex, `${jsName}(`);
  });
  expr = expr.replace(/\bpi\b/gi, 'Math.PI');
  expr = expr.replace(/\be\b/g, 'Math.E');
  expr = expr.replace(/(\d)([xyz])/gi, '$1*$2');
  expr = expr.replace(/([xyz])(\d)/gi, '$1*$2');
  expr = expr.replace(/(\))([xyz])/gi, '$1*$2');
  expr = expr.replace(/(\d)\(/g, '$1*(');
  expr = expr.replace(/([xyz])\(/gi, '$1*(');
  expr = expr.replace(/\^/g, '**');
  return expr;
};

const drawFunctionPlot = (ctx: CanvasRenderingContext2D, width: number, height: number, fn: (x: number) => number) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const gridColor = '#e5e7eb';
  const axisColor = '#6b7280';
  const plotColor = '#2563eb';
  const padding = 28;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const minX = -6;
  const maxX = 6;
  const minY = -6;
  const maxY = 6;

  const toCanvasX = (x: number) => padding + ((x - minX) / (maxX - minX)) * plotWidth;
  const toCanvasY = (y: number) => padding + plotHeight - ((y - minY) / (maxY - minY)) * plotHeight;

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = Math.ceil(minX); i <= Math.floor(maxX); i += 1) {
    const x = toCanvasX(i);
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, padding + plotHeight);
    ctx.stroke();
  }
  for (let i = Math.ceil(minY); i <= Math.floor(maxY); i += 1) {
    const y = toCanvasY(i);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(padding + plotWidth, y);
    ctx.stroke();
  }

  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(toCanvasX(0), padding);
  ctx.lineTo(toCanvasX(0), padding + plotHeight);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(padding, toCanvasY(0));
  ctx.lineTo(padding + plotWidth, toCanvasY(0));
  ctx.stroke();

  ctx.strokeStyle = plotColor;
  ctx.lineWidth = 2;
  let started = false;
  for (let px = 0; px <= plotWidth; px += 1) {
    const x = minX + (px / plotWidth) * (maxX - minX);
    const y = fn(x);
    if (!Number.isFinite(y)) {
      started = false;
      continue;
    }
    const cx = padding + px;
    const cy = toCanvasY(y);
    if (!started) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      started = true;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  if (started) ctx.stroke();
};

const getGeoGebraSize = (container?: HTMLDivElement | null) => {
  if (!container) return { width: 0, height: 0 };
  const rect = container.getBoundingClientRect();
  return {
    width: Math.max(360, Math.floor(rect.width || 0)),
    height: Math.max(360, Math.floor(rect.height || 0)),
  };
};

const ensureGeoGebraScript = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  const existing = document.querySelector(`script[src="${GEOGEBRA_SCRIPT_URL}"]`);
  if ((window as any).GGBApplet) return Promise.resolve();
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GeoGebra script failed to load.')));
    });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GEOGEBRA_SCRIPT_URL;
    script.async = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('GeoGebra script failed to load.')));
    document.body.appendChild(script);
  });
};

const toLuaExpression = (expression: string) => {
  let expr = expression.trim();
  expr = expr.replace(/[\u2212\u2013\u2014]/g, '-');
  expr = expr.replace(/\s+/g, ' ');
  const fnMap: Record<string, string> = {
    sin: 'math.sin',
    cos: 'math.cos',
    tan: 'math.tan',
    asin: 'math.asin',
    acos: 'math.acos',
    atan: 'math.atan',
    sqrt: 'math.sqrt',
    abs: 'math.abs',
    floor: 'math.floor',
    ceil: 'math.ceil',
    min: 'math.min',
    max: 'math.max',
    ln: 'math.log',
    log: 'math.log10',
    exp: 'math.exp',
  };
  Object.entries(fnMap).forEach(([name, luaName]) => {
    const regex = new RegExp(`\\b${name}\\s*\\(`, 'gi');
    expr = expr.replace(regex, `${luaName}(`);
  });
  expr = expr.replace(/\bpi\b/gi, 'math.pi');
  expr = expr.replace(/\be\b/g, 'math.exp(1)');
  expr = expr.replace(/(\d)([xyz])/gi, '$1*$2');
  expr = expr.replace(/([xyz])(\d)/gi, '$1*$2');
  expr = expr.replace(/(\))([xyz])/gi, '$1*$2');
  expr = expr.replace(/(\d)\(/g, '$1*(');
  expr = expr.replace(/([xyz])\(/gi, '$1*(');
  return expr;
};

const buildLuaSnippetFromGeoGebra = (valueString: string) => {
  const cleaned = valueString.replace(/\s+/g, ' ').trim();
  const equalsIndex = cleaned.indexOf('=');
  const rhs = equalsIndex >= 0 ? cleaned.slice(equalsIndex + 1).trim() : cleaned;
  const luaExpr = toLuaExpression(rhs || '0');
  return {
    label: cleaned,
    lines: [
      `-- GeoGebra: ${cleaned} (mapped to z height)`,
      `local zTarget = math.floor(${luaExpr})`,
      'if z == zTarget then',
      '  return 1',
      'end',
    ],
  };
};

const insertLuaSnippet = (code: string, lines: string[]) => {
  const returnRegex = /^\s*return\s+0\b/m;
  const match = code.match(returnRegex);
  const indent = match ? (match[0].match(/^(\s*)/)?.[1] || '') : '  ';
  const snippet = lines.map((line) => (line.length ? `${indent}${line}` : '')).join('\n');
  if (match && match.index !== undefined) {
    return `${code.slice(0, match.index)}${snippet}\n${code.slice(match.index)}`;
  }
  return `${code.trimEnd()}\n\n${snippet}\n`;
};

const defaultStarter = (range: { min: number; max: number }) => `-- Define voxel(x, y, z) to return 0 (empty) or a color index
-- Coordinates are from ${range.min} to ${range.max} on each axis.
function voxel(x, y, z)
  if z == ${range.min} then
    return 1
  end
  return 0
end`;

const SCENE_THEMES = {
  reference: {
    background: '#f6e8db',
    fog: '#f6e8db',
    ground: '#e2caa8',
  },
  output: {
    background: '#1b2636',
    fog: '#1b2636',
    ground: '#141c2a',
  },
};

const parseJsonFromModel = async (raw: string, schemaHint: string, model?: string) => {
  const parse = (text: string) => {
    const block = extractJsonBlock(text);
    return JSON.parse(block);
  };

  if (!raw || raw.trim().length === 0) {
    throw new Error('Gemini returned an empty response. Check your API key and model access.');
  }

  try {
    return parse(raw);
  } catch (error) {
    const repairPrompt = `Fix this JSON so it is valid and matches the schema.
Return JSON only.

Schema:
${schemaHint}

Invalid output:
${raw}`;
    const repairOptions: { maxOutputTokens: number; model?: string } = { maxOutputTokens: 1800 };
    if (model) {
      repairOptions.model = model;
    }
    const repaired = await generateTextContent(repairPrompt, repairOptions);
    if (!repaired || repaired.trim().length === 0) {
      throw new Error('Gemini returned an empty repair response. Check your API key and model access.');
    }
    try {
      return parse(repaired);
    } catch (repairError) {
      throw new Error('Gemini returned invalid JSON. Please try again.');
    }
  }
};

const buildTargetVoxels = (puzzle: Puzzle) => {
  const voxels: Voxel[] = [];
  const map = new Map<string, Voxel>();
  const sourceVoxels = puzzle.targetVoxels;
  if (sourceVoxels && sourceVoxels.length > 0) {
    sourceVoxels.forEach((voxel) => {
      const key = `${voxel.x}:${voxel.y}:${voxel.z}`;
      voxels.push(voxel);
      map.set(key, voxel);
    });
    return { voxels, map, total: voxels.length };
  }

  if (!puzzle.targetFn) {
    return { voxels, map, total: 0 };
  }

  for (let x = puzzle.range.min; x <= puzzle.range.max; x += 1) {
    for (let y = puzzle.range.min; y <= puzzle.range.max; y += 1) {
      for (let z = puzzle.range.min; z <= puzzle.range.max; z += 1) {
        const index = puzzle.targetFn(x, y, z);
        if (index > 0) {
          const color = puzzle.palette[index] || '#e2e8f0';
          const voxel = { x, y, z, index, color };
          const key = `${x}:${y}:${z}`;
          voxels.push(voxel);
          map.set(key, voxel);
        }
      }
    }
  }
  return { voxels, map, total: voxels.length };
};

const openSafeLuaLibs = (L: any) => {
  const openLib = (name: string, openFn: any) => {
    lauxlib.luaL_requiref(L, defs.to_luastring(name), openFn, 1);
    lua.lua_pop(L, 1);
  };
  openLib('_G', lbaselib.luaopen_base);
  openLib('math', lmathlib.luaopen_math);
};

const applyInstructionLimit = (L: any, limit = 200000) => {
  let count = 0;
  lua.lua_sethook(
    L,
    () => {
      count += 1;
      if (count > limit) {
        lauxlib.luaL_error(L, defs.to_luastring('Instruction limit exceeded'));
      }
    },
    lua.LUA_MASKCOUNT,
    1000
  );
};

const executeLua = (code: string, puzzle: Pick<Puzzle, 'palette' | 'range'>) => {
  const voxels: Voxel[] = [];
  let error: string | null = null;
  const L = lauxlib.luaL_newstate();
  openSafeLuaLibs(L);
  applyInstructionLimit(L);

  const wrapped = `
local _ENV = {
  math = math,
  abs = math.abs,
  sin = math.sin,
  cos = math.cos,
  min = math.min,
  max = math.max,
  floor = math.floor,
  ceil = math.ceil,
  pairs = pairs,
  ipairs = ipairs,
  tonumber = tonumber,
  tostring = tostring,
  type = type,
}

${code}

return voxel
`;

  if (lauxlib.luaL_dostring(L, defs.to_luastring(wrapped)) !== lua.LUA_OK) {
    error = defs.to_jsstring(lua.lua_tostring(L, -1));
    lua.lua_close(L);
    return { voxels, error };
  }

  if (lua.lua_type(L, -1) !== lua.LUA_TFUNCTION) {
    error = 'Define a voxel(x, y, z) function that returns a color index.';
    lua.lua_close(L);
    return { voxels, error };
  }

  lua.lua_setglobal(L, defs.to_luastring('__voxel_fn'));

  const palette = puzzle.palette;
  for (let x = puzzle.range.min; x <= puzzle.range.max; x += 1) {
    for (let y = puzzle.range.min; y <= puzzle.range.max; y += 1) {
      for (let z = puzzle.range.min; z <= puzzle.range.max; z += 1) {
        lua.lua_getglobal(L, defs.to_luastring('__voxel_fn'));
        lua.lua_pushinteger(L, x);
        lua.lua_pushinteger(L, y);
        lua.lua_pushinteger(L, z);
        if (lua.lua_pcall(L, 3, 1, 0) !== lua.LUA_OK) {
          error = defs.to_jsstring(lua.lua_tostring(L, -1));
          lua.lua_pop(L, 1);
          lua.lua_close(L);
          return { voxels, error };
        }

        const resultType = lua.lua_type(L, -1);
        let index = 0;
        if (resultType === lua.LUA_TNUMBER) {
          index = Math.floor(lua.lua_tonumber(L, -1));
        } else if (resultType === lua.LUA_TBOOLEAN) {
          index = lua.lua_toboolean(L, -1) ? 1 : 0;
        }
        lua.lua_pop(L, 1);

        if (index > 0) {
          const color = palette[index] || '#e2e8f0';
          voxels.push({ x, y, z, index, color });
        }
      }
    }
  }

  lua.lua_close(L);
  return { voxels, error };
};

const VoxelScene: React.FC<{ voxels: Voxel[]; theme?: typeof SCENE_THEMES.output }> = ({
  voxels,
  theme = SCENE_THEMES.output,
}) => {
  const isDark = theme.background === SCENE_THEMES.output.background;
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        camera={{ position: [8, 8, 8], fov: 45 }}
        className="h-full w-full"
      >
        <color attach="background" args={[theme.background]} />
        <fog attach="fog" args={[theme.fog, 10, 26]} />
        <ambientLight intensity={0.55} />
        <hemisphereLight intensity={0.35} groundColor="#0f172a" />
        <directionalLight position={[6, 10, 4]} intensity={1} castShadow />
        <directionalLight position={[-6, 4, -4]} intensity={0.5} />
        <pointLight position={[0, 10, 8]} intensity={0.35} />
        <group>
          {voxels.map((voxel, idx) => (
            <RoundedBox
              key={`${voxel.x}-${voxel.y}-${voxel.z}-${idx}`}
              position={[voxel.x, voxel.z, voxel.y]}
              args={[0.94, 0.94, 0.94]}
              radius={0.16}
              smoothness={4}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={voxel.color} roughness={0.25} metalness={0.12} />
            </RoundedBox>
          ))}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.5, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color={theme.ground} roughness={0.9} />
          </mesh>
        </group>
        <axesHelper args={[6]} />
        <OrbitControls enablePan={false} minDistance={6} maxDistance={16} />
      </Canvas>
      <div
        className={`pointer-events-none absolute right-2 top-2 rounded-md border px-2 py-1 text-[10px] uppercase tracking-wide shadow ${
          isDark
            ? 'border-slate-700 bg-slate-900/70 text-slate-100'
            : 'border-[#cbb49a] bg-white/80 text-[#3b2f25]'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-3 rounded-sm bg-[#ef4444]" />
          X
          <span className="h-2 w-3 rounded-sm bg-[#22c55e]" />
          Y
          <span className="h-2 w-3 rounded-sm bg-[#38bdf8]" />
          Z
        </div>
      </div>
    </div>
  );
};

const ReplicubeLab: React.FC = () => {
  const [customPuzzles, setCustomPuzzles] = useState<Puzzle[]>([]);
  const [aiExamplesByPuzzle, setAiExamplesByPuzzle] = useState<Record<string, Example[]>>({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState<'gemini-3-pro-preview' | 'gemini-3-flash-preview'>('gemini-3-flash-preview');
  const [aiStatus, setAiStatus] = useState<'idle' | 'examples' | 'puzzle'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const ggbContainerRef = useRef<HTMLDivElement | null>(null);
  const ggbInstanceRef = useRef<any>(null);
  const ggbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ggbReloadAttemptsRef = useRef(0);
  const editorRef = useRef<any>(null);
  const [ggbReady, setGgbReady] = useState(false);
  const [ggbError, setGgbError] = useState<string | null>(null);
  const [ggbMessage, setGgbMessage] = useState<string | null>(null);
  const [ggbLoadTick, setGgbLoadTick] = useState(0);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fallbackExpr, setFallbackExpr] = useState('sin(x)');
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const hasApiKey = Boolean(getApiKey());
  const [isGuideCollapsed, setIsGuideCollapsed] = useState(true);
  const [puzzleId, setPuzzleId] = useState(PUZZLES[0].id);
  const puzzleOptions = useMemo(() => [...PUZZLES, ...customPuzzles], [customPuzzles]);
  const puzzle = useMemo(
    () => puzzleOptions.find((item) => item.id === puzzleId) || puzzleOptions[0],
    [puzzleId, puzzleOptions]
  );
  const [luaCode, setLuaCode] = useState(puzzle.starter);
  const [luaError, setLuaError] = useState<string | null>(null);
  const [userVoxels, setUserVoxels] = useState<Voxel[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [aiHintError, setAiHintError] = useState<string | null>(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [isHintOpen, setIsHintOpen] = useState(false);
  const [showGeogebra, setShowGeogebra] = useState(false);
  const [autoRun, setAutoRun] = useState(true);
  const handleBeforeMount = useCallback((monaco: any) => {
    monaco.languages.register({ id: 'lua' });
    monaco.languages.setMonarchTokensProvider('lua', {
      keywords: [
        'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
        'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true', 'until', 'while',
      ],
      tokenizer: {
        root: [
          [/[a-zA-Z_][\\w_]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
          [/[0-9_]+/, 'number'],
          [/--.*/, 'comment'],
          [/\".*?\"/, 'string'],
          [/'[^']*'/, 'string'],
        ],
      },
    });
  }, []);

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  const targetData = useMemo(() => buildTargetVoxels(puzzle), [puzzle]);
  const puzzleExamples = useMemo(() => {
    const aiExamples = aiExamplesByPuzzle[puzzle.id] || [];
    return [...puzzle.examples, ...aiExamples];
  }, [aiExamplesByPuzzle, puzzle.examples, puzzle.id]);
  const puzzleHints = useMemo(() => {
    if (puzzle.hints.length > 0) return puzzle.hints;
    return [
      'Start with the floor: if z == min then return 1.',
      'Use abs(x) and abs(y) to shape the pattern.',
      'Build the shape one rule at a time.',
    ];
  }, [puzzle.hints]);

  const handleGeoGebraContextLost = useCallback((event: Event) => {
    event.preventDefault();
    if (ggbCanvasRef.current) {
      ggbCanvasRef.current.removeEventListener('webglcontextlost', handleGeoGebraContextLost);
      ggbCanvasRef.current = null;
    }
    if (ggbReloadAttemptsRef.current < 1) {
      ggbReloadAttemptsRef.current += 1;
      setGgbError('GeoGebra 3D lost its WebGL context. Reloading the panel...');
      setGgbReady(false);
      ggbInstanceRef.current = null;
      if (ggbContainerRef.current) {
        ggbContainerRef.current.innerHTML = '';
      }
      setGgbLoadTick((prev) => prev + 1);
      return;
    }
    setGgbError('GeoGebra 3D ran out of GPU resources. Close other 3D views or use the built-in graph.');
  }, []);

  useEffect(() => {
    if (!showGeogebra) {
      if (ggbCanvasRef.current) {
        ggbCanvasRef.current.removeEventListener('webglcontextlost', handleGeoGebraContextLost);
        ggbCanvasRef.current = null;
      }
      return;
    }
    ggbReloadAttemptsRef.current = 0;
  }, [handleGeoGebraContextLost, showGeogebra]);

  useEffect(() => {
    return () => {
      if (ggbCanvasRef.current) {
        ggbCanvasRef.current.removeEventListener('webglcontextlost', handleGeoGebraContextLost);
        ggbCanvasRef.current = null;
      }
    };
  }, [handleGeoGebraContextLost]);

  useEffect(() => {
    setLuaCode(puzzle.starter);
    setAiError(null);
    setAiHint(null);
    setAiHintError(null);
    setIsHintLoading(false);
    setIsHintOpen(false);
    setGgbError(null);
    setGgbMessage(null);
    setFallbackExpr('sin(x)');
    setFallbackError(null);
  }, [puzzle]);

  useEffect(() => {
    if (!showGeogebra) return;
    if (!ggbInstanceRef.current) {
      setGgbReady(false);
    }
    let isActive = true;
    const loadTimeout = window.setTimeout(() => {
      if (!isActive || ggbReady) return;
      setGgbError('GeoGebra did not load. Try reloading the panel.');
    }, 3000);
    const initGeoGebra = async () => {
      try {
        await ensureGeoGebraScript();
        if (!isActive) return;
        if (ggbInstanceRef.current) {
          setGgbReady(true);
          window.clearTimeout(loadTimeout);
          return;
        }
        if (!ggbContainerRef.current || !(window as any).GGBApplet) return;
        const { width, height } = getGeoGebraSize(ggbContainerRef.current);
        if (width === 0 || height === 0) {
          window.setTimeout(() => setGgbLoadTick((prev) => prev + 1), 200);
          return;
        }
        const params = {
          appName: '3d',
          id: GEOGEBRA_APP_ID,
          showToolBar: true,
          showAlgebraInput: true,
          showMenuBar: true,
          showResetIcon: true,
          enableShiftDragZoom: true,
          enableRightClick: true,
          width,
          height,
          appletOnLoad: () => {
            ggbInstanceRef.current = (window as any)[GEOGEBRA_APP_ID];
            setGgbReady(true);
            window.clearTimeout(loadTimeout);
            const attachCanvasListener = (attempt = 0) => {
              if (!ggbContainerRef.current) return;
              const canvas = ggbContainerRef.current.querySelector('canvas') as HTMLCanvasElement | null;
              if (!canvas) {
                if (attempt < 12) {
                  window.setTimeout(() => attachCanvasListener(attempt + 1), 120);
                }
                return;
              }
              if (ggbCanvasRef.current && ggbCanvasRef.current !== canvas) {
                ggbCanvasRef.current.removeEventListener('webglcontextlost', handleGeoGebraContextLost);
              }
              ggbCanvasRef.current = canvas;
              canvas.addEventListener('webglcontextlost', handleGeoGebraContextLost, { passive: false });
            };
            attachCanvasListener();
          },
        };
        const applet = new (window as any).GGBApplet(params, true);
        requestAnimationFrame(() => {
          if (!isActive) return;
          applet.inject(GEOGEBRA_APP_ID);
        });
      } catch (error: any) {
        if (!isActive) return;
        setGgbError(error?.message || 'Failed to load GeoGebra.');
      }
    };
    initGeoGebra();
    return () => {
      isActive = false;
      window.clearTimeout(loadTimeout);
    };
  }, [ggbLoadTick, ggbReady, showGeogebra]);

  useEffect(() => {
    if (!showGeogebra && editorRef.current) {
      editorRef.current.layout();
    }
  }, [showGeogebra]);

  useEffect(() => {
    if (!showGeogebra || ggbReady) return;
    const canvas = fallbackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || 640;
    const height = parent?.clientHeight || 420;
    canvas.width = width;
    canvas.height = height;
    try {
      setFallbackError(null);
      const cleaned = fallbackExpr.trim();
      if (!cleaned) {
        throw new Error('Type a function like sin(x) or x^2.');
      }
      const expr = toJsExpression(cleaned);
      const fn = new Function('x', `return ${expr};`) as (x: number) => number;
      drawFunctionPlot(ctx, width, height, fn);
    } catch (error: any) {
      setFallbackError(error?.message || 'Invalid function.');
    }
  }, [fallbackExpr, ggbReady, showGeogebra]);

  const runProgram = useCallback(() => {
    setIsRunning(true);
    const result = executeLua(luaCode, puzzle);
    setUserVoxels(result.voxels);
    setLuaError(result.error);
    setIsRunning(false);
  }, [luaCode, puzzle]);

  const requestAiHint = useCallback(async () => {
    setIsHintLoading(true);
    setAiHint(null);
    setAiHintError(null);
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('Gemini API key not found. Add it in Settings and try again.');
      }
      const prompt = `You are a concise Lua tutor for a voxel puzzle.
Puzzle: ${puzzle.name}
Goal: ${puzzle.description}
Range: ${puzzle.range.min} to ${puzzle.range.max}
Palette size: ${Math.max(puzzle.palette.length - 1, 1)}

Student code:
${luaCode}

Give 1-2 short hints. Do not provide full code.`;
      const hint = await generateTextContent(prompt, { model: 'gemini-3-flash-preview', maxOutputTokens: 180 });
      const cleaned = hint.trim();
      if (!cleaned) {
        throw new Error('No hint returned.');
      }
      setAiHint(cleaned);
    } catch (error: any) {
      setAiHintError(error?.message || 'Failed to generate hint.');
    } finally {
      setIsHintLoading(false);
    }
  }, [luaCode, puzzle.description, puzzle.name, puzzle.palette.length, puzzle.range.max, puzzle.range.min]);

  const handleInsertFromGeoGebra = useCallback(() => {
    setGgbError(null);
    setGgbMessage(null);
    const ggb = ggbInstanceRef.current || (window as any)[GEOGEBRA_APP_ID];
    if (!ggb || typeof ggb.getAllObjectNames !== 'function') {
      setGgbError('GeoGebra is not ready yet. Try again.');
      return;
    }
    const objects: string[] = ggb.getAllObjectNames() || [];
    const functionObjects = objects.filter((name) => {
      const type = ggb.getObjectType(name);
      return type === 'function' || type === 'functionNVar';
    });
    if (functionObjects.length === 0) {
      setGgbError('No functions found. Plot a function in GeoGebra first.');
      return;
    }
    const targetName = functionObjects[functionObjects.length - 1];
    const valueString = ggb.getValueString(targetName);
    if (!valueString) {
      setGgbError('Could not read the plotted function.');
      return;
    }
    const snippet = buildLuaSnippetFromGeoGebra(valueString);
    setLuaCode((prev) => insertLuaSnippet(prev, snippet.lines));
    setGgbMessage(`Inserted: ${snippet.label}`);
  }, []);

  const handleInsertFromFallback = useCallback(() => {
    setGgbError(null);
    setGgbMessage(null);
    const expr = fallbackExpr.trim();
    if (!expr) {
      setGgbError('Type a function like sin(x) or x^2 first.');
      return;
    }
    const snippet = buildLuaSnippetFromGeoGebra(`y = ${expr}`);
    setLuaCode((prev) => insertLuaSnippet(prev, snippet.lines));
    setGgbMessage(`Inserted: y = ${expr}`);
  }, [fallbackExpr]);

  const requestExamples = useCallback(async () => {
    setAiStatus('examples');
    setAiError(null);
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('Gemini API key not found. Add it in Settings and try again.');
      }
      const modelName = 'gemini-3-pro-preview';
      const buildGenOptions = (model?: string) => {
        const options: { model?: string; thinking: 'high'; maxOutputTokens: number; timeout: number } = {
          thinking: 'high',
          maxOutputTokens: 1600,
          timeout: 90000,
        };
        if (model) {
          options.model = model;
        }
        return options;
      };
      const fetchJsonWithFallback = async (promptText: string, schemaHint: string) => {
        try {
          const raw = await generateTextContent(promptText, buildGenOptions(modelName));
          return parseJsonFromModel(raw, schemaHint, modelName);
        } catch {
          const raw = await generateTextContent(promptText, buildGenOptions());
          return parseJsonFromModel(raw, schemaHint);
        }
      };
      const prompt = `You are creating Lua voxel programming examples for a puzzle.
Puzzle name: ${puzzle.name}
Puzzle description: ${puzzle.description}
Coordinate range: ${puzzle.range.min} to ${puzzle.range.max}
Palette indices: 1 to ${Math.max(puzzle.palette.length - 1, 1)}

Return JSON only with this exact schema:
{
  "examples": [
    { "title": "Short label", "code": "function voxel(x, y, z)\\n  ...\\nend" }
  ]
}

Rules:
- Provide 3-5 examples.
- Each example must define voxel(x, y, z).
- Return 0 for empty, 1+ for color index.
- Keep code short; avoid loops.
`;
      const schemaHint = `{"examples":[{"title":"Short label","code":"function voxel(x, y, z)\\n  ...\\nend"}]}`;
      let json = await fetchJsonWithFallback(prompt, schemaHint);
      let examples = normalizeExamples(json.examples);
      if (examples.length === 0) {
        const retryPrompt = `Return ONLY valid JSON (no markdown, no prose) for this schema:
${schemaHint}
Provide 3-5 examples for the puzzle "${puzzle.name}".`;
        json = await fetchJsonWithFallback(retryPrompt, schemaHint);
        examples = normalizeExamples(json.examples);
      }
      if (examples.length === 0) {
        throw new Error('No usable examples returned.');
      }
      setAiExamplesByPuzzle((prev) => {
        const existing = prev[puzzle.id] || [];
        const combined = [...existing, ...examples];
        const deduped = Array.from(new Map(combined.map((ex) => [ex.title, ex])).values());
        return { ...prev, [puzzle.id]: deduped };
      });
    } catch (error: any) {
      setAiError(error?.message || 'Failed to generate examples.');
    } finally {
      setAiStatus('idle');
    }
  }, [puzzle.description, puzzle.id, puzzle.name, puzzle.palette.length, puzzle.range.max, puzzle.range.min]);

  const requestPuzzle = useCallback(async () => {
    if (!aiPrompt.trim()) {
      setAiError('Type a topic or concept first.');
      return;
    }
    setAiStatus('puzzle');
    setAiError(null);
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('Gemini API key not found. Add it in Settings and try again.');
      }
      const buildGenOptions = (model?: string) => {
        const options: { model?: string; thinking: 'high'; maxOutputTokens: number; timeout: number } = {
          thinking: 'high',
          maxOutputTokens: 1800,
          timeout: 90000,
        };
        if (model) {
          options.model = model;
        }
        return options;
      };
      const fetchJsonWithFallback = async (promptText: string, schemaHint: string) => {
        try {
          const raw = await generateTextContent(promptText, buildGenOptions(aiModel));
          return parseJsonFromModel(raw, schemaHint, aiModel);
        } catch {
          const raw = await generateTextContent(promptText, buildGenOptions());
          return parseJsonFromModel(raw, schemaHint);
        }
      };
      const prompt = `Create a new voxel programming puzzle for students.
User goal: "${aiPrompt.trim()}"

Return JSON only with this exact schema:
{
  "name": "Short name",
  "description": "One sentence goal",
  "range": { "min": -3, "max": 3 },
  "palette": ["#hexcolor", "#hexcolor", "#hexcolor"],
  "starter": "function voxel(x, y, z)\\n  ...\\nend",
  "solution": "function voxel(x, y, z)\\n  ...\\nend",
  "examples": [
    { "title": "Short label", "code": "function voxel(x, y, z)\\n  ...\\nend" }
  ],
  "hints": ["Hint 1", "Hint 2", "Hint 3"]
}

Rules:
- Keep range within -4..4.
- Palette should list colors for indices 1..N (do not include black).
- Code must only use Lua 5.3 basics (if/then, math.*, abs, max, min).
- Solution must be valid and use color indices in the palette.
`;
      const schemaHint = `{
  "name": "Short name",
  "description": "One sentence goal",
  "range": { "min": -3, "max": 3 },
  "palette": ["#hexcolor"],
  "starter": "function voxel(x, y, z)\\n  ...\\nend",
  "solution": "function voxel(x, y, z)\\n  ...\\nend",
  "examples": [{ "title": "Short label", "code": "function voxel(x, y, z)\\n  ...\\nend" }],
  "hints": ["Hint 1"]
}`;
      const json = await fetchJsonWithFallback(prompt, schemaHint);
      const range = normalizeRange(json.range);
      const palette = normalizePalette(json.palette);
      const starter = typeof json.starter === 'string' && json.starter.trim().length > 0
        ? json.starter.trim()
        : defaultStarter(range);
      const solution = typeof json.solution === 'string' && json.solution.trim().length > 0
        ? json.solution.trim()
        : starter;
      const examples = normalizeExamples(json.examples);
      const hints = normalizeHints(json.hints);
      const targetResult = executeLua(solution, { range, palette });
      if (targetResult.error) {
        throw new Error(`AI puzzle solution error: ${targetResult.error}`);
      }
      if (targetResult.voxels.length === 0) {
        throw new Error('AI puzzle created an empty target. Try a different prompt.');
      }
      const newPuzzle: Puzzle = {
        id: `ai-${Date.now()}`,
        name: typeof json.name === 'string' && json.name.trim().length > 0 ? json.name.trim() : 'Custom Puzzle',
        description: typeof json.description === 'string' && json.description.trim().length > 0
          ? json.description.trim()
          : 'AI-generated puzzle.',
        range,
        palette,
        targetVoxels: targetResult.voxels,
        starter,
        solution,
        examples: examples.length > 0 ? examples : [
          {
            title: 'Starter idea',
            code: starter,
            source: 'ai',
          },
        ],
        hints: hints.length > 0 ? hints : [
          'Start with the floor or base rule.',
          'Use math.abs to shape the pattern.',
          'Tweak one rule at a time.',
        ],
      };
      setCustomPuzzles((prev) => [newPuzzle, ...prev]);
      setPuzzleId(newPuzzle.id);
      setLuaCode(newPuzzle.starter);
      setAiPrompt('');
    } catch (error: any) {
      setAiError(error?.message || 'Failed to generate puzzle.');
    } finally {
      setAiStatus('idle');
    }
  }, [aiModel, aiPrompt]);

  useEffect(() => {
    if (!autoRun) return;
    const handle = window.setTimeout(() => {
      runProgram();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [autoRun, runProgram]);

  const stats = useMemo(() => {
    const targetMap = targetData.map;
    let match = 0;
    let wrongColor = 0;
    let extra = 0;
    const seen = new Set<string>();
    userVoxels.forEach((voxel) => {
      const key = `${voxel.x}:${voxel.y}:${voxel.z}`;
      seen.add(key);
      const target = targetMap.get(key);
      if (target) {
        if (target.index === voxel.index) {
          match += 1;
        } else {
          wrongColor += 1;
        }
      } else {
        extra += 1;
      }
    });
    const missing = Math.max(targetData.total - match, 0);
    const percent = targetData.total ? Math.round((match / targetData.total) * 100) : 0;
    return { match, missing, extra, wrongColor, percent };
  }, [targetData, userVoxels]);

  const hintStep = useMemo(() => {
    if (stats.percent >= 85) return 2;
    if (stats.percent >= 40) return 1;
    return 0;
  }, [stats.percent]);

  return (
    <div className="flex h-full w-full bg-[#efe2d2] text-slate-100">
      <div className="flex basis-[46%] min-w-[360px] max-w-[50%] flex-col border-r border-[#d8c6b0] bg-[#f6e4cf] text-[#2f2a24]">
        <div className="border-b border-[#d8c6b0] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-end gap-2">
              <div className="font-mono text-[26px] font-black uppercase tracking-[0.35em] text-[#1c1917]">
                Repli
              </div>
              <div className="font-mono rounded-sm bg-[#facc15] px-2 py-0.5 text-[18px] font-black uppercase tracking-[0.2em] text-[#1c1917] shadow-[0_2px_0_#a16207]">
                Cube
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsGuideCollapsed((prev) => !prev)}
              className="rounded-md border border-[#d8c6b0] bg-white px-2 py-1 text-[11px] font-semibold text-[#6b5e52] hover:border-[#caa27d]"
            >
              {isGuideCollapsed ? 'Show guide' : 'Minimize'}
            </button>
          </div>
          <div className="mt-2 text-xs text-[#6b5e52]">Write Lua to match the voxel target.</div>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-[#8b7a69]">
            <div className="w-6 text-right">1</div>
            <div className="h-2 flex-1 rounded-full bg-[#f1dbc0]">
              <div
                className="h-2 rounded-full bg-[#f59e0b]"
                style={{ width: `${Math.max(stats.percent, 4)}%` }}
              />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            {puzzle.palette.slice(1).map((color, idx) => (
              <div key={`${color}-${idx}`} className="flex items-center gap-2 text-[10px] text-[#8b7a69]">
                <div className="w-4 text-right">{idx + 1}</div>
                <div className="h-3 flex-1 rounded-sm bg-[#f1dbc0]">
                  <div className="h-3 rounded-sm" style={{ width: `${80 - idx * 12}%`, background: color, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isGuideCollapsed && (
          <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#8b7a69]">Puzzle</label>
            <select
              value={puzzleId}
              onChange={(event) => setPuzzleId(event.target.value)}
              className="w-full rounded-md border border-[#d8c6b0] bg-[#fff5e6] px-3 py-2 text-sm text-[#3b2f25] focus:border-[#caa27d] focus:outline-none focus:ring-2 focus:ring-[#e9cba6]"
            >
              {puzzleOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[#6b5e52]">{puzzle.description}</p>
          </div>

          <div className="rounded-lg border border-[#d8c6b0] bg-[#fff5e6] p-3 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-[#8b7a69]">How to start</div>
            <div className="mt-2 space-y-1 text-[#5a4b3f]">
              <div>1) Return 0 for empty, 1+ for color index.</div>
              <div>2) Add floor first: z == -3.</div>
              <div>3) Build shape with simple if rules.</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#8b7a69]">Example code</div>
            <div className="flex flex-wrap gap-2">
              {puzzleExamples.map((example) => (
                <button
                  key={example.title}
                  type="button"
                  onClick={() => setLuaCode(example.code)}
                  className="rounded-full border border-[#cbb49a] bg-white px-3 py-1 text-[11px] font-semibold text-[#3b2f25] hover:bg-[#f2e4d3]"
                >
                  {example.title}
                  {example.source === 'ai' && (
                    <span className="ml-1 rounded-full border border-[#e5c79f] bg-[#fff2df] px-1 text-[9px] uppercase text-[#a16207]">
                      AI
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#d8c6b0] bg-white p-3 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-[#8b7a69]">AI Builder</div>
            <div className="mt-2 space-y-2">
              <input
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="e.g. I want to learn the exponential function"
                className="w-full rounded-md border border-[#d8c6b0] bg-[#fff5e6] px-3 py-2 text-[11px] text-[#3b2f25] focus:border-[#caa27d] focus:outline-none focus:ring-2 focus:ring-[#e9cba6]"
              />
              <div className="flex flex-wrap gap-2">
                <select
                  value={aiModel}
                  onChange={(event) => setAiModel(event.target.value as typeof aiModel)}
                  className="flex-1 rounded-md border border-[#d8c6b0] bg-[#fff5e6] px-2 py-1 text-[11px] text-[#3b2f25]"
                >
                  <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                  <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                </select>
                <button
                  type="button"
                  onClick={requestExamples}
                  disabled={aiStatus !== 'idle'}
                  className="rounded-md border border-[#cbb49a] bg-[#fff2df] px-3 py-1 text-[11px] font-semibold text-[#6b5e52] disabled:opacity-60"
                >
                  New examples
                </button>
                <button
                  type="button"
                  onClick={requestPuzzle}
                  disabled={aiStatus !== 'idle'}
                  className="rounded-md bg-[#1f7a4f] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                >
                  Create puzzle
                </button>
              </div>
              {aiStatus !== 'idle' && (
                <div className="text-[10px] text-[#8b7a69]">
                  {aiStatus === 'examples' ? 'Generating examples...' : 'Designing puzzle...'}
                </div>
              )}
              <div className="text-[10px] text-[#8b7a69]">
                Gemini key: {hasApiKey ? 'detected' : 'missing'} - Pro preview may require access.
              </div>
              {aiError && <div className="text-[10px] text-rose-700">{aiError}</div>}
            </div>
          </div>

          <div className="rounded-lg border border-[#d8c6b0] bg-[#fff5e6] p-3 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-[#8b7a69]">Hint</div>
            <div className="mt-2 text-[#5a4b3f]">{puzzleHints[Math.min(hintStep, puzzleHints.length - 1)]}</div>
            {hintStep < puzzleHints.length - 1 && (
              <div className="mt-2 text-[10px] text-[#8b7a69]">Improve match to unlock the next hint.</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-[#d8c6b0] bg-white p-3">
              <div className="text-[10px] uppercase text-[#8b7a69]">Match</div>
              <div className="text-lg font-semibold text-[#1f7a4f]">{stats.percent}%</div>
            </div>
            <div className="rounded-lg border border-[#d8c6b0] bg-white p-3">
              <div className="text-[10px] uppercase text-[#8b7a69]">Missing</div>
              <div className="text-lg font-semibold text-[#b45309]">{stats.missing}</div>
            </div>
            <div className="rounded-lg border border-[#d8c6b0] bg-white p-3">
              <div className="text-[10px] uppercase text-[#8b7a69]">Extra</div>
              <div className="text-lg font-semibold text-[#be123c]">{stats.extra}</div>
            </div>
            <div className="rounded-lg border border-[#d8c6b0] bg-white p-3">
              <div className="text-[10px] uppercase text-[#8b7a69]">Wrong Color</div>
              <div className="text-lg font-semibold text-[#3b2f25]">{stats.wrongColor}</div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#d8c6b0] bg-white px-3 py-2 text-xs">
            <span className="text-[#8b7a69]">Auto run</span>
            <button
              type="button"
              onClick={() => setAutoRun((prev) => !prev)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${autoRun ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
            >
              {autoRun ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        )}

        <div className="flex items-center justify-between border-t border-[#d8c6b0] px-4 py-2">
          <span className="text-xs uppercase text-[#8b7a69]">Lua Program</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGeogebra((prev) => !prev)}
              className="rounded-md border border-[#cbb49a] bg-white px-2 py-1 text-[11px] font-semibold text-[#5a4b3f] hover:border-[#a98d74]"
            >
              {showGeogebra ? 'Show Editor' : 'GeoGebra'}
            </button>
            {showGeogebra && (
              <button
                type="button"
                onClick={ggbReady ? handleInsertFromGeoGebra : handleInsertFromFallback}
                className="rounded-md border border-[#cbb49a] bg-white px-2 py-1 text-[11px] font-semibold text-[#5a4b3f] hover:border-[#a98d74] disabled:opacity-60"
              >
                {ggbReady ? 'Insert from GeoGebra' : 'Insert from Graph'}
              </button>
            )}
            {showGeogebra && (
              <a
                href="https://www.geogebra.org/3d"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[#cbb49a] bg-white px-2 py-1 text-[11px] font-semibold text-[#5a4b3f] hover:border-[#a98d74]"
              >
                Open GeoGebra 3D
              </a>
            )}
            <button
              type="button"
              onClick={() => setLuaCode(puzzle.starter)}
              className="rounded-md border border-[#cbb49a] px-2 py-1 text-[11px] text-[#5a4b3f] hover:border-[#a98d74]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setIsHintOpen(true);
                void requestAiHint();
              }}
              disabled={isHintLoading}
              className="rounded-md border border-[#cbb49a] bg-white px-2 py-1 text-[11px] font-semibold text-[#5a4b3f] hover:border-[#a98d74] disabled:opacity-60"
            >
              {isHintLoading ? 'Hinting...' : 'AI Hint'}
            </button>
            <button
              type="button"
              onClick={runProgram}
              className="rounded-md bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-900 disabled:opacity-60"
              disabled={isRunning}
            >
              {isRunning ? 'Running...' : 'Run'}
            </button>
          </div>
        </div>

        <div
          className="relative flex-1 border-t border-[#d8c6b0]"
          onKeyDown={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('.monaco-editor')) {
              event.stopPropagation();
            }
          }}
          onKeyUp={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('.monaco-editor')) {
              event.stopPropagation();
            }
          }}
        >
          <div className={showGeogebra ? 'hidden' : 'block h-full'}>
            <Editor
              height="100%"
              defaultLanguage="lua"
              value={luaCode}
              beforeMount={handleBeforeMount}
              onMount={handleEditorMount}
              onChange={(value) => setLuaCode(value || '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 16,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
              }}
            />
          </div>
          <div className={showGeogebra ? 'block h-full w-full' : 'hidden'}>
            <div className="relative h-full w-full bg-white">
              <div
                ref={ggbContainerRef}
                id={GEOGEBRA_APP_ID}
                className="relative z-0 h-full w-full min-h-[420px]"
              />
              {!ggbReady && (
                <div className="absolute left-3 top-3 z-10 rounded-md border border-slate-300 bg-white/90 px-2 py-1 text-[10px] text-slate-700 shadow">
                  GeoGebra not available. Using built-in graph.
                </div>
              )}
              {ggbError && (
                <div className="absolute left-3 top-10 z-10 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] text-rose-700 shadow">
                  {ggbError}
                </div>
              )}
              {!ggbReady && (
                <div className="absolute inset-0 z-10 flex flex-col gap-3 p-4">
                  <div className="rounded-md border border-[#d8c6b0] bg-white px-3 py-2 text-[11px] text-[#5a4b3f] shadow-sm">
                    Plot a function below. Example: <span className="font-semibold">sin(x)</span> or <span className="font-semibold">x^2 - 2</span>
                  </div>
                  <input
                    value={fallbackExpr}
                    onChange={(event) => setFallbackExpr(event.target.value)}
                    className="w-full rounded-md border border-[#d8c6b0] bg-white px-3 py-2 text-sm text-[#3b2f25]"
                    placeholder="sin(x)"
                  />
                  <div className="flex-1 rounded-md border border-[#d8c6b0] bg-white shadow-sm overflow-hidden">
                    <canvas ref={fallbackCanvasRef} className="h-full w-full" />
                  </div>
                  {fallbackError && (
                    <div className="text-[10px] text-rose-700">{fallbackError}</div>
                  )}
                </div>
              )}
              {!ggbReady && (
                <button
                  type="button"
                  onClick={() => {
                    setGgbError(null);
                    setGgbReady(false);
                    ggbInstanceRef.current = null;
                    if (ggbContainerRef.current) {
                      ggbContainerRef.current.innerHTML = '';
                    }
                    setGgbLoadTick((prev) => prev + 1);
                  }}
                  className="absolute left-3 bottom-3 z-10 rounded-md border border-[#d8c6b0] bg-white px-2 py-1 text-[10px] font-semibold text-[#5a4b3f] shadow hover:border-[#a98d74]"
                >
                  Retry GeoGebra
                </button>
              )}
            </div>
          </div>

          {isHintOpen && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
              <div className="w-[85%] max-w-[420px] rounded-xl border border-[#d8c6b0] bg-[#fff5e6] p-4 text-xs text-[#3b2f25] shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8b7a69]">AI Hint</div>
                  <button
                    type="button"
                    onClick={() => setIsHintOpen(false)}
                    className="rounded-full border border-[#d8c6b0] px-2 py-0.5 text-[10px] text-[#6b5e52] hover:border-[#a98d74]"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-3 whitespace-pre-wrap">
                  {isHintLoading && 'Thinking...'}
                  {!isHintLoading && aiHint && aiHint}
                  {!isHintLoading && !aiHint && aiHintError && aiHintError}
                  {!isHintLoading && !aiHint && !aiHintError && 'No hint yet. Try again.'}
                </div>
              </div>
            </div>
          )}
        </div>

        {(ggbError || ggbMessage) && !isHintOpen && (
          <div className="border-t border-[#d8c6b0] bg-[#fff5e6] px-4 py-2 text-[10px] text-[#5a4b3f]">
            {ggbMessage && <div>{ggbMessage}</div>}
            {ggbError && <div className="text-rose-700">{ggbError}</div>}
          </div>
        )}

        {luaError && (
          <div className="border-t border-rose-500/40 bg-rose-100 px-4 py-3 text-xs text-rose-800">
            {luaError}
          </div>
        )}
      </div>

      <div className="flex-1 border-l border-[#1c2636] bg-[#23334a] p-3">
        <div className="grid h-full grid-rows-2 gap-3">
          <div className="flex flex-col overflow-hidden rounded-md border border-[#cbb49a] bg-[#f6e8db]">
            <div className="flex items-center gap-2 border-b border-[#cbb49a] bg-[#ead8c3] px-2 py-1 text-[10px] uppercase tracking-wide text-[#1f2937]">
              <span className="rounded-sm bg-[#d6c3af] px-2 py-1">Reference Object</span>
              <span className="rounded-sm border border-[#cbb49a] px-2 py-1 text-[#8b7a69]">Documentation</span>
            </div>
            <div className="flex-1">
              <VoxelScene voxels={targetData.voxels} theme={SCENE_THEMES.reference} />
            </div>
          </div>
          <div className="flex flex-col overflow-hidden rounded-md border border-[#2a3b55] bg-[#1b2c44]">
            <div className="flex items-center justify-between border-b border-[#2a3b55] bg-[#1a2a40] px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300">
              <span className="rounded-sm bg-[#0f172a] px-2 py-1">Output</span>
              <span className="text-[10px] text-slate-400">Match {stats.percent}%</span>
            </div>
            <div className="relative flex-1">
              <div className="pointer-events-none absolute left-2 top-2 rounded-sm border border-[#9aa0a6] bg-[#e5e7eb] px-2 py-1 text-[10px] text-[#1f2937] shadow">
                <div className="text-[9px] font-semibold uppercase text-[#1f2937]">Comparison Results</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span>Shape Match</span>
                  <span>{stats.percent}%</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Overall Match</span>
                  <span>{stats.percent}%</span>
                </div>
              </div>
              <VoxelScene voxels={userVoxels} theme={SCENE_THEMES.output} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplicubeLab;
