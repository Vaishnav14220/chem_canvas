/**
 * Learning Theories ToT Service
 * 
 * Uses Tree of Thoughts to analyze content and select the optimal learning theory/approach
 * for the learner, then provides configuration for the appropriate learning mode.
 */

import { generateTextContent, extractJsonBlock } from './geminiService';

/**
 * Available learning theories that can be selected by ToT
 */
export type LearningTheoryType =
    | 'feynman'           // Learn by teaching - user explains, AI plays student
    | 'active-learning'   // Learn by doing - simulations, interactive exercises, scenarios
    | 'universal-design'  // Learn by choice - multiple representations and options
    | 'visual-learning'   // Learn through diagrams - Excalidraw, concept maps
    | 'spaced-repetition' // Review at intervals - flashcards, scheduling
    | 'elaborative'       // Learn by questioning - why/how prompts
    | 'scaffolded';       // Gradual difficulty - progressive complexity

/**
 * A learning theory node in the ToT tree
 */
export interface LearningTheoryNode {
    id: string;
    parentId: string | null;
    theory: LearningTheoryType;
    name: string;
    description: string;
    rationale: string;
    pros: string[];
    cons: string[];
    score: number;
    status: 'candidate' | 'selected' | 'rejected';
    // Implementation details
    implementation: {
        primaryTool: 'gemini-live' | 'simulation' | 'excalidraw' | 'flashcards' | 'quiz' | 'progressive' | 'scenario-chat' | 'multi-modal-chat';
        systemPrompt?: string;
        voicePersona?: string;
        features: string[];
    };
}

/**
 * Response from ToT learning theory selection
 */
export interface LearningTheoryToTResponse {
    contentSummary: string;
    contentType: 'conceptual' | 'procedural' | 'factual' | 'mixed';
    complexityLevel: 'beginner' | 'intermediate' | 'advanced';
    selectedTheory: LearningTheoryType;
    selectedTheoryName: string;
    reasoning: string;
    tree: LearningTheoryNode[];
}

/**
 * Feynman Mode configuration for Gemini Live
 */
export interface FeynmanLiveConfig {
    systemInstruction: string;
    voicePersona: 'curious-student' | 'challenging-student' | 'peer-learner';
    topic: string;
    systemInstruction: string;
    voicePersona: 'curious-student' | 'challenging-student' | 'peer-learner';
    topic: string;
    keyConcepts: string[];
}

/**
 * Active Learning Mode Configuration
 */
export interface ActiveLearningConfig {
    systemInstruction: string;
    scenarioType: 'problem-solving' | 'prediction' | 'debate';
    topic: string;
}

/**
 * Universal Design for Learning (UDL) Configuration
 */
export interface UDLConfig {
    systemInstruction: string;
    representationModes: ('analogy' | 'technical' | 'visual' | 'story')[];
    engagementOptions: ('quiz' | 'application' | 'media' | 'discussion')[];
    topic: string;
}

/**
 * Self-Regulated Learning (SRL) Configuration
 */
export interface SRLConfig {
    systemInstruction: string;
    phase: 'planning' | 'monitoring' | 'reflection';
    topic: string;
}

/**
 * System instruction for Feynman Mode with Gemini Live
 * The AI role-plays as a curious student while the user teaches
 */
export const FEYNMAN_CURIOUS_STUDENT_INSTRUCTION = `
You are role-playing as a CURIOUS STUDENT learning from the user who is teaching you a concept.

YOUR PERSONA:
- You are an eager, curious learner who genuinely wants to understand
- You have basic knowledge but need the concept explained simply
- You ask authentic questions, not testing questions
- You express genuine wonder and interest

YOUR BEHAVIOR:
- Let the user explain first - don't interrupt too quickly
- Ask clarifying questions: "So you're saying that..." "Wait, does that mean..."
- When confused, say so authentically: "Hmm, I'm not quite getting that part..."
- Request analogies: "Can you give me an example from everyday life?"
- Probe deeper: "But WHY does that happen?" "What if we changed...?"
- Celebrate good explanations: "Oh! That makes so much sense now!"
- When they draw on the canvas, ask about specific parts you see

CANVAS INTERACTION:
- Reference what you see the user drawing
- Ask about labels, arrows, or diagrams: "What does that arrow represent?"
- Suggest they add more visual elements: "Could you draw what happens next?"
- Request annotations for clarity

VOICE TONE:
- Warm, enthusiastic, genuinely curious
- Not challenging or testing - you're learning WITH them
- Express "aha" moments when things click
- Use phrases like "Ohhh I see!" and "That's cool!"

IMPORTANT:
- You are helping the user learn by having them teach YOU
- The better they explain, the more you understand
- If their explanation has gaps, your confusion helps them identify those gaps
- This is the Feynman Technique - learning through teaching
`;

