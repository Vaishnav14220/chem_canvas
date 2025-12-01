import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Upload, FileText, Loader2, Brain, Target, BookOpen, Zap, CheckCircle, XCircle, ArrowRight, Lightbulb, RefreshCw, Award, AlertCircle, Play, Volume2, Copy, StickyNote, Heart, Flame, Sparkles, Trophy, Trash2, Clock, FlaskConical, Atom, Activity, MonitorPlay } from 'lucide-react';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { executeWithRotation } from '../services/apiKeyRotation';
import { auth } from '../firebase/config';
import {
  getLearningPreferences,
  saveSessionData,
  getAdaptivePrompts,
  type LearningPreferences,
  type SessionData
} from '../firebase/learningPreferences';
import {
  deleteSubjectExplorerSession,
  getSubjectExplorerSession,
  getSubjectExplorerSessions,
  saveSubjectExplorerSession,
  type SubjectExplorerSessionPayload,
  type SubjectExplorerSessionRecord,
} from '../firebase/subjectExplorerSessions';
import ReactMolReactionViewer from './ReactMolReactionViewer';
import ChemistryStructureViewer from './ChemistryStructureViewer';
import InteractiveSimulationRenderer from './InteractiveSimulationRenderer';
import FocusedLearningSession from './FocusedLearningSession';
import DocumentManager from './DocumentManager';
import type { SimulationSchema } from '../types/simulation';
import { executeSimulation } from '../services/simulationService';
import type { ReactionResolutionResult } from '../services/reactionResolver';

const LOADING_TIPS = [
  'Synthesizing key reactions from your document...',
  'Charting cognitive pathways for your study plan...',
  'Pairing concepts with challenge prompts...',
  'Tuning AI mentors for your learning style...',
  'Polishing flashcards and quiz modules...'
];

interface SubjectExplorerProps {
  onClose: () => void;
  apiKey: string;
}
type WorkflowStage = 'upload' | 'topic_selection' | 'assessment' | 'learning';

interface Topic {
  id: string;
  name: string;
  description?: string;
}

interface TopicSelectionResponse {
  interaction_type: 'topic_selection';
  message: string;
  topics: string[];
  academic_level?: string;
}

interface AssessmentChoiceResponse {
  interaction_type: 'assessment_choice';
  options: Array<{
    id: string;
    text: string;
  }>;
}

interface KnowledgeGap {
  concept: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

interface KnowledgeGapReport {
  gaps: KnowledgeGap[];
  strengths: string[];
  overall_level: string;
}

interface Flashcard {
  module_type: 'flashcard';
  front: string;
  back: string;
}

interface MCQMulti {
  module_type: 'mcq_multi';
  question: string;
  options: Array<{ id: string; text: string }>;
  correct_ids: string[];
}

interface ShortAnswer {
  module_type: 'short_answer';
  question: string;
  keywords_to_check: string[];
}

interface FillBlanks {
  module_type: 'fill_blanks';
  text: string;
  blanks: string[];
}

interface MatchPairs {
  module_type: 'match_pairs';
  prompt: string;
  column_a: string[];
  column_b: string[];
  correct_pairs: Array<{ a: string; b: string }>;
}

type InteractiveModule = Flashcard | MCQMulti | ShortAnswer | FillBlanks | MatchPairs;

interface SectionExample {
  scenario?: string;
  connection?: string;
}

interface SectionDiagram {
  type: string;
  description: string;
  steps: string[];
  image?: string;
}

interface LearningSection {
  id: string;
  title: string;
  description: string;
  icon?: string;
  diagram?: SectionDiagram;
  example?: SectionExample;
  insights: string[];
}

interface JourneySummary {
  bullets: string[];
  takeaway?: string;
}

interface QuickCheckItem {
  question: string;
  options: string[];
  answerIndex: number;
}

type LessonBiteType = 'teach' | 'practice' | 'challenge';

type LessonBiteActivityType = 'multiple_choice' | 'fill_blank' | 'reflection';

interface LessonBite {
  id: string;
  title: string;
  focus: string;
  type: LessonBiteType;
  xp: number;
  heartCost: number;
  teach: string;
  prompt: string;
  activityType: LessonBiteActivityType;
  options?: string[];
  answerIndex?: number;
  correctAnswer?: string;
  acceptableAnswers?: string[];
  rubric?: string;
  tip?: string;
  reward?: string;
}

interface SessionSummaryPlan {
  xpEarned: number;
  skillLevel: string;
  nextStep: string;
  encouragement?: string;
}

interface ChemistryStructureAtom {
  id: string;
  element: string;
  x: number;
  y: number;
  charge?: number;
}

interface ChemistryStructureBond {
  id: string;
  from: string;
  to: string;
  type: 'single' | 'double' | 'triple' | 'aromatic';
  stereo?: string;
}

interface ChemistryStructureData {
  metadata: {
    name: string;
    formula?: string;
    smiles?: string;
    inchi?: string;
    notes?: string;
    [key: string]: any;
  };
  type: string;
  atoms: ChemistryStructureAtom[];
  bonds: ChemistryStructureBond[];
}

interface ImmersiveMetric {
  id: string;
  label: string;
  unit?: string;
  precision?: number;
}

interface ImmersiveScenario {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  reaction: {
    name: string;
    summary: string;
    reactionSmiles: string;
    resolution: ReactionResolutionResult;
    learningTargets: string[];
  };
  structure: ChemistryStructureData;
  simulation: {
    schema: SimulationSchema;
    synopsis: string;
    metrics: ImmersiveMetric[];
    caution?: string;
  };
  assessmentBridge: string;
  externalResource?: {
    title: string;
    url: string;
    description?: string;
    attribution?: string;
  };
  guidingQuestion?: string;
}

const IMMERSIVE_SCENARIOS: ImmersiveScenario[] = (() => {
  const baldwinSimulationSchema: SimulationSchema = {
    id: 'baldwin-6-endo-dig-energy-scan',
    title: '6-endo-dig Cyclization Energetics Sandbox',
    description: 'Tune geometric and electronic parameters to explore how a 6-endo-dig ring closure competes with Baldwin\'s preferred pathways.',
    inputs: [
      {
        id: 'orbitalAlignment',
        name: 'orbitalAlignment',
        type: 'number',
        label: 'Orbital Alignment (0-1)',
        description: 'Fractional alignment between the attacking lone pair and the digonal center.',
        defaultValue: 0.45,
        unit: 'ratio',
        min: 0,
        max: 1,
        step: 0.05,
        controlType: 'slider',
      },
      {
        id: 'tetherFlexibility',
        name: 'tetherFlexibility',
        type: 'number',
        label: 'Tether Flexibility',
        description: 'How freely the tether can adopt the Bürgi–Dunitz approach angle.',
        defaultValue: 0.6,
        unit: 'ratio',
        min: 0,
        max: 1,
        step: 0.05,
        controlType: 'slider',
      },
      {
        id: 'electrophileActivation',
        name: 'electrophileActivation',
        type: 'number',
        label: 'Electrophile Activation',
        description: 'Degree to which the alkyne is activated (e.g., by a Lewis acid).',
        defaultValue: 0.4,
        unit: 'ratio',
        min: 0,
        max: 1,
        step: 0.05,
        controlType: 'slider',
      },
      {
        id: 'solventPolarity',
        name: 'solventPolarity',
        type: 'number',
        label: 'Solvent Polarity Index',
        description: 'Scaled dielectric constant influencing charge development in the transition state.',
        defaultValue: 0.3,
        unit: 'index',
        min: 0,
        max: 1,
        step: 0.05,
        controlType: 'slider',
      },
    ],
    outputs: [
      {
        id: 'activation_barrier',
        name: 'activation_barrier',
        type: 'number',
        label: 'Activation Barrier',
        description: 'Estimated barrier height for the 6-endo-dig closure.',
        unit: 'kcal/mol',
        format: 'decimal',
        precision: 1,
      },
      {
        id: 'six_endo_probability',
        name: 'six_endo_probability',
        type: 'number',
        label: '6-endo-dig Success Probability',
        description: 'Heuristic likelihood that the 6-endo-dig pathway is competitive.',
        unit: '%',
        format: 'decimal',
        precision: 0,
      },
      {
        id: 'predicted_rate_constant',
        name: 'predicted_rate_constant',
        type: 'number',
        label: 'Predicted Rate Constant',
        description: 'Relative rate constant for the 6-endo-dig trajectory.',
        unit: 's^-1',
        format: 'scientific',
        precision: 2,
      },
    ],
    logic: {
      formulaId: 'baldwin-heuristic',
      equation: '\\Delta G^\\ddagger = f(\text{alignment}, \text{activation}, \text{flexibility})',
      implementation: `
        const baseBarrier = 20.5;
        const alignmentGain = (inputs.orbitalAlignment - 0.5) * -8;
        const activationGain = inputs.electrophileActivation * -6;
        const tetherPenalty = (1 - inputs.tetherFlexibility) * 5.5;
        const solventAdjustment = (inputs.solventPolarity - 0.3) * -1.5;
        const barrier = Math.max(8, baseBarrier + alignmentGain + activationGain + tetherPenalty + solventAdjustment);
        const successRaw = 55 - (barrier - 12) * 3 + inputs.orbitalAlignment * 30 + inputs.tetherFlexibility * 20;
        const sixEndoProbability = Math.max(0, Math.min(100, successRaw));
        const rateConstant = Math.max(1e-6, 0.12 * Math.exp(-(barrier - 10) / 2.2));
        return {
          activation_barrier: barrier,
          six_endo_probability: sixEndoProbability,
          predicted_rate_constant: rateConstant
        };
      `,
      explanation: 'Heuristic model illustrating how alignment and activation alter 6-endo-dig feasibility compared with Baldwin\'s preferred 5-exo-dig closures.',
    },
    metadata: {
      domain: 'Chemistry',
      difficulty: 'advanced',
      tags: ['baldwin', 'cyclization', 'pericyclic'],
    },
  };

  const baldwinStructure: ChemistryStructureData = {
    metadata: {
      name: '6-endo-dig Cyclization Product',
      formula: 'C8H8O',
      smiles: 'C1=CC=CCO1',
      notes: 'Stylized cyclic enol ether formed via a 6-endo-dig Baldwin cyclization.',
    },
    type: 'molecule',
    atoms: [
      { id: 'c1', element: 'C', x: 0.0, y: 0.0 },
      { id: 'c2', element: 'C', x: 1.2, y: 0.0 },
      { id: 'c3', element: 'C', x: 2.0, y: 1.0 },
      { id: 'c4', element: 'C', x: 1.2, y: 2.0 },
      { id: 'c5', element: 'C', x: 0.0, y: 2.0 },
      { id: 'c6', element: 'C', x: -0.8, y: 1.0 },
      { id: 'c7', element: 'C', x: 2.8, y: 0.2 },
      { id: 'c8', element: 'C', x: 3.6, y: -0.6 },
      { id: 'o1', element: 'O', x: 2.2, y: -0.8 },
      { id: 'h1', element: 'H', x: -1.5, y: 1.8 },
      { id: 'h2', element: 'H', x: -1.2, y: 0.2 },
    ],
    bonds: [
      { id: 'b1', from: 'c1', to: 'c2', type: 'single' },
      { id: 'b2', from: 'c2', to: 'c3', type: 'single' },
      { id: 'b3', from: 'c3', to: 'c4', type: 'single' },
      { id: 'b4', from: 'c4', to: 'c5', type: 'single' },
      { id: 'b5', from: 'c5', to: 'c6', type: 'single' },
      { id: 'b6', from: 'c6', to: 'c1', type: 'single' },
      { id: 'b7', from: 'c2', to: 'o1', type: 'single' },
      { id: 'b8', from: 'c3', to: 'c7', type: 'double' },
      { id: 'b9', from: 'c7', to: 'c8', type: 'single' },
      { id: 'b10', from: 'c6', to: 'h1', type: 'single' },
      { id: 'b11', from: 'c6', to: 'h2', type: 'single' },
    ],
  };

  const baldwinResolution: ReactionResolutionResult = {
    reactionSmiles: 'C#CC=CCO>>C1=CC=CCO1',
    components: [
      { role: 'reactant', label: 'Enyne nucleophile', smiles: 'C#CC=CCO' },
      { role: 'product', label: '6-membered enol ether', smiles: 'C1=CC=CCO1' },
    ],
    usedGemini: false,
    confidence: 0.4,
    notes: 'Stylized Baldwin 6-endo-dig cyclization illustrating an intramolecular attack on an activated alkyne.',
    reactionName: '6-endo-dig intramolecular cyclization',
  };

  return [
    {
      id: 'baldwin-6-endo-dig-lab',
      title: "Baldwin's Rule (6-endo-dig) Immersive Lab",
      description: 'Explore why 6-endo-dig cyclizations challenge Baldwin\'s guidelines by combining 3D visualization, heuristic energetics, and assessment prompts.',
      keywords: ['6-endo-dig', 'baldwin', 'cyclization', 'alkyne', 'ring closure'],
      reaction: {
        name: '6-endo-dig Cyclization',
        summary: 'An intramolecular attack closes a six-membered ring via a digonal (sp) center, categorized as 6-endo-dig in Baldwin\'s rules.',
        reactionSmiles: baldwinResolution.reactionSmiles,
        resolution: baldwinResolution,
        learningTargets: [
          'Relate Baldwin\'s digonal classification to the attacking trajectory of an alkyne.',
          'Contrast 6-endo-dig outcomes with the favored 5-exo-dig pathway using orbital alignment cues.',
          'Identify activation strategies that can overcome the geometric penalty for 6-endo-dig closures.',
        ],
      },
      structure: baldwinStructure,
      simulation: {
        schema: baldwinSimulationSchema,
        synopsis: 'Adjust alignment, tether flexibility, activation, and solvent effects to reason about the feasibility of a 6-endo-dig ring closure.',
        metrics: [
          { id: 'activation_barrier', label: 'Activation barrier', unit: 'kcal/mol', precision: 1 },
          { id: 'six_endo_probability', label: '6-endo-dig probability', unit: '%' },
          { id: 'predicted_rate_constant', label: 'Rate constant', unit: 's^-1', precision: 2 },
        ],
        caution: 'Heuristic model for exploratory learning—use qualitative trends rather than absolute numbers.',
      },
      assessmentBridge: 'After experimenting with the sandbox, use evidence from the molecular models to justify when a 6-endo-dig pathway might compete with a 5-exo-dig alternative.',
      guidingQuestion: 'After inspecting the molecular models, what geometric limitation makes the 6-endo-dig closure less favorable than a competing 5-exo-dig pathway?',
    },
  ];
})();

const cloneScenario = (scenario: ImmersiveScenario | undefined): ImmersiveScenario | null => {
  if (!scenario) {
    return null;
  }
  return JSON.parse(JSON.stringify(scenario)) as ImmersiveScenario;
};

const selectImmersiveScenario = (topicName?: string | null): ImmersiveScenario | null => {
  const search = topicName?.toLowerCase() ?? '';
  const match = IMMERSIVE_SCENARIOS.find(scenario =>
    scenario.keywords.some(keyword => search.includes(keyword))
  );
  return cloneScenario(match ?? IMMERSIVE_SCENARIOS[0]);
};

type LessonBiteStateOverrides = {
  choiceResponses?: Record<string, number>;
  textInputs?: Record<string, string>;
  textSubmissions?: Record<string, string>;
};

const formatRelativeTime = (date?: Date | null): string => {
  if (!date) {
    return 'Just now';
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

const toResumeSnippet = (text: string, maxLength = 120): string => {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

const getAcademicScenarioDirectives = (
  academicLevel: string,
  gaps: KnowledgeGap[]
): string[] => {
  const level = academicLevel.toLowerCase();
  const directives: string[] = [];
  const focusConcepts = gaps.map(gap => gap.concept).slice(0, 3).join(', ');

  const advancedDirective =
    '- Calibrate every explanation to university-level rigor—reference underlying equations, quantitative reasoning, and professional terminology.';
  directives.push(advancedDirective);

  if (focusConcepts) {
    directives.push(`- Tie reinforcement activities directly to these focus concepts: ${focusConcepts}.`);
  }

  if (level.includes('master') || level.includes('graduate') || level.includes('postgraduate')) {
    directives.push(
      '- Frame each bite as part of a research-lab workshop: highlight instrumentation choices, data interpretation steps, and how findings relate to ongoing studies.'
    );
    directives.push(
      '- Whenever possible, propose a compact experiment or simulation run. Specify equipment, control variables, safety notes, and expected observations so learners can replicate it.'
    );
  }

  if (level.includes('engineer') || level.includes('engineering')) {
    directives.push(
      '- Emphasize design thinking: include system models, process diagrams, or calculations engineers would perform before running an experiment.'
    );
    directives.push(
      '- Encourage learners to iterate on parameters using the interactive simulation toggle; call out which variables to sweep and what metrics to monitor.'
    );
  }

  directives.push(
    '- If a reaction, structure, or molecular interaction is discussed, prompt the learner to open the canvas reaction tools or 3D molecular viewer and describe what to inspect.'
  );
  directives.push(
    '- Where visuals aid understanding, describe the diagram or image to display and explain what features to pay attention to.'
  );
  directives.push(
    '- Blend conceptual depth with applied context—link the idea to industry, research, or experimental scenarios relevant to advanced university students.'
  );

  return directives;
};

const computeDocumentFingerprint = async (text: string): Promise<string> => {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.warn('[SubjectExplorer] Failed to compute SHA-256 fingerprint, falling back:', error);
    }
  }

  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
};

const generateSessionId = (fingerprint: string) => {
  const prefix = fingerprint.slice(0, 10) || 'session';
  return `sess_${prefix}_${Date.now().toString(36)}`;
};

const LESSON_TYPE_META: Record<LessonBiteType, { label: string; badgeClass: string; textClass: string }> = {
  teach: {
    label: 'Learn',
    badgeClass: 'bg-blue-500/20 border border-blue-400/40 text-blue-200',
    textClass: 'text-blue-200',
  },
  practice: {
    label: 'Practice',
    badgeClass: 'bg-purple-500/20 border border-purple-400/40 text-purple-200',
    textClass: 'text-purple-200',
  },
  challenge: {
    label: 'Challenge',
    badgeClass: 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200',
    textClass: 'text-emerald-200',
  },
};

const LESSON_ACTIVITY_LABELS: Record<LessonBiteActivityType, string> = {
  multiple_choice: 'Choose the best answer',
  fill_blank: 'Fill in the blank',
  reflection: 'Reflection moment',
};

const sanitizeSnippet = (text: string, maxLength = 160): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\[[^\]]*\]/g, '')
    .trim()
    .slice(0, maxLength);
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const extractContentBetweenTags = (source: string, tag: string): string | null => {
  const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
  const match = regex.exec(source);
  return match ? match[1].trim() : null;
};

