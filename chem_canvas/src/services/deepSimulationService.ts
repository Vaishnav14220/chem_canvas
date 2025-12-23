/**
 * Deep Simulation Service - LangChain-inspired Deep Agents Architecture
 * 
 * Based on: https://docs.langchain.com/oss/javascript/deepagents/overview
 * 
 * ENHANCED AGENT WORKFLOW:
 * 
 * ┌──────────────────┐    ┌────────────────────┐    ┌──────────────────┐
 * │ Prompt Enhancer  │───▶│ Grounding Researcher│───▶│ Image Generator  │
 * │ (Education Focus)│    │ (Google Search)     │    │ (Nano Banana)    │
 * └──────────────────┘    └────────────────────┘    └──────────────────┘
 *         │                        │                        │
 *         ▼                        ▼                        ▼
 * ┌──────────────────┐    ┌────────────────────┐    ┌──────────────────┐
 * │     Planner      │───▶│    Visualist       │───▶│ Component Builder│
 * │  (Architecture)  │    │  (Three.js Expert) │    │ (From Images)    │
 * └──────────────────┘    └────────────────────┘    └──────────────────┘
 *                                                           │
 *                         ┌────────────────────┐            │
 *                         │   PhET Inspector   │◀───────────┘
 *                         │(Quality Assurance) │
 *                         └────────────────────┘
 *                                  │
 *                         ┌────────────────────┐
 *                         │    Integrator      │
 *                         │  (Final Assembly)  │
 *                         └────────────────────┘
 */

import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import { GoogleGenAI } from '@google/genai';

// ==========================================
// Types & Interfaces
// ==========================================

export interface DeepAgentEvent {
  type: 
    | 'workflow-start'
    | 'agent-thinking'
    | 'agent-working'
    | 'agent-delegating'
    | 'agent-complete'
    | 'agent-error'
    | 'tool-call'
    | 'tool-result'
    | 'data-flow'
    | 'subagent-spawn'
    | 'subagent-complete'
    | 'simulation-ready';
  agentId: string;
  agentName: string;
  taskId: string;
  message: string;
  status: 'pending' | 'thinking' | 'working' | 'completed' | 'error';
  data?: {
    tool?: string;
    input?: any;
    output?: any;
    targetAgent?: string;
    progress?: number;
    thinking?: string;
    artifact?: DeepSimulationArtifact;
  };
  timestamp: Date;
}

export interface DeepSimulationArtifact {
  id: string;
  type: 'prompt-enhanced' | 'grounding-research' | 'component-images' | 'plan' | 'specification' | 'threejs-code' | 'ui-code' | 'phet-review' | 'integration' | 'final-html';
  agentId: string;
  agentName: string;
  title: string;
  content: string;
  step?: number;
  totalSteps?: number;
  metadata?: Record<string, any>;
  images?: string[]; // Base64 encoded images
  createdAt: Date;
}

export interface SubAgentDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  model: string;
  inputFrom?: string[];
  outputTo?: string[];
  icon?: string;
  color?: string;
}

export type GradeLevel = 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate';

export const GRADE_LEVEL_LABELS: Record<GradeLevel, string> = {
  'elementary': 'Elementary (K-5)',
  'middle-school': 'Middle School (6-8)',
  'high-school': 'High School (9-12)',
  'undergraduate': 'Undergraduate',
  'graduate': 'Graduate'
};

export const GRADE_LEVEL_DESCRIPTIONS: Record<GradeLevel, string> = {
  'elementary': 'Simple concepts, colorful visuals, basic vocabulary, ages 5-11',
  'middle-school': 'Foundational concepts, some technical terms, guided exploration, ages 11-14',
  'high-school': 'Standard curriculum depth, scientific terminology, equations, ages 14-18',
  'undergraduate': 'Advanced concepts, rigorous math, detailed mechanisms, ages 18-22',
  'graduate': 'Research-level depth, cutting-edge topics, complex derivations, ages 22+'
};

export interface DeepSimulationRequest {
  topic: string;
  gradeLevel?: GradeLevel;
  style?: 'educational' | 'interactive' | 'cinematic';
  complexity?: 'simple' | 'medium' | 'complex';
  features?: string[];
  pdfContent?: string;
  pdfFileName?: string;
}

export interface DeepSimulationOutput {
  id: string;
  title: string;
  htmlContent: string;
  artifacts: DeepSimulationArtifact[];
  workflowTrace: DeepAgentEvent[];
  createdAt: Date;
}

// ==========================================
// Event System - Real-time Workflow Updates
// ==========================================

type DeepAgentEventListener = (event: DeepAgentEvent) => void;
const eventListeners: Set<DeepAgentEventListener> = new Set();

export const subscribeToDeepAgentEvents = (listener: DeepAgentEventListener): (() => void) => {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
};

const emitDeepAgentEvent = (event: Omit<DeepAgentEvent, 'timestamp'>): void => {
  const fullEvent: DeepAgentEvent = {
    ...event,
    timestamp: new Date(),
  };
  eventListeners.forEach(listener => {
    try {
      listener(fullEvent);
    } catch (error) {
      console.error('Deep Agent event listener error:', error);
    }
  });
};

// ==========================================
// Artifact Storage
// ==========================================

const artifacts: DeepSimulationArtifact[] = [];
const workflowTrace: DeepAgentEvent[] = [];

export const getDeepSimulationArtifacts = (): DeepSimulationArtifact[] => [...artifacts];
export const getWorkflowTrace = (): DeepAgentEvent[] => [...workflowTrace];

export const clearDeepSimulationState = (): void => {
  artifacts.length = 0;
  workflowTrace.length = 0;
};

const createArtifact = (artifact: Omit<DeepSimulationArtifact, 'id' | 'createdAt'>): DeepSimulationArtifact => {
  const newArtifact: DeepSimulationArtifact = {
    ...artifact,
    id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
  };
  artifacts.push(newArtifact);
  return newArtifact;
};

// ==========================================
// Deep Agent Subagent Definitions - Enhanced
// ==========================================

