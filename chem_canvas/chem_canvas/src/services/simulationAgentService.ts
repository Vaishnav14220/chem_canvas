/**
 * Simulation Agent Service - Deep Agent System for 3D Educational Visualizations
 * 
 * Uses a streamlined 2-agent architecture:
 * 1. Planner - Analyzes topic and creates technical specification
 * 2. Builder - Generates the complete HTML/JS/CSS simulation
 * 
 * All agents use gemini-3-pro-preview (Google's latest model)
 */

import { getSharedGeminiApiKey } from '../firebase/apiKeys';

// ==========================================
// Types & Interfaces
// ==========================================

export interface SimulationTaskEvent {
  type: 'agent-start' | 'agent-progress' | 'agent-complete' | 'agent-error' | 'simulation-ready' | 'thinking';
  agentName: string;
  taskId: string;
  message: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  data?: any;
  timestamp?: Date;
}

export interface SimulationArtifact {
  id: string;
  type: 'spec' | 'code' | 'ui' | 'integration' | 'final';
  agentName: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface SimulationAgentDefinition {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  inputFrom?: string[];
  outputTo?: string[];
  tools?: string[];
  model: string;
}

export interface SimulationRequest {
  topic: string;
  style?: 'educational' | 'interactive' | 'cinematic';
  complexity?: 'simple' | 'medium' | 'complex';
  features?: string[];
  pdfContent?: string; // Extracted text content from uploaded PDF
  pdfFileName?: string; // Name of the uploaded PDF
}

export interface SimulationOutput {
  id: string;
  title: string;
  htmlContent: string;
  artifacts: SimulationArtifact[];
  createdAt: Date;
}

// ==========================================
// Event System
// ==========================================

type SimulationEventListener = (event: SimulationTaskEvent) => void;
const eventListeners: Set<SimulationEventListener> = new Set();

export const subscribeToSimulationEvents = (listener: SimulationEventListener): (() => void) => {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
};

const emitSimulationEvent = (event: SimulationTaskEvent): void => {
  event.timestamp = new Date();
  eventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('Event listener error:', error);
    }
  });
};

// ==========================================
// Artifact Storage
// ==========================================

const simulationArtifacts: SimulationArtifact[] = [];

export const getSimulationArtifacts = (): SimulationArtifact[] => [...simulationArtifacts];

export const clearSimulationArtifacts = (): void => {
  simulationArtifacts.length = 0;
};

