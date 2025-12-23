/**
 * Socratic and Feynman Tutor Service
 * 
 * Implements the tutor contract from localhost:3000/docs specification.
 * Uses gemini-3-flash-preview model for AI responses.
 */

import { generateTextContent, extractJsonBlock, streamTextContent } from './geminiService';
import {
    TutorResponse,
    TutorMode,
    HintLevel,
    GapMapAnalysis,
    GapMapNode,
    TutorSessionState,
    TutorChatMessage,
    Evaluation,
    HINT_LEVEL_LABELS,
    DEFAULT_AUTO_MODE_POLICY,
    AutoModeTrigger,
} from '../types/tutorTypes';

// Model to use for tutor responses
const TUTOR_MODEL = 'gemini-3-flash-preview';

// =============================================================================
// System Prompts
// =============================================================================

/**
 * Socratic Mode System Prompt
 * Implements hint ladder (L0-L4) and one-question-at-a-time pattern
 */
const SOCRATIC_SYSTEM_PROMPT = `You are an expert Socratic tutor. Your role is to guide learners to understanding through carefully crafted questions.

## CORE PRINCIPLES (NON-NEGOTIABLE):
1. **ONE QUESTION AT A TIME**: Never ask multiple questions in a single response
2. **NEVER GIVE AWAY THE ANSWER**: Guide, don't tell (until L4)
3. **HINT LADDER**: Progress through levels only when needed

## HINT LADDER LEVELS:
- **L0 (Clarify)**: Ask the learner to clarify their thinking. "What do you mean by...?"
- **L1 (Leading Question)**: Ask a targeted question that guides toward the answer. "What happens when...?"
- **L2 (Small Hint)**: Give a small nudge. "Consider that X relates to Y..."
- **L3 (Scaffold)**: Provide a partial worked example or framework
- **L4 (Full Solution)**: ONLY provide when:
  - Learner has made 2+ genuine attempts, OR
  - Learner explicitly asks for the answer

## EVALUATION RULES:
- Identify what the learner got correct first
- Spot specific misconceptions (be precise)
- Note missing key ideas
- Never be discouraging - phrase gaps as opportunities

## RESPONSE FORMAT:
You MUST respond with valid JSON matching this schema:
{
  "assistant_message_md": "Your response in markdown",
  "mode": "socratic",
  "next_ui": {
    "expected_input": "free_text",
    "placeholder": "Your answer..."
  },
  "evaluation": {
    "scores": {
      "understanding": 0-100,
      "accuracy": 0-100,
      "completeness": 0-100
    },
    "detected_misconceptions": ["list of specific misconceptions"],
    "missing_key_ideas": ["list of missing concepts"],
    "correct_points": ["what they got right"]
  },
  "tutor_policy": {
    "hint_level": 0-4,
    "should_switch_mode": false,
    "attempt_count": 1
  }
}`;

/**
 * Feynman Mode System Prompt
 * Implements teach-back, gap map, and simple re-explanation
 */