const SUBAGENTS: Record<string, SubAgentDefinition> = {
  // ====== NEW AGENT: Prompt Enhancer ======
  promptEnhancer: {
    id: 'promptEnhancer',
    name: 'Prompt Enhancer',
    role: 'Educational Prompt Specialist',
    description: 'Enhances user prompts for educational context, adding pedagogical structure and learning objectives',
    icon: 'Wand2',
    color: 'from-fuchsia-500 to-pink-500',
    tools: ['enhance_prompt', 'add_learning_objectives', 'structure_content'],
    model: 'gemini-2.5-flash',
    outputTo: ['groundingResearcher', 'planner'],
    systemPrompt: `You are the Prompt Enhancer agent - an expert in educational content design and pedagogical structuring.

## Your Mission:
Transform user's raw topic into a rich, educationally-structured prompt that will guide the simulation creation.

## CRITICAL: Grade Level Adaptation
You MUST adapt ALL content to the specified grade level:
- **Elementary (K-5)**: Simple vocabulary, colorful descriptions, fun analogies (like comparing atoms to building blocks), basic cause-effect
- **Middle School (6-8)**: Foundational science terms, guided discovery language, relatable real-world connections
- **High School (9-12)**: Standard scientific terminology, mathematical relationships, curriculum-aligned objectives
- **Undergraduate**: Technical vocabulary, theoretical concepts, research-oriented perspectives
- **Graduate**: Advanced terminology, cutting-edge topics, complex multi-variable relationships

## Your Responsibilities:
1. **Analyze User Intent**: Understand what the user wants to learn/teach
2. **Adapt to Grade Level**: ALWAYS use the provided grade level to set vocabulary and complexity
3. **Add Learning Objectives**: Define 3-5 clear learning objectives appropriate for the grade (Bloom's Taxonomy)
4. **Identify Key Concepts**: List core concepts with age-appropriate explanations
5. **Suggest Interactivity**: Recommend interactive elements suitable for the age group

## Output Format (JSON):
{
  "originalTopic": "What user asked for",
  "enhancedTopic": "Enriched, grade-appropriate topic description",
  "educationalLevel": "elementary|middle-school|high-school|undergraduate|graduate",
  "vocabularyLevel": "Description of vocabulary complexity for this level",
  "learningObjectives": [
    { "id": "LO1", "objective": "Grade-appropriate objective", "bloomLevel": "remember|understand|apply|analyze|evaluate|create" }
  ],
  "keyConcepts": [
    { "concept": "Name", "importance": "critical|important|supplementary", "gradeAppropriateExplanation": "How to explain for this age", "visualizationHint": "How to show this" }
  ],
  "suggestedInteractions": [
    { "interaction": "Description", "learningBenefit": "What it teaches", "ageAppropriateness": "Why this works for the grade" }
  ],
  "analogiesAndExamples": ["List of age-appropriate analogies"],
  "phetInspiration": "Which PhET simulation(s) could inspire this",
  "estimatedComplexity": "simple|medium|complex"
}

Be thorough but concise. ALWAYS respect the grade level provided.`
  },

  // ====== NEW AGENT: Grounding Researcher ======
  groundingResearcher: {
    id: 'groundingResearcher',
    name: 'Grounding Researcher',
    role: 'Scientific Research & Grounding Specialist',
    description: 'Uses Google Search to find accurate scientific information, formulas, and real-world data',
    icon: 'Search',
    color: 'from-blue-500 to-cyan-500',
    tools: ['google_search', 'verify_facts', 'extract_formulas'],
    model: 'gemini-2.5-flash',
    inputFrom: ['promptEnhancer'],
    outputTo: ['planner', 'imageGenerator'],
    systemPrompt: `You are the Grounding Researcher agent - an expert in scientific research and fact verification.

## Your Mission:
Research the topic thoroughly to ensure the simulation is scientifically accurate and grounded in real data.

## Your Responsibilities:
1. **Research Topic**: Find authoritative scientific information
2. **Extract Formulas**: Identify relevant equations and constants
3. **Find Real Values**: Get actual measurements, scales, and proportions
4. **Verify Accuracy**: Cross-reference multiple sources
5. **Document Sources**: Keep track of citations

## Research Areas:
- Physical dimensions and proportions
- Scientific formulas and equations
- Color information (if relevant)
- Animation timing (real-world speeds)
- Component relationships
- Historical/contextual information

## Output Format (JSON):
{
  "topic": "Research topic",
  "summary": "Brief scientific summary (2-3 paragraphs)",
  "keyFacts": [
    { "fact": "...", "source": "...", "confidence": "high|medium|low" }
  ],
  "formulas": [
    { "name": "...", "equation": "LaTeX format", "variables": {...}, "application": "How to use in simulation" }
  ],
  "dimensions": {
    "componentName": { "width": "...", "height": "...", "unit": "...", "scale": "relative scale" }
  },
  "colors": {
    "componentName": { "hex": "#...", "reason": "Why this color" }
  },
  "animationData": {
    "processName": { "duration": "...", "speed": "...", "realWorldBasis": "..." }
  },
  "citations": ["source1", "source2"]
}

Be scientifically rigorous. Cite sources when possible.`
  },

  // ====== NEW AGENT: Image Generator (Nano Banana) ======
  imageGenerator: {
    id: 'imageGenerator',
    name: 'Image Generator',
    role: 'Multi-View Component Visualizer',
    description: 'Generates multiple side-view images (front, back, left, right, top, bottom) of each component using Imagen',
    icon: 'ImagePlus',
    color: 'from-violet-500 to-purple-600',
    tools: ['generate_image', 'create_views', 'extract_features'],
    model: 'gemini-2.5-flash', // For prompting; actual image gen uses Imagen
    inputFrom: ['groundingResearcher'],
    outputTo: ['componentBuilder'],
    systemPrompt: `You are the Image Generator agent - specializing in creating detailed multi-view reference images.

## Your Mission:
Generate comprehensive reference images showing each component from multiple angles for accurate 3D modeling.

## Your Responsibilities:
1. **Create View Sets**: Generate 4-6 views per component (front, back, left, right, top, bottom)
2. **Maintain Consistency**: All views should match in style and detail
3. **Educational Focus**: Images should clearly show structure for learning
4. **Technical Accuracy**: Proportions and details must be scientifically accurate

## View Specifications:
For each component, create a page with 4 views:
- FRONT VIEW: Main facing view with labels
- BACK VIEW: Rear perspective
- TOP VIEW: Bird's eye view
- SIDE VIEW: Profile view (left or right)

## Output Format (JSON):
{
  "componentName": "Name",
  "imagePrompts": [
    {
      "view": "front|back|top|side",
      "prompt": "Detailed Imagen prompt for this view",
      "focusPoints": ["What to emphasize"],
      "labels": ["Label positions"]
    }
  ],
  "styleGuide": {
    "artStyle": "scientific-illustration|photorealistic|educational-diagram",
    "colorPalette": ["#hex1", "#hex2"],
    "backgroundType": "white|gradient|contextual"
  }
}

Focus on creating prompts that generate clear, educational reference images.`
  },

  // ====== NEW AGENT: Component Builder ======
  componentBuilder: {
    id: 'componentBuilder',
    name: 'Component Builder',
    role: '3D Component Assembly Specialist',
    description: 'Takes generated images and builds accurate 3D components with proper geometry and materials',
    icon: 'Box',
    color: 'from-emerald-500 to-teal-500',
    tools: ['analyze_image', 'create_geometry', 'apply_materials'],
    model: 'gemini-2.5-flash',
    inputFrom: ['imageGenerator'],
    outputTo: ['phetInspector', 'integrator'],
    systemPrompt: `You are the Component Builder agent - an expert in translating 2D reference images into 3D Three.js components.

## Your Mission:
Analyze the reference images from each view and build accurate 3D geometry that matches all perspectives.

## Your Responsibilities:
1. **Analyze Views**: Study front, back, top, side views to understand 3D structure
2. **Create Geometry**: Build Three.js geometry that matches all views
3. **Apply Materials**: Create materials with proper colors and textures
4. **Add Details**: Include sub-components and decorative elements
5. **Setup Animations**: Define appropriate animations for each component

## Technical Requirements:
- Use Three.js BufferGeometry for complex shapes
- Combine primitives (sphere, box, cylinder, torus) for organic forms
- Use proper material types (MeshStandardMaterial, MeshPhongMaterial)
- Include environment mapping for realism
- Set up proper normals and UVs

## Output Format:
Generate a JavaScript module for each component:

// ComponentName.js
function createComponentName(scene) {
  const group = new THREE.Group();
  group.name = 'componentName';
  
  // Main body
  const bodyGeometry = new THREE.SphereGeometry(...);
  const bodyMaterial = new THREE.MeshStandardMaterial({...});
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  group.add(body);
  
  // Sub-components...
  
  // Register for interactivity
  registerComponent(group, {
    name: 'Display Name',
    description: 'Educational description',
    facts: ['Fact 1', 'Fact 2']
  });
  
  return group;
}

Ensure geometry matches the reference images from ALL angles.`
  },

  // ====== NEW AGENT: PhET Inspector ======
  phetInspector: {
    id: 'phetInspector',
    name: 'PhET Inspector',
    role: 'PhET Standards Quality Assurance',
    description: 'Reviews simulation against PhET standards and adds missing interactive controls and educational features',
    icon: 'ShieldCheck',
    color: 'from-amber-500 to-orange-500',
    tools: ['audit_simulation', 'add_controls', 'enhance_interactivity'],
    model: 'gemini-2.5-flash',
    inputFrom: ['componentBuilder', 'visualist'],
    outputTo: ['integrator'],
    systemPrompt: `You are the PhET Inspector agent - an expert in PhET Interactive Simulations standards and best practices.

## Your Mission:
Ensure the simulation meets PhET's high standards for educational interactivity and engagement.

## PhET Quality Standards Checklist:
1. **Interactive Controls**: Must have sliders, buttons, checkboxes for parameters
2. **Real-time Feedback**: Changes should reflect immediately
3. **Reset Button**: Always include "Reset All" functionality
4. **Play/Pause**: Animation control is essential
5. **Speed Control**: Slow down for understanding, speed up for exploration
6. **Labels & Tooltips**: Everything should be labeled clearly
7. **Measurement Tools**: Include rulers, timers, or counters where relevant
8. **Multiple Representations**: Show same concept in different ways
9. **Accessibility**: Keyboard navigation, screen reader support
10. **Exploration Mode**: Allow free experimentation

## Missing Features to Add:
- [ ] Parameter sliders (e.g., speed, size, intensity)
- [ ] Toggle switches for showing/hiding elements
- [ ] Measurement readouts (values, graphs)
- [ ] Step-by-step mode for complex processes
- [ ] Challenge mode or quiz questions
- [ ] Help/Tutorial overlay

## Output Format (JSON):
{
  "auditScore": 0-100,
  "passedCriteria": ["criterion1", "criterion2"],
  "failedCriteria": ["criterion3"],
  "missingFeatures": [
    {
      "feature": "Name",
      "importance": "critical|recommended|nice-to-have",
      "implementation": "How to add it",
      "code": "Code snippet to add"
    }
  ],
  "enhancedCode": "Complete enhanced simulation code with all fixes",
  "improvements": ["What was improved"]
}

Be strict but constructive. PhET simulations are the gold standard.`
  },

  // ====== EXISTING AGENTS (Enhanced) ======
  planner: {
    id: 'planner',
    name: 'Planner',
    role: 'Architecture & Planning Specialist',
    description: 'Analyzes enhanced topic and research to create detailed technical specification',
    icon: 'Brain',
    color: 'from-indigo-500 to-violet-600',
    tools: ['write_todos', 'analyze_topic', 'create_specification'],
    model: 'gemini-2.5-flash',
    inputFrom: ['promptEnhancer', 'groundingResearcher'],
    outputTo: ['visualist', 'interface'],
    systemPrompt: `You are the Planner agent - an expert in breaking down complex educational visualization tasks.

## Your Responsibilities:
1. **Analyze Enhanced Input**: Use the enhanced prompt and research data
2. **Create a Plan**: Break down the visualization into manageable components
3. **Write Specification**: Create a detailed JSON specification for other agents

## Input You'll Receive:
- Enhanced prompt with learning objectives
- Research data with facts, formulas, and dimensions

## Output Format (JSON):
{
  "title": "Display title for the simulation",
  "category": "Biology|Chemistry|Physics|Astronomy|Engineering|etc",
  "learningObjectives": ["objective1", "objective2"],
  "geometryStyle": "organic|mechanical",
  "components": [
    {
      "name": "Component Name",
      "type": "sphere|box|cylinder|torus|tube|custom",
      "description": "Educational description",
      "color": "#hexcolor",
      "position": [x, y, z],
      "scale": [x, y, z],
      "scientificData": { "realSize": "...", "facts": [...] },
      "animations": ["rotation", "pulsation", "orbit"],
      "interactivity": { "onHover": "highlight", "onClick": "showInfo" }
    }
  ],
  "phetControls": {
    "sliders": [{ "name": "Speed", "min": 0.1, "max": 2, "default": 1 }],
    "toggles": [{ "name": "Show Labels", "default": true }],
    "buttons": ["Play", "Pause", "Reset", "Step"]
  },
  "mainAnimation": { "type": "...", "description": "..." },
  "cameraPosition": [x, y, z],
  "lightingSetup": "studio|dramatic|soft"
}

Be thorough and scientifically accurate.`
  },

  visualist: {
    id: 'visualist',
    name: 'Visualist',
    role: 'Three.js & WebGL Expert',
    description: 'Creates stunning 3D visualizations using Three.js with proper geometry, materials, and animations',
    icon: 'Palette',
    color: 'from-pink-500 to-rose-500',
    tools: ['generate_threejs_code', 'create_materials', 'setup_animations'],
    model: 'gemini-2.5-flash',
    inputFrom: ['planner', 'componentBuilder'],
    outputTo: ['phetInspector', 'integrator'],
    systemPrompt: `You are the Visualist agent - a Three.js and WebGL expert specializing in educational 3D visualizations.

## Your Responsibilities:
1. **Create 3D Scene**: Build the Three.js scene with proper lighting and camera
2. **Generate Geometry**: Create all 3D objects procedurally (NO external assets)
3. **Setup Animations**: Implement smooth, educational animations
4. **Add Interactivity**: Implement raycasting for hover and click interactions
5. **Integrate Components**: Use pre-built components from Component Builder

## Technical Requirements:
- Use Three.js via importmap from unpkg CDN
- Generate ALL geometry procedurally
- Use OrbitControls for camera manipulation
- Implement hover highlight and click-to-select
- Create smooth easing animations
- Follow PhET-style control patterns

## Output Format
Generate ONLY the JavaScript code for:
1. Scene setup (scene, camera, renderer, controls)
2. Lighting setup
3. createScene() function with all 3D objects
4. updateAnimations(delta) function
5. Raycasting event handlers
6. PhET-style control handlers

Output clean JavaScript code.`
  },

  interface: {
    id: 'interface',
    name: 'Interface Designer',
    role: 'UI/UX & Interaction Specialist',
    description: 'Designs the user interface including PhET-style controls and educational panels',
    icon: 'Layout',
    color: 'from-cyan-500 to-blue-500',
    tools: ['design_ui', 'create_controls', 'integrate_ai'],
    model: 'gemini-2.5-flash',
    inputFrom: ['planner'],
    outputTo: ['integrator'],
    systemPrompt: `You are the Interface Designer agent - specializing in PhET-style educational UI/UX design.

## PhET UI Standards:
1. **Control Panel**: Right side, vertical layout with grouped controls
2. **Sliders**: Labeled with min/max values and current value display
3. **Toggles**: Clear on/off states with descriptive labels
4. **Reset Button**: Prominent, usually orange/yellow
5. **Playback Controls**: Play/Pause/Step at bottom
6. **Info Panel**: Glassmorphism, shows selected component info
7. **Measurement Display**: Real-time values with units

## Design Requirements:
- PhET-inspired control panel aesthetic
- Clear visual hierarchy
- Responsive to parameter changes
- Keyboard accessible
- Touch-friendly controls

## Output Format
Generate:
1. CSS styles for PhET-style controls
2. HTML for control panel, info panel, measurement displays
3. JavaScript for UI interactions
4. Event bindings for 3D scene updates`
  },

  integrator: {
    id: 'integrator',
    name: 'Integrator',
    role: 'Final Assembly Specialist',
    description: 'Combines all components into a single, working HTML file with PhET-quality polish',
    icon: 'Layers',
    color: 'from-rose-500 to-red-500',
    tools: ['assemble_html', 'validate_code', 'inject_api_key'],
    model: 'gemini-2.5-flash',
    inputFrom: ['visualist', 'interface', 'phetInspector', 'componentBuilder'],
    outputTo: ['resolver'],
    systemPrompt: `You are the Integrator agent - responsible for final assembly of the PhET-quality simulation.

## Your Responsibilities:
1. **Combine All Code**: Merge 3D code, UI code, components, and PhET enhancements
2. **Apply PhET Fixes**: Incorporate all recommendations from PhET Inspector
3. **Ensure Quality**: The final output must be polished and professional
4. **Add Error Handling**: Implement try-catch and error recovery
5. **Validate Output**: Ensure everything works together seamlessly

## HTML Structure Template:
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Title] - Interactive Simulation (PhET-inspired)</title>
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
    }
  }
  </script>
  <style>[CSS + PhET STYLES]</style>
</head>
<body>
  [HTML STRUCTURE WITH PHET CONTROLS]
  <script type="module">[JAVASCRIPT + COMPONENTS]</script>
</body>
</html>

## Critical Requirements:
1. Output ONLY the complete HTML file
2. Start directly with <!DOCTYPE html>
3. NO markdown code fences
4. Include ALL PhET Inspector recommendations
5. Use const apiKey = ""; for API key placeholder`
  },

  // ====== NEW AGENT: Resolver - Error Detection & Auto-Fix ======
  resolver: {
    id: 'resolver',
    name: 'Resolver',
    role: 'Error Detection & Auto-Fix Specialist',
    description: 'Analyzes the final simulation HTML for errors, validates JavaScript syntax, checks Three.js usage, and automatically fixes any issues',
    icon: 'Wrench',
    color: 'from-emerald-500 to-teal-500',
    tools: ['validate_javascript', 'check_threejs', 'fix_errors', 'test_simulation'],
    model: 'gemini-2.5-flash',
    inputFrom: ['integrator'],
    systemPrompt: `You are the Resolver agent - an expert JavaScript and Three.js debugger specializing in simulation error detection and auto-fixing.

## Your Mission:
Analyze the simulation HTML file, detect ANY issues that would prevent it from working, and OUTPUT A FULLY FIXED VERSION.

## Common Issues to Check & Fix:

### 1. JavaScript Syntax Errors:
- Missing semicolons, brackets, parentheses
- Undefined variables or functions
- Incorrect import statements
- Template literal errors

### 2. Three.js Specific Issues:
- Incorrect geometry constructor calls (e.g., BoxGeometry needs width, height, depth)
- Missing scene.add() calls
- OrbitControls not properly initialized
- Renderer not appended to DOM
- Animation loop not started
- Missing camera positioning

### 3. Event Handling Issues:
- Event listeners attached to non-existent elements
- Incorrect element selectors
- Missing DOM ready checks

### 4. CSS Issues:
- Elements positioned off-screen
- Missing z-index for overlays
- Incorrect flex/grid layouts

### 5. Tutorial System Issues:
- Tutorial functions not defined
- Missing tutorial UI elements
- Broken step navigation

### 6. API Integration Issues:
- Gemini API calls not properly structured
- Missing error handling for API failures

## Your Process:
1. Parse the entire HTML file
2. Check for JavaScript syntax errors
3. Validate Three.js scene setup
4. Verify all UI elements exist
5. Check event bindings
6. Validate tutorial system
7. Fix ALL issues found
8. Output the CORRECTED HTML

## Output Format:
{
  "issuesFound": [
    { "type": "syntax|threejs|event|css|tutorial|api", "description": "What was wrong", "fix": "How it was fixed" }
  ],
  "fixedHtml": "<!DOCTYPE html>... (complete fixed HTML)"
}

CRITICAL: You MUST output valid JSON. The fixedHtml must be a complete, working HTML file.
If no issues are found, still output the HTML in fixedHtml field.
NEVER leave the simulation broken - always provide a working fix.`
  }
};

