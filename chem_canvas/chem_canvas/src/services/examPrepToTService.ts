import { generateTextContent, extractJsonBlock } from './geminiService';

/**
 * Tree of Thoughts Node interface for study plan generation
 */
export interface TotNode {
    id: string;
    parentId: string | null;
    title: string;
    summary: string;
    pros: string[];
    cons: string[];
    score: number; // 0..10
    status: 'candidate' | 'expanded' | 'rejected' | 'selected';
    nextQuestions: string[];
}

/**
 * Full ToT response for exam prep study planning
 */
export interface ExamPrepToTResponse {
    problem: string;
    criteria: string[];
    tree: TotNode[];
    selectedId: string;
    finalAnswer: string;
}

/**
 * ToT Node with children for tree rendering
 */
export interface TotNodeWithChildren extends TotNode {
    children: TotNodeWithChildren[];
}

/**
 * System prompt for Tree of Thoughts study plan generation
 */
const TOT_SYSTEM_PROMPT = `You are a planning assistant for creating interactive learning experiences.

Think internally, but do NOT reveal private step-by-step reasoning.
Return ONLY valid JSON matching the schema below—no markdown, no extra text, no code fences.

Goal: Generate a tree of candidate teaching approaches, evaluate them, and select the best path.

PRIORITY CRITERIA (weight these heavily in scoring):
1. INTERACTIVE ELEMENTS - Approaches with Canvas simulations, sliders, animations score HIGHER (+3 points)
2. ANIMATED EXAMPLES - Visual animations that show concepts in motion score HIGHER (+2 points)
3. HANDS-ON LEARNING - User can manipulate/explore concepts score HIGHER (+2 points)
4. Static text-only approaches should score LOWER (-2 points)

Schema:
{
  "problem": string,
  "criteria": string[],
  "tree": [
    {
      "id": string,
      "parentId": string | null,
      "title": string,
      "summary": string,
      "pros": string[],
      "cons": string[],
      "score": number,        // 0..10, heavily weight interactivity
      "status": "candidate" | "expanded" | "rejected" | "selected",
      "nextQuestions": string[]
    }
  ],
  "selectedId": string,
  "finalAnswer": string
}

Rules:
- Make 1 root node (parentId=null).
- Create 3–5 first-level candidates as children of root.
- Expand only the top 1–2 candidates (add children, set status="expanded").
- Mark the best leaf node as "selected" - prefer approaches with animations/simulations.
- Mark poor/static-only candidates as "rejected".
- Keep each field short and UI-friendly.
- finalAnswer should recommend the most INTERACTIVE approach with specific simulation ideas.`;

/**
 * Generate a study plan tree using Tree of Thoughts prompting
 */
export async function generateStudyPlanTree(
    topic: string,
    constraints: string[] = [],
    criteria: string[] = [],
    documentContent?: string
): Promise<ExamPrepToTResponse> {
    const constraintsText = constraints.length > 0
        ? constraints.map(c => `- ${c}`).join('\n')
        : '- No specific constraints provided';

    const criteriaText = criteria.length > 0
        ? criteria.map(c => `- ${c}`).join('\n')
        : '- Effective learning\n- Time efficiency\n- Retention';

    const documentContext = documentContent
        ? `\n\nDocument/Notes Content (use this to inform study plan):\n${documentContent.slice(0, 15000)}`
        : '';

    const userPrompt = `Problem:
${topic}${documentContext}

Constraints:
${constraintsText}

Success criteria (how to judge a good solution):
${criteriaText}

Depth: 2
Breadth: 4`;

    const fullPrompt = `${TOT_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

    try {
        const response = await generateTextContent(fullPrompt, {
            maxOutputTokens: 4096,
            model: 'gemini-3-pro-preview',
            thinking: 'high'
        });

        const jsonString = extractJsonBlock(response);
        const parsed: ExamPrepToTResponse = JSON.parse(jsonString);

        // Validate response structure
        if (!parsed.tree || !Array.isArray(parsed.tree) || parsed.tree.length === 0) {
            throw new Error('Invalid ToT response: missing or empty tree');
        }

        return parsed;
    } catch (error) {
        console.error('Failed to generate study plan tree:', error);
        throw new Error(`Study plan generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Expand a specific node in the tree with deeper analysis
 */
export async function expandTreeNode(
    node: TotNode,
    originalProblem: string,
    existingTree: TotNode[]
): Promise<TotNode[]> {
    const contextNodes = existingTree
        .filter(n => n.id === node.parentId || n.parentId === node.parentId)
        .map(n => `- ${n.title}: ${n.summary}`)
        .join('\n');

    const expandPrompt = `${TOT_SYSTEM_PROMPT}

---

You are expanding a specific node in an existing study plan tree.

Original Problem: ${originalProblem}

Current Node to Expand:
- ID: ${node.id}
- Title: ${node.title}
- Summary: ${node.summary}

Sibling Context:
${contextNodes}

Task: Generate 2-4 child nodes for this approach. Each child should be a more specific, actionable sub-strategy. Return ONLY a JSON array of child nodes (not the full response object):

[
  {
    "id": string,
    "parentId": "${node.id}",
    "title": string,
    "summary": string,
    "pros": string[],
    "cons": string[],
    "score": number,
    "status": "candidate" | "selected",
    "nextQuestions": string[]
  }
]`;

    try {
        const response = await generateTextContent(expandPrompt, {
            maxOutputTokens: 2048,
            model: 'gemini-3-pro-preview',
            thinking: 'high'
        });

        const jsonString = extractJsonBlock(response);
        const children: TotNode[] = JSON.parse(jsonString);

        // Validate and ensure parentId is correct
        return children.map((child, idx) => ({
            ...child,
            id: child.id || `${node.id}-${idx + 1}`,
            parentId: node.id
        }));
    } catch (error) {
        console.error('Failed to expand tree node:', error);
        throw new Error(`Node expansion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Build a nested tree structure from flat node array
 */
export function buildTreeFromNodes(nodes: TotNode[]): TotNodeWithChildren[] {
    const nodeMap = new Map<string, TotNodeWithChildren>();

    // Create nodes with empty children arrays
    nodes.forEach(n => nodeMap.set(n.id, { ...n, children: [] }));

    const roots: TotNodeWithChildren[] = [];

    // Build tree structure
    nodeMap.forEach(node => {
        if (!node.parentId) {
            roots.push(node);
        } else {
            const parent = nodeMap.get(node.parentId);
            if (parent) {
                parent.children.push(node);
            }
        }
    });

    return roots;
}

/**
 * Get default constraints based on common exam prep scenarios
 */
export function getDefaultConstraints(topic: string): string[] {
    const lowerTopic = topic.toLowerCase();

    if (lowerTopic.includes('week') || lowerTopic.includes('day')) {
        return ['Time-constrained preparation', 'Focus on high-yield topics'];
    }

    if (lowerTopic.includes('final') || lowerTopic.includes('exam')) {
        return ['Comprehensive coverage needed', 'Balance review and practice'];
    }

    return ['Optimize for retention', 'Practical application focus'];
}

/**
 * Get default criteria based on common exam prep goals
 */
export function getDefaultCriteria(topic: string): string[] {
    return [
        'Interactive Canvas simulations (HIGHEST PRIORITY)',
        'Animated visual examples that show concepts in motion',
        'User-controllable parameters (sliders, buttons)',
        'Step-by-step visual problem solving',
        'Hands-on exploration over passive reading'
    ];
}