const parseDuolingoLearningJourney = (content: string): {
  bites: LessonBite[];
  summary: SessionSummaryPlan | null;
} => {
  const bites: LessonBite[] = [];
  const biteRegex = /\[LESSON_BITE\]([\s\S]*?)\[\/LESSON_BITE\]/gi;
  let biteMatch: RegExpExecArray | null;

  while ((biteMatch = biteRegex.exec(content)) !== null) {
    const block = biteMatch[1];
    const grabSegment = (label: string, untilLabels: string[]): string => {
      const pattern = new RegExp(`${label}:\\s*([\\s\\S]*?)${untilLabels.length ? `(?=\\n(?:${untilLabels.join('|')}):|$)` : '$'}`, 'i');
      const match = pattern.exec(block);
      return match?.[1]?.trim() ?? '';
    };

    const title = grabSegment('Title', ['Focus', 'Type', 'ActivityType', 'XP', 'HeartCost', 'Teach', 'Prompt', 'Options', 'Answer', 'AltAnswers', 'Tip', 'Reward', 'ReflectionGuide']) || 'Lesson Bite';
    const focus = grabSegment('Focus', ['Type', 'ActivityType', 'XP', 'HeartCost', 'Teach', 'Prompt', 'Options', 'Answer', 'AltAnswers', 'Tip', 'Reward', 'ReflectionGuide']) || 'Core concept';
    const typeRaw = grabSegment('Type', ['ActivityType', 'XP', 'HeartCost', 'Teach', 'Prompt', 'Options', 'Answer', 'AltAnswers', 'Tip', 'Reward', 'ReflectionGuide']).toLowerCase();
    const type: LessonBiteType = (['teach', 'practice', 'challenge'] as LessonBiteType[]).includes(typeRaw as LessonBiteType)
      ? (typeRaw as LessonBiteType)
      : 'teach';
    const activityTypeRaw = grabSegment('ActivityType', ['XP', 'HeartCost', 'Teach', 'Prompt', 'Options', 'Answer', 'AltAnswers', 'Tip', 'Reward', 'ReflectionGuide']).toLowerCase();
    const activityType: LessonBiteActivityType = (['multiple_choice', 'fill_blank', 'reflection'] as LessonBiteActivityType[]).includes(activityTypeRaw as LessonBiteActivityType)
      ? (activityTypeRaw as LessonBiteActivityType)
      : 'multiple_choice';
    const xpValue = parseInt(grabSegment('XP', ['HeartCost', 'Teach', 'Prompt', 'Options', 'Answer', 'AltAnswers', 'Tip', 'Reward', 'ReflectionGuide']) || '15', 10);
    const heartCostValue = parseInt(grabSegment('HeartCost', ['Teach', 'Prompt', 'Options', 'Answer', 'AltAnswers', 'Tip', 'Reward', 'ReflectionGuide']) || '1', 10);
    const teach = grabSegment('Teach', ['Prompt', 'Options', 'Answer', 'AltAnswers', 'Tip', 'Reward', 'ReflectionGuide']) || '';
    const prompt = grabSegment('Prompt', ['Options', 'Answer', 'AltAnswers', 'Steps', 'CorrectOrder', 'ReflectionGuide', 'Guidance', 'Tip', 'Reward']) || '';
    const optionsBlock = grabSegment('Options', ['Answer', 'AltAnswers', 'Tip', 'Reward']) || '';
    const options = optionsBlock
      .split('\n')
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(Boolean);
    const answerSegment = grabSegment('Answer', ['AltAnswers', 'Tip', 'Reward', 'ReflectionGuide']);
    const altAnswersSegment = grabSegment('AltAnswers', ['Tip', 'Reward', 'ReflectionGuide']);
    const reflectionGuide = grabSegment('ReflectionGuide', ['Tip', 'Reward']) || grabSegment('Guidance', ['Tip', 'Reward']);
    const tip = grabSegment('Tip', ['Reward']);
    const reward = grabSegment('Reward', []);

    const xp = Number.isFinite(xpValue) ? xpValue : 15;
    const baseHeartCost = Number.isFinite(heartCostValue) ? heartCostValue : 1;
    const normalizedPrompt = prompt.trim();

    if (activityType === 'multiple_choice' || (!activityTypeRaw && options.length)) {
      if (!options.length) {
        continue;
      }
      const answerIndex = Math.max(0, (parseInt(answerSegment || '1', 10) || 1) - 1);
      bites.push({
        id: `bite-${bites.length + 1}`,
        title,
        focus,
        type,
        xp,
        heartCost: Math.max(1, baseHeartCost),
        teach,
        prompt: normalizedPrompt,
        activityType: 'multiple_choice',
        options,
        answerIndex: Math.min(answerIndex, options.length - 1),
        tip,
        reward,
      });
      continue;
    }

    if (activityType === 'fill_blank') {
      const correctAnswer = (answerSegment || '').trim();
      if (!correctAnswer) {
        continue;
      }
      const acceptableAnswers = altAnswersSegment
        ? altAnswersSegment
          .split(/[\n,]/)
          .map(ans => ans.trim())
          .filter(Boolean)
        : [];

      bites.push({
        id: `bite-${bites.length + 1}`,
        title,
        focus,
        type,
        xp,
        heartCost: Math.max(1, baseHeartCost),
        teach,
        prompt: normalizedPrompt,
        activityType,
        correctAnswer,
        acceptableAnswers: acceptableAnswers.length ? acceptableAnswers : undefined,
        tip,
        reward,
      });
      continue;
    }

    if (activityType === 'reflection') {
      bites.push({
        id: `bite-${bites.length + 1}`,
        title,
        focus,
        type,
        xp,
        heartCost: 0,
        teach,
        prompt: normalizedPrompt,
        activityType,
        rubric: reflectionGuide || 'Jot down how you will use this skill next.',
        tip,
        reward,
      });
      continue;
    }
  }

  const summaryMatch = /\[SESSION_SUMMARY\]([\s\S]*?)\[\/SESSION_SUMMARY\]/i.exec(content);
  let summary: SessionSummaryPlan | null = null;

  if (summaryMatch) {
    const block = summaryMatch[1];
    const xpEarned = parseInt(block.match(/XP_Earned:\s*(\d+)/i)?.[1] ?? '0', 10);
    const skillLevel = block.match(/Skill_Level:\s*([^\n]+)/i)?.[1]?.trim() ?? '';
    const nextStep = block.match(/Next_Step:\s*([^\n]+)/i)?.[1]?.trim() ?? '';
    const encouragement = block.match(/Encouragement:\s*([\s\S]*?)$/i)?.[1]?.trim();

    summary = {
      xpEarned: Number.isFinite(xpEarned) ? xpEarned : 0,
      skillLevel,
      nextStep,
      encouragement,
    };
  }

  return { bites, summary };
};

const parseLearningSections = (content: string): {
  sections: LearningSection[];
  summary: JourneySummary | null;
} => {
  const sections: LearningSection[] = [];
  const sectionRegex = /\[CONCEPT_CARD\]([\s\S]*?)\[\/CONCEPT_CARD\]([\s\S]*?)(?=\[CONCEPT_CARD\]|\[SUMMARY\]|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(content)) !== null) {
    const conceptBlock = match[1] || '';
    const trailingBlock = match[2] || '';

    const title = conceptBlock.match(/Title:\s*(.+)/i)?.[1]?.trim() || 'Key Concept';
    const description = conceptBlock.match(/Description:\s*([\s\S]*?)(?:Icon:|$)/i)?.[1]?.trim() || '';
    const icon = conceptBlock.match(/Icon:\s*(.+)/i)?.[1]?.trim();

    const diagramMatch = /\[DIAGRAM\]([\s\S]*?)\[\/DIAGRAM\]/i.exec(trailingBlock);
    const diagram: SectionDiagram | undefined = diagramMatch ? (() => {
      const block = diagramMatch[1];
      const type = block.match(/Type:\s*(.+)/i)?.[1]?.trim() || 'visual';
      const diagramDescription = block.match(/Description:\s*([\s\S]*?)(?=Steps:|Image:|$)/i)?.[1]?.trim() || '';
      const stepsText = block.match(/Steps:\s*([\s\S]*?)(?=Image:|$)/i)?.[1] || '';
      const steps = stepsText
        .split(/\n+/)
        .map(step => step.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
      const image = block.match(/Image:\s*(.+)/i)?.[1]?.trim();
      return { type, description: diagramDescription, steps, image };
    })() : undefined;

    const exampleMatch = /\[EXAMPLE\]([\s\S]*?)\[\/EXAMPLE\]/i.exec(trailingBlock);
    const example: SectionExample | undefined = exampleMatch ? (() => {
      const block = exampleMatch[1];
      return {
        scenario: block.match(/Scenario:\s*([\s\S]*?)(?=Connection:|$)/i)?.[1]?.trim(),
        connection: block.match(/Connection:\s*([\s\S]*?)$/i)?.[1]?.trim(),
      };
    })() : undefined;

    const insightRegex = /\[INSIGHT\]([\s\S]*?)\[\/INSIGHT\]/gi;
    const insights: string[] = [];
    let insightMatch: RegExpExecArray | null;
    while ((insightMatch = insightRegex.exec(trailingBlock)) !== null) {
      const insightText = insightMatch[1]?.trim();
      if (insightText) {
        insights.push(insightText);
      }
    }

    sections.push({
      id: `section-${sections.length + 1}`,
      title,
      description,
      icon,
      diagram,
      example,
      insights,
    });
  }

  const summaryBlock = extractContentBetweenTags(content, 'SUMMARY');
  const summary: JourneySummary | null = summaryBlock
    ? (() => {
      const lines = summaryBlock.split(/\n+/).map(line => line.trim()).filter(Boolean);
      const bullets = lines.filter(line => line.startsWith('-')).map(line => line.replace(/^[-*]\s*/, '').trim());
      const takeaway = lines.find(line => line.toLowerCase().includes('takeaway'));
      return {
        bullets: bullets.length > 0 ? bullets : lines,
        takeaway: takeaway && takeaway.includes(':') ? takeaway.split(':').slice(1).join(':').trim() : undefined,
      };
    })()
    : null;

  return { sections, summary };
};

const buildQuickChecks = (sections: LearningSection[]): QuickCheckItem[] => {
  if (!sections.length) {
    return [];
  }

  return sections.map((section, index) => {
    const correct = sanitizeSnippet(section.description);
    const distractorsPool = sections
      .filter((_, idx) => idx !== index)
      .map(other => sanitizeSnippet(other.description))
      .filter(Boolean);

    while (distractorsPool.length < 2) {
      distractorsPool.push('Focus on a different concept from the lesson.');
    }

    const options = shuffleArray([correct, distractorsPool[0], distractorsPool[1]]);
    const answerIndex = options.findIndex(option => option === correct);

    return {
      question: `Which statement best describes ${section.title}?`,
      options,
      answerIndex: answerIndex >= 0 ? answerIndex : 0,
    };
  });
};