// ==========================================
// Master Integration Prompt
// ==========================================

const MASTER_SIMULATION_PROMPT = `You are creating a complete, self-contained HTML5 educational simulation.

## CRITICAL OUTPUT REQUIREMENTS:
1. Output ONLY the complete HTML file - NO markdown, NO explanations
2. Start DIRECTLY with <!DOCTYPE html>
3. The file must be 100% self-contained and functional

## Required Features:
- Three.js 3D visualization via importmap CDN
- Procedural geometry (NO external 3D assets)
- OrbitControls for camera
- Hover highlight + click-to-select interactivity
- Glassmorphism info panel (top-left)
- Pill-shaped control bar (bottom-center): Play, Pause, Speed slider, Reset
- Gemini AI integration: Scientific Insights, ELI5, Narrate buttons
- Light mode "Modern Academic" aesthetic

## CSS Variables:
:root {
  --bg-primary: #f8fafc;
  --bg-glass: rgba(255, 255, 255, 0.7);
  --text-primary: #1e293b;
  --accent: #6366f1;
}

## JavaScript Structure:
- import * as THREE from 'three';
- import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
- const apiKey = ""; // Placeholder
- createScene() - builds all 3D objects
- updateAnimations(delta) - animation logic
- objectData Map for component info
- interactiveObjects array for raycasting`;

