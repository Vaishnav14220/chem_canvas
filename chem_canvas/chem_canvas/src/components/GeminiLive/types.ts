export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export interface TranscriptionMessage {
  id: string;
  text: string;
  sender: 'user' | 'model';
  timestamp: Date;
  isComplete: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  image?: string; // base64 data uri
  groundingMetadata?: any;
}

export type ChatMode = 'FAST' | 'PRO' | 'SEARCH';

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'zh' | 'ru' | 'hi' | 'ar';

export type VoiceType = 'Fenrir' | 'Puck' | 'Charon' | 'Kore' | 'Orion' | 'Genie' | 'Juniper' | 'Zephyr';

export interface Molecule3DParams {
  smiles?: string;
  name?: string;
  iupacName?: string;
  structure?: string;
}

export interface DerivationStep {
  title: string;
  latex?: string;
  explanation?: string;
}

export type LearningCanvasImageStatus = 'idle' | 'loading' | 'complete' | 'error';

export interface LearningCanvasImage {
  status: LearningCanvasImageStatus;
  url?: string;
  prompt?: string;
  topic?: string;
  concept?: string;
  style?: string;
  focus?: string;
  mood?: string;
  colorPalette?: string;
  medium?: string;
  importantElements?: string;
  message?: string;
  requestId?: string;
  alt?: string;
  updatedAt?: number;
}

export interface LearningCanvasParams {
  title: string;
  steps: DerivationStep[];
  topic?: string;
  image?: LearningCanvasImage;
}

export interface ConceptImageRecord extends LearningCanvasImage {
  id: string;
  title: string;
  createdAt: number;
  sourceTopic?: string;
  displayPrompt?: string;
}

export type VisualizationType = 'KINETICS' | 'MOLECULE_3D' | 'LEARNING_CANVAS' | 'NONE';

export interface VisualizationState {
  isActive: boolean;
  type: VisualizationType;
  kineticsParams?: KineticsParams;
  molecule3DParams?: Molecule3DParams;
  learningCanvasParams?: LearningCanvasParams;
}

export interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isConnected: boolean;
  isSpeaking: boolean; // Driven by audio activity detection
}

export interface KineticsParams {
  temperature: number; // 0-100
  concentration: number; // 0-100
  activationEnergy: number; // 0-100
}

export interface SimulationState extends VisualizationState {
  type: 'KINETICS';
  params: KineticsParams;
}

export interface PDFHighlightParams {
  text: string;
  page?: number;
  context?: string;
}
