import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Target,
  Route,
  Activity,
  PenLine,
  LifeBuoy,
  Clock,
  Flame,
  Zap,
  Trophy,
  Award,
  Sparkle,
  Wand2,
  Sparkles,
  Loader2,
  FileText,
  Wand
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { AIInteraction, InteractionMode } from '../types';
import { LLMMessage, VerifiedSmilesBlock } from './LLMResponseBlocks';
import AIToolResponseCard from './AIToolResponseCard';
import PriorKnowledgePanel from './PriorKnowledgePanel';
import PlanningMindMap from './PlanningMindMap';
import AdaptivePlan from './AdaptivePlan';
import MonitoringDashboard from './MonitoringDashboard';
import ReflectionTimeline from './ReflectionTimeline';
import HelpHub from './HelpHub';
import ArMoleculePreview from './ArMoleculePreview';
import FlashCardDeck from './FlashCardDeck';
import { db } from '../firebase/config';
import { captureError } from '../utils/errorLogger';
import { generateFlashcardDeck } from '../services/geminiService';
import type { UserProfile } from '../firebase/auth';
import type {
  AssessmentMode,
  CoachLogEntry,
  HelpChannel,
  HelpLevel,
  HelpRequest,
  MonitoringCheckin,
  PlanEdge,
  PlanLevel,
  PlanNode,
  PlanScenario,
  FlashcardItem,
  PriorKnowledgeSnapshot,
  ReflectionEntry,
  SrlPhase,
  PersistedSrlCoachState,
  SrlCoachMetrics
} from '../types/srlCoach';

const SRL_PHASES: Record<
  SrlPhase,
  { label: string; description: string; icon: LucideIcon; accent: string }
> = {
  goal: {
    label: 'Goal-Setting',
    description: 'Turn loose intentions into concrete SMART goals tailored to the current chemistry focus.',
    icon: Target,
    accent: 'text-amber-300'
  },
  plan: {
    label: 'Planning',
    description: 'Break goals into adaptive pathways that weave in MolView, NMR viewer, and practice loops.',
    icon: Route,
    accent: 'text-emerald-300'
  },
  monitor: {
    label: 'Self-Monitoring',
    description: 'Check in on confidence and progress with quick ratings and AI nudges that track growth.',
    icon: Activity,
    accent: 'text-sky-300'
  },
  reflect: {
    label: 'Reflection',
    description: 'Capture takeaways and translate insights into the next chemistry sprint.',
    icon: PenLine,
    accent: 'text-purple-300'
  },
  help: {
    label: 'Help-Seeking',
    description: 'Request scaffolds or hints at the right level so autonomy stays intact.',
    icon: LifeBuoy,
    accent: 'text-rose-300'
  }
};

const SRL_TOOL_OPTIONS = [
  { id: 'molview', label: 'MolView visualizations' },
  { id: 'nmrium', label: 'NMR viewer practice' },
  { id: 'quiz', label: 'Adaptive AI quizzes' },
  { id: 'lab', label: 'Virtual lab simulations' }
];

const SRL_PLAN_PREFERENCES = [
  { id: 'visual', label: 'Visual-first', description: 'Prioritize molecule renderings, orbitals, and reaction schematics.' },
  { id: 'practice', label: 'Problem-first', description: 'Lead with quizzes, worked examples, and NMR peak checks.' },
  { id: 'simulation', label: 'Simulation', description: 'Use virtual labs or quantum chemistry previews to probe mechanisms.' }
];

const SRL_REFLECTION_EMOTIONS = ['Curious', 'Confident', 'Unsure', 'Stretched', 'Motivated'];

const COACH_LOG_LIMIT = 8;
const COACH_STATE_STORAGE_KEY = 'chemcanvas-srl-state-v1';
const COACH_METRICS_STORAGE_KEY = 'chemcanvas-srl-metrics-v1';
const COACH_PRIVACY_STORAGE_KEY = 'chemcanvas-srl-privacy-opt';

const getCoachDataDocRef = (userId: string) => doc(db, 'users', userId, 'srlCoachData', 'current');

const HELP_CHANNEL_LABEL: Record<HelpChannel, string> = {
  ai: 'AI hint',
  community: 'Community forum',
  tutor: 'Tutor session'
};

const HELP_FORECAST_COPY: Record<HelpChannel, string> = {
  ai: 'Expect a scaffolded hint within minutes. Reattempt once before escalating further.',
  community: 'Peers usually respond within a study day. Share a screenshot or molecule ID to accelerate help.',
  tutor: 'Book a 20-minute slot and bring one concrete question plus your attempted solution.'
};

const ASSESSMENT_MODE_LABEL: Record<AssessmentMode, string> = {
  quiz: 'Adaptive quiz',
  flashcards: 'Flash card sprint',
  sketch: 'Interactive sketch'
};

const ASSESSMENT_HIGHLIGHTS: Record<AssessmentMode, { strengths: string[]; improvements: string[] }> = {
  quiz: {
    strengths: ['Quick recall on foundational reactions', 'Agile pattern spotting under timed pressure'],
    improvements: ['Slow down on multi-step mechanisms', 'Revisit confuser questions with worked solutions']
  },
  flashcards: {
    strengths: ['Strong concept tagging across topics', 'Consistent spaced repetition rhythm'],
    improvements: ['Add more applied problem prompts', 'Mix in mechanism-oriented cards for balance']
  },
  sketch: {
    strengths: ['Creative molecule representations', 'Clear sequencing of key reaction moves'],
    improvements: ['Label intermediate states more clearly', 'Align sketches with reagent intent and outcomes']
  }
};

interface AssessmentQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
}

interface AssessmentReviewItem {
  id: string;
  prompt: string;
  chosenOption: string;
  correctOption: string;
  isCorrect: boolean;
  explanation?: string;
}

interface AssessmentState {
  mode: AssessmentMode;
  questionIndex: number;
  answers: number[];
  startedAt: string;
  completed: boolean;
  score: number | null;
}

const ASSESSMENT_QUESTIONS: Record<AssessmentMode, AssessmentQuestion[]> = {
  quiz: [
    {
      id: 'quiz-1',
      prompt: 'Which reagent set converts an alkene into a vicinal diol via syn addition?',
      options: [
        'Cold KMnO4 followed by OH- (aq)',
        'HBr with peroxide',
        'O3 followed by Zn/H2O',
        'BH3-THF followed by H2O2, OH-'
      ],
      correctOptionIndex: 0,
      explanation: 'Cold, dilute KMnO4 produces a syn dihydroxylation giving a vicinal diol.'
    },
    {
      id: 'quiz-2',
      prompt: 'What does the integration of an NMR peak directly tell you?',
      options: [
        'Number of neighboring protons',
        'Relative number of protons represented by the peak',
        'Chemical environment of the protons',
        'Shielding effect from electronegative atoms'
      ],
      correctOptionIndex: 1,
      explanation: 'Integration reflects how many equivalent protons contribute to that signal.'
    },
    {
      id: 'quiz-3',
      prompt: 'During an SN1 reaction, which step determines the rate?',
      options: [
        'Nucleophilic attack',
        'Leaving group departure forming a carbocation',
        'Solvent rearrangement',
        'Proton transfer to form the final product'
      ],
      correctOptionIndex: 1,
      explanation: 'SN1 reactions are rate-limited by the formation of the carbocation intermediate.'
    }
  ],
  flashcards: [
    {
      id: 'flash-1',
      prompt: 'State Le Chatelier\'s principle in one sentence.',
      options: [
        'Equilibrium favors products when temperature decreases',
        'A system at equilibrium shifts to counteract any imposed change',
        'Reaction rates equal forward and reverse pathways',
        'Catalysts change equilibrium positions'
      ],
      correctOptionIndex: 1,
      explanation: 'Le Chatelier\'s principle states that a disturbed equilibrium shifts to oppose the disturbance.'
    },
    {
      id: 'flash-2',
      prompt: 'Which orbital interaction drives conjugation in a diene system?',
      options: [
        'Overlap of sp3 orbitals',
        'Overlap of p orbitals creating a delocalised pi system',
        'Overlap of sigma orbitals forming new sigma bonds',
        'Interaction of s orbitals forming hydrogen bonds'
      ],
      correctOptionIndex: 1,
      explanation: 'Conjugation arises from adjacent p orbital overlap creating delocalised pi bonding.'
    },
    {
      id: 'flash-3',
      prompt: 'What is the key feature of a buffer solution?',
      options: [
        'It contains a strong acid and strong base in equal amounts',
        'It resists pH change when small amounts of acid or base are added',
        'It completely neutralises any acid',
        'It must be highly dilute to function'
      ],
      correctOptionIndex: 1,
      explanation: 'Buffers resist pH change through a conjugate acid-base pair that neutralises additions.'
    }
  ],
  sketch: [
    {
      id: 'sketch-1',
      prompt: 'When sketching the chair conformations of cyclohexane, which positions alternate up/down around the ring?',
      options: ['Axial positions', 'Equatorial positions', 'Both axial and equatorial', 'Neither - all are planar'],
      correctOptionIndex: 0,
      explanation: 'Axial positions alternate up and down, while equatorial positions lie roughly in the plane.'
    },
    {
      id: 'sketch-2',
      prompt: 'What must be conserved when sketching resonance structures?',
      options: [
        'Number of sigma bonds',
        'Positions of all atoms',
        'Formal charges on each atom',
        'Total number of electrons and atom connectivity'
      ],
      correctOptionIndex: 3,
      explanation: 'Resonance structures preserve atom connectivity and total electron count.'
    },
    {
      id: 'sketch-3',
      prompt: 'Which arrow describes electron flow in a curved-arrow mechanism?',
      options: [
        'From a positive centre toward electrons',
        'From electron density (lone pair or bond) toward an electron-poor centre',
        'From nucleus to nucleus',
        'From empty orbitals to filled ones'
      ],
      correctOptionIndex: 1,
      explanation: 'Curved arrows always start at electron density and point toward where electrons move.'
    }
  ]
};

interface SrlMomentumLevel {
  min: number;
  label: string;
  vibe: string;
  gradient: string;
  icon: LucideIcon;
}

const SRL_MOMENTUM_LEVELS: SrlMomentumLevel[] = [
  {
    min: 0,
    label: 'Spark',
    vibe: 'You are just starting to warm up. Pick a quick win to ignite momentum!',
    gradient: 'from-slate-800 via-slate-900 to-slate-950',
    icon: Sparkle
  },
  {
    min: 30,
    label: 'Glow',
    vibe: 'Steady progress detected! Keep stacking mini victories.',
    gradient: 'from-blue-800 via-indigo-900 to-slate-950',
    icon: Wand2
  },
  {
    min: 55,
    label: 'Blaze',
    vibe: 'You are in flow - tough problems are fair game right now.',
    gradient: 'from-purple-800 via-fuchsia-700 to-slate-950',
    icon: Flame
  },
  {
    min: 80,
    label: 'Nova',
    vibe: 'Elite focus unlocked! Channel the energy into a stretch challenge.',
    gradient: 'from-amber-600 via-orange-600 to-rose-700',
    icon: Zap
  }
];

interface SrlChallenge {
  id: string;
  title: string;
  description: string;
  phase: SrlPhase | 'wildcard';
}