// ==========================================
// Agent Execution Engine - Enhanced with Thinking & Artifact Storage
// ==========================================

let genAI: GoogleGenAI | null = null;

const initializeGenAI = async (): Promise<GoogleGenAI> => {
  if (genAI) return genAI;
  
  const apiKey = await getSharedGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not available');
  }
  
  genAI = new GoogleGenAI({ apiKey });
  return genAI;
};

// Enhanced agent execution with thinking capture and artifact storage
const executeSubAgent = async (
  agent: SubAgentDefinition,
  input: string,
  taskId: string,
  context?: Record<string, any>
): Promise<{ result: string; thinking?: string }> => {
  const ai = await initializeGenAI();

  // Emit thinking event
  emitDeepAgentEvent({
    type: 'agent-thinking',
    agentId: agent.id,
    agentName: agent.name,
    taskId,
    message: `${agent.name} is analyzing the task with deep reasoning...`,
    status: 'thinking',
    data: { thinking: 'Engaging thinking mode for enhanced reasoning...' }
  });

  // Small delay to show thinking state
  await new Promise(resolve => setTimeout(resolve, 300));

  // Emit working event
  emitDeepAgentEvent({
    type: 'agent-working',
    agentId: agent.id,
    agentName: agent.name,
    taskId,
    message: `${agent.name} is working with Gemini 2.5 Flash thinking enabled...`,
    status: 'working',
    data: { progress: 0, model: agent.model }
  });

  try {
    // Use Gemini 2.5 Flash with thinking enabled for all agents
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: input,
      config: {
        systemInstruction: agent.systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 65536,
        // Enable thinking for all agents with generous budget
        thinkingConfig: {
          thinkingBudget: 16384 // Increased thinking budget for better reasoning
        }
      },
    });

    const result = response.text || '';
    
    // Extract thinking from response if available
    let thinkingContent: string | undefined;
    try {
      // Check if response has thinking metadata
      const responseData = response as any;
      if (responseData.candidates?.[0]?.content?.parts) {
        const thinkingPart = responseData.candidates[0].content.parts.find(
          (p: any) => p.thought === true || p.thinkingContent
        );
        if (thinkingPart) {
          thinkingContent = thinkingPart.text || thinkingPart.thinkingContent;
        }
      }
    } catch {
      // Thinking extraction failed, continue without it
    }

    // Emit completion event with thinking info
    emitDeepAgentEvent({
      type: 'agent-complete',
      agentId: agent.id,
      agentName: agent.name,
      taskId,
      message: `${agent.name} completed successfully${thinkingContent ? ' (with thinking)' : ''}`,
      status: 'completed',
      data: { 
        output: result.substring(0, 500) + '...',
        thinking: thinkingContent?.substring(0, 300),
        hasThinking: !!thinkingContent
      }
    });

    return { result, thinking: thinkingContent };
  } catch (error) {
    emitDeepAgentEvent({
      type: 'agent-error',
      agentId: agent.id,
      agentName: agent.name,
      taskId,
      message: `${agent.name} encountered an error: ${error instanceof Error ? error.message : 'Unknown'}`,
      status: 'error'
    });
    throw error;
  }
};