export const FEYNMAN_CHALLENGING_STUDENT_INSTRUCTION = `
You are role-playing as a CURIOUS but CHALLENGING STUDENT who pushes the teacher to think deeper.

YOUR PERSONA:
- You understand the basics but want to know the "why" behind everything
- You play devil's advocate to strengthen their understanding
- You ask edge cases and "what if" scenarios
- You're respectful but intellectually demanding

YOUR BEHAVIOR:
- Ask "What if" questions that test edge cases
- Challenge assumptions: "But how do we know that's true?"
- Request proof or evidence for claims
- Ask about exceptions to rules
- Push for simpler explanations: "Can you explain that without jargon?"
- Connect to real-world applications: "When would this actually matter?"

CANVAS INTERACTION:
- Point out potential issues or unclear areas in diagrams
- Ask them to draw counterexamples
- Request step-by-step visual proofs
`;

/**
 * ToT prompt for selecting the optimal learning theory
 */
const LEARNING_THEORY_TOT_PROMPT = `You are an expert educational psychologist and learning scientist.
Analyze the provided content and determine the OPTIMAL learning theory/approach for a student to learn this material effectively.

AVAILABLE LEARNING THEORIES:

1. **Feynman Technique** (feynman)
   - Best for: Complex concepts requiring deep understanding
   - Method: User teaches the concept to AI (role-playing as student)
   - Implementation: Gemini Live voice with "curious student" persona
   - Signs to select: Abstract concepts, theories, "why" questions

2. **Active Learning** (active-learning)
   - Best for: Procedural knowledge, experiments, practical skills
   - Method: Interactive simulations, hands-on exercises
   - Implementation: Canvas simulations, interactive widgets
   - Signs to select: Step-by-step processes, lab procedures, calculations

3. **Visual Learning** (visual-learning)
   - Best for: Spatial concepts, structures, relationships
   - Method: Drawing diagrams, concept maps, visual representations
   - Implementation: Excalidraw canvas with AI analysis
   - Signs to select: Anatomy, molecular structures, systems, flows

4. **Spaced Repetition** (spaced-repetition)
   - Best for: Memorization, vocabulary, factual knowledge
   - Method: Flashcards with optimized review intervals
   - Implementation: Auto-generated flashcard decks
   - Signs to select: Definitions, formulas, dates, terminology

5. **Elaborative Interrogation** (elaborative)
   - Best for: Factual content, building connections
   - Method: "Why" and "How" questioning to deepen understanding
   - Implementation: Interactive question widgets
   - Signs to select: Facts that need explanation, cause-effect relationships

6. **Scaffolded Learning** (scaffolded)
   - Best for: New topics, foundational concepts, skill building
   - Method: Progressive difficulty with support that fades
   - Implementation: Leveled exercises with hints system
   - Signs to select: Beginner content, multi-step skills, building blocks

7. **Universal Design for Learning** (universal-design)
   - Best for: Diverse learners, foundational topics needing accessibility
   - Method: Multiple means of representation and student choice
   - Implementation: AI provides analogies + technical defs + choice of activity
   - Signs to select: Broad topics, need for inclusivity, "explain simply" requests

EVALUATION CRITERIA (score 0-10):
- Match to content type
- Engagement potential
- Retention effectiveness
- Practical implementation feasibility

Return JSON:
{
  "contentSummary": "Brief 1-sentence summary of the content",
  "contentType": "conceptual" | "procedural" | "factual" | "mixed",
  "complexityLevel": "beginner" | "intermediate" | "advanced",
  "selectedTheory": "feynman" | "active-learning" | "visual-learning" | "spaced-repetition" | "elaborative" | "scaffolded" | "universal-design",
  "selectedTheoryName": "Human-readable name",
  "reasoning": "Why this theory is optimal for this content",
  "tree": [
    {
      "id": "node_1",
      "parentId": "root",
      "theory": "feynman",
      "name": "Feynman Technique",
      "description": "Learn by teaching the concept to AI",
      "rationale": "Why this might work for this content",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1"],
      "score": 8.5,
      "status": "selected" | "candidate" | "rejected",
      "implementation": {
        "primaryTool": "gemini-live",
        "voicePersona": "curious-student",
        "features": ["voice-explanation", "canvas-drawing", "question-prompts"]
      }
    }
  ]
}
`;