const FEYNMAN_SYSTEM_PROMPT = `You are an expert Feynman Technique tutor. The learner teaches YOU the concept, and you identify gaps.

## CORE PRINCIPLES (NON-NEGOTIABLE):
1. **LEARNER TEACHES FIRST**: Always require them to explain before you help
2. **GAP MAP**: Analyze their explanation for what's missing/wrong
3. **SIMPLE RE-EXPLANATION**: When filling gaps, "explain like I'm 12"
4. **NO JARGON**: Use analogies and everyday language

## SPECIAL HANDLING:

### MATH PROBLEMS - When the topic involves math, equations, or calculations:
- Provide **step-by-step solutions** with clear numbered steps
- Show the formula/equation being used at each step  
- Explain WHY each step is taken, not just WHAT
- Use LaTeX notation for equations: $equation$ or $$equation$$
- Example format:
  
  **Step 1: Identify what we know**
  - Given: x = 5, y = 3
  
  **Step 2: Apply the formula**
  - Using: $z = \\sqrt{x^2 + y^2}$
  - $z = \\sqrt{5^2 + 3^2} = \\sqrt{25 + 9} = \\sqrt{34} \\approx 5.83$
  
  **Answer: z ≈ 5.83**

### DIAGRAM REQUESTS - Draw diagrams when:
- User says "draw", "diagram", "sketch", "visualize", "show me", "illustrate"
- Topic involves circuits, processes, systems, structures, or relationships
- A visual would help understanding (set should_draw_diagram: true)

## WORKFLOW:
### Phase 1: Request Teach-Back
"Great! Now teach me this concept as if I were a younger student who knows nothing about it."

### Phase 2: Analyze & Create Gap Map
Listen to their explanation and identify:
- Concepts they explained correctly
- Concepts they missed entirely
- Concepts they explained incorrectly
- Vague hand-waving vs. true understanding

### Phase 3: Fill Gaps Simply
For each gap, provide a simple, jargon-free explanation using:
- Everyday analogies
- Concrete examples
- "Imagine if..." scenarios
- **For math: step-by-step solutions**
- **For technical topics: suggest clicking "Show Diagram"**

### Phase 4: Request Refined Teaching
"Now, with what we've covered, can you try explaining it again?"

## GAP MAP STRUCTURE:
The gap_map should include:
- Each key concept
- Whether it was understood (true/false)
- Brief reason for the assessment

## RESPONSE FORMAT:
You MUST respond with valid JSON matching this schema:
{
  "assistant_message_md": "Your response in markdown (use LaTeX for math)",
  "mode": "feynman",
  "next_ui": {
    "expected_input": "free_text" | "drawing",
    "placeholder": "Teach me this concept...",
    "drawing_prompt": "Draw a diagram showing..."
  },
  "evaluation": {
    "scores": {
      "understanding": 0-100,
      "accuracy": 0-100,
      "completeness": 0-100,
      "clarity": 0-100
    },
    "detected_misconceptions": [],
    "missing_key_ideas": [],
    "correct_points": []
  },
  "tutor_policy": {
    "hint_level": 0,
    "should_switch_mode": false,
    "should_draw_diagram": false,
    "diagram_topic": ""
  },
  "gap_map": {
    "topic": "The topic being analyzed",
    "explanation_summary": "Summary of what learner said",
    "nodes": [
      {
        "id": "unique-id",
        "concept": "Concept name",
        "understood": true/false,
        "reason": "Why this assessment"
      }
    ],
    "mastery_percentage": 0-100,
    "priority_gaps": ["Most important gaps to address"],
    "next_steps": ["Suggested next actions"]
  }
}`;

// =============================================================================
// Core Service Functions
// =============================================================================

/**
 * Generate a Socratic tutor response
 */
export async function generateSocraticResponse(
    userMessage: string,
    topic: string,
    chatHistory: TutorChatMessage[],
    currentHintLevel: HintLevel = 0,
    attemptCount: number = 0,
    onChunk?: (chunk: string) => void,
    onThought?: (thought: string) => void
): Promise<TutorResponse> {
    const historyContext = formatChatHistory(chatHistory);

    const prompt = `${SOCRATIC_SYSTEM_PROMPT}

## CURRENT CONTEXT:
- Topic: ${topic}
- Current Hint Level: L${currentHintLevel} (${HINT_LEVEL_LABELS[currentHintLevel]})
- Learner Attempts on Current Question: ${attemptCount}

## CONVERSATION HISTORY:
${historyContext}

## LEARNER'S LATEST MESSAGE:
${userMessage}

Respond with valid JSON only. No markdown code blocks around the JSON.`;

    try {
        let fullResponse = '';

        if (onChunk) {
            await streamTextContent(
                prompt,
                (chunk: string) => {
                    fullResponse += chunk;
                    onChunk(chunk);
                },
                {
                    model: TUTOR_MODEL,
                    thinking: 'high',
                    onThought: onThought
                }
            );
        } else {
            fullResponse = await generateTextContent(prompt, { model: TUTOR_MODEL });
        }

        return parseTutorResponse(fullResponse, 'socratic');
    } catch (error) {
        console.error('Error generating Socratic response:', error);
        throw error;
    }
}

/**
 * Generate a Feynman tutor response with gap analysis
 */