const createSimulationArtifact = (artifact: Omit<SimulationArtifact, 'id' | 'createdAt'>): SimulationArtifact => {
  const newArtifact: SimulationArtifact = {
    ...artifact,
    id: `sim-artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
  };
  simulationArtifacts.push(newArtifact);
  return newArtifact;
};

// ==========================================
// The Master Simulation Prompt
// ==========================================

const MASTER_SIMULATION_PROMPT = `Role: You are an expert Creative Technologist and Educational Content Creator specializing in Three.js, WebGL, and Generative AI integration.

Task: Create a single-file, self-contained HTML/JS application that generates an interactive, 3D educational visualization.

## Aesthetic & Design Philosophy

**Style**: "Modern Academic." Use a clean, distraction-free Light Mode aesthetic (soft white/light grey backgrounds: #f8fafc, #f1f5f9). The design should feel premium and elegant.

**Geometry**:
- Organic Topics (biology, chemistry, nature): Use soft, rounded procedural shapes (spheres, curves, tubes, torus)
- Mechanical/Structural Topics (physics, engineering): Use sharp, precise geometric shapes (cubes, cylinders, lines, planes)

**Layout**:
- Info Panel: A glassmorphism-style panel floating in the Top Left corner
- Controls Bar: A pill-shaped control bar floating at the Bottom Center
- Canvas: Full-screen 3D background

## Functional Requirements

### 1. 3D Engine (Three.js)
- Use Three.js via importmap from unpkg CDN
- Do NOT load external assets (.obj/.gltf/.glb)
- Generate ALL geometry procedurally using Three.js primitives
- Use OrbitControls for camera manipulation

### 2. Animation & Controls
- Implement a continuous loop animation relevant to the subject
- Controls Bar MUST include:
  - Play/Pause button (toggles animation)
  - Speed/Rate Slider (range input, 0.1x to 3x speed)
  - Reset View button (resets camera to initial position)

### 3. Interactivity (Raycasting)
- Hover: Highlight components on mouseover (change color/emissive)
- Click: Update the Top Left Info Panel with:
  - Component Title
  - Category/Type
  - Detailed Description

### 4. Gemini AI Integration
Integrate the Google Gemini API to make this an "Intelligent Tutor."

**API Setup**: 
const apiKey = ""; // Will be injected at runtime

**AI Section in Info Panel** - Add three buttons:
1. ✨ **Scientific Insights**: Calls Gemini to explain the significance/science of the selected part
2. 🧒 **ELI5**: Calls Gemini to explain using a simple analogy for a 5-year-old
3. 🔊 **Narrate**: Calls Gemini TTS to read the description aloud

**Models to use**:
- Text: gemini-2.5-flash-preview-04-17
- Audio TTS: gemini-2.5-flash-preview-tts

**Audio Handling**: Decode base64 PCM16 audio from API and play using Web Audio API (AudioContext).

## Technical Constraints

1. Output a SINGLE HTML file containing all CSS, HTML, and JavaScript
2. Handle window resizing gracefully
3. Use importmap for Three.js dependencies
4. Initialize 3D scene in DOMContentLoaded event
5. Use CSS variables for theming
6. Implement proper error handling

## Required HTML Structure Template

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Topic] - 3D Educational Simulation</title>
  <style>
    :root {
      --bg-primary: #f8fafc;
      --bg-glass: rgba(255, 255, 255, 0.7);
      --text-primary: #1e293b;
      --text-secondary: #64748b;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-primary);
      overflow: hidden;
    }
    
    #canvas-container {
      position: fixed;
      inset: 0;
      z-index: 1;
    }
    
    /* Glassmorphism Info Panel - Top Left */
    .info-panel {
      position: fixed;
      top: 20px;
      left: 20px;
      width: 340px;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      background: var(--bg-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 20px;
      padding: 24px;
      z-index: 100;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    }
    
    .info-panel h1 {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    
    .info-panel .subtitle {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    
    .component-info {
      background: rgba(99, 102, 241, 0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .component-info h2 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 4px;
    }
    
    .component-info .category {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    
    .component-info p {
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--text-primary);
    }
    
    .ai-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .ai-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border: none;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      background: white;
      color: var(--text-primary);
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
    
    .ai-btn:hover {
      background: var(--accent);
      color: white;
      transform: translateY(-1px);
    }
    
    .ai-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .ai-response {
      margin-top: 12px;
      padding: 12px;
      background: rgba(99, 102, 241, 0.05);
      border-radius: 10px;
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--text-primary);
      max-height: 200px;
      overflow-y: auto;
    }
    
    /* Controls Bar - Bottom Center */
    .controls-bar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--bg-glass);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 50px;
      padding: 12px 24px;
      z-index: 100;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    }
    
    .control-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background: white;
      color: var(--text-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    
    .control-btn:hover {
      background: var(--accent);
      color: white;
      transform: scale(1.05);
    }
    
    .control-btn.active {
      background: var(--accent);
      color: white;
    }
    
    .speed-control {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .speed-control label {
      font-size: 0.75rem;
      color: var(--text-secondary);
      white-space: nowrap;
    }
    
    .speed-control input[type="range"] {
      width: 100px;
      height: 4px;
      border-radius: 2px;
      background: rgba(0, 0, 0, 0.1);
      appearance: none;
      cursor: pointer;
    }
    
    .speed-control input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
    }
    
    .speed-value {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      min-width: 36px;
    }
  </style>
</head>
<body>
  <div id="canvas-container"></div>
  
  <!-- Info Panel -->
  <div class="info-panel">
    <h1 id="title">[Topic Title]</h1>
    <p class="subtitle" id="subtitle">Interactive 3D Educational Simulation</p>
    
    <div class="component-info" id="component-info">
      <h2 id="component-title">Click a component</h2>
      <div class="category" id="component-category">-</div>
      <p id="component-description">Interact with the 3D model to learn more about each part.</p>
    </div>
    
    <div class="ai-buttons">
      <button class="ai-btn" id="btn-insights" disabled>
        <span>✨</span> Scientific Insights
      </button>
      <button class="ai-btn" id="btn-eli5" disabled>
        <span>🧒</span> Explain Like I'm 5
      </button>
      <button class="ai-btn" id="btn-narrate" disabled>
        <span>🔊</span> Narrate
      </button>
    </div>
    
    <div class="ai-response" id="ai-response" style="display: none;"></div>
  </div>
  
  <!-- Controls Bar -->
  <div class="controls-bar">
    <button class="control-btn active" id="btn-play-pause" title="Play/Pause">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path id="play-icon" d="M8 5v14l11-7z"/>
      </svg>
    </button>
    
    <div class="speed-control">
      <label>Speed</label>
      <input type="range" id="speed-slider" min="0.1" max="3" step="0.1" value="1">
      <span class="speed-value" id="speed-value">1.0x</span>
    </div>
    
    <button class="control-btn" id="btn-reset" title="Reset View">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
    </button>
  </div>

  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
    }
  }
  </script>
  
  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    
    // Configuration & State
    const apiKey = ""; // Gemini API key
    let isPlaying = true;
    let animationSpeed = 1.0;
    let selectedObject = null;
    let clock = new THREE.Clock();
    
    const interactiveObjects = [];
    const objectData = new Map();
    
    let initialCameraPosition = new THREE.Vector3();
    let initialCameraTarget = new THREE.Vector3();
    
    // Three.js Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 5, 10);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 50;
    
    initialCameraPosition.copy(camera.position);
    controls.target.set(0, 0, 0);
    initialCameraTarget.copy(controls.target);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);
    
    // ============================================
    // CREATE YOUR 3D SCENE HERE
    // ============================================
    function createScene() {
      // Add your procedural geometry here
      // Register objects in interactiveObjects array
      // Store metadata in objectData Map
    }
    
    // ============================================
    // ANIMATION LOGIC HERE
    // ============================================
    function updateAnimations(delta) {
      if (!isPlaying) return;
      // Add your animations here using delta * animationSpeed
    }
    
    // Raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredObject = null;
    
    function onMouseMove(event) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjects, true);
      
      if (hoveredObject && hoveredObject !== selectedObject) {
        const data = objectData.get(hoveredObject.uuid);
        if (data && data.originalColor) {
          hoveredObject.material.color.copy(data.originalColor);
          if (hoveredObject.material.emissive) hoveredObject.material.emissive.setHex(0x000000);
        }
      }
      
      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (obj !== selectedObject) {
          hoveredObject = obj;
          if (obj.material.emissive) obj.material.emissive.setHex(0x333333);
          document.body.style.cursor = 'pointer';
        }
      } else {
        hoveredObject = null;
        document.body.style.cursor = 'default';
      }
    }
    
    function onClick(event) {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactiveObjects, true);
      
      if (selectedObject) {
        const prevData = objectData.get(selectedObject.uuid);
        if (prevData && prevData.originalColor) {
          selectedObject.material.color.copy(prevData.originalColor);
          if (selectedObject.material.emissive) selectedObject.material.emissive.setHex(0x000000);
        }
      }
      
      if (intersects.length > 0) {
        selectedObject = intersects[0].object;
        const data = objectData.get(selectedObject.uuid);
        
        if (data) {
          if (selectedObject.material.emissive) selectedObject.material.emissive.setHex(0x6366f1);
          
          document.getElementById('component-title').textContent = data.title;
          document.getElementById('component-category').textContent = data.category;
          document.getElementById('component-description').textContent = data.description;
          
          document.getElementById('btn-insights').disabled = false;
          document.getElementById('btn-eli5').disabled = false;
          document.getElementById('btn-narrate').disabled = false;
        }
      }
    }
    
    // Control handlers
    const playPauseBtn = document.getElementById('btn-play-pause');
    const playIcon = document.getElementById('play-icon');
    
    playPauseBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      playPauseBtn.classList.toggle('active', isPlaying);
      playIcon.setAttribute('d', isPlaying ? 'M8 5v14l11-7z' : 'M6 4h4v16H6zM14 4h4v16h-4z');
    });
    
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    
    speedSlider.addEventListener('input', (e) => {
      animationSpeed = parseFloat(e.target.value);
      speedValue.textContent = animationSpeed.toFixed(1) + 'x';
    });
    
    document.getElementById('btn-reset').addEventListener('click', () => {
      camera.position.copy(initialCameraPosition);
      controls.target.copy(initialCameraTarget);
      controls.update();
    });
    
    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      updateAnimations(delta);
      controls.update();
      renderer.render(scene, camera);
    }
    
    // Events
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);
    
    // Initialize
    createScene();
    animate();
    
    document.getElementById('title').textContent = '[TOPIC TITLE]';
  </script>
