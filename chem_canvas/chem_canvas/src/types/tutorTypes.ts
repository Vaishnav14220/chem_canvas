/**
 * Tutor Types for Socratic and Feynman Learning Modes
 * 
 * Based on the Tutor Contract specification from localhost:3000/docs
 * These types define the structured JSON responses from the LLM tutor.
 */

// =============================================================================
// Core Tutor Response Types
// =============================================================================

/**
 * The main tutor response contract - all LLM responses must match this shape
 */
export interface TutorResponse {
    /** Markdown content to display to the learner */
    assistant_message_md: string;

    /** Currently active tutoring mode */
    mode: TutorMode;

    /** UI configuration for next interaction */
    next_ui: NextUIConfig;

    /** Evaluation of the learner's response */
    evaluation: Evaluation;

    /** Tutor's policy decisions */
    tutor_policy: TutorPolicy;

    /** RAG citations if any */
    citations?: Citation[];
}

export type TutorMode = 'socratic' | 'feynman';

// =============================================================================
// UI Configuration Types
// =============================================================================

/**
 * Configuration for the next UI state after a tutor response
 */
export interface NextUIConfig {
    /** What type of input is expected from the learner */
    expected_input: ExpectedInput;

    /** MCQ options if expected_input is 'mcq' */
    mcq_options?: string[];

    /** Drawing prompt if expected_input is 'drawing' */
    drawing_prompt?: string;

    /** Placeholder text for free text input */
    placeholder?: string;
}

export type ExpectedInput = 'free_text' | 'mcq' | 'drawing' | 'none';

// =============================================================================
// Evaluation Types
// =============================================================================

/**
 * Evaluation of the learner's understanding
 */
export interface Evaluation {
    /** Numerical scores for various aspects */
    scores: EvaluationScores;

    /** Misconceptions detected in the learner's response */
    detected_misconceptions: string[];

    /** Key ideas the learner missed or didn't mention */
    missing_key_ideas: string[];

    /** What the learner got correct */
    correct_points?: string[];
}

/**
 * Numerical scores for learner evaluation (0-100)
 */
export interface EvaluationScores {
    /** Overall understanding score */
    understanding: number;

    /** Accuracy of explanation */
    accuracy: number;

    /** Completeness of coverage */
    completeness: number;

    /** Clarity of expression */
    clarity?: number;
}

// =============================================================================
// Tutor Policy Types
// =============================================================================

/**
 * Policy decisions made by the tutor
 */
export interface TutorPolicy {
    /** Current hint level for Socratic mode (0-4) */
    hint_level: HintLevel;

    /** Whether the system should switch modes */
    should_switch_mode: boolean;

    /** Reason for mode switch if applicable */
    switch_reason?: string;

    /** Suggested next mode if switching */
    suggested_mode?: TutorMode;

    /** Number of attempts on current question */
    attempt_count?: number;
}

/**
 * Hint Ladder Levels for Socratic Mode
 * L0: Clarifying question
 * L1: Leading question  
 * L2: Small hint
 * L3: Scaffold/worked example
 * L4: Full solution (only after 2+ attempts or explicit ask)
 */
export type HintLevel = 0 | 1 | 2 | 3 | 4;

export const HINT_LEVEL_LABELS: Record<HintLevel, string> = {
    0: 'Clarify',
    1: 'Leading Question',
    2: 'Small Hint',
    3: 'Scaffold',
    4: 'Full Solution'
};

export const HINT_LEVEL_DESCRIPTIONS: Record<HintLevel, string> = {
    0: 'Asking you to clarify your thinking',
    1: 'Guiding you with a targeted question',
    2: 'Providing a small nudge in the right direction',
    3: 'Showing a partial worked example',
    4: 'Revealing the complete solution'
};

// =============================================================================
// Citation Types
// =============================================================================

/**
 * RAG citation reference
 */
export interface Citation {
    /** Unique identifier for the chunk */
    chunk_id: string;

    /** Source document or URL */
    source: string;

    /** Relevant excerpt */
    excerpt?: string;
}

// =============================================================================
// Gap Map Types (Feynman Mode)
// =============================================================================

/**
 * Node in the Gap Map visualization for Feynman mode
 * Shows what concepts the learner understood vs. missed
 */
export interface GapMapNode {
    /** Unique identifier */
    id: string;

    /** Concept name */
    concept: string;

    /** Whether the learner demonstrated understanding */
    understood: boolean;

    /** Confidence level in the assessment (0-1) */
    confidence?: number;

    /** Brief explanation of why it's marked this way */
    reason?: string;

    /** Child concepts (for hierarchical topics) */
    children?: GapMapNode[];
}

/**
 * Complete Gap Map analysis result
 */
export interface GapMapAnalysis {
    /** Topic being analyzed */
    topic: string;

    /** Summary of the learner's explanation */
    explanation_summary: string;

    /** Root nodes of the gap map tree */
    nodes: GapMapNode[];

    /** Overall mastery percentage */
    mastery_percentage: number;

    /** Key gaps to address */
    priority_gaps: string[];

    /** Suggestions for next steps */
    next_steps: string[];
}

// =============================================================================
// Session State Types
// =============================================================================

/**
 * Current state of the tutoring session
 */
export interface TutorSessionState {
    /** Session ID */
    session_id: string;

    /** Current mode */
    mode: TutorMode;

    /** Topic being learned */
    topic: string;

    /** Current question/prompt being worked on */
    current_question?: string;

    /** Number of attempts on current question */
    attempt_count: number;

    /** Current hint level */
    hint_level: HintLevel;

    /** History of gap maps (Feynman mode) */
    gap_maps?: GapMapAnalysis[];

    /** Accumulated misconceptions */
    accumulated_misconceptions: string[];

    /** Topics mastered */
    mastered_topics: string[];
}

// =============================================================================
// Auto Mode Policy Types
// =============================================================================

/**
 * Signals that can trigger automatic mode switching
 */
export type AutoModeTrigger =
    | 'overconfident_wrong'      // Confident but incorrect -> Socratic
    | 'correct_but_shallow'      // Right answer, poor explanation -> Feynman
    | 'stuckness_high'           // Multiple failed attempts -> Socratic
    | 'mastery_demonstrated'     // Deep understanding shown -> Progress
    | 'user_requested';          // User explicitly asked

/**
 * Auto mode policy configuration
 */
export interface AutoModePolicy {
    /** Identifier for the policy version */
    policy_id: string;

    /** Mapping of triggers to recommended modes */
    trigger_mode_map: Record<AutoModeTrigger, TutorMode>;

    /** Whether auto-switching is enabled */
    enabled: boolean;
}

export const DEFAULT_AUTO_MODE_POLICY: AutoModePolicy = {
    policy_id: 'auto-policy-v1',
    trigger_mode_map: {
        'overconfident_wrong': 'socratic',
        'correct_but_shallow': 'feynman',
        'stuckness_high': 'socratic',
        'mastery_demonstrated': 'feynman',
        'user_requested': 'socratic', // Default, will be overridden
    },
    enabled: true
};

// =============================================================================
// Chat Message Types
// =============================================================================

/**
 * Extended chat message with tutor metadata
 */
export interface TutorChatMessage {
    /** Message role */
    role: 'user' | 'assistant' | 'system';

    /** Message content (markdown) */
    content: string;

    /** Timestamp */
    timestamp: Date;

    /** Parsed tutor response (for assistant messages) */
    tutor_response?: TutorResponse;

    /** Gap map if generated (for Feynman mode) */
    gap_map?: GapMapAnalysis;
}