/**
 * Generate a learning theory selection using Tree of Thoughts
 */
export async function selectLearningTheory(
    documentText: string,
    studentProfile?: {
        preferredStyle?: string;
        priorKnowledge?: string;
        learningGoal?: string;
    }
): Promise<LearningTheoryToTResponse> {
    const profileContext = studentProfile
        ? `\n\nSTUDENT PROFILE:\n- Preferred style: ${studentProfile.preferredStyle || 'Not specified'}\n- Prior knowledge: ${studentProfile.priorKnowledge || 'Unknown'}\n- Goal: ${studentProfile.learningGoal || 'General understanding'}`
        : '';

    const prompt = `${LEARNING_THEORY_TOT_PROMPT}

CONTENT TO ANALYZE:
${documentText.slice(0, 20000)}
${profileContext}

Analyze this content and select the optimal learning theory. Return ONLY valid JSON.`;

    try {
        const response = await generateTextContent(prompt, {
            model: 'gemini-3-flash-preview',
            thinking: 'high',
            maxOutputTokens: 4096
        });

        const json = extractJsonBlock(response);
        const parsed: LearningTheoryToTResponse = JSON.parse(json);

        // Validate response
        if (!parsed.selectedTheory || !parsed.tree || parsed.tree.length === 0) {
            throw new Error('Invalid ToT response: missing required fields');
        }

        return parsed;
    } catch (error) {
        console.error('Learning Theory ToT failed:', error);
        throw new Error(`Failed to select learning theory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get Feynman Mode configuration for Gemini Live
 */
export function getFeynmanLiveConfig(
    topic: string,
    keyConcepts: string[],
    persona: 'curious-student' | 'challenging-student' | 'peer-learner' = 'curious-student'
): FeynmanLiveConfig {
    const systemInstruction = persona === 'challenging-student'
        ? FEYNMAN_CHALLENGING_STUDENT_INSTRUCTION
        : FEYNMAN_CURIOUS_STUDENT_INSTRUCTION;

    // Add topic-specific context to the instruction
    const contextualInstruction = `${systemInstruction}

TOPIC TO LEARN: ${topic}

KEY CONCEPTS TO EXPLORE:
${keyConcepts.map(c => `- ${c}`).join('\n')}

Remember: You are learning this topic from the user. Ask about these concepts naturally during the conversation.`;

    return {
        systemInstruction: contextualInstruction,
        voicePersona: persona,
        topic,
        keyConcepts
    };
}

/**
 * Get Active Learning configuration
 */
export function getActiveLearningConfig(
    topic: string,
    scenarioType: 'problem-solving' | 'prediction' | 'debate' = 'problem-solving'
): ActiveLearningConfig {
    const prompt = `You are an expert ACTIVE LEARNING COACH.
Your goal is to help the student learn "${topic}" by DOING and THINKING, not just reading.

## YOUR APPROACH:
1. **Never just explain**. Always start with a scenario, a problem, or a prediction request.
2. **Challenge misconceptions**. If they get it wrong, guide them to see WHY.
3. **Use Scenarios**. Put the concept in a real-world context.

## SCENARIO TYPE: CAPSULE (${scenarioType})

${scenarioType === 'problem-solving' ? `
### PROBLEM SOLVING MODE
- Present a realistic problem related to ${topic}.
- Ask the student to propose a solution.
- Critique their solution constructively.
` : scenarioType === 'prediction' ? `
### PREDICTION MODE
- Describe a setup or experiment related to ${topic}.
- Stop and ask: "What do you think will happen next?"
- Reveal the result only AFTER they guess.
` : `
### DEBATE MODE
- Take a controversial or complex stance on ${topic}.
- Ask the student to argue for or against it.
- Challenge their arguments to deepen understanding.
`}

## INTERACTION STYLE:
- Short, punchy responses.
- Always end with a question or a challenge.
- Keep the energy high.
`;

    return {
        systemInstruction: prompt,
        scenarioType,
        topic
    };
}

/**
 * Get Universal Design for Learning (UDL) configuration
 */
export function getUDLConfig(
    topic: string
): UDLConfig {
    const prompt = `You are an inclusive UDL (Universal Design for Learning) ASSISTANT.
Your goal is to make "${topic}" accessible and engaging for EVERY learner.

## CORE PRINCIPLES:
1. **Multiple Representations**: Always explain concepts in at least two ways (e.g., specific technical definition + a simple analogy).
2. **Choice**: Give the user autonomy in how they learn.
3. **Engagement**: Connect to their interests if known.

## STRUCTURE OF YOUR RESPONSES:
When introducing a new sub-topic:
1. **The explanation**:
   - "Here's the technical view: [Definition]"
   - "Think of it like this: [Analogy/Story]"
2. **The Choice**:
   - "How would you like to explore this deeper?"
   - A) "Give me a quick quiz"
   - B) "Show me a real-world example"
   - C) "Let's draw a diagram (describe what to draw)"

