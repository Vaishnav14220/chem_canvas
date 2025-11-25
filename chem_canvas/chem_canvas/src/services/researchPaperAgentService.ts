/**
 * Research Paper Agent Service
 * 
 * Orchestrates multiple specialized sub-agents to generate comprehensive
 * research papers from uploaded source materials (literature, data, reports).
 * 
 * Based on DeepAgents framework with LaTeX output integration.
 * 
 * Sub-agents:
 * - Literature Review Agent: Analyzes uploaded papers and extracts key findings
 * - Introduction Agent: Writes compelling introductions with context
 * - Methodology Agent: Describes research methods and approaches
 * - Results Agent: Analyzes data and presents findings
 * - Discussion Agent: Interprets results and compares with literature
 * - Conclusion Agent: Summarizes key contributions and future work
 * - References Agent: Manages citations and bibliography
 */

import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import { generateTextContent, isGeminiInitialized, initializeGeminiWithFirebaseKey } from './geminiService';
import { 
  writeLatexFile, 
  getLatexFiles, 
  compileLatexProject, 
  type CompileResult 
} from './latexAgentService';
import {
  extractFromImage,
  extractPDFContent,
  type TableData,
  type FigureData,
  type FormulaData,
  type ExtractedDocumentContent
} from './ocrService';

// ==========================================
// Types & Interfaces
// ==========================================

export interface UploadedFile {
  id: string;
  name: string;
  type: 'literature' | 'data' | 'report' | 'notes' | 'other';
  content: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  extractedInfo?: ExtractedInfo;
  ocrContent?: ExtractedDocumentContent;
  extractedImages?: FigureData[];
  extractedTables?: TableData[];
  extractedFormulas?: FormulaData[];
}

export interface ExtractedInfo {
  title?: string;
  authors?: string[];
  abstract?: string;
  keyFindings?: string[];
  methodology?: string;
  data?: any;
  citations?: string[];
}

export interface PaperSection {
  id: string;
  name: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  content: string;
  latexContent: string;
  agent: string;
  progress: number;
  wordCount: number;
  citations: string[];
}

export interface ResearchPaperConfig {
  title: string;
  authors: string[];
  affiliation?: string;
  abstract?: string;
  paperType: 'research' | 'review' | 'case-study' | 'thesis';
  targetLength: 'short' | 'medium' | 'long' | 'thesis';
  citationStyle: 'apa' | 'ieee' | 'chicago' | 'mla';
  includeAppendix: boolean;
  customSections?: string[];
}

export interface AgentProgress {
  agentName: string;
  status: 'idle' | 'working' | 'completed' | 'error';
  currentTask: string;
  progress: number;
  output?: string;
}

export interface ResearchPaperState {
  config: ResearchPaperConfig | null;
  uploadedFiles: UploadedFile[];
  sections: PaperSection[];
  agentProgress: AgentProgress[];
  currentPhase: 'setup' | 'analyzing' | 'writing' | 'compiling' | 'complete';
  overallProgress: number;
  latexDocument: string;
  compiledPdfUrl: string | null;
  errors: string[];
  logs: string[];
}

export type ResearchPaperEventType = 
  | 'file-uploaded'
  | 'file-analyzed'
  | 'agent-started'
  | 'agent-progress'
  | 'agent-completed'
  | 'section-started'
  | 'section-progress'
  | 'section-completed'
  | 'compilation-started'
  | 'compilation-completed'
  | 'error';

export interface ResearchPaperEvent {
  type: ResearchPaperEventType;
  data: any;
  timestamp: Date;
  message: string;
}

export type ResearchPaperEventCallback = (event: ResearchPaperEvent) => void;

// ==========================================
// State Management
// ==========================================

let state: ResearchPaperState = {
  config: null,
  uploadedFiles: [],
  sections: [],
  agentProgress: [],
  currentPhase: 'setup',
  overallProgress: 0,
  latexDocument: '',
  compiledPdfUrl: null,
  errors: [],
  logs: []
};

let eventListeners: ResearchPaperEventCallback[] = [];

const emitEvent = (event: Omit<ResearchPaperEvent, 'timestamp'>) => {
  const fullEvent: ResearchPaperEvent = {
    ...event,
    timestamp: new Date()
  };
  state.logs.push(`[${fullEvent.timestamp.toLocaleTimeString()}] ${fullEvent.message}`);
  eventListeners.forEach(cb => cb(fullEvent));
};

export const subscribeToResearchPaperEvents = (callback: ResearchPaperEventCallback): (() => void) => {
  eventListeners.push(callback);
  return () => {
    eventListeners = eventListeners.filter(cb => cb !== callback);
  };
};

export const getResearchPaperState = (): ResearchPaperState => ({ ...state });

export const resetResearchPaper = (): void => {
  state = {
    config: null,
    uploadedFiles: [],
    sections: [],
    agentProgress: [],
    currentPhase: 'setup',
    overallProgress: 0,
    latexDocument: '',
    compiledPdfUrl: null,
    errors: [],
    logs: []
  };
};

// ==========================================
// Sub-Agent Definitions
// ==========================================

interface SubAgentDef {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  sectionNames: string[];
}

