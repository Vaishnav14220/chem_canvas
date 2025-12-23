# Chem Canvas: Feature Documentation

Chem Canvas is an AI-powered STEM learning ecosystem designed for interactive discovery, scientific visualization, and intelligent tutoring. It combines a versatile handwriting canvas with specialized scientific modules and multi-modal AI interaction.

---

## 🚀 Global Navigation & Entry Points

### 1. Header Toolbar
The command center for universal features.
*   **Search Bar (⌘K)**: Quick access to tools, documentation, and agent commands.
*   **Settings (⚙️)**: Management of API keys and system preferences.
*   **Quick Study (Sources)**: Centralized panel for managing learning materials (PDFs, Images, YouTube URLs).
*   **Upload to Canvas**: Directly drop documents into the current workspace for AI analysis.
*   **Profile**: Manage user identity and saved sessions.

### 2. Side Panels
*   **Sources Panel**: Lists all active reference materials. Features **Summarize to Canvas**, which uses Gemini to extract key insights and place them as nodes on the workspace.
*   **AI Chat Panel**: A persistent conversational interface for broad queries, deep reasoning, and tool orchestration.

---

## 🎨 Main Workspaces (Primary Tabs)

### **Canvas Studio**
The primary infinite-scrolling workspace for ideation.
*   **Drawing Tools**: Pens, highlighters, and erasers with handwriting recognition.
*   **Node-Based Interface**: Content (text, images, chemical structures) exists as movable nodes.
*   **Workspace Management**: Support for multiple tabs/workspaces with cloud saving via Firebase.
*   **Real-time Transcription**: Converts handwriting into formatted LaTeX or Markdown.

### **Molecule Sketcher**
A dedicated 2D environment for chemical structure drawing.
*   **Draw Mode**: Create organic molecules with standard bond tools and templates.
*   **SMILES Integration**: Generate SMILES from drawings or paste SMILES to render structures.
*   **Export to Canvas**: Send 2D structures directly to the Canvas Studio for further annotation.

### **3D Explorer (Chemistry Widget Panel)**
Advanced visualization of molecules and materials.
*   **JSmol Integration**: High-fidelity 3D rendering of PDB and SDF files.
*   **Crystal Viewer**: Specialized tools for unit cells, supercells, and crystal planes.
*   **Hand Gestures**: Experimental AR/VR-like control of 3D molecules using camera-based hand tracking.

### **NMR Lab**
Advanced spectroscopic analysis.
*   **NMRium Viewer**: Industry-standard spectrum analysis embedded for JCAMP-DX files.
*   **NMR Assistant**: A specialized AI agent that guides users through peak picking and integration.
*   **SMILES to Spectrum**: Resolution of chemical descriptions into NMR-ready structures.

### **SRL Coach (Self-Regulated Learning)**
A strategic workspace for metacognitive development.
*   **Planning Mindmaps**: Interactive graphs to plot learning goals.
*   **Reflection Timeline**: Tracks progress and provides AI feedback on learning strategies.

---

## 🎓 Immersive Learning Modes
Accessible via the central "Immersive Learning" button, this module offers 14+ specialized modes:

1.  **Immersive Text**: Deep analysis of documents with "magic highlight" term definitions.
2.  **Slides Creator**: Automated generation of interactive slide decks from source material.
3.  **Audio Podcast**: Conversational audio scripts generated from technical docs for "listen-along" learning.
4.  **Mindmap**: Interactive hierarchical visualization of complex topics.
5.  **Simulation & Robotics**: Dynamic, code-generated visualizations for physics and engineering concepts.
6.  **3D Viewer**: High-level molecular and protein exploration within a structured lesson.
7.  **Assignment Workspace**: Specialized layout for solving problems with side-by-side AI assistance.
8.  **Doc Studio (AI Word)**: A rich-text editor with "write-with-me" AI capabilities.
9.  **Science Teacher**: A persona-driven chat experience for guided discovery.
10. **Learning Theories (ToT)**: Utilizes "Tree of Thoughts" (ToT) logic to break down complex scientific concepts into verifiable steps.

---

## 🧠 AI & Real-Time Interaction

### **Gemini Live & Vision**
*   **Voice Interactivity**: Real-time conversational interface with low latency.
*   **Screen Share**: Gemini can "see" and comment on external materials or the user's active desktop.
*   **Webcam Share**: Real-time visual grounding for physical objects or handwritten paper notes.
*   **Vision Pages**: Dedicated pages for analyzing static images (`VisionAnalyze`), real-time camera chat (`VisionChat`), and video streams (`VisionVideo`).

### **Handwriting & Characters**
*   **AI Characters**: Selectable personas (Wizard, Sparkle, etc.) specialized in different subjects.
*   **Direct Canvas Output**: AI responses can be "written" directly onto the canvas as handwritten-style text.

---

## ☁️ Persistence & Infrastructure
*   **Workspace Saving**: Seamless cloud storage of canvas states, nodes, and linked documents.
*   **Session Management**: Persistent logins and usage tracking.
*   **API Rotation**: Enterprise-grade management of Gemini API tiers for consistent performance.
