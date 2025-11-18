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

export interface SimulationState {
  isActive: boolean;
  type: 'KINETICS';
  params: KineticsParams;
}
