import { generateStreamingContent } from './geminiStreaming';
import { getActiveLearningConfig, getUDLConfig, getSRLConfig } from './learningTheoriesService';

/**
 * Interface for a Science Teacher chat message
 */
export interface ScienceTeacherMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Learning modes for the Science Teacher
 * - standard: Traditional teaching mode - explains concepts directly
 * - feynman: Feynman Technique mode - guides student to explain concepts themselves
 * - universal-design: UDL mode - multiple representations and choice
 * - active-learning: Active Learning mode - scenarios and problem solving
 */
export type LearningMode = 'standard' | 'socratic' | 'feynman' | 'srl' | 'universal-design' | 'active-learning';

/**
 * Standard Science Teacher persona instructions
 */
const STANDARD_MODE_INSTRUCTIONS = `You are a helpful science teacher that explains science concepts to kids and teenagers.

Your role is to:
- Explain concepts clearly and thoroughly
- Use analogies and examples to make complex ideas accessible
- Answer questions patiently and comprehensively
- Encourage curiosity and deeper exploration`;

/**
 * Feynman Technique Mode - Based on Richard Feynman's learning method
 * 
 * The 4 steps:
 * 1. Choose a concept (student picks or AI suggests)
 * 2. Teach/explain it in simple terms (student explains, not AI)
 * 3. Identify knowledge gaps (AI analyzes student's explanation)
 * 4. Simplify and refine (iterate until mastery)
 */
const FEYNMAN_MODE_INSTRUCTIONS = `You are a learning coach running in FEYNMAN MODE.

The Feynman Technique helps achieve deep understanding through explanation practice.
Your job is to GUIDE the student to explain concepts, NOT to explain for them.

## WORKFLOW (follow this sequence):

### PHASE 1 - PRESENT
When introducing a new concept:
- Give a brief 2-3 sentence overview (just enough context)
- Then IMMEDIATELY ask the student to explain it back
- Say something like: "Now, pretend you're teaching this to a younger student. How would you explain [concept]?"

### PHASE 2 - LISTEN & ANALYZE
When the student explains:
- Identify what they understood correctly ✓
- Spot gaps, misconceptions, or vague hand-waving
- Note if they used jargon without true understanding

### PHASE 3 - GUIDE
Provide targeted feedback:
- Acknowledge what was correct first
- Point out 1-2 specific gaps (don't overwhelm)
- Ask Socratic questions to guide them: "You mentioned X, but why does that happen?"
- NEVER just give the full answer - let them discover it

### PHASE 4 - REFINE
After their revised explanation:
- If still gaps: repeat Phase 2-3 with more hints
- If solid: celebrate their mastery and offer to deepen or move on

## RULES:
- Be encouraging and patient, not critical
- Use phrases like "Great start!" and "You're getting there!"
- If stuck after 3 attempts, provide a worked example, then ask them to try again
- Praise effort and improvement, not just correctness
- Keep responses concise - this is a dialogue, not a lecture

## RESPONSE FORMAT:
Always structure your responses as:
1. Brief acknowledgment of their attempt
2. What was correct
3. Guidance question or hint for gaps
4. Prompt for their next explanation

KEEP RESPONSES CONCISE - this is conversation, not lecture.`;

/**
 * Socratic Mode - Guided discovery through questioning
 * Uses a hint ladder from L0-L4 for progressive support
 */
const SOCRATIC_MODE_INSTRUCTIONS = `You are a Socratic tutor guiding learners through questioning.

## CORE PRINCIPLES:
1. **ONE QUESTION AT A TIME**: Never ask multiple questions
2. **GUIDE, DON'T TELL**: Lead them to discover answers
3. **PROGRESSIVE HINTS**: Only escalate when truly stuck

## HINT LADDER:
- L0: Ask clarifying questions ("What do you mean by...?")
- L1: Ask leading questions ("What happens when...?")
- L2: Give small hints ("Consider that X...")
- L3: Provide partial scaffolds
- L4: Full solution (ONLY after 2+ genuine attempts)

## RESPONSE FORMAT:
1. Acknowledge their attempt positively
2. Identify what's correct
3. Ask ONE guiding question or provide ONE hint
4. Wait for their response

## RULES:
- Never give away the answer unless they've genuinely tried 2+ times
- Celebrate small victories
- Phrase gaps as opportunities, not failures
- Keep responses focused and concise`;

/**
 * Self-Regulated Learning Mode - Based on SRL theory (Zimmerman)
 * 
 * Three phases: Planning → Monitoring → Reflection
 */
const SRL_MODE_INSTRUCTIONS = `You are a learning coach running in SELF-REGULATED LEARNING MODE.

Help students develop metacognitive skills through the three SRL phases.

## PHASES:

### PLANNING PHASE (at session start)
Help students set clear goals:
- "What specific topic do you want to master today?"
- "What do you already know about this?"
- "How much time do you have?"
- "What's the best way you learn - examples, visuals, or practice problems?"

### MONITORING PHASE (during learning)
Check in periodically:
- "On a scale of 1-5, how well do you understand this so far?"
- "What parts feel clear? What's still fuzzy?"
- "Should we slow down or can we move on?"
- "What strategy is working best for you right now?"

### REFLECTION PHASE (at session end or milestones)
Encourage reflection:
- "What was the most important thing you learned?"
- "How would you explain this differently now vs. before we started?"
- "What would you do differently next time?"
- "What do you want to explore further?"

## RULES:
- Prompt for self-assessment, don't just provide answers
- Encourage ownership of the learning process
- Help them recognize their own progress
- Build metacognitive awareness`;

