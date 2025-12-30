/**
 * Lab Manual Explorer Service
 * 
 * Provides AI-powered analysis of lab manuals including:
 * - Document text extraction (PDF/DOCX)
 * - Topic outline generation
 * - Concept graph generation
 * - Device/apparatus detection
 * - Grounded Q&A with citations
 * - Experimental schematic generation
 */

import { generateTextContent, generateGeminiImage, extractJsonBlock } from './geminiService';
import { extractTextFromPdf } from '../utils/pdfTextExtractor';
import mammoth from 'mammoth';

// ============================================================================
// Types
// ============================================================================

export interface Topic {
    id: string;
    name: string;
    level: number;
    summary: string;
    keywords: string[];
    children: Topic[];
}

export interface TopicOutline {
    title: string;
    topics: Topic[];
}

export interface Device {
    name: string;
    role: string;
    safety: string[];
    relatedTopicIds: string[];
}

export interface DevicesResult {
    devices: Device[];
}

export interface ConceptNode {
    id: string;
    label: string;
    type: 'topic' | 'subtopic' | 'device' | 'concept';
}

export interface ConceptEdge {
    from: string;
    to: string;
    type: 'subtopic' | 'uses' | 'related' | 'contains';
}

export interface ConceptGraph {
    nodes: ConceptNode[];
    edges: ConceptEdge[];
}

export interface LabManualAnalysis {
    outline: TopicOutline;
    devices: DevicesResult;
    conceptGraph: ConceptGraph;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    citations?: Citation[];
}

export interface Citation {
    text: string;
    section?: string;
    relevance: number;
}

export interface ChatResponse {
    answer: string;
    citations: Citation[];
    foundInManual: boolean;
}

// ============================================================================
// Document Text Extraction
// ============================================================================

/**
 * Extract text from an uploaded file (PDF or DOCX)
 */
export async function extractDocumentText(file: File): Promise<string> {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.pdf')) {
        return await extractPdfText(file);
    } else if (fileName.endsWith('.docx')) {
        return await extractDocxText(file);
    } else if (fileName.endsWith('.doc')) {
        throw new Error('Legacy .doc files are not supported. Please convert to .docx or PDF.');
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        return await file.text();
    } else {
        throw new Error(`Unsupported file type: ${fileName}. Please upload a PDF, DOCX, or TXT file.`);
    }
}

async function extractPdfText(file: File): Promise<string> {
    const text = await extractTextFromPdf(file);
    return text;
}

async function extractDocxText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

// ============================================================================
// Lab Manual Analysis
// ============================================================================

const OUTLINE_SCHEMA = `{
  "title": "string (the main title of the lab manual)",
  "topics": [
    {
      "id": "string (unique ID like t1, t2, etc.)",
      "name": "string (topic name)",
      "level": "number (1 for main topics, 2 for subtopics, etc.)",
      "summary": "string (2-3 sentence summary)",
      "keywords": ["string"],
      "children": [ ... same shape recursively ... ]
    }
  ]
}`;

const DEVICES_SCHEMA = `{
  "devices": [
    {
      "name": "string (device/apparatus name)",
      "role": "string (what it does in the experiment)",
      "safety": ["string (safety precautions)"],
      "relatedTopicIds": ["string (topic IDs where this device is used)"]
    }
  ]
}`;

const CONCEPT_GRAPH_SCHEMA = `{
  "nodes": [
    { "id": "string", "label": "string", "type": "topic|subtopic|device|concept" }
  ],
  "edges": [
    { "from": "string (node ID)", "to": "string (node ID)", "type": "subtopic|uses|related|contains" }
  ]
}`;

/**
 * Analyze a lab manual and extract structured information
 */