</body>
</html>

## CRITICAL OUTPUT INSTRUCTIONS

1. Output ONLY the complete HTML file - NO markdown code fences
2. Start your output directly with <!DOCTYPE html>
3. FULLY implement the createScene() function with topic-specific 3D objects
4. FULLY implement the updateAnimations() function with relevant animations
5. Register all interactive objects in the interactiveObjects array
6. Store all object metadata in the objectData Map with: title, category, description, originalColor
7. The simulation MUST be fully functional and visually impressive
8. Create at least 5-10 interactive components for the topic`;

// ==========================================
// Agent Definitions
// ==========================================

const PLANNER_AGENT: SimulationAgentDefinition = {
  name: 'Planner',
  role: 'Topic Analyst & Specification Creator',
  description: 'Analyzes the topic and creates a detailed plan for the simulation',
  model: 'gemini-3-pro-preview',
  systemPrompt: `You are a Planning Agent specializing in 3D educational visualization design.

Your task is to analyze a topic and create a detailed specification for a Three.js simulation.

## Output Format
You MUST output valid JSON with this exact structure:

{
  "title": "Display title for the simulation",
  "category": "Biology|Chemistry|Physics|Astronomy|Engineering|etc",
  "geometryStyle": "organic|mechanical",
  "components": [
    {
      "name": "Component Name",
      "type": "sphere|box|cylinder|torus|tube|custom",
      "category": "Category/Type",
      "description": "Educational description of this component (2-3 sentences)",
      "color": "#hexcolor",
      "position": [x, y, z],
      "scale": [x, y, z],
      "animations": ["rotation", "pulsation", "orbit", "wave"]
    }
  ],
  "mainAnimation": {
    "type": "rotation|pulsation|flow|orbit|wave",
    "description": "What the main animation represents"
  },
  "cameraPosition": [x, y, z],
  "educationalNotes": "Key educational points to highlight"
}

