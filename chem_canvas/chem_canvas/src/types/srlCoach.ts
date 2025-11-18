export type SrlPhase = 'goal' | 'plan' | 'monitor' | 'reflect' | 'help';

export type PlanLevel = 'beginner' | 'intermediate' | 'advanced';

export type HelpLevel = 'hint' | 'guided' | 'explanation';

export type AssessmentMode = 'quiz' | 'flashcards' | 'sketch';

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  mnemonic?: string;
  confidenceTag?: 'recall' | 'familiar' | 'stretch';
  difficulty?: 'intro' | 'intermediate' | 'advanced';
  tags?: string[];
}

export interface CoachLogEntry {
  id: string;
  phase: SrlPhase;
  note: string;
  timestamp: string;
}

export interface PriorKnowledgeSnapshot {
  id: string;
  mode: AssessmentMode;
  score?: number | null;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  aiRecommendation?: string;
  completedAt: string;
}

export interface PlanNode {
  id: string;
  title: string;
  description: string;
  toolId?: string;
  durationMinutes?: number;
  status: 'pending' | 'in-progress' | 'completed';
  resources?: string[];
}

export interface PlanEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface PlanScenario {
  id: string;
  title: string;
  description: string;
  impactSummary: string;
  createdAt: string;
}

export interface MonitoringCheckin {
  id: string;
  createdAt: string;
  focus: string;
  rating: number;
  confidence?: number;
  note?: string;
  aiNudge?: string;
  durationMinutes?: number;
  tasksCompleted?: number;
  engagementScore?: number;
  goalAlignment?: number;
  toolsUsed?: string[];
}

export interface ReflectionEntry {
  id: string;
  createdAt: string;
  prompt: string;
  response: string;
  mood?: string;
  highlightMediaUrls?: string[];
}

export type HelpChannel = 'ai' | 'community' | 'tutor';

export interface HelpRequest {
  id: string;
  channel: HelpChannel;
  topic: string;
  createdAt: string;
  status: 'open' | 'resolved' | 'follow-up';
  summary?: string;
  aiForecast?: string;
}

export interface PersistedSrlCoachState {
  activePhase: SrlPhase;
  goalTopic: string;
  goalTimeframe: string;
  preferredTools: string[];
  priorKnowledge?: PriorKnowledgeSnapshot[];
  goalBuddySummary?: string;
  planFocus: string;
  planLevel: PlanLevel;
  planPreference: string;
  planNodes?: PlanNode[];
  planEdges?: PlanEdge[];
  planScenarios?: PlanScenario[];
  monitorFocus: string;
  monitorRating: number | null;
  monitorNotes: string;
  monitoringCheckins?: MonitoringCheckin[];
  reflectionNotes: string;
  reflectionEmotion: string;
  reflectionEntries?: ReflectionEntry[];
  helpTopic: string;
  helpAttempts: number;
  helpLevel: HelpLevel;
  helpRequests?: HelpRequest[];
  coachLog: CoachLogEntry[];
  updatedAt?: string;
}

export interface SrlCoachMetrics {
  momentumScore: number;
  phaseStreak: number;
  coachEnergy: number;
  unlockedBadgeIds: string[];
  experiencePoints?: number;
  streakBonus?: number;
  updatedAt?: string;
}