const SUB_AGENTS: SubAgentDef[] = [
  {
    name: 'Literature Review Agent',
    role: 'literature',
    description: 'Analyzes uploaded literature and synthesizes key findings',
    sectionNames: ['literature_review'],
    systemPrompt: `You are an expert Literature Review Agent. Your task is to:
1. Analyze all provided literature sources thoroughly
2. Identify key themes, findings, and research gaps
3. Synthesize information across multiple sources
4. Write a comprehensive literature review that:
   - Groups related studies by theme
   - Compares and contrasts different findings
   - Identifies consensus and controversies
   - Highlights research gaps that justify the current study
5. Properly cite all sources using the specified citation style
6. Write in academic prose, third person, past tense for reviewed work

Output format: Write the complete literature review section in LaTeX format.
Include \\cite{} commands for all references.`
  },
  {
    name: 'Introduction Agent',
    role: 'introduction',
    description: 'Writes compelling introductions with background and objectives',
    sectionNames: ['introduction'],
    systemPrompt: `You are an expert Introduction Agent. Your task is to write a compelling introduction that:
1. Opens with a hook that establishes the importance of the research topic
2. Provides necessary background context for readers
3. Reviews the current state of knowledge (briefly, pointing to lit review)
4. Identifies the research gap or problem being addressed
5. States the research objectives and questions clearly
6. Outlines the significance and contributions of the study
7. Provides a roadmap of the paper structure

Writing style:
- Academic but engaging
- Third person
- Present tense for established facts, past tense for specific studies
- Approximately 500-1000 words for standard papers

Output format: Write the complete introduction in LaTeX format.`
  },
  {
    name: 'Methodology Agent',
    role: 'methodology',
    description: 'Describes research methods, data collection, and analysis',
    sectionNames: ['methodology', 'materials_and_methods'],
    systemPrompt: `You are an expert Methodology Agent. Your task is to write a detailed methodology section that:
1. Describes the research design and approach
2. Explains data collection methods and sources
3. Details the sample/participants (if applicable)
4. Describes instruments, tools, or materials used
5. Explains data analysis procedures
6. Addresses validity and reliability
7. Discusses ethical considerations (if applicable)
8. Is detailed enough for replication

Writing style:
- Past tense
- Third person passive voice preferred
- Precise and technical
- Logical flow from design to analysis

Output format: Write the complete methodology section in LaTeX format.
Include subsections for different aspects (e.g., \\subsection{Data Collection}).`
  },
  {
    name: 'Results Agent',
    role: 'results',
    description: 'Analyzes data and presents findings objectively',
    sectionNames: ['results', 'findings'],
    systemPrompt: `You are an expert Results Agent. Your task is to present research findings that:
1. Reports findings objectively without interpretation
2. Organizes results logically (by research question/hypothesis)
3. Uses appropriate statistical reporting (if quantitative)
4. Describes patterns and trends in qualitative data
5. References all tables and figures appropriately
6. Highlights key findings without redundancy
7. Presents both expected and unexpected results

Writing style:
- Past tense
- Objective and factual
- Concise but complete
- Let data speak for itself

Output format: Write the complete results section in LaTeX format.
Include LaTeX table and figure environments where appropriate.
Use \\ref{} for cross-references.`
  },
  {
    name: 'Discussion Agent',
    role: 'discussion',
    description: 'Interprets results and compares with existing literature',
    sectionNames: ['discussion'],
    systemPrompt: `You are an expert Discussion Agent. Your task is to write a comprehensive discussion that:
1. Summarizes key findings (without repeating results)
2. Interprets what the results mean
3. Compares findings with previous research
4. Explains unexpected results or discrepancies
5. Discusses theoretical and practical implications
6. Acknowledges limitations honestly
7. Suggests future research directions

Writing style:
- Present tense for interpretations
- Past tense for referring to results
- Critical and analytical
- Balanced (acknowledges both strengths and weaknesses)

Output format: Write the complete discussion section in LaTeX format.
Include \\cite{} commands when comparing with literature.`
  },
  {
    name: 'Conclusion Agent',
    role: 'conclusion',
    description: 'Summarizes contributions and key takeaways',
    sectionNames: ['conclusion'],
    systemPrompt: `You are an expert Conclusion Agent. Your task is to write a strong conclusion that:
1. Restates the research objectives (briefly)
2. Summarizes the main findings and contributions
3. Highlights the significance of the work
4. Discusses broader implications
5. Provides recommendations (if appropriate)
6. Ends with a memorable closing statement

Writing style:
- Concise and impactful
- No new information or citations
- Present tense for conclusions
- Forward-looking where appropriate
- Approximately 300-500 words

Output format: Write the complete conclusion section in LaTeX format.`
  },
  {
    name: 'Abstract Agent',
    role: 'abstract',
    description: 'Writes a concise abstract summarizing the entire paper',
    sectionNames: ['abstract'],
    systemPrompt: `You are an expert Abstract Agent. Your task is to write a concise abstract that:
1. States the purpose/objective of the research
2. Describes the methodology briefly
3. Summarizes key results
4. States the main conclusion
5. Mentions significance/implications

Constraints:
- 150-300 words typically
- Self-contained (readable independently)
- No citations
- No abbreviations without definitions
- Keywords at the end

Output format: Write the abstract in LaTeX format within \\begin{abstract}...\\end{abstract}.
Include 4-6 keywords.`
  },
  {
    name: 'References Agent',
    role: 'references',
    description: 'Compiles and formats the bibliography',
    sectionNames: ['references', 'bibliography'],
    systemPrompt: `You are an expert References Agent. Your task is to:
1. Compile all cited sources from the paper
2. Format references according to the specified citation style
3. Ensure all in-text citations have corresponding references
4. Check for completeness of reference information
5. Organize references alphabetically or numerically as required

Output format: Generate BibTeX entries for all references.
Create a .bib file content with proper formatting.`
  },
  {
    name: 'LaTeX Validator Agent',
    role: 'validator',
    description: 'Validates and corrects LaTeX formatting issues',
    sectionNames: [],
    systemPrompt: `You are an expert LaTeX Validator Agent. Your task is to:
1. Check LaTeX documents for formatting errors and inconsistencies
2. Fix duplicate section titles (e.g., two "Introduction" sections)
3. Remove raw code artifacts like \`\`\`latex or markdown syntax
4. Convert markdown emphasis (*text* or **text**) to proper LaTeX (\\textit{} or \\textbf{})
5. Fix spacing issues and text running together
6. Ensure proper LaTeX syntax throughout
7. Remove any non-LaTeX formatting artifacts

You will receive a LaTeX document and must return the corrected version.
Only output the corrected LaTeX code, no explanations.`
  }
];

