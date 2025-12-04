// Database Types for Firebase Firestore
// All types used for storing and retrieving user data

import { Timestamp } from 'firebase/firestore';

// ============================================
// USER PROFILE
// ============================================
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  subscription: 'free' | 'premium';
  preferences: UserPreferences;
  usage: UserUsage;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultWorkspace?: string;
  aiModel: string;
  autoSave: boolean;
  notifications: boolean;
}

export interface UserUsage {
  aiCreditsUsed: number;
  storageUsed: number; // in bytes
  lastResetDate: Timestamp;
}

// ============================================
// WORKSPACES (Canvas Projects)
// ============================================
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isArchived: boolean;
  thumbnail?: string;
  tags: string[];
  settings: WorkspaceSettings;
}

export interface WorkspaceSettings {
  gridEnabled: boolean;
  snapToGrid: boolean;
  backgroundColor: string;
  gridSize: number;
}

// Canvas Nodes (React Flow nodes)
export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  position: { x: number; y: number };
  data: Record<string, any>;
  style?: Record<string, any>;
  width?: number;
  height?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CanvasNodeType = 
  | 'molecule'
  | 'annotation'
  | 'image'
  | 'equation'
  | 'text'
  | 'flowChart'
  | 'whiteboard'
  | 'graph'
  | 'periodicTable'
  | 'simulation'
  | 'video'
  | 'document'
  | 'calculator'
  | 'code'
  | 'table'
  | 'custom';

// Node-specific data interfaces
export interface MoleculeNodeData {
  smiles: string;
  name: string;
  formula?: string;
  molWeight?: number;
  jmolData?: string;
  arEnabled?: boolean;
  cid?: number;
  inchiKey?: string;
}

export interface AnnotationNodeData {
  content: string;
  fontSize: number;
  color: string;
  borderColor?: string;
  backgroundColor?: string;
}

export interface EquationNodeData {
  latex: string;
  renderedSvg?: string;
}

export interface ImageNodeData {
  imageUrl: string;
  altText?: string;
  width: number;
  height: number;
  storageRef?: string;
}

export interface GraphNodeData {
  chartType: 'line' | 'bar' | 'scatter' | 'pie' | 'area';
  data: any[];
  config: Record<string, any>;
  title?: string;
}

export interface WhiteboardNodeData {
  canvasData: string; // JSON string of canvas state
  strokes: any[];
}

// Canvas Edges (connections between nodes)
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: 'default' | 'button' | 'animated' | 'step' | 'smoothstep';
  label?: string;
  style?: Record<string, any>;
  animated?: boolean;
  data?: Record<string, any>;
}

// ============================================
// AI CHAT HISTORY
// ============================================
export interface Chat {
  id: string;
  workspaceId?: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  chatType: 'general' | 'chemistry' | 'document' | 'simulation' | 'tutor' | 'research';
  model: string;
  messageCount: number;
  lastMessage?: string;
  isPinned?: boolean;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Timestamp;
  attachments?: MessageAttachment[];
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
}

export interface MessageAttachment {
  type: 'image' | 'file' | 'molecule' | 'document';
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface ToolCall {
  name: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  status: 'pending' | 'success' | 'error';
}

// ============================================
// DOCUMENTS (AIWord)
// ============================================
export interface Document {
  id: string;
  title: string;
  content: string; // Markdown or rich text
  createdAt: Timestamp;
  updatedAt: Timestamp;
  workspaceId?: string;
  tags: string[];
  isTemplate: boolean;
  collaborators?: string[];
  wordCount?: number;
  format: 'markdown' | 'html' | 'plain';
  metadata?: DocumentMetadata;
}

export interface DocumentMetadata {
  subject?: string;
  topic?: string;
  generatedBy?: 'ai' | 'user' | 'import';
  sourceUrl?: string;
}

// ============================================

// ============================================
export interface Spreadsheet {
  id: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  workspaceId?: string;
  sheetCount: number;
}

export interface Sheet {
  id: string;
  name: string;
  index: number;
  data: any[][]; // 2D array of cell values
  columns: SheetColumn[];
  formatting?: Record<string, CellFormatting>;
  frozenRows?: number;
  frozenColumns?: number;
}

export interface SheetColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'formula' | 'date' | 'boolean';
  width: number;
}

export interface CellFormatting {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
}

// ============================================
// MOLECULE LIBRARY
// ============================================
export interface SavedMolecule {
  id: string;
  name: string;
  smiles: string;
  formula?: string;
  molWeight?: number;
  inchiKey?: string;
  category?: string;
  tags: string[];
  createdAt: Timestamp;
  isFavorite: boolean;
  notes?: string;
  properties?: MoleculeProperties;
  structure3D?: string; // MOL/SDF data
  imageUrl?: string;
  source?: 'pubchem' | 'user' | 'search' | 'import';
  cid?: number;
}