/**
 * Get the appropriate system instructions based on learning mode
 */
function getInstructionsForMode(mode: LearningMode, topic: string = 'general science'): string {
    switch (mode) {
        case 'socratic':
            return SOCRATIC_MODE_INSTRUCTIONS;
        case 'feynman':
            return FEYNMAN_MODE_INSTRUCTIONS;
        case 'srl':
            return getSRLConfig(topic).systemInstruction;
        case 'active-learning':
            return getActiveLearningConfig(topic).systemInstruction;
        case 'universal-design':
            return getUDLConfig(topic).systemInstruction;
        case 'standard':
        default:
            return STANDARD_MODE_INSTRUCTIONS;
    }
}

/**
 * Get a friendly name for display
 */
export function getLearningModeName(mode: LearningMode): string {
    switch (mode) {
        case 'socratic':
            return 'Socratic Method';
        case 'feynman':
            return 'Feynman Technique';
        case 'srl':
            return 'Self-Regulated Learning';
        case 'active-learning':
            return 'Active Learning';
        case 'universal-design':
            return 'Universal Design (UDL)';
        case 'standard':
        default:
            return 'Standard Teaching';
    }
}

/**
 * Get a description of the learning mode
 */
export function getLearningModeDescription(mode: LearningMode): string {
    switch (mode) {
        case 'socratic':
            return 'Learn through guided questioning. The AI asks thought-provoking questions to help you discover answers yourself.';
        case 'feynman':
            return 'Learn by explaining concepts in your own words. The AI guides you to discover gaps in understanding.';
        case 'srl':
            return 'Develop metacognitive skills through goal-setting, progress monitoring, and reflection.';
        case 'active-learning':
            return 'Learn by doing! The AI will challenge you with scenarios, problems, and predictions instead of just lecturing.';
        case 'universal-design':
            return 'Inclusive learning that adapts to you. Choose how you want to learn (quiz, visual, application) and get multiple types of explanations.';
        case 'standard':
        default:
            return 'Traditional tutoring where the AI explains concepts and answers your questions.';
    }
}

/**
 * Streams a chat response from the Science Teacher persona.
 * 
 * @param prompt The user's question or message.
 * @param chatHistory Previous conversation messages.
 * @param learningMode The pedagogical mode to use (standard, feynman, srl).
 * @param onChunk Callback for when a new text chunk is received.
 * @param onComplete Callback for when the full response is completed.
 * @param onError Callback for handling errors.
 */
export const streamScienceTeacherChat = async (
    prompt: string,
    chatHistory: ScienceTeacherMessage[],
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: Error) => void,
    learningMode: LearningMode = 'standard',
    topicContext: string = 'this topic'
): Promise<string> => {
    // Get appropriate instructions for the learning mode
    const instructions = getInstructionsForMode(learningMode, topicContext);

    // Construct the full prompt including history and persona instructions
    const historyContext = chatHistory
        .map((msg) => `${msg.role === 'user' ? 'Student' : 'Teacher'}: ${msg.content}`)
        .join('\n');

    // Add mode-specific context hints based on conversation state
    let modeContext = '';
    if (learningMode === 'feynman') {
        const studentMessages = chatHistory.filter(m => m.role === 'user').length;
        if (studentMessages === 0) {
            modeContext = '\n[CONTEXT: This is the start of the session. Introduce the concept briefly, then ask the student to explain it.]';
        } else if (studentMessages < 3) {
            modeContext = '\n[CONTEXT: Analyze the student\'s explanation. Identify gaps and guide with questions.]';
        }
    } else if (learningMode === 'srl') {
        const messageCount = chatHistory.length;
        if (messageCount === 0) {
            modeContext = '\n[CONTEXT: This is the start. Begin with PLANNING phase - help set learning goals.]';
        } else if (messageCount > 10) {
            modeContext = '\n[CONTEXT: Consider prompting for monitoring check-in or reflection.]';
        }
    }

    const fullPrompt = `
${instructions}
${modeContext}

---
PREVIOUS CONVERSATION:
${historyContext}

---
STUDENT'S MESSAGE:
${prompt}
`;

    try {
        // Using gemini-2.0-flash-exp for fast, interactive responses
        return await generateStreamingContent(
            fullPrompt,
            onChunk,
            onComplete,
            onError,
            undefined, // onThought
            'gemini-2.0-flash-exp'
        );
    } catch (error: any) {
        const aiError = new Error(`Science Teacher Service Error: ${error.message}`);
        onError?.(aiError);
        throw aiError;
    }
};

/**
 * Start a new Feynman learning session with an initial concept
 */
export const startFeynmanSession = async (
    concept: string,
    onChunk?: (chunk: string) => void,
    onComplete?: (fullResponse: string) => void,
    onError?: (error: Error) => void
): Promise<string> => {
    const startPrompt = `I want to learn about: ${concept}`;
    return streamScienceTeacherChat(
        startPrompt,
        [],
        onChunk,
        onComplete,
        onError,
        'feynman'
    );
};
