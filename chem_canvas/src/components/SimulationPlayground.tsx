import React, { useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Play, Pause, RotateCcw, Settings2, Sparkles, Brain, Palette, Layout, Cpu, Layers, 
  Send, Eye, Code2, FileCode, Loader2, Info, Upload, FileText, X, Gamepad2, Film, 
  ChevronRight, MousePointer, Move3D, ZoomIn, RotateCw, Hand, ArrowLeft, Zap, 
  MessageCircle, Search, Database, CheckCircle, AlertCircle, Clock, Wand2, ImagePlus,
  Box, ShieldCheck, FlaskConical
} from 'lucide-react';
import {
  runSimulationPipeline,
  subscribeToSimulationEvents,
  getSimulationArtifacts,
  type SimulationTaskEvent,
  type SimulationRequest,
  type SimulationOutput,
} from '../services/simulationAgentService';
import {
  runDeepSimulationPipeline,
  subscribeToDeepAgentEvents,
  getDeepSimulationArtifacts,
  type DeepAgentEvent,
  type DeepSimulationRequest,
  type DeepSimulationOutput,
  type GradeLevel,
  GRADE_LEVEL_LABELS,
  SUBAGENTS,
} from '../services/deepSimulationService';
import { addFileToSourceLibrary } from '../utils/sourceLibrary';
import { View } from '../types/studium';
import { InteractiveCanvas } from './Studium/InteractiveCanvas';
import { ChatInterface } from './Studium/ChatInterface';
import { ImageAnalyzer } from './Studium/ImageAnalyzer';
import { BookOpen, MessageSquare, Image as ImageIcon } from 'lucide-react';

// Built-in fallback simulation HTML shown when no AI-generated simulation exists.
const FALLBACK_SIMULATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>sp3 Hybridization - Demo Lab</title>
  <style>
    :root {
      --bg: radial-gradient(circle at 20% 20%, #f8fafc, #eef2ff 45%, #f8fafc 80%);
      --panel: rgba(255, 255, 255, 0.78);
      --border: rgba(148, 163, 184, 0.35);
      --text: #0f172a;
      --muted: #475569;
      --accent: #7c3aed;
      --glow: 0 12px 40px rgba(124, 58, 237, 0.25);
      --shadow: 0 18px 60px rgba(15, 23, 42, 0.12);
    }
    * { box-sizing: border-box; }
    body, html { margin: 0; height: 100%; font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); overflow: hidden; }
    #app { position: relative; width: 100%; height: 100%; }
    #canvas { position: absolute; inset: 0; }
    .card {
      position: absolute;
      backdrop-filter: blur(10px);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: var(--shadow);
    }
    #info { top: 18px; left: 18px; width: 240px; padding: 16px 18px; }
    #measure { top: 18px; right: 18px; width: 220px; padding: 16px 18px; text-align: right; }
    .eyebrow { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; color: var(--muted); margin: 0 0 6px 0; }
    #info-title { margin: 0 0 6px 0; font-size: 16px; font-weight: 700; }
    #info-detail { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
    #measure-values div { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; color: var(--muted); }
    #measure-values span:last-child { color: var(--text); font-weight: 700; }
    #headline { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; }
    .pill { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); background: rgba(255,255,255,0.8); box-shadow: 0 10px 30px rgba(124,58,237,0.18); font-weight: 700; color: #111827; }
    .badge { padding: 7px 12px; border-radius: 999px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16,185,129,0.35); color: #065f46; font-weight: 700; font-size: 12px; }
    #control-bar {
      bottom: 24px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 12px; padding: 10px 14px;
      background: rgba(15, 23, 42, 0.7); color: #e2e8f0;
      border: 1px solid rgba(255,255,255,0.08); box-shadow: var(--shadow);
    }
    #control-bar button {
      border: none; background: rgba(255,255,255,0.08); color: #e2e8f0;
      border-radius: 12px; padding: 10px 12px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 8px; font-weight: 600;
      transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    }
    #control-bar button:hover { transform: translateY(-2px); background: rgba(255,255,255,0.14); box-shadow: var(--glow); }
    #control-bar label { font-size: 12px; color: #cbd5e1; display: flex; align-items: center; gap: 6px; }
    #control-bar input[type="range"] { width: 140px; accent-color: #f472b6; }
    #legend { position: absolute; bottom: 24px; right: 18px; padding: 12px 14px; width: 220px; color: #0f172a; }
    #legend h4 { margin: 0 0 8px 0; font-size: 13px; color: #111827; }
    #legend .row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; color: #475569; }
    .dot { width: 10px; height: 10px; border-radius: 999px; }
    #cta { position: absolute; right: 18px; top: 120px; padding: 10px 12px; font-size: 12px; color: #1e293b; border-left: 3px solid #7c3aed; background: rgba(255,255,255,0.9); border-radius: 10px; box-shadow: var(--shadow); }
    canvas { display: block; outline: none; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/controls/OrbitControls.js": "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js"
      }
    }
  </script>