export interface MoleculeProperties {
  logP?: number;
  pKa?: number;
  polarSurfaceArea?: number;
  hBondDonors?: number;
  hBondAcceptors?: number;
  rotatableBonds?: number;
  complexity?: number;
  isomericSmiles?: string;
  canonicalSmiles?: string;
}

// ============================================
// SIMULATIONS
// ============================================
export interface Simulation {
  id: string;
  name: string;
  type: SimulationType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  workspaceId?: string;
  parameters: Record<string, any>;
  results?: Record<string, any>;
  snapshots?: SimulationSnapshot[];
  status: 'draft' | 'running' | 'completed' | 'error';
  notes?: string;
}

export type SimulationType = 
  | 'kinetics'
  | 'thermodynamics'
  | 'electrochemistry'
  | 'quantum'
  | 'acid-base'
  | 'equilibrium'
  | 'spectroscopy'
  | 'molecular-dynamics'
  | 'custom';

export interface SimulationSnapshot {
  timestamp: Timestamp;
  state: Record<string, any>;
  label?: string;
}

// ============================================
// STUDY MATERIALS
// ============================================
export interface StudyMaterial {
  id: string;
  type: 'flashcard' | 'note' | 'quiz' | 'summary' | 'mindmap';
  title: string;
  content: StudyMaterialContent;
  subject?: string;
  topic?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastReviewed?: Timestamp;
  masteryLevel: number; // 0-100
  spaceRepetition?: SpaceRepetitionData;
  tags: string[];
}

export interface StudyMaterialContent {
  // For flashcards
  front?: string;
  back?: string;
  // For notes
  text?: string;
  // For quizzes
  questions?: QuizQuestion[];
  // For summaries
  summary?: string;
  keyPoints?: string[];
  // For mindmaps
  mindmapData?: any;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-blank';
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
}

export interface SpaceRepetitionData {
  nextReview: Timestamp;
  interval: number; // days
  easeFactor: number;
  repetitions: number;
}

// ============================================
// FILE UPLOADS
// ============================================
export interface FileUpload {
  id: string;
  name: string;
  type: string; // MIME type
  size: number; // bytes
  storagePath: string;
  downloadUrl: string;
  uploadedAt: Timestamp;
  workspaceId?: string;
  tags: string[];
  metadata?: FileMetadata;
}

export interface FileMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  thumbnailUrl?: string;
}

// ============================================
// ACTIVITY LOG
// ============================================
export interface ActivityLog {
  id: string;
  type: 'create' | 'edit' | 'delete' | 'view' | 'share' | 'export' | 'import';
  resourceType: ResourceType;
  resourceId: string;
  resourceName?: string;
  timestamp: Timestamp;
  metadata?: Record<string, any>;
}

export type ResourceType = 
  | 'workspace'
  | 'document'
  | 'molecule'
  | 'simulation'
  | 'chat'
  | 'spreadsheet'
  | 'studyMaterial'
  | 'file';

// ============================================
// TEMPLATES (Public/Shared)
// ============================================
export interface Template {
  id: string;
  name: string;
  description?: string;
  type: 'workspace' | 'document' | 'simulation' | 'spreadsheet';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  usageCount: number;
  tags: string[];
  data: Record<string, any>;
  thumbnail?: string;
  isPublic: boolean;
}

// ============================================
// SHARED WORKSPACES
// ============================================
export interface SharedWorkspace {
  id: string;
  workspaceId: string;
  ownerId: string;
  shareType: 'view' | 'edit' | 'public';
  sharedWith: string[]; // User IDs or emails
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  accessCount: number;
  shareLink?: string;
}

// ============================================
// USER SETTINGS
// ============================================
export interface UserSettings {
  id: string;
  category: 'appearance' | 'editor' | 'ai' | 'notifications' | 'privacy';
  settings: Record<string, any>;
  updatedAt: Timestamp;
}

// ============================================
// HELPER TYPES FOR CREATE/UPDATE
// ============================================
export type CreateWorkspace = Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateWorkspace = Partial<Omit<Workspace, 'id' | 'createdAt'>>;

export type CreateChat = Omit<Chat, 'id' | 'createdAt' | 'updatedAt' | 'messageCount'>;
export type CreateChatMessage = Omit<ChatMessage, 'id' | 'timestamp'>;

export type CreateDocument = Omit<Document, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDocument = Partial<Omit<Document, 'id' | 'createdAt'>>;

export type CreateMolecule = Omit<SavedMolecule, 'id' | 'createdAt'>;
export type UpdateMolecule = Partial<Omit<SavedMolecule, 'id' | 'createdAt'>>;

export type CreateSimulation = Omit<Simulation, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSimulation = Partial<Omit<Simulation, 'id' | 'createdAt'>>;

export type CreateStudyMaterial = Omit<StudyMaterial, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateStudyMaterial = Partial<Omit<StudyMaterial, 'id' | 'createdAt'>>;