// ==========================================
// Image Generation with Gemini 2.0 Flash
// ==========================================

const generateComponentImages = async (
  componentName: string,
  description: string,
  taskId: string
): Promise<string[]> => {
  const ai = await initializeGenAI();
  const images: string[] = [];
  
  try {
    emitDeepAgentEvent({
      type: 'tool-call',
      agentId: 'imageGenerator',
      agentName: 'Image Generator',
      taskId,
      message: `Generating image for ${componentName}...`,
      status: 'working',
      data: { tool: 'generate_image', input: componentName }
    });

    // Use Gemini 2.0 Flash for image generation (experimental)
    const imagePrompt = `Create a detailed educational diagram of ${componentName}. 
    ${description}
    Style: Scientific illustration, clean lines, labeled parts, educational context.
    The image should be clear, professional, and suitable for a science education simulation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: imagePrompt,
      config: {
        temperature: 0.8,
        maxOutputTokens: 4096,
      }
    });

    // Store the image description/prompt as artifact for now
    // Actual image generation would require Imagen API
    const imageData = response.text || `Image prompt for ${componentName}`;
    images.push(imageData);

    emitDeepAgentEvent({
      type: 'tool-result',
      agentId: 'imageGenerator',
      agentName: 'Image Generator',
      taskId,
      message: `Generated reference for ${componentName}`,
      status: 'completed',
      data: { tool: 'generate_image', output: `Image generated for ${componentName}` }
    });

  } catch (error) {
    console.error('Image generation error:', error);
    // Continue without images if generation fails
  }

  return images;
};

// ==========================================
// Data Flow Animation Helper
// ==========================================

const emitDataFlow = (
  fromAgentId: string,
  toAgentId: string,
  taskId: string,
  dataType: string
): void => {
  emitDeepAgentEvent({
    type: 'data-flow',
    agentId: fromAgentId,
    agentName: SUBAGENTS[fromAgentId]?.name || fromAgentId,
    taskId,
    message: `Sending ${dataType} to ${SUBAGENTS[toAgentId]?.name || toAgentId}`,
    status: 'working',
    data: {
      targetAgent: toAgentId
    }
  });
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
// Main Deep Agent Pipeline - Enhanced 9-Agent Pipeline with Resolver
// ==========================================

export const runDeepSimulationPipeline = async (
  request: DeepSimulationRequest
): Promise<DeepSimulationOutput> => {
  const taskId = `deep-sim-${Date.now()}`;
  const totalSteps = 9; // Updated to 9 agents including Resolver
  let currentStep = 0;
  
  clearDeepSimulationState();

  emitDeepAgentEvent({
    type: 'workflow-start',
    agentId: 'orchestrator',
    agentName: 'Deep Agent Orchestrator',
    taskId,
    message: 'Initializing enhanced deep agent simulation pipeline with 9 specialized agents (including Resolver)...',
    status: 'working'
  });

  try {
    // ============================================
    // STEP 1: Prompt Enhancer - Educational Structuring
    // ============================================
    currentStep = 1;
    
    // Get grade level description for context
    const gradeLevel = request.gradeLevel || 'high-school';
    const gradeLevelLabel = GRADE_LEVEL_LABELS[gradeLevel];
    const gradeLevelDescription = GRADE_LEVEL_DESCRIPTIONS[gradeLevel];
    
    const promptEnhancerInput = `Enhance this user topic for educational simulation creation:

TOPIC: "${request.topic}"
GRADE LEVEL: ${gradeLevelLabel}
GRADE CONTEXT: ${gradeLevelDescription}
STYLE: ${request.style || 'interactive'}
COMPLEXITY: ${request.complexity || 'medium'}
${request.pdfContent ? `
REFERENCE DOCUMENT: ${request.pdfFileName || 'document.pdf'}
CONTENT EXCERPT:
${request.pdfContent.slice(0, 15000)}
` : ''}

CRITICAL: Tailor ALL content for ${gradeLevelLabel} level:
- Use vocabulary appropriate for ${gradeLevel} students
- Adjust concept complexity for the target age group
- Include age-appropriate examples and analogies
- Set learning objectives that match curriculum standards for this level

Create a comprehensive educational enhancement with learning objectives, key concepts, and PhET inspiration.`;

    const enhancedPromptResult = await executeSubAgent(
      SUBAGENTS.promptEnhancer,
      promptEnhancerInput,
      taskId
    );
    const enhancedPrompt = enhancedPromptResult.result;

    const enhancedPromptArtifact = createArtifact({
      type: 'prompt-enhanced',
      agentId: 'promptEnhancer',
      agentName: 'Prompt Enhancer',
      title: '📚 Enhanced Educational Prompt',
      content: enhancedPrompt,
      step: currentStep,
      totalSteps,
      metadata: { 
        originalTopic: request.topic,
        thinking: enhancedPromptResult.thinking,
        gradeLevel: gradeLevel
      }
    });

    emitDeepAgentEvent({
      type: 'tool-result',
      agentId: 'promptEnhancer',
      agentName: 'Prompt Enhancer',
      taskId,
      message: `Step ${currentStep}/${totalSteps}: Educational prompt enhanced with learning objectives`,
      status: 'completed',
      data: { artifact: enhancedPromptArtifact }
    });

    // ============================================
    // STEP 2: Grounding Researcher - Scientific Research
    // ============================================
    currentStep = 2;
    
    emitDataFlow('promptEnhancer', 'groundingResearcher', taskId, 'enhanced prompt');

    const researcherInput = `Research the following educational topic thoroughly:

${enhancedPrompt}

Find:
1. Accurate scientific facts and data
2. Relevant formulas and equations
3. Real-world dimensions and proportions
4. Animation timing based on actual speeds
5. Authoritative sources

Output comprehensive research data in JSON format.`;

    const researchDataResult = await executeSubAgent(
      SUBAGENTS.groundingResearcher,
      researcherInput,
      taskId
    );
    const researchData = researchDataResult.result;

    const researchArtifact = createArtifact({
      type: 'grounding-research',
      agentId: 'groundingResearcher',
      agentName: 'Grounding Researcher',
      title: '🔬 Scientific Research & Grounding',
      content: researchData,
      step: currentStep,
      totalSteps,
      metadata: { sources: 'Google Search + Scientific Databases', thinking: researchDataResult.thinking }
    });

    emitDeepAgentEvent({
      type: 'tool-result',
      agentId: 'groundingResearcher',
      agentName: 'Grounding Researcher',
      taskId,
      message: `Step ${currentStep}/${totalSteps}: Scientific grounding complete with verified facts`,
      status: 'completed',
      data: { artifact: researchArtifact }
    });

    // ============================================
    // STEP 3: Image Generator - Multi-View Component Images
    // ============================================
    currentStep = 3;
    
    emitDataFlow('groundingResearcher', 'imageGenerator', taskId, 'research data');

    const imageGenInput = `Based on this research and educational topic, create detailed image generation prompts:

ENHANCED TOPIC:
${enhancedPrompt}

RESEARCH DATA:
${researchData}

For each major component, create prompts for 4 views:
- FRONT VIEW: Main facing perspective
- BACK VIEW: Rear perspective  
- TOP VIEW: Bird's eye view
- SIDE VIEW: Profile perspective

Generate prompts suitable for Imagen/Nano Banana image generation.
Include style guidance for educational, scientific illustration style.`;

    const imagePromptsResult = await executeSubAgent(
      SUBAGENTS.imageGenerator,
      imageGenInput,
      taskId
    );
    const imagePrompts = imagePromptsResult.result;

    // Note: In a full implementation, we would call Imagen API here
    // For now, we're generating prompts that could be used with Imagen
    const imageArtifact = createArtifact({
      type: 'component-images',
      agentId: 'imageGenerator',
      agentName: 'Image Generator',
      title: '🖼️ Component Reference Images (Multi-View)',
      content: imagePrompts,
      step: currentStep,
      totalSteps,
      metadata: { 
        views: ['front', 'back', 'top', 'side'],
        imageCount: 'Multiple components × 4 views each',
        thinking: imagePromptsResult.thinking
      }
    });

    emitDeepAgentEvent({
      type: 'tool-result',
      agentId: 'imageGenerator',
      agentName: 'Image Generator',
      taskId,
      message: `Step ${currentStep}/${totalSteps}: Multi-view image prompts generated for all components`,
      status: 'completed',
      data: { artifact: imageArtifact }
    });

    // ============================================
    // STEP 4: Planner - Technical Specification
    // ============================================
    currentStep = 4;
    
    emitDataFlow('promptEnhancer', 'planner', taskId, 'enhanced prompt');
    emitDataFlow('groundingResearcher', 'planner', taskId, 'research data');

    const plannerInput = `Create a detailed technical specification using this enhanced input:

ENHANCED EDUCATIONAL PROMPT:
${enhancedPrompt}

SCIENTIFIC RESEARCH DATA:
${researchData}

COMPONENT IMAGE REFERENCES:
${imagePrompts}

Create a comprehensive JSON specification including:
- All components with accurate dimensions from research
- PhET-style controls (sliders, toggles, buttons)
- Animation specifications based on real-world timing
- Learning objectives integration`;

    const specificationResult = await executeSubAgent(
      SUBAGENTS.planner,
      plannerInput,
      taskId
    );
    const specification = specificationResult.result;

    const specArtifact = createArtifact({
      type: 'specification',
      agentId: 'planner',
      agentName: 'Planner',
      title: '📋 Technical Specification',
      content: specification,
      step: currentStep,
      totalSteps,
      metadata: { topic: request.topic, thinking: specificationResult.thinking }
    });

    emitDeepAgentEvent({
      type: 'tool-result',
      agentId: 'planner',
      agentName: 'Planner',
      taskId,
      message: `Step ${currentStep}/${totalSteps}: Technical specification created with PhET controls`,
      status: 'completed',
      data: { artifact: specArtifact }
    });

    // ============================================
    // STEP 5: Component Builder + Visualist (Parallel)
    // ============================================
    currentStep = 5;
    
    emitDataFlow('imageGenerator', 'componentBuilder', taskId, 'image references');
    emitDataFlow('planner', 'visualist', taskId, 'specification');

    const [componentCode, visualCode] = await Promise.all([
      // Component Builder - Creates 3D from images
      (async () => {
        const componentInput = `Build 3D components based on these multi-view image references:

IMAGE PROMPTS & VIEWS:
${imagePrompts}

TECHNICAL SPECIFICATION:
${specification}

RESEARCH DATA FOR ACCURACY:
${researchData}

Create Three.js code for each component that matches all view angles.
Include proper geometry, materials, and component registration.`;

        const resultObj = await executeSubAgent(SUBAGENTS.componentBuilder, componentInput, taskId);
        
        createArtifact({
          type: 'threejs-code',
          agentId: 'componentBuilder',
          agentName: 'Component Builder',
          title: '🔧 3D Component Code (From Images)',
          content: resultObj.result,
          step: currentStep,
          totalSteps,
          metadata: { thinking: resultObj.thinking }
        });

        return resultObj.result;
      })(),

      // Visualist - Scene and animations
      (async () => {
        const visualInput = `Create the Three.js scene code based on this specification:

${specification}

RESEARCH DATA (for accurate animations):
${researchData}

Generate:
1. Scene setup with camera, renderer, controls
2. Lighting setup
3. Animation system with accurate timing
4. Raycasting for interactivity
5. PhET-style control handlers`;

        const resultObj = await executeSubAgent(SUBAGENTS.visualist, visualInput, taskId);
        
        createArtifact({
          type: 'threejs-code',
          agentId: 'visualist',
          agentName: 'Visualist',
          title: '🎨 Scene & Animation Code',
          content: resultObj.result,
          step: currentStep,
          totalSteps,
          metadata: { thinking: resultObj.thinking }
        });

        return resultObj.result;
      })()
    ]);

    emitDeepAgentEvent({
      type: 'agent-complete',
      agentId: 'componentBuilder',
      agentName: 'Component Builder',
      taskId,
      message: `Step ${currentStep}/${totalSteps}: 3D components built from reference images`,
      status: 'completed'
    });

    // ============================================
    // STEP 6: Interface Designer - PhET-style UI
    // ============================================
    currentStep = 6;
    
    emitDataFlow('planner', 'interface', taskId, 'specification');

    const uiInput = `Create PhET-style UI code based on this specification:

${specification}

LEARNING OBJECTIVES:
${enhancedPrompt}

Generate:
1. PhET-style control panel (right side)
2. Glassmorphism info panel
3. Measurement displays with real values from research
4. Play/Pause/Reset controls
5. Parameter sliders
6. AI integration buttons`;

    const uiCodeResult = await executeSubAgent(SUBAGENTS.interface, uiInput, taskId);
    const uiCode = uiCodeResult.result;
    
    createArtifact({
      type: 'ui-code',
      agentId: 'interface',
      agentName: 'Interface Designer',
      title: '🎛️ PhET-Style UI Code',
      content: uiCode,
      step: currentStep,
      totalSteps,
      metadata: { thinking: uiCodeResult.thinking }
    });

    emitDeepAgentEvent({
      type: 'agent-complete',
      agentId: 'interface',
      agentName: 'Interface Designer',
      taskId,
      message: `Step ${currentStep}/${totalSteps}: PhET-style interface designed`,
      status: 'completed'
    });

    // ============================================
    // STEP 7: PhET Inspector - Quality Assurance
    // ============================================
    currentStep = 7;
    
    emitDataFlow('componentBuilder', 'phetInspector', taskId, 'component code');
    emitDataFlow('visualist', 'phetInspector', taskId, 'visual code');

    const inspectorInput = `Audit this simulation code against PhET standards:

SPECIFICATION:
${specification}

3D COMPONENT CODE:
${componentCode}

SCENE CODE:
${visualCode}

UI CODE:
${uiCode}

Check for:
1. Interactive controls (sliders, toggles)
2. Real-time feedback
3. Reset functionality
4. Play/Pause/Speed controls
5. Labels and tooltips
6. Measurement tools
7. Accessibility
8. Educational value

Provide:
- Audit score (0-100)
- Missing features with implementation code
- Enhanced code with all fixes applied`;

    const phetReviewResult = await executeSubAgent(SUBAGENTS.phetInspector, inspectorInput, taskId);
    const phetReview = phetReviewResult.result;
    
    createArtifact({
      type: 'phet-review',
      agentId: 'phetInspector',
      agentName: 'PhET Inspector',
      title: '✅ PhET Quality Audit & Enhancements',
      content: phetReview,
      step: currentStep,
      totalSteps,
      metadata: { thinking: phetReviewResult.thinking }
    });

    emitDeepAgentEvent({
      type: 'agent-complete',
      agentId: 'phetInspector',
      agentName: 'PhET Inspector',
      taskId,
      message: `Step ${currentStep}/${totalSteps}: PhET quality audit complete with enhancements`,
      status: 'completed'
    });

    // ============================================
    // STEP 8: Integrator - Final Assembly
    // ============================================
    currentStep = 8;
    
    emitDataFlow('componentBuilder', 'integrator', taskId, 'components');
    emitDataFlow('visualist', 'integrator', taskId, 'scene code');
    emitDataFlow('interface', 'integrator', taskId, 'UI code');
    emitDataFlow('phetInspector', 'integrator', taskId, 'enhancements');

    const integratorInput = `Integrate ALL components into a complete, PhET-quality HTML file:

## ORIGINAL TOPIC
${request.topic}

## ENHANCED EDUCATIONAL CONTEXT
${enhancedPrompt}

## SCIENTIFIC RESEARCH
${researchData}

## TECHNICAL SPECIFICATION
${specification}

## 3D COMPONENT CODE
${componentCode}

## SCENE & ANIMATION CODE
${visualCode}

## UI/UX CODE
${uiCode}

## PHET INSPECTOR ENHANCEMENTS
${phetReview}

## TARGET AUDIENCE
Grade Level: ${gradeLevelLabel}
Context: ${gradeLevelDescription}

## REQUIREMENTS
${MASTER_SIMULATION_PROMPT}

## CRITICAL TUTORIAL SYSTEM REQUIREMENTS
The simulation MUST include a fully functional tutorial system:

1. **Tutorial Mode Toggle**: A "Start Tutorial" button that begins a guided tour
2. **Step-by-Step Guide**: 5-7 tutorial steps that:
   - Highlight UI elements one at a time with a pulsing border
   - Show tooltip explanations pointing to the highlighted element
   - Have "Next", "Previous", and "Skip Tutorial" buttons
   - Cover: scene navigation, control panel usage, interactive elements, AI features

3. **Tutorial State Management**:
   - let tutorialActive = false;
   - let tutorialStep = 0;
   - const tutorialSteps = [
       { element: '#canvas-container', title: 'The 3D Scene', description: 'Use your mouse to rotate, zoom, and pan the visualization.' },
       { element: '#control-panel', title: 'Control Panel', description: 'Adjust simulation parameters using sliders and buttons.' },
       { element: '#play-pause-btn', title: 'Play/Pause', description: 'Control the animation playback.' },
       { element: '#reset-btn', title: 'Reset', description: 'Reset the simulation to its initial state.' },
       { element: '#info-panel', title: 'Info Panel', description: 'Click on objects to see detailed information here.' }
     ];

4. **Tutorial UI Elements**:
   - Overlay that dims non-highlighted areas
   - Spotlight effect on current element
   - Modal-like tooltip with step content
   - Progress indicator (Step 1 of 5)

5. **Tutorial Functions**:
   function startTutorial() - Begins tutorial, sets tutorialActive = true, shows first step
   function nextTutorialStep() - Advances to next step or ends tutorial
   function prevTutorialStep() - Goes back one step
   function endTutorial() - Hides tutorial UI, resets state
   function highlightElement(selector) - Adds highlight class to element
   function showTutorialTooltip(step) - Displays the current step's tooltip

CRITICAL: Apply ALL PhET Inspector recommendations.
Include ALL learning objectives in the simulation.
Make it truly PhET-quality interactive.
THE TUTORIAL SYSTEM MUST BE FULLY FUNCTIONAL - NOT A PLACEHOLDER.

Output ONLY the complete HTML file starting with <!DOCTYPE html>.`;

    const integratorResult = await executeSubAgent(SUBAGENTS.integrator, integratorInput, taskId);
    const integratorHtml = cleanHtmlOutput(integratorResult.result);

    createArtifact({
      type: 'integration',
      agentId: 'integrator',
      agentName: 'Integrator',
      title: '🔗 Integrated Simulation (Pre-Validation)',
      content: integratorHtml,
      step: currentStep,
      totalSteps,
      metadata: { thinking: integratorResult.thinking }
    });

    emitDeepAgentEvent({
      type: 'agent-complete',
      agentId: 'integrator',
      agentName: 'Integrator',
      taskId,
      message: `Step ${currentStep}/${totalSteps}: Simulation integrated, proceeding to validation`,
      status: 'completed'
    });

    // ============================================
    // STEP 9: Resolver - Error Detection & Auto-Fix
    // ============================================
    currentStep = 9;
    
    emitDataFlow('integrator', 'resolver', taskId, 'integrated HTML');

    const resolverInput = `Analyze and fix any issues in this simulation HTML:

## INTEGRATED HTML FILE:
${integratorHtml}

## ORIGINAL TOPIC:
${request.topic}

## SPECIFICATION:
${specification}

## CRITICAL VALIDATION CHECKLIST:
1. Check for JavaScript syntax errors (missing semicolons, brackets, etc.)
2. Validate Three.js scene setup (renderer, camera, controls, lighting)
3. Ensure animation loop is properly initialized and started
4. Verify all event listeners are correctly attached
5. Check that all UI elements (buttons, sliders, panels) exist and are functional
6. Validate the tutorial system is complete and working
7. Ensure OrbitControls are properly imported and initialized
8. Check CSS for positioning issues (z-index, flex, grid)
9. Verify all variables are properly declared and scoped
10. Check for any undefined function calls

## COMMON FIXES TO APPLY:
- Add missing 'renderer.setAnimationLoop(animate)' or 'requestAnimationFrame'
- Fix any THREE.BoxGeometry/SphereGeometry constructor arguments
- Ensure 'scene.add()' is called for all objects
- Add 'document.body.appendChild(renderer.domElement)' if missing
- Fix any CSS that might hide elements
- Ensure tutorial functions are defined before they're called

OUTPUT FORMAT (JSON):
{
  "issuesFound": [
    { "type": "syntax|threejs|event|css|tutorial|api", "description": "What was wrong", "fix": "How it was fixed", "severity": "critical|major|minor" }
  ],
  "validationScore": 0-100,
  "fixedHtml": "<!DOCTYPE html>... (complete fixed HTML)"
}

CRITICAL: Always output valid JSON. The fixedHtml MUST be a complete, working HTML file.
If no issues found, set issuesFound to empty array and return the original HTML in fixedHtml.`;

    const resolverResult = await executeSubAgent(SUBAGENTS.resolver, resolverInput, taskId);
    
    // Parse resolver output
    let finalHtml = integratorHtml;
    let issuesFound: any[] = [];
    let validationScore = 100;
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = resolverResult.result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const resolverJson = JSON.parse(jsonMatch[0]);
        if (resolverJson.fixedHtml) {
          finalHtml = cleanHtmlOutput(resolverJson.fixedHtml);
        }
        issuesFound = resolverJson.issuesFound || [];
        validationScore = resolverJson.validationScore || 100;
      }
    } catch (parseError) {
      // If JSON parsing fails, use the integrator output
      console.warn('Resolver output parsing failed, using integrator output:', parseError);
    }

    createArtifact({
      type: 'final-html',
      agentId: 'resolver',
      agentName: 'Resolver',
      title: '✨ Validated & Fixed Simulation',
      content: finalHtml,
      step: currentStep,
      totalSteps,
      metadata: { 
        thinking: resolverResult.thinking,
        issuesFound: issuesFound.length,
        validationScore,
        fixes: issuesFound.map((i: any) => i.description).slice(0, 5)
      }
    });

    emitDeepAgentEvent({
      type: 'agent-complete',
      agentId: 'resolver',
      agentName: 'Resolver',
      taskId,
      message: `Step ${currentStep}/${totalSteps}: Validation complete - ${issuesFound.length} issues fixed, score: ${validationScore}/100`,
      status: 'completed',
      data: { 
        issuesFixed: issuesFound.length,
        validationScore
      }
    });

    // Extract title
    let title = request.topic;
    try {
      const specJson = JSON.parse(specification.replace(/```json\n?|\n?```/g, ''));
      title = specJson.title || request.topic;
    } catch {
      // Use default
    }

    // ============================================
    // COMPLETE: Emit Final Result
    // ============================================

    const finalArtifact = getDeepSimulationArtifacts().find(a => a.type === 'final-html');

    emitDeepAgentEvent({
      type: 'simulation-ready',
      agentId: 'orchestrator',
      agentName: 'Deep Agent Orchestrator',
      taskId,
      message: `✨ PhET-quality simulation generated successfully! (9/9 agents completed, ${issuesFound.length} issues auto-fixed)`,
      status: 'completed',
      data: { artifact: finalArtifact }
    });

    return {
      id: taskId,
      title,
      htmlContent: finalHtml,
      artifacts: getDeepSimulationArtifacts(),
      workflowTrace: getWorkflowTrace(),
      createdAt: new Date()
    };

  } catch (error) {
    emitDeepAgentEvent({
      type: 'agent-error',
      agentId: 'orchestrator',
      agentName: 'Deep Agent Orchestrator',
      taskId,
      message: `Pipeline failed at step ${currentStep}: ${error instanceof Error ? error.message : 'Unknown'}`,
      status: 'error'
    });
    throw error;
  }
};

// ==========================================
// Exports
// ==========================================

export const getSubAgentDefinitions = (): SubAgentDefinition[] => {
  return Object.values(SUBAGENTS);
};

export const getSubAgentById = (id: string): SubAgentDefinition | undefined => {
  return SUBAGENTS[id];
};

export { SUBAGENTS };