// ==========================================
// File Processing
// ==========================================

export const extractTextFromFile = async (file: File): Promise<{
  text: string;
  ocrContent?: ExtractedDocumentContent;
}> => {
  return new Promise(async (resolve, reject) => {
    try {
      if (file.type === 'application/pdf') {
        // Use OCR for PDFs to extract text, tables, figures
        emitEvent({
          type: 'file-analyzed',
          data: { fileName: file.name },
          message: `Extracting content from PDF: ${file.name}...`
        });
        
        try {
          const ocrContent = await extractPDFContent(file);
          resolve({
            text: ocrContent.text,
            ocrContent
          });
        } catch (ocrError) {
          console.warn('PDF extraction failed, using FileReader fallback:', ocrError);
          // Fallback - just return a placeholder for now
          // The PDF content will be read by the ocrService's extractPDFContent
          resolve({ text: `[PDF Document: ${file.name}]` });
        }
      } else if (file.type.startsWith('image/')) {
        // Use OCR for images
        emitEvent({
          type: 'file-analyzed',
          data: { fileName: file.name },
          message: `Extracting content from image: ${file.name} (using OCR)...`
        });
        
        try {
          const base64 = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res((reader.result as string).split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });
          
          const ocrResult = await extractFromImage(base64, 'all');
          
          const ocrContent: ExtractedDocumentContent = {
            text: ocrResult.raw_text,
            tables: ocrResult.tables,
            figures: ocrResult.figures,
            formulas: ocrResult.formulas,
            latex: ''
          };
          
          resolve({
            text: ocrResult.raw_text,
            ocrContent
          });
        } catch (ocrError) {
          console.warn('Image OCR failed:', ocrError);
          resolve({ text: `[Image file: ${file.name}]` });
        }
      } else if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.tex')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ text: e.target?.result as string });
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsText(file);
      } else if (file.type.includes('json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target?.result as string);
            resolve({ text: JSON.stringify(json, null, 2) });
          } catch {
            resolve({ text: e.target?.result as string });
          }
        };
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsText(file);
      } else {
        // Try to read as text
        const reader = new FileReader();
        reader.onload = (e) => resolve({ text: e.target?.result as string || `[Binary file: ${file.name}]` });
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.readAsText(file);
      }
    } catch (error) {
      reject(error);
    }
  });
};

export const uploadFile = async (
  file: File, 
  type: UploadedFile['type']
): Promise<UploadedFile> => {
  // Extract text content from file
  const extractionResult = await extractTextFromFile(file);
  const content = extractionResult.text;
  
  // Get OCR content if available from extraction
  let ocrContent: ExtractedDocumentContent | undefined = extractionResult.ocrContent;
  let extractedImages: FigureData[] = ocrContent?.figures || [];
  let extractedTables: TableData[] = ocrContent?.tables || [];
  let extractedFormulas: FormulaData[] = ocrContent?.formulas || [];
  
  // For images that weren't processed yet, extract structured content
  if (file.type.startsWith('image/') && !ocrContent) {
    try {
      const imageResult = await extractFromImage(file);
      if (imageResult.tables.length > 0) {
        extractedTables = imageResult.tables;
      }
      
      // Store the image itself as a figure
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      extractedImages = [{
        type: 'figure',
        bbox: [0, 0, 0, 0],
        base64,
        caption: file.name,
        filename: file.name
      }];
      
      emitEvent({
        type: 'agent-thinking',
        data: { agent: 'OCR' },
        message: `Extracted content from image: ${file.name}`
      });
    } catch (e) {
      console.warn('Image OCR extraction failed:', e);
    }
  }
  
  // Log extraction results for PDFs
  if (file.type === 'application/pdf' && ocrContent) {
    emitEvent({
      type: 'agent-thinking',
      data: { agent: 'OCR' },
      message: `Extracted ${extractedImages.length} images, ${extractedTables.length} tables, ${extractedFormulas.length} formulas from PDF`
    });
  }
  
  const uploadedFile: UploadedFile = {
    id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: file.name,
    type,
    content,
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date(),
    ocrContent,
    extractedImages,
    extractedTables,
    extractedFormulas
  };
  
  state.uploadedFiles.push(uploadedFile);
  
  emitEvent({
    type: 'file-uploaded',
    data: { fileId: uploadedFile.id, fileName: file.name, fileType: type },
    message: `Uploaded ${file.name} as ${type}`
  });
  
  return uploadedFile;
};

export const addTextContent = (
  name: string,
  content: string,
  type: UploadedFile['type']
): UploadedFile => {
  const uploadedFile: UploadedFile = {
    id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    type,
    content,
    mimeType: 'text/plain',
    size: content.length,
    uploadedAt: new Date()
  };
  
  state.uploadedFiles.push(uploadedFile);
  
  emitEvent({
    type: 'file-uploaded',
    data: { fileId: uploadedFile.id, fileName: name, fileType: type },
    message: `Added ${name} as ${type}`
  });
  
  return uploadedFile;
};

export const removeFile = (fileId: string): void => {
  state.uploadedFiles = state.uploadedFiles.filter(f => f.id !== fileId);
};

// ==========================================
// File Analysis with AI
// ==========================================

