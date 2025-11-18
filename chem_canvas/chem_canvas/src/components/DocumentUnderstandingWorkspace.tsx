import React, { useState, useRef, useEffect } from 'react';
import { FileText, ArrowLeft, Upload, Sparkles, Loader2, Eye, Download, X, BookOpen, Target, Search, MessageSquare, Send, ExternalLink, PlusCircle, Star, Trash2, AlertCircle, RefreshCw, Calculator, Lightbulb } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { RandomDocumentLoader } from './LoadingAnimations';

// React PDF Viewer imports
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { highlightPlugin, Trigger } from '@react-pdf-viewer/highlight';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import type { RenderHighlightsProps, HighlightArea } from '@react-pdf-viewer/highlight';
import DocumentMindMap, { type MindMapData, type MindMapBranchNode } from './DocumentMindMap';
import DynamicSimulationGenerator from './DynamicSimulationGenerator';

// Import styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';
import '@react-pdf-viewer/zoom/lib/styles/index.css';

interface DocumentUnderstandingWorkspaceProps {
  onClose: () => void;
  apiKey: string;
}

interface ProcessedDocument {
  id: string;
  name: string;
  summary: string;
  uploadTime: Date;
  subject?: string;
  topics?: string[];
  metadata?: {
    pageCount?: number;
    fileSize?: string;
    author?: string;
    title?: string;
    estimatedPages?: string;
    mainThemes?: string[];
    difficulty?: string;
    type?: string;
  };
}