const SRL_CHALLENGE_DECK: SrlChallenge[] = [
  {
    id: 'goal-hype',
    title: 'SMART Remix',
    description: 'Rewrite your current goal with a bold metric (time, score, or research milestone).',
    phase: 'goal'
  },
  {
    id: 'plan-lab',
    title: 'Virtual Lab Sprint',
    description: 'Schedule one simulation block and note the exact data you want to collect.',
    phase: 'plan'
  },
  {
    id: 'monitor-vibes',
    title: 'Confidence Pulse',
    description: 'Rate your confidence before and after a problem set and spot the biggest delta.',
    phase: 'monitor'
  },
  {
    id: 'reflect-story',
    title: 'Story Mode Reflection',
    description: "Write a 3-sentence comic strip of today's study arc (setup, conflict, win).",
    phase: 'reflect'
  },
  {
    id: 'help-swap',
    title: 'Swap-a-Hint',
    description: "Draft a hint you'd give a peer on the same problem, then request one back from the AI.",
    phase: 'help'
  },
  {
    id: 'wild-streak',
    title: 'Wildcard Momentum',
    description: 'Pick any phase you skipped this week and complete it in the next 10 minutes.',
    phase: 'wildcard'
  }
];

interface SrlBadge {
  id: string;
  label: string;
  description: string;
  threshold: number;
}

const SRL_BADGES: SrlBadge[] = [
  {
    id: 'starter-pack',
    label: 'Starter Spark',
    description: 'Log 3 coach actions in a single session.',
    threshold: 3
  },
  {
    id: 'balanced-brain',
    label: 'Balanced Brain',
    description: 'Complete at least one action in three different phases.',
    threshold: 3
  },
  {
    id: 'momentum-maker',
    label: 'Momentum Maker',
    description: 'Reach a momentum score of 60+.',
    threshold: 60
  },
  {
    id: 'streak-legend',
    label: 'Streak Legend',
    description: 'Hit a streak of 4 consecutive phases without repeats.',
    threshold: 4
  }
];

const SRL_HYPE_TIPS: Record<SrlPhase | 'wildcard', string[]> = {
  goal: [
    'Aim high: frame your goal as a mission briefing with one must-win objective.',
    'Add a reward: what will you do once the goal is done? Treat yourself!'
  ],
  plan: [
    'Map a momentum ladder: easy task -> chewy task -> boss fight.',
    'Swap mediums: mix diagrams, videos, and your own sketches to keep the plan fresh.'
  ],
  monitor: [
    'Overlay your feelings: rate confidence AND hype to see interesting mismatches.',
    "Snapshot a mistake: jot one misstep and how you'll trap it next time."
  ],
  reflect: [
    'Give future-you a breadcrumb - leave one thing you want to remember next time.',
    'Claim the win: name what skill level-up happened today.'
  ],
  help: [
    'State the block clearly: "I get stuck when..." so the AI can laser-focus help.',
    'Try a tiered escalation: self-remedy -> AI hint -> peer check -> instructor ping.'
  ],
  wildcard: [
    'Mix it up: try a mini whiteboard sprint or record a 2-minute audio recap.',
    'Gamify the next 10 minutes - treat it like a timed escape room puzzle.'
  ]
};

