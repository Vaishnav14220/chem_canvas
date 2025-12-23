
import { generateTextContent, extractJsonBlock, streamTextContent } from './geminiService';
import { ImmersiveContent } from './immersiveLearningService';

const safeJsonParse = (json: string, fallback: any) => {
    try {
        return JSON.parse(json);
    } catch (e) {
        console.warn('JSON Parse failed, using fallback', e);
        return fallback;
    }
};

/**
 * Represents a node in the Tree of Thoughts for Immersive Planning
 */
export interface ImmersivePlanNode {
    id: string;
    parentId: string | null;
    approach: string;
    description: string;
    targetAudience: string;
    pros: string[];
    cons: string[];
    score: number;
    status: 'candidate' | 'selected' | 'rejected';
    sections: {
        title: string;
        focus: string;
        widgetType: string;
    }[];
}

export interface ImmersiveToTResponse {
    rootId: string;
    selectedId: string;
    selectedApproach: string;
    tree: ImmersivePlanNode[];
}

const TOT_PLANNING_PROMPT = `You are an architectural planner for advanced educational experiences.
Your goal is to design the perfect structure for an "Immersive Learning" session based on the provided source text.

Target Audience: Analyze and match the academic level of the source text.
Goal: maximize engagement, retention, and interactive learning.

Explore 3 distinct pedagogical approaches (e.g., "Story-Driven", "Concept-First", "Problem-Based", "Visual-Centric").

For EACH approach:
1. Define a clear strategy.
2. Structure the content into 4-6 distinct sections.
3. Assign a specific interactive widget type to each section.
4. Evaluate the approach (pros/cons) and assign a score (0-10) based on:
   - Educational Value
   - Engagement Potential
   - Flow and Logic

Return a JSON object with this schema:
{
  "rootId": "root",
  "selectedId": "id_of_best_node",
  "selectedApproach": "Name of best approach",
  "tree": [
    {
      "id": "node_1",
      "parentId": "root",
      "approach": "Story-Driven Journey",
      "description": "Weaves the concepts into a narrative flow...",
      "targetAudience": "Visual learners who prefer context",
      "pros": ["Highly engaging", "Good for retention"],
      "cons": ["May dilute technical density"],
      "score": 8.5,
      "status": "candidate" | "selected",
      "sections": [
        { "title": "The Spark", "focus": "Introduction to the problem", "widgetType": "reveal" },
        { "title": "The Mechanism", "focus": "Core concept explanation", "widgetType": "simulation" }
      ]
    }
  ]
}
`;

export const generateImmersivePlanTree = async (
    text: string
): Promise<ImmersiveToTResponse> => {
    const prompt = `
${TOT_PLANNING_PROMPT}

SOURCE TEXT TO ANALYZE:
${text.slice(0, 30000)} // Truncate to avoid context limit if excessively large
`;

    try {
        const response = await generateTextContent(prompt, {
            model: 'gemini-3-flash-preview',
            thinking: 'high',
            maxOutputTokens: 8192
        });

        const json = extractJsonBlock(response);
        return JSON.parse(json);
    } catch (error) {
        console.error('ToT Planning failed:', error);
        throw error;
    }
};

/**
 * Generates the final ImmersiveContent JSON using the selected plan.
 * Uses ReAct-style thinking for each section.
 */
export const generateImmersiveContentWithToT = async (
    text: string,
    plan: ImmersivePlanNode,
    onProgress: (message: string) => void,
    onStream: (chunk: string) => void
): Promise<ImmersiveContent> => {

    onProgress(`Initializing generation for approach: ${plan.approach}...`);

    const prompt = `
    You are an expert content creator building an Immersive Learning Guide.
    You MUST follow the APPROVED PLAN below strictly.
    
    APPROVED PLAN (${plan.approach}):
    ${JSON.stringify(plan.sections, null, 2)}

    SOURCE TEXT:
    ${text.slice(0, 50000)}

    INSTRUCTIONS:
    1. Generate the full JSON content for the Immersive Learning session.
    2. Follow the exact section structure defined in the plan.
    3. For EACH section:
       - Write content that strictly matches the academic level and tone of the source text. Each section MUST have a minimum of 4 paragraphs of detailed content.
       - Use bold terms (**term**) and emphasis (*phrase*).
       - Use LaTeX for math ($...$ and $$...$$) - DOUBLE ESCAPE BACKSLASHES (\\\\frac).
       - implement the specific 'widget' type requested in the plan.
    4. Return valid JSON matching the ImmersiveContent interface.
    
    CRITICAL:
    - Escape all quotes in strings.
    - Escape all backslashes in LaTeX equations (e.g. use \\\\alpha not \\alpha).
    - Ensure valid JSON.

    Output format: JSON only.
    `;

    try {
        // We use streaming to show progress, but we need the final full JSON
        const response = await streamTextContent(
            prompt,
            (chunk) => {
                onStream(chunk);
            },
            {
                model: 'gemini-3-flash-preview',
                thinking: 'high',
                timeout: 300000
            }
        );

        const json = extractJsonBlock(response);

        let parsedResult: any;
        try {
            parsedResult = JSON.parse(json);
        } catch (e) {
            console.error('JSON Parse error in ToT Content generation:', e);
            // Try to salvage if it wrapped nicely
            throw new Error('Failed to parse generated content (Invalid JSON)');
        }

        if (!parsedResult || typeof parsedResult !== 'object') {
            throw new Error('Invalid generated content structure');
        }

        // Ensure sections array exists to prevent downstream errors
        if (!Array.isArray(parsedResult.sections)) {
            console.warn('Generated content missing sections array, initializing empty.');
            parsedResult.sections = [];
        }

        // Ensure each section has a unique ID
        parsedResult.sections = parsedResult.sections.map((section: any, idx: number) => ({
            ...section,
            id: section.id || `section_${idx}_${Date.now()}`
        }));

        // Ensure other required arrays exist
        if (!Array.isArray(parsedResult.keyTerms)) {
            parsedResult.keyTerms = [];
        }
        if (!Array.isArray(parsedResult.contextNotes)) {
            parsedResult.contextNotes = [];
        }

        return parsedResult as ImmersiveContent;

    } catch (error) {
        console.error('Immersive Generation failed:', error);
        throw error;
    }
};

export interface ImmersivePlanNodeWithChildren extends ImmersivePlanNode {
    children: ImmersivePlanNodeWithChildren[];
}

export const buildImmersiveTree = (nodes: ImmersivePlanNode[], rootId: string): ImmersivePlanNodeWithChildren | null => {
    const nodeMap = new Map<string, ImmersivePlanNodeWithChildren>();

    // Initialize map with children arrays
    nodes.forEach(node => {
        nodeMap.set(node.id, { ...node, children: [] });
    });

    let root: ImmersivePlanNodeWithChildren | undefined = nodeMap.get(rootId);

    // If root not found in nodes, create a virtual root
    // This handles cases where the AI prompt output implies a root but doesn't list it as a node
    if (!root) {
        root = {
            id: rootId,
            parentId: null,
            approach: 'Pedagogical Options',
            description: 'Select the best teaching strategy below.',
            targetAudience: 'All',
            pros: [],
            cons: [],
            score: 0,
            status: 'candidate',
            sections: [],
            children: []
        };
        nodeMap.set(rootId, root);
    }

    // Build hierarchy
    nodes.forEach(node => {
        if (node.id === rootId) return; // Skip if root is in nodes list (already set)

        const current = nodeMap.get(node.id)!;
        if (node.parentId) {
            const parent = nodeMap.get(node.parentId);
            if (parent) {
                parent.children.push(current);
            }
        }
    });

    return root || null;
};