export async function analyzeLabManual(
    documentText: string,
    onProgress?: (stage: string, progress: number) => void
): Promise<LabManualAnalysis> {
    onProgress?.('Analyzing document structure...', 10);

    // Generate all analyses in sequence to avoid rate limits
    const outlinePrompt = `You are analyzing a lab manual. Extract a hierarchical topic outline from the following document.

DOCUMENT:
${documentText.slice(0, 50000)} ${documentText.length > 50000 ? '... [truncated]' : ''}

Return ONLY valid JSON matching this exact schema (no markdown, no extra text):
${OUTLINE_SCHEMA}

Important:
- Create meaningful topic IDs like "t1", "t1.1", "t2", etc.
- Include 2-3 levels of hierarchy
- Extract real topics from the document, not generic placeholders
- DO NOT add any extra keys not in the schema`;

    onProgress?.('Extracting topic outline...', 25);
    const outlineResponse = await generateTextContent(outlinePrompt, {
        maxOutputTokens: 8192,
        model: 'gemini-3-pro-preview',
        applyPreferences: false,
    });

    let outline: TopicOutline;
    try {
        const jsonStr = extractJsonBlock(outlineResponse);
        outline = JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse outline:', outlineResponse);
        outline = { title: 'Lab Manual', topics: [] };
    }

    onProgress?.('Detecting apparatus and devices...', 50);
    const devicesPrompt = `You are analyzing a lab manual. Extract all laboratory apparatus, instruments, and devices mentioned.

DOCUMENT:
${documentText.slice(0, 50000)} ${documentText.length > 50000 ? '... [truncated]' : ''}

TOPIC IDS FROM OUTLINE:
${outline.topics.map(t => `${t.id}: ${t.name}`).join('\n')}

Return ONLY valid JSON matching this exact schema (no markdown, no extra text):
${DEVICES_SCHEMA}

Important:
- Only include actual lab equipment, not theoretical concepts
- Include relevant safety precautions for each device
- Link devices to topic IDs where they appear
- DO NOT add any extra keys not in the schema`;

    const devicesResponse = await generateTextContent(devicesPrompt, {
        maxOutputTokens: 4096,
        model: 'gemini-3-pro-preview',
        applyPreferences: false,
    });

    let devices: DevicesResult;
    try {
        const jsonStr = extractJsonBlock(devicesResponse);
        devices = JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse devices:', devicesResponse);
        devices = { devices: [] };
    }

    onProgress?.('Building concept map...', 75);
    const graphPrompt = `Create a concept graph for visualization based on this lab manual analysis.

TOPIC OUTLINE:
${JSON.stringify(outline, null, 2)}

DEVICES:
${JSON.stringify(devices, null, 2)}

Return ONLY valid JSON matching this exact schema (no markdown, no extra text):
${CONCEPT_GRAPH_SCHEMA}

Important:
- Include nodes for all topics, subtopics, and devices
- Create edges showing relationships: subtopic (parent-child), uses (topic uses device), related (conceptual links)
- Use the same IDs from the outline for topics
- Create new IDs for devices like "d1", "d2", etc.
- DO NOT add any extra keys not in the schema`;

    const graphResponse = await generateTextContent(graphPrompt, {
        maxOutputTokens: 8192,
        model: 'gemini-3-pro-preview',
        applyPreferences: false,
    });

    let conceptGraph: ConceptGraph;
    try {
        const jsonStr = extractJsonBlock(graphResponse);
        conceptGraph = JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse concept graph:', graphResponse);
        // Fallback: generate basic graph from outline
        conceptGraph = generateFallbackGraph(outline, devices);
    }

    onProgress?.('Analysis complete!', 100);

    return { outline, devices, conceptGraph };
}

/**
 * Generate a fallback concept graph from outline and devices
 */
function generateFallbackGraph(outline: TopicOutline, devices: DevicesResult): ConceptGraph {
    const nodes: ConceptNode[] = [];
    const edges: ConceptEdge[] = [];

    function addTopicNodes(topics: Topic[], parentId?: string) {
        for (const topic of topics) {
            nodes.push({
                id: topic.id,
                label: topic.name,
                type: topic.level === 1 ? 'topic' : 'subtopic'
            });

            if (parentId) {
                edges.push({ from: parentId, to: topic.id, type: 'subtopic' });
            }

            if (topic.children?.length) {
                addTopicNodes(topic.children, topic.id);
            }
        }
    }

    addTopicNodes(outline.topics);

    devices.devices.forEach((device, idx) => {
        const deviceId = `d${idx + 1}`;
        nodes.push({ id: deviceId, label: device.name, type: 'device' });

        device.relatedTopicIds.forEach(topicId => {
            edges.push({ from: topicId, to: deviceId, type: 'uses' });
        });
    });

    return { nodes, edges };
}

// ============================================================================
// Grounded Q&A Chat (with Transfer Question Support)
// ============================================================================

/**
 * Ask a question about the lab manual with grounded answers.
 * Supports transfer questions that combine external knowledge with manual context.
 */
