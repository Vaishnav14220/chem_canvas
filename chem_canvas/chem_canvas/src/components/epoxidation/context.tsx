import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type EpoxidationSectionKey = 'theory' | 'simulation' | 'experiment' | 'quiz';

type AcademicLevel = 'masters' | 'graduate' | 'engineering';

type PeracidStrength = 'weak' | 'moderate' | 'strong';

type AtmosphereType = 'air' | 'oxygen' | 'inert';

type OxidantChoice = 'm-CPBA' | 'peracetic acid' | 'DMDO';

type SolventChoice = 'dichloromethane' | 'acetone' | 'toluene';

type SafetyFlag =
  | 'goggles'
  | 'gloves'
  | 'fumeHood'
  | 'quenchPlan'
  | 'wasteSegregation';

export interface ReactionConditions {
  temperatureC: number;
  solvent: SolventChoice;
  oxidant: OxidantChoice;
  atmosphere: AtmosphereType;
}

export interface SimulationState {
  peracidStrength: PeracidStrength;
  solventPolarity: number;
  orbitalFocus: 'pi' | 'pi*';
  temperatureC: number;
  progress: number;
  isRunning: boolean;
  latestInsight?: string;
}

export interface ExperimentState {
  safetyChecklist: Record<SafetyFlag, boolean>;
  submittedMechanism?: string;
  notes: string[];
  readinessScore: number;
}

export interface QuizResults {
  correct: number;
  total: number;
  timestamp: number;
  detail: Array<{ id: string; prompt: string; chosen: number[]; correct: number[]; response?: string }>;
}

export interface JournalEntry {
  id: string;
  timestamp: number;
  scope: EpoxidationSectionKey | 'global';
  summary: string;
}

export interface EpoxidationState {
  academicLevel: AcademicLevel;
  selectedAlkene: string;
  reactionConditions: ReactionConditions;
  simulation: SimulationState;
  experiment: ExperimentState;
  completedSections: EpoxidationSectionKey[];
  journal: JournalEntry[];
  quizResults?: QuizResults;
}

export interface EpoxidationContextValue {
  state: EpoxidationState;
  markSectionComplete: (section: EpoxidationSectionKey, note?: string) => void;
  updateSelectedAlkene: (alkene: string) => void;
  updateReactionConditions: (update: Partial<ReactionConditions>) => void;
  updateSimulation: (update: Partial<SimulationState>, options?: { log?: string; section?: EpoxidationSectionKey }) => void;
  logEvent: (summary: string, scope?: EpoxidationSectionKey | 'global') => void;
  toggleSafetyChecklist: (flag: SafetyFlag) => void;
  appendExperimentNote: (note: string) => void;
  setMechanismSubmission: (submission: string) => void;
  recordQuizResults: (results: QuizResults) => void;
  resetExperience: () => void;
}

const EpoxidationContext = createContext<EpoxidationContextValue | null>(null);

const INITIAL_STATE: EpoxidationState = {
  academicLevel: 'graduate',
  selectedAlkene: 'trans-stilbene',
  reactionConditions: {
    temperatureC: 5,
    solvent: 'dichloromethane',
    oxidant: 'm-CPBA',
    atmosphere: 'air'
  },
  simulation: {
    peracidStrength: 'moderate',
    solventPolarity: 0.55,
    orbitalFocus: 'pi*',
    temperatureC: 5,
    progress: 0,
    isRunning: false
  },
  experiment: {
    safetyChecklist: {
      goggles: true,
      gloves: true,
      fumeHood: true,
      quenchPlan: false,
      wasteSegregation: false
    },
    notes: [],
    readinessScore: 62
  },
  completedSections: [],
  journal: []
};

const dedupeSection = (sections: EpoxidationSectionKey[], next: EpoxidationSectionKey): EpoxidationSectionKey[] => {
  if (sections.includes(next)) {
    return sections;
  }
  return [...sections, next];
};

const EpoxidationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<EpoxidationState>(INITIAL_STATE);

  const logEvent = useCallback((summary: string, scope: EpoxidationSectionKey | 'global' = 'global') => {
    setState(prev => ({
      ...prev,
      journal: [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          timestamp: Date.now(),
          scope,
          summary
        },
        ...prev.journal
      ].slice(0, 25)
    }));
  }, []);

  const markSectionComplete = useCallback((section: EpoxidationSectionKey, note?: string) => {
    setState(prev => ({
      ...prev,
      completedSections: dedupeSection(prev.completedSections, section)
    }));

    if (note) {
      logEvent(note, section);
    } else {
      logEvent(`Marked ${section} section as complete`, section);
    }
  }, [logEvent]);

  const updateSelectedAlkene = useCallback((alkene: string) => {
    setState(prev => ({
      ...prev,
      selectedAlkene: alkene,
      simulation: {
        ...prev.simulation,
        progress: 0,
        isRunning: false,
        latestInsight: undefined
      }
    }));
    logEvent(`Switched substrate to ${alkene}`, 'simulation');
  }, [logEvent]);

  const updateReactionConditions = useCallback((update: Partial<ReactionConditions>) => {
    setState(prev => ({
      ...prev,
      reactionConditions: {
        ...prev.reactionConditions,
        ...update
      }
    }));
    const summaryParts = Object.entries(update).map(([key, value]) => `${key} → ${value}`);
    if (summaryParts.length > 0) {
      logEvent(`Adjusted reaction setup: ${summaryParts.join(', ')}`, 'experiment');
    }
  }, [logEvent]);

  const updateSimulation = useCallback(
    (update: Partial<SimulationState>, options?: { log?: string; section?: EpoxidationSectionKey }) => {
      setState(prev => ({
        ...prev,
        simulation: {
          ...prev.simulation,
          ...update
        }
      }));

      if (options?.log) {
        logEvent(options.log, options.section ?? 'simulation');
      }
    },
    [logEvent]
  );

  const toggleSafetyChecklist = useCallback((flag: SafetyFlag) => {
    setState(prev => {
      const next = !prev.experiment.safetyChecklist[flag];
      const updatedChecklist = {
        ...prev.experiment.safetyChecklist,
        [flag]: next
      };
      const checkedCount = Object.values(updatedChecklist).filter(Boolean).length;
      const readinessScore = Math.min(100, 40 + checkedCount * 12);

      return {
        ...prev,
        experiment: {
          ...prev.experiment,
          safetyChecklist: updatedChecklist,
          readinessScore
        }
      };
    });

    logEvent(`Safety checklist · ${flag} toggled`, 'experiment');
  }, [logEvent]);

  const appendExperimentNote = useCallback((note: string) => {
    const trimmed = note.trim();
    if (!trimmed) {
      return;
    }
    setState(prev => ({
      ...prev,
      experiment: {
        ...prev.experiment,
        notes: [trimmed, ...prev.experiment.notes].slice(0, 12)
      }
    }));
    logEvent(`Experiment note added: ${trimmed.slice(0, 80)}${trimmed.length > 80 ? '…' : ''}`, 'experiment');
  }, [logEvent]);

  const setMechanismSubmission = useCallback((submission: string) => {
    const cleaned = submission.trim();
    setState(prev => ({
      ...prev,
      experiment: {
        ...prev.experiment,
        submittedMechanism: cleaned || undefined
      }
    }));
    if (cleaned) {
      logEvent('Mechanism sketch submitted for evaluation.', 'experiment');
    }
  }, [logEvent]);

  const recordQuizResults = useCallback((results: QuizResults) => {
    setState(prev => ({
      ...prev,
      quizResults: results,
      completedSections: dedupeSection(prev.completedSections, 'quiz')
    }));

    logEvent(`Quiz submitted · ${results.correct}/${results.total} correct`, 'quiz');
  }, [logEvent]);

  const resetExperience = useCallback(() => {
    setState(INITIAL_STATE);
    logEvent('Experience reset to baseline for a fresh run.', 'global');
  }, [logEvent]);

  const value = useMemo<EpoxidationContextValue>(() => ({
    state,
    markSectionComplete,
    updateSelectedAlkene,
    updateReactionConditions,
    updateSimulation,
    logEvent,
    toggleSafetyChecklist,
    appendExperimentNote,
    setMechanismSubmission,
    recordQuizResults,
    resetExperience
  }), [
    state,
    markSectionComplete,
    updateSelectedAlkene,
    updateReactionConditions,
    updateSimulation,
    logEvent,
    toggleSafetyChecklist,
    appendExperimentNote,
    setMechanismSubmission,
    recordQuizResults,
    resetExperience
  ]);

  return <EpoxidationContext.Provider value={value}>{children}</EpoxidationContext.Provider>;
};

export const useEpoxidation = (): EpoxidationContextValue => {
  const context = useContext(EpoxidationContext);
  if (!context) {
    throw new Error('useEpoxidation must be used within an EpoxidationProvider');
  }
  return context;
};

export const EpoxidationContextProvider = EpoxidationProvider;

export const formatTimestamp = (timestamp: number): string => {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'moments ago';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

export const DEFAULT_ALKENES = [
  'trans-stilbene',
  'cis-2-butene',
  'allylic alcohol',
  'cyclooctene (cis)',
  'electron-poor α,β-unsaturated ester'
];

export const SAFETY_FLAGS: SafetyFlag[] = ['goggles', 'gloves', 'fumeHood', 'quenchPlan', 'wasteSegregation'];

export default EpoxidationContext;