export async function generateFeynmanResponse(
    userMessage: string,
    topic: string,
    chatHistory: TutorChatMessage[],
    isTeachBackAttempt: boolean = false,
    onChunk?: (chunk: string) => void,
    onThought?: (thought: string) => void
): Promise<TutorResponse & { gap_map?: GapMapAnalysis }> {
    const historyContext = formatChatHistory(chatHistory);

    const contextNote = isTeachBackAttempt
        ? "The learner is now attempting to teach/explain the concept. Analyze their explanation and create a gap map."
        : "This is ongoing conversation. Guide them or ask for a teach-back if appropriate.";

    const prompt = `${FEYNMAN_SYSTEM_PROMPT}

## CURRENT CONTEXT:
- Topic: ${topic}
- ${contextNote}

## CONVERSATION HISTORY:
${historyContext}

## LEARNER'S LATEST MESSAGE:
${userMessage}

${isTeachBackAttempt ? 'IMPORTANT: Since this is a teach-back attempt, you MUST include a detailed gap_map in your response analyzing their explanation.' : ''}

Respond with valid JSON only. No markdown code blocks around the JSON.`;

    try {
        let fullResponse = '';

        if (onChunk) {
            await streamTextContent(
                prompt,
                (chunk: string) => {
                    fullResponse += chunk;
                    onChunk(chunk);
                },
                {
                    model: TUTOR_MODEL,
                    thinking: 'high',
                    onThought: onThought
                }
            );
        } else {
            fullResponse = await generateTextContent(prompt, { model: TUTOR_MODEL, thinking: 'high' });
        }

        return parseTutorResponse(fullResponse, 'feynman') as TutorResponse & { gap_map?: GapMapAnalysis };
    } catch (error) {
        console.error('Error generating Feynman response:', error);
        throw error;
    }
}

/**
 * Start a new Socratic session with an initial question
 */
export async function startSocraticSession(
    topic: string,
    onChunk?: (chunk: string) => void
): Promise<TutorResponse> {
    const prompt = `${SOCRATIC_SYSTEM_PROMPT}

## TASK:
Start a new Socratic tutoring session on the topic: "${topic}"

Generate an opening question at L0 (clarifying level) to assess what the learner already knows.
Be warm and inviting. The question should be open-ended but focused.

Respond with valid JSON only. No markdown code blocks around the JSON.`;

    try {
        let fullResponse = '';

        if (onChunk) {
            await streamTextContent(
                prompt,
                (chunk: string) => {
                    fullResponse += chunk;
                    onChunk(chunk);
                },
                { model: TUTOR_MODEL, thinking: 'high' }
            );
        } else {
            fullResponse = await generateTextContent(prompt, { model: TUTOR_MODEL, thinking: 'high' });
        }

        return parseTutorResponse(fullResponse, 'socratic');
    } catch (error) {
        console.error('Error starting Socratic session:', error);
        throw error;
    }
}

/**
 * Start a new Feynman session by asking for a teach-back
 */
export async function startFeynmanSession(
    topic: string,
    onChunk?: (chunk: string) => void
): Promise<TutorResponse> {
    const prompt = `${FEYNMAN_SYSTEM_PROMPT}

## TASK:
Start a new Feynman Technique tutoring session on the topic: "${topic}"

1. Briefly introduce the Feynman Technique (1-2 sentences)
2. Ask the learner to teach you this concept as if you were a younger student
3. Be encouraging and set expectations that it's okay not to be perfect

Respond with valid JSON only. No markdown code blocks around the JSON.`;

    try {
        let fullResponse = '';

        if (onChunk) {
            await streamTextContent(
                prompt,
                (chunk: string) => {
                    fullResponse += chunk;
                    onChunk(chunk);
                },
                { model: TUTOR_MODEL, thinking: 'high' }
            );
        } else {
            fullResponse = await generateTextContent(prompt, { model: TUTOR_MODEL, thinking: 'high' });
        }

        return parseTutorResponse(fullResponse, 'feynman');
    } catch (error) {
        console.error('Error starting Feynman session:', error);
        throw error;
    }
}

/**
 * Generate a visual explanation for the canvas
 * The AI creates text content with diagrams/formulas to be drawn on Excalidraw
 */