const analyzeUploadedFile = async (file: UploadedFile): Promise<ExtractedInfo> => {
  if (!isGeminiInitialized()) {
    await initializeGeminiWithFirebaseKey();
  }
  
  const prompt = `Analyze the following document and extract key information.

Document Name: ${file.name}
Document Type: ${file.type}

Content:
${file.content.substring(0, 15000)}

Please extract and return a JSON object with:
{
  "title": "document title if found",
  "authors": ["author names if found"],
  "abstract": "abstract or summary if found",
  "keyFindings": ["list of key findings or main points"],
  "methodology": "research methodology if described",
  "citations": ["any cited works mentioned"]
}

Return ONLY the JSON object, no other text.`;

  try {
    const response = await generateTextContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Error analyzing file:', error);
  }
  
  return {
    title: file.name,
    keyFindings: ['Unable to extract - manual review recommended']
  };
};

export const analyzeAllFiles = async (): Promise<void> => {
  state.currentPhase = 'analyzing';
  emitEvent({
    type: 'agent-started',
    data: { agent: 'File Analysis' },
    message: 'Starting file analysis...'
  });
  
  for (let i = 0; i < state.uploadedFiles.length; i++) {
    const file = state.uploadedFiles[i];
    
    emitEvent({
      type: 'agent-progress',
      data: { 
        agent: 'File Analysis',
        current: i + 1,
        total: state.uploadedFiles.length,
        fileName: file.name
      },
      message: `Analyzing ${file.name} (${i + 1}/${state.uploadedFiles.length})`
    });
    
    file.extractedInfo = await analyzeUploadedFile(file);
    
    emitEvent({
      type: 'file-analyzed',
      data: { fileId: file.id, extractedInfo: file.extractedInfo },
      message: `Completed analysis of ${file.name}`
    });
  }
  
  emitEvent({
    type: 'agent-completed',
    data: { agent: 'File Analysis' },
    message: 'File analysis complete'
  });
};

// ==========================================
// Paper Generation
// ==========================================

export const initializePaperConfig = (config: ResearchPaperConfig): void => {
  state.config = config;
  
  // Initialize sections based on config
  const standardSections = [
    { id: 'abstract', name: 'abstract', title: 'Abstract', agent: 'Abstract Agent' },
    { id: 'introduction', name: 'introduction', title: 'Introduction', agent: 'Introduction Agent' },
    { id: 'literature_review', name: 'literature_review', title: 'Literature Review', agent: 'Literature Review Agent' },
    { id: 'methodology', name: 'methodology', title: 'Methodology', agent: 'Methodology Agent' },
    { id: 'results', name: 'results', title: 'Results', agent: 'Results Agent' },
    { id: 'discussion', name: 'discussion', title: 'Discussion', agent: 'Discussion Agent' },
    { id: 'conclusion', name: 'conclusion', title: 'Conclusion', agent: 'Conclusion Agent' },
    { id: 'references', name: 'references', title: 'References', agent: 'References Agent' }
  ];
  
  state.sections = standardSections.map(s => ({
    ...s,
    status: 'pending' as const,
    content: '',
    latexContent: '',
    progress: 0,
    wordCount: 0,
    citations: []
  }));
  
  // Initialize agent progress
  state.agentProgress = SUB_AGENTS.map(agent => ({
    agentName: agent.name,
    status: 'idle' as const,
    currentTask: '',
    progress: 0
  }));
  
  emitEvent({
    type: 'section-started',
    data: { config },
    message: `Paper configured: "${config.title}" (${config.paperType})`
  });
};

const getTargetWordCount = (targetLength: string, sectionName: string): number => {
  const baseCounts: Record<string, Record<string, number>> = {
    short: {
      abstract: 200,
      introduction: 500,
      literature_review: 800,
      methodology: 600,
      results: 600,
      discussion: 700,
      conclusion: 300
    },
    medium: {
      abstract: 250,
      introduction: 1000,
      literature_review: 2000,
      methodology: 1200,
      results: 1500,
      discussion: 1500,
      conclusion: 500
    },
    long: {
      abstract: 300,
      introduction: 1500,
      literature_review: 4000,
      methodology: 2000,
      results: 3000,
      discussion: 3000,
      conclusion: 800
    },
    thesis: {
      abstract: 350,
      introduction: 3000,
      literature_review: 8000,
      methodology: 4000,
      results: 6000,
      discussion: 5000,
      conclusion: 1500
    }
  };
  
  return baseCounts[targetLength]?.[sectionName] || 500;
};

const buildContextForAgent = (agentRole: string): string => {
  const config = state.config!;
  
  // Compile uploaded files information
  const filesContext = state.uploadedFiles.map(file => {
    const info = file.extractedInfo;
    return `
### ${file.name} (${file.type})
${info?.title ? `Title: ${info.title}` : ''}
${info?.authors?.length ? `Authors: ${info.authors.join(', ')}` : ''}
${info?.abstract ? `Abstract: ${info.abstract}` : ''}
${info?.keyFindings?.length ? `Key Findings:\n${info.keyFindings.map(f => `- ${f}`).join('\n')}` : ''}
${info?.methodology ? `Methodology: ${info.methodology}` : ''}

Content excerpt:
${file.content.substring(0, 5000)}
---`;
  }).join('\n\n');
  
  // Previously written sections
  const previousSections = state.sections
    .filter(s => s.status === 'completed' && s.content)
    .map(s => `### ${s.title}\n${s.content.substring(0, 3000)}`)
    .join('\n\n');
  
  return `
# Research Paper Context

## Paper Information
- Title: ${config.title}
- Authors: ${config.authors.join(', ')}
- Type: ${config.paperType}
- Citation Style: ${config.citationStyle}
${config.affiliation ? `- Affiliation: ${config.affiliation}` : ''}

## Uploaded Source Materials
${filesContext || 'No files uploaded yet.'}

## Previously Written Sections
${previousSections || 'No sections written yet.'}
`;
};