const pickRandom = <T,>(items: T[]): T | null => {
  if (!items.length) {
    return null;
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
};

const pickRandomSubset = <T,>(items: T[], count: number): T[] => {
  if (count <= 0) {
    return [];
  }
  const pool = [...items];
  const selection: T[] = [];
  while (pool.length && selection.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    const [item] = pool.splice(index, 1);
    if (item !== undefined) {
      selection.push(item);
    }
  }
  return selection;
};

const calculateMomentumStats = (log: CoachLogEntry[]) => {
  if (!log.length) {
    return {
      momentum: 0,
      longestStreak: 0,
      energy: 55,
      uniquePhases: new Set<SrlPhase>(),
      totalActions: 0
    };
  }

  let currentStreak = 1;
  let longestStreak = 1;
  let momentum = 35;
  let energy = 60;
  const uniquePhases = new Set<SrlPhase>();

  log.forEach((entry, index) => {
    uniquePhases.add(entry.phase);
    momentum += 10;
    energy += 4;

    const previous = log[index - 1];
    if (previous && previous.phase !== entry.phase) {
      currentStreak += 1;
      momentum += 4;
      energy += 2;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (index > 0) {
      currentStreak = 1;
    }
  });

  momentum = Math.min(momentum, 100);
  energy = Math.min(95, energy + uniquePhases.size * 2);

  return {
    momentum,
    longestStreak,
    energy,
    uniquePhases,
    totalActions: log.length
  };
};

const deriveBadges = (stats: ReturnType<typeof calculateMomentumStats>) => {
  const earned: string[] = [];

  if (stats.totalActions >= SRL_BADGES[0]?.threshold) {
    earned.push('starter-pack');
  }
  if (stats.uniquePhases.size >= SRL_BADGES[1]?.threshold) {
    earned.push('balanced-brain');
  }
  if (stats.momentum >= SRL_BADGES[2]?.threshold) {
    earned.push('momentum-maker');
  }
  if (stats.longestStreak >= SRL_BADGES[3]?.threshold) {
    earned.push('streak-legend');
  }

  return earned;
};

const formatCoachTimestamp = (timestamp: string) => {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error('Failed to format timestamp', error);
    return '';
  }
};
interface SrlCoachProps {
  onSendMessage: (message: string, options?: { mode?: InteractionMode }) => Promise<void>;
  interactions: AIInteraction[];
  isLoading: boolean;
  documentName?: string;
  onOpenDocument?: () => void;
  user?: UserProfile | null;
}

const SrlCoach: React.FC<SrlCoachProps> = ({
  onSendMessage,
  interactions,
  isLoading,
  documentName,
  onOpenDocument,
  user
}) => {
  const [activePhase, setActivePhase] = useState<SrlPhase>('goal');
  const [goalTopic, setGoalTopic] = useState('');
  const [goalTimeframe, setGoalTimeframe] = useState('this week');
  const [preferredTools, setPreferredTools] = useState<string[]>(['molview', 'nmrium']);
  const [planFocus, setPlanFocus] = useState('');
  const [planLevel, setPlanLevel] = useState<PlanLevel>('beginner');
  const [planPreference, setPlanPreference] = useState<string>('visual');
  const [monitorFocus, setMonitorFocus] = useState('');
  const [monitorRating, setMonitorRating] = useState<number | null>(null);
  const [monitorNotes, setMonitorNotes] = useState('');
  const [reflectionNotes, setReflectionNotes] = useState('');
  const [reflectionEmotion, setReflectionEmotion] = useState<string>(SRL_REFLECTION_EMOTIONS[0]);
  const [helpTopic, setHelpTopic] = useState('');
  const [helpAttempts, setHelpAttempts] = useState(1);
  const [helpLevel, setHelpLevel] = useState<HelpLevel>('hint');
  const [coachLog, setCoachLog] = useState<CoachLogEntry[]>([]);
  const [momentumScore, setMomentumScore] = useState(0);
  const [phaseStreak, setPhaseStreak] = useState(0);
  const [coachEnergy, setCoachEnergy] = useState(55);
  const [activeChallenge, setActiveChallenge] = useState<SrlChallenge | null>(() => pickRandom(SRL_CHALLENGE_DECK));
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<string[]>([]);
  const [hypeTip, setHypeTip] = useState<string>(() => {
    const initialTip = pickRandom(SRL_HYPE_TIPS.goal);
    return initialTip ?? 'Ready to chart your next chemistry quest?';
  });
  const [selectedAssessmentMode, setSelectedAssessmentMode] = useState<AssessmentMode | null>(null);
  const [isAssessmentRunning, setIsAssessmentRunning] = useState(false);
  const [priorKnowledgeSnapshots, setPriorKnowledgeSnapshots] = useState<PriorKnowledgeSnapshot[]>([]);
  const [goalBuddySummary, setGoalBuddySummary] = useState('');
  const [assessmentGoalHint, setAssessmentGoalHint] = useState('');
  const [assessmentState, setAssessmentState] = useState<AssessmentState | null>(null);
  const [assessmentFeedback, setAssessmentFeedback] = useState<{ score: number; correct: number; total: number } | null>(null);
  const [assessmentReview, setAssessmentReview] = useState<AssessmentReviewItem[] | null>(null);
  const [currentAssessmentChoice, setCurrentAssessmentChoice] = useState<number | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [assessmentQuestions] = useState<Record<AssessmentMode, AssessmentQuestion[]>>(ASSESSMENT_QUESTIONS);
  const [flashcardDeck, setFlashcardDeck] = useState<FlashcardItem[]>([]);
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcardError, setFlashcardError] = useState<string | null>(null);
  const [planNodesState, setPlanNodesState] = useState<PlanNode[]>([]);
  const [planEdgesState, setPlanEdgesState] = useState<PlanEdge[]>([]);
  const [planScenariosState, setPlanScenariosState] = useState<PlanScenario[]>([]);
  const [monitoringCheckins, setMonitoringCheckins] = useState<MonitoringCheckin[]>([]);
  const [experiencePoints, setExperiencePoints] = useState(0);
  const [streakBonus, setStreakBonus] = useState(0);
  const [reflectionEntries, setReflectionEntries] = useState<ReflectionEntry[]>([]);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [shareCoachData, setShareCoachData] = useState(true);
  const [insightBulletin, setInsightBulletin] = useState<string | null>(null);
  const [isArPreviewActive, setIsArPreviewActive] = useState(false);

  const coachInteractions = useMemo(
    () => interactions.filter((interaction) => interaction.mode === 'coach'),
    [interactions]
  );

  const userId = user?.uid ?? null;
  const stateStorageKey = useMemo(
    () => (userId ? `${COACH_STATE_STORAGE_KEY}::${userId}` : COACH_STATE_STORAGE_KEY),
    [userId]
  );
  const metricsStorageKey = useMemo(
    () => (userId ? `${COACH_METRICS_STORAGE_KEY}::${userId}` : COACH_METRICS_STORAGE_KEY),
    [userId]
  );

  const outputEndRef = useRef<HTMLDivElement>(null);
  const remoteSaveTimeoutRef = useRef<number | null>(null);

  const resetCoachState = useCallback(() => {
    setActivePhase('goal');
    setGoalTopic('');
    setGoalTimeframe('this week');
    setPreferredTools(['molview', 'nmrium']);
    setPlanFocus('');
    setPlanLevel('beginner');
    setPlanPreference('visual');
    setMonitorFocus('');
    setMonitorRating(null);
    setMonitorNotes('');
    setReflectionNotes('');
    setReflectionEmotion(SRL_REFLECTION_EMOTIONS[0]);
    setHelpTopic('');
    setHelpAttempts(1);
    setHelpLevel('hint');
    setCoachLog([]);
    setMomentumScore(0);
    setPhaseStreak(0);
    setCoachEnergy(55);
    setUnlockedBadgeIds([]);
    setExperiencePoints(0);
    setStreakBonus(0);
    setPriorKnowledgeSnapshots([]);
    setGoalBuddySummary('');
    setSelectedAssessmentMode(null);
    setIsAssessmentRunning(false);
    setAssessmentGoalHint('');
    setAssessmentState(null);
    setAssessmentFeedback(null);
    setAssessmentReview(null);
    setCurrentAssessmentChoice(null);
    setAssessmentError(null);
    setPlanNodesState([]);
    setPlanEdgesState([]);
    setPlanScenariosState([]);
    setMonitoringCheckins([]);
    setReflectionEntries([]);
    setHelpRequests([]);
    setInsightBulletin(null);
    setIsArPreviewActive(false);
    setActiveChallenge(() => pickRandom(SRL_CHALLENGE_DECK));
    setHypeTip(() => {
      const nextTip = pickRandom(SRL_HYPE_TIPS.goal);
      return nextTip ?? 'Ready to chart your next chemistry quest?';
    });
    setFlashcardDeck([]);
    setActiveFlashcardIndex(0);
    setIsFlashcardFlipped(false);
    setIsGeneratingFlashcards(false);
    setFlashcardError(null);
  }, []);

  const applyPersistedState = useCallback((persisted?: Partial<PersistedSrlCoachState>) => {
    if (!persisted) {
      return;
    }

    if (persisted.activePhase) {
      setActivePhase(persisted.activePhase);
    }
    setGoalTopic(persisted.goalTopic ?? '');
    setGoalTimeframe(persisted.goalTimeframe ?? 'this week');
    setPreferredTools(Array.isArray(persisted.preferredTools) ? persisted.preferredTools : ['molview', 'nmrium']);
    if (Array.isArray(persisted.priorKnowledge)) {
      setPriorKnowledgeSnapshots(persisted.priorKnowledge);
    }
    setGoalBuddySummary(persisted.goalBuddySummary ?? '');
    setPlanFocus(persisted.planFocus ?? '');
    if (persisted.planLevel === 'beginner' || persisted.planLevel === 'intermediate' || persisted.planLevel === 'advanced') {
      setPlanLevel(persisted.planLevel);
    } else {
      setPlanLevel('beginner');
    }
    setPlanPreference(persisted.planPreference ?? 'visual');
    if (Array.isArray(persisted.planNodes)) {
      setPlanNodesState(persisted.planNodes);
    }
    if (Array.isArray(persisted.planEdges)) {
      setPlanEdgesState(persisted.planEdges);
    }
    if (Array.isArray(persisted.planScenarios)) {
      setPlanScenariosState(persisted.planScenarios);
    }
    setMonitorFocus(persisted.monitorFocus ?? '');
    setMonitorRating(typeof persisted.monitorRating === 'number' ? persisted.monitorRating : null);
    setMonitorNotes(persisted.monitorNotes ?? '');
    if (Array.isArray(persisted.monitoringCheckins)) {
      setMonitoringCheckins(persisted.monitoringCheckins);
    }
    setReflectionNotes(persisted.reflectionNotes ?? '');
    setReflectionEmotion(
      persisted.reflectionEmotion && SRL_REFLECTION_EMOTIONS.includes(persisted.reflectionEmotion)
        ? persisted.reflectionEmotion
        : SRL_REFLECTION_EMOTIONS[0]
    );
    if (Array.isArray(persisted.reflectionEntries)) {
      setReflectionEntries(persisted.reflectionEntries);
    }
    setHelpTopic(persisted.helpTopic ?? '');
    setHelpAttempts(persisted.helpAttempts ?? 1);
    if (persisted.helpLevel === 'hint' || persisted.helpLevel === 'guided' || persisted.helpLevel === 'explanation') {
      setHelpLevel(persisted.helpLevel);
    } else {
      setHelpLevel('hint');
    }
    if (Array.isArray(persisted.helpRequests)) {
      setHelpRequests(persisted.helpRequests);
    }
    if (Array.isArray(persisted.coachLog)) {
      setCoachLog(persisted.coachLog);
    }
  }, []);

  const applyPersistedMetrics = useCallback((metrics?: Partial<SrlCoachMetrics>) => {
    if (!metrics) {
      return;
    }

    if (typeof metrics.momentumScore === 'number') {
      setMomentumScore(metrics.momentumScore);
    }
    if (typeof metrics.phaseStreak === 'number') {
      setPhaseStreak(metrics.phaseStreak);
    }
    if (typeof metrics.coachEnergy === 'number') {
      setCoachEnergy(metrics.coachEnergy);
    }
    if (Array.isArray(metrics.unlockedBadgeIds)) {
      setUnlockedBadgeIds(metrics.unlockedBadgeIds);
    }
    if (typeof metrics.experiencePoints === 'number') {
      setExperiencePoints(metrics.experiencePoints);
    }
    if (typeof metrics.streakBonus === 'number') {
      setStreakBonus(metrics.streakBonus);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedPreference = window.localStorage.getItem(COACH_PRIVACY_STORAGE_KEY);
    if (storedPreference === 'false') {
      setShareCoachData(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let hydratedState = false;
    let hydratedMetrics = false;

    try {
      const storedState = window.localStorage.getItem(stateStorageKey);
      if (storedState) {
        const parsedState = JSON.parse(storedState) as Partial<PersistedSrlCoachState>;
        applyPersistedState(parsedState);
        hydratedState = true;
      } else if (stateStorageKey !== COACH_STATE_STORAGE_KEY) {
        const legacyState = window.localStorage.getItem(COACH_STATE_STORAGE_KEY);
        if (legacyState) {
          const parsedLegacyState = JSON.parse(legacyState) as Partial<PersistedSrlCoachState>;
          applyPersistedState(parsedLegacyState);
          hydratedState = true;
        }
      }

      const storedMetrics = window.localStorage.getItem(metricsStorageKey);
      if (storedMetrics) {
        const parsedMetrics = JSON.parse(storedMetrics) as Partial<SrlCoachMetrics>;
        applyPersistedMetrics(parsedMetrics);
        hydratedMetrics = true;
      } else if (metricsStorageKey !== COACH_METRICS_STORAGE_KEY) {
        const legacyMetrics = window.localStorage.getItem(COACH_METRICS_STORAGE_KEY);
        if (legacyMetrics) {
          const parsedLegacyMetrics = JSON.parse(legacyMetrics) as Partial<SrlCoachMetrics>;
          applyPersistedMetrics(parsedLegacyMetrics);
          hydratedMetrics = true;
        }
      }
    } catch (error) {
      console.error('Failed to hydrate SRL coach state', error);
    } finally {
      if (!hydratedState) {
        resetCoachState();
      } else if (!hydratedMetrics) {
        setMomentumScore(0);
        setPhaseStreak(0);
        setCoachEnergy(55);
        setUnlockedBadgeIds([]);
        setExperiencePoints(0);
        setStreakBonus(0);
      }
    }
  }, [applyPersistedMetrics, applyPersistedState, metricsStorageKey, resetCoachState, stateStorageKey]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let isMounted = true;

    const fetchRemoteCoachData = async () => {
      try {
        const coachDocRef = getCoachDataDocRef(userId);
        const snapshot = await getDoc(coachDocRef);
        if (snapshot.exists() && isMounted) {
          const data = snapshot.data() as {
            state?: PersistedSrlCoachState;
            metrics?: SrlCoachMetrics;
          };
          if (data.state) {
            applyPersistedState(data.state);
          }
          if (data.metrics) {
            applyPersistedMetrics(data.metrics);
          }
        }
      } catch (error) {
        console.error('Failed to load SRL coach data from Firestore', error);
        void captureError(error, 'srlCoach:load');
      }
    };

    fetchRemoteCoachData();

    return () => {
      isMounted = false;
    };
  }, [applyPersistedMetrics, applyPersistedState, userId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(COACH_PRIVACY_STORAGE_KEY, shareCoachData ? 'true' : 'false');

    const statePayload: PersistedSrlCoachState = {
      activePhase,
      goalTopic,
      goalTimeframe,
      preferredTools,
      priorKnowledge: priorKnowledgeSnapshots,
      goalBuddySummary,
      planFocus,
      planLevel,
      planPreference,
      planNodes: planNodesState,
      planEdges: planEdgesState,
      planScenarios: planScenariosState,
      monitorFocus,
      monitorRating,
      monitorNotes,
      monitoringCheckins,
      reflectionNotes,
      reflectionEmotion,
      reflectionEntries,
      helpTopic,
      helpAttempts,
      helpLevel,
      helpRequests,
      coachLog,
      updatedAt: new Date().toISOString()
    };

    const metricsPayload: SrlCoachMetrics = {
      momentumScore,
      phaseStreak,
      coachEnergy,
      unlockedBadgeIds,
      experiencePoints,
      streakBonus,
      updatedAt: new Date().toISOString()
    };

    if (!shareCoachData) {
      window.localStorage.removeItem(stateStorageKey);
      if (stateStorageKey !== COACH_STATE_STORAGE_KEY) {
        window.localStorage.removeItem(COACH_STATE_STORAGE_KEY);
      }
      window.localStorage.removeItem(metricsStorageKey);
      if (metricsStorageKey !== COACH_METRICS_STORAGE_KEY) {
        window.localStorage.removeItem(COACH_METRICS_STORAGE_KEY);
      }
      if (remoteSaveTimeoutRef.current !== null) {
        window.clearTimeout(remoteSaveTimeoutRef.current);
        remoteSaveTimeoutRef.current = null;
      }
    } else {
      try {
        window.localStorage.setItem(stateStorageKey, JSON.stringify(statePayload));
        if (stateStorageKey !== COACH_STATE_STORAGE_KEY) {
          window.localStorage.removeItem(COACH_STATE_STORAGE_KEY);
        }
        window.localStorage.setItem(metricsStorageKey, JSON.stringify(metricsPayload));
        if (metricsStorageKey !== COACH_METRICS_STORAGE_KEY) {
          window.localStorage.removeItem(COACH_METRICS_STORAGE_KEY);
        }
      } catch (error) {
        console.error('Failed to persist SRL coach state', error);
      }

      if (userId) {
        if (remoteSaveTimeoutRef.current !== null) {
          window.clearTimeout(remoteSaveTimeoutRef.current);
        }

        remoteSaveTimeoutRef.current = window.setTimeout(() => {
          const coachDocRef = getCoachDataDocRef(userId);
          setDoc(
            coachDocRef,
            {
              state: statePayload,
              metrics: metricsPayload,
              updatedAt: new Date().toISOString()
            },
            { merge: true }
          ).catch((error) => {
            console.error('Failed to persist SRL coach state to Firestore', error);
            void captureError(error, 'srlCoach:save');
          });
        }, 800);
      }
    }

    return () => {
      if (remoteSaveTimeoutRef.current !== null) {
        window.clearTimeout(remoteSaveTimeoutRef.current);
        remoteSaveTimeoutRef.current = null;
      }
    };
  }, [
    shareCoachData,
    stateStorageKey,
    metricsStorageKey,
    userId,
    activePhase,
    goalTopic,
    goalTimeframe,
    preferredTools,
    priorKnowledgeSnapshots,
    goalBuddySummary,
    planFocus,
    planLevel,
    planPreference,
    planNodesState,
    planEdgesState,
    planScenariosState,
    monitorFocus,
    monitorRating,
    monitorNotes,
    monitoringCheckins,
    reflectionNotes,
    reflectionEmotion,
    reflectionEntries,
    helpTopic,
    helpAttempts,
    helpLevel,
    helpRequests,
    coachLog,
    momentumScore,
    phaseStreak,
    coachEnergy,
    unlockedBadgeIds,
    experiencePoints,
    streakBonus
  ]);

  useEffect(() => {
    const stats = calculateMomentumStats(coachLog);
    setMomentumScore(stats.momentum);
    setPhaseStreak(stats.longestStreak);
    setCoachEnergy(stats.energy);
    setUnlockedBadgeIds(deriveBadges(stats));
    setStreakBonus(Math.min(40, stats.longestStreak * 6 + stats.uniquePhases.size * 4));
  }, [coachLog]);

  useEffect(() => {
    setAssessmentGoalHint('');
  }, [goalTopic]);

  const learningJourney = useMemo(() => {
    if (!coachLog.length) {
      return (Object.keys(SRL_PHASES) as SrlPhase[]).map((phase) => ({ phase, count: 0 }));
    }
    const tally = new Map<SrlPhase, number>();
    coachLog.forEach((entry) => {
      tally.set(entry.phase, (tally.get(entry.phase) ?? 0) + 1);
    });
    return (Object.keys(SRL_PHASES) as SrlPhase[]).map((phase) => ({
      phase,
      count: tally.get(phase) ?? 0
    }));
  }, [coachLog]);

  const currentAssessmentQuestions = useMemo(() => {
    if (!assessmentState) {
      return null;
    }
    return assessmentQuestions[assessmentState.mode] ?? null;
  }, [assessmentState, assessmentQuestions]);

  const currentAssessmentQuestion = useMemo(() => {
    if (!assessmentState || assessmentState.completed) {
      return null;
    }
    const questions = assessmentQuestions[assessmentState.mode];
    if (!questions || questions.length === 0) {
      return null;
    }
    return questions[assessmentState.questionIndex] ?? null;
  }, [assessmentState, assessmentQuestions]);

  useEffect(() => {
    const pool = [
      ...SRL_HYPE_TIPS[activePhase],
      ...SRL_HYPE_TIPS.wildcard
    ];
    const nextTip = pickRandom(pool);
    if (nextTip) {
      setHypeTip(nextTip);
    }

    const challengePool = SRL_CHALLENGE_DECK.filter(
      (challenge) => challenge.phase === activePhase || challenge.phase === 'wildcard'
    );
    const nextChallenge = pickRandom(challengePool);
    if (nextChallenge) {
      setActiveChallenge(nextChallenge);
    }
  }, [activePhase]);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [coachInteractions, isLoading]);

  const monitoringAnalytics = useMemo(() => {
    const completedNodes = planNodesState.filter((node) => node.status === 'completed').length;
    const completionRate = planNodesState.length
      ? Math.round((completedNodes / planNodesState.length) * 100)
      : 0;

    let totalMinutes = 0;
    let averageRating = 0;
    let averageEngagement = Math.round(coachEnergy);
    let tasksTotal = 0;
    let avgMinutes = 0;
    let lastMinutes = 0;
    let avgTasks = 0;
    let lastTasks = 0;
    let avgTools = 0;
    let lastToolCount = 0;
    let lastGoalAlignment = completionRate;
    const toolSet = new Set<string>();

    if (monitoringCheckins.length) {
      totalMinutes = monitoringCheckins.reduce(
        (sum, entry) => sum + (entry.durationMinutes ?? 0),
        0
      );
      averageRating =
        Math.round(
          (monitoringCheckins.reduce((sum, entry) => sum + entry.rating, 0) /
            monitoringCheckins.length) *
            10
        ) / 10;
      averageEngagement = Math.round(
        monitoringCheckins.reduce((sum, entry) => sum + (entry.engagementScore ?? coachEnergy), 0) /
          monitoringCheckins.length
      );
      tasksTotal = monitoringCheckins.reduce(
        (sum, entry) => sum + (entry.tasksCompleted ?? 0),
        0
      );
      monitoringCheckins.forEach((entry) => entry.toolsUsed?.forEach((tool) => toolSet.add(tool)));

      avgMinutes = totalMinutes / monitoringCheckins.length;
      avgTasks = tasksTotal / monitoringCheckins.length;
      avgTools = toolSet.size / monitoringCheckins.length;

      const latestEntry = monitoringCheckins[0];
      lastMinutes = latestEntry.durationMinutes ?? avgMinutes;
      lastTasks = latestEntry.tasksCompleted ?? avgTasks;
      lastToolCount = latestEntry.toolsUsed?.length ?? avgTools;
      lastGoalAlignment = latestEntry.goalAlignment ?? completionRate;
    }

    const trend = (() => {
      const recent = [...monitoringCheckins].slice(0, 10).reverse();
      if (!recent.length) {
        return [35, 42, 38, 45, 48, 50, 53];
      }
      return recent.map((entry) => {
        const base = (entry.rating / 5) * 55;
        const confidenceBoost = ((entry.confidence ?? entry.rating) / 5) * 20;
        const engagementBoost = ((entry.engagementScore ?? averageEngagement) / 100) * 25;
        return Math.min(95, Math.max(8, Math.round(base + confidenceBoost + engagementBoost)));
      });
    })();

    const breakdown = [
      {
        label: 'Focus Minutes',
        value: `${Math.round(totalMinutes)}m`,
        delta: Math.round(lastMinutes - avgMinutes)
      },
      {
        label: 'Task Velocity',
        value: `${Math.max(0, Math.round(tasksTotal))}`,
        delta: Math.round(lastTasks - avgTasks)
      },
      {
        label: 'Tool Variety',
        value: `${toolSet.size}`,
        delta: Math.round(lastToolCount - avgTools)
      }
    ];

    const calendarDays = (() => {
      const daysToShow = 42;
      const today = new Date();
      const buckets = new Map<string, MonitoringCheckin[]>();
      monitoringCheckins.forEach((entry) => {
        const dayKey = entry.createdAt.slice(0, 10);
        const key = dayKey || entry.id;
        if (!buckets.has(key)) {
          buckets.set(key, []);
        }
        buckets.get(key)?.push(entry);
      });
      return Array.from({ length: daysToShow }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (daysToShow - 1 - index));
        const iso = date.toISOString().slice(0, 10);
        const entries = buckets.get(iso) ?? [];
        const count = entries.length;
        const score = entries.reduce((sum, entry) => sum + (entry.rating ?? 0), 0);
        const intensity = count === 0 ? 0 : Math.min(4, Math.round((score / Math.max(1, count))));
        return {
          date: iso,
          count,
          intensity
        };
      });
    })();

    const tasks = planNodesState.length
      ? planNodesState.slice(0, 4).map((node) => ({
          id: node.id,
          title: node.title,
          status: node.status,
          eta: node.durationMinutes ? `${node.durationMinutes}m` : '20m block',
          tool: node.toolId ?? 'ChemCanvas'
        }))
      : [];

    const alerts: Array<{
      id: string;
      title: string;
      description: string;
      severity: 'info' | 'warning' | 'critical';
      action?: string;
    }> = [];

    if (goalTopic && completionRate < 40) {
      alerts.push({
        id: 'goal-alignment',
        title: 'Goal alignment lagging',
        description: `Only ${completionRate}% of checkpoints tied to "${goalTopic}" are complete.`,
        severity: 'warning',
        action: 'Schedule a catch-up block'
      });
    }

    if (averageRating <= 3 && monitoringCheckins.length >= 2) {
      alerts.push({
        id: 'confidence-dip',
        title: 'Confidence trending low',
        description: `Average rating is ${averageRating}/5. Queue a refresher or quick win.`,
        severity: 'critical',
        action: 'Trigger quick review'
      });
    }

    if (lastGoalAlignment >= 75 && monitoringCheckins.length) {
      alerts.push({
        id: 'goal-on-track',
        title: 'On-track streak',
        description: `Latest alignment pulse hit ${lastGoalAlignment}%. Keep riding the momentum.`,
        severity: 'info'
      });
    }

    if (!alerts.length && goalTopic && !monitoringCheckins.length) {
      alerts.push({
        id: 'start-monitoring',
        title: 'Kick off tracking',
        description: `Log your first check-in to monitor "${goalTopic}" with AI nudges.`,
        severity: 'info'
      });
    }

    const feedback = monitoringCheckins.slice(0, 3).map((entry) =>
      entry.aiNudge
        ? entry.aiNudge
        : `Confidence ${entry.rating}/5 on ${entry.focus}. Reflect and adjust plan resources.`
    );
    if (!feedback.length && planNodesState.length) {
      feedback.push('Complete your first milestone to unlock live feedback loops.');
    }

    return {
      trend,
      summary: {
        totalMinutes: Math.round(totalMinutes),
        averageRating,
        completionRate,
        engagementScore: Math.min(100, averageEngagement)
      },
      breakdown,
      tasks,
      alerts,
      feedback,
      calendarDays
    };
  }, [coachEnergy, goalTopic, monitoringCheckins, planNodesState]);

  const togglePreferredTool = (toolId: string) => {
    setPreferredTools(prev =>
      prev.includes(toolId) ? prev.filter(id => id !== toolId) : [...prev, toolId]
    );
  };

  const launchFlashcardSprint = useCallback(async () => {
    if (isGeneratingFlashcards) {
      return;
    }
    const topic = goalTopic.trim() || planFocus.trim();
    if (!topic) {
      setFlashcardError('Add a focus topic before launching the flash card sprint.');
      setInsightBulletin('Set a goal or planning focus to generate tailored flash cards.');
      setIsAssessmentRunning(false);
      return;
    }

    setIsGeneratingFlashcards(true);
    setIsAssessmentRunning(true);
    setFlashcardError(null);
    setFlashcardDeck([]);
    setActiveFlashcardIndex(0);
    setIsFlashcardFlipped(false);

    try {
      const cards = await generateFlashcardDeck({
        topic,
        count: 6,
        learnerLevel: planLevel,
        emphasis: preferredTools.length ? preferredTools : [planPreference]
      });

      const augmented = cards.map((card, index) => ({
        id: `flash-${Date.now()}-${index}`,
        ...card
      }));

      setFlashcardDeck(augmented);
      setInsightBulletin(`Flash card sprint ready. Flip through the ${topic} deck to warm up.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to generate flash cards right now.';
      setFlashcardError(message);
      setInsightBulletin('Flash card sprint stalled. Update your Gemini key or try again later.');
    } finally {
      setIsGeneratingFlashcards(false);
      setIsAssessmentRunning(false);
    }
  }, [goalTopic, planFocus, planLevel, planPreference, preferredTools, isGeneratingFlashcards]);

  const handleAssessmentModeSelect = async (mode: AssessmentMode) => {
    if (!goalTopic.trim() && !planFocus.trim()) {
      setInsightBulletin('Add a focus area before running a baseline check.');
      return;
    }
    if (mode !== 'flashcards') {
      const questions = assessmentQuestions[mode];
      if (!questions || questions.length === 0) {
        setInsightBulletin('Question bank for this mode is coming soon.');
        return;
      }
    }
    if (mode !== 'flashcards' && isAssessmentRunning && assessmentState && !assessmentState.completed) {
      return;
    }
    setSelectedAssessmentMode(mode);
    setAssessmentFeedback(null);
    setAssessmentReview(null);
    setCurrentAssessmentChoice(null);
    setAssessmentError(null);
    setAssessmentGoalHint('');
    if (mode !== 'flashcards') {
      setFlashcardDeck([]);
      setActiveFlashcardIndex(0);
      setIsFlashcardFlipped(false);
      setFlashcardError(null);
      setIsGeneratingFlashcards(false);
    }

    if (mode === 'flashcards') {
      setAssessmentState(null);
      await launchFlashcardSprint();
      return;
    }

    const questions = assessmentQuestions[mode];
    const initialAnswers = Array(questions.length).fill(-1);
    setAssessmentState({
      mode,
      questionIndex: 0,
      answers: initialAnswers,
      startedAt: new Date().toISOString(),
      completed: false,
      score: null
    });
    setIsAssessmentRunning(true);
    setInsightBulletin(`Baseline assessment started: ${ASSESSMENT_MODE_LABEL[mode]}.`);
  };

  const handleAssessmentOptionSelect = (optionIndex: number) => {
    if (!assessmentState || assessmentState.completed) {
      return;
    }
    setCurrentAssessmentChoice(optionIndex);
    setAssessmentError(null);
  };

  const handleAssessmentCancel = () => {
    setAssessmentState(null);
    setSelectedAssessmentMode(null);
    setCurrentAssessmentChoice(null);
    setAssessmentError(null);
    setAssessmentFeedback(null);
    setAssessmentReview(null);
    setAssessmentGoalHint('');
    setIsAssessmentRunning(false);
    setFlashcardDeck([]);
    setActiveFlashcardIndex(0);
    setIsFlashcardFlipped(false);
    setIsGeneratingFlashcards(false);
    setFlashcardError(null);
    setInsightBulletin('Baseline check cancelled.');
  };

  const handleAssessmentSubmit = () => {
    if (!assessmentState || assessmentState.completed) {
      return;
    }
    if (assessmentState.mode === 'flashcards') {
      return;
    }
    const questions = assessmentQuestions[assessmentState.mode];
    if (!questions || questions.length === 0) {
      return;
    }
    if (currentAssessmentChoice === null || currentAssessmentChoice < 0) {
      setAssessmentError('Choose an option before continuing.');
      return;
    }

    const updatedAnswers = [...assessmentState.answers];
    updatedAnswers[assessmentState.questionIndex] = currentAssessmentChoice;
    const isLast = assessmentState.questionIndex >= questions.length - 1;

    if (isLast) {
      setAssessmentState({
        ...assessmentState,
        answers: updatedAnswers
      });
      setCurrentAssessmentChoice(null);
      runAssessment(assessmentState.mode, updatedAnswers);
    } else {
      const nextIndex = assessmentState.questionIndex + 1;
      setAssessmentState({
        ...assessmentState,
        answers: updatedAnswers,
        questionIndex: nextIndex
      });
      const storedChoice = updatedAnswers[nextIndex];
      setCurrentAssessmentChoice(storedChoice >= 0 ? storedChoice : null);
      setAssessmentError(null);
    }
  };

  const handleFlashcardFlip = useCallback(() => {
    setIsFlashcardFlipped((prev) => !prev);
  }, []);

  const handleFlashcardNext = useCallback(() => {
    if (!flashcardDeck.length) {
      return;
    }
    setActiveFlashcardIndex((prev) => Math.min(flashcardDeck.length - 1, prev + 1));
    setIsFlashcardFlipped(false);
  }, [flashcardDeck.length]);

  const handleFlashcardPrevious = useCallback(() => {
    if (!flashcardDeck.length) {
      return;
    }
    setActiveFlashcardIndex((prev) => Math.max(0, prev - 1));
    setIsFlashcardFlipped(false);
  }, [flashcardDeck.length]);

  const handleFlashcardRegenerate = useCallback(async () => {
    await launchFlashcardSprint();
  }, [launchFlashcardSprint]);

  const runAssessment = (mode: AssessmentMode, answersOverride?: number[]) => {
    if (!assessmentState || assessmentState.mode !== mode) {
      return;
    }
    const answers = answersOverride ?? assessmentState.answers;
    const questions = assessmentQuestions[mode];
    if (!questions || questions.length === 0) {
      return;
    }
    const answeredAll = answers.every((answer) => answer >= 0);
    if (!answeredAll) {
      return;
    }

    const focus = goalTopic.trim() || planFocus.trim() || 'your current chemistry focus';
    const modeLabel = ASSESSMENT_MODE_LABEL[mode];
    const correctCount = answers.reduce((total, answer, index) => {
      const question = questions[index];
      return total + (answer === question.correctOptionIndex ? 1 : 0);
    }, 0);
    const score = Math.round((correctCount / questions.length) * 100);
    const highlightBank = ASSESSMENT_HIGHLIGHTS[mode];
    const strengths = pickRandomSubset(highlightBank.strengths, 2);
    const improvements = pickRandomSubset(highlightBank.improvements, 2);
    const snapshot: PriorKnowledgeSnapshot = {
      id: `snapshot-${Date.now()}`,
      mode,
      score,
      summary: `${modeLabel} baseline for ${focus} landed at ${score}% confidence.`,
      strengths,
      improvements,
      aiRecommendation:
        score >= 75
          ? `Momentum is strong. Stretch with a virtual lab or advanced quiz on ${focus}.`
          : `Rebuild fundamentals on ${focus} using MolView visuals and a short quiz loop.`,
      completedAt: new Date().toISOString()
    };
    setPriorKnowledgeSnapshots((prev) => [snapshot, ...prev.filter((existing) => existing.id !== snapshot.id)].slice(0, 5));
    logCoachAction('goal', `${modeLabel} baseline captured via assessment (${score}%)`);
    setExperiencePoints((prev) => Math.min(999, prev + 30));
    setAssessmentFeedback({
      score,
      correct: correctCount,
      total: questions.length
    });
    const reviewItems: AssessmentReviewItem[] = questions.map((question, index) => {
      const chosen = answers[index];
      return {
        id: question.id,
        prompt: question.prompt,
        chosenOption: chosen >= 0 ? question.options[chosen] : 'Not answered',
        correctOption: question.options[question.correctOptionIndex],
        isCorrect: chosen === question.correctOptionIndex,
        explanation: question.explanation
      };
    });
    setAssessmentReview(reviewItems);

    const goalHint =
      score >= 80
        ? `You're primed for stretch work on ${focus}. Set a SMART goal that includes an advanced simulation or timed challenge.`
        : score >= 60
          ? `Set a SMART goal for ${focus} that blends review with fresh practice. Aim for a specific quiz accuracy gain this week.`
          : `Focus your goal on rebuilding foundations for ${focus}. Schedule short daily blocks with MolView and flash cards.`;
    setAssessmentGoalHint(goalHint);
    setInsightBulletin(`Assessment complete. You answered ${correctCount} of ${questions.length} correctly.`);
    setAssessmentState({
      ...assessmentState,
      answers,
      completed: true,
      score
    });
    setIsAssessmentRunning(false);
    setCurrentAssessmentChoice(null);
    setAssessmentError(null);
  };

  const logCoachAction = (phase: SrlPhase, note: string) => {
    const entry: CoachLogEntry = {
      id: `${phase}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      phase,
      note,
      timestamp: new Date().toISOString()
    };
    setCoachLog(prev => {
      const next = [entry, ...prev];
      return next.slice(0, COACH_LOG_LIMIT);
    });
  };

  const sendCoachPrompt = async (phase: SrlPhase, prompt: string, note: string, xpReward = 0) => {
    if (!prompt.trim() || isLoading) {
      return;
    }
    try {
      await onSendMessage(prompt, { mode: 'coach' });
      logCoachAction(phase, note);
      if (xpReward > 0) {
        setExperiencePoints((prev) => Math.min(999, prev + xpReward));
      }
    } catch (error) {
      console.error('SRL coach prompt failed:', error);
    }
  };

  const selectedToolLabels = preferredTools
    .map(id => SRL_TOOL_OPTIONS.find(option => option.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  const handleGenerateGoal = () => {
    const trimmedTopic = goalTopic.trim();
    if (!trimmedTopic || isLoading) {
      return;
    }

    const toolSummary = selectedToolLabels.length
      ? selectedToolLabels.join(', ')
      : 'MolView visualizations, the NMR viewer, and adaptive chemistry quizzes';

  const prompt = [
    'You are ChemCanvas\'s self-regulated learning coach for chemistry students.',
    `The learner wants support creating a SMART goal about "${trimmedTopic}".`,
    `Draft a SMART goal that fits a ${goalTimeframe} horizon and weave in ChemCanvas features such as ${toolSummary}.`,
    'Reference prior struggles only if relevant and keep the learner in the driver seat by offering choices, not mandates.',
    'Close by asking the learner to confirm or tweak the goal.'
  ].join(' ');

    setInsightBulletin('SMART goal drafted - hop into planning to turn it into checkpoints.');
    void sendCoachPrompt('goal', prompt, `SMART goal drafted for ${trimmedTopic}`, 28);
  };

  const handleBuildPlan = () => {
    const focus = (planFocus || goalTopic).trim();
    if (!focus || isLoading) {
      return;
    }

    const preferenceMeta = SRL_PLAN_PREFERENCES.find(option => option.id === planPreference);
    const preferenceDescriptor = preferenceMeta
      ? `${preferenceMeta.label.toLowerCase()} approach (${preferenceMeta.description.toLowerCase()})`
      : 'balanced mix of visuals and practice';

    const toolSummary = selectedToolLabels.length
      ? selectedToolLabels.join(', ')
      : 'MolView, NMR viewer, virtual lab activities, and quick AI check-ins';

  const prompt = [
    'Act as the ChemCanvas SRL planning coach.',
    `Design a branching learning pathway for the topic "${focus}" tailored to a ${planLevel} learner.`,
    `Prioritize a ${preferenceDescriptor}.`,
    `Use ChemCanvas assets like ${toolSummary} and note when to leverage the AI chat versus hands-on tools.`,
    'Include 3-4 checkpoints with self-monitoring cues and optional extension challenges.',
    'End by inviting the learner to choose their next step.'
  ].join(' ');

    setInsightBulletin(`Adaptive pathway ready - start activating milestones for ${focus}.`);
    void sendCoachPrompt('plan', prompt, `Adaptive pathway generated for ${focus}`, 24);
  };

  const handleNewPlan = () => {
    setPlanNodesState([]);
    setPlanEdgesState([]);
    setPlanScenariosState([]);
    setPlanFocus('');
    setInsightBulletin('New plan started - add your first milestone to begin building an adaptive pathway.');
  };

  const handleMonitoringFeedback = () => {
    const trimmedFocus = monitorFocus.trim();
    if (!trimmedFocus || monitorRating === null || isLoading) {
      return;
    }

  const prompt = [
    'Respond as the ChemCanvas SRL self-monitoring coach.',
    `The learner rated their understanding of "${trimmedFocus}" as ${monitorRating}/5.`,
    `Notes from the learner: ${monitorNotes.trim() || 'No additional notes provided.'}`,
    selectedToolLabels.length
      ? `Preferred tools at the moment: ${selectedToolLabels.join(', ')}.`
      : 'Use relevant ChemCanvas tools such as MolView, the NMR viewer, and AI-generated quizzes as needed.',
    'Acknowledge their self-assessment, highlight what the rating suggests, and recommend one short action plus a follow-up checkpoint.',
    'Close with a metacognitive question that encourages tracking progress without taking agency away.'
  ].join(' ');

    setInsightBulletin('Monitoring insight queued - check the dashboard for coach nudges.');
    void sendCoachPrompt(
      'monitor',
      prompt,
      `Confidence check logged for ${trimmedFocus} (${monitorRating}/5)`,
      18
    );
  };

  const handleReflectionSummary = () => {
    if (!reflectionNotes.trim() || isLoading) {
      return;
    }

  const prompt = [
    'You are wrapping up a chemistry study session as the ChemCanvas SRL reflection coach.',
    `Learner emotion: ${reflectionEmotion}.`,
    `Learner reflection: ${reflectionNotes.trim()}.`,
    'Summarise key insights, connect them back to earlier goals or checkpoints when possible, and suggest one actionable carry-over goal for the next session.',
    'Offer an optional advanced extension and remind the learner they can revisit their AI chat history for continuity.'
  ].join(' ');

    setInsightBulletin('Reflection summary queued - capture a highlight reel if you want to share it forward.');
    void sendCoachPrompt('reflect', prompt, 'Reflection synthesized for current session', 20);
  };

  const handleHelpRequest = () => {
    const trimmedTopic = helpTopic.trim();
    if (!trimmedTopic || isLoading) {
      return;
    }

    const attemptLabel = helpAttempts === 1 ? 'first' : `${helpAttempts} attempts`;
    const helpLevelDescription = (() => {
      switch (helpLevel) {
        case 'hint':
          return 'Offer a nudge or hint that keeps the learner in the driver seat.';
        case 'guided':
          return 'Walk through the first chunk and then return control to the learner.';
        case 'explanation':
          return 'Deliver a concise explanation with rationale and link out to the right ChemCanvas tools.';
        default:
          return '';
      }
    })();

    const prompt = [
      'Switch to the ChemCanvas SRL help-seeking coach voice.',
      `The learner is stuck on "${trimmedTopic}" after ${attemptLabel}.`,
      helpLevelDescription,
      selectedToolLabels.length
        ? `Recommend when to lean on ${selectedToolLabels.join(', ')} or escalate to a human mentor if progress stalls.`
        : 'Recommend when to use MolView, the NMR viewer, virtual labs, or reach out to a mentor.',
      'Keep the tone encouraging and emphasise autonomy by offering tiered support options.'
    ].join(' ');

    setInsightBulletin('Coach support is on the way - review previous attempts while you wait.');
    void sendCoachPrompt('help', prompt, `Support requested for ${trimmedTopic}`, 14);
  };

  const handleChallengeSpin = () => {
    const challengePool = SRL_CHALLENGE_DECK.filter(
      (challenge) => challenge.phase === activePhase || challenge.phase === 'wildcard'
    );
    const nextChallenge = pickRandom(challengePool);
    if (nextChallenge) {
      setActiveChallenge(nextChallenge);
    }
  };

  const handleEnergyBoost = () => {
    setCoachEnergy((prev) => Math.min(100, prev + 7));
    const bonusTip = pickRandom([
      ...SRL_HYPE_TIPS[activePhase],
      ...SRL_HYPE_TIPS.wildcard
    ]);
    if (bonusTip) {
      setHypeTip(bonusTip);
    }
  };

  const handleGenerateGoalBuddy = () => {
    if (!shareCoachData) {
      setGoalBuddySummary('Enable anonymous sharing in the privacy controls to unlock Goal Buddy insights.');
      return;
    }

    if (!priorKnowledgeSnapshots.length) {
      setGoalBuddySummary('Complete a baseline check-in to see how similar learners approached this goal.');
      return;
    }

    const focus = goalTopic.trim() || planFocus.trim() || 'this chemistry focus';
    const aggregates = priorKnowledgeSnapshots.reduce(
      (acc, snapshot) => {
        acc.total += snapshot.score ?? 60;
        acc.count += 1;
        acc.modeCounts[snapshot.mode] = (acc.modeCounts[snapshot.mode] ?? 0) + 1;
        return acc;
      },
      { total: 0, count: 0, modeCounts: {} as Record<AssessmentMode, number> }
    );
    const averageScore = Math.round(aggregates.total / Math.max(1, aggregates.count));
    const topMode = (Object.entries(aggregates.modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as AssessmentMode) ?? 'quiz';
    const topModeLabel = ASSESSMENT_MODE_LABEL[topMode];
    const pacing =
      averageScore >= 75 ? 'two focused sessions and a simulation recap' : 'three shorter check-ins spread across the week';

    setGoalBuddySummary(
      `Goal Buddy pulse: learners with a similar ${focus} goal average ${averageScore}% after ${pacing}. The most popular warm-up is the ${topModeLabel.toLowerCase()}; try pairing it with MolView before your next quiz.`
    );
    logCoachAction('goal', 'Goal Buddy insight refreshed');
    setExperiencePoints((prev) => Math.min(999, prev + 10));
  };

  const handleAddPlanNode = () => {
    const focus = (planFocus || goalTopic).trim() || 'ChemCanvas sprint';
    setPlanNodesState((prev) => {
      const newId = `plan-node-${Date.now()}`;
      const toolLabel =
        selectedToolLabels.length > 0
          ? selectedToolLabels[prev.length % selectedToolLabels.length]
          : 'Custom reflection';
      const newNode: PlanNode = {
        id: newId,
        title: `Milestone ${prev.length + 1}`,
        description: `Advance ${focus.toLowerCase()} with a ${toolLabel.toLowerCase()} block.`,
        toolId: toolLabel,
        durationMinutes: 20 + prev.length * 5,
        status: 'pending',
        resources: [`${toolLabel} walkthrough`, 'Log a confidence rating once finished']
      };
      setPlanEdgesState((prevEdges) => {
        if (!prev.length) {
          return prevEdges;
        }
        const lastNode = prev[prev.length - 1];
        return [
          ...prevEdges,
          { id: `edge-${lastNode.id}-${newId}`, source: lastNode.id, target: newId, label: 'next step' }
        ];
      });
      return [...prev, newNode];
    });
    setExperiencePoints((prev) => Math.min(999, prev + 15));
    logCoachAction('plan', 'Added a new milestone to the roadmap');
  };

  const handleUpdatePlanNodeStatus = (nodeId: string, status: PlanNode['status']) => {
    const existingNode = planNodesState.find((node) => node.id === nodeId);
    if (!existingNode) {
      return;
    }
    setPlanNodesState((prev) =>
      prev.map((node) => (node.id === nodeId ? { ...node, status } : node))
    );
    logCoachAction('plan', `${existingNode.title} marked ${status.replace('-', ' ')}`);
    if (existingNode.status !== 'completed' && status === 'completed') {
      setExperiencePoints((prev) => Math.min(999, prev + 18));
    }
  };

  const handleRunPlanSimulation = () => {
    if (!planNodesState.length) {
      setInsightBulletin('Add at least one milestone before running the what-if simulator.');
      return;
    }
    const focus = (planFocus || goalTopic).trim() || 'your chemistry target';
    const completed = planNodesState.filter((node) => node.status === 'completed').length;
    const remaining = planNodesState.length - completed;
    const scenario: PlanScenario = {
      id: `scenario-${Date.now()}`,
      title: remaining === 0 ? 'Victory Lap Projection' : 'Momentum vs Reset',
      description:
        remaining === 0
          ? 'Everything is checked off! Channel the energy into an extension challenge or deep reflection.'
          : `Staying consistent with ${planNodesState[0]?.title ?? 'your opening milestone'} keeps you on track while ${remaining} checkpoints remain.`,
      impactSummary: `Prediction: maintain this cadence to boost confidence on ${focus} by about ${Math.min(25, 12 + completed * 5)}%.`,
      createdAt: new Date().toISOString()
    };
    setPlanScenariosState((prev) => [scenario, ...prev].slice(0, 3));
    logCoachAction('plan', 'Ran a what-if simulation');
    setExperiencePoints((prev) => Math.min(999, prev + 12));
    setInsightBulletin(
      `Simulation suggests a ${Math.min(25, 12 + completed * 5)}% confidence lift if you honour the next milestone on ${focus}.`
    );
  };

  const handleRequestCheckin = () => {
    const focus = monitorFocus.trim() || goalTopic.trim() || 'General progress';
    const rating = monitorRating ?? Math.max(1, Math.min(5, Math.round(coachEnergy / 20)));
    const confidence = Math.max(1, Math.min(5, Math.round(rating + (coachEnergy - 50) / 25)));
    const completedNodes = planNodesState.filter((node) => node.status === 'completed').length;
    const completionRate = planNodesState.length
      ? Math.round((completedNodes / planNodesState.length) * 100)
      : 40;
    const durationMinutes = Math.max(
      12,
      Math.round((momentumScore + coachEnergy) / 3 + (monitorNotes ? 6 : 0))
    );
    const tasksCompleted = Math.max(
      1,
      Math.round(
        rating + (planNodesState.length ? completedNodes : Math.max(1, rating - 1))
      )
    );
    const engagementScore = Math.min(100, Math.round(coachEnergy * 0.6 + momentumScore * 0.4));
    const goalAlignment = Math.min(100, Math.round((confidence / 5) * 50 + completionRate / 2));
    const toolsUsed = preferredTools.length ? preferredTools.slice(0, 3) : ['custom-tool'];
    const checkin: MonitoringCheckin = {
      id: `checkin-${Date.now()}`,
      createdAt: new Date().toISOString(),
      focus,
      rating,
      confidence,
      note: monitorNotes.trim() || undefined,
      aiNudge:
        rating >= 4
          ? `Momentum is high on ${focus}. Add a stretch question or simulate a trickier scenario.`
          : `Take a breath and revisit the foundation of ${focus} with MolView or a quick quiz before retrying.`,
      durationMinutes,
      tasksCompleted,
      engagementScore,
      goalAlignment,
      toolsUsed
    };
    setMonitoringCheckins((prev) => [checkin, ...prev].slice(0, 8));
    logCoachAction('monitor', `Check-in logged for ${focus} (${rating}/5)`);
    setExperiencePoints((prev) => Math.min(999, prev + 12));
  };

  const handleOpenMonitoringInsights = () => {
    if (!monitoringCheckins.length) {
      setInsightBulletin('Log a check-in to unlock your weekly insights.');
      return;
    }
    const average =
      Math.round(
        (monitoringCheckins.reduce((total, entry) => total + entry.rating, 0) / monitoringCheckins.length) * 10
      ) / 10;
    const focusCounts = monitoringCheckins.reduce((acc, entry) => {
      const key = entry.focus || 'General';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'your core concept';
    setInsightBulletin(
      `Weekly insights: average confidence ${average}/5. ${topFocus} has been your most tracked focus - plan a reflection or mini-quiz around it.`
    );
  };

  const handleCreateReflectionEntry = () => {
    const response = reflectionNotes.trim();
    if (!response) {
      setInsightBulletin('Jot a quick note above before logging it into your reflection timeline.');
      return;
    }
    const entry: ReflectionEntry = {
      id: `reflection-${Date.now()}`,
      createdAt: new Date().toISOString(),
      prompt: `Reflection on ${goalTopic.trim() || 'today'}`,
      response,
      mood: reflectionEmotion
    };
    setReflectionEntries((prev) => [entry, ...prev]);
    setReflectionNotes('');
    logCoachAction('reflect', 'Reflection entry captured');
    setExperiencePoints((prev) => Math.min(999, prev + 22));
  };

  const handleGenerateHighlightReel = () => {
    if (!reflectionEntries.length) {
      setInsightBulletin('Capture at least one reflection to build a highlight reel.');
      return;
    }
    const highlightUrls = [
      'https://chemcanvas.netlify.app/tools/molview',
      'https://chemcanvas.netlify.app/tools/nmr-viewer'
    ];
    setReflectionEntries((prev) =>
      prev.map((entry, index) =>
        index === 0 ? { ...entry, highlightMediaUrls: highlightUrls } : entry
      )
    );
    setExperiencePoints((prev) => Math.min(999, prev + 10));
    setInsightBulletin('Highlight reel ready - your latest reflection now includes quick share links.');
  };

  const handleRequestHelp = (channel: HelpChannel) => {
    const topic = helpTopic.trim() || goalTopic.trim() || 'General chemistry support';
    const request: HelpRequest = {
      id: `help-${Date.now()}`,
      channel,
      topic,
      createdAt: new Date().toISOString(),
      status: 'open',
      aiForecast: HELP_FORECAST_COPY[channel]
    };
    setHelpRequests((prev) => [request, ...prev].slice(0, 6));
    logCoachAction('help', `${HELP_CHANNEL_LABEL[channel]} request queued`);
  };

  const handleResolveHelpRequest = (requestId: string) => {
    setHelpRequests((prev) =>
      prev.map((request) => (request.id === requestId ? { ...request, status: 'resolved' } : request))
    );
    logCoachAction('help', 'Help request marked resolved');
    setExperiencePoints((prev) => Math.min(999, prev + 10));
  };

  const handleHelpForecast = () => {
    if (!helpRequests.length) {
      setInsightBulletin('No active support threads. Log a new request to receive forecasts.');
      return;
    }

    setHelpRequests((prev) =>
      prev.map((request) =>
        request.status === 'open'
          ? { ...request, aiForecast: request.aiForecast ?? HELP_FORECAST_COPY[request.channel] }
          : request
      )
    );

    const oldestOpen = helpRequests.find((request) => request.status === 'open');
    setInsightBulletin(
      oldestOpen
        ? `Forecast refreshed. Prioritise your ${HELP_CHANNEL_LABEL[oldestOpen.channel]} request about "${oldestOpen.topic}".`
        : 'All support threads are resolved. Consider logging what you learned in a reflection.'
    );
  };
  return (
    <div className="h-full w-full overflow-y-auto rounded-3xl border border-slate-800/60 bg-gray-900/95 p-4 md:p-6 shadow-2xl">
      {documentName && (
        <div className="mb-4 rounded-xl border border-blue-700/40 bg-blue-900/30 px-4 py-3 text-sm text-blue-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-blue-300" />
              <span>
                Reference: <strong>{documentName}</strong>
              </span>
            </div>
            {onOpenDocument && (
              <button
                onClick={onOpenDocument}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-500"
              >
                Open
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-blue-100/80">
            Coach outputs will include citations when document context is used.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div
            className={`relative rounded-2xl border border-blue-700/40 p-5 md:p-6 text-white shadow-lg bg-gradient-to-br ${
              ([...SRL_MOMENTUM_LEVELS].reverse().find((level) => momentumScore >= level.min) ?? SRL_MOMENTUM_LEVELS[0]).gradient
            }`}
          >
            <div className="absolute -top-10 -right-6 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                  {(() => {
                    const tier =
                      [...SRL_MOMENTUM_LEVELS].reverse().find((level) => momentumScore >= level.min) ??
                      SRL_MOMENTUM_LEVELS[0];
                    const TierIcon = tier.icon;
                    return (
                      <>
                        <TierIcon size={14} className="text-yellow-200" />
                        {tier.label} Momentum
                      </>
                    );
                  })()}
                </div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  Momentum Score <span className="text-amber-200">{momentumScore}</span>
                </h3>
                <p className="text-sm text-white/80">
                  {
                    (
                      [...SRL_MOMENTUM_LEVELS].reverse().find((level) => momentumScore >= level.min) ??
                      SRL_MOMENTUM_LEVELS[0]
                    ).vibe
                  }
                </p>
                <p className="text-xs text-white/70">{SRL_PHASES[activePhase].description}</p>
                <div className="space-y-2 pt-2">
                  <div>
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/70">
                      <span>Momentum Progress</span>
                      <span>{Math.min(100, Math.round(momentumScore))}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-amber-300 transition-all"
                        style={{ width: `${Math.min(100, Math.round(momentumScore))}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/70">
                      <span>Energy</span>
                      <span>{Math.min(100, Math.round(coachEnergy))}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-emerald-300 transition-all"
                        style={{ width: `${Math.min(100, Math.round(coachEnergy))}%` }}
                      />
                    </div>
                  </div>
                </div>
                <label className="mt-4 inline-flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/70">
                  <input
                    type="checkbox"
                    checked={shareCoachData}
                    onChange={(event) => setShareCoachData(event.target.checked)}
                    className="h-4 w-4 rounded border-white/40 bg-transparent text-amber-200 focus:ring-amber-200"
                  />
                  Share anonymous progress for Goal Buddy insights
                </label>
                <div className="pt-3 space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-white/70">Learning Journey Map</p>
                  <div className="flex flex-wrap gap-2">
                    {learningJourney.map(({ phase, count }) => (
                      <span
                        key={phase}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${
                          count > 0 ? 'border-white/35 bg-white/15 text-white' : 'border-white/15 text-white/60'
                        }`}
                      >
                        {SRL_PHASES[phase].label}
                        <span className="font-semibold text-amber-200">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl bg-white/10 p-4 backdrop-blur min-w-[220px]">
                <div className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-white/80">
                  <span>XP Tracker</span>
                  <Trophy size={18} className="text-yellow-200" />
                </div>
                <div className="text-3xl font-bold text-yellow-100">
                  {Math.min(999, experiencePoints)}
                </div>
                <p className="text-xs text-white/70">
                  Streak: <strong className="text-white">{phaseStreak}</strong> phases | Actions logged: <strong className="text-white">{coachLog.length}</strong>
                </p>
                <p className="text-[11px] text-white/60">
                  Streak bonus {streakBonus}% | Coach energy {Math.min(100, Math.round(coachEnergy))}%
                </p>
                <button
                  type="button"
                  onClick={handleEnergyBoost}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-white/30"
                >
                  <Sparkle size={14} />
                  Boost Energy
                </button>
              </div>
            </div>
            {insightBulletin && (
              <div className="mt-4 rounded-xl border border-white/20 bg-white/10 p-3 text-xs text-white/80">
                {insightBulletin}
              </div>
            )}
          </div>

          <div className="bg-gray-800/70 border border-blue-700/40 rounded-xl p-4 md:p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">SRL Coach Phases</p>
                <p className="text-sm text-gray-300">Choose your focus lane and launch a fresh interaction.</p>
              </div>
              <div className="text-xs text-blue-200 bg-blue-900/40 px-3 py-1 rounded-full border border-blue-700/40 uppercase tracking-wide">
                Current vibe: {SRL_PHASES[activePhase].label}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SRL_PHASES) as SrlPhase[]).map((phase) => {
                const meta = SRL_PHASES[phase];
                const Icon = meta.icon;
                const isActivePhase = phase === activePhase;
                return (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => setActivePhase(phase)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      isActivePhase
                        ? 'border-blue-500 bg-blue-600/30 text-blue-100 shadow'
                        : 'border-blue-500/40 bg-blue-900/20 text-blue-200 hover:border-blue-500/60 hover:text-blue-100'
                    }`}
                  >
                    <Icon size={16} className={isActivePhase ? 'text-blue-100' : meta.accent} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-lg border border-blue-700/30 bg-blue-900/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">Hype Tip</p>
              <p className="mt-1 text-sm text-blue-100">{hypeTip}</p>
            </div>
            <div className="space-y-4">
              {(() => {
                switch (activePhase) {
                  case 'goal':
                    return (
                      <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                            Focus Area
                            <input
                              value={goalTopic}
                              onChange={(event) => setGoalTopic(event.target.value)}
                              placeholder="e.g., Alkane reaction mechanisms or NMR peak assignments"
                              className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                            Timeframe
                            <select
                              value={goalTimeframe}
                              onChange={(event) => setGoalTimeframe(event.target.value)}
                              className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            >
                              <option value="today">Today</option>
                              <option value="this week">This week</option>
                              <option value="this month">This month</option>
                              <option value="before my next exam">Before my next exam</option>
                            </select>
                          </label>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                            ChemCanvas Tools to Highlight
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {SRL_TOOL_OPTIONS.map((option) => {
                              const isActive = preferredTools.includes(option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => togglePreferredTool(option.id)}
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                    isActive
                                      ? 'border-blue-500 bg-blue-600/30 text-blue-100'
                                      : 'border-gray-700 bg-gray-900/60 text-gray-300 hover:border-blue-500/40 hover:text-blue-100'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateGoal}
                          disabled={isLoading || !goalTopic.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Target size={16} />
                          Draft SMART Goal with AI
                        </button>
                        <PriorKnowledgePanel
                          selectedMode={selectedAssessmentMode}
                          onSelectMode={handleAssessmentModeSelect}
                          onGenerateGoalBuddy={handleGenerateGoalBuddy}
                          snapshots={priorKnowledgeSnapshots}
                          isBusy={isLoading || isAssessmentRunning}
                        />
                        {selectedAssessmentMode === 'flashcards' ? (
                          <FlashCardDeck
                            cards={flashcardDeck}
                            activeIndex={activeFlashcardIndex}
                            isFlipped={isFlashcardFlipped}
                            isLoading={isGeneratingFlashcards}
                            error={flashcardError}
                            topic={goalTopic.trim() || planFocus.trim() || 'Chemistry focus'}
                            onFlip={handleFlashcardFlip}
                            onNext={handleFlashcardNext}
                            onPrevious={handleFlashcardPrevious}
                            onRegenerate={handleFlashcardRegenerate}
                            onCancel={handleAssessmentCancel}
                          />
                        ) : assessmentState && !assessmentState.completed && currentAssessmentQuestion && currentAssessmentQuestions ? (
                          <div className="rounded-2xl border border-amber-500/30 bg-amber-900/15 p-4 space-y-4">
                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Baseline Assessment</p>
                                <h4 className="text-sm font-semibold text-amber-100">
                                  {ASSESSMENT_MODE_LABEL[assessmentState.mode]}
                                </h4>
                              </div>
                              <span className="text-[11px] uppercase tracking-wide text-amber-200/70">
                                Question {assessmentState.questionIndex + 1} of {currentAssessmentQuestions.length}
                              </span>
                            </div>
                            <div className="text-sm text-amber-50">
                              {currentAssessmentQuestion.prompt}
                            </div>
                            <div className="grid gap-2">
                              {currentAssessmentQuestion.options.map((option, index) => {
                                const isSelected = currentAssessmentChoice === index;
                                return (
                                  <button
                                    key={`${currentAssessmentQuestion.id}-option-${index}`}
                                    type="button"
                                    onClick={() => handleAssessmentOptionSelect(index)}
                                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                                      isSelected
                                        ? 'border-amber-400 bg-amber-500/20 text-amber-100 shadow-sm'
                                        : 'border-amber-500/20 bg-transparent text-amber-100/80 hover:border-amber-400/40 hover:bg-amber-500/10'
                                    }`}
                                  >
                                    <span className="mt-[3px] inline-flex h-2.5 w-2.5 rounded-full bg-amber-300" />
                                    <span>{option}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {assessmentError ? (
                              <p className="text-xs text-rose-300">{assessmentError}</p>
                            ) : null}
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <button
                                type="button"
                                onClick={handleAssessmentCancel}
                                className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/10"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleAssessmentSubmit}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-amber-400 hover:to-orange-400"
                              >
                                {assessmentState.questionIndex >= currentAssessmentQuestions.length - 1
                                  ? 'Finish Assessment'
                                  : 'Next Question'}
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {assessmentFeedback && assessmentState?.completed && assessmentReview ? (
                          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Assessment Summary</p>
                                <h4 className="text-sm font-semibold text-amber-100">
                                  {ASSESSMENT_MODE_LABEL[assessmentState.mode]}
                                </h4>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-amber-50">{assessmentFeedback.score}%</p>
                                <p className="text-[11px] uppercase tracking-wide text-amber-200/80">
                                  {assessmentFeedback.correct} / {assessmentFeedback.total} correct
                                </p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {assessmentReview.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-xl border border-amber-400/30 bg-amber-900/15 p-3 text-xs text-amber-100"
                                >
                                  <p className="font-semibold text-amber-50">{item.prompt}</p>
                                  <p
                                    className={`mt-2 font-semibold ${
                                      item.isCorrect ? 'text-emerald-200' : 'text-rose-200'
                                    }`}
                                  >
                                    {item.isCorrect ? 'Correct' : 'Needs Review'}
                                  </p>
                                  <p className="text-amber-100/80">You chose: {item.chosenOption}</p>
                                  {!item.isCorrect ? (
                                    <p className="text-amber-100/80">Correct answer: {item.correctOption}</p>
                                  ) : null}
                                  {item.explanation ? (
                                    <p className="mt-1 text-amber-100/60">Why: {item.explanation}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {assessmentGoalHint ? (
                          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                            <p className="font-semibold uppercase tracking-wide text-amber-200">Goal Guidance</p>
                            <p className="mt-1 text-amber-100/80">{assessmentGoalHint}</p>
                          </div>
                        ) : null}
                        {goalBuddySummary ? (
                          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-100">
                            <p className="font-semibold uppercase tracking-wide text-blue-200">Goal Buddy Insight</p>
                            <p className="mt-1 text-blue-100/80">{goalBuddySummary}</p>
                          </div>
                        ) : null}
                      </div>
                    );
                  case 'plan':
                    return (
                      <div className="space-y-4">
                        <div className="grid md:grid-cols-3 gap-3">
                          <label className="md:col-span-2 flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                            Topic to Map
                            <input
                              value={planFocus}
                              onChange={(event) => setPlanFocus(event.target.value)}
                              placeholder="e.g., Resonance in benzene or acid-base titrations"
                              className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                            Learner Level
                            <select
                              value={planLevel}
                              onChange={(event) => setPlanLevel(event.target.value as PlanLevel)}
                              className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            >
                              <option value="beginner">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="advanced">Advanced</option>
                            </select>
                          </label>
                        </div>
                        <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                          Preferred Format
                          <select
                            value={planPreference}
                            onChange={(event) => setPlanPreference(event.target.value)}
                            className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          >
                            {SRL_PLAN_PREFERENCES.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={handleBuildPlan}
                          disabled={isLoading || (!planFocus.trim() && !goalTopic.trim())}
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Route size={16} />
                          Generate Adaptive Pathway
                        </button>

                        {/* AI-Generated Adaptive Plan */}
                        <div className="mt-6">
                          <AdaptivePlan
                            onPlanGenerated={(nodes, edges) => {
                              setPlanNodesState(nodes);
                              setPlanEdgesState(edges);
                              setPlanFocus(planFocus || goalTopic || 'AI-Generated Plan');
                            }}
                            initialTopic={planFocus || goalTopic}
                          />
                        </div>

                        {/* Manual Planning Mind Map */}
                        <div className="mt-6">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="h-px bg-gray-700 flex-1"></div>
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Or Build Manually</span>
                            <div className="h-px bg-gray-700 flex-1"></div>
                          </div>
                          <PlanningMindMap
                            nodes={planNodesState}
                            edges={planEdgesState}
                            scenarios={planScenariosState}
                            onAddStep={handleAddPlanNode}
                            onUpdateStatus={handleUpdatePlanNodeStatus}
                            onRunSimulation={handleRunPlanSimulation}
                            onNewPlan={handleNewPlan}
                            isBusy={isLoading}
                          />
                        </div>
                      </div>
                    );
                  case 'monitor':
                    return (
                      <div className="space-y-4">
                        <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                          Concept or Skill
                          <input
                            value={monitorFocus}
                            onChange={(event) => setMonitorFocus(event.target.value)}
                            placeholder="e.g., Predicting NMR splitting patterns"
                            className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                          />
                        </label>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                            Confidence Rating
                          </p>
                          <div className="mt-2 flex gap-2">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setMonitorRating(rating)}
                                className={`h-9 w-9 rounded-lg border text-xs font-semibold transition ${
                                  monitorRating === rating
                                    ? 'border-sky-500 bg-sky-600/40 text-sky-100'
                                    : 'border-gray-700 bg-gray-900/60 text-gray-400 hover:border-sky-500/40 hover:text-sky-100'
                                }`}
                              >
                                {rating}
                              </button>
                            ))}
                          </div>
                        </div>
                        <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                          Notes
                          <textarea
                            value={monitorNotes}
                            onChange={(event) => setMonitorNotes(event.target.value)}
                            rows={3}
                            placeholder="Where exactly did confidence dip or spike?"
                            className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleMonitoringFeedback}
                          disabled={isLoading || monitorRating === null || !monitorFocus.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-sky-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Activity size={16} />
                          Generate Monitoring Feedback
                        </button>
                        <MonitoringDashboard
                          momentumScore={momentumScore}
                          phaseStreak={phaseStreak}
                          coachEnergy={coachEnergy}
                          experiencePoints={experiencePoints}
                          streakBonus={streakBonus}
                          checkins={monitoringCheckins}
                          progressTrend={monitoringAnalytics.trend}
                          progressSummary={monitoringAnalytics.summary}
                          engagementBreakdown={monitoringAnalytics.breakdown}
                          activeTasks={monitoringAnalytics.tasks}
                          feedbackHighlights={monitoringAnalytics.feedback}
                          goalAlerts={monitoringAnalytics.alerts}
                          activityCalendar={monitoringAnalytics.calendarDays}
                          onRequestCheckin={handleRequestCheckin}
                          onOpenInsights={handleOpenMonitoringInsights}
                          isBusy={isLoading}
                        />
                      </div>
                    );
                  case 'reflect':
                    return (
                      <div className="space-y-4">
                        <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                          Session Emotion
                          <select
                            value={reflectionEmotion}
                            onChange={(event) => setReflectionEmotion(event.target.value)}
                            className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          >
                            {SRL_REFLECTION_EMOTIONS.map((emotion) => (
                              <option key={emotion} value={emotion}>
                                {emotion}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                          Reflection Notes
                          <textarea
                            value={reflectionNotes}
                            onChange={(event) => setReflectionNotes(event.target.value)}
                            rows={4}
                            placeholder="What clicked, what still feels fuzzy, and what surprised you?"
                            className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleReflectionSummary}
                          disabled={isLoading || !reflectionNotes.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-purple-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <PenLine size={16} />
                          Synthesize Reflection
                        </button>
                        <ReflectionTimeline
                          entries={reflectionEntries}
                          onCreateReflection={handleCreateReflectionEntry}
                          onGenerateHighlightReel={handleGenerateHighlightReel}
                          isBusy={isLoading}
                        />
                      </div>
                    );
                  case 'help':
                    return (
                      <div className="space-y-4">
                        <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                          Topic
                          <input
                            value={helpTopic}
                            onChange={(event) => setHelpTopic(event.target.value)}
                            placeholder="e.g., Assigning stereochemistry for 2-bromobutane"
                            className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                          Attempts Made
                          <input
                            type="number"
                            min={1}
                            value={helpAttempts}
                            onChange={(event) => setHelpAttempts(Math.max(1, Number(event.target.value) || 1))}
                            className="mt-1 w-24 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-rose-500 focus:outline-none focus:ring-2  focus:ring-rose-500/30"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-gray-400 uppercase tracking-wide">
                          Support Level
                          <select
                            value={helpLevel}
                            onChange={(event) => setHelpLevel(event.target.value as HelpLevel)}
                            className="mt-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                          >
                            <option value="hint">Hint</option>
                            <option value="guided">Guided Step</option>
                            <option value="explanation">Explanation</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={handleHelpRequest}
                          disabled={isLoading || !helpTopic.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:from-rose-500 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <LifeBuoy size={16} />
                          Request Tiered Support
                        </button>
                        <HelpHub
                          requests={helpRequests}
                          onRequestHelp={handleRequestHelp}
                          onResolve={handleResolveHelpRequest}
                          onForecastSupport={handleHelpForecast}
                          isBusy={isLoading}
                        />
                      </div>
                    );
                  default:
                    return null;
                }
              })()}
            </div>
          </div>

          {coachLog.length > 0 && (
            <div className="bg-gray-800/70 border border-indigo-700/40 rounded-xl p-4 md:p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-300">
                <Clock size={14} className="text-indigo-300" />
                Coach Activity Log
              </div>
              <div className="mt-3 space-y-3">
                {coachLog.map((entry) => {
                  const meta = SRL_PHASES[entry.phase];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border border-indigo-700/30 bg-indigo-900/10 p-3 text-xs text-gray-200"
                    >
                      <Icon size={16} className={`${meta.accent} mt-[2px]`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{meta.label}</span>
                          <span className="text-[11px] text-gray-400">{formatCoachTimestamp(entry.timestamp)}</span>
                        </div>
                        <p className="text-[11px] text-gray-300">{entry.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-gray-800/70 border border-indigo-700/40 rounded-xl p-4 md:p-5 flex flex-col gap-3 min-h-[280px] xl:max-h-[620px]">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-indigo-200">
              <span className="flex items-center gap-2">
                <Sparkles size={14} />
                Coach Output
              </span>
              {isLoading && (
                <div className="inline-flex items-center gap-2 text-indigo-100">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Generating...</span>
                </div>
              )}
            </div>
            <div className="text-[11px] text-indigo-100/80">
              Gemini responses for the SRL coach appear here. They are independent from the main chat assistant.
            </div>
            <div className="flex-1 overflow-y-auto rounded-lg border border-indigo-700/30 bg-indigo-900/10 p-3 space-y-4">
              {coachInteractions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-indigo-200/70">
                  <Wand size={28} className="mb-2 text-indigo-200" />
                  <p className="text-sm font-semibold">Ready when you are!</p>
                  <p className="text-xs text-indigo-100/70">Pick a phase and launch an AI-powered coaching move to see the response here.</p>
                </div>
              ) : (
                coachInteractions.map((interaction) => (
                  <div key={interaction.id} className="space-y-2">
                    {interaction.prompt?.trim() && (
                      <div className="flex justify-end">
                        <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[70ch] shadow-lg text-sm">
                          <p className="text-xs font-semibold mb-1 opacity-80">Coach Prompt</p>
                          <p>{interaction.prompt}</p>
                        </div>
                      </div>
                    )}
                    {(interaction.response?.trim() || interaction.toolResponses?.length) && (
                      <div className="flex justify-start">
                        <div className="bg-indigo-950/70 border border-indigo-700/50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[70ch] shadow-md space-y-3 text-sm text-indigo-100">
                          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200 uppercase tracking-wide">
                            <Sparkles size={14} className="text-indigo-300" />
                            Gemini SRL Coach
                          </div>
                          {interaction.toolResponses?.length ? (
                            <div className="space-y-3">
                              {interaction.toolResponses.map(tool => (
                                <AIToolResponseCard key={tool.id} response={tool} />
                              ))}
                            </div>
                          ) : null}
                          {interaction.response?.trim() && (
                            <>
                              <LLMMessage content={interaction.response} onCitationClick={onOpenDocument} />
                              <VerifiedSmilesBlock sourceText={interaction.response} />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={outputEndRef} />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-600/40 bg-emerald-900/20 p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Mini Challenge</p>
                <h4 className="text-sm font-semibold text-emerald-100">
                  {activeChallenge?.title ?? 'Pick a surprise quest'}
                </h4>
              </div>
              <button
                type="button"
                onClick={handleChallengeSpin}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/60 bg-emerald-800/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-50 transition hover:bg-emerald-700/50"
              >
                <Wand2 size={14} />
                Spin
              </button>
            </div>
            <p className="mt-2 text-xs text-emerald-100">
              {activeChallenge?.description ?? 'Spin the wheel to get a quick quest aligned with your current phase.'}
            </p>
            {activeChallenge && (
              <p className="mt-2 text-[11px] text-emerald-200 uppercase tracking-wide">
                Focus: {activeChallenge.phase === 'wildcard' ? 'Wildcard creativity' : SRL_PHASES[activeChallenge.phase].label}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-blue-500/40 bg-blue-900/15 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">AR Molecule Preview</p>
                <h4 className="text-sm font-semibold text-blue-100">Bring MolView into your space</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsArPreviewActive((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-400/60 bg-blue-500/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-50 transition hover:bg-blue-500/30"
              >
                {isArPreviewActive ? 'Close' : 'Launch'}
              </button>
            </div>
            <p className="text-xs text-blue-100">
              Use your mobile device to project molecules onto your desk for deeper spatial reasoning while you study.
            </p>
            {isArPreviewActive ? <ArMoleculePreview focusTopic={goalTopic || planFocus} /> : null}
          </div>

          <div className="rounded-2xl border border-amber-500/40 bg-amber-900/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
              <Award size={16} />
              Badges
            </div>
            <div className="grid grid-cols-1 gap-2">
              {SRL_BADGES.map((badge) => (
                <div
                  key={badge.id}
                  className={`rounded-lg border px-3 py-2 text-xs transition ${
                    unlockedBadgeIds.includes(badge.id)
                      ? 'border-amber-400 bg-amber-500/20 text-amber-50 shadow-sm'
                      : 'border-amber-500/20 bg-transparent text-amber-200/60'
                  }`}
                >
                  <p className="font-semibold flex items-center gap-1">
                    {badge.label}
                    {unlockedBadgeIds.includes(badge.id) && <Sparkle size={12} className="text-amber-100" />}
                  </p>
                  <p className="mt-1 text-[11px] text-amber-100/80">{badge.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SrlCoach;