export async function generateVisualExplanation(
    topic: string,
    currentQuestion: string,
    onChunk?: (chunk: string) => void
): Promise<string> {
    const prompt = `You are creating a VISUAL explanation for a whiteboard canvas.

TOPIC: ${topic}

CONTEXT:
${currentQuestion}

INSTRUCTIONS:
Write a clear, visual explanation for a whiteboard. DO NOT use any markdown formatting.

Use ONLY these formats:
• Use → for arrows
• Use • for bullet points  
• Use ═══ TITLE ═══ for headers
• Use plain numbers (1. 2. 3.) for steps
• Use Δ for delta, α β γ for Greek letters
• Use simple ASCII boxes like [Box Name] or (Circle) for diagrams
• Draw flow diagrams like: [A] → [B] → [C]

IMPORTANT:
- NO asterisks ** or __ for emphasis
- NO # for headers
- NO markdown links
- Just plain clean text that looks good on a whiteboard

Start the explanation now:`;

    try {
        let content = '';

        if (onChunk) {
            await streamTextContent(
                prompt,
                (chunk) => {
                    content += chunk;
                    onChunk(chunk);
                },
                { model: TUTOR_MODEL, thinking: 'high' }
            );
        } else {
            content = await generateTextContent(prompt, { model: TUTOR_MODEL, thinking: 'high' });
        }

        return content;
    } catch (error) {
        console.error('Error generating visual explanation:', error);
        throw error;
    }
}

/**
 * Generate a Mermaid diagram for concept explanation
 * Intelligently chooses diagram type based on topic
 */