const generateSectionWithAgent = async (
  section: PaperSection,
  agent: SubAgentDef
): Promise<void> => {
  if (!state.config) {
    throw new Error('Paper config not initialized');
  }
  
  if (!isGeminiInitialized()) {
    await initializeGeminiWithFirebaseKey();
  }
  
  section.status = 'in-progress';
  
  // Update agent progress
  const agentProgress = state.agentProgress.find(a => a.agentName === agent.name);
  if (agentProgress) {
    agentProgress.status = 'working';
    agentProgress.currentTask = `Writing ${section.title}`;
  }
  
  emitEvent({
    type: 'section-started',
    data: { sectionId: section.id, agentName: agent.name },
    message: `${agent.name} starting to write ${section.title}...`
  });
  
  const context = buildContextForAgent(agent.role);
  const targetWords = getTargetWordCount(state.config.targetLength, section.name);
  
  const prompt = `${agent.systemPrompt}

${context}

## Your Task
Write the ${section.title} section for this research paper.

Requirements:
- Target word count: approximately ${targetWords} words
- Citation style: ${state.config.citationStyle}
- Paper type: ${state.config.paperType}
- Use proper academic writing conventions

CRITICAL LaTeX FORMATTING RULES:
1. DO NOT include \\section{${section.title}} at the start - this will be added automatically
2. DO NOT use markdown formatting like *italic* or **bold** - use \\textit{} and \\textbf{} instead
3. DO NOT use markdown code blocks (\`\`\`latex or \`\`\`)
4. DO NOT include "Note to Reviewer" or similar meta-comments
5. Use \\cite{AuthorYear} for citations
6. Use \\subsection{} for subsections if needed
7. Ensure proper spacing between sentences and paragraphs
8. Use \\begin{itemize}/\\begin{enumerate} for lists
9. Use \\textit{} for emphasis, \\textbf{} for strong emphasis

Write the complete ${section.title} content now (without the section header):`;

  try {
    // Generate content
    const response = await generateTextContent(prompt);
    
    // Apply immediate validation to fix common issues
    const cleanedResponse = validateAndFixLatex(response);
    
    section.content = cleanedResponse;
    section.latexContent = cleanedResponse;
    section.wordCount = cleanedResponse.split(/\s+/).length;
    section.status = 'completed';
    section.progress = 100;
    
    // Extract citations
    const citeMatches = response.match(/\\cite\{([^}]+)\}/g) || [];
    section.citations = citeMatches.map(c => c.replace(/\\cite\{|\}/g, ''));
    
    if (agentProgress) {
      agentProgress.status = 'completed';
      agentProgress.progress = 100;
      agentProgress.output = response.substring(0, 500) + '...';
    }
    
    emitEvent({
      type: 'section-completed',
      data: { 
        sectionId: section.id, 
        wordCount: section.wordCount,
        agentName: agent.name 
      },
      message: `${agent.name} completed ${section.title} (${section.wordCount} words)`
    });
    
  } catch (error) {
    section.status = 'error';
    if (agentProgress) {
      agentProgress.status = 'error';
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    state.errors.push(`Error in ${section.title}: ${errorMessage}`);
    
    emitEvent({
      type: 'error',
      data: { sectionId: section.id, error: errorMessage },
      message: `Error writing ${section.title}: ${errorMessage}`
    });
  }
};

export const generatePaper = async (): Promise<void> => {
  if (!state.config) {
    throw new Error('Paper config not initialized');
  }
  
  state.currentPhase = 'writing';
  state.overallProgress = 0;
  
  emitEvent({
    type: 'agent-started',
    data: { phase: 'writing' },
    message: 'Starting paper generation with specialized agents...'
  });
  
  // Generate each section in order
  for (let i = 0; i < state.sections.length; i++) {
    const section = state.sections[i];
    
    // Skip references for now (will be compiled at the end)
    if (section.name === 'references') continue;
    
    // Find the appropriate agent
    const agent = SUB_AGENTS.find(a => a.sectionNames.includes(section.name));
    if (!agent) continue;
    
    await generateSectionWithAgent(section, agent);
    
    // Update overall progress
    state.overallProgress = Math.round(((i + 1) / state.sections.length) * 100);
    
    emitEvent({
      type: 'agent-progress',
      data: { 
        overallProgress: state.overallProgress,
        completedSections: i + 1,
        totalSections: state.sections.length
      },
      message: `Overall progress: ${state.overallProgress}%`
    });
  }
  
  // Generate references section
  await generateReferences();
  
  // Run LaTeX Validator Agent on all sections
  await validateAllSections();
  
  emitEvent({
    type: 'agent-completed',
    data: { phase: 'writing' },
    message: 'All sections generated and validated successfully'
  });
};

/**
 * Validates all generated sections using the LaTeX Validator Agent
 * This catches issues that the simple regex-based validation might miss
 */
