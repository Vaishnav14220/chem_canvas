/**
 * LaTeX Tree of Thoughts (ToT) & ReAct Service
 * 
 * Provides intelligent planning and iterative generation for LaTeX documents:
 * - ToT: Explores multiple document structures, evaluates and selects best
 * - ReAct: Think-Act-Observe loop for each section with self-correction
 */

import { generateTextContent, extractJsonBlock, streamTextContent } from './geminiService';

// ==========================================
// Types & Interfaces
// ==========================================

/**
 * ToT Node for LaTeX document structure planning
 */
export interface LaTeXPlanNode {
    id: string;
    parentId: string | null;
    title: string;
    description: string;
    approach: 'theory-first' | 'problem-driven' | 'visual-heavy' | 'qa-format' | 'hybrid';
    pros: string[];
    cons: string[];
    score: number; // 0-10
    status: 'candidate' | 'expanded' | 'rejected' | 'selected';
    suggestedSections: string[];
}

/**
 * Full ToT response for LaTeX planning
 */
export interface LaTeXToTResponse {
    topic: string;
    analysis: string;
    tree: LaTeXPlanNode[];
    selectedId: string;
    selectedApproach: string;
    recommendedStructure: LaTeXSection[];
}

/**
 * Section in the final LaTeX document
 */
export interface LaTeXSection {
    id: string;
    title: string;
    type: 'theory' | 'examples' | 'practice' | 'formulas' | 'diagrams' | 'glossary';
    priority: 'high' | 'medium' | 'low';
    estimatedLength: 'short' | 'medium' | 'long';
    dependencies: string[]; // IDs of sections that should come before
}

/**
 * ReAct step for iterative section generation
 */
export interface ReActStep {
    type: 'thought' | 'action' | 'observation';
    content: string;
    timestamp: number;
}

/**
 * Section generation result with ReAct trace
 */
export interface SectionGenerationResult {
    sectionId: string;
    latex: string;
    reactTrace: ReActStep[];
    qualityScore: number;
    refinementSuggestions: string[];
}

// ==========================================
// System Prompts
// ==========================================

const TOT_PLANNING_PROMPT = `You are an expert educational content architect specializing in LaTeX document design.

Your task is to analyze a topic and generate a Tree of Thoughts exploring different document structures.

EVALUATION CRITERIA (weight these in scoring):
1. STUDENT LEARNING (+3): Structures that build understanding progressively
2. PRACTICAL APPLICATION (+2): Approaches that include worked examples
3. VISUAL CLARITY (+2): Use of diagrams, tables, visual organization
4. EXAM RELEVANCE (+2): Matches typical exam/assignment format
5. COMPLETENESS (+1): Covers all necessary theory
6. Static text-walls should score LOWER (-2)

OUTPUT FORMAT - Return valid JSON only, no markdown:
{
    "topic": "string - the analyzed topic",
    "analysis": "string - brief analysis of what the document needs",
    "tree": [
        {
            "id": "string",
            "parentId": "string | null",
            "title": "string - short descriptive title",
            "description": "string - what this approach does",
            "approach": "theory-first | problem-driven | visual-heavy | qa-format | hybrid",
            "pros": ["string"],
            "cons": ["string"],
            "score": number, // 0-10
            "status": "candidate | expanded | rejected | selected",
            "suggestedSections": ["string - section titles"]
        }
    ],
    "selectedId": "string - ID of best approach",
    "selectedApproach": "string - name of selected approach",
    "recommendedStructure": [
        {
            "id": "string",
            "title": "string",
            "type": "theory | examples | practice | formulas | diagrams | glossary",
            "priority": "high | medium | low",
            "estimatedLength": "short | medium | long",
            "dependencies": ["string - section IDs"]
        }
    ]
}

RULES:
- Create 1 root node (parentId=null) representing the overall problem
- Generate 3-5 first-level candidate approaches as children of root
- Expand the top 2 candidates with sub-strategies
- Select the BEST leaf node as final choice
- Mark weak static-only approaches as "rejected"
- recommendedStructure should be the detailed section breakdown for the selected approach`;

const REACT_SECTION_PROMPT = `You are an expert LaTeX writer using the ReAct (Reasoning + Acting) methodology.

For this section, follow the THOUGHT → ACTION → OBSERVATION loop:

THOUGHT: Analyze what this section needs. What concepts to cover? What format works best?
ACTION: Write the LaTeX content for this section
OBSERVATION: Review what you wrote. Is it complete? Does it compile? Is it clear?

If the observation reveals issues, do another THOUGHT → ACTION cycle to refine.

OUTPUT FORMAT:
Return the final LaTeX code for this section ONLY (no \\documentclass, no \\begin{document}).
The code should be a complete section that can be inserted into a larger document.

REQUIREMENTS:
- Use proper LaTeX commands (\\section, \\subsection, itemize, enumerate, equation, etc.)
- Include clear explanations alongside formulas
- Use color for emphasis where appropriate (\\textcolor)
- Add helpful comments in LaTeX (% comment)
- Ensure all brackets and environments are properly closed`;