// Helper function to convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const SubjectExplorer: React.FC<SubjectExplorerProps> = ({ onClose, apiKey }) => {
  const [stage, setStage] = useState<WorkflowStage>('upload');
  const [documentContent, setDocumentContent] = useState<string>('');
  const [documentName, setDocumentName] = useState<string>('');
  const [documentFileUrl, setDocumentFileUrl] = useState<string | null>(null);
  const [documentFingerprint, setDocumentFingerprint] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);
  const [savedSessions, setSavedSessions] = useState<SubjectExplorerSessionRecord[]>([]);
  const [savedSessionsLoading, setSavedSessionsLoading] = useState<boolean>(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [academicLevel, setAcademicLevel] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [assessmentType, setAssessmentType] = useState<string | null>(null);
  const [currentModule, setCurrentModule] = useState<InteractiveModule | null>(null);
  const [knowledgeGapReport, setKnowledgeGapReport] = useState<KnowledgeGapReport | null>(null);
  const [learningContent, setLearningContent] = useState<string>('');
  const [tutorModules, setTutorModules] = useState<InteractiveModule[]>([]);
  const [currentTutorModuleIndex, setCurrentTutorModuleIndex] = useState(0);
  const [userProgress, setUserProgress] = useState<Array<{ success: boolean; moduleType: string }>>([]);
  const [userAnswer, setUserAnswer] = useState<any>(null);
  const [showFlashcardBack, setShowFlashcardBack] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [shortAnswerText, setShortAnswerText] = useState('');
  const [fillBlanksAnswers, setFillBlanksAnswers] = useState<string[]>([]);
  const [matchPairsAnswers, setMatchPairsAnswers] = useState<Map<string, string>>(new Map());
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState('');
  const [wrongAnswers, setWrongAnswers] = useState<number[]>([]);
  const [learningPreferences, setLearningPreferences] = useState<LearningPreferences | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [readingStartTime, setReadingStartTime] = useState<number>(0);
  const [currentSessionData, setCurrentSessionData] = useState<Partial<SessionData>>({
    questionsAttempted: 0,
    questionsCorrectFirstTry: 0,
    questionsSkipped: [],
    hintsUsed: 0,
    attemptsPerQuestion: [],
    moduleTypesUsed: [],
    moduleTypesSucceeded: [],
    timeSpentReading: 0,
    timeSpentOnExercises: 0,
  });
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [interactiveSimulationActive, setInteractiveSimulationActive] = useState(false);
  const [conceptHighlights, setConceptHighlights] = useState<string[]>([]);
  const [userNotes, setUserNotes] = useState<Map<string, string>>(new Map());
  const [simulationTopic, setSimulationTopic] = useState<string | null>(null);
  const [learningSections, setLearningSections] = useState<LearningSection[]>([]);
  const [journeySummary, setJourneySummary] = useState<JourneySummary | null>(null);
  const [quickChecks, setQuickChecks] = useState<QuickCheckItem[]>([]);
  const [currentLearningStep, setCurrentLearningStep] = useState<number>(0);
  const [completedLearningSteps, setCompletedLearningSteps] = useState<Set<number>>(new Set());
  const [quizResponses, setQuizResponses] = useState<Record<string, number>>({});
  const [lessonBites, setLessonBites] = useState<LessonBite[]>([]);
  const [sessionSummaryPlan, setSessionSummaryPlan] = useState<SessionSummaryPlan | null>(null);
  const [currentBiteIndex, setCurrentBiteIndex] = useState(0);
  const [biteChoiceResponses, setBiteChoiceResponses] = useState<Record<string, number>>({});
  const [biteTextInputs, setBiteTextInputs] = useState<Record<string, string>>({});
  const [biteTextSubmissions, setBiteTextSubmissions] = useState<Record<string, string>>({});
  const [completedBites, setCompletedBites] = useState<Set<string>>(new Set());
  const [xpScore, setXpScore] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [biteFeedback, setBiteFeedback] = useState<string | null>(null);
  const [useFocusedLearningMode, setUseFocusedLearningMode] = useState(false);
  const [wasAutoResumed, setWasAutoResumed] = useState(false);
  const immersiveScenario = useMemo(() => {
    const base = selectImmersiveScenario(selectedTopic?.name ?? null);
    if (!base) {
      return null;
    }
    if (selectedTopic?.name) {
      base.title = `${selectedTopic.name} Immersive Lab`;
    }
    return base;
  }, [selectedTopic?.name]);
  const [showStructureViewer, setShowStructureViewer] = useState(false);
  const [activeStructure, setActiveStructure] = useState<ChemistryStructureData | null>(() => immersiveScenario?.structure ?? null);

  useEffect(() => {
    setActiveStructure(immersiveScenario?.structure ?? null);
  }, [immersiveScenario]);

  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setLoadingTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isProcessing]);

  const immersiveSimulationBaseline = useMemo<{
    inputs: Record<string, any>;
    outputs: Record<string, any>;
  } | null>(() => {
    if (!immersiveScenario?.simulation?.schema) {
      return null;
    }
    const defaults = immersiveScenario.simulation.schema.inputs.reduce<Record<string, any>>((accumulator, input) => {
      accumulator[input.id] = input.defaultValue;
      return accumulator;
    }, {});
    try {
      const outputs = executeSimulation(immersiveScenario.simulation.schema, defaults) as Record<string, any>;
      return { inputs: defaults, outputs };
    } catch (error) {
      console.error('[SubjectExplorer] Failed to evaluate immersive simulation baseline:', error);
      return null;
    }
  }, [immersiveScenario]);

  const handleStructureRegenerate = useCallback(() => {
    setActiveStructure(previous => {
      if (!previous) {
        return previous;
      }
      const jitter = () => Number(((Math.random() - 0.5) * 0.2).toFixed(2));
      const atoms = previous.atoms.map(atom => ({
        ...atom,
        x: Number((atom.x + jitter()).toFixed(2)),
        y: Number((atom.y + jitter()).toFixed(2)),
      }));
      return {
        ...previous,
        atoms,
        metadata: {
          ...previous.metadata,
          renderId: Math.random().toString(36).slice(2, 7),
        },
      };
    });
  }, []);

  useEffect(() => {
    if (!simulationTopic && immersiveScenario?.reaction?.name) {
      setSimulationTopic(immersiveScenario.reaction.name);
    }
  }, [immersiveScenario, simulationTopic]);

  const refreshSavedSessions = useCallback(async (uid?: string) => {
    const targetUid = uid ?? currentUser?.uid;
    if (!targetUid) {
      setSavedSessions([]);
      setSavedSessionsLoading(false);
      return;
    }

    setSavedSessionsLoading(true);
    try {
      const sessions = await getSubjectExplorerSessions(targetUid);
      setSavedSessions(sessions);
    } catch (error) {
      console.error('[SubjectExplorer] Failed to load saved sessions:', error);
    } finally {
      setSavedSessionsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    const loadPreferences = async () => {
      const user = auth.currentUser;
      if (user) {
        const prefs = await getLearningPreferences(user.uid);
        setLearningPreferences(prefs);
        console.log('[SubjectExplorer] Loaded learning preferences:', prefs);
      }
    };

    loadPreferences();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async user => {
      setCurrentUser(user);
      if (!user) {
        setSavedSessions([]);
        setSavedSessionsLoading(false);
        return;
      }

      await refreshSavedSessions(user.uid);

      // Auto-load most recent session if user has saved learning journeys
      try {
        const sessions = await getSubjectExplorerSessions(user.uid);
        if (sessions.length > 0) {
          // Sort by updatedAt descending and get the most recent
          const mostRecent = sessions.sort((a, b) => {
            const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return dateB - dateA;
          })[0];

          // Auto-resume if the session was in learning stage
          if (mostRecent && mostRecent.stage === 'learning' && (mostRecent.lessonBites?.length ?? 0) > 0) {
            console.log('[SubjectExplorer] Auto-resuming learning journey:', mostRecent.id);
            applySavedSession(mostRecent);
            setWasAutoResumed(true);
            setFeedbackMessage('✨ Welcome back! Your learning journey has been resumed.');
            setShowFeedback(true);
            setTimeout(() => setShowFeedback(false), 4000);
          }
        }
      } catch (error) {
        console.error('[SubjectExplorer] Failed to auto-load recent session:', error);
      }
    });

    return unsubscribe;
  }, [refreshSavedSessions]);

  useEffect(() => {
    console.log('[SubjectExplorer] API key updated:', apiKey ? `${apiKey.substring(0, 10)}...` : 'none');
  }, [apiKey]);

  const resetSessionState = useCallback(() => {
    setStage('upload');
    setDocumentContent('');
    setDocumentName('');
    setDocumentFingerprint(null);
    setActiveSessionId(null);
    setIsProcessing(false);
    setProcessingMessage('');
    setTopics([]);
    setAcademicLevel('');
    setSelectedTopic(null);
    setAssessmentType(null);
    setCurrentModule(null);
    setKnowledgeGapReport(null);
    setLearningContent('');
    setTutorModules([]);
    setCurrentTutorModuleIndex(0);
    setUserProgress([]);
    setUserAnswer(null);
    setShowFlashcardBack(false);
    setSelectedOptions([]);
    setShortAnswerText('');
    setFillBlanksAnswers([]);
    setMatchPairsAnswers(new Map());
    setFeedbackMessage('');
    setShowFeedback(false);
    setAttemptCount(0);
    setShowHint(false);
    setCurrentHint('');
    setWrongAnswers([]);
    setSessionStartTime(Date.now());
    setReadingStartTime(0);
    setCurrentSessionData({
      questionsAttempted: 0,
      questionsCorrectFirstTry: 0,
      questionsSkipped: [],
      hintsUsed: 0,
      attemptsPerQuestion: [],
      moduleTypesUsed: [],
      moduleTypesSucceeded: [],
      timeSpentReading: 0,
      timeSpentOnExercises: 0,
    });
    setExpandedSections(new Set());
    setInteractiveSimulationActive(false);
    setConceptHighlights([]);
    setUserNotes(new Map());
    setSimulationTopic(null);
    setLearningSections([]);
    setJourneySummary(null);
    setQuickChecks([]);
    setCurrentLearningStep(0);
    setCompletedLearningSteps(new Set());
    setQuizResponses({});
    setLessonBites([]);
    setSessionSummaryPlan(null);
    setCurrentBiteIndex(0);
    setBiteChoiceResponses({});
    setBiteTextInputs({});
    setBiteTextSubmissions({});
    setCompletedBites(new Set());
    setXpScore(0);
    setStreakCount(0);
    setHearts(5);
    setBiteFeedback(null);
    setShowApiKeyModal(false);
    setWasAutoResumed(false);
  }, []);

  const formatStageLabel = (value: string): string => {
    switch (value) {
      case 'upload':
        return 'Upload ready';
      case 'topic_selection':
        return 'Topics identified';
      case 'assessment':
        return 'Assessment in progress';
      case 'learning':
        return 'Learning journey active';
      default:
        return 'In progress';
    }
  };

  const buildSessionPayload = (
    stageOverride?: WorkflowStage,
    overrides: Partial<SubjectExplorerSessionPayload> = {}
  ): SubjectExplorerSessionPayload => {
    const normalizedStage = stageOverride ?? stage;
    const topicList = topics.map(topic => ({
      id: topic.id,
      name: topic.name,
      ...(topic.description ? { description: topic.description } : {}),
    }));
    const selectedTopicPayload = selectedTopic
      ? {
        id: selectedTopic.id,
        name: selectedTopic.name,
        ...(selectedTopic.description ? { description: selectedTopic.description } : {}),
      }
      : null;

    const payload: SubjectExplorerSessionPayload = {
      documentId: documentFingerprint || '',
      documentName,
      documentContent,
      stage: normalizedStage,
      academicLevel,
      topics: topicList,
      selectedTopic: selectedTopicPayload,
      assessmentType,
      currentModule,
      knowledgeGapReport,
      learningContent,
      lessonBites,
      sessionSummaryPlan,
      currentBiteIndex,
      biteChoiceResponses,
      biteTextInputs,
      biteTextSubmissions,
      completedBites: Array.from(completedBites),
      xpScore,
      streakCount,
      hearts,
      tutorModules,
      currentTutorModuleIndex,
      quickChecks,
      learningSections,
      journeySummary,
      currentLearningStep,
      completedLearningSteps: Array.from(completedLearningSteps),
      quizResponses,
      userProgress,
      conceptHighlights,
      userNotes: Array.from(userNotes.entries()).map(([topicId, note]) => ({ topicId, note })),
      fillBlanksAnswers,
      selectedOptions,
      shortAnswerText,
      matchPairsAnswers: Array.from(matchPairsAnswers.entries()),
      attemptCount,
      showHint,
      currentHint,
      wrongAnswers,
      biteFeedback,
      sessionStartTime,
      readingStartTime,
      currentSessionData,
    };

    return {
      ...payload,
      ...overrides,
    };
  };

  const persistSession = async (
    stageOverride?: WorkflowStage,
    overrides: Partial<SubjectExplorerSessionPayload> = {},
    sessionIdOverride?: string
  ) => {
    const targetSessionId = sessionIdOverride ?? activeSessionId;
    if (!currentUser || !targetSessionId) {
      return;
    }
    const fingerprintToPersist = (overrides.documentId as string | undefined) ?? documentFingerprint;
    const contentToPersist = (overrides.documentContent as string | undefined) ?? documentContent;
    if (!fingerprintToPersist || !contentToPersist) {
      return;
    }

    const payload = buildSessionPayload(stageOverride, overrides);
    const sanitized = JSON.parse(JSON.stringify(payload)) as SubjectExplorerSessionPayload;

    try {
      await saveSubjectExplorerSession(currentUser.uid, targetSessionId, sanitized);

      const timestamp = new Date();
      setSavedSessions(prev => {
        const existing = prev.find(session => session.id === targetSessionId);
        const createdAt = existing?.createdAt ?? timestamp;
        const updatedRecord: SubjectExplorerSessionRecord = {
          id: targetSessionId,
          documentId: sanitized.documentId,
          documentName: sanitized.documentName,
          documentContent: sanitized.documentContent,
          stage: sanitized.stage,
          academicLevel: sanitized.academicLevel,
          topics: sanitized.topics,
          selectedTopic: sanitized.selectedTopic,
          assessmentType: sanitized.assessmentType,
          currentModule: sanitized.currentModule,
          knowledgeGapReport: sanitized.knowledgeGapReport,
          learningContent: sanitized.learningContent,
          lessonBites: sanitized.lessonBites,
          sessionSummaryPlan: sanitized.sessionSummaryPlan,
          currentBiteIndex: sanitized.currentBiteIndex,
          biteChoiceResponses: sanitized.biteChoiceResponses,
          biteTextInputs: sanitized.biteTextInputs,
          biteTextSubmissions: sanitized.biteTextSubmissions,
          completedBites: sanitized.completedBites,
          xpScore: sanitized.xpScore,
          streakCount: sanitized.streakCount,
          hearts: sanitized.hearts,
          tutorModules: sanitized.tutorModules,
          currentTutorModuleIndex: sanitized.currentTutorModuleIndex,
          quickChecks: sanitized.quickChecks,
          learningSections: sanitized.learningSections,
          journeySummary: sanitized.journeySummary,
          currentLearningStep: sanitized.currentLearningStep,
          completedLearningSteps: sanitized.completedLearningSteps,
          quizResponses: sanitized.quizResponses,
          userProgress: sanitized.userProgress,
          conceptHighlights: sanitized.conceptHighlights,
          userNotes: sanitized.userNotes,
          fillBlanksAnswers: sanitized.fillBlanksAnswers,
          selectedOptions: sanitized.selectedOptions,
          shortAnswerText: sanitized.shortAnswerText,
          matchPairsAnswers: sanitized.matchPairsAnswers,
          attemptCount: sanitized.attemptCount,
          showHint: sanitized.showHint,
          currentHint: sanitized.currentHint,
          wrongAnswers: sanitized.wrongAnswers,
          biteFeedback: sanitized.biteFeedback,
          sessionStartTime: sanitized.sessionStartTime,
          readingStartTime: sanitized.readingStartTime,
          currentSessionData: sanitized.currentSessionData,
          createdAt,
          updatedAt: timestamp,
        };

        const filtered = prev.filter(session => session.id !== targetSessionId);
        return [updatedRecord, ...filtered];
      });
    } catch (error) {
      console.error('[SubjectExplorer] Failed to persist session state:', error);
    }
  };

  const applySavedSession = (session: SubjectExplorerSessionRecord) => {
    const normalizedStage: WorkflowStage = (['upload', 'topic_selection', 'assessment', 'learning'] as WorkflowStage[]).includes(session.stage as WorkflowStage)
      ? (session.stage as WorkflowStage)
      : 'topic_selection';

    setActiveSessionId(session.id);
    setDocumentFingerprint(session.documentId || null);
    setDocumentName(session.documentName || '');
    setDocumentContent(session.documentContent || '');
    setStage(normalizedStage);
    setAcademicLevel(session.academicLevel || '');
    setTopics((session.topics as Topic[]) ?? []);
    setSelectedTopic((session.selectedTopic as Topic | null) ?? null);
    setAssessmentType(session.assessmentType ?? null);
    setCurrentModule((session.currentModule as InteractiveModule | null) ?? null);
    setKnowledgeGapReport((session.knowledgeGapReport as KnowledgeGapReport | null) ?? null);
    setLearningContent(session.learningContent ?? '');
    setLessonBites((session.lessonBites as LessonBite[]) ?? []);
    setSessionSummaryPlan((session.sessionSummaryPlan as SessionSummaryPlan | null) ?? null);
    setCurrentBiteIndex(session.currentBiteIndex ?? 0);
    setBiteChoiceResponses(session.biteChoiceResponses ?? {});
    setBiteTextInputs(session.biteTextInputs ?? {});
    setBiteTextSubmissions(session.biteTextSubmissions ?? {});
    setCompletedBites(new Set(session.completedBites ?? []));
    setXpScore(session.xpScore ?? 0);
    setStreakCount(session.streakCount ?? 0);
    setHearts(session.hearts ?? 5);
    setTutorModules((session.tutorModules as InteractiveModule[]) ?? []);
    setCurrentTutorModuleIndex(session.currentTutorModuleIndex ?? 0);
    setQuickChecks((session.quickChecks as QuickCheckItem[]) ?? []);
    setLearningSections((session.learningSections as LearningSection[]) ?? []);
    setJourneySummary((session.journeySummary as JourneySummary | null) ?? null);
    setCurrentLearningStep(session.currentLearningStep ?? 0);
    setCompletedLearningSteps(new Set(session.completedLearningSteps ?? []));
    setQuizResponses(session.quizResponses ?? {});
    setUserProgress(session.userProgress ?? []);
    setConceptHighlights(session.conceptHighlights ?? []);
    setUserNotes(new Map((session.userNotes ?? []).map(({ topicId, note }: { topicId: string; note: string }) => [topicId, note])));
    setFillBlanksAnswers(session.fillBlanksAnswers ?? []);
    setSelectedOptions(session.selectedOptions ?? []);
    setShortAnswerText(session.shortAnswerText ?? '');
    setMatchPairsAnswers(new Map(session.matchPairsAnswers ?? []));
    setAttemptCount(session.attemptCount ?? 0);
    setShowHint(session.showHint ?? false);
    setCurrentHint(session.currentHint ?? '');
    setWrongAnswers(session.wrongAnswers ?? []);
    setBiteFeedback(session.biteFeedback ?? null);
    setSessionStartTime(session.sessionStartTime ?? Date.now());
    setReadingStartTime(session.readingStartTime ?? 0);
    setCurrentSessionData(session.currentSessionData ?? {
      questionsAttempted: 0,
      questionsCorrectFirstTry: 0,
      questionsSkipped: [],
      hintsUsed: 0,
      attemptsPerQuestion: [],
      moduleTypesUsed: [],
      moduleTypesSucceeded: [],
      timeSpentReading: 0,
      timeSpentOnExercises: 0,
    });
    setExpandedSections(new Set());
    setInteractiveSimulationActive(false);
    setSimulationTopic(null);
    setUserAnswer(null);
    setShowFlashcardBack(false);
    setFeedbackMessage('');
    setShowFeedback(false);
    setIsProcessing(false);
    setProcessingMessage('');
  };

  const handleResumeSession = (session: SubjectExplorerSessionRecord) => {
    setIsRestoringSession(true);
    try {
      applySavedSession(session);
      setFeedbackMessage('Resumed your saved learning journey!');
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 2500);
    } finally {
      setIsRestoringSession(false);
    }
  };

  const handleDeleteSavedSession = async (sessionId: string) => {
    if (!currentUser) {
      return;
    }

    try {
      await deleteSubjectExplorerSession(currentUser.uid, sessionId);
      setSavedSessions(prev => prev.filter(session => session.id !== sessionId));

      if (activeSessionId === sessionId) {
        resetSessionState();
      }

      setFeedbackMessage('Removed saved journey.');
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 2000);
    } catch (error) {
      console.error('[SubjectExplorer] Failed to delete saved session:', error);
    }
  };

  const getGeminiModel = (modelName: string, useApiKey?: string) => {
    const keyToUse = useApiKey || apiKey;
    if (!keyToUse) {
      throw new Error('API key is required');
    }
    const genAI = new GoogleGenerativeAI(keyToUse);
    return genAI.getGenerativeModel({ model: modelName });
  };

  const callGeminiWithFallback = async (prompt: string, schema?: any) => {
    const models = ['gemini-flash-latest'];

    for (const modelName of models) {
      try {
        if (apiKey) {
          try {
            console.log(`[SubjectExplorer] Attempting with user's API key and model: ${modelName}`);
            const model = getGeminiModel(modelName, apiKey);

            if (schema) {
              const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  responseSchema: schema,
                },
              });
              return JSON.parse(result.response.text());
            }

            const result = await model.generateContent(prompt);
            return result.response.text();
          } catch (directError: any) {
            if (directError?.message?.includes('429') || directError?.message?.includes('quota')) {
              console.log(`[SubjectExplorer] User's API key is rate limited for ${modelName}, trying rotation...`);
            } else {
              console.warn(`[SubjectExplorer] Error with user's API key for ${modelName}:`, directError);
            }
          }
        }

        console.log(`[SubjectExplorer] Attempting with rotation for model: ${modelName}`);
        return await executeWithRotation(async () => {
          const model = getGeminiModel(modelName);

          if (schema) {
            const result = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: schema,
              },
            });
            return JSON.parse(result.response.text());
          }

          const result = await model.generateContent(prompt);
          return result.response.text();
        });
      } catch (error) {
        console.error(`[SubjectExplorer] Error with model ${modelName}:`, error);
        if (modelName === models[models.length - 1]) {
          throw error;
        }
        console.log('[SubjectExplorer] Falling back to next model...');
      }
    }

    throw new Error('Failed to generate content with available models.');
  };

  const markStepComplete = (stepIndex: number) => {
    const nextCompleted = new Set(completedLearningSteps);
    nextCompleted.add(stepIndex);
    setCompletedLearningSteps(new Set(nextCompleted));

    const nextStep = stepIndex < learningSections.length - 1 ? stepIndex + 1 : stepIndex;

    if (stepIndex < learningSections.length - 1) {
      setCurrentLearningStep(nextStep);
    }

    persistSession('learning', {
      completedLearningSteps: Array.from(nextCompleted),
      currentLearningStep: nextStep,
    });
  };

  const handleQuickCheckSelection = (stepIndex: number, optionIndex: number) => {
    const updatedResponses = {
      ...quizResponses,
      [stepIndex.toString()]: optionIndex,
    };
    setQuizResponses(updatedResponses);

    const check = quickChecks[stepIndex];
    if (check && optionIndex === check.answerIndex) {
      markStepComplete(stepIndex);
    }

    persistSession('learning', {
      quizResponses: updatedResponses,
    });
  };

  const updateBiteTextInput = (biteId: string, value: string) => {
    setBiteTextInputs(prev => ({
      ...prev,
      [biteId]: value,
    }));
  };

  const handleBiteSuccess = (
    bite: LessonBite,
    alreadyCompleted: boolean,
    customMessage?: string,
    overrides?: LessonBiteStateOverrides
  ) => {
    const choiceResponses = overrides?.choiceResponses ?? biteChoiceResponses;
    const textInputsPayload = overrides?.textInputs ?? biteTextInputs;
    const textSubmissionsPayload = overrides?.textSubmissions ?? biteTextSubmissions;

    const updatedCompleted = new Set(completedBites);
    let updatedXp = xpScore;
    if (!alreadyCompleted) {
      updatedCompleted.add(bite.id);
      updatedXp += bite.xp;
    }

    setCompletedBites(new Set(updatedCompleted));
    setXpScore(updatedXp);

    const updatedStreak = streakCount + 1;
    setStreakCount(updatedStreak);

    const rewardMessage = bite.reward ? bite.reward : '';
    const decoratedReward = rewardMessage ? ` · ${rewardMessage}` : '';
    const defaultMessage = !alreadyCompleted ? `+${bite.xp} XP!${decoratedReward}` : `Great recap!${decoratedReward}`;
    const feedback = customMessage ?? defaultMessage;
    setBiteFeedback(feedback);

    const shouldAdvance = !alreadyCompleted && currentBiteIndex < lessonBites.length - 1;
    const nextIndex = shouldAdvance ? Math.min(currentBiteIndex + 1, lessonBites.length - 1) : currentBiteIndex;

    persistSession('learning', {
      biteChoiceResponses: choiceResponses,
      biteTextInputs: textInputsPayload,
      biteTextSubmissions: textSubmissionsPayload,
      completedBites: Array.from(updatedCompleted),
      xpScore: updatedXp,
      streakCount: updatedStreak,
      hearts,
      currentBiteIndex: nextIndex,
      biteFeedback: feedback,
    });

    if (shouldAdvance) {
      setTimeout(() => {
        setCurrentBiteIndex(prev => Math.min(prev + 1, lessonBites.length - 1));
        setBiteFeedback(null);
        persistSession('learning', { biteFeedback: null });
      }, 900);
    }
  };

  const handleInteractiveMistake = (
    bite: LessonBite,
    alreadyCompleted: boolean,
    encouragement?: string,
    overrides?: LessonBiteStateOverrides
  ) => {
    const choiceResponses = overrides?.choiceResponses ?? biteChoiceResponses;
    const textInputsPayload = overrides?.textInputs ?? biteTextInputs;
    const textSubmissionsPayload = overrides?.textSubmissions ?? biteTextSubmissions;

    let remainingHearts = hearts;
    if (!alreadyCompleted) {
      const heartsToLose = Math.min(hearts, Math.max(1, bite.heartCost));
      if (heartsToLose > 0) {
        remainingHearts = Math.max(hearts - heartsToLose, 0);
        setHearts(remainingHearts);
      }
    }

    setStreakCount(0);
    const message =
      remainingHearts === 0
        ? 'You are out of hearts. Review earlier bites or regenerate the path to keep practicing.'
        : encouragement ?? (bite.tip ? `Try again: ${bite.tip}` : 'Keep going! Review the bite and give it another shot.');
    setBiteFeedback(message);

    persistSession('learning', {
      biteChoiceResponses: choiceResponses,
      biteTextInputs: textInputsPayload,
      biteTextSubmissions: textSubmissionsPayload,
      hearts: remainingHearts,
      streakCount: 0,
      biteFeedback: message,
      completedBites: Array.from(completedBites),
      currentBiteIndex,
    });
  };

  const handleLessonBiteOption = (bite: LessonBite, optionIndex: number) => {
    if (!bite || (hearts === 0 && !completedBites.has(bite.id))) {
      return;
    }

    const updatedChoiceResponses = {
      ...biteChoiceResponses,
      [bite.id]: optionIndex,
    };
    setBiteChoiceResponses(updatedChoiceResponses);

    const alreadyCompleted = completedBites.has(bite.id);
    const isCorrect = optionIndex === bite.answerIndex;

    if (isCorrect) {
      handleBiteSuccess(bite, alreadyCompleted, undefined, { choiceResponses: updatedChoiceResponses });
    } else {
      handleInteractiveMistake(bite, alreadyCompleted, undefined, { choiceResponses: updatedChoiceResponses });
    }
  };

  const handleLessonBiteTextSubmit = (bite: LessonBite) => {
    if (!bite) {
      return;
    }

    const response = (biteTextInputs[bite.id] || '').trim();
    if (!response) {
      setBiteFeedback('Share your answer before checking.');
      return;
    }

    const updatedTextSubmissions = {
      ...biteTextSubmissions,
      [bite.id]: response,
    };
    setBiteTextSubmissions(updatedTextSubmissions);

    const alreadyCompleted = completedBites.has(bite.id);

    if (bite.activityType === 'fill_blank') {
      if (hearts === 0 && !alreadyCompleted) {
        return;
      }

      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const candidateAnswers = [bite.correctAnswer || '', ...(bite.acceptableAnswers ?? [])]
        .map(ans => ans.trim())
        .filter(Boolean);
      const isCorrect = candidateAnswers.some(ans => normalize(ans) === normalize(response));

      if (isCorrect) {
        handleBiteSuccess(bite, alreadyCompleted, undefined, { textSubmissions: updatedTextSubmissions });
      } else {
        handleInteractiveMistake(
          bite,
          alreadyCompleted,
          bite.tip ? `Almost! ${bite.tip}` : 'Close! Re-read the bite and adjust your wording.',
          { textSubmissions: updatedTextSubmissions }
        );
      }
      return;
    }

    if (bite.activityType === 'reflection') {
      const xpSnippet = alreadyCompleted ? '' : ` +${bite.xp} XP`;
      const customMessage = `Reflection saved!${xpSnippet}${bite.reward ? ` · ${bite.reward}` : ''}`;
      handleBiteSuccess(bite, alreadyCompleted, customMessage, { textSubmissions: updatedTextSubmissions });
      return;
    }
  };

  const activeSection = learningSections.length > 0
    ? learningSections[Math.min(currentLearningStep, learningSections.length - 1)]
    : undefined;
  const currentQuickCheck = quickChecks[currentLearningStep];
  const currentQuickCheckSelection = quizResponses[currentLearningStep.toString()];
  const allStepsComplete = learningSections.length > 0 && completedLearningSteps.size >= learningSections.length;
  const learningProgress = learningSections.length > 0
    ? Math.round((completedLearningSteps.size / learningSections.length) * 100)
    : 0;
  const activeLessonBite = lessonBites.length > 0 ? lessonBites[Math.min(currentBiteIndex, lessonBites.length - 1)] : null;
  const lessonBiteProgress = lessonBites.length > 0
    ? Math.round((completedBites.size / lessonBites.length) * 100)
    : 0;
  const allLessonBitesComplete = lessonBites.length > 0 && completedBites.size >= lessonBites.length;
  const activeLessonBiteCompleted = activeLessonBite ? completedBites.has(activeLessonBite.id) : false;

  // Agent 3: Tutor - Generate adaptive learning path
  const generateLearningPath = async (gapReport: KnowledgeGapReport) => {
    setIsProcessing(true);
    setProcessingMessage('Designing guided learning journey...');
    setReadingStartTime(Date.now());

    try {
      const adaptiveGuidelines = learningPreferences
        ? getAdaptivePrompts(learningPreferences)
        : {
          contentLengthGuideline: 'Keep explanations concise (2-3 short paragraphs).',
          styleGuidelines: '',
          moduleTypePreference: '',
        };

      const scenarioDirectives = getAcademicScenarioDirectives(academicLevel, gapReport.gaps);

      const riskNotice = gapReport.gaps.some(gap => gap.severity === 'high')
        ? 'IMPORTANT: The learner struggles with this topic. Use plain language, short steps, and reinforce each idea before moving on.'
        : '';

      const promptLines = [
        'You are the "Tutor" agent of an adaptive learning system delivering a Duolingo-style, upbeat experience.',
        `Topic: ${selectedTopic?.name}`,
        `Academic level: ${academicLevel || 'general learner'}`,
        `Knowledge gaps: ${JSON.stringify(gapReport.gaps)}`,
        `Learner strengths: ${JSON.stringify(gapReport.strengths)}`,
        '',
        'Document reference (trimmed to stay within limits):',
        documentContent.substring(0, 4000),
        '',
        'Teaching directives:',
        `- ${adaptiveGuidelines.contentLengthGuideline}`,
        adaptiveGuidelines.styleGuidelines ? `- ${adaptiveGuidelines.styleGuidelines}` : '',
        riskNotice ? `- ${riskNotice}` : '',
        '- Keep every explanation playful, concise, and emoji-friendly.',
        '- Avoid dense paragraphs. Think in quick bites learners can finish in under a minute.',
        '- Explicitly reference any diagrams, spectra, or figures that should be shown so the UI can surface an image preview.',
        ...scenarioDirectives,
        '- Vary activity formats across bites—mix multiple choice, fill-in, and reflection moments. Include at least one bite that is NOT multiple choice.',
        '',
        'Produce between 3 and 5 lesson bites using ONLY the structure below so the UI can parse it:',
        '[LESSON_BITE]',
        'Title: <fun, motivating bite name with one emoji>',
        'Focus: <the micro-skill being targeted>',
        'Type: <teach | practice | challenge>',
        'ActivityType: <multiple_choice | fill_blank | reflection>',
        'XP: <integer between 10 and 25>',
        'HeartCost: <1 or 2; use 0 for reflection>',
        'Teach: <1-2 short sentences explaining the idea in plain language>',
        'Prompt: <instruction for the learner to act on the concept>',
        'Options:',
        '- <option 1 (<= 12 words)>',
        '- <option 2>',
        '- <option 3>',
        'Answer: <number of the correct option starting at 1 OR the exact fill-in answer>',
        'AltAnswers: <optional comma-separated list of acceptable responses for fill_blank>',
        'ReflectionGuide: <one-line coaching cue for reflection bites>',
        'Tip: <quick hint shown after an incorrect attempt>',
        'Reward: <excited celebration after success>',
        '[/LESSON_BITE]',
        '',
        'Formatting rules by activity type:',
        '- If ActivityType is multiple_choice: include Options (exactly 3 choices) and Answer as the correct option number.',
        '- If ActivityType is fill_blank: skip the Options list if you prefer, but Answer must be the correct phrase. AltAnswers may list acceptable synonyms.',
        '- If ActivityType is reflection: set HeartCost to 0, skip Options/Answer, and provide a ReflectionGuide cue.',
        '',
        'After all lesson bites, finish with a single [SESSION_SUMMARY] block containing:',
        '[SESSION_SUMMARY]',
        'XP_Earned: <sum of XP available today>',
        'Skill_Level: <brief statement of current mastery>',
        'Next_Step: <one actionable suggestion for what to do next>',
        'Encouragement: <upbeat closing line>',
        '[/SESSION_SUMMARY]',
        '',
        'Do NOT output any other text outside these blocks. No Markdown headings, no bullet points beyond the defined tags.',
        'Keep tone supportive, energetic, and focused on progress.',
      ].filter(Boolean);

      const contentPrompt = promptLines.join('\n');
      const content = await callGeminiWithFallback(contentPrompt);
      setLearningContent(content);

      const { bites, summary } = parseDuolingoLearningJourney(content);

      if (bites.length > 0) {
        setLessonBites(bites);
        setSessionSummaryPlan(summary);
        setCurrentBiteIndex(0);
        setBiteChoiceResponses({});
        setBiteTextInputs({});
        setBiteTextSubmissions({});
        setCompletedBites(new Set());
        setXpScore(0);
        setStreakCount(0);
        setHearts(5);
        setBiteFeedback(null);

        // Reset legacy structures
        setLearningSections([]);
        setJourneySummary(null);
        setQuickChecks([]);
        setCurrentLearningStep(0);
        setCompletedLearningSteps(new Set());
        setQuizResponses({});

        await persistSession('learning', {
          knowledgeGapReport: gapReport,
          learningContent: content,
          lessonBites: bites,
          sessionSummaryPlan: summary,
          currentBiteIndex: 0,
          biteChoiceResponses: {},
          biteTextInputs: {},
          biteTextSubmissions: {},
          completedBites: [],
          xpScore: 0,
          streakCount: 0,
          hearts: 5,
          quickChecks: [],
          learningSections: [],
          journeySummary: null,
          currentLearningStep: 0,
          completedLearningSteps: [],
        });
      } else {
        const fallback = parseLearningSections(content);
        const quickChecksData = buildQuickChecks(fallback.sections);
        setLearningSections(fallback.sections);
        setJourneySummary(fallback.summary);
        setQuickChecks(quickChecksData);
        setCurrentLearningStep(0);
        setCompletedLearningSteps(new Set());
        setQuizResponses({});

        setLessonBites([]);
        setSessionSummaryPlan(null);
        setCurrentBiteIndex(0);
        setCompletedBites(new Set());
        setBiteChoiceResponses({});
        setBiteTextInputs({});
        setBiteTextSubmissions({});
        setXpScore(0);
        setStreakCount(0);
        setHearts(5);
        setBiteFeedback(null);

        await persistSession('learning', {
          knowledgeGapReport: gapReport,
          learningContent: content,
          lessonBites: [],
          sessionSummaryPlan: null,
          currentBiteIndex: 0,
          biteChoiceResponses: {},
          biteTextInputs: {},
          biteTextSubmissions: {},
          completedBites: [],
          xpScore: 0,
          streakCount: 0,
          hearts: 5,
          quickChecks: quickChecksData,
          learningSections: fallback.sections,
          journeySummary: fallback.summary,
          currentLearningStep: 0,
          completedLearningSteps: [],
        });
      }

      setCurrentSessionData(prev => ({
        ...prev,
        contentLengthProvided: content.split(' ').length,
      }));

      setProcessingMessage('Creating practice exercise...');
      if (gapReport.gaps.length > 0) {
        await generateTutorModule(gapReport.gaps[0]);
      }
    } catch (error: any) {
      console.error('[SubjectExplorer] Error generating learning path:', error);

      if (error?.message?.includes('rate limited') || error?.message?.includes('quota')) {
        setFeedbackMessage('⚠️ API rate limit reached. Please add your personal Gemini API key in Settings to continue.');
        setShowApiKeyModal(true);
      } else {
        setFeedbackMessage('Failed to generate learning path. Please try again or add your API key in Settings.');
      }
      setShowFeedback(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Agent 1: Librarian - Extract topics and academic level
  const analyzeDocument = async (file: File) => {
    setIsProcessing(true);
    setProcessingMessage('Analyzing document and extracting topics...');

    try {
      let documentText = '';

      // Create a URL for the PDF file to be used by the PDF viewer
      if (file.type === 'application/pdf') {
        const fileUrl = URL.createObjectURL(file);
        setDocumentFileUrl(fileUrl);
      }

      // Extract text based on file type
      if (file.type === 'application/pdf') {
        console.log('[SubjectExplorer] Processing PDF file...');
        setProcessingMessage('Extracting text from PDF...');

        // Convert PDF to base64
        const bytes = await file.arrayBuffer();
        const base64Data = arrayBufferToBase64(bytes);
        console.log('[SubjectExplorer] PDF converted to base64, length:', base64Data.length);

        // Use Gemini to extract text from PDF
        const models = ['gemini-2.5-flash', 'gemini-flash-latest'];

        for (const modelName of models) {
          try {
            if (apiKey) {
              const genAI = new GoogleGenerativeAI(apiKey);
              const model = genAI.getGenerativeModel({ model: modelName });

              const result = await model.generateContent([
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data
                  }
                },
                `Please extract the complete text content from this PDF document.

CRITICAL REQUIREMENTS:
1. Preserve ALL text content from the document
2. Maintain the document structure and organization
3. Include all important information: headings, body text, lists, tables, etc.
4. Be thorough - don't summarize, extract the full text

Provide the complete text content.`
              ]);

              documentText = result.response.text();
              console.log('[SubjectExplorer] PDF text extracted, length:', documentText.length);
              break;
            }
          } catch (error) {
            console.error(`[SubjectExplorer] Error extracting PDF with ${modelName}:`, error);
            if (modelName === models[models.length - 1]) {
              throw new Error('Failed to extract text from PDF. Please add your API key in Settings.');
            }
          }
        }

        if (!documentText) {
          throw new Error('Failed to extract text from PDF');
        }
      } else {
        // For text files (.txt, .md)
        console.log('[SubjectExplorer] Processing text file...');
        const reader = new FileReader();
        documentText = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      setDocumentContent(documentText);

      const fingerprint = await computeDocumentFingerprint(documentText);
      const matchingSession = currentUser
        ? savedSessions.find(session => session.documentId === fingerprint)
        : undefined;

      if (matchingSession && typeof window !== 'undefined') {
        const shouldResume = window.confirm('We found a saved learning journey for this document. Resume where you left off?');
        if (shouldResume) {
          setProcessingMessage('Resuming your saved learning journey...');
          handleResumeSession(matchingSession);
          setIsProcessing(false);
          return;
        }
      }

      setDocumentFingerprint(fingerprint);
      const sessionId = generateSessionId(fingerprint);
      setActiveSessionId(sessionId);

      // Now analyze the extracted text
      setProcessingMessage('Analyzing topics and academic level...');

      const schema = {
        type: SchemaType.OBJECT,
        properties: {
          interaction_type: { type: SchemaType.STRING },
          message: { type: SchemaType.STRING },
          topics: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
          },
          academic_level: { type: SchemaType.STRING }
        },
        required: ['interaction_type', 'message', 'topics', 'academic_level']
      };

      const prompt = `You are the "Librarian" agent in an adaptive tutoring system. Analyze this document and:
1. Determine the academic level (e.g., "undergraduate chemistry", "high school physics", etc.)
2. Extract 4-6 primary topics that are central to this document
3. Present them in a structured format for topic selection

Document content:
${documentText.substring(0, 8000)}

Respond with a JSON object containing:
- interaction_type: "topic_selection"
- message: A friendly message asking the user to select a topic
- topics: Array of topic names
- academic_level: The determined academic level`;

      const response = await callGeminiWithFallback(prompt, schema) as TopicSelectionResponse;

      const normalizedAcademicLevel = response.academic_level || 'general';
      const topicOptions = response.topics.map((topic, idx) => ({ id: `topic-${idx}`, name: topic }));

      setAcademicLevel(normalizedAcademicLevel);
      setTopics(topicOptions);
      setStage('topic_selection');

      await persistSession(
        'topic_selection',
        {
          documentId: fingerprint,
          documentName: file.name,
          documentContent: documentText,
          academicLevel: normalizedAcademicLevel,
          topics: topicOptions,
          selectedTopic: null,
          assessmentType: null,
        },
        sessionId
      );
    } catch (error: any) {
      console.error('[SubjectExplorer] Error analyzing document:', error);

      // Reset to upload stage on error
      setStage('upload');

      // Provide helpful error message and show modal for API key issues
      if (error?.message?.includes('rate limited') || error?.message?.includes('quota')) {
        setFeedbackMessage('⚠️ API rate limit reached. Please add your personal Gemini API key in Settings to continue.');
        setShowApiKeyModal(true);
        setShowFeedback(true);
      } else if (error?.message?.includes('API key')) {
        setFeedbackMessage('⚠️ No API key available. Please add your Gemini API key in Settings.');
        setShowApiKeyModal(true);
        setShowFeedback(true);
      } else {
        setFeedbackMessage('Failed to analyze document. Please try again or add your API key in Settings for better reliability.');
        setShowFeedback(true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Agent 2: Assessor - Generate assessment
  const generateAssessment = async (topic: Topic, assessmentType: string) => {
    setIsProcessing(true);
    setProcessingMessage('Generating assessment...');

    try {
      let moduleSchema: any;
      let prompt: string;

      if (assessmentType === 'quiz') {
        moduleSchema = {
          type: SchemaType.OBJECT,
          properties: {
            module_type: { type: SchemaType.STRING },
            question: { type: SchemaType.STRING },
            options: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: { type: SchemaType.STRING },
                  text: { type: SchemaType.STRING }
                },
                required: ['id', 'text']
              }
            },
            correct_ids: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            }
          },
          required: ['module_type', 'question', 'options', 'correct_ids']
        };

        prompt = `You are the "Assessor" agent. Create a baseline knowledge quiz for the topic "${topic.name}" at ${academicLevel} level.
Generate a multiple-choice question (with 2-3 correct answers) to assess foundational knowledge.

Document context:
${documentContent.substring(0, 4000)}

Respond with a JSON object for an mcq_multi module.`;
      } else if (assessmentType === 'flashcards') {
        moduleSchema = {
          type: SchemaType.OBJECT,
          properties: {
            module_type: { type: SchemaType.STRING },
            front: { type: SchemaType.STRING },
            back: { type: SchemaType.STRING }
          },
          required: ['module_type', 'front', 'back']
        };

        prompt = `You are the "Assessor" agent. Create a flashcard for the topic "${topic.name}" at ${academicLevel} level.
The flashcard should test a key concept or definition.

Document context:
${documentContent.substring(0, 4000)}

Respond with a JSON object for a flashcard module.`;
      } else {
        // canvas_prompt or short_answer
        moduleSchema = {
          type: SchemaType.OBJECT,
          properties: {
            module_type: { type: SchemaType.STRING },
            question: { type: SchemaType.STRING },
            keywords_to_check: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            }
          },
          required: ['module_type', 'question', 'keywords_to_check']
        };

        prompt = `You are the "Assessor" agent. Create a short answer question for the topic "${topic.name}" at ${academicLevel} level.
Ask the user to explain a concept in 1-2 sentences.

Document context:
${documentContent.substring(0, 4000)}

Respond with a JSON object for a short_answer module.`;
      }

      const module = await callGeminiWithFallback(prompt, moduleSchema);
      setCurrentModule(module);
      setStage('assessment');
      await persistSession('assessment', {
        assessmentType,
        currentModule: module,
      });
    } catch (error: any) {
      console.error('[SubjectExplorer] Error generating assessment:', error);

      if (error?.message?.includes('rate limited') || error?.message?.includes('quota')) {
        setFeedbackMessage('⚠️ API rate limit reached. Please add your personal Gemini API key in Settings to continue.');
        setShowApiKeyModal(true);
      } else {
        setFeedbackMessage('Failed to generate assessment. Please try again or add your API key in Settings.');
      }
      setShowFeedback(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Agent 2: Assessor - Analyze assessment results
  const analyzeAssessmentResults = async (isCorrect: boolean, userResponse: any) => {
    setIsProcessing(true);
    setProcessingMessage('Analyzing your knowledge...');

    try {
      const schema = {
        type: SchemaType.OBJECT,
        properties: {
          gaps: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                concept: { type: SchemaType.STRING },
                severity: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING }
              },
              required: ['concept', 'severity', 'description']
            }
          },
          strengths: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
          },
          overall_level: { type: SchemaType.STRING }
        },
        required: ['gaps', 'strengths', 'overall_level']
      };

      const prompt = `You are the "Assessor" agent. Analyze the user's performance on this assessment:

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}
Assessment Type: ${currentModule?.module_type}
User's Response: ${JSON.stringify(userResponse)}
Result: ${isCorrect ? 'Correct' : 'Incorrect'}

Document context:
${documentContent.substring(0, 4000)}

Create a Knowledge Gap Report identifying:
1. Specific knowledge gaps (if any)
2. Strengths demonstrated
3. Overall proficiency level

Respond with a structured JSON report.`;

      const report = await callGeminiWithFallback(prompt, schema) as KnowledgeGapReport;
      setKnowledgeGapReport(report);
      setUseFocusedLearningMode(true); // Auto-enable focused mode after assessment
      setStage('learning');
      await persistSession('assessment', { knowledgeGapReport: report });

      // Generate initial learning content
      await generateLearningPath(report);
    } catch (error: any) {
      console.error('[SubjectExplorer] Error analyzing results:', error);

      if (error?.message?.includes('rate limited') || error?.message?.includes('quota')) {
        setFeedbackMessage('⚠️ API rate limit reached. Please add your personal Gemini API key in Settings to continue.');
        setShowApiKeyModal(true);
      } else {
        setFeedbackMessage('Failed to analyze results. Please try again or add your API key in Settings.');
      }
      setShowFeedback(true);
    } finally {
      setIsProcessing(false);
    }
  };



  // Agent 3: Tutor - Generate interactive module with AI-driven format selection
  const generateTutorModule = async (gap: KnowledgeGap) => {
    try {
      // AI Agent: Module Format Selector
      // Analyzes user's learning history to choose optimal teaching format
      const selectedModuleType = await selectOptimalModuleType(gap);

      console.log('[ModuleSelector] Selected format:', selectedModuleType, 'for concept:', gap.concept);

      // Track module type usage
      setCurrentSessionData(prev => ({
        ...prev,
        moduleTypesUsed: [...(prev.moduleTypesUsed || []), selectedModuleType],
      }));

      // Generate module based on selected type
      let module: InteractiveModule;

      switch (selectedModuleType) {
        case 'fill_blanks':
          module = await generateFillBlanksModule(gap);
          break;
        case 'mcq_multi':
          module = await generateMCQModule(gap);
          break;
        case 'match_pairs':
          module = await generateMatchPairsModule(gap);
          break;
        case 'short_answer':
          module = await generateShortAnswerModule(gap);
          break;
        case 'flashcard':
          module = await generateFlashcardModule(gap);
          break;
        default:
          module = await generateFillBlanksModule(gap);
      }

      setTutorModules([module]);
      setCurrentTutorModuleIndex(0);
      setFillBlanksAnswers([]);
      setSelectedOptions([]);
      setShortAnswerText('');
      setMatchPairsAnswers(new Map());
      setAttemptCount(0);
      setShowHint(false);
      setWrongAnswers([]);
      setBiteFeedback(null);
      persistSession('learning', {
        tutorModules: [module],
        currentTutorModuleIndex: 0,
        fillBlanksAnswers: [],
        selectedOptions: [],
        shortAnswerText: '',
        matchPairsAnswers: [],
        attemptCount: 0,
        showHint: false,
        wrongAnswers: [],
        biteFeedback: null,
      });

      // Track reading time before exercise
      if (readingStartTime > 0) {
        const readingTime = Math.floor((Date.now() - readingStartTime) / 1000);
        setCurrentSessionData(prev => ({
          ...prev,
          timeSpentReading: (prev.timeSpentReading || 0) + readingTime,
        }));
      }
    } catch (error) {
      console.error('Error generating tutor module:', error);
      // Fallback to fill_blanks
      const fallbackModule = await generateFillBlanksModule(gap);
      setTutorModules([fallbackModule]);
      setCurrentTutorModuleIndex(0);
      setFillBlanksAnswers([]);
      setSelectedOptions([]);
      setShortAnswerText('');
      setMatchPairsAnswers(new Map());
      setAttemptCount(0);
      setShowHint(false);
      setWrongAnswers([]);
      setBiteFeedback(null);
      persistSession('learning', {
        tutorModules: [fallbackModule],
        currentTutorModuleIndex: 0,
        fillBlanksAnswers: [],
        selectedOptions: [],
        shortAnswerText: '',
        matchPairsAnswers: [],
        attemptCount: 0,
        showHint: false,
        wrongAnswers: [],
        biteFeedback: null,
      });
    }
  };

  // AI Agent: Intelligent Module Format Selector
  const selectOptimalModuleType = async (gap: KnowledgeGap): Promise<string> => {
    try {
      // Build analysis context from user's learning history
      const recentAttempts = currentSessionData.attemptsPerQuestion?.slice(-5) || [];
      const avgRecentAttempts = recentAttempts.length > 0
        ? recentAttempts.reduce((a, b) => a + b, 0) / recentAttempts.length
        : 0;

      const recentModules = currentSessionData.moduleTypesUsed?.slice(-3) || [];
      const recentSuccesses = currentSessionData.moduleTypesSucceeded?.slice(-3) || [];

      // Determine struggling patterns
      const isStrugglingWithCurrent = avgRecentAttempts > 2;
      const hasSkippedOnTopic = learningPreferences?.skippedQuestions
        .filter(q => q.topic === selectedTopic?.name).length || 0;

      const scenarioDirectives = getAcademicScenarioDirectives(academicLevel || '', [gap]).join('\n')
        || '- Align with the specified academic level using rigorous, experiment-driven framing when appropriate.';

      // Call Gemini to intelligently select module type
      const analysisPrompt = `You are an AI Teaching Assistant specializing in adaptive learning.

STUDENT LEARNING PROFILE:
- Current Topic: ${selectedTopic?.name}
- Concept to Teach: "${gap.concept}"
- Gap Severity: ${gap.severity}
- Academic Level: ${academicLevel}

RECENT PERFORMANCE:
- Average Attempts per Question: ${avgRecentAttempts.toFixed(1)}
- Recently Used Formats: ${recentModules.length > 0 ? recentModules.join(', ') : 'None yet'}
- Succeeded With: ${recentSuccesses.length > 0 ? recentSuccesses.join(', ') : 'None yet'}
- Questions Skipped on This Topic: ${hasSkippedOnTopic}
- Is Struggling: ${isStrugglingWithCurrent ? 'YES' : 'No'}

LEARNING PREFERENCES:
- Information Length: ${learningPreferences?.informationLength || 'moderate'}
- Needs More Examples: ${learningPreferences?.needsMoreExamples || false}
- Prefers Analogies: ${learningPreferences?.prefersAnalogyExplanations || false}

ADVANCED SCENARIO EXPECTATIONS:
${scenarioDirectives}

AVAILABLE TEACHING FORMATS:
1. "fill_blanks" - Good for testing recall and understanding of key terms in context
2. "mcq_multi" - Good for concept recognition and comparison of options
3. "match_pairs" - Good for connecting related concepts, visual learners, breaking info into chunks
4. "short_answer" - Good for deep understanding and explanation skills
5. "flashcard" - Good for memorization and quick review of definitions

SELECTION RULES:
- If student is struggling (avg attempts > 2), avoid fill_blanks and short_answer
- If student skipped questions, use match_pairs or mcq_multi (easier to engage)
- If student prefers brief content, use match_pairs or flashcard (bite-sized)
- Vary the format! Don't use the same type twice in a row
- For high-severity gaps, use interactive formats (match_pairs, mcq_multi)
- For low-severity gaps, can use fill_blanks or short_answer

Based on this analysis, which ONE format would be most effective for THIS student learning THIS concept?

Respond with ONLY the format name: fill_blanks, mcq_multi, match_pairs, short_answer, or flashcard`;

      const response = await callGeminiWithFallback(analysisPrompt);
      const selectedType = response.toLowerCase().trim();

      // Validate response
      const validTypes = ['fill_blanks', 'mcq_multi', 'match_pairs', 'short_answer', 'flashcard'];
      if (validTypes.includes(selectedType)) {
        return selectedType;
      }

      // Fallback logic if AI doesn't respond properly
      console.warn('[ModuleSelector] Invalid AI response, using fallback logic');
      return getFallbackModuleType(isStrugglingWithCurrent, hasSkippedOnTopic, recentModules);

    } catch (error) {
      console.error('[ModuleSelector] Error in AI selection:', error);
      // Use fallback logic
      const recentModules = currentSessionData.moduleTypesUsed?.slice(-3) || [];
      return getFallbackModuleType(false, 0, recentModules);
    }
  };

  // Fallback module selection logic
  const getFallbackModuleType = (
    isStruggling: boolean,
    skippedCount: number,
    recentModules: string[]
  ): string => {
    const lastModule = recentModules[recentModules.length - 1];

    // Ensure variety
    const availableTypes = ['fill_blanks', 'mcq_multi', 'match_pairs', 'short_answer', 'flashcard'];
    const notRecentTypes = availableTypes.filter(t => !recentModules.includes(t));

    if (isStruggling || skippedCount > 0) {
      // Use easier, more interactive formats
      const easyTypes = notRecentTypes.filter(t =>
        ['match_pairs', 'mcq_multi', 'flashcard'].includes(t)
      );
      return easyTypes.length > 0 ? easyTypes[0] : 'match_pairs';
    }

    // Use variety
    return notRecentTypes.length > 0 ? notRecentTypes[0] : 'fill_blanks';
  };

  // Generate Fill-in-the-Blanks Module
  const generateFillBlanksModule = async (gap: KnowledgeGap): Promise<FillBlanks> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        text: { type: SchemaType.STRING },
        blanks: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      },
      required: ['module_type', 'text', 'blanks']
    };

    const scenarioDirectives = getAcademicScenarioDirectives(academicLevel || '', [gap]).join('\n');

    const prompt = `You are the "Tutor" agent. Create a fill-in-the-blanks exercise to test understanding of: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Scenario expectations:
${scenarioDirectives}

Create a sentence or short paragraph with 2-3 blanks marked as [____]. 
Provide the correct answers in the blanks array.
Make it engaging and relevant to real-world applications.

Respond with a JSON object for a fill_blanks module.`;

    return await callGeminiWithFallback(prompt, schema) as FillBlanks;
  };

  // Generate MCQ Module
  const generateMCQModule = async (gap: KnowledgeGap): Promise<MCQMulti> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        question: { type: SchemaType.STRING },
        options: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              text: { type: SchemaType.STRING }
            },
            required: ['id', 'text']
          }
        },
        correct_ids: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      },
      required: ['module_type', 'question', 'options', 'correct_ids']
    };

    const scenarioDirectives = getAcademicScenarioDirectives(academicLevel || '', [gap]).join('\n');

    const prompt = `You are the "Tutor" agent. Create a multiple-choice question to test understanding of: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Scenario expectations:
${scenarioDirectives}

Create a clear question with 4-5 options. Mark 1-2 correct answers.
Options should be plausible but distinguishable.

Respond with a JSON object:
{
  "module_type": "mcq_multi",
  "question": "...",
  "options": [
    {"id": "a", "text": "..."},
    {"id": "b", "text": "..."},
    ...
  ],
  "correct_ids": ["a", "c"]
}`;

    return await callGeminiWithFallback(prompt, schema) as MCQMulti;
  };

  // Generate Match Pairs Module
  const generateMatchPairsModule = async (gap: KnowledgeGap): Promise<MatchPairs> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        prompt: { type: SchemaType.STRING },
        column_a: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        },
        column_b: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        },
        correct_pairs: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              a: { type: SchemaType.STRING },
              b: { type: SchemaType.STRING }
            },
            required: ['a', 'b']
          }
        }
      },
      required: ['module_type', 'prompt', 'column_a', 'column_b', 'correct_pairs']
    };

    const scenarioDirectives = getAcademicScenarioDirectives(academicLevel || '', [gap]).join('\n');

    const prompt = `You are the "Tutor" agent. Create a matching exercise to test understanding of: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Scenario expectations:
${scenarioDirectives}

Create 4-5 pairs of related items (terms and definitions, concepts and examples, etc.).
This format helps students connect ideas and is easier for those who struggle with large chunks of information.

Respond with a JSON object:
{
  "module_type": "match_pairs",
  "prompt": "Match each term with its correct definition",
  "column_a": ["Term 1", "Term 2", ...],
  "column_b": ["Definition A", "Definition B", ...],
  "correct_pairs": [
    {"a": "Term 1", "b": "Definition A"},
    ...
  ]
}`;

    return await callGeminiWithFallback(prompt, schema) as MatchPairs;
  };

  // Generate Short Answer Module
  const generateShortAnswerModule = async (gap: KnowledgeGap): Promise<ShortAnswer> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        question: { type: SchemaType.STRING },
        keywords_to_check: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      },
      required: ['module_type', 'question', 'keywords_to_check']
    };

    const scenarioDirectives = getAcademicScenarioDirectives(academicLevel || '', [gap]).join('\n');

    const prompt = `You are the "Tutor" agent. Create a short-answer question to test deep understanding of: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Scenario expectations:
${scenarioDirectives}

Create an open-ended question that requires explanation.
Provide 3-5 key terms/concepts that should appear in a correct answer.

Respond with a JSON object:
{
  "module_type": "short_answer",
  "question": "...",
  "keywords_to_check": ["keyword1", "keyword2", ...]
}`;

    return await callGeminiWithFallback(prompt, schema) as ShortAnswer;
  };

  // Generate Flashcard Module
  const generateFlashcardModule = async (gap: KnowledgeGap): Promise<Flashcard> => {
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        module_type: { type: SchemaType.STRING },
        front: { type: SchemaType.STRING },
        back: { type: SchemaType.STRING }
      },
      required: ['module_type', 'front', 'back']
    };

    const scenarioDirectives = getAcademicScenarioDirectives(academicLevel || '', [gap]).join('\n');

    const prompt = `You are the "Tutor" agent. Create a flashcard to help memorize: "${gap.concept}"

Topic: ${selectedTopic?.name}
Academic Level: ${academicLevel}

Scenario expectations:
${scenarioDirectives}

Create a clear question/term for the front and a concise answer/definition for the back.
Keep the back brief (1-3 sentences).

Respond with a JSON object:
{
  "module_type": "flashcard",
  "front": "Question or term...",
  "back": "Answer or definition..."
}`;

    return await callGeminiWithFallback(prompt, schema) as Flashcard;
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetSessionState();
    setDocumentName(file.name);

    // Validate file type
    const validTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      setFeedbackMessage('⚠️ Please upload a PDF, TXT, or Markdown file.');
      setShowFeedback(true);
      return;
    }

    // Analyze the document directly
    await analyzeDocument(file);
  };

  // Handle topic selection
  const handleTopicSelect = (topic: Topic) => {
    setSelectedTopic(topic);
    const topicPayload = {
      id: topic.id,
      name: topic.name,
      ...(topic.description ? { description: topic.description } : {}),
    };
    persistSession('topic_selection', { selectedTopic: topicPayload });
  };

  // Handle assessment type selection
  const handleAssessmentTypeSelect = (type: string) => {
    setAssessmentType(type);
    persistSession('topic_selection', { assessmentType: type });
    if (selectedTopic) {
      generateAssessment(selectedTopic, type);
    }
  };

  // Handle module answer submission
  const handleSubmitAnswer = async () => {
    if (!currentModule) return;

    let isCorrect = false;
    let userResponse: any = null;

    if (currentModule.module_type === 'mcq_multi') {
      const correctIds = currentModule.correct_ids.sort();
      const selectedIds = selectedOptions.sort();
      isCorrect = JSON.stringify(correctIds) === JSON.stringify(selectedIds);
      userResponse = selectedOptions;

      setFeedbackMessage(isCorrect
        ? '✓ Correct! Well done!'
        : `✗ Not quite. The correct answers were: ${currentModule.correct_ids.join(', ')}`);
    } else if (currentModule.module_type === 'short_answer') {
      const keywords = currentModule.keywords_to_check;
      const answer = shortAnswerText.toLowerCase();
      const foundKeywords = keywords.filter(kw => answer.includes(kw.toLowerCase()));
      isCorrect = foundKeywords.length >= Math.ceil(keywords.length * 0.6);
      userResponse = shortAnswerText;

      setFeedbackMessage(isCorrect
        ? '✓ Good answer! You covered the key concepts.'
        : `✗ Your answer is missing some key concepts: ${keywords.filter(kw => !foundKeywords.includes(kw)).join(', ')}`);
    } else if (currentModule.module_type === 'flashcard') {
      isCorrect = true; // Flashcards are self-assessment
      userResponse = 'reviewed';
      setFeedbackMessage('Great! Let\'s move on to the next step.');
    }

    setShowFeedback(true);

    // Wait a moment before analyzing
    setTimeout(() => {
      analyzeAssessmentResults(isCorrect, userResponse);
    }, 2000);
  };

  // Handle tutor module answer
  const handleTutorModuleAnswer = async () => {
    if (!tutorModules[currentTutorModuleIndex]) return;

    const module = tutorModules[currentTutorModuleIndex];
    let isCorrect = false;
    let correctCount = 0;
    let totalCount = 0;
    const wrongIndices: number[] = [];

    // Check answers based on module type
    if (module.module_type === 'fill_blanks') {
      const fillModule = module as FillBlanks;
      const correctAnswers = fillModule.blanks.map(b => b.toLowerCase().trim());
      const userAnswersLower = fillBlanksAnswers.map(a => (a || '').toLowerCase().trim());

      userAnswersLower.forEach((ans, idx) => {
        if (correctAnswers[idx] !== ans) {
          wrongIndices.push(idx);
        }
      });

      correctCount = userAnswersLower.filter((ans, idx) =>
        correctAnswers[idx] === ans
      ).length;
      totalCount = correctAnswers.length;
      isCorrect = correctCount === totalCount;

    } else if (module.module_type === 'mcq_multi') {
      const mcqModule = module as MCQMulti;
      const correctIds = mcqModule.correct_ids.sort();
      const selectedIds = selectedOptions.sort();
      isCorrect = JSON.stringify(correctIds) === JSON.stringify(selectedIds);
      correctCount = isCorrect ? 1 : 0;
      totalCount = 1;

    } else if (module.module_type === 'match_pairs') {
      const matchModule = module as MatchPairs;
      correctCount = 0;
      totalCount = matchModule.correct_pairs.length;

      matchModule.correct_pairs.forEach((pair, idx) => {
        const userMatch = matchPairsAnswers.get(pair.a);
        if (userMatch === pair.b) {
          correctCount++;
        } else {
          wrongIndices.push(idx);
        }
      });

      isCorrect = correctCount === totalCount;

    } else if (module.module_type === 'short_answer') {
      const shortModule = module as ShortAnswer;
      const keywords = shortModule.keywords_to_check;
      const answer = shortAnswerText.toLowerCase();
      const foundKeywords = keywords.filter(kw => answer.includes(kw.toLowerCase()));
      correctCount = foundKeywords.length;
      totalCount = keywords.length;
      isCorrect = correctCount >= Math.ceil(totalCount * 0.6);

    } else if (module.module_type === 'flashcard') {
      // Flashcards are always "correct" when user clicks
      isCorrect = true;
      correctCount = 1;
      totalCount = 1;
    }

    const newAttemptCount = attemptCount + 1;
    setAttemptCount(newAttemptCount);
    setWrongAnswers(wrongIndices);

    // Update session data
    setCurrentSessionData(prev => ({
      ...prev,
      questionsAttempted: (prev.questionsAttempted || 0) + 1,
      questionsCorrectFirstTry: newAttemptCount === 1 && isCorrect
        ? (prev.questionsCorrectFirstTry || 0) + 1
        : (prev.questionsCorrectFirstTry || 0),
      attemptsPerQuestion: [...(prev.attemptsPerQuestion || []), newAttemptCount],
      hintsUsed: (prev.hintsUsed || 0) + (showHint ? 1 : 0),
    }));

    if (isCorrect) {
      setUserProgress([...userProgress, { success: true, moduleType: module.module_type }]);
      setFeedbackMessage(`✓ Excellent! You got it ${newAttemptCount === 1 ? 'on the first try' : `after ${newAttemptCount} attempts`}!`);
      setShowFeedback(true);
      setShowHint(false);
      setAttemptCount(0);
      setWrongAnswers([]);

      // Track successful module type
      setCurrentSessionData(prev => ({
        ...prev,
        moduleTypesSucceeded: [...(prev.moduleTypesSucceeded || []), module.module_type],
        contentWasUnderstood: true,
      }));

      // Save session data to Firebase
      const user = auth.currentUser;
      if (user && selectedTopic && currentSessionData) {
        await saveSessionData({
          userId: user.uid,
          topicId: selectedTopic.id,
          topicName: selectedTopic.name,
          contentLengthProvided: currentSessionData.contentLengthProvided || 0,
          contentWasUnderstood: true,
          questionsAttempted: (currentSessionData.questionsAttempted || 0) + 1,
          questionsCorrectFirstTry: newAttemptCount === 1
            ? (currentSessionData.questionsCorrectFirstTry || 0) + 1
            : (currentSessionData.questionsCorrectFirstTry || 0),
          questionsSkipped: currentSessionData.questionsSkipped || [],
          hintsUsed: currentSessionData.hintsUsed || 0,
          attemptsPerQuestion: [...(currentSessionData.attemptsPerQuestion || []), newAttemptCount],
          moduleTypesUsed: currentSessionData.moduleTypesUsed || [],
          moduleTypesSucceeded: [...(currentSessionData.moduleTypesSucceeded || []), module.module_type],
          timeSpentReading: currentSessionData.timeSpentReading || 0,
          timeSpentOnExercises: Math.floor((Date.now() - sessionStartTime) / 1000),
          timestamp: new Date(),
        });

        // Reload preferences for next session
        const updatedPrefs = await getLearningPreferences(user.uid);
        setLearningPreferences(updatedPrefs);
      }

      // Check if there are more gaps to address
      if (knowledgeGapReport && knowledgeGapReport.gaps.length > 1) {
        setTimeout(() => {
          setShowFeedback(false);
          setFillBlanksAnswers([]);
          setSelectedOptions([]);
          setShortAnswerText('');
          setMatchPairsAnswers(new Map());
          generateLearningPath({
            ...knowledgeGapReport,
            gaps: knowledgeGapReport.gaps.slice(1)
          });
        }, 3000);
      } else {
        setTimeout(() => {
          setFeedbackMessage('🎉 Congratulations! You\'ve completed the learning path for this topic!');
          setShowFeedback(true);
        }, 2000);
      }
    } else {
      setUserProgress([...userProgress, { success: false, moduleType: module.module_type }]);

      // Update session with failed attempt
      setCurrentSessionData(prev => ({
        ...prev,
        contentWasUnderstood: false,
      }));

      // Generate contextual hint based on attempt count and module type
      if (newAttemptCount === 1) {
        setFeedbackMessage(`✗ ${correctCount} out of ${totalCount} correct. Try again!`);
        setShowFeedback(true);
      } else if (newAttemptCount === 2) {
        // Show hint after 2nd attempt
        setCurrentSessionData(prev => ({
          ...prev,
          hintsUsed: (prev.hintsUsed || 0) + 1,
        }));

        let hintMessage = '';
        if (module.module_type === 'fill_blanks') {
          hintMessage = `💡 Hint: ${wrongIndices.length === 1 ? 'The incorrect answer is' : 'The incorrect answers are'} in position${wrongIndices.length > 1 ? 's' : ''}: ${wrongIndices.map(i => i + 1).join(', ')}. Think about the key concepts from the lesson above.`;
        } else if (module.module_type === 'mcq_multi') {
          hintMessage = `💡 Hint: Look carefully at each option. The correct answer(s) directly relate to the key concept explained above.`;
        } else if (module.module_type === 'match_pairs') {
          hintMessage = `💡 Hint: ${wrongIndices.length} pair(s) are incorrect. Focus on the definitions and try to match them with their most logical terms.`;
        } else if (module.module_type === 'short_answer') {
          const shortModule = module as ShortAnswer;
          const missingKeywords = shortModule.keywords_to_check.slice(0, 2);
          hintMessage = `💡 Hint: Your answer should include these concepts: ${missingKeywords.join(', ')}`;
        }

        setCurrentHint(hintMessage);
        setShowHint(true);
        setFeedbackMessage(`✗ ${correctCount} out of ${totalCount} correct. Check the hint below!`);
        setShowFeedback(true);
      } else if (newAttemptCount >= 3) {
        // Show stronger hint
        let hintMessage = '';
        if (module.module_type === 'fill_blanks') {
          const fillModule = module as FillBlanks;
          const firstWrongIdx = wrongIndices[0];
          const correctAnswer = fillModule.blanks[firstWrongIdx];
          hintMessage = `💡 Strong Hint: Answer #${firstWrongIdx + 1} should be "${correctAnswer}". Use this to help with the others!`;
        } else if (module.module_type === 'mcq_multi') {
          const mcqModule = module as MCQMulti;
          hintMessage = `💡 Strong Hint: The correct answer ID(s) start with: ${mcqModule.correct_ids[0]}`;
        } else if (module.module_type === 'match_pairs') {
          const matchModule = module as MatchPairs;
          const firstCorrectPair = matchModule.correct_pairs[0];
          hintMessage = `💡 Strong Hint: "${firstCorrectPair.a}" matches with "${firstCorrectPair.b}"`;
        } else if (module.module_type === 'short_answer') {
          const shortModule = module as ShortAnswer;
          hintMessage = `💡 Strong Hint: Make sure to mention: ${shortModule.keywords_to_check.join(', ')}`;
        }

        setCurrentHint(hintMessage);
        setShowHint(true);
        setFeedbackMessage(`✗ Still ${correctCount} out of ${totalCount} correct. Here's a stronger hint!`);
        setShowFeedback(true);
      }

      // After 4 attempts, offer to show all answers or re-explain
      if (newAttemptCount >= 4) {
        setTimeout(() => {
          const shouldReExplain = confirm('This format seems challenging for you. Would you like me to:\n\nOK = Try a DIFFERENT teaching format (recommended)\nCancel = See answers and continue');

          if (shouldReExplain) {
            // Track re-explanation request
            setCurrentSessionData(prev => ({
              ...prev,
              hintsUsed: (prev.hintsUsed || 0) + 1,
            }));

            setIsProcessing(true);
            setProcessingMessage('Switching to a different teaching format...');

            // Generate a new module with a DIFFERENT format
            if (knowledgeGapReport) {
              generateTutorModule(knowledgeGapReport.gaps[0]).then(() => {
                setAttemptCount(0);
                setShowHint(false);
                setShowFeedback(false);
                setWrongAnswers([]);
                setFillBlanksAnswers([]);
                setSelectedOptions([]);
                setShortAnswerText('');
                setMatchPairsAnswers(new Map());
                setIsProcessing(false);
                setFeedbackMessage('✨ Let\'s try a different approach to learn this concept!');
                setShowFeedback(true);
              });
            }
          } else {
            // Show answers based on module type
            if (module.module_type === 'fill_blanks') {
              setFillBlanksAnswers((module as FillBlanks).blanks);
            } else if (module.module_type === 'mcq_multi') {
              setSelectedOptions((module as MCQMulti).correct_ids);
            } else if (module.module_type === 'match_pairs') {
              const matchModule = module as MatchPairs;
              const correctMap = new Map();
              matchModule.correct_pairs.forEach(pair => correctMap.set(pair.a, pair.b));
              setMatchPairsAnswers(correctMap);
            }
            setFeedbackMessage(`✓ Here are the correct answers. Review them and click "Check Answer" to continue.`);
            setShowFeedback(true);
            setAttemptCount(0);
          }
        }, 1000);
      }
    }
  };

  // Handle skipping a question
  const handleSkipQuestion = async () => {
    if (!tutorModules[currentTutorModuleIndex] || !selectedTopic) return;

    const module = tutorModules[currentTutorModuleIndex] as FillBlanks;
    const user = auth.currentUser;

    // Track skipped question
    setCurrentSessionData(prev => ({
      ...prev,
      questionsSkipped: [
        ...(prev.questionsSkipped || []),
        {
          question: module.text,
          concepts: knowledgeGapReport?.gaps.map(g => g.concept) || [],
        },
      ],
    }));

    // Move to next gap or finish
    if (knowledgeGapReport && knowledgeGapReport.gaps.length > 1) {
      setFeedbackMessage('⏭️ Question skipped. Let\'s try a different approach...');
      setShowFeedback(true);

      setTimeout(() => {
        setShowFeedback(false);
        setFillBlanksAnswers([]);
        setAttemptCount(0);
        setShowHint(false);
        setWrongAnswers([]);

        generateLearningPath({
          ...knowledgeGapReport,
          gaps: knowledgeGapReport.gaps.slice(1)
        });
      }, 2000);
    } else {
      setFeedbackMessage('📝 You\'ve completed this session. We\'ll adapt your learning path based on your preferences!');
      setShowFeedback(true);

      // Save session even with skipped questions
      if (user && selectedTopic && currentSessionData) {
        await saveSessionData({
          userId: user.uid,
          topicId: selectedTopic.id,
          topicName: selectedTopic.name,
          contentLengthProvided: currentSessionData.contentLengthProvided || 0,
          contentWasUnderstood: false, // Skipped means didn't understand
          questionsAttempted: (currentSessionData.questionsAttempted || 0) + 1,
          questionsCorrectFirstTry: currentSessionData.questionsCorrectFirstTry || 0,
          questionsSkipped: [
            ...(currentSessionData.questionsSkipped || []),
            {
              question: module.text,
              concepts: knowledgeGapReport?.gaps.map(g => g.concept) || [],
            },
          ],
          hintsUsed: currentSessionData.hintsUsed || 0,
          attemptsPerQuestion: currentSessionData.attemptsPerQuestion || [],
          moduleTypesUsed: currentSessionData.moduleTypesUsed || [],
          moduleTypesSucceeded: currentSessionData.moduleTypesSucceeded || [],
          timeSpentReading: currentSessionData.timeSpentReading || 0,
          timeSpentOnExercises: Math.floor((Date.now() - sessionStartTime) / 1000),
          timestamp: new Date(),
        });

        // Reload preferences
        const updatedPrefs = await getLearningPreferences(user.uid);
        setLearningPreferences(updatedPrefs);
      }
    }
  };

  // Render math text with KaTeX
  const renderMathText = (text: string) => {
    const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g);
    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <BlockMath key={index} math={part.slice(2, -2)} />;
      } else if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={index} math={part.slice(1, -1)} />;
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Enhanced ReactMarkdown component that handles math
  const MarkdownWithMath = ({ children, components = {} }: { children: string; components?: any }) => {
    // Pre-process to convert LaTeX-style formulas to KaTeX format
    const processedContent = children
      .replace(/\$([^\$]+?)\$/g, (match, formula) => {
        // Return a special marker that we'll replace with KaTeX component
        return `<MATH_INLINE>${formula}</MATH_INLINE>`;
      })
      .replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        return `<MATH_BLOCK>${formula}</MATH_BLOCK>`;
      });

    return (
      <ReactMarkdown
        components={{
          ...components,
          p: ({ node, children, ...props }) => {
            // Check if paragraph contains math
            const text = String(children);
            if (text.includes('<MATH_INLINE>') || text.includes('<MATH_BLOCK>')) {
              return <div {...props}>{renderInlineWithMath(text)}</div>;
            }
            const Component = components?.p || 'p';
            return <Component {...props}>{children}</Component>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  };

  const renderInlineWithMath = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let currentIndex = 0;
    let keyCounter = 0;

    // Combined regex to find both inline and block math
    const mathRegex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;
    let match;

    while ((match = mathRegex.exec(text)) !== null) {
      // Add text before math
      if (match.index > currentIndex) {
        const textBefore = text.substring(currentIndex, match.index);
        parts.push(<span key={`text-${keyCounter++}`} dangerouslySetInnerHTML={{ __html: formatText(textBefore) }} />);
      }

      // Add math
      const mathContent = match[0];
      if (mathContent.startsWith('$$')) {
        parts.push(<BlockMath key={`math-${keyCounter++}`} math={mathContent.slice(2, -2)} />);
      } else {
        parts.push(<InlineMath key={`math-${keyCounter++}`} math={mathContent.slice(1, -1)} />);
      }

      currentIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      parts.push(<span key={`text-${keyCounter++}`} dangerouslySetInnerHTML={{ __html: formatText(remainingText) }} />);
    }

    return <>{parts}</>;
  };

  // Format text with bold, italic, code
  const formatText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-purple-300 font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-blue-300">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-900 px-2 py-0.5 rounded text-purple-300 text-sm">$1</code>');
  };

  // Parse and render interactive learning content
  const renderInteractiveLearningContent = (content: string) => {
    const sections: JSX.Element[] = [];
    let workingContent = content;
    let match;

    // Parse CONCEPT_CARD
    const conceptCardRegex = /\[CONCEPT_CARD\]([\s\S]*?)\[\/CONCEPT_CARD\]/g;
    while ((match = conceptCardRegex.exec(content)) !== null) {
      const cardContent = match[1];
      const titleMatch = cardContent.match(/Title:\s*(.+)/);
      const descMatch = cardContent.match(/Description:\s*(.+)/);
      const iconMatch = cardContent.match(/Icon:\s*(.+)/);

      sections.push(
        <div key={`card-${match.index}`} className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-2 border-purple-500/50 rounded-xl p-6 mb-6 hover:scale-[1.02] transition-transform">
          <div className="flex items-start gap-4">
            <div className="text-5xl">{iconMatch?.[1].trim() || '📘'}</div>
            <div className="flex-1">
              <h4 className="text-2xl font-bold text-white mb-2">{titleMatch?.[1].trim() || 'Key Concept'}</h4>
              <p className="text-slate-200 leading-relaxed">{descMatch?.[1].trim()}</p>
            </div>
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(conceptCardRegex, '');

    // Parse DIAGRAM
    const diagramRegex = /\[DIAGRAM\]([\s\S]*?)\[\/DIAGRAM\]/g;
    while ((match = diagramRegex.exec(content)) !== null) {
      const diagramContent = match[1];
      const typeMatch = diagramContent.match(/Type:\s*(.+)/);
      const descMatch = diagramContent.match(/Description:\s*([\s\S]*?)(?=Steps:|Image:|$)/);
      const stepsMatch = diagramContent.match(/Steps:\s*([\s\S]*?)(?=Image:|$)/);
      const imageMatch = diagramContent.match(/Image:\s*(.+)/);

      const type = typeMatch?.[1].trim() || 'process';
      const description = descMatch?.[1].trim() || '';
      const stepsText = stepsMatch?.[1] || '';
      const imageUrl = imageMatch?.[1].trim();
      const steps = stepsText.split('\n').filter(s => s.trim()).map(s => s.replace(/^\d+\.\s*/, '').trim());

      sections.push(
        <div key={`diagram-${match.index}`} className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-purple-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-6 w-6 text-yellow-400" />
            <h5 className="text-xl font-bold text-white capitalize">⚡ Interactive {type}</h5>
          </div>
          <div className="text-slate-300 mb-6 leading-relaxed prose prose-invert max-w-none">
            {renderInlineWithMath(description)}
          </div>
          {imageUrl && (
            <div className="mb-6 rounded-lg overflow-hidden border border-slate-600">
              <img src={imageUrl} alt={type} className="w-full h-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div className="bg-slate-800/80 px-3 py-2 text-xs text-slate-400">
                Source: <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">{new URL(imageUrl).hostname}</a>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {steps.length > 0 ? steps.map((step, idx) => (
              <div key={idx} className="group relative bg-slate-800/50 border-l-4 border-purple-500 rounded-r-lg p-4 hover:bg-slate-700/50 transition-all duration-300 hover:scale-[1.02] cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600/30 border-2 border-purple-400 flex items-center justify-center font-bold text-purple-300">{idx + 1}</div>
                  <div className="flex-1 text-white prose prose-invert max-w-none">
                    <div className="font-medium group-hover:text-purple-300 transition-colors">
                      {renderInlineWithMath(step)}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {idx < steps.length - 1 && <div className="ml-5 mt-2 h-6 w-0.5 bg-gradient-to-b from-purple-500/50 to-transparent"></div>}
              </div>
            )) : <div className="grid grid-cols-3 gap-4">{['Start', 'Process', 'Result'].map((label, idx) => <div key={idx} className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg p-6 text-center border border-purple-500/30 hover:scale-105 transition-transform cursor-pointer"><div className="text-4xl mb-3">{idx === 0 ? '🎯' : idx === 1 ? '⚡' : '✨'}</div><div className="text-purple-300 font-semibold">{label}</div></div>)}</div>}
          </div>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => {
                setSimulationTopic(selectedTopic?.name || type);
                setInteractiveSimulationActive(true);
              }}
              className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform shadow-lg hover:shadow-purple-500/50"
            >
              <Play className="h-5 w-5 group-hover:animate-pulse" />Launch Interactive Simulation
            </button>
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(diagramRegex, '');

    // Parse EXAMPLE
    const exampleRegex = /\[EXAMPLE\]([\s\S]*?)\[\/EXAMPLE\]/g;
    while ((match = exampleRegex.exec(content)) !== null) {
      const exampleContent = match[1];
      const scenarioMatch = exampleContent.match(/Scenario:\s*([\s\S]*?)(?=Connection:|$)/);
      const connectionMatch = exampleContent.match(/Connection:\s*([\s\S]*?)$/);

      sections.push(
        <div key={`example-${match.index}`} className="bg-green-900/20 border-l-4 border-green-500 rounded-r-lg p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🌍</div>
            <div className="flex-1">
              <h5 className="text-lg font-semibold text-green-300 mb-3">Real-World Example</h5>
              <div className="mb-3">
                <strong className="text-green-200">Scenario:</strong>
                <div className="mt-1 text-white">
                  {renderInlineWithMath(scenarioMatch?.[1].trim() || '')}
                </div>
              </div>
              <div>
                <strong className="text-green-200">Connection:</strong>
                <div className="mt-1 text-slate-300">
                  {renderInlineWithMath(connectionMatch?.[1].trim() || '')}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(exampleRegex, '');

    // Parse INSIGHT
    const insightRegex = /\[INSIGHT\]([\s\S]*?)\[\/INSIGHT\]/g;
    while ((match = insightRegex.exec(content)) !== null) {
      sections.push(
        <div key={`insight-${match.index}`} className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-4 flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-yellow-400 mt-1 flex-shrink-0" />
          <div className="text-yellow-100 flex-1">
            {renderInlineWithMath(match[1].trim())}
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(insightRegex, '');

    // Parse SUMMARY
    const summaryRegex = /\[SUMMARY\]([\s\S]*?)\[\/SUMMARY\]/g;
    while ((match = summaryRegex.exec(content)) !== null) {
      sections.push(
        <div key={`summary-${match.index}`} className="bg-blue-900/20 border-2 border-blue-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4"><CheckCircle className="h-6 w-6 text-blue-400" /><h5 className="text-xl font-bold text-blue-300">Quick Summary</h5></div>
          <div className="prose prose-invert max-w-none text-slate-200">
            {renderInlineWithMath(match[1])}
          </div>
        </div>
      );
    }
    workingContent = workingContent.replace(summaryRegex, '');

    // Render remaining content
    if (workingContent.trim()) {
      // Split content by paragraphs and render each with math support
      const paragraphs = workingContent.split(/\n\n+/);
      sections.push(
        <div key="remaining" className="space-y-4">
          {paragraphs.map((para, idx) => {
            if (para.trim().startsWith('#')) {
              // Heading
              const level = para.match(/^#+/)?.[0].length || 1;
              const text = para.replace(/^#+\s*/, '');
              const headingLevel = Math.min(level, 6);
              const HeadingTag = `h${headingLevel}` as keyof JSX.IntrinsicElements;
              const className = level === 1 ? 'text-3xl font-bold text-white mb-4 mt-6' :
                level === 2 ? 'text-2xl font-bold text-white mb-3 mt-6' :
                  'text-xl font-semibold text-white mb-2 mt-4';
              return React.createElement(
                HeadingTag,
                { key: idx, className },
                renderInlineWithMath(text),
              );
            } else if (para.trim().startsWith('-') || para.trim().startsWith('*')) {
              // List
              const items = para.split('\n').filter(l => l.trim());
              return (
                <ul key={idx} className="list-disc list-inside space-y-2 mb-4 text-slate-200">
                  {items.map((item, i) => (
                    <li key={i} className="ml-4">{renderInlineWithMath(item.replace(/^[-*]\s*/, ''))}</li>
                  ))}
                </ul>
              );
            } else if (para.trim().match(/^\d+\./)) {
              // Numbered list
              const items = para.split('\n').filter(l => l.trim());
              return (
                <ol key={idx} className="list-decimal list-inside space-y-2 mb-4 text-slate-200">
                  {items.map((item, i) => (
                    <li key={i} className="ml-4">{renderInlineWithMath(item.replace(/^\d+\.\s*/, ''))}</li>
                  ))}
                </ol>
              );
            } else if (para.trim().startsWith('>')) {
              // Blockquote
              const text = para.replace(/^>\s*/gm, '');
              return (
                <blockquote key={idx} className="border-l-4 border-purple-500 pl-4 italic text-slate-300 my-4">
                  {renderInlineWithMath(text)}
                </blockquote>
              );
            } else if (para.trim()) {
              // Regular paragraph
              return (
                <p key={idx} className="text-slate-200 mb-4 leading-relaxed">
                  {renderInlineWithMath(para)}
                </p>
              );
            }
            return null;
          })}
        </div>
      );
    }

    return sections;
  };

  // --- Google Site Replication Layout ---

  const [activeTab, setActiveTab] = useState<'source' | 'immersive' | 'slides' | 'audio' | 'mindmap'>('immersive');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Google Fonts & Colors
  const styles = {
    fontFamily: '"Google Sans", "Inter", sans-serif',
    colors: {
      background: '#FFFFFF',
      surface: '#F8F9FA',
      primary: '#1A73E8',
      text: '#202124',
      textSecondary: '#5F6368',
      border: '#DADCE0',
    }
  };

  const SidebarItem = ({ id, label, icon, active }: { id: string, label: string, icon: React.ReactNode, active: boolean }) => (
    <button
      onClick={() => setActiveTab(id as any)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-r-full text-sm font-medium transition-colors ${active
        ? 'bg-[#E8F0FE] text-[#1967D2]'
        : 'text-[#3C4043] hover:bg-[#F1F3F4]'
        }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex text-[var(--mat-app-text-color)] bg-[#F0F4F9] font-sans">
      <style>{`
        :root {
          --mat-app-background-color: #fff;
          --mat-app-text-color: #1f1f1f;
          --mat-sys-primary: #0b57d0;
          --mat-sys-on-primary: #ffffff;
          --mat-sys-surface: #f0f4f9;
          --mat-sys-outline: #747775;
          --mat-sys-surface-container: #f0f4f9;
        }
        .transformation-page-root {
          background: #fff;
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: 100%;
          box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.05);
        }
        .transformation-page-header {
          padding: 20px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #F1F3F4;
        }
        .transformation-page-content {
          padding: 0 32px;
          overflow-y: auto;
          flex: 1;
        }
        /* Custom Scrollbar */
        .transformation-page-content::-webkit-scrollbar {
          width: 8px;
        }
        .transformation-page-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .transformation-page-content::-webkit-scrollbar-thumb {
          background-color: #DADCE0;
          border-radius: 4px;
        }
      `}</style>

      {/* Sidebar (Navigation Drawer) */}
      <div
        className={`flex-shrink-0 bg-[#F0F4F9] flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-[280px]' : 'w-[80px]'
          }`}
      >
        <div className="p-4 flex items-center justify-between mb-2">
          {isSidebarOpen && (
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                <img src="https://www.gstatic.com/images/branding/googlelogo/svg/googlelogo_clr_74x24px.svg" alt="Google" className="h-4" />
              </div>
              <span className="font-medium text-[1.1rem] text-[#444746] tracking-tight">Learn</span>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-[#E1E3E1] rounded-full text-[#444746] transition-colors mx-auto"
          >
            {isSidebarOpen ? <XCircle className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <SidebarItem
            id="source"
            label="Source Material"
            icon={<FileText className="h-5 w-5" />}
            active={activeTab === 'source'}
          />
          <SidebarItem
            id="immersive"
            label="Immersive Text"
            icon={<BookOpen className="h-5 w-5" />}
            active={activeTab === 'immersive'}
          />
          <SidebarItem
            id="slides"
            label="Slides & Narration"
            icon={<MonitorPlay className="h-5 w-5" />}
            active={activeTab === 'slides'}
          />
          <SidebarItem
            id="audio"
            label="Audio Lesson"
            icon={<Volume2 className="h-5 w-5" />}
            active={activeTab === 'audio'}
          />
          <SidebarItem
            id="mindmap"
            label="Mindmap"
            icon={<Activity className="h-5 w-5" />}
            active={activeTab === 'mindmap'}
          />
        </div>

        {isSidebarOpen && (
          <div className="p-4 mt-auto">
            <div className="bg-[#E1E3E1]/50 rounded-xl p-4 mb-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#C2E7FF] flex items-center justify-center text-[#001D35] font-bold text-xs">
                  {Math.round((xpScore / (xpScore + 100)) * 100)}%
                </div>
                <div className="flex-1">
                  <div className="h-1.5 bg-white rounded-full overflow-hidden">
                    <div className="h-full bg-[#0B57D0] rounded-full" style={{ width: `${Math.round((xpScore / (xpScore + 100)) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#444746] font-medium">Daily Goal Progress</p>
            </div>
          </div>
        )}
      </div>


      {/* Main Content Area - The "Card" */}
      <div className="flex-1 flex flex-col min-w-0 p-4 pl-0 h-full overflow-hidden">
        <div className="transformation-page-root shadow-sm border border-[#E1E3E1]">
          {/* Header */}
          <div className="transformation-page-header bg-white">
            <div className="flex items-center gap-4">
              <h1 className="text-[1.375rem] font-normal text-[#1f1f1f]">
                {activeTab === 'immersive' ? 'Immersive Text' :
                  activeTab === 'source' ? 'Source Material' :
                    activeTab === 'slides' ? 'Slides & Narration' :
                      activeTab === 'audio' ? 'Audio Lesson' : 'Mindmap'}
              </h1>
              <span className="px-2 py-0.5 rounded bg-[#E8F0FE] text-[#1967D2] text-xs font-medium border border-[#C2E7FF]">Beta</span>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-[#F1F3F4] rounded-full text-[#444746]" title="Settings">
                <StickyNote className="h-5 w-5" />
              </button>
              <button className="p-2 hover:bg-[#F1F3F4] rounded-full text-[#444746]" title="Share">
                <Copy className="h-5 w-5" />
              </button>
              <div className="h-6 w-[1px] bg-[#DADCE0] mx-2"></div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#FEEFC3] hover:text-[#B06000] rounded-full text-[#444746] transition-colors"
                title="Close Explorer"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="transformation-page-content bg-white">
            <div className="max-w-[900px] mx-auto py-12">

              {/* Loading State */}
              {isProcessing && (
                <div className="flex flex-col items-center justify-center py-32">
                  <div className="relative h-16 w-16 mb-8">
                    <svg className="animate-spin h-full w-full text-[#0B57D0]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <p className="text-xl text-[#1f1f1f] font-normal">{processingMessage || 'Generating your personalized lesson...'}</p>
                  <p className="text-[#444746] mt-3 text-sm">{LOADING_TIPS[loadingTipIndex]}</p>
                </div>
              )}

              {!isProcessing && (
                <>
                  {/* Content based on Active Tab */}
                  {activeTab === 'immersive' && (
                    <div className="prose prose-lg max-w-none prose-headings:font-google-sans prose-headings:font-normal prose-headings:text-[#1f1f1f] prose-p:text-[#1f1f1f] prose-p:font-google-sans-text prose-p:leading-8 prose-li:text-[#1f1f1f] prose-strong:text-[#1f1f1f] prose-strong:font-medium">

                      {/* Breadcrumbs / Meta */}
                      <div className="flex items-center gap-2 text-sm text-[#444746] mb-10 font-medium">
                        <span className="hover:underline cursor-pointer">{documentName || "Document"}</span>
                        <span className="text-[#DADCE0]">/</span>
                        <span className="hover:underline cursor-pointer">{selectedTopic?.name || "Introduction"}</span>
                      </div>

                      {/* Title */}
                      <h1 className="text-[2.5rem] leading-[3.25rem] mb-10 text-[#1f1f1f] tracking-tight">
                        {selectedTopic?.name || "Welcome to Your Learning Journey"}
                      </h1>

                      {/* Main Text Content */}
                      {stage === 'upload' ? (
                        <div className="bg-[#F8F9FA] border border-dashed border-[#DADCE0] rounded-2xl p-16 text-center">
                          <div className="w-20 h-20 bg-[#E8F0FE] text-[#0B57D0] rounded-full flex items-center justify-center mx-auto mb-6">
                            <Upload className="h-10 w-10" />
                          </div>
                          <h3 className="text-2xl font-normal text-[#1f1f1f] mb-3">Upload a Document to Start</h3>
                          <p className="text-[#444746] mb-8 max-w-md mx-auto text-lg">
                            Upload a PDF, text file, or markdown document to generate an immersive learning experience.
                          </p>
                          <label className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-base font-medium rounded-full text-white bg-[#0B57D0] hover:bg-[#0842A0] cursor-pointer transition-all shadow-sm hover:shadow-md">
                            <Upload className="mr-2 h-5 w-5" />
                            Select File
                            <input
                              type="file"
                              className="hidden"
                              accept=".txt,.pdf,.md"
                              onChange={handleFileUpload}
                            />
                          </label>

                          {/* Saved Sessions */}
                          {savedSessions.length > 0 && (
                            <div className="mt-16 text-left max-w-2xl mx-auto">
                              <h4 className="text-sm font-medium text-[#444746] uppercase tracking-wider mb-4 px-2">Recent Journeys</h4>
                              <div className="grid gap-3">
                                {savedSessions.map(session => (
                                  <div key={session.id} className="group flex items-center justify-between p-4 bg-white border border-[#E1E3E1] rounded-xl hover:border-[#0B57D0] hover:shadow-md transition-all cursor-pointer" onClick={() => handleResumeSession(session)}>
                                    <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-full bg-[#E8F0FE] flex items-center justify-center text-[#0B57D0]">
                                        <BookOpen className="h-5 w-5" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-[#1f1f1f] group-hover:text-[#0B57D0] transition-colors">{session.documentName}</p>
                                        <p className="text-sm text-[#444746]">{formatRelativeTime(session.updatedAt)}</p>
                                      </div>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-[#DADCE0] group-hover:text-[#0B57D0] transition-colors" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-10">
                          {/* If we have content, render it */}
                          {learningContent ? (
                            renderInteractiveLearningContent(learningContent)
                          ) : (
                            <div className="text-[#5F6368] italic">
                              Select a topic from the sidebar or upload a document to begin.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'source' && (
                    <div className="bg-[#F8F9FA] rounded-2xl p-10 border border-[#E1E3E1] min-h-[600px]">
                      <h2 className="text-2xl font-normal mb-8 text-[#1f1f1f]">Source Material</h2>
                      <div className="prose max-w-none text-[#3C4043]">
                        <pre className="whitespace-pre-wrap font-mono text-sm bg-white p-6 rounded-xl border border-[#E1E3E1]">{documentContent || "No document loaded."}</pre>
                      </div>
                    </div>
                  )}

                  {/* Placeholders for other tabs */}
                  {(activeTab === 'slides' || activeTab === 'audio' || activeTab === 'mindmap') && (
                    <div className="flex flex-col items-center justify-center py-32 bg-[#F8F9FA] rounded-3xl border border-[#E1E3E1]">
                      <div className="w-24 h-24 bg-[#E8F0FE] text-[#0B57D0] rounded-full flex items-center justify-center mb-8">
                        {activeTab === 'slides' ? <MonitorPlay className="h-12 w-12" /> :
                          activeTab === 'audio' ? <Volume2 className="h-12 w-12" /> :
                            <Activity className="h-12 w-12" />}
                      </div>
                      <h3 className="text-2xl font-normal text-[#1f1f1f] mb-3">
                        {activeTab === 'slides' ? 'Slides & Narration' :
                          activeTab === 'audio' ? 'Audio Lesson' : 'Mindmap'}
                      </h3>
                      <p className="text-[#444746] text-lg">This feature is coming soon to your learning journey.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Assessment & Tools */}
      <div className="w-[360px] bg-[#F0F4F9] border-l border-[#E1E3E1] flex flex-col flex-shrink-0 p-4 pl-0">
        <div className="bg-white rounded-2xl h-full border border-[#E1E3E1] shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-[#F1F3F4] bg-white">
            <h3 className="font-medium text-[#1f1f1f] flex items-center gap-3 text-lg">
              <div className="w-8 h-8 rounded-full bg-[#E6F4EA] flex items-center justify-center text-[#137333]">
                <CheckCircle className="h-5 w-5" />
              </div>
              Check your understanding
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-[#FAFAFA]">
            {/* Quiz / Assessment Content */}
            {stage === 'assessment' || stage === 'learning' ? (
              <div className="space-y-6">
                {/* Progress */}
                {/* Current Question/Module */}
                {currentModule ? (
                  <div className="bg-white rounded-xl border border-[#E1E3E1] shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="p-6 border-b border-[#F1F3F4]">
                      <span className="inline-block px-3 py-1 rounded-full bg-[#E8F0FE] text-[#1967D2] text-xs font-bold uppercase tracking-wide mb-3">
                        {currentModule.module_type.replace('_', ' ')}
                      </span>
                      <p className="font-medium text-[#1f1f1f] text-lg leading-relaxed">
                        {currentModule.module_type === 'mcq_multi' ? (currentModule as MCQMulti).question :
                          currentModule.module_type === 'fill_blanks' ? "Fill in the blanks" :
                            currentModule.module_type === 'match_pairs' ? (currentModule as MatchPairs).prompt :
                              "Review Card"}
                      </p>
                    </div>

                    <div className="p-6 bg-white">
                      {/* MCQ Options */}
                      {currentModule.module_type === 'mcq_multi' && (
                        <div className="space-y-3">
                          {(currentModule as MCQMulti).options.map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => {
                                if (selectedOptions.includes(opt.id)) {
                                  setSelectedOptions(selectedOptions.filter(id => id !== opt.id));
                                } else {
                                  setSelectedOptions([...selectedOptions, opt.id]);
                                }
                              }}
                              className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedOptions.includes(opt.id)
                                ? 'border-[#0B57D0] bg-[#E8F0FE] text-[#0B57D0]'
                                : 'border-transparent bg-[#F8F9FA] hover:bg-[#E1E3E1] text-[#1f1f1f]'
                                }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedOptions.includes(opt.id) ? 'border-[#0B57D0] bg-[#0B57D0]' : 'border-[#747775]'}`}>
                                {selectedOptions.includes(opt.id) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                              </div>
                              {opt.text}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Fill Blanks */}
                      {currentModule.module_type === 'fill_blanks' && (
                        <div className="leading-loose text-[#1f1f1f] text-lg">
                          {(currentModule as FillBlanks).text.split('_____').map((part, i, arr) => (
                            <React.Fragment key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <input
                                  type="text"
                                  className="mx-1 border-b-2 border-[#747775] focus:border-[#0B57D0] outline-none px-2 py-1 w-32 text-center bg-[#F0F4F9] focus:bg-[#E8F0FE] rounded-t-md transition-colors font-medium text-[#0B57D0]"
                                  placeholder="?"
                                  onChange={(e) => {
                                    const newAnswers = [...fillBlanksAnswers];
                                    newAnswers[i] = e.target.value;
                                    setFillBlanksAnswers(newAnswers);
                                  }}
                                />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      {/* Feedback Area */}
                      {showFeedback && (
                        <div className={`mt-6 p-4 rounded-xl text-sm flex items-start gap-3 ${feedbackMessage.includes('correct') || feedbackMessage.includes('✓')
                          ? 'bg-[#E6F4EA] text-[#137333]'
                          : 'bg-[#FEEFC3] text-[#B06000]'
                          }`}>
                          {feedbackMessage.includes('correct') || feedbackMessage.includes('✓') ? <CheckCircle className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                          <span className="font-medium">{feedbackMessage}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-[#F8F9FA] border-t border-[#E1E3E1] flex justify-between items-center">
                      <button
                        onClick={handleSkipQuestion}
                        className="text-[#444746] hover:text-[#1f1f1f] text-sm font-medium px-4 py-2 rounded-full hover:bg-[#E1E3E1] transition-colors"
                      >
                        Skip
                      </button>
                      <button
                        onClick={handleSubmitAnswer}
                        className="bg-[#0B57D0] text-white px-8 py-2.5 rounded-full text-sm font-medium hover:bg-[#0842A0] shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
                      >
                        Check Answer
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-[#444746]">
                    <div className="w-20 h-20 bg-[#F0F4F9] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#E1E3E1]">
                      <Sparkles className="h-8 w-8 text-[#DADCE0]" />
                    </div>
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm mt-1">Continue reading to unlock more questions.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-24 h-24 bg-[#E8F0FE] text-[#0B57D0] rounded-full flex items-center justify-center mx-auto mb-6">
                  <Target className="h-10 w-10" />
                </div>
                <h4 className="text-[#1f1f1f] font-medium mb-3 text-lg">Interactive Assessment</h4>
                <p className="text-[#444746] text-sm leading-relaxed max-w-[200px] mx-auto">
                  As you read, questions will appear here to help you check your understanding.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );

};

export default SubjectExplorer;