const validateAllSections = async (): Promise<void> => {
  const validatorAgent = SUB_AGENTS.find(a => a.role === 'validator');
  if (!validatorAgent) return;
  
  emitEvent({
    type: 'agent-started',
    data: { agentName: validatorAgent.name },
    message: 'LaTeX Validator Agent checking document for formatting issues...'
  });
  
  // Update agent progress
  const validatorProgress = state.agentProgress.find(a => a.agentName === validatorAgent.name);
  if (validatorProgress) {
    validatorProgress.status = 'working';
    validatorProgress.currentTask = 'Validating LaTeX formatting';
  }
  
  for (const section of state.sections) {
    if (section.status !== 'completed' || section.name === 'references') continue;
    
    try {
      const prompt = `${validatorAgent.systemPrompt}

## Section to Validate: ${section.title}

Here is the LaTeX content to check and fix:

\`\`\`latex
${section.latexContent}
\`\`\`

IMPORTANT ISSUES TO CHECK AND FIX:
1. Remove any duplicate section headings (\\section{} or \\subsection{})
2. Remove markdown code block markers (\`\`\`latex, \`\`\`, \`)
3. Convert *text* to \\textit{text} and **text** to \\textbf{text}
4. Fix spacing issues where words run together
5. Remove any "Note to Reviewer" or similar meta-comments
6. Ensure proper LaTeX escaping of special characters
7. Fix any malformed LaTeX commands

Return ONLY the corrected LaTeX content, no explanations or markdown formatting.`;

      const response = await generateTextContent(prompt);
      
      // Clean the response (in case AI adds markdown formatting)
      let cleanedResponse = response
        .replace(/```latex\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      
      // Only update if we got a valid response
      if (cleanedResponse.length > 50) {
        section.latexContent = cleanedResponse;
        section.content = cleanedResponse;
      }
      
    } catch (error) {
      console.warn(`Validation failed for ${section.title}:`, error);
      // Continue with other sections even if one fails
    }
  }
  
  if (validatorProgress) {
    validatorProgress.status = 'completed';
    validatorProgress.progress = 100;
    validatorProgress.currentTask = 'Validation complete';
  }
  
  emitEvent({
    type: 'agent-completed',
    data: { agentName: validatorAgent.name },
    message: 'LaTeX validation complete - all sections checked and fixed'
  });
};

const generateReferences = async (): Promise<void> => {
  const referencesSection = state.sections.find(s => s.name === 'references');
  if (!referencesSection) return;
  
  const referencesAgent = SUB_AGENTS.find(a => a.role === 'references');
  if (!referencesAgent) return;
  
  // Collect all citations from all sections
  const allCitations = new Set<string>();
  state.sections.forEach(s => {
    s.citations.forEach(c => allCitations.add(c));
  });
  
  // Also extract from uploaded literature files
  const literatureFiles = state.uploadedFiles.filter(f => f.type === 'literature');
  
  const prompt = `${referencesAgent.systemPrompt}

## Citations Used in Paper
${Array.from(allCitations).join(', ') || 'No citations found'}

## Source Literature Files
${literatureFiles.map(f => `- ${f.name}: ${f.extractedInfo?.title || 'Unknown title'}`).join('\n')}

## Citation Style
${state.config?.citationStyle || 'apa'}

Generate BibTeX entries for all referenced sources. Create realistic entries based on the information available.
Format as a complete .bib file content.`;

  try {
    const response = await generateTextContent(prompt);
    
    referencesSection.content = response;
    referencesSection.latexContent = response;
    referencesSection.status = 'completed';
    referencesSection.progress = 100;
    
    emitEvent({
      type: 'section-completed',
      data: { sectionId: referencesSection.id },
      message: 'References compiled'
    });
  } catch (error) {
    referencesSection.status = 'error';
    state.errors.push(`Error generating references: ${error}`);
  }
};

// ==========================================
// LaTeX Document Generation
// ==========================================

/**
 * Generate LaTeX for extracted figures
 */
const generateFiguresLatex = (): string => {
  const allFigures: FigureData[] = [];
  
  // Collect figures from all uploaded files
  for (const file of state.uploadedFiles) {
    if (file.extractedImages && file.extractedImages.length > 0) {
      allFigures.push(...file.extractedImages);
    }
  }
  
  if (allFigures.length === 0) return '';
  
  let figuresLatex = '\n\\section{Figures}\n\n';
  
  allFigures.forEach((figure, index) => {
    const figNum = index + 1;
    const caption = figure.caption || `Figure ${figNum}`;
    const label = `fig:extracted-${figNum}`;
    const filename = figure.filename || `figure${figNum}.png`;
    
    // For figures with base64 data or filename, add to LaTeX
    if (figure.base64 || figure.filename) {
      // The base64 data will be handled by the LaTeX compiler service
      figuresLatex += `\\begin{figure}[htbp]
\\centering
% Figure from uploaded document: ${filename}
\\fbox{\\parbox{0.8\\textwidth}{\\centering [Image: ${caption}]}}
\\caption{${caption}}
\\label{${label}}
\\end{figure}\n\n`;
    }
  });
  
  return figuresLatex;
};

/**
 * Generate LaTeX for extracted tables
 */
const generateTablesLatex = (): string => {
  const allTables: TableData[] = [];
  
  // Collect tables from all uploaded files
  for (const file of state.uploadedFiles) {
    if (file.extractedTables && file.extractedTables.length > 0) {
      allTables.push(...file.extractedTables);
    }
  }
  
  if (allTables.length === 0) return '';
  
  let tablesLatex = '\n\\section{Tables}\n\n';
  
  allTables.forEach((table, index) => {
    const tableNum = index + 1;
    const caption = table.caption || `Table ${tableNum}`;
    const label = `tab:extracted-${tableNum}`;
    
    // Use the LaTeX content if available
    let tableContent = table.latex;
    if (!tableContent && table.cells && table.cells.length > 0) {
      // Generate from cells if no latex content
      const numCols = Math.max(...table.cells.map(c => c.col)) + 1;
      const numRows = Math.max(...table.cells.map(c => c.row)) + 1;
      const colSpec = 'l'.repeat(numCols);
      
      tableContent = `\\begin{tabular}{${colSpec}}\n\\toprule\n`;
      for (let r = 0; r < numRows; r++) {
        const rowCells = table.cells.filter(c => c.row === r).sort((a, b) => a.col - b.col);
        tableContent += rowCells.map(c => c.text).join(' & ') + ' \\\\\n';
        if (r === 0) tableContent += '\\midrule\n';
      }
      tableContent += '\\bottomrule\n\\end{tabular}';
    } else if (table.html) {
      // If we have HTML, try to parse it (basic)
      tableContent = `% Table from HTML content\n\\begin{tabular}{l}\n${table.html.replace(/<[^>]+>/g, '').substring(0, 100)}...\n\\end{tabular}`;
    }
    
    if (tableContent) {
      tablesLatex += `\\begin{table}[htbp]
\\centering
\\caption{${caption}}
\\label{${label}}
${tableContent}
\\end{table}\n\n`;
    }
  });
  
  return tablesLatex;
};

/**
 * Generate LaTeX for extracted formulas
 */
const generateFormulasLatex = (): string => {
  const allFormulas: FormulaData[] = [];
  
  // Collect formulas from all uploaded files
  for (const file of state.uploadedFiles) {
    if (file.extractedFormulas && file.extractedFormulas.length > 0) {
      allFormulas.push(...file.extractedFormulas);
    }
  }
  
  if (allFormulas.length === 0) return '';
  
  let formulasLatex = '\n% Extracted formulas from source documents\n';
  
  allFormulas.forEach((formula, index) => {
    if (formula.latex) {
      formulasLatex += `\\begin{equation}
${formula.latex}
\\label{eq:extracted-${index + 1}}
\\end{equation}\n\n`;
    }
  });
  
  return formulasLatex;
};

/**
 * Convert BibTeX-style or plain text references to thebibliography format
 */
const formatReferencesForThebibliography = (referencesContent: string): string => {
  // If content is empty
  if (!referencesContent || referencesContent.trim().length === 0) {
    return '';
  }
  
  // Clean up the content
  let content = referencesContent.trim();
  
  // Check if already in thebibliography format
  if (content.includes('\\bibitem')) {
    // Extract just the bibitem entries
    const bibitems = content.match(/\\bibitem\{[^}]+\}[^\\]+/g);
    if (bibitems) {
      return bibitems.join('\n');
    }
  }
  
  // Check if in BibTeX format - convert to thebibliography
  if (content.includes('@article') || content.includes('@book') || content.includes('@inproceedings')) {
    const entries: string[] = [];
    const bibtexPattern = /@\w+\{([^,]+),([^@]*)/g;
    let match;
    let refNum = 1;
    
    while ((match = bibtexPattern.exec(content)) !== null) {
      const key = match[1].trim();
      const fields = match[2];
      
      // Extract common fields
      const author = extractBibField(fields, 'author') || 'Unknown Author';
      const title = extractBibField(fields, 'title') || 'Untitled';
      const year = extractBibField(fields, 'year') || '';
      const journal = extractBibField(fields, 'journal') || extractBibField(fields, 'booktitle') || '';
      
      let entry = `\\bibitem{ref${refNum}} ${author}. "${title}"`;
      if (journal) entry += `, ${journal}`;
      if (year) entry += `, ${year}`;
      entry += '.';
      
      entries.push(entry);
      refNum++;
    }
    
    if (entries.length > 0) {
      return entries.join('\n\n');
    }
  }
  
  // Plain text format - convert numbered list to bibitems
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const entries: string[] = [];
  let refNum = 1;
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip LaTeX commands
    if (trimmed.startsWith('\\') && !trimmed.startsWith('\\bibitem')) continue;
    // Skip empty or whitespace lines
    if (!trimmed) continue;
    
    // Remove leading numbers like "1." or "[1]"
    const cleanedLine = trimmed.replace(/^\s*\[?\d+\]?\.?\s*/, '');
    if (cleanedLine.length > 10) { // Minimum reasonable reference length
      entries.push(`\\bibitem{ref${refNum}} ${cleanedLine}`);
      refNum++;
    }
  }
  
  return entries.join('\n\n');
};

/**
 * Extract a field value from BibTeX entry
 */
const extractBibField = (content: string, fieldName: string): string => {
  const pattern = new RegExp(`${fieldName}\\s*=\\s*[{"]([^}"]+)[}"]`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : '';
};

export const compileToLatex = (): string => {
  if (!state.config) {
    throw new Error('Paper config not initialized');
  }
  
  const { title, authors, affiliation, citationStyle } = state.config;
  
  // Generate content for extracted elements
  const figuresLatex = generateFiguresLatex();
  const tablesLatex = generateTablesLatex();
  const formulasLatex = generateFormulasLatex();
  
  // Get references section for inline bibliography
  const referencesSection = state.sections.find(s => s.name === 'references');
  const referencesContent = referencesSection?.content || referencesSection?.latexContent || '';
  
  // Build the complete LaTeX document (simplified for online compilation)
  const latexDocument = `\\documentclass[12pt,a4paper]{article}

% Packages
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage{geometry}
\\usepackage{float}
\\geometry{margin=1in}

% Title
\\title{${escapeLatex(title)}}
\\author{${authors.map(a => escapeLatex(a)).join(' \\\\ ')}${affiliation ? ` \\\\ \\small ${escapeLatex(affiliation)}` : ''}}
\\date{\\today}

\\begin{document}

\\maketitle

${state.sections
  .filter(s => s.name !== 'references' && s.status === 'completed')
  .map(s => {
    // Validate and fix the section content
    const validatedContent = validateSectionContent(s);
    
    if (s.name === 'abstract') {
      return `\\begin{abstract}
${validatedContent}
\\end{abstract}`;
    }
    return `\\section{${s.title}}
${validatedContent}`;
  })
  .join('\n\n')}

${figuresLatex}

${tablesLatex}

${formulasLatex}

% References (inline bibliography for online compilation compatibility)
${referencesContent ? `\\section*{References}
\\begin{thebibliography}{99}
${formatReferencesForThebibliography(referencesContent)}
\\end{thebibliography}` : ''}

\\end{document}
`;

  state.latexDocument = latexDocument;
  
  // Write to LaTeX file system
  writeLatexFile('/main.tex', latexDocument);
  
  return latexDocument;
};

/**
 * Escape special LaTeX characters in plain text (for titles, authors, etc.)
 * Does NOT escape backslashes if they appear to be LaTeX commands
 */
const escapeLatex = (text: string): string => {
  // Only escape if it looks like plain text (no LaTeX commands)
  const hasLatexCommands = /\\[a-zA-Z]+/.test(text);
  if (hasLatexCommands) {
    // Just escape the most problematic characters
    return text
      .replace(/(?<!\\)&/g, '\\&')
      .replace(/(?<!\\)%/g, '\\%')
      .replace(/(?<!\\)\$/g, '\\$')
      .replace(/(?<!\\)#/g, '\\#');
  }
  
  return text
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
};

// ==========================================
// LaTeX Validation & Correction
// ==========================================

/**
 * Validates and fixes common LaTeX formatting issues
 * This runs locally without AI for fast corrections
 */
const validateAndFixLatex = (content: string): string => {
  let fixed = content;
  
  // 1. Remove markdown code block markers
  fixed = fixed.replace(/```latex\s*/gi, '');
  fixed = fixed.replace(/```\s*/g, '');
  fixed = fixed.replace(/`{1,3}/g, '');
  
  // 2. Convert markdown emphasis to LaTeX
  // **bold** -> \textbf{bold}
  fixed = fixed.replace(/\*\*([^*]+)\*\*/g, '\\textbf{$1}');
  // *italic* -> \textit{italic}
  fixed = fixed.replace(/\*([^*]+)\*/g, '\\textit{$1}');
  // _italic_ -> \textit{italic} (but not \_ which is escaped underscore)
  fixed = fixed.replace(/(?<!\\)_([^_]+)_/g, '\\textit{$1}');
  
  // 3. Fix common markdown artifacts
  fixed = fixed.replace(/^#+\s*/gm, ''); // Remove markdown headers
  
  // 4. Fix spacing issues - ensure proper word spacing
  // Fix words running together after periods
  fixed = fixed.replace(/\.([A-Z])/g, '. $1');
  // Fix words running together after commas
  fixed = fixed.replace(/,([A-Za-z])/g, ', $1');
  
  // 5. Remove "Note to Reviewer" or similar meta-comments that shouldn't be in output
  fixed = fixed.replace(/\\textbf\{Note to Reviewer[^}]*\}[^\\]*/gi, '');
  fixed = fixed.replace(/Note to Reviewer:[^\n]*/gi, '');
  
  return fixed;
};

/**
 * Validates section content and fixes issues before adding to document
 */
const validateSectionContent = (section: PaperSection): string => {
  let content = section.latexContent || section.content;
  
  // Apply basic fixes
  content = validateAndFixLatex(content);
  
  // Remove any embedded section commands if the section wrapper will add them
  // This prevents duplicate section titles
  const sectionPattern = new RegExp(`\\\\section\\{${escapeRegex(section.title)}\\}`, 'gi');
  content = content.replace(sectionPattern, '');
  
  // Also remove variations with slightly different formatting
  const titleWords = section.title.toLowerCase().split(/\s+/);
  if (titleWords.length > 0) {
    const flexPattern = new RegExp(`\\\\section\\{[^}]*${titleWords[0]}[^}]*\\}\\s*`, 'gi');
    // Only remove if it's clearly a duplicate
    const matches = content.match(flexPattern);
    if (matches && matches.length > 0) {
      // Keep only the first match, remove duplicates
      let firstFound = false;
      content = content.replace(flexPattern, (match) => {
        if (!firstFound) {
          firstFound = true;
          return ''; // Remove the first one too since we add section header in compileToLatex
        }
        return ''; // Remove all duplicates
      });
    }
  }
  
  // Remove subsection duplicates too
  const subsectionPattern = /\\subsection\{([^}]+)\}/g;
  const foundSubsections = new Set<string>();
  content = content.replace(subsectionPattern, (match, title) => {
    const normalized = title.toLowerCase().trim();
    if (foundSubsections.has(normalized)) {
      return ''; // Remove duplicate
    }
    foundSubsections.add(normalized);
    return match;
  });
  
  return content.trim();
};

const escapeRegex = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const compilePaper = async (): Promise<CompileResult> => {
  state.currentPhase = 'compiling';
  
  emitEvent({
    type: 'compilation-started',
    data: {},
    message: 'Compiling LaTeX document...'
  });
  
  // First generate the LaTeX
  compileToLatex();
  
  // Then compile to PDF
  const result = await compileLatexProject();
  
  if (result.success && result.pdfUrl) {
    state.compiledPdfUrl = result.pdfUrl;
    state.currentPhase = 'complete';
    
    emitEvent({
      type: 'compilation-completed',
      data: { pdfUrl: result.pdfUrl },
      message: 'PDF compiled successfully!'
    });
  } else {
    state.errors.push(...(result.errors || []));
    
    emitEvent({
      type: 'error',
      data: { errors: result.errors },
      message: `Compilation failed: ${result.errors?.join(', ')}`
    });
  }
  
  return result;
};

// ==========================================
// Full Pipeline
// ==========================================

export const generateFullPaper = async (
  config: ResearchPaperConfig,
  onProgress?: (progress: number, message: string) => void
): Promise<{ latexDocument: string; pdfUrl: string | null }> => {
  // Initialize
  initializePaperConfig(config);
  onProgress?.(5, 'Configuration initialized');
  
  // Analyze uploaded files
  if (state.uploadedFiles.length > 0) {
    await analyzeAllFiles();
    onProgress?.(20, 'Files analyzed');
  }
  
  // Generate all sections
  await generatePaper();
  onProgress?.(80, 'All sections written');
  
  // Compile to LaTeX
  const latexDocument = compileToLatex();
  onProgress?.(90, 'LaTeX document generated');
  
  // Compile to PDF
  const result = await compilePaper();
  onProgress?.(100, 'PDF compiled');
  
  return {
    latexDocument,
    pdfUrl: result.pdfUrl || null
  };
};

// ==========================================
// Exports
// ==========================================

export {
  SUB_AGENTS
};