export async function generateMermaidDiagram(
    topic: string,
    context?: string
): Promise<string> {
    const prompt = `You are an expert educator creating visual diagrams to explain concepts.

Generate a VALID Mermaid diagram to explain "${topic}".

${context ? `Context from the conversation:\n${context}\n` : ''}

CHOOSE THE BEST DIAGRAM TYPE based on the topic:
- **flowchart TD** - for processes, workflows, algorithms, step-by-step procedures, circuits
- **flowchart LR** - for left-to-right flows, signal paths, pipelines
- **stateDiagram-v2** - for state machines, on/off behaviors, system states
- **graph TD** - for hierarchies, taxonomies, relationships, org charts
- **classDiagram** - for components with properties, structures, objects

IMPORTANT: Use flowchart for circuit diagrams and hardware - it works best!

CRITICAL SYNTAX REQUIREMENTS:
1. Output ONLY valid Mermaid syntax - NO markdown, NO explanation text
2. Keep it simple - max 6-10 nodes
3. Node labels must be SIMPLE TEXT ONLY:
   - NO colons inside brackets
   - NO quotes inside brackets
   - NO special characters like parentheses or ampersands
   - Use hyphens instead of colons
4. Each node ID should be short (A, B, C, etc.)

EXAMPLES:

Flowchart for Process:
flowchart TD
    A[Start] --> B[Step One]
    B --> C{Decision}
    C -->|Yes| D[Action]
    C -->|No| E[Other]
    D --> F[End]

Flowchart LR for Circuit/Signal Flow:
flowchart LR
    A[Input] --> B[Amplifier]
    B --> C[Filter]
    C --> D[Output]

State Diagram:
stateDiagram-v2
    [*] --> Off
    Off --> On
    On --> Off
    On --> Running
    Running --> Off

Class Diagram for Components:
classDiagram
    class OpAmp {
        +gain
        +bandwidth
        +amplify
    }
    class Resistor {
        +resistance
        +power
    }
    OpAmp --> Resistor

Generate the diagram now for "${topic}":`;

    try {
        const content = await generateTextContent(prompt, { model: 'gemini-3-pro-preview' });

        // Extract mermaid syntax from code blocks if present
        const mermaidMatch = content.match(/```(?:mermaid)?\s*([\s\S]*?)```/);
        let mermaidCode = mermaidMatch ? mermaidMatch[1].trim() : content.trim();

        // Convert unsupported diagram types to flowchart
        if (mermaidCode.startsWith('block-beta') || mermaidCode.startsWith('block ')) {
            console.warn('[generateMermaidDiagram] Unsupported block diagram, converting to flowchart');
            mermaidCode = mermaidCode
                .replace(/^block-beta/, 'flowchart TD')
                .replace(/^block\s+/, 'flowchart TD\n')
                .replace(/columns\s+\d+/g, '');
        }

        // Clean up any problematic characters
        const cleanedCode = mermaidCode
            .replace(/：/g, '-')  // Replace full-width colons
            .replace(/"/g, '')   // Remove any quotes in labels
            .replace(/'/g, '');  // Remove any single quotes

        return cleanedCode;
    } catch (error) {
        console.error('Error generating Mermaid diagram:', error);
        throw error;
    }
}

/**
 * Generate structured diagram elements for Excalidraw
 * Returns a JSON array of diagram elements to be drawn as actual shapes
 */
export async function generateDiagramElements(
    topic: string,
    context: string
): Promise<{ elements: any[], text: string }> {
    const prompt = `You are creating a structured diagram for a whiteboard about: ${topic}

CONTEXT:
${context}

Generate a JSON response with TWO parts:
1. "text" - A brief title or explanation (2-3 lines max)
2. "elements" - An array of diagram elements to draw

Element types and required properties:
- Rectangle: { "type": "rectangle", "x": number, "y": number, "width": number, "height": number, "label": "text inside" }
- Ellipse: { "type": "ellipse", "x": number, "y": number, "width": number, "height": number, "label": "text inside" }
- Arrow: { "type": "arrow", "x": number, "y": number, "endX": number, "endY": number }
- Text: { "type": "text", "x": number, "y": number, "text": "the text" }

COORDINATE SYSTEM:
- Canvas is 1200 pixels wide, 800 pixels tall
- Top-left is (0, 0)
- Place all diagram elements in the TOP HALF (y between 50 and 350)
- Spread elements HORIZONTALLY across the full width (x from 50 to 1100)
- Use boxes with width 150-200 and height 60-80
- Leave spacing between elements for arrows

LAYOUT EXAMPLE:
- First row of boxes at y=80
- Second row at y=250
- Connect with arrows between rows

Create a clear, educational diagram with:
- 3-5 main concept boxes (rectangles) spread horizontally
- Arrows showing relationships between concepts
- Clear labels inside boxes

Return ONLY valid JSON:
{
  "text": "Brief title here",
  "elements": [...]
}`;

    try {
        const response = await generateTextContent(prompt, { model: TUTOR_MODEL, thinking: 'high' });

        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            // Convert labels to separate text elements
            const processedElements: any[] = [];

            for (const el of parsed.elements || []) {
                if (el.type === 'rectangle' || el.type === 'ellipse') {
                    processedElements.push({
                        type: el.type,
                        x: el.x,
                        y: el.y,
                        width: el.width || 120,
                        height: el.height || 50
                    });
                    // Add label as text inside
                    if (el.label) {
                        processedElements.push({
                            type: 'text',
                            x: el.x + 10,
                            y: el.y + 15,
                            text: el.label
                        });
                    }
                } else {
                    processedElements.push(el);
                }
            }

            return {
                elements: processedElements,
                text: parsed.text || `Diagram: ${topic}`
            };
        }

        return { elements: [], text: `Could not generate diagram for ${topic}` };
    } catch (error) {
        console.error('Error generating diagram elements:', error);
        return { elements: [], text: 'Error generating diagram' };
    }
}

/**
 * Analyze a drawing/diagram from Excalidraw for Feynman mode
 */
export async function analyzeDrawingForFeynman(
    topic: string,
    drawingDescription: string,
    previousGapMap?: GapMapAnalysis
): Promise<GapMapAnalysis> {
    const gapContext = previousGapMap
        ? `Previous gap analysis found these gaps: ${previousGapMap.priority_gaps.join(', ')}`
        : 'This is the first visual explanation attempt.';

    const prompt = `You are analyzing a learner's visual explanation/diagram for the Feynman Technique.

## CONTEXT:
- Topic: ${topic}
- ${gapContext}

## DRAWING DESCRIPTION:
${drawingDescription}

## TASK:
Analyze what this drawing shows about the learner's understanding.
Identify what concepts they've represented correctly and what's missing.

Respond with a JSON gap map:
{
  "topic": "${topic}",
  "explanation_summary": "Summary of what the drawing shows",
  "nodes": [
    {
      "id": "uuid",
      "concept": "Concept name",
      "understood": true/false,
      "reason": "Assessment reason"
    }
  ],
  "mastery_percentage": 0-100,
  "priority_gaps": ["Gaps shown in drawing"],
  "next_steps": ["What to draw/explain next"]
}

Respond with valid JSON only.`;

    try {
        const response = await generateTextContent(prompt, { model: TUTOR_MODEL, thinking: 'high' });
        const jsonStr = extractJsonBlock(response) || response;
        return JSON.parse(jsonStr) as GapMapAnalysis;
    } catch (error) {
        console.error('Error analyzing drawing:', error);
        throw error;
    }
}

/**
 * Analyze a drawing/diagram from Excalidraw for Socratic mode
 * Uses Gemini Vision to analyze the actual drawing image
 * Returns an evaluation and suggested response based on visual answer
 */
export async function analyzeDrawingForSocratic(
    topic: string,
    currentQuestion: string,
    hintLevel: HintLevel = 0,
    imageBase64?: string
): Promise<TutorResponse> {
    const prompt = `${SOCRATIC_SYSTEM_PROMPT}

## CONTEXT:
- Topic: ${topic}
- Current Hint Level: L${hintLevel} (${HINT_LEVEL_LABELS[hintLevel]})
- The learner has submitted a VISUAL ANSWER (drawing/diagram) instead of text

## CURRENT QUESTION BEING ANSWERED:
${currentQuestion}

## TASK:
Look at the drawing/diagram the learner has submitted and evaluate their visual response. Consider:
1. Does the drawing correctly represent the concept?
2. Are there any missing elements or labels?
3. Are there visual misconceptions in how they've drawn things?
4. Is the representation accurate and complete?

Provide specific feedback on their ACTUAL visual answer (not generic feedback) and ask a follow-up question if needed.

Respond with valid JSON only. No markdown code blocks around the JSON.`;

    try {
        let response = '';

        if (imageBase64) {
            // Use Vision API with the actual image
            await streamTextContent(
                prompt,
                (chunk) => { response += chunk; },
                {
                    model: TUTOR_MODEL,
                    thinking: 'high',
                    inlineData: {
                        mimeType: 'image/png',
                        data: imageBase64
                    }
                }
            );
        } else {
            // Fallback if no image provided
            response = await generateTextContent(prompt, { model: TUTOR_MODEL, thinking: 'high' });
        }

        return parseTutorResponse(response, 'socratic');
    } catch (error) {
        console.error('Error analyzing Socratic drawing:', error);
        throw error;
    }
}

/**
 * Check if mode should be auto-switched based on learner behavior
 */
export function checkAutoModeSwitch(
    evaluation: Evaluation,
    currentMode: TutorMode,
    attemptCount: number
): { shouldSwitch: boolean; suggestedMode?: TutorMode; trigger?: AutoModeTrigger } {
    const policy = DEFAULT_AUTO_MODE_POLICY;

    if (!policy.enabled) {
        return { shouldSwitch: false };
    }

    const { scores, detected_misconceptions, missing_key_ideas } = evaluation;

    // Check for overconfident wrong (high completeness but low accuracy)
    if (scores.completeness > 70 && scores.accuracy < 40 && detected_misconceptions.length > 0) {
        return {
            shouldSwitch: true,
            suggestedMode: policy.trigger_mode_map['overconfident_wrong'],
            trigger: 'overconfident_wrong'
        };
    }

    // Check for correct but shallow (high accuracy but low completeness)
    if (scores.accuracy > 80 && scores.completeness < 50 && missing_key_ideas.length > 2) {
        return {
            shouldSwitch: true,
            suggestedMode: policy.trigger_mode_map['correct_but_shallow'],
            trigger: 'correct_but_shallow'
        };
    }

    // Check for stuckness (multiple attempts, low scores)
    if (attemptCount >= 3 && scores.understanding < 40) {
        return {
            shouldSwitch: true,
            suggestedMode: policy.trigger_mode_map['stuckness_high'],
            trigger: 'stuckness_high'
        };
    }

    // Check for mastery (consistently high scores)
    if (scores.understanding > 90 && scores.accuracy > 90 && scores.completeness > 85) {
        return {
            shouldSwitch: false, // Don't switch, but mark mastery
            trigger: 'mastery_demonstrated'
        };
    }

    return { shouldSwitch: false };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format chat history for prompt context
 */
function formatChatHistory(messages: TutorChatMessage[]): string {
    if (messages.length === 0) {
        return '(No previous conversation)';
    }

    return messages
        .slice(-10) // Only use last 10 messages for context
        .map(msg => {
            const role = msg.role === 'user' ? 'LEARNER' : 'TUTOR';
            return `${role}: ${msg.content}`;
        })
        .join('\n\n');
}

/**
 * Parse and validate tutor response JSON
 */
function parseTutorResponse(responseText: string, expectedMode: TutorMode): TutorResponse {
    try {
        // Try to extract JSON from the response
        let jsonStr = extractJsonBlock(responseText);
        if (!jsonStr) {
            // Try parsing the whole response as JSON
            jsonStr = responseText.trim();
        }

        const parsed = JSON.parse(jsonStr);

        // Ensure required fields with defaults
        const response: TutorResponse = {
            assistant_message_md: parsed.assistant_message_md || parsed.message || 'No response generated.',
            mode: parsed.mode || expectedMode,
            next_ui: parsed.next_ui || {
                expected_input: 'free_text',
                placeholder: 'Type your response...'
            },
            evaluation: parsed.evaluation || {
                scores: { understanding: 50, accuracy: 50, completeness: 50 },
                detected_misconceptions: [],
                missing_key_ideas: [],
                correct_points: []
            },
            tutor_policy: parsed.tutor_policy || {
                hint_level: 0,
                should_switch_mode: false,
                attempt_count: 1
            },
            citations: parsed.citations || []
        };

        // Include gap_map if present (Feynman mode)
        if (parsed.gap_map) {
            (response as any).gap_map = parsed.gap_map;
        }

        return response;
    } catch (error) {
        console.error('Failed to parse tutor response:', error);
        console.error('Raw response:', responseText);

        // Return a fallback response
        return {
            assistant_message_md: responseText || 'I encountered an issue processing your response. Could you try rephrasing?',
            mode: expectedMode,
            next_ui: {
                expected_input: 'free_text',
                placeholder: 'Try again...'
            },
            evaluation: {
                scores: { understanding: 0, accuracy: 0, completeness: 0 },
                detected_misconceptions: [],
                missing_key_ideas: [],
                correct_points: []
            },
            tutor_policy: {
                hint_level: 0,
                should_switch_mode: false
            }
        };
    }
}

/**
 * Create a new empty session state
 */
export function createSessionState(
    topic: string,
    mode: TutorMode = 'socratic'
): TutorSessionState {
    return {
        session_id: `session_${Date.now()}`,
        mode,
        topic,
        attempt_count: 0,
        hint_level: 0,
        accumulated_misconceptions: [],
        mastered_topics: []
    };
}

/**
 * Update session state based on tutor response
 */
export function updateSessionState(
    state: TutorSessionState,
    response: TutorResponse
): TutorSessionState {
    const newState = { ...state };

    // Update hint level
    newState.hint_level = response.tutor_policy.hint_level;

    // Update attempt count
    newState.attempt_count = response.tutor_policy.attempt_count || state.attempt_count + 1;

    // Accumulate misconceptions
    if (response.evaluation.detected_misconceptions.length > 0) {
        const newMisconceptions = response.evaluation.detected_misconceptions.filter(
            m => !state.accumulated_misconceptions.includes(m)
        );
        newState.accumulated_misconceptions = [
            ...state.accumulated_misconceptions,
            ...newMisconceptions
        ];
    }

    // Check for mode switch
    if (response.tutor_policy.should_switch_mode && response.tutor_policy.suggested_mode) {
        newState.mode = response.tutor_policy.suggested_mode;
    }

    // Add gap map if present
    if ((response as any).gap_map) {
        newState.gap_maps = [...(state.gap_maps || []), (response as any).gap_map];
    }

    return newState;
}