interface CustomPreparationMaterial {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

interface FavoritePreparationMaterial extends CustomPreparationMaterial {
  type: string;
  source: 'generated' | 'custom';
  originId?: string;
}

const createUniqueId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const formatPreparationType = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Helper function to convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const DocumentUnderstandingWorkspace: React.FC<DocumentUnderstandingWorkspaceProps> = ({
  onClose,
  apiKey
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<ProcessedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [showTopicWorkspace, setShowTopicWorkspace] = useState(false);
  const [animatingTopics, setAnimatingTopics] = useState<string[]>([]);
  const [studyMaterials, setStudyMaterials] = useState<string>('');
  const [isGeneratingMaterials, setIsGeneratingMaterials] = useState(false);
  const [showStudyMaterials, setShowStudyMaterials] = useState(false);
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
  const [isGeneratingMindMap, setIsGeneratingMindMap] = useState(false);
  const [mindMapError, setMindMapError] = useState<string | null>(null);
  const [showMindMap, setShowMindMap] = useState(false);
  const [extractedFormulas, setExtractedFormulas] = useState<string[]>([]);
  const [extractedDefinitions, setExtractedDefinitions] = useState<{term: string, definition: string}[]>([]);
  const [isExtractingFormulas, setIsExtractingFormulas] = useState(false);
  const [isExtractingDefinitions, setIsExtractingDefinitions] = useState(false);
  
  // Store multiple preparation materials
  const [preparationMaterials, setPreparationMaterials] = useState<{[key: string]: string}>({});
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [activePreparationType, setActivePreparationType] = useState<string | null>(null);
  const [customPreparationMaterials, setCustomPreparationMaterials] = useState<{[key: string]: CustomPreparationMaterial[]}>({});
  const [showCustomMaterialModal, setShowCustomMaterialModal] = useState(false);
  const [customMaterialType, setCustomMaterialType] = useState<string | null>(null);
  const [customMaterialTitle, setCustomMaterialTitle] = useState('');
  const [customMaterialContent, setCustomMaterialContent] = useState('');
  const [customMaterialFavorite, setCustomMaterialFavorite] = useState(false);
  const [favoritePreparationMaterials, setFavoritePreparationMaterials] = useState<FavoritePreparationMaterial[]>([]);
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false);

  // Chat with document state
  const [showDocumentChat, setShowDocumentChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [documentContent, setDocumentContent] = useState<string>('');
  
  // PDF viewer state
  const [pdfFileUrl, setPdfFileUrl] = useState<string>('');
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [highlightAreas, setHighlightAreas] = useState<HighlightArea[]>([]);
  const [searchingPages, setSearchingPages] = useState(false);
  
  // Simulation Generator state
  const [showSimulationGenerator, setShowSimulationGenerator] = useState(false);
  const [selectedDocumentForSimulation, setSelectedDocumentForSimulation] = useState<ProcessedDocument | null>(null);
  
  // Custom rendering for highlights
  const renderHighlights = (props: RenderHighlightsProps) => (
    <div>
      {highlightAreas
        .filter((area) => area.pageIndex === props.pageIndex)
        .map((area, idx) => (
          <div
            key={idx}
            className="highlight-area"
            style={Object.assign(
              {},
              {
                background: 'rgba(255, 255, 0, 0.4)',
                borderRadius: '2px',
              },
              props.getCssProperties(area, props.rotation)
            )}
          />
        ))}
    </div>
  );

  // Create highlight plugin - this must be at top level, not in useMemo
  const highlightPluginInstance = highlightPlugin({
    renderHighlights,
    trigger: Trigger.None,
  });
  
  // Create zoom plugin for better quality zooming
  const zoomPluginInstance = zoomPlugin();
  const { CurrentScale, ZoomIn, ZoomOut } = zoomPluginInstance;
  
  // Debug useEffect for preparation materials
  useEffect(() => {
    console.log('Preparation state changed:', {
      activePreparationType,
      preparationMaterialsKeys: Object.keys(preparationMaterials),
      generatingType
    });
  }, [activePreparationType, preparationMaterials, generatingType]);

  // Handle citation click - search PDF and create highlight
  const handleCitationClick = async (citationText: string, pageNumber?: number) => {
    if (!pdfFileUrl) return;

    setShowPdfViewer(true);
    setSearchingPages(true);

    // If page number is provided, create highlight for that page
    if (pageNumber && pageNumber >= 1) {
      // Create a highlight area - this will be refined after PDF loads
      const highlightArea: HighlightArea = {
        pageIndex: pageNumber - 1, // 0-indexed
        left: 10,
        top: 10,
        height: 20,
        width: 80,
      };
      setHighlightAreas([highlightArea]);
      setSearchingPages(false);
      
      // Jump to the page using the plugin
      if (highlightPluginInstance?.jumpToHighlightArea) {
        setTimeout(() => {
          highlightPluginInstance.jumpToHighlightArea(highlightArea);
        }, 500);
      }
    } else {
      // For now, just open the PDF viewer
      // Advanced text search would require additional implementation
      setHighlightAreas([]);
      setSearchingPages(false);
    }
  };

  // Custom component to render clickable citations
  const CitationText: React.FC<{ text: string | React.ReactNode }> = ({ text }) => {
    // Convert to string if needed
    const textString = React.Children.toArray(text).map(child => {
      if (typeof child === 'string') return child;
      if (React.isValidElement(child) && child.props.children) {
        return String(child.props.children);
      }
      return '';
    }).join('');

    // Parse citations in the format [Citation|Page X: "quote"] or [Citation: "quote"]
    const citationRegex = /\[Citation(?:\|Page (\d+))?: "([^"]+)"\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let hasMatches = false;

    while ((match = citationRegex.exec(textString)) !== null) {
      hasMatches = true;
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(textString.substring(lastIndex, match.index));
      }

      const pageNum = match[1] ? parseInt(match[1]) : undefined;
      const quote = match[2];

      // Add clickable citation
      parts.push(
        <button
          key={match.index}
          onClick={() => handleCitationClick(quote, pageNum)}
          className="inline-flex items-center gap-1 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-300 px-2 py-1 rounded text-xs mx-1 transition-all hover:scale-105 cursor-pointer"
          title={`Click to view: "${quote}"`}
        >
          <ExternalLink className="h-3 w-3" />
          {pageNum ? `Page ${pageNum}` : 'Citation'}
        </button>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < textString.length) {
      parts.push(textString.substring(lastIndex));
    }

    return <>{hasMatches && parts.length > 0 ? parts : text}</>;
  };

  // Custom component to render text with math expressions
  const renderMathText = (text: string) => {
    // Handle escaped dollar signs first
    const processedText = text.replace(/\\\$/g, 'ESCAPED_DOLLAR');

    const parts = processedText.split(/(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\\$[\s\S]*?\\\$|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

    return parts.map((part, index) => {
      // Restore escaped dollar signs
      const cleanPart = part.replace(/ESCAPED_DOLLAR/g, '$');

      if (cleanPart.startsWith('\\[') && cleanPart.endsWith('\\]')) {
        // Display math with \[...\]
        const math = cleanPart.slice(2, -2).trim();
        if (math) {
          try {
            return <div key={index} className="my-4 flex justify-center"><BlockMath math={math} /></div>;
          } catch (error) {
            console.warn('KaTeX display math error:', error, 'for math:', math);
            return <code key={index} className="bg-red-900/50 text-red-300 px-3 py-2 rounded-lg block text-center my-4 border border-red-700">{cleanPart}</code>;
          }
        }
      } else if (cleanPart.startsWith('\\(') && cleanPart.endsWith('\\)')) {
        // Inline math with \(...\)
        const math = cleanPart.slice(2, -2).trim();
        if (math) {
          try {
            return <InlineMath key={index} math={math} />;
          } catch (error) {
            console.warn('KaTeX inline math error:', error, 'for math:', math);
            return <code key={index} className="bg-red-900/50 text-red-300 px-2 py-1 rounded border border-red-700">{cleanPart}</code>;
          }
        }
      } else if (cleanPart.startsWith('$$') && cleanPart.endsWith('$$')) {
        // Display math with $$...$$
        const math = cleanPart.slice(2, -2).trim();
        if (math) {
          try {
            return <div key={index} className="my-4 flex justify-center"><BlockMath math={math} /></div>;
          } catch (error) {
            console.warn('KaTeX display math error:', error, 'for math:', math);
            return <code key={index} className="bg-red-900/50 text-red-300 px-3 py-2 rounded-lg block text-center my-4 border border-red-700">{cleanPart}</code>;
          }
        }
      } else if (cleanPart.startsWith('$') && cleanPart.endsWith('$') && cleanPart.length > 2) {
        // Inline math with $...$
        const math = cleanPart.slice(1, -1).trim();
        if (math) {
          try {
            return <InlineMath key={index} math={math} />;
          } catch (error) {
            console.warn('KaTeX inline math error:', error, 'for math:', math);
            return <code key={index} className="bg-red-900/50 text-red-300 px-2 py-1 rounded border border-red-700">{cleanPart}</code>;
          }
        }
      }

      // Regular text
      return cleanPart;
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cached model name for DocumentUnderstandingWorkspace
  const cachedDocModelRef = useRef<string | null>(null);
  const currentApiKeyRef = useRef<string | null>(null);
  const geminiClientRef = useRef<GoogleGenerativeAI | null>(null);

  const initializeGemini = () => {
    if (!apiKey || !apiKey.trim()) {
      console.error('No shared Gemini API key available');
      throw new Error('Shared Gemini API key is required');
    }

    const normalizedKey = apiKey.trim();
    if (!geminiClientRef.current || currentApiKeyRef.current !== normalizedKey) {
      console.log('initializeGemini: creating new GoogleGenerativeAI client with shared key');
      geminiClientRef.current = new GoogleGenerativeAI(normalizedKey);
      currentApiKeyRef.current = normalizedKey;
      cachedDocModelRef.current = null;
    }

    return geminiClientRef.current;
  };

  const getAvailableModel = async (genAI: GoogleGenerativeAI): Promise<string> => {
    // Return cached model if available
    if (cachedDocModelRef.current) {
      return cachedDocModelRef.current;
    }

    const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
    for (const modelName of models) {
      try {
        console.log(`[DocWorkspace] Testing model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const testResult = await model.generateContent('test');
        await testResult.response;
        console.log(`[DocWorkspace] ✅ Using model: ${modelName}`);
        cachedDocModelRef.current = modelName;
        return modelName;
      } catch (error: any) {
        console.warn(`[DocWorkspace] ❌ Model ${modelName} not available:`, error.message);
        continue;
      }
    }

    throw new Error('No working Gemini model found');
  };

  const MIND_MAP_CONTEXT_LIMIT = 3200;
  const MAX_MIND_MAP_CHILDREN = 4;
  const MAX_MIND_MAP_DEPTH = 3;

  type RawMindMapBranch = {
    id?: string;
    title?: string;
    summary?: string;
    concepts?: unknown;
    keyConcepts?: unknown;
    topics?: unknown;
    guidingQuestions?: unknown;
    guidingPrompts?: unknown;
    questions?: unknown;
    prompts?: unknown;
    examples?: unknown;
    applications?: unknown;
    caseStudies?: unknown;
    children?: RawMindMapBranch[];
  };

  type RawMindMapResponse = {
    centralIdea?: string;
    learningObjectives?: unknown;
    learningOutcomes?: unknown;
    keyTakeaways?: unknown;
    keyInsights?: unknown;
    branches?: RawMindMapBranch[];
  };

  const cleanString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  };

  const toStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter((item): item is string => item.length > 0);
    }

    if (typeof value === 'string') {
      return value
        .split(/(?:\r?\n|\u2022|•|\-|–|—)/g)
        .map(token => token.replace(/^[0-9]+[\.)]\s*/, '').trim())
        .filter((token): token is string => token.length > 0);
    }

    return [];
  };

  const mergeStringArrays = (...values: unknown[]): string[] => {
    const seen = new Set<string>();
    values.forEach(value => {
      toStringArray(value).forEach(entry => {
        if (entry.length > 0) {
          seen.add(entry);
        }
      });
    });
    return Array.from(seen);
  };

  const extractJsonBlock = (raw: string): string => {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      return fenceMatch[1].trim();
    }
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    return trimmed;
  };

  const getMindMapContextSnippet = (content: string): string =>
    content.replace(/\s+/g, ' ').slice(0, MIND_MAP_CONTEXT_LIMIT);

  const buildFallbackMindMap = (topics: string[]): MindMapData => {
    if (topics.length === 0) {
      return {
        centralIdea: 'Study Mind Map',
        learningObjectives: [
          'Identify priority topics',
          'Link related concepts visually',
          'Plan follow-up study actions'
        ],
        branches: [
          {
            id: createUniqueId('mindmap-branch'),
            title: 'Getting Started',
            summary: 'Select one or more topics to generate a personalised map.',
            concepts: [
              'Choose focus concepts',
              'Outline key definitions',
              'Plan applications and practice'
            ],
            guidingQuestions: ['What do you need to revise first?', 'Which resources support this topic?'],
            examples: ['Example: Core principles of stoichiometry'],
            children: []
          }
        ]
      };
    }

    const centralIdea = topics.length > 1 ? `${topics[0]} and related topics` : topics[0];
    const learningObjectives = topics
      .map(topic => `Explain and apply the foundational ideas of ${topic}.`)
      .slice(0, 6);

    const branches: MindMapBranchNode[] = topics.map(topic => ({
      id: createUniqueId('mindmap-branch'),
      title: topic,
      summary: `Essential concepts, misconceptions, and applications associated with ${topic}.`,
      concepts: [
        `Foundational laws or definitions for ${topic}`,
        `Common mistakes learners make with ${topic}`,
        `Advanced extension pathways for ${topic}`
      ],
      guidingQuestions: [
        `How does ${topic} connect to prior knowledge?`,
        `Where does ${topic} appear in real experiments or assessments?`
      ],
      examples: [`Scenario or problem that demonstrates ${topic}`],
      children: [
        {
          id: createUniqueId('mindmap-sub'),
          title: `${topic} fundamentals`,
          summary: `Key vocabulary, core representations, and benchmark problems for ${topic}.`,
          concepts: [
            `Essential terminology for ${topic}`,
            `Representative calculation or diagram`
          ],
          guidingQuestions: [`Which misconception needs to be resolved about ${topic}?`],
          examples: [],
          children: []
        },
        {
          id: createUniqueId('mindmap-sub'),
          title: `${topic} applications`,
          summary: `Practical uses, lab techniques, or case studies illustrating ${topic}.`,
          concepts: [
            `Laboratory or industrial application for ${topic}`,
            `Link to a follow-on topic or project`
          ],
          guidingQuestions: [`What is the next idea to explore after ${topic}?`],
          examples: [],
          children: []
        }
      ]
    }));

    return {
      centralIdea,
      learningObjectives,
      branches
    };
  };

  const normalizeMindMapBranch = (
    branch: RawMindMapBranch,
    topics: string[],
    depth = 1
  ): MindMapBranchNode => {
    const fallbackTopic = topics[(depth - 1) % (topics.length || 1)] ?? `Concept ${depth}`;

    const title = cleanString(branch.title) ?? `${fallbackTopic} focus`;
    const summary = cleanString(branch.summary);
    const concepts = mergeStringArrays(branch.concepts, branch.keyConcepts, branch.topics).slice(0, 6);
    const guidingQuestions = mergeStringArrays(
      branch.guidingQuestions,
      branch.guidingPrompts,
      branch.questions,
      branch.prompts
    ).slice(0, 4);
    const examples = mergeStringArrays(branch.examples, branch.applications, branch.caseStudies).slice(0, 4);

    let children: MindMapBranchNode[] = [];
    if (Array.isArray(branch.children) && branch.children.length > 0 && depth < MAX_MIND_MAP_DEPTH) {
      children = branch.children
        .slice(0, MAX_MIND_MAP_CHILDREN)
        .map(child => normalizeMindMapBranch(child, topics, depth + 1));
    }

    return {
      id: createUniqueId(`mindmap-${depth}`),
      title,
      summary,
      concepts,
      guidingQuestions,
      examples,
      children
    };
  };

  const normalizeMindMapResponse = (raw: RawMindMapResponse | null, topics: string[]): MindMapData => {
    const fallback = buildFallbackMindMap(topics);

    if (!raw) {
      return fallback;
    }

    const centralIdea = cleanString(raw.centralIdea) ?? fallback.centralIdea;
    const learningObjectives = mergeStringArrays(
      raw.learningObjectives,
      raw.learningOutcomes,
      raw.keyTakeaways,
      raw.keyInsights
    ).slice(0, 6);

    const sourceBranches = Array.isArray(raw.branches) ? raw.branches.slice(0, 6) : [];
    let branches = sourceBranches.length > 0
      ? sourceBranches.map(branch => normalizeMindMapBranch(branch, topics))
      : [];

    if (branches.length === 0) {
      return {
        centralIdea,
        learningObjectives: learningObjectives.length > 0 ? learningObjectives : fallback.learningObjectives,
        branches: fallback.branches
      };
    }

    if (topics.length > 0) {
      const lowerTopics = topics.map(topic => topic.toLowerCase());
      const coveredTopics = new Set<number>();

      branches.forEach(branch => {
        lowerTopics.forEach((topic, index) => {
          if (branch.title.toLowerCase().includes(topic)) {
            coveredTopics.add(index);
          }
        });
      });

      lowerTopics.forEach((topic, index) => {
        if (!coveredTopics.has(index)) {
          const supplemental = buildFallbackMindMap([topics[index]]);
          if (supplemental.branches.length > 0) {
            branches.push(supplemental.branches[0]);
          }
        }
      });
    }

    return {
      centralIdea,
      learningObjectives: learningObjectives.length > 0 ? learningObjectives : fallback.learningObjectives,
      branches
    };
  };

  const createMindMapFromGemini = async (topics: string[], contextSnippet: string): Promise<MindMapData> => {
    const genAI = initializeGemini();
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });

      const promptParts: string[] = [
        'You are an expert learning designer creating visually compelling mind maps for chemistry students.',
        'Return JSON that matches this exact schema:',
        '{',
        '  "centralIdea": "string",',
        '  "learningObjectives": ["string", "..."],',
        '  "branches": [',
        '    {',
        '      "title": "string",',
        '      "summary": "string",',
        '      "concepts": ["string", "..."],',
        '      "guidingQuestions": ["string", "..."],',
        '      "examples": ["string", "..."],',
        '      "children": [',
        '        { "title": "string", "summary": "string", "concepts": ["..."], "guidingQuestions": ["..."], "examples": ["..."], "children": [] }',
        '      ]',
        '    }',
        '  ]',
        '}',
        'Rules:',
        '- Provide 3-5 top-level branches.',
        '- Each branch should include 2-4 children unless the topic does not require deeper layers.',
        '- Keep every string under 140 characters and omit markdown formatting.',
        '- Concepts and questions must be actionable and specific.',
        `Selected topics: ${topics.join(', ') || 'n/a'}.`
      ];

      if (contextSnippet) {
        promptParts.push('Document context to ground the mind map:');
        promptParts.push(`"""${contextSnippet}"""`);
      }

      promptParts.push('Return only valid JSON with no commentary or code fences.');

      const result = await model.generateContent(promptParts.join('\n'));
      const responseText = result.response.text();

      if (!responseText) {
        throw new Error('Gemini returned an empty response for the mind map request.');
      }

      const jsonPayload = extractJsonBlock(responseText);

      let parsed: RawMindMapResponse;
      try {
        parsed = JSON.parse(jsonPayload) as RawMindMapResponse;
      } catch (error) {
        console.error('Failed to parse Gemini mind map JSON:', error, jsonPayload);
        throw new Error('Gemini mind map JSON parsing failed.');
      }

    return normalizeMindMapResponse(parsed, topics);
  };

  const analyzeDocumentMetadata = async (file: File): Promise<{subject: string, topics: string[], metadata: any}> => {
    const genAI = initializeGemini();
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });

    const bytes = await file.arrayBuffer();
    const base64Data = arrayBufferToBase64(bytes);

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      },
      `Analyze this document and provide the following information in JSON format:
      {
        "subject": "The main academic subject/discipline this document belongs to (e.g., Chemistry, Physics, Mathematics, Biology, etc.)",
        "topics": ["List of specific topics covered in the document, maximum 8 topics"],
        "metadata": {
          "estimatedPages": "Approximate number of pages",
          "mainThemes": ["3-5 main themes or concepts"],
          "difficulty": "Beginner/Intermediate/Advanced",
          "type": "Research paper, textbook chapter, lab manual, etc."
        }
      }
      Return only valid JSON, no additional text.`
    ]);

    const responseText = result.response.text();
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          subject: parsed.subject || 'Unknown',
          topics: Array.isArray(parsed.topics) ? parsed.topics : [],
          metadata: parsed.metadata || {}
        };
      }
    } catch (error) {
      console.error('Error parsing metadata JSON:', error);
    }

    return {
      subject: 'Unknown',
      topics: [],
      metadata: {}
    };
  };

  const processDocument = async (file: File): Promise<string> => {
    console.log('processDocument called with file:', file.name);
    const genAI = initializeGemini();
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });

    setProcessingStatus('Reading file data...');

    const bytes = await file.arrayBuffer();
    const base64Data = arrayBufferToBase64(bytes);

    setProcessingStatus('Sending to Gemini API...');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      },
      `Please extract the complete text content from this PDF document. 

CRITICAL REQUIREMENTS:
1. Preserve ALL text content from the document
2. For EACH paragraph or section, indicate which page it came from using this format:
   [PAGE X] content text here
   
3. Maintain the document structure and organization
4. Include all important information: headings, body text, lists, tables, etc.
5. Be thorough - don't summarize, extract the full text

Format example:
[PAGE 1] Introduction section content...
[PAGE 1] More content from page 1...
[PAGE 2] Content from page 2...

This will be used to answer questions with accurate page citations.`
    ]);

    setProcessingStatus('Processing AI response...');
    const response = result.response.text();
    console.log('Document processing completed, response length:', response.length);

    return response;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      alert('File size must be less than 50MB');
      return;
    }

    // Clear previous preparation materials when uploading a new document
    setPreparationMaterials({});
    setActivePreparationType(null);
    setChatMessages([]);
    setDocumentContent('');
    
    // Create blob URL for PDF viewer
    const fileUrl = URL.createObjectURL(file);
    setPdfFileUrl(fileUrl);
    setShowPdfViewer(false);
    setHighlightAreas([]);
    
    setCurrentFile(file);
    setIsProcessing(true);
    setIsExtractingFormulas(true);
    setIsExtractingDefinitions(true);
    setProcessingStatus('Starting upload...');

    try {
      setProcessingStatus('Reading file...');
      console.log('Starting document processing...');
      
      // Process summary, metadata, formulas, and definitions in parallel
      const [summary, metadataAnalysis, formulas, definitions] = await Promise.all([
        processDocument(file),
        analyzeDocumentMetadata(file),
        extractFormulasFromDocument(file),
        extractDefinitionsFromDocument(file)
      ]);
      
      // Store the document content for chat
      setDocumentContent(summary);
      
      console.log('Document processing completed, summary length:', summary.length);
      console.log('Metadata analysis:', metadataAnalysis);
      console.log('Extracted formulas:', formulas.length);
      console.log('Extracted definitions:', definitions.length);

      // Update state with extracted content
      setExtractedFormulas(formulas);
      setExtractedDefinitions(definitions);

      const processedDoc: ProcessedDocument = {
        id: Date.now().toString(),
        name: file.name,
        summary,
        uploadTime: new Date(),
        subject: metadataAnalysis.subject,
        topics: metadataAnalysis.topics,
        metadata: {
          ...metadataAnalysis.metadata,
          fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`
        }
      };

      setUploadedFiles(prev => [processedDoc, ...prev]);
      setProcessingStatus('Document processed successfully!');
      console.log('Document added to processed files list');
    } catch (error) {
      console.error('Error processing document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setProcessingStatus(`Error processing document: ${errorMessage}`);
      alert(`Error processing document: ${errorMessage}`);
      // Only clear currentFile on error
      setCurrentFile(null);
    } finally {
      setIsProcessing(false);
      setIsExtractingFormulas(false);
      setIsExtractingDefinitions(false);
      // Don't clear currentFile here - keep it for preparation materials generation
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadSummary = (doc: ProcessedDocument) => {
    const blob = new Blob([doc.summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.name}_summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateStudyMaterials = async (topics: string[]): Promise<string> => {
    const genAI = initializeGemini();
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `Generate comprehensive study materials for the following topics: ${topics.join(', ')}

Please create detailed study materials that include:

1. **Key Concepts**: Explain the fundamental concepts and principles
2. **Important Formulas/Theorems**: List and explain key formulas, equations, or theorems
3. **Examples**: Provide practical examples with step-by-step explanations
4. **Common Applications**: Describe real-world applications and use cases
5. **Study Tips**: Provide effective study strategies and memory techniques
6. **Practice Questions**: Include 5-7 practice questions with answers

Format the response using clear headings, bullet points, and numbered lists for easy reading. Make it educational and comprehensive but not overwhelming.`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  };

  const handleGenerateStudyMaterials = async () => {
    if (selectedTopics.length === 0) {
      alert('Please select at least one topic first');
      return;
    }

    setIsGeneratingMaterials(true);
    setShowStudyMaterials(false);

    try {
      const materials = await generateStudyMaterials(selectedTopics);
      setStudyMaterials(materials);
      setShowStudyMaterials(true);
    } catch (error) {
      console.error('Error generating study materials:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error generating study materials: ${errorMessage}`);
    } finally {
      setIsGeneratingMaterials(false);
    }
  };

  const handleGenerateMindMap = async () => {
    if (selectedTopics.length === 0) {
      alert('Please select at least one topic first');
      return;
    }

    setIsGeneratingMindMap(true);
    setMindMapError(null);
    setShowMindMap(true);

    try {
      const contextSnippet = documentContent ? getMindMapContextSnippet(documentContent) : '';
      const generatedMindMap = await createMindMapFromGemini(selectedTopics, contextSnippet);
      setMindMapData(generatedMindMap);
    } catch (error) {
      console.error('Error generating mind map:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setMindMapError(errorMessage);
      setMindMapData(buildFallbackMindMap(selectedTopics));
    } finally {
      setIsGeneratingMindMap(false);
    }
  };

  const addFavoriteMaterial = (
    type: string,
    title: string,
    content: string,
    source: 'generated' | 'custom',
    originId?: string
  ) => {
    let added = false;
    const normalizedTitle = title.trim() || `${formatPreparationType(type)} favorite`;

    setFavoritePreparationMaterials(prev => {
      if (originId && prev.some(fav => fav.originId === originId)) {
        return prev;
      }

      if (!originId && prev.some(fav => fav.type === type && fav.content === content)) {
        return prev;
      }

      added = true;
      const favorite: FavoritePreparationMaterial = {
        id: createUniqueId('favorite'),
        type,
        title: normalizedTitle,
        content,
        createdAt: new Date().toISOString(),
        source,
        originId,
      };

      return [favorite, ...prev];
    });

    if (added) {
      setShowFavoritesPanel(true);
    }

    return added;
  };

  const handleOpenCustomMaterialModal = (type: string) => {
    setCustomMaterialType(type);
    setCustomMaterialTitle('');
    setCustomMaterialContent('');
    setCustomMaterialFavorite(false);
    setShowCustomMaterialModal(true);
  };

  const handleCloseCustomMaterialModal = () => {
    setShowCustomMaterialModal(false);
    setCustomMaterialType(null);
    setCustomMaterialTitle('');
    setCustomMaterialContent('');
    setCustomMaterialFavorite(false);
  };

  const handleSaveCustomMaterial = () => {
    if (!customMaterialType) return;

    const trimmedContent = customMaterialContent.trim();
    if (!trimmedContent) {
      alert('Please provide pattern or sample content before saving.');
      return;
    }

    const existingCount = (customPreparationMaterials[customMaterialType]?.length || 0) + 1;
    const title = customMaterialTitle.trim() || `${formatPreparationType(customMaterialType)} sample ${existingCount}`;
    const newSample: CustomPreparationMaterial = {
      id: createUniqueId(customMaterialType),
      title,
      content: trimmedContent,
      createdAt: new Date().toISOString(),
    };

    setCustomPreparationMaterials(prev => ({
      ...prev,
      [customMaterialType]: [...(prev[customMaterialType] || []), newSample],
    }));

    setPreparationMaterials(prev => ({
      ...prev,
      [customMaterialType]: trimmedContent,
    }));

    setActivePreparationType(customMaterialType);

    if (customMaterialFavorite) {
      const added = addFavoriteMaterial(customMaterialType, title, trimmedContent, 'custom', newSample.id);
      if (!added) {
        alert('This sample is already stored in favorites.');
      } else {
        alert('Sample saved and added to favorites!');
      }
    } else {
      alert('Sample saved successfully!');
    }

    handleCloseCustomMaterialModal();
  };

  const handleUseCustomSample = (type: string, sampleId: string) => {
    const sample = (customPreparationMaterials[type] || []).find(item => item.id === sampleId);
    if (!sample) return;

    setPreparationMaterials(prev => ({
      ...prev,
      [type]: sample.content,
    }));
    setActivePreparationType(type);
  };

  const handleMarkSampleFavorite = (type: string, sampleId: string) => {
    const sample = (customPreparationMaterials[type] || []).find(item => item.id === sampleId);
    if (!sample) return;

    const added = addFavoriteMaterial(type, sample.title, sample.content, 'custom', sample.id);
    if (!added) {
      alert('This sample is already stored in favorites.');
    } else {
      alert('Sample added to favorites!');
    }
  };

  const handleApplyFavoriteMaterial = (favoriteId: string) => {
    const favorite = favoritePreparationMaterials.find(item => item.id === favoriteId);
    if (!favorite) return;

    setPreparationMaterials(prev => ({
      ...prev,
      [favorite.type]: favorite.content,
    }));
    setActivePreparationType(favorite.type);
  };

  const handleRemoveFavoriteMaterial = (favoriteId: string) => {
    setFavoritePreparationMaterials(prev => prev.filter(item => item.id !== favoriteId));
  };

  const handleSaveActiveMaterialToFavorites = () => {
    if (!activePreparationType) return;

    const content = preparationMaterials[activePreparationType];
    if (!content) return;

    const suggestedTitle = `${formatPreparationType(activePreparationType)} favorite ${new Date().toLocaleDateString()}`;
    const userTitle = window.prompt('Give this preparation material a name for your favorites:', suggestedTitle);

    if (!userTitle) {
      return;
    }

    const added = addFavoriteMaterial(activePreparationType, userTitle, content, 'generated');
    if (!added) {
      alert('This material already exists in favorites.');
    } else {
      alert('Preparation material saved to favorites!');
    }
  };

  const handleQuickSavePreparation = (type: string) => {
    const content = preparationMaterials[type];
    if (!content) {
      alert('Generate or select materials first to save them to favorites.');
      return;
    }

    const added = addFavoriteMaterial(type, `${formatPreparationType(type)} materials`, content, 'generated');
    if (!added) {
      alert('This material already exists in favorites.');
    } else {
      alert('Preparation material saved to favorites!');
    }
  };

  const generatePreparationMaterials = async (type: string, documentContent: string): Promise<string> => {
    console.log('generatePreparationMaterials called with type:', type);
    console.log('documentContent length:', documentContent.length);

    const genAI = initializeGemini();
    console.log('Gemini initialized');

    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });
    console.log('Model created');

    const prompts = {
      test: `Based on this document content, create comprehensive test preparation materials. Include:
1. **Key Concepts**: Main topics and concepts to study
2. **Important Formulas**: Critical equations and formulas with explanations
3. **Practice Questions**: 10-15 multiple choice and short answer questions
4. **Study Tips**: Effective strategies for test preparation
5. **Common Mistakes**: Things to avoid and frequently missed concepts

Format as a structured study guide with clear headings and bullet points.`,

      colloquium: `Create colloquium preparation materials based on this document. Include:
1. **Discussion Points**: Key topics for academic discussion
2. **Critical Analysis**: Questions to analyze and debate
3. **Research Connections**: Related concepts and further reading
4. **Presentation Tips**: How to discuss these topics in an academic setting
5. **Counterarguments**: Potential opposing views or alternative interpretations

Structure as a discussion guide with thought-provoking questions and analysis points.`,

      'lab practical': `Generate lab practical preparation materials from this document. Include:
1. **Experimental Procedures**: Key steps and methodologies
2. **Safety Considerations**: Important safety protocols and precautions
3. **Equipment & Materials**: Essential tools and substances needed
4. **Data Analysis**: How to interpret results and perform calculations
5. **Troubleshooting**: Common issues and how to handle them

Format as a practical laboratory guide with step-by-step instructions and checklists.`,

      seminar: `Prepare seminar materials based on this document content. Include:
1. **Presentation Outline**: Structure for seminar presentation
2. **Key Findings**: Main results and conclusions to highlight
3. **Discussion Questions**: Topics for group discussion
4. **Visual Aids**: Suggestions for slides, diagrams, or demonstrations
5. **Q&A Preparation**: Anticipated questions and responses

Create a comprehensive seminar preparation guide with presentation strategies.`,

      exam: `Create comprehensive exam preparation materials from this document. Include:
1. **Core Concepts**: Essential knowledge and understanding required
2. **Problem Types**: Different types of questions to expect
3. **Formula Sheet**: Key equations and formulas to memorize
4. **Practice Problems**: Sample problems with detailed solutions
5. **Time Management**: Strategies for exam timing and pacing

Structure as an intensive exam preparation guide with focused study materials.`
    };

    const prompt = prompts[type as keyof typeof prompts] || prompts.test;
    console.log('Using prompt for type:', type);

    const customSamples = customPreparationMaterials[type] || [];
    let finalPrompt = prompt;

    if (customSamples.length > 0) {
      const formattedSamples = customSamples
        .map((sample, index) => `Sample ${index + 1} (${sample.title}):\n${sample.content}`)
        .join('\n\n');

      finalPrompt += `\n\nConsider these user-provided ${type} patterns or samples when crafting your response. Mirror their tone, depth, and structure where it helps the learner.\n\n${formattedSamples}`;
    }

    console.log('Making API call to Gemini...');
    const result = await model.generateContent([
      `Document content: ${documentContent}`,
      finalPrompt
    ]);

    console.log('API call completed, getting response...');
    const response = result.response.text();
    console.log('Response received, length:', response.length);

    return response;
  };

  const handlePreparationTypeSelect = async (type: string) => {
    console.log('handlePreparationTypeSelect called with type:', type);
    console.log('currentFile:', currentFile);
    console.log('apiKey:', apiKey ? 'present' : 'missing');

    if (!currentFile) {
      console.log('No current file, showing alert');
      alert('Please upload a document first');
      return;
    }

    // If this type already has materials, just show them
    if (preparationMaterials[type]) {
      console.log('Materials already exist for type:', type, '- showing existing materials');
      setActivePreparationType(type);
      return;
    }

    console.log('Setting preparation type and loading state');
    setGeneratingType(type);

    try {
      console.log('Starting document processing...');
      // Get document content for preparation
      const documentContent = await processDocument(currentFile);
      console.log('Document content length:', documentContent.length);

      console.log('Generating preparation materials...');
      const materials = await generatePreparationMaterials(type, documentContent);
      console.log('Generated materials length:', materials.length);
      console.log('Generated materials preview:', materials.substring(0, 200) + '...');

      console.log('Setting preparation materials and showing display');
      setPreparationMaterials(prev => ({
        ...prev,
        [type]: materials
      }));
      setActivePreparationType(type);
      console.log('Preparation materials set successfully for type:', type);
    } catch (error) {
      console.error('Error generating preparation materials:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error generating preparation materials: ${errorMessage}`);
    } finally {
      console.log('Setting loading state to false');
      setGeneratingType(null);
    }
  };

  const handleChatWithDocument = async (userMessage: string) => {
    if (!userMessage.trim() || !documentContent) return;

    // Add user message to chat
    const newUserMessage = { role: 'user' as const, content: userMessage };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsGeneratingResponse(true);

    try {
      const genAI = initializeGemini();
      const modelName = await getAvailableModel(genAI);
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `You are a helpful academic assistant analyzing a document. Based on the following document content, answer the user's question.

IMPORTANT CITATION RULES: 
1. Provide accurate answers based ONLY on the document content
2. The document content includes page markers in format [PAGE X] - use these to determine page numbers
3. For EVERY factual claim, include a citation using this EXACT format:
   [Citation|Page X: "exact quote from document"]
   - Replace X with the actual page number from the [PAGE X] markers
   - Quote the relevant text that supports your claim
   - ALWAYS include the page number if a [PAGE X] marker is present
4. If you cannot find page information for a quote, use: [Citation: "exact quote from document"]
5. If the answer is not in the document, say so clearly
6. Use markdown formatting for better readability
7. Provide multiple citations for comprehensive answers

CITATION FORMAT EXAMPLES:
✓ CORRECT: [Citation|Page 5: "Multimeter (Owon): Used for measuring voltage, current, and resistance."]
✓ CORRECT: [Citation|Page 12: "The resistance of a single lamp is measured directly using the Owon multimeter in Ohm-range"]
✗ WRONG: [Citation|Page X: "..."] (never use "X" as placeholder - use actual number)

Document Content (with [PAGE X] markers):
${documentContent}

Previous conversation:
${chatMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

User Question: ${userMessage}

Please answer with accurate citations including real page numbers from the [PAGE X] markers:`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const newAssistantMessage = { role: 'assistant' as const, content: response };
      setChatMessages(prev => [...prev, newAssistantMessage]);
    } catch (error) {
      console.error('Error generating chat response:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorResponse = { 
        role: 'assistant' as const, 
        content: `Sorry, I encountered an error: ${errorMessage}` 
      };
      setChatMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  const extractFormulasFromDocument = async (file: File): Promise<string[]> => {
    const genAI = initializeGemini();
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });

    const bytes = await file.arrayBuffer();
    const base64Data = arrayBufferToBase64(bytes);

    const prompt = `Extract all mathematical formulas, equations, and mathematical expressions from this document. 

Please return them in the following format:
- Each formula should be on a separate line
- Use LaTeX format for mathematical expressions (enclosed in \\( for inline math or \\[ for display math)
- Include the context or what the formula represents when possible
- Focus on important formulas, equations, theorems, and mathematical relationships
- Skip simple arithmetic unless it's part of a larger formula

Example format:
\\( E = mc^2 \\) - Einstein's mass-energy equivalence
\\( F = ma \\) - Newton's second law of motion
\\[ \\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi} \\] - Gaussian integral

Return only the formulas, one per line. If no formulas are found, return an empty list.`;
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      },
      prompt
    ]);

    const response = result.response.text();
    return response.split('\n').filter(line => line.trim().length > 0);
  };

  const extractDefinitionsFromDocument = async (file: File): Promise<{term: string, definition: string}[]> => {
    const genAI = initializeGemini();
    const modelName = await getAvailableModel(genAI);
    const model = genAI.getGenerativeModel({ model: modelName });
    const bytes = await file.arrayBuffer();
    const base64Data = arrayBufferToBase64(bytes);

    const prompt = `Extract all important definitions, terms, and key concepts from this document.

Please return them in JSON format as an array of objects with "term" and "definition" fields:

[
  {
    "term": "Term or Concept Name",
    "definition": "Clear and concise definition of the term"
  }
]

Focus on:
- Technical terms and jargon
- Key concepts and principles
- Important definitions that are central to understanding the subject
- Scientific or academic terminology

Only include definitions that are explicitly stated or clearly implied in the document. Return valid JSON only.`;
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Data
        }
      },
      prompt
    ]);

    const response = result.response.text();
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.error('Error parsing definitions JSON:', error);
    }

    return [];
  };

  const generateFormulaPDF = async (formulas: string[], definitions: {term: string, definition: string}[]) => {
    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Document Formulas & Definitions</title>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 40px; }
            .section h2 { color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
            .formula-item { margin-bottom: 15px; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #3b82f6; }
            .definition-item { margin-bottom: 20px; padding: 15px; background: #fefce8; border-radius: 8px; border-left: 4px solid #f59e0b; }
            .term { font-weight: bold; font-size: 1.1em; color: #1f2937; margin-bottom: 5px; }
            .definition { color: #374151; }
            .formula { font-family: 'Computer Modern', 'Latin Modern Roman', serif; font-size: 1.2em; color: #1f2937; }
            @media print { body { margin: 20px; } }
          </style>
          <script>
            window.MathJax = {
              tex: {
                inlineMath: [['\\\\(', '\\\\)']],
                displayMath: [['\\\\[', '\\\\]']],
                processEscapes: true,
                processEnvironments: true
              },
              options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
              }
            };
          </script>
          <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
          <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
        </head>
        <body>
          <div class="header">
            <h1>Document Analysis: Formulas & Definitions</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>

          ${formulas.length > 0 ? `
            <div class="section">
              <h2>📐 Mathematical Formulas</h2>
              ${formulas.map(formula => `
                <div class="formula-item">
                  <div class="formula">${formula}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${definitions.length > 0 ? `
            <div class="section">
              <h2>📚 Key Definitions</h2>
              ${definitions.map(def => `
                <div class="definition-item">
                  <div class="term">${def.term}</div>
                  <div class="definition">${def.definition}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${formulas.length === 0 && definitions.length === 0 ? `
            <div class="section">
              <p>No formulas or definitions were extracted from this document.</p>
            </div>
          ` : ''}
        </body>
      </html>
    `;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formulas_definitions.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleExploreTopics = () => {
    if (selectedTopics.length > 0) {
      setAnimatingTopics(selectedTopics);
      setTimeout(() => {
        setShowTopicWorkspace(true);
        setAnimatingTopics([]);
      }, 1000); // Animation duration
    }
  };

  const handleCloseTopicWorkspace = () => {
    setShowTopicWorkspace(false);
    setSelectedTopics([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950">
      {/* Left Sidebar */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-white font-semibold text-sm mb-2">Document Analysis</h3>
          <p className="text-slate-400 text-xs">Extracted formulas and definitions</p>
        </div>

        {/* Formulas Section */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                Mathematical Formulas
              </h4>
              {isExtractingFormulas && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {extractedFormulas.length > 0 ? (
                extractedFormulas.map((formula, index) => (
                  <div key={index} className="bg-slate-800/50 rounded p-3 border border-slate-700">
                    <div className="text-blue-300 text-sm font-mono">
                      {renderMathText(formula)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-xs italic">
                  {isExtractingFormulas ? 'Extracting formulas...' : 'No formulas extracted yet'}
                </p>
              )}
            </div>
          </div>

          {/* Definitions Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-green-400" />
                Key Definitions
              </h4>
              {isExtractingDefinitions && <Loader2 className="h-4 w-4 animate-spin text-green-400" />}
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {extractedDefinitions.length > 0 ? (
                extractedDefinitions.map((def, index) => (
                  <div key={index} className="bg-slate-800/50 rounded p-3 border border-slate-700">
                    <div className="text-green-300 font-medium text-sm mb-1">{def.term}</div>
                    <div className="text-slate-300 text-xs leading-relaxed">{def.definition}</div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-xs italic">
                  {isExtractingDefinitions ? 'Extracting definitions...' : 'No definitions extracted yet'}
                </p>
              )}
            </div>
          </div>

          {/* Preparation Section */}
          <div className="p-3 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-white font-medium text-xs flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-purple-400" />
                I am preparing for
                {currentFile && <span className="text-green-400 text-[10px] ml-1">● Ready</span>}
              </h4>
              {generatingType && <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />}
            </div>
            <div className="space-y-1.5">
              {['test', 'colloquium', 'lab practical', 'seminar', 'exam'].map((type) => {
                const hasContent = !!preparationMaterials[type];
                const isGenerating = generatingType === type;
                const isActive = activePreparationType === type;
                const isDisabled = !currentFile || isGenerating;
                const customSamples = customPreparationMaterials[type] || [];
                const customCount = customSamples.length;
                const favoritesForType = favoritePreparationMaterials.filter(item => item.type === type);
                const favoriteCount = favoritesForType.length;
                const typeLabel = formatPreparationType(type);

                return (
                  <div
                    key={type}
                    className="rounded-md border border-slate-700/50 bg-slate-900/30 p-2 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          console.log('Button clicked:', type, 'disabled:', isDisabled);
                          if (!isDisabled) {
                            handlePreparationTypeSelect(type);
                          }
                        }}
                        disabled={isDisabled}
                        className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all relative ${
                          hasContent
                            ? 'bg-green-600/20 text-green-300 border border-green-500/40 hover:bg-green-600/30'
                            : 'bg-slate-800/40 text-slate-300 border border-slate-700 hover:bg-slate-700/40'
                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {typeLabel}
                        {hasContent && !isGenerating && <span className="ml-1 text-green-400">✓</span>}
                        {isGenerating && <Loader2 className="inline-block ml-1 h-2.5 w-2.5 animate-spin text-purple-400" />}
                        {isActive && !isGenerating && <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-purple-400 text-[8px]">●</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCustomMaterialModal(type)}
                        className="inline-flex items-center gap-0.5 rounded-md border border-slate-700 bg-slate-800/50 px-2 py-1.5 text-[10px] font-medium text-slate-200 transition-colors hover:border-purple-500 hover:bg-slate-700/60"
                        title="Provide sample"
                      >
                        <PlusCircle className="h-3 w-3 text-purple-300" />
                        <span className="hidden sm:inline">Sample</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickSavePreparation(type)}
                        disabled={!preparationMaterials[type]}
                        className={`inline-flex items-center gap-0.5 rounded-md border border-yellow-400/30 px-2 py-1.5 text-[10px] font-medium transition-colors ${
                          preparationMaterials[type]
                            ? 'bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/20'
                            : 'bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-50'
                        }`}
                        title="Quick save"
                      >
                        <Star className="h-3 w-3" />
                        <span className="hidden sm:inline">Save</span>
                      </button>
                    </div>

                    {(customCount > 0 || favoriteCount > 0) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-slate-300">
                        {customCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-800/50 px-1.5 py-0.5">
                            <PlusCircle className="h-2.5 w-2.5 text-purple-300" />
                            {customCount} custom
                          </span>
                        )}
                        {favoriteCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-500/10 px-1.5 py-0.5 text-yellow-200">
                            <Star className="h-2.5 w-2.5" />
                            {favoriteCount} saved
                          </span>
                        )}
                      </div>
                    )}

                    {customCount > 0 && (
                      <div className="mt-1.5 space-y-1 rounded-md border border-slate-700/50 bg-slate-900/40 p-1.5">
                        <p className="text-[9px] uppercase tracking-wide text-slate-400">Custom samples</p>
                        {customSamples.map(sample => (
                          <div
                            key={sample.id}
                            className="flex items-center justify-between gap-1.5 rounded-md border border-slate-700 bg-slate-800/50 p-1.5"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-medium text-slate-200 truncate">{sample.title}</p>
                              <p className="text-[9px] text-slate-500">{new Date(sample.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleUseCustomSample(type, sample.id)}
                                className="inline-flex items-center gap-0.5 rounded-md border border-slate-600 bg-slate-900 px-1.5 py-0.5 text-[9px] font-medium text-slate-200 transition-colors hover:border-purple-400"
                                title="Use sample"
                              >
                                <Eye className="h-2.5 w-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMarkSampleFavorite(type, sample.id)}
                                className="inline-flex items-center gap-0.5 rounded-md border border-yellow-400/30 bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-medium text-yellow-200 transition-colors hover:bg-yellow-500/20"
                                title="Mark as favorite"
                              >
                                <Star className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!currentFile && (
              <p className="text-slate-500 text-[10px] italic mt-1.5">
                Upload a document to generate preparation materials
              </p>
            )}

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setShowFavoritesPanel(prev => !prev)}
                className="flex w-full items-center justify-between rounded-md border border-yellow-400/30 bg-yellow-500/10 px-2.5 py-1.5 text-[10px] font-medium text-yellow-200 transition-colors hover:bg-yellow-500/20"
              >
                <span className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" />
                  {showFavoritesPanel ? 'Hide favorites' : 'Show favorites'}
                </span>
                <span className="text-[11px] text-yellow-100">{favoritePreparationMaterials.length} saved</span>
              </button>

              {showFavoritesPanel && (
                <div className="space-y-2 rounded-lg border border-slate-700/70 bg-slate-900/60 p-3 max-h-56 overflow-y-auto">
                  {favoritePreparationMaterials.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      No favorites yet. Save generated or custom materials to access them quickly.
                    </p>
                  ) : (
                    favoritePreparationMaterials.map(favorite => (
                      <div
                        key={favorite.id}
                        className="rounded-md border border-slate-700 bg-slate-800/60 p-3"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="flex items-center gap-2 text-sm font-semibold text-white">
                              <Star className="h-4 w-4 text-yellow-300" />
                              {favorite.title}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Type: {formatPreparationType(favorite.type)} • Source: {favorite.source === 'custom' ? 'Custom sample' : 'Generated'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleApplyFavoriteMaterial(favorite.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:border-purple-400 hover:text-purple-200"
                            >
                              <Eye className="h-3 w-3" />
                              Use now
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFavoriteMaterial(favorite.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-200 transition-colors hover:bg-red-500/20"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chat with Document Button */}
          {currentFile && documentContent && (
            <div className="p-4 border-t border-slate-800 space-y-3">
              <button
                onClick={() => setShowDocumentChat(true)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium shadow-lg hover:scale-105"
              >
                <MessageSquare className="h-4 w-4" />
                Chat with Document
              </button>
              
              {/* Generate Simulations Button */}
              <button
                onClick={() => {
                  const currentDoc = uploadedFiles.find(doc => doc.name === currentFile.name);
                  if (currentDoc) {
                    setSelectedDocumentForSimulation(currentDoc);
                    setShowSimulationGenerator(true);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium shadow-lg hover:scale-105"
              >
                <Calculator className="h-4 w-4" />
                Generate Simulations
              </button>

              {/* Simulation Idea Input */}
              <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                <label className="block text-slate-300 text-xs font-medium mb-2 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-yellow-400" />
                  Have a simulation idea?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Describe your simulation idea..."
                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-md px-3 py-2 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        // Handle simulation idea submission
                        const idea = e.currentTarget.value.trim();
                        console.log('Simulation idea:', idea);
                        // You can add your custom logic here
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      if (input && input.value.trim()) {
                        const idea = input.value.trim();
                        console.log('Simulation idea:', idea);
                        // You can add your custom logic here
                        input.value = '';
                      }
                    }}
                    className="flex items-center gap-1 bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-200 px-3 py-2 rounded-md transition-colors text-xs font-medium"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Submit</span>
                  </button>
                </div>
                <p className="text-slate-500 text-[10px] mt-1.5 italic">
                  Share your ideas for custom simulations based on this document
                </p>
              </div>
              
              <p className="text-slate-400 text-xs italic text-center">
                Ask questions or create interactive simulations
              </p>
            </div>
          )}
        </div>

        {/* Download Button */}
        {(extractedFormulas.length > 0 || extractedDefinitions.length > 0) && (
          <div className="p-4 border-t border-slate-800">
            <button
              onClick={() => generateFormulaPDF(extractedFormulas, extractedDefinitions)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 shadow-lg">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <FileText className="h-4 w-4 text-blue-300" />
            Document Understanding
          </h2>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <Sparkles className="h-3 w-3 text-blue-300" />
            Upload PDFs and get AI-powered summaries, analysis, and insights using Gemini.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit Document Understanding
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="h-full flex">
          {/* Left Side - Document Processing */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Upload Section */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Upload Document</h3>

                <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isProcessing}
                  />

                  {isProcessing ? (
                    <div className="space-y-6">
                      {/* Custom Loading Animation */}
                      <RandomDocumentLoader className="my-4" />
                      <div>
                        <p className="text-white font-medium">
                          Processing: {currentFile?.name}
                        </p>
                        <p className="text-cyan-400 text-sm mt-1 animate-pulse">
                          {processingStatus}
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2 text-slate-400 text-xs">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Using Gemini AI...</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="h-12 w-12 text-slate-400 mx-auto" />
                      <div>
                        <p className="text-white font-medium">Drop your PDF here or click to browse</p>
                        <p className="text-slate-400 text-sm mt-1">
                          Supports PDF files up to 50MB. Files are processed using Gemini's document understanding capabilities.
                        </p>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        <Upload className="h-4 w-4" />
                        Choose File
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Processed Documents */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Processed Documents</h3>

                  {uploadedFiles.map((doc) => (
                    <div key={doc.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-white font-medium">{doc.name}</h4>
                          <p className="text-slate-400 text-sm">
                            Processed on {doc.uploadTime.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDownloadSummary(doc)}
                            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded text-sm transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            Download Summary
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Eye className="h-4 w-4 text-blue-400" />
                          <span className="text-white font-medium">Document Summary</span>
                        </div>
                        <div className="text-slate-300 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                          {doc.summary}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {uploadedFiles.length === 0 && !isProcessing && (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-400 mb-2">No documents processed yet</h3>
                  <p className="text-slate-500">
                    Upload a PDF to get started with AI-powered document analysis.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Document Overview */}
          <div className="w-80 bg-slate-800/30 border-l border-slate-700 p-6 overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                  Document Overview
                </h3>

                {uploadedFiles.length > 0 ? (
                  <div className="space-y-4">
                    {uploadedFiles.slice(0, 3).map((doc, index) => (
                      <div key={doc.id} className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                        <h4 className="text-white font-medium text-sm mb-2 truncate">{doc.name}</h4>

                        {doc.subject && (
                          <div className="mb-3">
                            <span className="text-xs text-slate-400 uppercase tracking-wide">Subject</span>
                            <p className="text-white text-sm font-medium">{doc.subject}</p>
                          </div>
                        )}

                        {doc.topics && doc.topics.length > 0 && (
                          <div className="mb-3">
                            <span className="text-xs text-slate-400 uppercase tracking-wide mb-2 block">Topics</span>
                            <div className="flex flex-wrap gap-1">
                              {doc.topics.slice(0, 6).map((topic, topicIndex) => (
                                <button
                                  key={topicIndex}
                                  onClick={() => handleTopicToggle(topic)}
                                  className={`inline-block text-xs px-2 py-1 rounded-full border transition-all duration-200 ${
                                    selectedTopics.includes(topic)
                                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg scale-105'
                                      : 'bg-blue-600/20 text-blue-300 border-blue-600/30 hover:bg-blue-600/30 hover:scale-105'
                                  } ${animatingTopics.includes(topic) ? 'animate-pulse' : ''}`}
                                >
                                  {topic}
                                </button>
                              ))}
                              {doc.topics.length > 6 && (
                                <span className="text-xs text-slate-400">+{doc.topics.length - 6} more</span>
                              )}
                            </div>
                          </div>
                        )}

                        {doc.metadata && (
                          <div className="space-y-2">
                            {doc.metadata.fileSize && (
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">File Size:</span>
                                <span className="text-white">{doc.metadata.fileSize}</span>
                              </div>
                            )}
                            {doc.metadata.estimatedPages && (
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Pages:</span>
                                <span className="text-white">{doc.metadata.estimatedPages}</span>
                              </div>
                            )}
                            {doc.metadata.difficulty && (
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Level:</span>
                                <span className="text-white">{doc.metadata.difficulty}</span>
                              </div>
                            )}
                            {doc.metadata.type && (
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Type:</span>
                                <span className="text-white">{doc.metadata.type}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {uploadedFiles.length > 3 && (
                      <p className="text-center text-slate-400 text-sm">
                        +{uploadedFiles.length - 3} more documents
                      </p>
                    )}

                    {/* Topic Exploration Section */}
                    {selectedTopics.length > 0 && (
                      <div className="mt-6 p-4 bg-slate-800/50 border border-slate-600 rounded-lg">
                        <h4 className="text-white font-medium text-sm mb-3">Selected Topics</h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {selectedTopics.map((topic, index) => (
                            <span
                              key={index}
                              className="inline-block bg-green-600/20 text-green-300 text-xs px-3 py-1 rounded-full border border-green-600/30"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={handleExploreTopics}
                          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                        >
                          <Sparkles className="inline h-4 w-4 mr-2" />
                          Choose these and explore
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">
                      Upload documents to see analysis overview
                    </p>
                  </div>
                )}
              </div>

              {/* Preparation Materials Display - Main View */}
              {(() => {
                const hasAnyMaterials = Object.keys(preparationMaterials).length > 0;
                const currentMaterial = activePreparationType ? preparationMaterials[activePreparationType] : null;
                console.log('Main view - Rendering check - hasAnyMaterials:', hasAnyMaterials, 'activeType:', activePreparationType);
                
                return hasAnyMaterials && currentMaterial && !showTopicWorkspace && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 w-full max-w-5xl my-8 shadow-2xl">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h4 className="text-white font-bold flex items-center gap-2 text-2xl">
                            <Target className="h-7 w-7 text-purple-400" />
                            {activePreparationType ? `${activePreparationType.charAt(0).toUpperCase() + activePreparationType.slice(1)} Preparation Materials` : 'Preparation Materials'}
                          </h4>
                          {/* Tabs for switching between different preparation types */}
                          <div className="flex gap-2 mt-4 flex-wrap">
                            {Object.keys(preparationMaterials).map((type) => (
                              <button
                                key={type}
                                onClick={() => setActivePreparationType(type)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                  activePreparationType === type
                                    ? 'bg-purple-600 text-white border border-purple-500'
                                    : 'bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700'
                                }`}
                              >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => setActivePreparationType(null)}
                          className="text-slate-400 hover:text-white transition-colors p-2 rounded hover:bg-slate-700"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                      <div className="max-h-[70vh] overflow-y-auto bg-slate-800/50 rounded-lg p-8 border border-slate-600">
                        <div className="prose prose-invert prose-slate max-w-none prose-lg">
                          <ReactMarkdown
                            components={{
                              h1: ({ children }) => <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-purple-400 pb-3 mt-8 first:mt-0">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-2xl font-semibold text-purple-300 mb-4 mt-8 border-b border-slate-600 pb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-xl font-medium text-green-300 mb-3 mt-6">{children}</h3>,
                              h4: ({ children }) => <h4 className="text-lg font-medium text-blue-300 mb-2 mt-4">{children}</h4>,
                              p: ({ children }) => {
                                const text = React.Children.toArray(children).join('');
                                if (text.includes('$') || text.includes('\\(') || text.includes('\\[')) {
                                  return <p className="text-slate-200 mb-4 leading-relaxed text-base">{renderMathText(text)}</p>;
                                }
                                return <p className="text-slate-200 mb-4 leading-relaxed text-base">{children}</p>;
                              },
                              ul: ({ children }) => <ul className="text-slate-200 mb-6 ml-6 space-y-2 list-disc marker:text-purple-400">{children}</ul>,
                              ol: ({ children }) => <ol className="text-slate-200 mb-6 ml-6 space-y-2 list-decimal marker:text-purple-400">{children}</ol>,
                              li: ({ children }) => {
                                const text = React.Children.toArray(children).join('');
                                if (text.includes('$') || text.includes('\\(') || text.includes('\\[')) {
                                  return <li className="text-slate-200 leading-relaxed pl-2">{renderMathText(text)}</li>;
                                }
                                return <li className="text-slate-200 leading-relaxed pl-2">{children}</li>;
                              },
                              strong: ({ children }) => {
                                const text = React.Children.toArray(children).join('');
                                if (text.includes('$') || text.includes('\\(') || text.includes('\\[')) {
                                  return <strong className="text-white font-bold">{renderMathText(text)}</strong>;
                                }
                                return <strong className="text-white font-bold">{children}</strong>;
                              },
                              em: ({ children }) => {
                                const text = React.Children.toArray(children).join('');
                                if (text.includes('$') || text.includes('\\(') || text.includes('\\[')) {
                                  return <em className="text-purple-300 italic font-medium">{renderMathText(text)}</em>;
                                }
                                return <em className="text-purple-300 italic font-medium">{children}</em>;
                              },
                              code: ({ children }) => <code className="bg-slate-700 text-green-300 px-2 py-1 rounded text-sm font-mono border border-slate-600">{children}</code>,
                              pre: ({ children }) => <pre className="bg-slate-900 text-slate-200 p-6 rounded-lg overflow-x-auto border border-slate-600 my-6 text-sm leading-relaxed">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-purple-400 pl-6 italic text-slate-300 my-6 bg-slate-700/30 py-4 px-6 rounded-r-lg">{children}</blockquote>,
                              hr: () => <hr className="border-slate-600 my-8" />,
                            }}
                          >
                            {currentMaterial}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className="mt-6 flex gap-3 justify-center flex-wrap">
                        <button
                          onClick={handleSaveActiveMaterialToFavorites}
                          className="flex items-center gap-2 border border-yellow-400/40 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-200 px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                        >
                          <Star className="h-5 w-5" />
                          Save to Favorites
                        </button>
                        <button
                          onClick={() => {
                            if (activePreparationType) {
                              const blob = new Blob([preparationMaterials[activePreparationType]], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `${activePreparationType}_preparation_materials.txt`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }
                          }}
                          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                        >
                          <Download className="h-5 w-5" />
                          Download as Text
                        </button>
                        <button
                          onClick={() => {
                            if (activePreparationType) {
                              navigator.clipboard.writeText(preparationMaterials[activePreparationType]);
                              alert('Copied to clipboard!');
                            }
                          }}
                          className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                        >
                          Copy to Clipboard
                        </button>
                        <button
                          onClick={() => {
                            if (activePreparationType) {
                              const content = preparationMaterials[activePreparationType];
                              
                              // Convert markdown to HTML properly
                              let html = content
                                // Headers
                                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                                // Bold
                                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                // Italic
                                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                // Code blocks
                                .replace(/```[\s\S]*?```/g, (match) => {
                                  const code = match.replace(/```/g, '').trim();
                                  return `<pre><code>${code}</code></pre>`;
                                })
                                // Inline code
                                .replace(/`(.+?)`/g, '<code>$1</code>')
                                // Blockquotes
                                .replace(/^> (.+$)/gim, '<blockquote>$1</blockquote>')
                                // Unordered lists
                                .replace(/^\* (.+$)/gim, '<li>$1</li>')
                                .replace(/^- (.+$)/gim, '<li>$1</li>')
                                // Ordered lists
                                .replace(/^\d+\. (.+$)/gim, '<li>$1</li>')
                                // Line breaks
                                .replace(/\n\n/g, '</p><p>')
                                .replace(/\n/g, '<br>');
                              
                              // Wrap list items in ul/ol tags
                              html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
                              
                              const printWindow = window.open('', '_blank');
                              if (printWindow) {
                                printWindow.document.write(`
                                  <html>
                                    <head>
                                      <title>${activePreparationType.charAt(0).toUpperCase() + activePreparationType.slice(1)} Preparation Materials</title>
                                      <style>
                                        @media print {
                                          body { margin: 0.5in; }
                                        }
                                        body { 
                                          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                                          line-height: 1.7; 
                                          margin: 40px;
                                          color: #1a1a1a;
                                          max-width: 900px;
                                        }
                                        h1 { 
                                          color: #7c3aed; 
                                          border-bottom: 3px solid #a855f7; 
                                          padding-bottom: 12px; 
                                          margin-top: 40px;
                                          margin-bottom: 20px;
                                          font-size: 28px;
                                        }
                                        h2 { 
                                          color: #7c3aed; 
                                          margin-top: 32px;
                                          margin-bottom: 16px;
                                          border-bottom: 2px solid #e0e0e0;
                                          padding-bottom: 8px;
                                          font-size: 24px;
                                        }
                                        h3 { 
                                          color: #059669; 
                                          margin-top: 24px;
                                          margin-bottom: 12px;
                                          font-size: 20px;
                                        }
                                        h4 {
                                          color: #0369a1;
                                          margin-top: 20px;
                                          margin-bottom: 10px;
                                          font-size: 18px;
                                        }
                                        p {
                                          margin-bottom: 12px;
                                          line-height: 1.7;
                                        }
                                        strong { 
                                          font-weight: 700;
                                          color: #000;
                                        }
                                        em {
                                          font-style: italic;
                                          color: #444;
                                        }
                                        ul, ol { 
                                          margin-left: 30px;
                                          margin-bottom: 16px;
                                          line-height: 1.8;
                                        }
                                        li {
                                          margin-bottom: 8px;
                                        }
                                        code { 
                                          background: #f1f5f9; 
                                          padding: 3px 8px; 
                                          border-radius: 4px; 
                                          font-family: 'Courier New', monospace;
                                          font-size: 14px;
                                          color: #c7254e;
                                          border: 1px solid #e1e8ed;
                                        }
                                        pre { 
                                          background: #f8fafc; 
                                          padding: 16px; 
                                          border-radius: 6px; 
                                          overflow-x: auto; 
                                          border: 1px solid #e2e8f0;
                                          margin: 16px 0;
                                        }
                                        pre code {
                                          background: none;
                                          padding: 0;
                                          border: none;
                                          color: #1a1a1a;
                                        }
                                        blockquote { 
                                          border-left: 4px solid #a855f7; 
                                          padding-left: 20px; 
                                          margin: 20px 0; 
                                          font-style: italic; 
                                          background: #faf5ff; 
                                          padding: 16px 20px;
                                          border-radius: 4px;
                                        }
                                        hr {
                                          border: none;
                                          border-top: 2px solid #e0e0e0;
                                          margin: 32px 0;
                                        }
                                      </style>
                                    </head>
                                    <body>
                                      <h1 style="border-bottom: 3px solid #a855f7; color: #7c3aed; padding-bottom: 12px;">
                                        ${activePreparationType.charAt(0).toUpperCase() + activePreparationType.slice(1)} Preparation Materials
                                      </h1>
                                      <div>${html}</div>
                                    </body>
                                  </html>
                                `);
                                printWindow.document.close();
                                printWindow.print();
                              }
                            }
                          }}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                        >
                          <Eye className="h-5 w-5" />
                          Print Preview
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Topic Exploration Workspace */}
      {showTopicWorkspace && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-7xl w-full mx-4 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                  Topic Exploration Workspace
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  Explore and learn about the selected topics
                </p>
              </div>
              <button
                onClick={handleCloseTopicWorkspace}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Selected Topics Display */}
              <div>
                <h3 className="text-white font-medium mb-3">Selected Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTopics.map((topic, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-bottom-4 duration-500"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {topic}
                    </div>
                  ))}
                </div>
              </div>

              {/* Topic Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleGenerateStudyMaterials}
                  disabled={isGeneratingMaterials}
                  className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingMaterials ? (
                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                  ) : (
                    <BookOpen className="h-5 w-5 text-blue-400 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="text-left">
                    <div className="text-white font-medium">Study Materials</div>
                    <div className="text-slate-400 text-sm">
                      {isGeneratingMaterials ? 'Generating...' : 'Generate notes and resources'}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    // TODO: Implement quiz generation
                    alert('Generating quiz for: ' + selectedTopics.join(', '));
                  }}
                  className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-all duration-200 group"
                >
                  <Target className="h-5 w-5 text-green-400 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="text-white font-medium">Practice Quiz</div>
                    <div className="text-slate-400 text-sm">Test your knowledge</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    // TODO: Implement research workspace
                    alert('Opening research workspace for: ' + selectedTopics.join(', '));
                  }}
                  className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-all duration-200 group"
                >
                  <Search className="h-5 w-5 text-purple-400 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="text-white font-medium">Research Hub</div>
                    <div className="text-slate-400 text-sm">Deep dive exploration</div>
                  </div>
                </button>

                <button
                  onClick={handleGenerateMindMap}
                  disabled={isGeneratingMindMap}
                  className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingMindMap ? (
                    <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-orange-400 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="text-left">
                    <div className="text-white font-medium">Mind Map</div>
                    <div className="text-slate-400 text-sm">
                      {isGeneratingMindMap ? 'Generating...' : 'Visual connections'}
                    </div>
                  </div>
                </button>
              </div>

              {(showMindMap || isGeneratingMindMap) && (
                <div className="mt-10 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60 shadow-[0_25px_80px_rgba(15,23,42,0.45)]">
                  <div className="flex items-center justify-between border-b border-slate-700/80 bg-slate-900/80 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-white">AI Study Mind Map</div>
                        <p className="text-sm text-slate-400">
                          Visualising {selectedTopics.length > 0 ? selectedTopics.join(', ') : 'selected topics'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {mindMapError && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm text-amber-200">
                          Showing fallback map: {mindMapError}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setShowMindMap(false);
                          setMindMapError(null);
                        }}
                        className="rounded-full border border-slate-600/70 p-2 text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                        aria-label="Close mind map"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    {isGeneratingMindMap && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/70 backdrop-blur">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-300" />
                        <p className="text-sm text-slate-300">Asking the study assistant to draft your map…</p>
                      </div>
                    )}

                    {mindMapData && mindMapData.learningObjectives && mindMapData.learningObjectives.length > 0 && (
                      <div className="flex flex-wrap gap-3 border-b border-slate-800 bg-slate-900/70 px-6 py-4">
                        {mindMapData.learningObjectives.map((objective, index) => (
                          <div
                            key={`objective-${index}`}
                            className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm text-blue-100"
                          >
                            {objective}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-slate-950/40 px-6 py-6">
                      <DocumentMindMap mindMap={mindMapData} />
                    </div>
                  </div>
                </div>
              )}

              {/* Study Materials Display */}
              {showStudyMaterials && studyMaterials && (
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-8 animate-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-white font-medium flex items-center gap-2 text-lg">
                      <BookOpen className="h-6 w-6 text-blue-400" />
                      Generated Study Materials
                    </h4>
                    <button
                      onClick={() => setShowStudyMaterials(false)}
                      className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto bg-slate-900/50 rounded-lg p-6 border border-slate-700">
                    <div className="prose prose-invert prose-slate max-w-none prose-lg">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-blue-400 pb-3">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-2xl font-semibold text-blue-300 mb-4 mt-8 border-b border-slate-600 pb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-xl font-medium text-green-300 mb-3 mt-6">{children}</h3>,
                          h4: ({ children }) => <h4 className="text-lg font-medium text-purple-300 mb-2 mt-4">{children}</h4>,
                          p: ({ children }) => {
                            // Check if this paragraph contains math expressions
                            const text = React.Children.toArray(children).join('');
                            if (text.includes('$')) {
                              return <p className="text-slate-200 mb-4 leading-relaxed text-base">{renderMathText(text)}</p>;
                            }
                            return <p className="text-slate-200 mb-4 leading-relaxed text-base">{children}</p>;
                          },
                          ul: ({ children }) => <ul className="text-slate-200 mb-6 ml-8 space-y-2 list-disc">{children}</ul>,
                          ol: ({ children }) => <ol className="text-slate-200 mb-6 ml-8 space-y-2 list-decimal">{children}</ol>,
                          li: ({ children }) => {
                            // Check if this list item contains math expressions
                            const text = React.Children.toArray(children).join('');
                            if (text.includes('$')) {
                              return <li className="text-slate-200 leading-relaxed">{renderMathText(text)}</li>;
                            }
                            return <li className="text-slate-200 leading-relaxed">{children}</li>;
                          },
                          strong: ({ children }) => {
                            const text = React.Children.toArray(children).join('');
                            if (text.includes('$')) {
                              return <strong className="text-white font-bold text-lg">{renderMathText(text)}</strong>;
                            }
                            return <strong className="text-white font-bold text-lg">{children}</strong>;
                          },
                          em: ({ children }) => {
                            const text = React.Children.toArray(children).join('');
                            if (text.includes('$')) {
                              return <em className="text-blue-300 italic font-medium">{renderMathText(text)}</em>;
                            }
                            return <em className="text-blue-300 italic font-medium">{children}</em>;
                          },
                          code: ({ children }) => <code className="bg-slate-700 text-green-300 px-3 py-1 rounded-md text-sm font-mono border border-slate-600">{children}</code>,
                          pre: ({ children }) => <pre className="bg-slate-800 text-slate-200 p-6 rounded-lg overflow-x-auto border border-slate-600 my-6 text-sm leading-relaxed">{children}</pre>,
                          blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-400 pl-6 italic text-slate-300 my-6 bg-slate-800/30 py-4 px-6 rounded-r-lg">{children}</blockquote>,
                          hr: () => <hr className="border-slate-600 my-8" />,
                        }}
                      >
                        {studyMaterials}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3 justify-center flex-wrap">
                    <button
                      onClick={() => {
                        const blob = new Blob([studyMaterials], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `study_materials_${selectedTopics.join('_').replace(/\s+/g, '_')}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                    >
                      <Download className="h-5 w-5" />
                      Download as Text
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(studyMaterials);
                        // Could add a toast notification here
                      }}
                      className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                    >
                      Copy to Clipboard
                    </button>
                    <button
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Study Materials - ${selectedTopics.join(', ')}</title>
                                <style>
                                  body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
                                  h1 { color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
                                  h2 { color: #1e40af; margin-top: 30px; }
                                  h3 { color: #059669; margin-top: 20px; }
                                  strong { font-weight: bold; }
                                  ul, ol { margin-left: 20px; }
                                  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
                                  pre { background: #f8fafc; padding: 15px; border-radius: 8px; overflow-x: auto; border: 1px solid #e2e8f0; }
                                  blockquote { border-left: 4px solid #3b82f6; padding-left: 15px; margin: 20px 0; font-style: italic; background: #f0f9ff; padding: 10px 15px; }
                                </style>
                              </head>
                              <body>
                                ${studyMaterials.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                          printWindow.print();
                        }
                      }}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                    >
                      <Eye className="h-5 w-5" />
                      Print Preview
                    </button>
                  </div>
                </div>
              )}

              {/* AI Assistant Section */}
              <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-400" />
                  AI Learning Assistant
                </h4>
                <p className="text-slate-400 text-sm mb-4">
                  Get personalized help and explanations for these topics
                </p>
                <button
                  onClick={() => {
                    // TODO: Implement AI chat for topics
                    alert('Starting AI assistant for topics: ' + selectedTopics.join(', '));
                  }}
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white px-4 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Start AI Learning Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat with Document Modal */}
      {showDocumentChat && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`bg-slate-900 border border-slate-700 rounded-lg h-[85vh] flex shadow-2xl transition-all duration-300 ${
            showPdfViewer ? 'w-full max-w-7xl' : 'w-full max-w-4xl'
          }`}>
            {/* Chat Section */}
            <div className={`flex flex-col transition-all duration-300 ${
              showPdfViewer ? 'w-2/5 border-r border-slate-700' : 'w-full'
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-400" />
                    Chat with Document
                  </h2>
                  <p className="text-slate-400 text-sm mt-1">Ask questions and get answers with citations</p>
                </div>
                <button
                  onClick={() => {
                    setShowDocumentChat(false);
                    setShowPdfViewer(false);
                  }}
                  className="text-slate-400 hover:text-white transition-colors p-2 rounded hover:bg-slate-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="text-center text-slate-400 mt-20">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                  <p className="text-lg font-medium">Start a conversation</p>
                  <p className="text-sm mt-2">Ask any question about your document</p>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                    <button
                      onClick={() => setChatInput("What are the main topics covered in this document?")}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-3 text-left text-sm text-slate-300 transition-all"
                    >
                      What are the main topics?
                    </button>
                    <button
                      onClick={() => setChatInput("Can you summarize the key findings?")}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-3 text-left text-sm text-slate-300 transition-all"
                    >
                      Summarize key findings
                    </button>
                    <button
                      onClick={() => setChatInput("What are the important formulas or equations?")}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-3 text-left text-sm text-slate-300 transition-all"
                    >
                      Show important formulas
                    </button>
                    <button
                      onClick={() => setChatInput("Explain the methodology used")}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg p-3 text-left text-sm text-slate-300 transition-all"
                    >
                      Explain methodology
                    </button>
                  </div>
                </div>
              ) : (
                chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 border border-slate-700 text-slate-200'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => {
                                return <p className="mb-2 leading-relaxed"><CitationText text={children} /></p>;
                              },
                              strong: ({ children }) => <strong className="text-white font-bold">{children}</strong>,
                              em: ({ children }) => <em className="text-blue-300">{children}</em>,
                              code: ({ children }) => <code className="bg-slate-700 text-green-300 px-2 py-1 rounded text-xs">{children}</code>,
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-cyan-400 pl-4 italic text-slate-300 my-2 bg-slate-700/30 py-2 rounded-r">
                                  {children}
                                </blockquote>
                              ),
                              ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                              li: ({ children }) => {
                                return <li className="mb-1"><CitationText text={children} /></li>;
                              },
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isGeneratingResponse && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-700">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (chatInput.trim() && !isGeneratingResponse) {
                    handleChatWithDocument(chatInput);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question about your document..."
                  disabled={isGeneratingResponse}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isGeneratingResponse}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isGeneratingResponse ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Send
                    </>
                  )}
                </button>
              </form>
            </div>
            </div>

            {/* PDF Viewer Section */}
            {showPdfViewer && pdfFileUrl && (
              <div className="w-3/5 flex flex-col bg-slate-950 border-l border-slate-700">
                {/* PDF Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                  <div className="flex-1">
                    <h3 className="text-white font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-400" />
                      Document Viewer
                    </h3>
                    {highlightAreas.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-green-400">
                          ✓ {highlightAreas.length} highlight(s) active
                        </p>
                        <button
                          onClick={() => setHighlightAreas([])}
                          className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    {searchingPages && (
                      <div className="flex items-center gap-2 mt-1">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                        <p className="text-xs text-blue-400">Searching pages...</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Zoom Controls */}
                  <div className="flex items-center gap-2 mr-4">
                    <ZoomOut>
                      {(props) => (
                        <button
                          onClick={props.onClick}
                          className="text-slate-400 hover:text-white hover:bg-slate-700 transition-colors p-2 rounded"
                          title="Zoom Out"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                          </svg>
                        </button>
                      )}
                    </ZoomOut>
                    
                    <CurrentScale>
                      {(props) => (
                        <span className="text-slate-300 text-sm font-medium min-w-[60px] text-center">
                          {Math.round(props.scale * 100)}%
                        </span>
                      )}
                    </CurrentScale>
                    
                    <ZoomIn>
                      {(props) => (
                        <button
                          onClick={props.onClick}
                          className="text-slate-400 hover:text-white hover:bg-slate-700 transition-colors p-2 rounded"
                          title="Zoom In"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                          </svg>
                        </button>
                      )}
                    </ZoomIn>
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowPdfViewer(false);
                      setHighlightAreas([]);
                    }}
                    className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* PDF Viewer */}
                <div 
                  className="flex-1 overflow-auto bg-slate-900" 
                  style={{ height: 'calc(85vh - 80px)' }}
                >
                  <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
                    <Viewer
                      fileUrl={pdfFileUrl}
                      plugins={[highlightPluginInstance, zoomPluginInstance]}
                      defaultScale={1.2}
                      theme={{
                        theme: 'dark',
                      }}
                    />
                  </Worker>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showCustomMaterialModal && customMaterialType && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-purple-300" />
                  Provide sample for {formatPreparationType(customMaterialType)}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Add your own pattern or sample to guide future generated materials.
                </p>
              </div>
              <button
                onClick={handleCloseCustomMaterialModal}
                className="text-slate-400 hover:text-white transition-colors p-2 rounded hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">
                  Sample title (optional)
                </label>
                <input
                  value={customMaterialTitle}
                  onChange={(event) => setCustomMaterialTitle(event.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  placeholder="e.g., Midterm practice outline"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400 mb-2 block">
                  Pattern or sample content
                </label>
                <textarea
                  value={customMaterialContent}
                  onChange={(event) => setCustomMaterialContent(event.target.value)}
                  className="h-48 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  placeholder="Paste or describe your preferred pattern..."
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  The AI will use this sample as a guide when generating future materials for this preparation type.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={customMaterialFavorite}
                  onChange={(event) => setCustomMaterialFavorite(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-400"
                />
                Save this sample to favorites for quick access later
              </label>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={handleCloseCustomMaterialModal}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomMaterial}
                className="inline-flex items-center gap-2 rounded-md border border-purple-500/50 bg-purple-600/20 px-4 py-2 text-sm font-semibold text-purple-200 transition-colors hover:bg-purple-600/30"
              >
                <PlusCircle className="h-4 w-4" />
                Save sample
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Simulation Generator Modal */}
      {showSimulationGenerator && selectedDocumentForSimulation && (
        <div className="fixed inset-0 z-50 overflow-auto">
          <div className="min-h-screen">
            <DynamicSimulationGenerator
              documentContent={documentContent}
              documentName={selectedDocumentForSimulation.name}
              documentId={selectedDocumentForSimulation.id}
              apiKey={apiKey}
              onClose={() => {
                setShowSimulationGenerator(false);
                setSelectedDocumentForSimulation(null);
              }}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default DocumentUnderstandingWorkspace;