export async function askManualQuestion(
    documentText: string,
    question: string,
    history: ChatMessage[] = []
): Promise<ChatResponse> {
    const historyContext = history
        .slice(-6) // Keep last 3 exchanges
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

    const prompt = `You are an expert science tutor helping a student understand a lab manual. You should:
1. PRIMARILY use the lab manual content as your source of truth
2. When the question requires additional context or external knowledge (formulas, theoretical background, calculations, real-world applications), you should COMBINE your scientific knowledge WITH the manual's context
3. Always try to relate your answer back to the specific content in the manual
4. Be educational and thorough in your explanations

LAB MANUAL CONTENT:
${documentText.slice(0, 60000)} ${documentText.length > 60000 ? '... [truncated]' : ''}

${historyContext ? `CONVERSATION HISTORY:\n${historyContext}\n` : ''}

USER QUESTION: ${question}

Respond in this JSON format ONLY (no markdown, no extra text):
{
  "answer": "string (your comprehensive answer combining manual content and relevant scientific knowledge)",
  "citations": [
    {
      "text": "string (quote from the manual that's relevant, or 'External knowledge' if using scientific principles not in the manual)",
      "section": "string (section name if from manual, or 'Scientific Background' if external)",
      "relevance": number (0.0-1.0 how relevant this citation is)
    }
  ],
  "foundInManual": boolean (true if answer uses manual content, even if augmented with external knowledge)
}

Important instructions:
- For TRANSFER QUESTIONS (questions that need calculations, formulas, or deeper scientific understanding):
  * Use the manual as context for what the experiment/topic is about
  * Apply your scientific knowledge to provide formulas, equations, and explanations
  * Always cite both manual sections AND mark external scientific knowledge
  * Example: If manual describes an experiment and user asks "what formulas are needed", provide the relevant formulas from your knowledge while citing the experiment context from the manual

- For DIRECT QUESTIONS (questions about specific content in the manual):
  * Answer directly from the manual content
  * Provide exact citations

- ALWAYS provide a helpful, educational answer. Never refuse to answer.
- If the topic isn't covered in the manual at all, acknowledge this but still provide helpful scientific information
- For calculation questions, show the formulas and explain each variable`;

    const response = await generateTextContent(prompt, {
        maxOutputTokens: 4096,
        model: 'gemini-3-pro-preview',
        applyPreferences: false,
    });

    try {
        const jsonStr = extractJsonBlock(response);
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Failed to parse chat response:', response);
        return {
            answer: response,
            citations: [],
            foundInManual: true,
        };
    }
}

// ============================================================================
// Schematic Generation
// ============================================================================

/**
 * Generate an experimental setup schematic from detected devices
 */
export async function generateSchematic(
    devices: Device[],
    experimentTitle: string
): Promise<{ imageBase64: string; mimeType: string }> {
    if (devices.length === 0) {
        throw new Error('No devices available to generate schematic');
    }

    const deviceList = devices
        .map(d => `- ${d.name}: ${d.role}`)
        .join('\n');

    const prompt = `Create a clean, professional scientific laboratory diagram showing an experimental setup for: "${experimentTitle}"

The setup should include these labeled components:
${deviceList}

Style requirements:
- Clean, technical illustration style
- White or light gray background
- Each component clearly labeled with text
- Show proper connections between equipment
- Include arrows for flow direction where applicable
- Professional scientific diagram aesthetic
- Clear, readable labels
- Appropriate scale and proportions

This should look like a diagram from a chemistry or physics textbook.`;

    return await generateGeminiImage(prompt, { aspectRatio: '16:9' });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate suggested questions based on the topic outline
 */
export function generateSuggestedQuestions(outline: TopicOutline): string[] {
    const questions: string[] = [];

    function addQuestionsForTopic(topic: Topic) {
        questions.push(`What is ${topic.name}?`);
        if (topic.keywords.length > 0) {
            questions.push(`Explain ${topic.keywords[0]} in this context`);
        }
        topic.children?.slice(0, 2).forEach(addQuestionsForTopic);
    }

    outline.topics.slice(0, 3).forEach(addQuestionsForTopic);

    return questions.slice(0, 5);
}

/**
 * Flatten topic tree for easier access
 */
export function flattenTopics(topics: Topic[]): Topic[] {
    const result: Topic[] = [];

    function flatten(topic: Topic) {
        result.push(topic);
        topic.children?.forEach(flatten);
    }

    topics.forEach(flatten);
    return result;
}