</head>
<body>
  <div id="app">
    <div id="headline">
      <div class="pill">Investigating sp3 Hybridization</div>
      <div class="badge">Demo simulation</div>
    </div>
    <div id="info" class="card">
      <p class="eyebrow">Selected Component</p>
      <h3 id="info-title">Hover or click an atom</h3>
      <p id="info-detail">Rotate the view to explore the tetrahedral geometry and the four sp3 orbitals.</p>
    </div>
    <div id="measure" class="card">
      <p class="eyebrow">Measurements</p>
      <div id="measure-values">
        <div><span class="muted">Bond length</span><span id="bond-length">~1.09 Å</span></div>
        <div><span class="muted">Bond angle</span><span id="bond-angle">109.5°</span></div>
      </div>
    </div>
    <div id="canvas"></div>
    <div id="control-bar" class="card">
      <button id="play" aria-label="Play or pause">
        <span id="play-icon">⏸</span>
        <span id="play-label">Pause</span>
      </button>
      <button id="reset" aria-label="Reset view">↻ Reset</button>
      <label for="speed">Rotation
        <input id="speed" type="range" min="0" max="1.5" value="0.6" step="0.01" />
      </label>
      <label><input id="orbitals-toggle" type="checkbox" checked /> Show orbitals</label>
    </div>
    <div id="legend" class="card">
      <h4>Quick guide</h4>
      <div class="row"><span class="dot" style="background:#2563eb"></span><span>Carbon (sp3 center)</span></div>
      <div class="row"><span class="dot" style="background:#f8fafc; border:1px solid #cbd5e1"></span><span>Hydrogen</span></div>
      <div class="row"><span class="dot" style="background:#a855f7"></span><span>Hybrid orbital lobe</span></div>
      <div class="row"><span class="dot" style="background:#22d3ee"></span><span>Phase ring</span></div>
    </div>
    <div id="cta">Tip: left click + drag to orbit · scroll to zoom</div>
  </div>
  <script type="module">
    import * as THREE from "three";
    import { OrbitControls } from "three/addons/controls/OrbitControls.js";

    const host = document.getElementById("canvas");
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f7f9fc");

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(6, 4, 8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controls.minDistance = 2;
    controls.maxDistance = 20;

    const resize = () => {
      const { clientWidth, clientHeight } = host;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    resize();
    window.addEventListener("resize", resize);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xdfe7ff, 0.7);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(6, 8, 5);
    dir.castShadow = true;
    scene.add(dir);

    const grid = new THREE.GridHelper(16, 16, "#e2e8f0", "#e2e8f0");
    grid.position.y = -2;
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
    scene.add(grid);

    const group = new THREE.Group();
    scene.add(group);

    const interactive = [];
    const orbitalMeshes = [];

    const carbon = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 48, 48),
      new THREE.MeshStandardMaterial({ color: "#2563eb", metalness: 0.6, roughness: 0.35 })
    );
    carbon.castShadow = true;
    carbon.receiveShadow = true;
    carbon.name = "Carbon (sp3 center)";
    carbon.userData = {
      label: "Carbon (sp3 center)",
      detail: "Central atom with four equivalent sp3 orbitals forming sigma bonds.",
      color: "#2563eb",
    };
    group.add(carbon);
    interactive.push(carbon);

    const positions = [
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(-1, -1, 1),
      new THREE.Vector3(-1, 1, -1),
      new THREE.Vector3(1, -1, -1),
    ];

    const bondMaterial = new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.6, roughness: 0.25 });
    positions.forEach((dirVec, idx) => {
      const dirNorm = dirVec.clone().normalize();
      const bondEnd = dirNorm.clone().multiplyScalar(2.8);

      const hydrogen = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 32, 32),
        new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.25, metalness: 0.1 })
      );
      hydrogen.position.copy(bondEnd);
      hydrogen.castShadow = true;
      hydrogen.name = "Hydrogen " + (idx + 1);
      hydrogen.userData = {
        label: "Hydrogen " + (idx + 1),
        detail: "Terminal atom completing the sigma bond.",
        color: "#0f172a",
      };
      group.add(hydrogen);
      interactive.push(hydrogen);

      const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, bondEnd.length(), 24), bondMaterial);
      bond.position.copy(bondEnd.clone().multiplyScalar(0.5));
      bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bondEnd.clone().normalize());
      bond.castShadow = true;
      group.add(bond);

      const lobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 48, 48),
        new THREE.MeshStandardMaterial({
          color: "#a855f7",
          emissive: "#a855f7",
          emissiveIntensity: 0.35,
          transparent: true,
          opacity: 0.35,
        })
      );
      lobe.position.copy(dirNorm.clone().multiplyScalar(1.35));
      lobe.scale.set(1.2, 1.6, 1.2);
      lobe.lookAt(dirNorm);
      lobe.name = "Orbital " + (idx + 1);
      lobe.userData = {
        label: "sp3 Orbital " + (idx + 1),
        detail: "Hybrid orbital oriented toward a tetrahedral corner.",
        color: "#a855f7",
      };
      group.add(lobe);
      interactive.push(lobe);
      orbitalMeshes.push(lobe);

      const phase = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.03, 16, 64),
        new THREE.MeshStandardMaterial({
          color: "#22d3ee",
          emissive: "#22d3ee",
          emissiveIntensity: 0.2,
          transparent: true,
          opacity: 0.5,
        })
      );
      phase.position.copy(dirNorm.clone().multiplyScalar(1.75));
      phase.rotation.x = Math.random() * Math.PI;
      phase.rotation.y = Math.random() * Math.PI;
      group.add(phase);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let selected = null;
    const infoTitle = document.getElementById("info-title");
    const infoDetail = document.getElementById("info-detail");
    const bondLengthLabel = document.getElementById("bond-length");

    const setInfo = (obj?: THREE.Object3D) => {
      if (!obj) {
        infoTitle.textContent = "Hover or click an atom";
        infoDetail.textContent = "Rotate the view to explore the tetrahedral geometry and the four sp3 orbitals.";
        bondLengthLabel.textContent = "~1.09 A";
        return;
      }
      const data = obj.userData || {};
      infoTitle.textContent = data.label || obj.name;
      infoDetail.textContent = data.detail || "Interactive component selected.";
      if (obj !== carbon) {
        const dist = obj.position.length().toFixed(2);
        bondLengthLabel.textContent = dist + " A";
      }
    };

    const updatePointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    host.addEventListener("pointermove", (event) => {
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactive, false)[0];
      if (hit) {
        document.body.style.cursor = "pointer";
      } else {
        document.body.style.cursor = "default";
      }
    });

    host.addEventListener("click", (event) => {
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(interactive, false)[0];
      if (hit) {
        selected = hit.object;
        setInfo(selected);
      }
    });

    let playing = true;
    let rotationSpeed = 0.6;
    const clock = new THREE.Clock();

    const playBtn = document.getElementById("play");
    const playIcon = document.getElementById("play-icon");
    const playLabel = document.getElementById("play-label");
    playBtn.addEventListener("click", () => {
      playing = !playing;
      playIcon.textContent = playing ? "⏸" : "▶";
      playLabel.textContent = playing ? "Pause" : "Play";
    });

    const resetBtn = document.getElementById("reset");
    resetBtn.addEventListener("click", () => {
      group.rotation.set(0, 0, 0);
      controls.reset();
      controls.target.set(0, 0, 0);
      controls.update();
      setInfo();
      selected = null;
    });

    const speedInput = document.getElementById("speed");
    speedInput.addEventListener("input", () => {
      rotationSpeed = parseFloat(speedInput.value);
    });

    const orbitalsToggle = document.getElementById("orbitals-toggle");
    orbitalsToggle.addEventListener("change", () => {
      orbitalMeshes.forEach((o) => (o.visible = orbitalsToggle.checked));
    });

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (playing) {
        group.rotation.y += delta * rotationSpeed;
        orbitalMeshes.forEach((lobe, i) => {
          const pulse = 1 + Math.sin(clock.elapsedTime * 2 + i) * 0.06;
          lobe.scale.set(1.2 * pulse, 1.6 * pulse, 1.2 * pulse);
        });
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  </script>
</body>
</html>`;
// Simulation tab type
type SimulationTab = 'tutorial' | 'interactive';

// Deep Agent Mode toggle
type AgentMode = 'classic' | 'deep';

// ============================================
// CUSTOM NODE STYLES - React Flow Landing Style
// ============================================

// Agent Status Type
type AgentStatus = 'idle' | 'thinking' | 'working' | 'running' | 'completed' | 'error';

// Agent Node Component - Represents each agent in the swarm
const AgentNode: React.FC<NodeProps> = ({ data, selected }) => {
  const statusColors: Record<AgentStatus, string> = {
    idle: 'bg-gray-100 border-gray-200',
    thinking: 'bg-violet-50 border-violet-300 animate-pulse',
    working: 'bg-blue-50 border-blue-300',
    running: 'bg-blue-50 border-blue-300 animate-pulse',
    completed: 'bg-green-50 border-green-300',
    error: 'bg-red-50 border-red-300',
  };

  const statusDotColors: Record<AgentStatus, string> = {
    idle: 'bg-gray-400',
    thinking: 'bg-violet-500 animate-pulse',
    working: 'bg-blue-500 animate-spin',
    running: 'bg-blue-500 animate-ping',
    completed: 'bg-green-500',
    error: 'bg-red-500',
  };

  const statusLabels: Record<AgentStatus, string> = {
    idle: 'Waiting',
    thinking: '🧠 Thinking...',
    working: '⚙️ Working...',
    running: '🔄 Processing...',
    completed: '✓ Done',
    error: '✗ Error',
  };

  const IconComponent = data.icon;
  const status: AgentStatus = data.status || 'idle';

  return (
    <div
      className={`rounded-2xl shadow-lg border-2 transition-all duration-300 ${statusColors[status]} ${selected ? 'ring-2 ring-pink-400 ring-offset-2' : ''
        }`}
      style={{ minWidth: 240, padding: '20px 24px' }}
    >
      {data.hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !shadow-md"
          style={{ left: -6 }}
        />
      )}

      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${data.iconBg || 'bg-gradient-to-br from-pink-500 to-purple-500'} ${status === 'thinking' || status === 'working' ? 'animate-pulse' : ''}`}>
          {IconComponent && <IconComponent className="w-6 h-6 text-white" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-800">{data.label}</h3>
            <div className={`w-2 h-2 rounded-full ${statusDotColors[status]}`} />
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{data.role}</p>
          {status !== 'idle' && (
            <p className={`text-xs mt-1 font-medium ${status === 'completed' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
              {statusLabels[status]}
            </p>
          )}
        </div>
      </div>

      {data.message && (
        <div className={`mt-3 px-3 py-2 rounded-lg border ${status === 'thinking' ? 'bg-violet-50/60 border-violet-200' : 'bg-white/60 border-white/40'}`}>
          <p className="text-xs text-gray-600 italic flex items-center gap-1">
            {status === 'thinking' && <MessageCircle className="w-3 h-3 text-violet-500" />}
            {data.message}
          </p>
        </div>
      )}

      {/* Progress bar for working state */}
      {(status === 'working' || status === 'running') && (
        <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-400 to-purple-500 animate-progress-indeterminate" />
        </div>
      )}

      {data.hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !shadow-md"
          style={{ right: -6 }}
        />
      )}
    </div>
  );
};

// Grade Level Options for dropdown
const gradeLevelOptions: { value: GradeLevel; label: string }[] = [
  { value: 'elementary', label: '🎨 Elementary (K-5)' },
  { value: 'middle-school', label: '📚 Middle School (6-8)' },
  { value: 'high-school', label: '🔬 High School (9-12)' },
  { value: 'undergraduate', label: '🎓 Undergraduate' },
  { value: 'graduate', label: '🔬 Graduate' },
];

// Input Node - Topic/Request Input with Grade Selector
const TopicInputNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 ${selected ? 'border-pink-400 shadow-pink-100' : 'border-gray-100'
        }`}
      style={{ minWidth: 300, padding: '20px 24px' }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Simulation Request</h3>
          <p className="text-xs text-gray-500">What do you want to visualize?</p>
        </div>
      </div>

      {/* Grade Level Selector */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          📊 Grade Level
        </label>
        <select
          value={data.gradeLevel || 'high-school'}
          onChange={(e) => data.onGradeLevelChange?.(e.target.value as GradeLevel)}
          className="w-full px-3 py-2 text-sm text-gray-800 bg-gradient-to-r from-violet-50 to-pink-50 border border-gray-200 rounded-xl focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 cursor-pointer"
        >
          {gradeLevelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Topic Input */}
      <textarea
        value={data.value || ''}
        onChange={(e) => data.onChange?.(e.target.value)}
        placeholder="e.g., Atomic orbital visualization, Chemical bonding animation..."
        className="w-full h-20 px-3 py-2 text-sm text-black border border-gray-200 rounded-xl resize-none focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
      />

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-orange-400 !border-2 !border-white !shadow-md"
        style={{ right: -6 }}
      />
    </div>
  );
};

// Output Node - Final Simulation Preview
const SimulationOutputNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 ${selected ? 'border-pink-400 shadow-pink-100' : 'border-gray-100'
        }`}
      style={{ minWidth: 300, minHeight: 220, padding: '20px 24px' }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white !shadow-md"
        style={{ left: -6 }}
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
          <Eye className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">Simulation Output</h3>
          <p className="text-xs text-gray-500">Interactive 3D visualization</p>
        </div>
      </div>

      <div className="h-32 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center overflow-hidden relative">
        {data.status === 'ready' && data.htmlContent ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => data.onPreview?.()}
              className="px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-400 transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View Simulation
            </button>
          </div>
        ) : data.status === 'generating' ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
            <span className="text-xs text-gray-400">Generating...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <FileCode className="w-8 h-8 opacity-50" />
            <span className="text-xs">Awaiting generation</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Artifact Node - Shows generated artifacts
const ArtifactNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 ${selected ? 'border-pink-400 shadow-pink-100' : 'border-gray-100'
        }`}
      style={{ minWidth: 200, padding: '16px 20px' }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white !shadow-md"
        style={{ left: -5 }}
      />

      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.iconBg || 'bg-blue-100'}`}>
          <Code2 className={`w-4 h-4 ${data.iconColor || 'text-blue-600'}`} />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-700">{data.label}</h4>
          <p className="text-xs text-gray-400">{data.lines || 0} lines</p>
        </div>
      </div>

      {data.preview && (
        <div className="mt-2 p-2 bg-gray-50 rounded-lg">
          <code className="text-xs text-gray-600 line-clamp-2">{data.preview}</code>
        </div>
      )}
    </div>
  );
};

// Node Types Registration
const nodeTypes = {
  agent: AgentNode,
  topicInput: TopicInputNode,
  simulationOutput: SimulationOutputNode,
  artifact: ArtifactNode,
};

// Initial Agent Workflow Nodes - Enhanced Deep Agents (8 Agents)
const createInitialNodes = (
  topic: string,
  gradeLevel: GradeLevel,
  onTopicChange: (value: string) => void,
  onGradeLevelChange: (value: GradeLevel) => void,
  onPreview: () => void,
  outputStatus: 'idle' | 'generating' | 'ready',
  htmlContent: string | null,
  agentStatuses: Record<string, AgentStatus>,
  agentMessages: Record<string, string>
): Node[] => [
    // Input Node
    {
      id: 'input',
      type: 'topicInput',
      position: { x: 30, y: 280 },
      data: {
        value: topic,
        gradeLevel: gradeLevel,
        onChange: onTopicChange,
        onGradeLevelChange: onGradeLevelChange,
      },
    },
    // ===== ROW 1: Initial Processing =====
    // Prompt Enhancer Agent
    {
      id: 'promptEnhancer',
      type: 'agent',
      position: { x: 280, y: 180 },
      data: {
        label: '✨ Prompt Enhancer',
        role: 'Educational Structuring',
        icon: Wand2,
        iconBg: 'bg-gradient-to-br from-fuchsia-500 to-pink-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.promptEnhancer || 'idle',
        message: agentMessages.promptEnhancer,
      },
    },
    // Grounding Researcher Agent
    {
      id: 'groundingResearcher',
      type: 'agent',
      position: { x: 280, y: 380 },
      data: {
        label: '🔬 Grounding Researcher',
        role: 'Scientific Grounding & Search',
        icon: FlaskConical,
        iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.groundingResearcher || 'idle',
        message: agentMessages.groundingResearcher,
      },
    },
    // ===== ROW 2: Design & Images =====
    // Planner Agent
    {
      id: 'planner',
      type: 'agent',
      position: { x: 560, y: 120 },
      data: {
        label: '🎯 Planner',
        role: 'Architecture & Specification',
        icon: Brain,
        iconBg: 'bg-gradient-to-br from-indigo-500 to-violet-600',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.planner || 'idle',
        message: agentMessages.planner,
      },
    },
    // Image Generator Agent (Nano Banana)
    {
      id: 'imageGenerator',
      type: 'agent',
      position: { x: 560, y: 280 },
      data: {
        label: '🖼️ Image Generator',
        role: 'Multi-View Component Images',
        icon: ImagePlus,
        iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.imageGenerator || 'idle',
        message: agentMessages.imageGenerator,
      },
    },
    // Interface Designer Agent
    {
      id: 'interface',
      type: 'agent',
      position: { x: 560, y: 440 },
      data: {
        label: '🎛️ Interface Designer',
        role: 'PhET-Style UI/UX',
        icon: Layout,
        iconBg: 'bg-gradient-to-br from-cyan-500 to-blue-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.interface || 'idle',
        message: agentMessages.interface,
      },
    },
    // ===== ROW 3: Building =====
    // Visualist Agent
    {
      id: 'visualist',
      type: 'agent',
      position: { x: 840, y: 120 },
      data: {
        label: '🎨 Visualist',
        role: 'Three.js Scene & Animation',
        icon: Palette,
        iconBg: 'bg-gradient-to-br from-pink-500 to-rose-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.visualist || 'idle',
        message: agentMessages.visualist,
      },
    },
    // Component Builder Agent
    {
      id: 'componentBuilder',
      type: 'agent',
      position: { x: 840, y: 280 },
      data: {
        label: '🔧 Component Builder',
        role: '3D Components from Images',
        icon: Box,
        iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.componentBuilder || 'idle',
        message: agentMessages.componentBuilder,
      },
    },
    // ===== ROW 4: Quality & Assembly =====
    // PhET Inspector Agent
    {
      id: 'phetInspector',
      type: 'agent',
      position: { x: 1120, y: 120 },
      data: {
        label: '✅ PhET Inspector',
        role: 'Quality Assurance & Standards',
        icon: ShieldCheck,
        iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.phetInspector || 'idle',
        message: agentMessages.phetInspector,
      },
    },
    // Integrator Agent
    {
      id: 'integrator',
      type: 'agent',
      position: { x: 1120, y: 290 },
      data: {
        label: '🔗 Integrator',
        role: 'Final Assembly',
        icon: Layers,
        iconBg: 'bg-gradient-to-br from-rose-500 to-red-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.integrator || 'idle',
        message: agentMessages.integrator,
      },
    },
    // Resolver Agent - NEW
    {
      id: 'resolver',
      type: 'agent',
      position: { x: 1120, y: 460 },
      data: {
        label: '🔧 Resolver',
        role: 'Error Detection & Auto-Fix',
        icon: Settings2,
        iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-500',
        hasInput: true,
        hasOutput: true,
        status: agentStatuses.resolver || 'idle',
        message: agentMessages.resolver,
      },
    },
    // Output Node
    {
      id: 'output',
      type: 'simulationOutput',
      position: { x: 1400, y: 290 },
      data: {
        status: outputStatus,
        htmlContent,
        onPreview,
      },
    },
  ];

// Initial Edges - Enhanced Deep Agent Workflow (8 Agents)
const initialEdges: Edge[] = [
  // ===== Input to First Layer =====
  {
    id: 'e-input-promptEnhancer',
    source: 'input',
    target: 'promptEnhancer',
    animated: true,
    style: { stroke: '#d946ef', strokeWidth: 2 },
    label: 'Topic',
    labelStyle: { fontSize: 9, fill: '#6b7280' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
  },
  // ===== Prompt Enhancer Flow =====
  {
    id: 'e-promptEnhancer-researcher',
    source: 'promptEnhancer',
    target: 'groundingResearcher',
    style: { stroke: '#06b6d4', strokeWidth: 2 },
    label: 'enhanced',
    labelStyle: { fontSize: 8, fill: '#9ca3af' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  },
  {
    id: 'e-promptEnhancer-planner',
    source: 'promptEnhancer',
    target: 'planner',
    style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '4,4' },
    label: 'objectives',
    labelStyle: { fontSize: 8, fill: '#9ca3af' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  },
  // ===== Grounding Researcher Flow =====
  {
    id: 'e-researcher-imageGen',
    source: 'groundingResearcher',
    target: 'imageGenerator',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    label: 'research',
    labelStyle: { fontSize: 8, fill: '#9ca3af' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  },
  {
    id: 'e-researcher-planner',
    source: 'groundingResearcher',
    target: 'planner',
    style: { stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '4,4' },
    label: 'facts',
    labelStyle: { fontSize: 8, fill: '#9ca3af' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  },
  // ===== Planner Flow =====
  {
    id: 'e-planner-visualist',
    source: 'planner',
    target: 'visualist',
    style: { stroke: '#ec4899', strokeWidth: 2 },
    label: 'spec',
    labelStyle: { fontSize: 8, fill: '#9ca3af' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  },
  {
    id: 'e-planner-interface',
    source: 'planner',
    target: 'interface',
    style: { stroke: '#0ea5e9', strokeWidth: 2, strokeDasharray: '4,4' },
    label: 'spec',
    labelStyle: { fontSize: 8, fill: '#9ca3af' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  },
  // ===== Image Generator Flow =====
  {
    id: 'e-imageGen-componentBuilder',
    source: 'imageGenerator',
    target: 'componentBuilder',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2 },
    label: 'images',
    labelStyle: { fontSize: 8, fill: '#10b981' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
  },
  // ===== Building Flow =====
  {
    id: 'e-visualist-phetInspector',
    source: 'visualist',
    target: 'phetInspector',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
    label: 'scene',
    labelStyle: { fontSize: 8, fill: '#9ca3af' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  },
  {
    id: 'e-componentBuilder-phetInspector',
    source: 'componentBuilder',
    target: 'phetInspector',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
    label: 'components',
    labelStyle: { fontSize: 8, fill: '#9ca3af' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  },
  {
    id: 'e-interface-integrator',
    source: 'interface',
    target: 'integrator',
    style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '4,4' },
    label: 'UI',
    labelStyle: { fontSize: 8, fill: '#9ca3af' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  },
  // ===== PhET Inspector to Integrator =====
  {
    id: 'e-phetInspector-integrator',
    source: 'phetInspector',
    target: 'integrator',
    animated: true,
    style: { stroke: '#ef4444', strokeWidth: 2 },
    label: 'reviewed',
    labelStyle: { fontSize: 8, fill: '#ef4444' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
  },
  // ===== Integrator to Resolver =====
  {
    id: 'e-integrator-resolver',
    source: 'integrator',
    target: 'resolver',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2 },
    label: 'validate',
    labelStyle: { fontSize: 8, fill: '#10b981' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
  },
  // ===== Resolver to Output =====
  {
    id: 'e-resolver-output',
    source: 'resolver',
    target: 'output',
    animated: true,
    style: { stroke: '#22c55e', strokeWidth: 3 },
    label: '✓ fixed & ready',
    labelStyle: { fontSize: 9, fill: '#22c55e', fontWeight: 600 },
    labelBgStyle: { fill: 'white', fillOpacity: 0.95 },
  },
];

interface SimulationPlaygroundProps {
  onClose?: () => void;
}

// Helper function to clean HTML content from markdown artifacts
const cleanHtmlContent = (html: string): string => {
  if (!html) return '';

  let cleaned = html
    // Remove markdown code fences
    .replace(/^```html?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .replace(/^```\s*\n?/i, '')
    .trim();

  // If content doesn't start with proper HTML, try to extract it
  if (!cleaned.toLowerCase().startsWith('<!doctype') && !cleaned.toLowerCase().startsWith('<html')) {
    const htmlMatch = cleaned.match(/<!DOCTYPE html>[\s\S]*<\/html>/i) ||
      cleaned.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch) {
      cleaned = htmlMatch[0];
    }
  }

  return cleaned;
};

// View mode type
type ViewMode = 'pipeline' | 'simulation' | 'split';

const SimulationPlayground: React.FC<SimulationPlaygroundProps> = ({ onClose }) => {
  // State
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('high-school');
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputStatus, setOutputStatus] = useState<'idle' | 'generating' | 'ready'>('idle');
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('simulation');
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [agentMessages, setAgentMessages] = useState<Record<string, string>>({});
  const [eventLog, setEventLog] = useState<SimulationTaskEvent[]>([]);
  const hasGeneratedHtml = Boolean(htmlContent);
  const simulationContent = cleanHtmlContent(htmlContent || FALLBACK_SIMULATION_HTML);
  const hasSimulationContent = Boolean(simulationContent);
  const displayTopic = (topic || '').trim() || 'sp3 Hybridization';

  // Studium State
  const [studiumView, setStudiumView] = useState<View | 'SIMULATION'>('SIMULATION');

  // PDF Upload State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulation interaction state
  const [simulationTab, setSimulationTab] = useState<SimulationTab>('tutorial');
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(true);
  const [showControlsPanel, setShowControlsPanel] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle PDF file selection
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setPdfFile(file);
    setIsPdfLoading(true);

    try {
      // Extract text from PDF using pdf.js
      const arrayBuffer = await file.arrayBuffer();
      const pdfjsLib = await import('pdfjs-dist');

      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n\n';
      }

      setPdfContent(fullText.trim());
      addFileToSourceLibrary(file, { content: fullText.trim() }).catch((error) => {
        console.warn('[SimulationPlayground] Failed to add source to library:', error);
      });

      // Auto-suggest topic from PDF content if topic is empty
      if (!topic.trim() && fullText.length > 100) {
        // Extract first meaningful sentence or title
        const lines = fullText.split('\n').filter(l => l.trim().length > 10);
        if (lines.length > 0) {
          const suggestedTopic = lines[0].slice(0, 100).trim();
          setTopic(suggestedTopic);
        }
      }
    } catch (error) {
      console.error('Error extracting PDF content:', error);
      alert('Error reading PDF. Please try a different file.');
      setPdfFile(null);
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Remove uploaded PDF
  const handleRemovePdf = () => {
    setPdfFile(null);
    setPdfContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Create nodes with current state
  const currentNodes = createInitialNodes(
    topic,
    gradeLevel,
    setTopic,
    setGradeLevel,
    () => setViewMode('simulation'),
    outputStatus,
    htmlContent,
    agentStatuses,
    agentMessages
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(currentNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when state changes
  useEffect(() => {
    setNodes(createInitialNodes(
      topic,
      gradeLevel,
      setTopic,
      setGradeLevel,
      () => setViewMode('simulation'),
      outputStatus,
      htmlContent,
      agentStatuses,
      agentMessages
    ));
  }, [topic, gradeLevel, outputStatus, htmlContent, agentStatuses, agentMessages, setNodes]);

  // Subscribe to deep simulation events
  useEffect(() => {
    const unsubscribe = subscribeToDeepAgentEvents((event: DeepAgentEvent) => {
      // Store events for log display
      setEventLog(prev => [...prev, event as any]);

      // Map deep agent names to node IDs (updated for 8 agents)
      const agentNodeMap: Record<string, string> = {
        'promptenhancer': 'promptEnhancer',
        'prompt enhancer': 'promptEnhancer',
        'groundingresearcher': 'groundingResearcher',
        'grounding researcher': 'groundingResearcher',
        'planner': 'planner',
        'imagegenerator': 'imageGenerator',
        'image generator': 'imageGenerator',
        'visualist': 'visualist',
        'componentbuilder': 'componentBuilder',
        'component builder': 'componentBuilder',
        'interface': 'interface',
        'interface designer': 'interface',
        'phetinspector': 'phetInspector',
        'phet inspector': 'phetInspector',
        'integrator': 'integrator',
        'resolver': 'resolver',
        'orchestrator': 'promptEnhancer', // First agent in flow
      };

      const nodeId = agentNodeMap[event.agentName.toLowerCase()] || 
                     agentNodeMap[event.agentId.toLowerCase()] || 
                     event.agentId.toLowerCase();

      if (event.type === 'agent-thinking') {
        // When agent starts thinking
        setAgentStatuses(prev => ({ ...prev, [nodeId]: 'thinking' }));
        setAgentMessages(prev => ({ ...prev, [nodeId]: event.message || '🧠 Analyzing...' }));
      } else if (event.type === 'agent-working') {
        // When agent is actively working
        setAgentStatuses(prev => ({ ...prev, [nodeId]: 'working' }));
        setAgentMessages(prev => ({ 
          ...prev, 
          [nodeId]: event.message || '⚙️ Working...' 
        }));
      } else if (event.type === 'tool-call') {
        // When tool is being called
        setAgentStatuses(prev => ({ ...prev, [nodeId]: 'working' }));
        setAgentMessages(prev => ({ 
          ...prev, 
          [nodeId]: `⚙️ ${event.data?.tool || 'Processing'}...` 
        }));
      } else if (event.type === 'tool-result') {
        // Tool/step completed - show step progress
        const stepInfo = event.data?.artifact?.step && event.data?.artifact?.totalSteps
          ? `Step ${event.data.artifact.step}/${event.data.artifact.totalSteps}`
          : '';
        setAgentStatuses(prev => ({ ...prev, [nodeId]: 'completed' }));
        setAgentMessages(prev => ({ 
          ...prev, 
          [nodeId]: stepInfo ? `✓ ${stepInfo}` : '✓ Done' 
        }));
      } else if (event.type === 'data-flow') {
        // Data flowing to next agent
        const targetId = agentNodeMap[event.data?.targetAgent?.toLowerCase() || ''];
        if (targetId) {
          setAgentStatuses(prev => ({ ...prev, [targetId]: 'thinking' }));
          setAgentMessages(prev => ({ ...prev, [targetId]: '📥 Receiving data...' }));
        }
      } else if (event.type === 'subagent-spawn') {
        // SubAgent has been spawned
        const targetId = agentNodeMap[event.data?.targetAgent?.toLowerCase() || ''];
        if (targetId) {
          setAgentStatuses(prev => ({ ...prev, [targetId]: 'thinking' }));
          setAgentMessages(prev => ({ ...prev, [targetId]: '🚀 Starting...' }));
        }
      } else if (event.type === 'agent-complete' || event.type === 'subagent-complete') {
        setAgentStatuses(prev => ({ ...prev, [nodeId]: 'completed' }));
        setAgentMessages(prev => ({ ...prev, [nodeId]: '✓ Complete' }));
      } else if (event.type === 'agent-error') {
        setAgentStatuses(prev => ({ ...prev, [nodeId]: 'error' }));
        setAgentMessages(prev => ({ 
          ...prev, 
          [nodeId]: event.message || '❌ Error' 
        }));
      } else if (event.type === 'simulation-ready') {
        setOutputStatus('ready');
        if (event.data?.artifact?.content) {
          setHtmlContent(event.data.artifact.content);
        }
        // Mark all 9 agents as completed
        setAgentStatuses({
          promptEnhancer: 'completed',
          groundingResearcher: 'completed',
          planner: 'completed',
          imageGenerator: 'completed',
          visualist: 'completed',
          componentBuilder: 'completed',
          interface: 'completed',
          phetInspector: 'completed',
          integrator: 'completed',
          resolver: 'completed',
        });
      } else if (event.type === 'workflow-start') {
        // Reset all statuses
        setAgentStatuses({});
        setAgentMessages({});
      }
    });

    return unsubscribe;
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert('Please enter a simulation topic');
      return;
    }

    setIsGenerating(true);
    setOutputStatus('generating');
    setAgentStatuses({});
    setAgentMessages({});
    setEventLog([]);

    try {
      // Use the new Deep Simulation Pipeline (8 Specialized Agents)
      // Include PDF content if available for more precise simulation
      const result = await runDeepSimulationPipeline({
        topic,
        gradeLevel: gradeLevel,
        style: 'interactive',
        complexity: 'medium',
        pdfContent: pdfContent || undefined,
        pdfFileName: pdfFile?.name,
      });

      setHtmlContent(result.htmlContent);
      setOutputStatus('ready');
      
      // Mark all agents as completed
      setAgentStatuses({
        promptEnhancer: 'completed',
        groundingResearcher: 'completed',
        planner: 'completed',
        imageGenerator: 'completed',
        visualist: 'completed',
        componentBuilder: 'completed',
        interface: 'completed',
        phetInspector: 'completed',
        integrator: 'completed',
        resolver: 'completed',
      });
    } catch (error) {
      console.error('Deep Simulation generation error:', error);
      setOutputStatus('idle');
      
      // Mark appropriate agents as error
      setAgentStatuses(prev => ({
        ...prev,
        resolver: 'error',
        integrator: 'error',
      }));
      
      alert('Error generating simulation. Please ensure you are logged in and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = useCallback(() => {
    setTopic('');
    setOutputStatus('idle');
    setHtmlContent(null);
    setAgentStatuses({});
    setAgentMessages({});
    setEventLog([]);
    setIsGenerating(false);
    setPdfFile(null);
    setPdfContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div
      className="h-full w-full relative flex flex-col"
      style={{
        background: 'linear-gradient(135deg, #fdf2f8 0%, #f5f3ff 30%, #eff6ff 60%, #ffffff 100%)',
      }}
    >
      {/* Top Control Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/90 border-b border-gray-200 backdrop-blur-sm z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800">Deep Agent Simulation</h2>
            <p className="text-xs text-gray-500">Powered by Gemini 3 Pro</p>
          </div>
        </div>

        {/* Studium Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setStudiumView('SIMULATION')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${studiumView === 'SIMULATION'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span className="flex items-center gap-1.5">
              <Brain className="w-4 h-4" />
              Simulation
            </span>
          </button>
          <button
            onClick={() => setStudiumView(View.GENERATOR)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${studiumView === View.GENERATOR
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              Lesson
            </span>
          </button>
          <button
            onClick={() => setStudiumView(View.CHAT)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${studiumView === View.CHAT
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              Tutor
            </span>
          </button>
          <button
            onClick={() => setStudiumView(View.ANALYZER)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${studiumView === View.ANALYZER
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" />
              Analyzer
            </span>
          </button>
        </div>

        {studiumView === 'SIMULATION' && (
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setViewMode('pipeline')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'pipeline'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  Pipeline
                </span>
              </button>
              <button
                onClick={() => setViewMode('simulation')}
                disabled={!hasSimulationContent}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'simulation'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : hasSimulationContent ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  Simulation
                </span>
              </button>
              <button
                onClick={() => setViewMode('split')}
                disabled={!hasSimulationContent}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'split'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : hasSimulationContent ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'
                  }`}
              >
                <span className="flex items-center gap-1.5">
                  <Layout className="w-4 h-4" />
                  Split
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* PDF Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
                id="pdf-upload"
              />
              {pdfFile ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl">
                  <FileText className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700 font-medium max-w-24 truncate" title={pdfFile.name}>
                    {pdfFile.name}
                  </span>
                  <button
                    onClick={handleRemovePdf}
                    className="p-0.5 hover:bg-green-100 rounded transition-colors"
                    title="Remove PDF"
                  >
                    <X className="w-3 h-3 text-green-600" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPdfLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-gray-600 shadow-md border border-gray-200 hover:bg-gray-50 hover:border-pink-300 transition-all text-sm"
                  title="Upload PDF for precise simulation"
                >
                  {isPdfLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">PDF</span>
                </button>
              )}

              {/* Topic Input (compact) */}
              <div className="relative">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={pdfFile ? "Topic from PDF..." : "Enter simulation topic..."}
                  className={`w-64 px-4 py-2 text-sm border rounded-xl focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 bg-white ${pdfFile ? 'border-green-200' : 'border-gray-200'
                    }`}
                />
                {pdfFile && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border border-white" title="Using PDF content" />
                )}
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim()}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl font-medium text-sm shadow-md transition-all ${isGenerating
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:from-pink-400 hover:to-purple-400'
                  }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
              
              {/* Grade Level Badge */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-50 to-pink-50 border border-violet-200">
                <span className="text-xs text-gray-500">Level:</span>
                <span className="text-xs font-semibold text-violet-600">
                  {GRADE_LEVEL_LABELS[gradeLevel]}
                </span>
              </div>
              <button
                onClick={handleReset}
                className="p-2 rounded-xl bg-white text-gray-600 shadow-md border border-gray-200 hover:bg-gray-50 transition-all"
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowModelInfo(true)}
                className="p-2 rounded-xl bg-white text-gray-600 shadow-md border border-gray-200 hover:bg-gray-50 transition-all"
                title="Model Information"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {studiumView === 'SIMULATION' ? (
        /* Original Simulation Content */
        <div className="flex-1 flex overflow-hidden">
          {/* Pipeline View */}
          {(viewMode === 'pipeline' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-1/3 border-r border-gray-200' : 'w-full'} h-full relative`}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
                maxZoom={1.5}
                defaultEdgeOptions={{
                  type: 'default',
                  style: { stroke: '#d1d5db', strokeWidth: 1.5, strokeDasharray: '5,5' },
                }}
                connectionLineStyle={{
                  stroke: '#d1d5db',
                  strokeWidth: 1.5,
                  strokeDasharray: '5,5',
                }}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={24}
                  size={1}
                  color="#e5e7eb"
                />
                {viewMode !== 'split' && (
                  <>
                    <Controls
                      className="!bg-white !border-gray-200 !shadow-lg !rounded-xl [&>button]:!bg-white [&>button]:!border-gray-200 [&>button]:!text-gray-600 [&>button:hover]:!bg-gray-50"
                    />
                    <MiniMap
                      nodeColor={(node) => {
                        if (node.type === 'agent') {
                          const status = node.data?.status as AgentStatus;
                          if (status === 'thinking') return '#8b5cf6';
                          if (status === 'working' || status === 'running') return '#3b82f6';
                          if (status === 'completed') return '#22c55e';
                          if (status === 'error') return '#ef4444';
                          // Agent-specific colors when idle
                          const nodeId = node.id;
                          if (nodeId === 'promptEnhancer') return '#d946ef';
                          if (nodeId === 'groundingResearcher') return '#06b6d4';
                          if (nodeId === 'planner') return '#6366f1';
                          if (nodeId === 'imageGenerator') return '#8b5cf6';
                          if (nodeId === 'visualist') return '#ec4899';
                          if (nodeId === 'componentBuilder') return '#10b981';
                          if (nodeId === 'interface') return '#0ea5e9';
                          if (nodeId === 'phetInspector') return '#f59e0b';
                          if (nodeId === 'integrator') return '#ef4444';
                          return '#9ca3af';
                        }
                        if (node.type === 'topicInput') return '#f97316';
                        if (node.type === 'simulationOutput') return '#10b981';
                        return '#ff0071';
                      }}
                      maskColor="rgba(255, 255, 255, 0.8)"
                      className="!bg-white/80 !border-gray-200 !rounded-xl !shadow-lg"
                      style={{ width: 160, height: 100 }}
                    />
                  </>
                )}

                {/* Activity Log Panel - Enhanced Artifacts View */}
                <Panel position="bottom-right">
                  <div className="w-96 max-h-80 overflow-hidden flex flex-col rounded-xl bg-white/95 border border-gray-200 shadow-xl backdrop-blur-sm">
                    {/* Header */}
                    <div className="px-3 py-2 bg-gradient-to-r from-violet-50 to-pink-50 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isGenerating ? 'bg-violet-500 animate-pulse' : 'bg-gray-400'}`} />
                          <span className="text-xs font-bold text-gray-700">🔮 Agent Workflow & Artifacts</span>
                        </div>
                        {isGenerating && (
                          <span className="text-xs text-violet-600 font-medium">
                            {eventLog.filter(e => e.status === 'completed').length}/8 steps
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Agent Steps List with Artifact Previews */}
                    <div className="flex-1 overflow-auto p-2 space-y-2">
                      {eventLog.length === 0 ? (
                        <div className="text-center py-6">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-violet-500" />
                          </div>
                          <p className="text-sm text-gray-500 font-medium">Ready to Generate</p>
                          <p className="text-xs text-gray-400 mt-1">Enter a topic and click Generate</p>
                          <div className="mt-3 flex flex-wrap justify-center gap-1">
                            {['Enhancer', 'Researcher', 'Planner', 'Image Gen', 'Visualist', 'Builder', 'Inspector', 'Integrator', 'Resolver'].map((agent, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                {agent}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        eventLog.map((event, i) => {
                          const artifact = event.data?.artifact;
                          const hasArtifact = artifact && artifact.content;
                          const contentPreview = hasArtifact 
                            ? artifact.content.substring(0, 150).replace(/[\n\r]+/g, ' ').trim()
                            : null;
                          
                          return (
                            <div 
                              key={i} 
                              className={`rounded-lg border transition-all ${
                                event.status === 'completed' 
                                  ? 'bg-green-50 border-green-200' 
                                  : event.status === 'error' 
                                    ? 'bg-red-50 border-red-200'
                                    : event.status === 'working' || event.status === 'thinking'
                                      ? 'bg-blue-50 border-blue-200 animate-pulse'
                                      : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              {/* Agent Header */}
                              <div className="p-2 flex items-start gap-2">
                                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                                  event.status === 'completed' ? 'bg-green-500' :
                                  event.status === 'error' ? 'bg-red-500' : 
                                  event.status === 'thinking' ? 'bg-violet-500 animate-ping' :
                                  'bg-blue-500 animate-pulse'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-gray-700">{event.agentName}</span>
                                    {artifact?.step && (
                                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
                                        Step {artifact.step}/{artifact.totalSteps}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">{event.message}</p>
                                </div>
                              </div>
                              
                              {/* Artifact Preview */}
                              {hasArtifact && (
                                <div className="mx-2 mb-2 p-2 rounded-lg bg-white/80 border border-gray-100">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-gray-700">{artifact.title}</span>
                                    {artifact.type === 'component-images' && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-600">📸 Images</span>
                                    )}
                                    {artifact.type === 'grounding-research' && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">🔬 Research</span>
                                    )}
                                    {artifact.type === 'specification' && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600">📋 Spec</span>
                                    )}
                                    {artifact.type === 'threejs-code' && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-pink-100 text-pink-600">🎨 3D Code</span>
                                    )}
                                    {artifact.type === 'phet-review' && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">✅ Review</span>
                                    )}
                                    {artifact.type === 'final-html' && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-600">🚀 Final</span>
                                    )}
                                  </div>
                                  {contentPreview && (
                                    <p className="text-xs text-gray-500 line-clamp-2 font-mono bg-gray-50 p-1.5 rounded">
                                      {contentPreview}...
                                    </p>
                                  )}
                                  {artifact.images && artifact.images.length > 0 && (
                                    <div className="mt-1.5 flex gap-1">
                                      {artifact.images.slice(0, 3).map((img, idx) => (
                                        <div key={idx} className="w-10 h-10 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
                                          <ImagePlus className="w-4 h-4 text-gray-400" />
                                        </div>
                                      ))}
                                      {artifact.images.length > 3 && (
                                        <span className="text-xs text-gray-400 self-center">+{artifact.images.length - 3}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </Panel>

                {/* Agent Legend - 9 Agent Pipeline */}
                {viewMode !== 'split' && (
                  <Panel position="bottom-left">
                    <div className="px-4 py-3 rounded-xl bg-white/95 border border-gray-200 shadow-lg backdrop-blur-sm">
                      <p className="text-xs font-bold text-gray-700 mb-2">🤖 9-Agent Deep Pipeline (with Resolver)</p>
                      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-fuchsia-500" /> Prompt Enhancer
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-cyan-500" /> Grounding Research
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-indigo-500" /> Planner
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-violet-500" /> Image Generator
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-pink-500" /> Visualist
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" /> Component Builder
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-500" /> PhET Inspector
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-rose-500" /> Integrator
                        </span>
                        <span className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-teal-500" /> Resolver ✨
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-gray-100 flex gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Idle
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" /> Thinking
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Working
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Done
                        </span>
                      </div>
                    </div>
                  </Panel>
                )}
              </ReactFlow>
            </div>
          )}

          {/* Simulation View */}
          {(viewMode === 'simulation' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-2/3' : 'w-full'} h-full flex flex-col bg-gray-900`}>
              {hasSimulationContent ? (
                <>
                  {/* Simulation Header with Tabs */}
                  <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <div className="flex items-center gap-4">
                      {/* Window controls */}
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                      </div>

                      {/* Tab Switcher */}
                      <div className="flex items-center gap-1 p-1 bg-gray-700/50 rounded-lg">
                        <button
                          onClick={() => setSimulationTab('tutorial')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${simulationTab === 'tutorial'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          Tutorial
                        </button>
                        <button
                          onClick={() => setSimulationTab('interactive')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${simulationTab === 'interactive'
                            ? 'bg-pink-600 text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-gray-600'
                            }`}
                        >
                          <Gamepad2 className="w-3.5 h-3.5" />
                          Interactive
                        </button>
                      </div>

                      <span className="text-sm text-gray-500">|</span>
                      <span className="text-sm text-gray-400">{displayTopic}</span>
                      {!hasGeneratedHtml && (
                        <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                          Demo simulation loaded
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowControlsPanel(!showControlsPanel)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${showControlsPanel
                          ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Controls
                      </button>
                      <button
                        onClick={() => {
                          const cleanedHtml = simulationContent;
                          const blob = new Blob([cleanedHtml], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${displayTopic.replace(/\s+/g, '_')}_simulation.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs font-medium hover:bg-gray-600 transition-colors flex items-center gap-1.5"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        Download
                      </button>
                      <button
                        onClick={() => {
                          const cleanedHtml = simulationContent;
                          const blob = new Blob([cleanedHtml], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          window.open(url, '_blank');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-pink-600 text-white text-xs font-medium hover:bg-pink-500 transition-colors flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Fullscreen
                      </button>
                    </div>
                  </div>

                  {/* Main Content Area */}
                    <div className="flex-1 flex overflow-hidden">
                      {/* Simulation iframe */}
                      <div className={`flex-1 overflow-hidden relative ${simulationTab === 'tutorial' ? '' : ''}`}>
                        <iframe
                          ref={iframeRef}
                          srcDoc={simulationContent}
                          className="w-full h-full border-0"
                          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
                          allow="accelerometer; autoplay; camera; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; xr-spatial-tracking"
                          title="3D Simulation"
                        />

                      {/* Tutorial Overlay */}
                      {simulationTab === 'tutorial' && (
                        <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
                          <div className="bg-black/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-700 pointer-events-auto">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Film className="w-5 h-5 text-purple-400" />
                                <span className="text-sm font-medium text-white">Understanding the Simulation</span>
                              </div>
                              <button
                                onClick={() => setSimulationTab('interactive')}
                                className="flex items-center gap-1 px-3 py-1 bg-pink-600 text-white text-xs font-medium rounded-lg hover:bg-pink-500 transition-colors"
                              >
                                Try it yourself
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-300 mb-3">
                              Watch how the simulation works. The 3D model demonstrates the key concepts of <span className="text-pink-400 font-medium">{displayTopic}</span>.
                              Pay attention to the animations and interactions shown.
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span>Animation playing</span>
                              </div>
                              <span>•</span>
                              <span>Click "Interactive" tab to control the simulation yourself</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Controls Panel (Side Panel) */}
                    {showControlsPanel && simulationTab === 'interactive' && (
                      <div className="w-72 bg-gray-800 border-l border-gray-700 overflow-y-auto">
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-4">
                            <Gamepad2 className="w-5 h-5 text-pink-400" />
                            <h3 className="text-sm font-semibold text-white">Simulation Controls</h3>
                          </div>

                          {/* Mouse Controls */}
                          <div className="mb-5">
                            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Mouse Controls</h4>
                            <div className="space-y-2">
                              <div className="flex items-start gap-3 p-2 bg-gray-700/50 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                                  <RotateCw className="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-white">Left Click + Drag</p>
                                  <p className="text-xs text-gray-400">Rotate the 3D view</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-2 bg-gray-700/50 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                                  <Move3D className="w-4 h-4 text-green-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-white">Right Click + Drag</p>
                                  <p className="text-xs text-gray-400">Pan the camera</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-2 bg-gray-700/50 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                                  <ZoomIn className="w-4 h-4 text-yellow-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-white">Scroll Wheel</p>
                                  <p className="text-xs text-gray-400">Zoom in/out</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3 p-2 bg-gray-700/50 rounded-lg">
                                <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                                  <MousePointer className="w-4 h-4 text-pink-400" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-white">Hover on Objects</p>
                                  <p className="text-xs text-gray-400">See component info</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Keyboard Shortcuts */}
                          <div className="mb-5">
                            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Keyboard Shortcuts</h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                                <span className="text-xs text-gray-300">Play/Pause</span>
                                <kbd className="px-2 py-0.5 bg-gray-600 text-gray-200 text-xs rounded font-mono">Space</kbd>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                                <span className="text-xs text-gray-300">Reset View</span>
                                <kbd className="px-2 py-0.5 bg-gray-600 text-gray-200 text-xs rounded font-mono">R</kbd>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                                <span className="text-xs text-gray-300">Zoom In</span>
                                <kbd className="px-2 py-0.5 bg-gray-600 text-gray-200 text-xs rounded font-mono">+</kbd>
                              </div>
                              <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg">
                                <span className="text-xs text-gray-300">Zoom Out</span>
                                <kbd className="px-2 py-0.5 bg-gray-600 text-gray-200 text-xs rounded font-mono">-</kbd>
                              </div>
                            </div>
                          </div>

                          {/* In-Simulation Controls */}
                          <div className="mb-5">
                            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">In-Simulation Controls</h4>
                            <p className="text-xs text-gray-400 mb-3">
                              The simulation has built-in controls at the bottom:
                            </p>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs text-gray-300">
                                <Play className="w-3.5 h-3.5 text-green-400" />
                                <span>Play/Pause animation</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-300">
                                <Settings2 className="w-3.5 h-3.5 text-blue-400" />
                                <span>Adjust animation speed</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-300">
                                <RotateCcw className="w-3.5 h-3.5 text-yellow-400" />
                                <span>Reset camera view</span>
                              </div>
                            </div>
                          </div>

                          {/* AI Features */}
                          <div className="p-3 bg-gradient-to-br from-pink-600/20 to-purple-600/20 rounded-xl border border-pink-500/20">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-4 h-4 text-pink-400" />
                              <span className="text-xs font-medium text-white">AI Features</span>
                            </div>
                            <p className="text-xs text-gray-300 mb-2">
                              Click objects in the simulation to get AI-powered explanations:
                            </p>
                            <div className="space-y-1.5 text-xs text-gray-400">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <span>Clinical Insights</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                <span>ELI5 (Simple explanation)</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                <span>Narrate (Audio explanation)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <FileCode className="w-16 h-16 mb-4 opacity-30" />
                  <h3 className="text-lg font-medium text-gray-400 mb-2">No Simulation Yet</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-md text-center">
                    Enter a topic (e.g., "DNA double helix", "Water molecule structure") and click Generate to create an interactive 3D simulation.
                  </p>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl border border-gray-700 mb-6">
                    <Upload className="w-4 h-4 text-pink-400" />
                    <span className="text-xs text-gray-400">
                      <span className="text-pink-400 font-medium">Pro tip:</span> Upload a PDF for more precise, document-based simulations
                    </span>
                  </div>
                  {isGenerating && (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
                      <span className="text-sm text-gray-400">
                        {pdfFile ? 'Analyzing PDF and generating simulation...' : 'Generating your simulation...'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Studium Content */
        <div className="flex-1 p-6 overflow-hidden bg-slate-50 flex flex-col">
          <div className="max-w-7xl mx-auto h-full w-full flex flex-col">
            <div className="mb-4">
              <button
                onClick={() => setStudiumView('SIMULATION')}
                className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Simulation
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {studiumView === View.GENERATOR && <InteractiveCanvas />}
              {studiumView === View.CHAT && <ChatInterface />}
              {studiumView === View.ANALYZER && <ImageAnalyzer />}
            </div>
          </div>
        </div>
      )}

      {/* Model Info Modal */}
      {
        showModelInfo && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-[24rem] shadow-2xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">🤖 AI Model</h3>
              <p className="text-sm text-gray-500 mb-4">
                This simulation system uses Google's Gemini 3 Pro model for generating interactive 3D educational content.
              </p>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100">
                  <Sparkles className="w-5 h-5 text-pink-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">Gemini 3 Pro</p>
                    <p className="text-xs text-gray-500">Google's latest AI model</p>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-600 mb-2 font-medium">Features:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Modern Academic light mode UI</li>
                    <li>• Glassmorphism info panels</li>
                    <li>• Interactive 3D controls</li>
                    <li>• Raycasting hover effects</li>
                    <li>• AI-powered explanations</li>
                  </ul>
                </div>
              </div>
              <button
                onClick={() => setShowModelInfo(false)}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium text-sm hover:from-pink-400 hover:to-purple-400 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default SimulationPlayground;