Create at least 5-10 components with detailed educational descriptions.
Be specific about colors (use hex), positions, and animations.

Output ONLY the JSON, no additional text.`
};

const BUILDER_AGENT: SimulationAgentDefinition = {
  name: 'Builder',
  role: 'Three.js Implementation Specialist',
  description: 'Builds the complete HTML/JS simulation from the specification',
  model: 'gemini-3-pro-preview',
  systemPrompt: MASTER_SIMULATION_PROMPT
};

// ==========================================
// Agent Execution
// ==========================================

export const setSimulationApiKey = (_key: string): void => {
  console.log('setSimulationApiKey is deprecated - using shared API key from Firebase');
};

const callGeminiAgent = async (
  agent: SimulationAgentDefinition,
  input: string,
  taskId: string
): Promise<string> => {
  const apiKey = await getSharedGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please ensure Firebase API keys are initialized.');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  emitSimulationEvent({
    type: 'agent-start',
    agentName: agent.name,
    taskId,
    message: `${agent.name} is processing...`,
    status: 'in-progress',
  });

  try {
    const response = await ai.models.generateContent({
      model: agent.model,
      contents: input,
      config: {
        systemInstruction: agent.systemPrompt,
        temperature: 0.8,
        maxOutputTokens: 32768,
      },
    });

    const result = response.text || '';

    emitSimulationEvent({
      type: 'agent-complete',
      agentName: agent.name,
      taskId,
      message: `${agent.name} completed successfully`,
      status: 'completed',
      data: { outputLength: result.length },
    });

    return result;
  } catch (error) {
    emitSimulationEvent({
      type: 'agent-error',
      agentName: agent.name,
      taskId,
      message: `${agent.name} error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error',
      data: { error },
    });
    throw error;
  }
};

// ==========================================
// HTML Cleaning Utility
// ==========================================