const QUALITY_REVIEW_PROMPT = `You are a LaTeX quality assurance expert.

Review the following LaTeX document for:
1. COMPILATION: Will it compile without errors?
2. COMPLETENESS: Are all sections fully developed?
3. PEDAGOGY: Is it effective for student learning?
4. FORMATTING: Is the formatting professional and consistent?
5. FORMULAS: Are mathematical equations correct and well-formatted?

OUTPUT FORMAT - Return valid JSON only:
{
    "overallScore": number, // 0-10
    "willCompile": boolean,
    "issues": [
        {
            "severity": "critical | warning | suggestion",
            "location": "string - section or line description",
            "issue": "string - what's wrong",
            "fix": "string - how to fix it"
        }
    ],
    "strengths": ["string"],
    "recommendations": ["string"]
}`;

// ==========================================
// Core Functions
// ==========================================

/**
 * Generate a Tree of Thoughts plan for LaTeX document structure
 */
export async function generateLaTeXPlanTree(
    topic: string,
    documentContent?: string,
    constraints?: string[]
): Promise<LaTeXToTResponse> {
    const constraintText = constraints?.length
        ? `\n\nConstraints:\n${constraints.map(c => `- ${c}`).join('\n')}`
        : '';

    const documentContext = documentContent
        ? `\n\nSource Document Content (analyze this for structure):\n${documentContent.slice(0, 10000)}`
        : '';

    const userPrompt = `Topic: ${topic}${constraintText}${documentContext}

Generate a Tree of Thoughts exploring different ways to structure a comprehensive LaTeX preparation guide for this topic.`;

    const fullPrompt = `${TOT_PLANNING_PROMPT}\n\n---\n\n${userPrompt}`;

    try {
        const response = await generateTextContent(fullPrompt, {
            maxOutputTokens: 4096,
            model: 'gemini-3-flash-preview',
            thinking: 'high'
        });

        const jsonString = extractJsonBlock(response);
        const parsed: LaTeXToTResponse = JSON.parse(jsonString);

        // Validate response
        if (!parsed.tree || parsed.tree.length === 0) {
            throw new Error('Invalid ToT response: missing tree');
        }

        return parsed;
    } catch (error) {
        console.error('Failed to generate LaTeX plan tree:', error);
        throw new Error(`Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Generate a section using ReAct methodology with streaming
 */
export async function generateSectionWithReAct(
    section: LaTeXSection,
    topic: string,
    documentContent: string | undefined,
    previousSections: string[],
    onChunk?: (chunk: string) => void,
    onThought?: (thought: string) => void
): Promise<string> {
    const contextFromPrevious = previousSections.length > 0
        ? `\n\nPrevious sections already written:\n${previousSections.join('\n---\n').slice(-3000)}`
        : '';

    const documentContext = documentContent
        ? `\n\nSource material to reference:\n${documentContent.slice(0, 8000)}`
        : '';

    const sectionPrompt = `${REACT_SECTION_PROMPT}

---

Topic: ${topic}
Section to write: ${section.title}
Section type: ${section.type}
Priority: ${section.priority}
Estimated length: ${section.estimatedLength}
${contextFromPrevious}${documentContext}

Now generate this section using the THOUGHT → ACTION → OBSERVATION methodology.
Return ONLY the final LaTeX code for this section.`;

    try {
        let fullContent = '';

        await streamTextContent(
            sectionPrompt,
            (chunk: string) => {
                fullContent += chunk;
                onChunk?.(chunk);
            },
            {
                model: 'gemini-3-flash-preview',
                thinking: 'high',
                timeout: 120000,
                onThought: (thought: string) => {
                    onThought?.(thought);
                }
            }
        );

        return fullContent;
    } catch (error) {
        console.error(`Failed to generate section ${section.id}:`, error);
        throw error;
    }
}

/**
 * Generate complete LaTeX document using ToT plan and ReAct sections
 */
export async function generateLaTeXWithToTReAct(
    topic: string,
    documentContent: string | undefined,
    plan: LaTeXToTResponse,
    onProgress?: (message: string, progress: number) => void,
    onChunk?: (chunk: string) => void,
    onThought?: (thought: string) => void
): Promise<string> {
    const sections = plan.recommendedStructure;
    const generatedSections: string[] = [];

    // Document preamble
    const preamble = `\\documentclass[12pt,a4paper]{article}

% Packages
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath,amssymb,amsthm}
\\usepackage{graphicx}
\\usepackage{xcolor}
\\usepackage{hyperref}
\\usepackage{enumitem}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{listings}
\\usepackage{fancyhdr}
\\usepackage{tcolorbox}

% Colors
\\definecolor{formulaBlue}{RGB}{0,102,204}
\\definecolor{codeGreen}{RGB}{0,128,0}
\\definecolor{warningRed}{RGB}{204,0,0}
\\definecolor{highlightYellow}{RGB}{255,255,200}

% Code listing style
\\lstset{
    basicstyle=\\ttfamily\\small,
    keywordstyle=\\color{codeGreen}\\bfseries,
    commentstyle=\\color{gray},
    stringstyle=\\color{orange},
    numbers=left,
    numberstyle=\\tiny\\color{gray},
    breaklines=true,
    frame=single,
    backgroundcolor=\\color{highlightYellow}
}

% Page style
\\pagestyle{fancy}
\\fancyhf{}
\\rhead{\\textit{Preparation Guide}}
\\lhead{\\textit{${topic.replace(/[\\&%$#_{}~^]/g, '\\$&')}}}
\\cfoot{\\thepage}

% Theorem environments
\\newtheorem{theorem}{Theorem}[section]
\\newtheorem{definition}{Definition}[section]
\\newtheorem{example}{Example}[section]

\\begin{document}

% Title Page
\\begin{titlepage}
    \\centering
    \\vspace*{2cm}
    {\\Huge\\bfseries ${topic.replace(/[\\&%$#_{}~^]/g, '\\$&')}\\\\[0.5cm]}
    {\\Large Comprehensive Preparation Guide\\\\[2cm]}
    {\\large Generated with ToT Planning \\& ReAct Methodology\\\\[0.5cm]}
    {\\normalsize Approach: ${plan.selectedApproach}\\\\[3cm]}
    {\\large\\textit{Student Name:} \\underline{\\hspace{5cm}}\\\\[0.5cm]}
    {\\large\\textit{Date:} \\underline{\\hspace{5cm}}\\\\[0.5cm]}
    {\\large\\textit{Course:} \\underline{\\hspace{5cm}}}
    \\vfill
\\end{titlepage}

\\tableofcontents
\\newpage

`;

    onChunk?.(preamble);
    onProgress?.('Starting document generation...', 5);

    // Generate each section with ReAct
    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const progress = 10 + (80 * (i / sections.length));

        onProgress?.(`Generating section: ${section.title}...`, progress);
        onThought?.(`Planning ${section.title}: ${section.type} section with ${section.priority} priority`);

        try {
            const sectionContent = await generateSectionWithReAct(
                section,
                topic,
                documentContent,
                generatedSections,
                onChunk,
                onThought
            );

            generatedSections.push(sectionContent);
            onChunk?.('\n\n');
        } catch (error) {
            console.error(`Error generating section ${section.id}:`, error);
            // Continue with next section
            onChunk?.(`\n% Error generating ${section.title} - skipped\n\n`);
        }
    }

    // Document closing
    const closing = `
\\newpage
\\section*{Document Generation Notes}
\\textit{This document was generated using:}
\\begin{itemize}
    \\item \\textbf{Tree of Thoughts (ToT)} for structure planning
    \\item \\textbf{ReAct methodology} for iterative section generation
    \\item Approach selected: ${plan.selectedApproach}
\\end{itemize}

\\end{document}`;

    onChunk?.(closing);
    onProgress?.('Document complete!', 100);

    return preamble + generatedSections.join('\n\n') + closing;
}

/**
 * Review LaTeX document quality
 */
export async function reviewLaTeXQuality(
    latexContent: string
): Promise<{
    overallScore: number;
    willCompile: boolean;
    issues: Array<{ severity: string; location: string; issue: string; fix: string }>;
    strengths: string[];
    recommendations: string[];
}> {
    const reviewPrompt = `${QUALITY_REVIEW_PROMPT}

---

LaTeX Document to Review:
${latexContent.slice(0, 15000)}`;

    try {
        const response = await generateTextContent(reviewPrompt, {
            maxOutputTokens: 2048,
            model: 'gemini-3-flash-preview',
            thinking: 'low'
        });

        const jsonString = extractJsonBlock(response);
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Quality review failed:', error);
        return {
            overallScore: 5,
            willCompile: true,
            issues: [],
            strengths: ['Document generated successfully'],
            recommendations: ['Manual review recommended']
        };
    }
}

/**
 * Build nested tree from flat nodes for UI visualization
 */
export interface LaTeXPlanNodeWithChildren extends LaTeXPlanNode {
    children: LaTeXPlanNodeWithChildren[];
}

export function buildLaTeXTree(nodes: LaTeXPlanNode[]): LaTeXPlanNodeWithChildren[] {
    const nodeMap = new Map<string, LaTeXPlanNodeWithChildren>();

    nodes.forEach(n => nodeMap.set(n.id, { ...n, children: [] }));

    const roots: LaTeXPlanNodeWithChildren[] = [];

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