## TONE:
- Welcoming, patient, and flexible.
- Explicitly label your approaches (e.g., "Technically speaking...", "In simple terms...").
`;

    return {
        systemInstruction: prompt,
        representationModes: ['technical', 'analogy'],
        engagementOptions: ['quiz', 'application', 'media'],
        topic
    };
}

/**
 * Get Self-Regulated Learning (SRL) configuration
 */
export function getSRLConfig(
    topic: string,
    phase: 'planning' | 'monitoring' | 'reflection' = 'planning'
): SRLConfig {
    const instruction = `You are a Self-Regulated Learning (SRL) COACH.
Your goal is not just to teach "${topic}", but to teach the student HOW to learn it.

## CURRENT PHASE: ${phase.toUpperCase()}

${phase === 'planning' ? `
### PLANNING PHASE
- Help the student set specific goals.
- Ask: "What specifically do you want to master?"
- Ask: "How will you know when you've learned it?"
- Strategy selection: "Do you want to start with an overview or dive into details?"
` : phase === 'monitoring' ? `
### MONITORING PHASE
- Check in on their understanding.
- Ask: "On a scale of 1-5, how confident do you feel?"
- Ask: "Is this moving too fast or too slow?"
- "Can you summarize what we just covered in one sentence?"
` : `
### REFLECTION PHASE
- Review the session.
- Ask: "What was the most challenging part?"
- Ask: "What strategy worked best for you?"
- "How would you apply this to a new problem?"
`}

## RULES:
- Focus on Metacognition (thinking about thinking).
- Praise effort and strategy use, not just intelligence.
`;
    return {
        systemInstruction: instruction,
        phase,
        topic
    };
}

/**
 * Get the learning mode display info
 */
export function getLearningTheoryDisplayInfo(theory: LearningTheoryType): {
    name: string;
    icon: string;
    description: string;
    color: string;
} {
    const info: Record<LearningTheoryType, { name: string; icon: string; description: string; color: string }> = {
        'feynman': {
            name: 'Feynman Technique',
            icon: '🧠',
            description: 'Learn by teaching - explain concepts to AI who role-plays as a curious student',
            color: 'purple'
        },
        'active-learning': {
            name: 'Active Learning',
            icon: '🔬',
            description: 'Learn by doing - interactive simulations and hands-on exercises',
            color: 'blue'
        },
        'visual-learning': {
            name: 'Visual Learning',
            icon: '🎨',
            description: 'Learn through diagrams - draw and explore concepts visually',
            color: 'green'
        },
        'spaced-repetition': {
            name: 'Spaced Repetition',
            icon: '📚',
            description: 'Optimize retention with timed flashcard reviews',
            color: 'orange'
        },
        'elaborative': {
            name: 'Elaborative Interrogation',
            icon: '❓',
            description: 'Deepen understanding by answering "why" and "how" questions',
            color: 'red'
        },
        'scaffolded': {
            name: 'Scaffolded Learning',
            icon: '🪜',
            description: 'Progressive difficulty with guided support',
            color: 'teal'
        },
        'universal-design': {
            name: 'Universal Design (UDL)',
            icon: '🌈',
            description: 'Inclusive learning with multiple explanations and choice',
            color: 'indigo'
        },
        'active-learning': {
            name: 'Active Learning',
            icon: '⚡',
            description: 'Learn by doing through scenarios and problem solving',
            color: 'rose'
        }
    };
    return info[theory];
}