const cleanHtmlOutput = (html: string): string => {
  if (!html) return '';
  
  let cleaned = html
    .replace(/^```html?\s*\n?/gi, '')
    .replace(/\n?```\s*$/gi, '')
    .replace(/^```\s*\n?/gi, '')
    .trim();
  
  // Extract HTML if wrapped in other content
  if (!cleaned.toLowerCase().startsWith('<!doctype') && !cleaned.toLowerCase().startsWith('<html')) {
    const htmlMatch = cleaned.match(/<!DOCTYPE html>[\s\S]*<\/html>/i) || 
                      cleaned.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch) {
      cleaned = htmlMatch[0];
    }
  }
  
  return cleaned;
};

// ==========================================
// Main Pipeline
// ==========================================

export const runSimulationPipeline = async (
  request: SimulationRequest
): Promise<SimulationOutput> => {
  const taskId = `sim-${Date.now()}`;
  clearSimulationArtifacts();

  emitSimulationEvent({
    type: 'thinking',
    agentName: 'Orchestrator',
    taskId,
    message: 'Starting simulation pipeline...',
    status: 'in-progress',
  });

  try {
    // Step 1: Planner creates specification
    emitSimulationEvent({
      type: 'agent-start',
      agentName: 'Planner',
      taskId,
      message: request.pdfContent 
        ? 'Analyzing PDF document and creating specification...' 
        : 'Analyzing topic and creating specification...',
      status: 'in-progress',
    });

    // Build the planner input with optional PDF context
    let plannerInput = `Create a detailed 3D visualization specification for: "${request.topic}"
    
Style preference: ${request.style || 'interactive'}
Complexity: ${request.complexity || 'medium'}
${request.features ? `Additional features: ${request.features.join(', ')}` : ''}`;

    // If PDF content is provided, include it for more precise simulation
    if (request.pdfContent) {
      plannerInput += `

=== REFERENCE DOCUMENT CONTENT ===
The user has uploaded a PDF document "${request.pdfFileName || 'document.pdf'}" to help create a more precise and accurate simulation.
Use the following content from the document to:
1. Extract specific scientific/technical details mentioned
2. Identify key concepts, processes, or structures to visualize
3. Use exact terminology and relationships from the document
4. Create accurate representations based on the document's descriptions

DOCUMENT CONTENT:
${request.pdfContent.slice(0, 50000)}
=== END OF DOCUMENT ===

IMPORTANT: Base your visualization specification on the actual content from this document. 
Be scientifically accurate and use the specific details provided.`;
    }

    plannerInput += `

Think about what visual elements would best represent this topic educationally.
Create at least 5-10 interactive components with detailed descriptions.`;

    const specification = await callGeminiAgent(PLANNER_AGENT, plannerInput, taskId);

    createSimulationArtifact({
      type: 'spec',
      agentName: 'Planner',
      title: 'Technical Specification',
      content: specification,
    });

    // Step 2: Builder creates the full HTML simulation
    emitSimulationEvent({
      type: 'agent-start',
      agentName: 'Builder',
      taskId,
      message: 'Building Three.js simulation...',
      status: 'in-progress',
    });

    const builderInput = `Create a complete, working 3D educational simulation for: "${request.topic}"

Here is the detailed specification from the planning phase:
${specification}

CRITICAL REQUIREMENTS:
1. Output ONLY the complete HTML file - start directly with <!DOCTYPE html>
2. DO NOT wrap output in markdown code fences
3. FULLY implement createScene() with ALL the specified components
4. FULLY implement updateAnimations() with proper animations
5. Make ALL objects interactive with hover/click
6. The simulation must be visually impressive and educational
7. Use the Light Mode "Modern Academic" aesthetic
8. Include the glassmorphism info panel and pill-shaped controls bar
9. Each component must have: title, category, description stored in objectData`;

    const htmlOutput = await callGeminiAgent(BUILDER_AGENT, builderInput, taskId);
    const cleanedHtml = cleanHtmlOutput(htmlOutput);

    createSimulationArtifact({
      type: 'final',
      agentName: 'Builder',
      title: 'Final Simulation',
      content: cleanedHtml,
    });

    // Extract title from specification if possible
    let title = request.topic;
    try {
      const specJson = JSON.parse(specification.replace(/```json\n?|\n?```/g, ''));
      title = specJson.title || request.topic;
    } catch {
      // Use default title
    }

    const output: SimulationOutput = {
      id: taskId,
      title,
      htmlContent: cleanedHtml,
      artifacts: getSimulationArtifacts(),
      createdAt: new Date(),
    };

    emitSimulationEvent({
      type: 'simulation-ready',
      agentName: 'Orchestrator',
      taskId,
      message: 'Simulation generated successfully!',
      status: 'completed',
      data: output,
    });

    return output;

  } catch (error) {
    emitSimulationEvent({
      type: 'agent-error',
      agentName: 'Orchestrator',
      taskId,
      message: `Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      status: 'error',
    });
    throw error;
  }
};

// ==========================================
// Exports
// ==========================================

export const simulationAgents: Map<string, SimulationAgentDefinition> = new Map([
  ['planner', PLANNER_AGENT],
  ['builder', BUILDER_AGENT],
]);

export const getAgentDefinitions = (): SimulationAgentDefinition[] => {
  return Array.from(simulationAgents.values());
};

export const getAgentByName = (name: string): SimulationAgentDefinition | undefined => {
  return simulationAgents.get(name.toLowerCase());
};
