/**
 * Deep Agent Service - Using DeepAgents Pattern with Gemini and Tavily
 * 
 * Based on: https://langchain-ai.github.io/deepagents/quickstart
 * 
 * Core Capabilities:
 * - Planning & Task Decomposition (write_todos tool)
 * - Context Management (file system tools)
 * - Web Search via Tavily
 * - Subagent delegation
 * - Chemistry-focused tools
 * - Automatic task execution (no manual "continue" needed)
 * - Real-time progress events
 */

import { GoogleGenAI, Type } from '@google/genai';
import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import { fetchCanonicalSmiles } from './pubchemService';
import { generateTextContent, isGeminiInitialized, initializeGeminiWithFirebaseKey } from './geminiService';
import { AspectRatio, ImageSize, ImageGenerationPromptSchema, ImageGenerationPrompt } from '../types/studium';

// ==========================================
// Task Progress Event System
// ==========================================

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'error';

export interface TaskEvent {
  type: 'task-start' | 'task-update' | 'task-complete' | 'task-error' |
  'step-start' | 'step-complete' | 'tool-call' | 'tool-result' |
  'thinking' | 'writing' | 'searching' | 'document-ready' | 'artifact-created' | 'step-stream';
  taskId: string;
  title?: string;
  message?: string;
  status?: TaskStatus;
  progress?: { current: number; total: number };
  data?: any;
}

// Artifact type for storing agent work products
export interface Artifact {
  id: string;
  type: 'plan' | 'research' | 'notes' | 'document' | 'code' | 'file';
  title: string;
  content: string;
  agentName: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Final document output type
export interface FinalDocument {
  id: string;
  title: string;
  content: string;
  format: 'markdown' | 'html' | 'text';
  createdAt: Date;
  sections?: { title: string; content: string }[];
}

export type TaskEventCallback = (event: TaskEvent) => void;

let taskEventListeners: TaskEventCallback[] = [];
let currentParentTaskId: string | null = null;

export const subscribeToTaskEvents = (callback: TaskEventCallback): (() => void) => {
  taskEventListeners.push(callback);
  return () => {
    taskEventListeners = taskEventListeners.filter(cb => cb !== callback);
  };
};

const emitTaskEvent = (event: TaskEvent) => {
  taskEventListeners.forEach(cb => cb(event));
};

// Types for deep agent interactions
export interface DeepAgentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  todos?: TodoItem[];
  subagentUsed?: string;
  filesCreated?: string[];
  toolsUsed?: string[];
}

export interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed';
  description?: string;
}

export interface DeepAgentConfig {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  enableSubagents?: boolean;
  enableFileSystem?: boolean;
  enablePlanning?: boolean;
  tavilyApiKey?: string;
  autoExecute?: boolean; // Automatically execute all tasks without waiting
}

export interface DeepAgentResult {
  messages: DeepAgentMessage[];
  todos: TodoItem[];
  filesCreated: string[];
  subagentsSpawned: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  execute: (params: any) => Promise<string>;
}

export interface SubAgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  model?: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3-pro-preview';  // Optional model override
  thinkingLevel?: 'low' | 'high';  // For Gemini 3 Pro thinking level
}

// In-memory file system for context management
class MemoryFileSystem {
  private files: Map<string, string> = new Map();

  ls(path: string = '/'): string[] {
    const files: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(path)) {
        files.push(key);
      }
    }
    return files;
  }

  readFile(path: string): string | null {
    return this.files.get(path) || null;
  }

  writeFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  editFile(path: string, newContent: string): boolean {
    if (this.files.has(path)) {
      this.files.set(path, newContent);
      return true;
    }
    return false;
  }

  deleteFile(path: string): boolean {
    return this.files.delete(path);
  }

  clear(): void {
    this.files.clear();
  }
}

// State management
let genAI: GoogleGenAI | null = null;
let isInitialized = false;
let currentTodos: TodoItem[] = [];
let conversationHistory: Array<{ role: string; content: string }> = [];
const fileSystem = new MemoryFileSystem();
let tavilyApiKey: string | null = null;
let finalDocuments: FinalDocument[] = [];
let artifacts: Artifact[] = [];

// Helper to create and track artifacts
const createArtifact = (params: {
  type: Artifact['type'];
  title: string;
  content: string;
  agentName: string;
  metadata?: Record<string, any>;
}): Artifact => {
  const artifact: Artifact = {
    id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: params.type,
    title: params.title,
    content: params.content,
    agentName: params.agentName,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: params.metadata
  };
  artifacts.push(artifact);

  // Emit artifact created event
  emitTaskEvent({
    type: 'artifact-created',
    taskId: artifact.id,
    title: artifact.title,
    message: `${params.agentName} created: ${artifact.title}`,
    status: 'completed',
    data: artifact
  });

  return artifact;
};

// ==========================================
// Tavily Internet Search Tool
// ==========================================
const tavilySearch = async (params: {
  query: string;
  maxResults?: number;
  topic?: 'general' | 'news' | 'finance';
  includeRawContent?: boolean;
}): Promise<string> => {
  const { query, maxResults = 5, topic = 'general', includeRawContent = false } = params;

  if (!tavilyApiKey) {
    return JSON.stringify({
      success: false,
      error: 'Tavily API key not configured. Please provide your TAVILY_API_KEY.'
    });
  }

  try {
    // Call Tavily Search API directly
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        max_results: maxResults,
        search_depth: 'advanced',
        include_raw_content: includeRawContent,
        topic,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Format results for the agent
    const formattedResults = data.results?.map((result: any, index: number) => ({
      rank: index + 1,
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
      rawContent: includeRawContent ? result.raw_content : undefined,
    })) || [];

    // Create artifact for research results
    if (formattedResults.length > 0) {
      const researchContent = `# Research: ${query}\n\n**Search Date:** ${new Date().toLocaleString()}\n\n` +
        (data.answer ? `## Quick Answer\n${data.answer}\n\n` : '') +
        `## Sources (${formattedResults.length} results)\n\n` +
        formattedResults.map((r: any) =>
          `### ${r.rank}. ${r.title}\n**URL:** ${r.url}\n\n${r.content}\n\n---\n`
        ).join('\n');

      createArtifact({
        type: 'research',
        title: `Research: ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`,
        content: researchContent,
        agentName: 'Research Agent',
        metadata: { query, resultCount: formattedResults.length }
      });
    }

    return JSON.stringify({
      success: true,
      query,
      answer: data.answer || null,
      results: formattedResults,
      totalResults: formattedResults.length,
    });
  } catch (error) {
    console.error('Tavily search error:', error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown search error',
    });
  }
};

// ==========================================
// Built-in Deep Agent Tools (write_todos, read_file, write_file)
// ==========================================

// write_todos - The planning tool
const writeTodosFromParams = (params: { todos?: (string | TodoItem)[] }): string => {
  // Validate todos parameter
  if (!params.todos || !Array.isArray(params.todos)) {
    return JSON.stringify({
      success: false,
      error: 'Missing or invalid todos parameter - expected an array'
    });
  }

  // Handle both string arrays and TodoItem arrays
  currentTodos = params.todos.map((todo, index) => {
    if (typeof todo === 'string') {
      // If todo is just a string, convert it to TodoItem
      return {
        id: `todo-${index}-${Date.now()}`,
        title: todo,
        status: 'pending' as const,
        description: ''
      };
    }
    // If it's already a TodoItem object
    return {
      ...todo,
      id: todo.id || `todo-${index}-${Date.now()}`,
      title: todo.title || `Task ${index + 1}`,
      status: todo.status || 'pending',
      description: todo.description || ''
    };
  });

  // Create artifact for the plan
  const planContent = currentTodos.map((t, i) =>
    `${i + 1}. ${t.status === 'completed' ? '✅' : t.status === 'in-progress' ? '🔄' : '⬜'} ${t.title}${t.description ? `\n   - ${t.description}` : ''}`
  ).join('\n');

  createArtifact({
    type: 'plan',
    title: 'Task Plan',
    content: `# Task Plan\n\nCreated: ${new Date().toLocaleString()}\n\n${planContent}`,
    agentName: 'Planning Agent',
    metadata: { todoCount: currentTodos.length }
  });

  return JSON.stringify({
    success: true,
    message: `Updated todo list with ${currentTodos.length} items`,
    todos: currentTodos,
  });
};

// read_file - Read from memory file system
const readFileFromMemory = (params: { path?: string }): string => {
  // Validate path parameter
  if (!params.path || typeof params.path !== 'string') {
    return JSON.stringify({
      success: false,
      error: 'Missing or invalid path parameter'
    });
  }

  const content = fileSystem.readFile(params.path);
  if (content) {
    return JSON.stringify({
      success: true,
      path: params.path,
      content,
    });
  }
  return JSON.stringify({
    success: false,
    error: `File not found: ${params.path}`,
  });
};

// write_file - Write to memory file system
const writeFileToMemory = (params: { path?: string; content?: string }): string => {
  // Validate parameters
  if (!params.path || typeof params.path !== 'string') {
    return JSON.stringify({
      success: false,
      error: 'Missing or invalid path parameter'
    });
  }

  if (!params.content || typeof params.content !== 'string') {
    return JSON.stringify({
      success: false,
      error: 'Missing or invalid content parameter'
    });
  }

  fileSystem.writeFile(params.path, params.content);

  // Determine artifact type based on path/content
  const isCode = params.path.endsWith('.py') || params.path.endsWith('.js') || params.path.endsWith('.ts');
  const isResearch = params.path.includes('research') || params.path.includes('notes');

  createArtifact({
    type: isCode ? 'code' : isResearch ? 'research' : 'file',
    title: params.path.split('/').pop() || params.path,
    content: params.content,
    agentName: 'File Agent',
    metadata: { path: params.path }
  });

  return JSON.stringify({
    success: true,
    message: `File written: ${params.path}`,
    path: params.path,
  });
};

// list_files - List files in memory
const listFilesInMemory = (params: { path?: string }): string => {
  const files = fileSystem.ls(params.path || '/');
  return JSON.stringify({
    success: true,
    files,
    count: files.length,
  });
};

// ==========================================
// Tool Implementations
// ==========================================

const tools: Map<string, ToolDefinition> = new Map();

// Internet Search Tool (Tavily)
tools.set('internet_search', {
  name: 'internet_search',
  description: 'Run a web search using Tavily to find current information from the internet. Use this for research, finding recent news, or looking up facts.',
  execute: tavilySearch,
});

// Google Search Grounding Tool - Uses Gemini's built-in Google Search for academic research
tools.set('google_search_grounding', {
  name: 'google_search_grounding',
  description: 'Search using Google Search grounding via Gemini API. Returns results with proper citations and source URLs. Best for finding research papers, academic content, and authoritative sources. Returns grounded responses with inline citations.',
  execute: async (params: { query: string; focus?: 'academic' | 'general' }) => {
    try {
      const apiKey = await getSharedGeminiApiKey();
      if (!apiKey) {
        console.error('Google Search Grounding: No API key available');
        return JSON.stringify({ success: false, error: 'No Gemini API key available. Please configure your API key.' });
      }

      console.log('Google Search Grounding: Using API key:', apiKey.substring(0, 8) + '...');
      const ai = new GoogleGenAI({ apiKey });

      // Enhance query for academic focus
      const searchQuery = params.focus === 'academic'
        ? `Find research papers, academic studies, and scholarly sources about: ${params.query}. Include citations with author names, publication dates, and journal names where available.`
        : params.query;

      // Use Gemini 2.5 models only (2.0 and below are deprecated)
      const modelCandidates = ['gemini-2.5-flash', 'gemini-2.5-pro'];
      let response: any = null;
      let usedModel = '';

      for (const modelName of modelCandidates) {
        try {
          console.log(`Google Search Grounding: Trying model ${modelName}...`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: searchQuery,
            config: {
              tools: [{ googleSearch: {} }],
            },
          });
          usedModel = modelName;
          console.log(`Google Search Grounding: Success with model ${modelName}`);
          break;
        } catch (modelError: any) {
          console.warn(`Google Search Grounding: Model ${modelName} failed:`, modelError.message);
          if (modelCandidates.indexOf(modelName) === modelCandidates.length - 1) {
            throw modelError;
          }
        }
      }

      if (!response) {
        throw new Error('No Gemini 2.5 model available for Google Search grounding');
      }

      // Extract grounding metadata for citations
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const text = response.text || '';

      // Build citations array from grounding chunks
      const citations: Array<{ title: string; url: string; index: number }> = [];
      if (groundingMetadata?.groundingChunks) {
        groundingMetadata.groundingChunks.forEach((chunk: any, index: number) => {
          if (chunk.web) {
            citations.push({
              title: chunk.web.title || 'Source',
              url: chunk.web.uri || '',
              index: index + 1
            });
          }
        });
      }

      // Format response with citations
      let formattedResponse = text;
      if (citations.length > 0) {
        formattedResponse += '\n\n### Sources:\n';
        citations.forEach((cite) => {
          formattedResponse += `[${cite.index}] ${cite.title}: ${cite.url}\n`;
        });
      }

      // Create artifact for the research
      createArtifact({
        type: 'research',
        title: `Google Search: ${params.query.substring(0, 50)}...`,
        content: formattedResponse,
        agentName: 'Academic Researcher',
        metadata: {
          query: params.query,
          citationCount: citations.length,
          searchQueries: groundingMetadata?.webSearchQueries || [],
          model: usedModel
        }
      });

      return JSON.stringify({
        success: true,
        query: params.query,
        response: formattedResponse,
        citations,
        citationCount: citations.length,
        searchQueries: groundingMetadata?.webSearchQueries || [],
        model: usedModel
      });
    } catch (error) {
      console.error('Google Search Grounding error:', error);
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Google Search failed',
        suggestion: 'The Google Search grounding feature may require a specific API key or model access. Falling back to regular internet search.'
      });
    }
  }
});

// write_todos Tool (Planning)
tools.set('write_todos', {
  name: 'write_todos',
  description: 'Create or update your task list to plan and track your work. Use this to break down complex tasks into manageable steps.',
  execute: async (params) => writeTodosFromParams(params),
});

// read_file Tool
tools.set('read_file', {
  name: 'read_file',
  description: 'Read content from a file in the workspace. Use this to retrieve previously saved information.',
  execute: async (params) => readFileFromMemory(params),
});

// write_file Tool
tools.set('write_file', {
  name: 'write_file',
  description: 'Write content to a file in the workspace. Use this to save research results, notes, or generated content.',
  execute: async (params) => writeFileToMemory(params),
});

// list_files Tool
tools.set('list_files', {
  name: 'list_files',
  description: 'List all files in the workspace directory.',
  execute: async (params) => listFilesInMemory(params),
});

// think_tool - Strategic reflection for research agents
tools.set('think_tool', {
  name: 'think_tool',
  description: 'Tool for strategic reflection on research progress and decision-making. Use this after each search to analyze results, assess gaps, and plan next steps. Helps maintain focus and prevent excessive searching.',
  execute: async (params: { reflection: string }) => {
    // Create artifact for thinking/notes
    createArtifact({
      type: 'notes',
      title: `Research Reflection - ${new Date().toLocaleTimeString()}`,
      content: params.reflection,
      agentName: 'Research Agent',
      metadata: { type: 'reflection' }
    });

    return JSON.stringify({
      success: true,
      message: `Reflection recorded: ${params.reflection.substring(0, 100)}...`,
      reflection: params.reflection
    });
  }
});

// NOTE: The 'task' tool is defined after subagents Map below

// Helper function to extract a title from the user's prompt
const extractTitleFromPrompt = (prompt: string): string => {
  // Try to extract topic from common patterns
  const patterns = [
    /research\s+(?:report\s+)?(?:on\s+)?(?:the\s+)?(.+?)(?:\.|$)/i,
    /(?:about|on|regarding)\s+(.+?)(?:\.|$)/i,
    /(.+?)(?:\s+research|\s+report|\s+analysis)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      // Capitalize and clean up
      let title = match[1].trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);
      // Limit length
      if (title.length > 80) {
        title = title.substring(0, 77) + '...';
      }
      return `Research Report: ${title}`;
    }
  }

  return 'Research Report';
};

// Helper function to build a document from the full response when synthesis fails
const buildDocumentFromResponse = (fullResponse: string, originalPrompt: string): string | null => {
  // Extract subagent findings from the response
  const findingsPattern = /\*\*(?:deep-researcher|research-agent|Subagent)\s+findings:\*\*\s*([\s\S]*?)(?=\n\n---|\n\n🔧|\n\n\*\*(?:deep-researcher|research-agent)|$)/gi;
  const findings: string[] = [];
  let match;

  while ((match = findingsPattern.exec(fullResponse)) !== null) {
    if (match[1] && match[1].trim().length > 100) {
      findings.push(match[1].trim());
    }
  }

  if (findings.length === 0) {
    return null;
  }

  // Build document structure
  const title = extractTitleFromPrompt(originalPrompt);
  let content = `# ${title}\n\n`;
  content += `*Generated on ${new Date().toLocaleDateString()}*\n\n`;
  content += `## Executive Summary\n\n`;
  content += `This report synthesizes research findings on the requested topic, compiled from multiple specialized research agents.\n\n`;

  // Add each finding as a section
  findings.forEach((finding, index) => {
    // Try to extract section title from the finding
    const titleMatch = finding.match(/^##?\s*(.+?)(?:\n|$)/);
    const sectionTitle = titleMatch ? titleMatch[1] : `Research Finding ${index + 1}`;

    content += `## ${sectionTitle}\n\n`;
    content += finding.replace(/^##?\s*.+?\n/, '').trim();
    content += '\n\n';
  });

  // Add sources section if not present
  if (!content.includes('## Sources') && !content.includes('## References')) {
    content += `## References\n\n`;
    content += `*Sources are cited inline throughout the document.*\n`;
  }

  return cleanDocumentContent(content);
};

// Helper function to clean content from task status messages and internal artifacts
const cleanDocumentContent = (content: string | undefined | null): string => {
  // Handle undefined/null content
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Patterns to remove - task status messages, waiting messages, internal artifacts
  const patternsToRemove = [
    // Task status headers and descriptions
    /📋\s*Task\s*\d+\/\d+:.*?(?=\n\n|$)/gs,
    // "Task X has already been completed" messages
    /Task\s*\d+:?\s*"[^"]*"\s*has\s*(already\s*been\s*)?(completed|done).*?(?=\n\n|---\n|$)/gis,
    // "I am awaiting", "I am unable to execute" messages
    /I\s+am\s+(currently\s+)?(awaiting|unable\s+to\s+execute|waiting\s+for).*?(?=\n\n|---\n|$)/gis,
    // "Please await" messages
    /Please\s+await.*?(?=\n\n|---\n|$)/gis,
    // "The delegation...has been completed" messages
    /The\s+delegation.*?has\s+(already\s+)?been\s+completed.*?(?=\n\n|---\n|$)/gis,
    // "I have not yet received" messages
    /I\s+have\s+not\s+yet\s+received.*?(?=\n\n|---\n|$)/gis,
    // "Without the necessary information" messages
    /Without\s+the\s+necessary\s+information.*?(?=\n\n|---\n|$)/gis,
    // "Once the sub-agent's" messages
    /Once\s+the\s+(sub-?agent'?s?|subagent'?s?).*?(?=\n\n|---\n|$)/gis,
    // Horizontal rule separators between task status blocks
    /---\n+(?=📋|Task\s*\d+)/g,
    // Internal thinking tags
    /<think>.*?<\/think>/gs,
    /<thinking>.*?<\/thinking>/gs,
    // Tool call blocks that might have leaked
    /```tool[\s\S]*?```/g,
    // ```thought blocks
    /```thought[\s\S]*?```/gs,
    // Multiple consecutive newlines (cleanup)
    /\n{4,}/g,
    // "I have delegated" messages
    /I\s+have\s+(delegated|initiated|completed).*?(?=\n\n|---\n|$)/gis,
    // Thinking comments
    /I\s+will\s+now\s+wait.*?(?=\n\n|---\n|$)/gis,
  ];

  let cleanedContent = content;
  for (const pattern of patternsToRemove) {
    cleanedContent = cleanedContent.replace(pattern, '');
  }

  // Clean up excessive blank lines
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n').trim();

  return cleanedContent;
};

// finalize_document Tool - Creates the final formatted document
tools.set('finalize_document', {
  name: 'finalize_document',
  description: 'Create and save the final formatted document. Use this when you have completed your research and want to present the final output as a well-structured markdown document.',
  execute: async (params: { title: string; content: string; sections?: { title: string; content: string }[] }) => {
    // Validate required parameters
    if (!params.title || typeof params.title !== 'string') {
      return JSON.stringify({
        success: false,
        error: 'Missing or invalid title parameter'
      });
    }

    if (!params.content || typeof params.content !== 'string') {
      return JSON.stringify({
        success: false,
        error: 'Missing or invalid content parameter'
      });
    }

    // Clean the content before saving
    const cleanedContent = cleanDocumentContent(params.content);

    // Also clean sections if provided
    const cleanedSections = params.sections?.map(section => ({
      title: section.title || 'Untitled Section',
      content: cleanDocumentContent(section.content)
    }));

    const doc: FinalDocument = {
      id: `doc-${Date.now()}`,
      title: params.title,
      content: cleanedContent,
      format: 'markdown',
      createdAt: new Date(),
      sections: cleanedSections
    };

    finalDocuments.push(doc);

    // Also save to file system
    const filename = `${params.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.md`;
    fileSystem.writeFile(`/documents/${filename}`, cleanedContent);

    // Create artifact for the final document
    createArtifact({
      type: 'document',
      title: params.title,
      content: cleanedContent,
      agentName: 'Documentation Agent',
      metadata: { documentId: doc.id, filename, format: 'markdown' }
    });

    // Emit document-ready event
    emitTaskEvent({
      type: 'document-ready',
      taskId: doc.id,
      title: params.title,
      message: 'Final document is ready',
      status: 'completed',
      data: doc
    });

    return JSON.stringify({
      success: true,
      message: `Document "${params.title}" has been finalized`,
      documentId: doc.id,
      filename
    });
  }
});

// Molecule Search Tool
tools.set('molecule_search', {
  name: 'molecule_search',
  description: 'Search for detailed information about a chemical molecule or compound. Returns SMILES notation, chemical properties, and usage information.',
  execute: async (params: { query: string; includeSmiles?: boolean }) => {
    try {
      const smiles = await fetchCanonicalSmiles(params.query);
      if (smiles) {
        return JSON.stringify({
          success: true,
          molecule: params.query,
          smiles,
          source: 'pubchem',
          message: `Found molecule: ${params.query} with SMILES: ${smiles}`
        });
      }

      const description = await generateTextContent(
        `Provide detailed information about the molecule or chemical compound: ${params.query}. 
        Include its chemical formula, structure description, common uses, and safety information.
        If you know the SMILES notation, include it.`
      );

      return JSON.stringify({
        success: true,
        molecule: params.query,
        description,
        source: 'gemini'
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to find information for: ${params.query}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Reaction Analysis Tool
tools.set('analyze_reaction', {
  name: 'analyze_reaction',
  description: 'Analyze a chemical reaction to understand its mechanism, type, and significance.',
  execute: async (params: { reaction: string; analysisType?: string }) => {
    try {
      const analysisType = params.analysisType || 'full';
      const prompt = `Analyze the following chemical reaction and provide a ${analysisType} analysis:

Reaction: ${params.reaction}

Please include:
1. Balanced equation (if not already balanced)
2. Reaction type (synthesis, decomposition, single replacement, double replacement, combustion, etc.)
3. Oxidation states and electron transfer (if applicable)
4. Enthalpy change estimation (exothermic or endothermic)
5. Reaction mechanism overview
6. Practical applications or significance
7. Safety considerations

Format the response in a clear, educational manner.`;

      const analysis = await generateTextContent(prompt);

      return JSON.stringify({
        success: true,
        reaction: params.reaction,
        analysisType,
        analysis
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to analyze reaction: ${params.reaction}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Concept Explanation Tool
tools.set('explain_concept', {
  name: 'explain_concept',
  description: 'Explain a chemistry concept at the appropriate level with examples.',
  execute: async (params: { concept: string; level?: string; includeExamples?: boolean }) => {
    try {
      const level = params.level || 'intermediate';
      const includeExamples = params.includeExamples !== false;

      const levelDescriptions: Record<string, string> = {
        beginner: 'Use simple terms, analogies, and avoid complex jargon. Explain as if to a high school student.',
        intermediate: 'Balance technical accuracy with accessibility. Include some technical terms with explanations.',
        advanced: 'Use full technical terminology and mathematical formulations. Assume strong chemistry background.'
      };

      const prompt = `Explain the following chemistry concept at a ${level} level:

Concept: ${params.concept}

${levelDescriptions[level] || levelDescriptions.intermediate}

${includeExamples ? 'Include 2-3 relevant examples to illustrate the concept.' : ''}

Structure your explanation with:
1. Definition and core idea
2. Key principles involved
3. ${includeExamples ? 'Practical examples' : 'Applications'}
4. Common misconceptions (if any)
5. Connection to other chemistry concepts`;

      const explanation = await generateTextContent(prompt);

      return JSON.stringify({
        success: true,
        concept: params.concept,
        level,
        explanation
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to explain concept: ${params.concept}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Practice Problems Tool
tools.set('generate_practice_problems', {
  name: 'generate_practice_problems',
  description: 'Generate chemistry practice problems with solutions for studying.',
  execute: async (params: { topic: string; difficulty?: string; count?: number }) => {
    try {
      const difficulty = params.difficulty || 'medium';
      const count = params.count || 3;

      const prompt = `Generate ${count} ${difficulty} practice problems for the following chemistry topic:

Topic: ${params.topic}

For each problem:
1. State the problem clearly
2. Provide any necessary data or constants
3. Include the step-by-step solution
4. Explain the key concepts being tested

Format each problem with clear numbering and separation between problem and solution.`;

      const problems = await generateTextContent(prompt);

      return JSON.stringify({
        success: true,
        topic: params.topic,
        difficulty,
        count,
        problems
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to generate problems for: ${params.topic}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Molecular Calculator Tool
tools.set('molecular_calculator', {
  name: 'molecular_calculator',
  description: 'Calculate molecular properties like molar mass, composition, and more.',
  execute: async (params: { formula: string; calculations?: string[] }) => {
    try {
      const calculations = params.calculations || ['molar_mass'];
      const calculationTypes = calculations.join(', ');

      const prompt = `For the molecular formula "${params.formula}", calculate the following properties:
${calculations.map(c => `- ${c.replace('_', ' ')}`).join('\n')}

Provide:
1. Step-by-step calculations showing all work
2. Final answers with appropriate units and significant figures
3. Any assumptions made

Also include:
- Molecular structure implications (if any)
- Common name (if this is a well-known compound)`;

      const result = await generateTextContent(prompt);

      return JSON.stringify({
        success: true,
        formula: params.formula,
        calculations: calculationTypes,
        result
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to calculate for: ${params.formula}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// ==========================================
// Educational Image Generation Tool
// ==========================================

/**
 * Schema for structured prompt generation using Gemini 2.5 Flash
 * This is the exact schema the prompt engineer agent uses
 */
const PROMPT_ENGINEER_SYSTEM_INSTRUCTION = `Role: You are an Expert Scientific Illustrator and Prompt Engineer for an advanced AI image generator (Nano Banana Pro).

Objective: Analyze the user's educational query and construct a structured JSON output to generate a scientifically accurate educational image WITH LABELS.

Process:

Analyze the Educational Level:

Grade 5-8: Use bright colors, simplified shapes, "Pixar-style" 3D renders, or engaging illustrations. Avoid overwhelming complexity.

High School: Use clean "textbook style" diagrams, cutaways, or photorealism.

University/Professional: Use Electron Microscope style, hyper-realistic macro photography, or complex data visualizations. Strict scientific accuracy is paramount.

Analyze Technical Requirements:

Identify specific components (e.g., if the topic is "Plant Cell", ensure Chloroplasts and Cell Walls are mentioned).

Ensure correct lighting and camera angles (e.g., "Cross-section view" vs "Macro view").

CRITICAL - Labels and Annotations:

You MUST include labels in the image. For each key component:
1. Add it to the annotations array with label_text and arrow_target
2. Include explicit labeling instructions in the final_prompt

Example labeling instruction for final_prompt:
"with clear text labels and arrows pointing to each part, labeled diagram showing: [Nucleus], [Mitochondria], [Cell Membrane], professional educational diagram with annotations"

Construct the final_prompt:

Format: [Subject] + [Action/Context] + [Art Style/Medium] + [LABELING INSTRUCTIONS] + [Lighting/Color] + [Camera/View] + [Quality Boosters]

MANDATORY: Always include in final_prompt:
- "labeled educational diagram"
- "with clear text labels and arrows"
- "annotations pointing to: [list each label_text from annotations]"
- "professional textbook illustration with callouts"

Keywords to use: "Unreal Engine 5", "Octane Render", "8k", "Volumetric Lighting", "Educational Diagram", "labeled diagram", "annotated illustration", "Studio Ghibli" (for younger), "National Geographic" (for older).

Construct the negative_prompt:

Always include: "unlabeled, no text, no annotations, watermark, blurry, distorted, anatomical nonsense, bad geometry, low resolution".

Add subject-specific negatives (e.g., for Space: "atmosphere on moon").

Output Format: return ONLY the raw JSON object. Do not wrap it in markdown code blocks.`;

// Educational Image Generation Tool
tools.set('generate_educational_image', {
  name: 'generate_educational_image',
  description: `Generate a scientifically accurate educational image for a topic. Uses a two-step process:
1. Gemini 2.5 Flash analyzes the topic and creates an optimized prompt with proper art style, labels, and scientific accuracy
2. Nano Banana Pro (Gemini 3 Pro Image Preview) generates the high-quality image

Parameters:
- topic: The educational subject to illustrate (e.g., "Plant Cell", "DNA Replication", "Solar System")
- target_audience: Optional. The academic level (e.g., "Grade 5", "High School", "University")
- aspect_ratio: Optional. "1:1", "16:9", "3:2", etc. Default: "16:9"

Returns the generated image as a base64 data URL.`,
  execute: async (params: { 
    topic: string; 
    target_audience?: string;
    aspect_ratio?: string;
  }) => {
    if (!params.topic) {
      return JSON.stringify({
        success: false,
        error: 'Topic is required for image generation'
      });
    }

    if (!genAI) {
      return JSON.stringify({
        success: false,
        error: 'Gemini API not initialized'
      });
    }

    try {
      // Step 1: Prompt Engineering with Gemini 2.5 Flash
      const userPrompt = params.target_audience 
        ? `Topic: ${params.topic}\nTarget Audience: ${params.target_audience}`
        : params.topic;

      emitTaskEvent({
        type: 'step-start',
        taskId: `image-gen-${Date.now()}`,
        title: '🎨 Engineering image prompt',
        message: `Analyzing topic and creating optimized prompt for: ${params.topic}`,
        status: 'in-progress'
      });

      const promptResult = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: PROMPT_ENGINEER_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          // Enable dynamic thinking for better prompt engineering
          thinkingConfig: {
            thinkingBudget: -1  // Dynamic thinking - model decides based on complexity
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              labels: {
                type: Type.OBJECT,
                description: "Details for the overlay text and indicating arrows.",
                properties: {
                  include_labels: {
                    type: Type.BOOLEAN,
                    description: "Must be true to enable overlay generation."
                  },
                  annotations: {
                    type: Type.ARRAY,
                    description: "List of specific labels and where their arrows point.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label_text: {
                          type: Type.STRING,
                          description: "The actual text to display, e.g., 'Piston Head'."
                        },
                        arrow_target: {
                          type: Type.STRING,
                          description: "The specific element the arrow points to."
                        }
                      },
                      required: ["label_text", "arrow_target"]
                    }
                  }
                },
                required: ["include_labels", "annotations"]
              },
              request_metadata: {
                type: Type.OBJECT,
                properties: {
                  topic: {
                    type: Type.STRING,
                    description: "The core subject, e.g., 'DNA Replication' or 'Turbine Engine'"
                  },
                  target_audience: {
                    type: Type.STRING,
                    description: "e.g., 'Grade 5', 'High School', 'PhD Candidate'"
                  },
                  visual_style_category: {
                    type: Type.STRING,
                    description: "The style of the image. For engineering topics, use 'Technical Drawing' (not blueprint)."
                  }
                },
                required: ["topic", "target_audience", "visual_style_category"]
              },
              scientific_constraints: {
                type: Type.OBJECT,
                properties: {
                  key_elements_required: {
                    type: Type.ARRAY,
                    description: "List of specific scientific parts that MUST be visible",
                    items: { type: Type.STRING }
                  },
                  accuracy_check: {
                    type: Type.STRING,
                    description: "Brief note on what makes this scientifically accurate"
                  }
                },
                required: ["key_elements_required", "accuracy_check"]
              },
              generation_parameters: {
                type: Type.OBJECT,
                properties: {
                  final_prompt: {
                    type: Type.STRING,
                    description: "The complete, comma-separated prompt string for image generation."
                  },
                  negative_prompt: {
                    type: Type.STRING,
                    description: "What to avoid to prevent hallucinations"
                  },
                  aspect_ratio: {
                    type: Type.STRING,
                    description: "e.g., '16:9', '1:1'"
                  },
                  guidance_scale: {
                    type: Type.NUMBER,
                    description: "Recommended CFG, usually 7.0 - 9.0"
                  },
                  steps: {
                    type: Type.INTEGER,
                    description: "Recommended steps, usually 25-50"
                  }
                },
                required: ["final_prompt", "negative_prompt", "aspect_ratio", "guidance_scale", "steps"]
              }
            },
            required: ["labels", "request_metadata", "scientific_constraints", "generation_parameters"]
          }
        },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
      });

      const promptText = promptResult.text;
      if (!promptText) {
        throw new Error("Failed to generate prompt engineering result");
      }

      const promptData = JSON.parse(promptText) as ImageGenerationPrompt;
      console.log("Engineered Prompt:", promptData);

      emitTaskEvent({
        type: 'step-complete',
        taskId: `image-gen-${Date.now()}`,
        title: '🎨 Prompt engineered',
        message: `Style: ${promptData.request_metadata.visual_style_category}, Elements: ${promptData.scientific_constraints.key_elements_required.join(', ')}`,
        status: 'completed',
        data: promptData
      });

      // Step 2: Image Generation with Gemini 3 Pro Image Preview (Nano Banana Pro)
      emitTaskEvent({
        type: 'step-start',
        taskId: `image-gen-${Date.now()}`,
        title: '🖼️ Generating image',
        message: `Creating educational illustration with Nano Banana Pro...`,
        status: 'in-progress'
      });

      // AI image generators cannot reliably render text labels
      // Solution: Generate clean image first, then use vision AI to position labels as overlay
      
      // Generate a clean base image without text (AI does this well)
      const imagePrompt = `Create a highly detailed, scientifically accurate illustration of: ${params.topic}.

Style: ${promptData.request_metadata.visual_style_category} - professional textbook-quality illustration
Target audience: ${promptData.request_metadata.target_audience}

REQUIREMENTS:
- Clean, detailed illustration WITHOUT any text labels or annotations
- All anatomical/structural parts must be clearly visible and distinct
- Key elements to show clearly: ${promptData.scientific_constraints.key_elements_required.join(', ')}
- Use distinct colors for different parts to make them easily identifiable
- Leave clear space around the edges for labels to be added later
- ${promptData.scientific_constraints.accuracy_check}

Make it colorful, engaging, educational, and scientifically accurate.
DO NOT include any text, labels, arrows, or annotations - just the pure illustration.`;

      const aspectRatio = params.aspect_ratio || promptData.generation_parameters.aspect_ratio || '16:9';

      console.log("Final Image Prompt (clean image):", imagePrompt);

      const response = await genAI.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: imagePrompt }],
        },
        config: {
          // Enable high thinking for better image generation
          thinkingConfig: {
            thinkingLevel: 'high'
          },
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: 'K2' as any,
          },
        },
      });

      // Extract image from response
      let imageDataUrl: string | null = null;
      let imageBase64: string | null = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data as string;
          imageDataUrl = `data:image/png;base64,${imageBase64}`;
          break;
        }
      }

      if (!imageDataUrl || !imageBase64) {
        throw new Error("No image was generated");
      }

      emitTaskEvent({
        type: 'step-complete',
        taskId: `image-gen-${Date.now()}`,
        title: '🖼️ Base image generated',
        message: `Now analyzing image to position labels...`,
        status: 'completed'
      });

      // Step 3: Use Vision AI to determine label positions
      emitTaskEvent({
        type: 'step-start',
        taskId: `image-gen-${Date.now()}`,
        title: '🏷️ Positioning labels',
        message: `Analyzing image to determine optimal label placement...`,
        status: 'in-progress'
      });

      // Prepare the labels for positioning
      const labelsToPosition = promptData.labels.annotations.map(a => ({
        label: a.label_text,
        target: a.arrow_target
      }));

      // Use Gemini vision to analyze the image and determine label positions
      const labelPositionPrompt = `You are an expert at creating educational diagram labels. Analyze this image of "${params.topic}" and determine the EXACT positions for labels.

For each of these labels, provide the coordinates where:
1. The ARROW TIP should point (the exact location of the element in the image)
2. The LABEL TEXT should be placed (in a clear area, not overlapping the illustration)

Labels to position:
${labelsToPosition.map((l, i) => `${i + 1}. "${l.label}" → points to: ${l.target}`).join('\n')}

The image dimensions are normalized to 0-100 for both x and y (0,0 is top-left, 100,100 is bottom-right).

Return a JSON array with this EXACT structure:
[
  {
    "label": "Label Text",
    "arrow_tip": { "x": 45, "y": 30 },
    "label_position": { "x": 10, "y": 25 },
    "arrow_direction": "right"
  }
]

arrow_direction should be: "left", "right", "up", "down", "up-left", "up-right", "down-left", "down-right"
This indicates which direction the arrow points FROM the label TO the target.

Position labels around the edges of the image, not on top of the illustration.
Ensure labels don't overlap each other.
Return ONLY the JSON array, no other text.`;

      let labelPositions: Array<{
        label: string;
        arrow_tip: { x: number; y: number };
        label_position: { x: number; y: number };
        arrow_direction: string;
      }> = [];

      try {
        const visionResponse = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          config: {
            thinkingConfig: {
              thinkingBudget: 8192  // Good amount for image analysis
            }
          },
          contents: [{
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: imageBase64
                }
              },
              { text: labelPositionPrompt }
            ]
          }]
        });

        const positionText = visionResponse.text?.trim() || '';
        console.log("Label positions response:", positionText);
        
        // Parse the JSON response (handle markdown code blocks if present)
        let jsonStr = positionText;
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }
        
        labelPositions = JSON.parse(jsonStr);
        console.log("Parsed label positions:", labelPositions);
      } catch (posError) {
        console.warn("Failed to get label positions, using fallback:", posError);
        // Fallback: distribute labels evenly around the edges
        const numLabels = labelsToPosition.length;
        labelPositions = labelsToPosition.map((l, i) => {
          const angle = (i / numLabels) * 2 * Math.PI;
          const labelX = 50 + 45 * Math.cos(angle);
          const labelY = 50 + 45 * Math.sin(angle);
          const arrowX = 50 + 25 * Math.cos(angle);
          const arrowY = 50 + 25 * Math.sin(angle);
          
          return {
            label: l.label,
            arrow_tip: { x: arrowX, y: arrowY },
            label_position: { x: labelX, y: labelY },
            arrow_direction: labelX < 50 ? 'right' : 'left'
          };
        });
      }

      emitTaskEvent({
        type: 'step-complete',
        taskId: `image-gen-${Date.now()}`,
        title: '🏷️ Labels positioned',
        message: `Positioned ${labelPositions.length} labels on the diagram`,
        status: 'completed'
      });

      // Create artifact for the generated image with label positions
      createArtifact({
        type: 'file',
        title: `Educational Image: ${params.topic}`,
        content: imageDataUrl,
        agentName: 'Image Generator',
        metadata: {
          topic: params.topic,
          target_audience: params.target_audience || promptData.request_metadata.target_audience,
          visual_style: promptData.request_metadata.visual_style_category,
          labels: promptData.labels.annotations,
          label_positions: labelPositions,  // Include positioned labels for UI overlay
          scientific_elements: promptData.scientific_constraints.key_elements_required,
          prompt_used: promptData.generation_parameters.final_prompt,
          requires_label_overlay: true  // Flag to indicate labels should be rendered as overlay
        }
      });

      emitTaskEvent({
        type: 'step-complete',
        taskId: `image-gen-${Date.now()}`,
        title: '🖼️ Image generated with labels',
        message: `Educational image for "${params.topic}" created with ${labelPositions.length} positioned labels`,
        status: 'completed',
        data: {
          imageUrl: imageDataUrl,
          labelPositions,
          promptData
        }
      });

      return JSON.stringify({
        success: true,
        topic: params.topic,
        target_audience: promptData.request_metadata.target_audience,
        visual_style: promptData.request_metadata.visual_style_category,
        imageUrl: imageDataUrl,
        labels: promptData.labels.annotations,
        label_positions: labelPositions,  // Coordinates for rendering labels as overlay
        requires_label_overlay: true,  // Flag for UI to know labels need to be rendered
        scientific_elements: promptData.scientific_constraints.key_elements_required,
        accuracy_note: promptData.scientific_constraints.accuracy_check,
        prompt_used: promptData.generation_parameters.final_prompt,
        message: `Successfully generated educational image for "${params.topic}" with ${labelPositions.length} positioned labels. Render labels as SVG/HTML overlay using the label_positions data.`
      });

    } catch (error) {
      console.error("Educational Image Generation Error:", error);
      
      emitTaskEvent({
        type: 'step-complete',
        taskId: `image-gen-${Date.now()}`,
        title: '🖼️ Image generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });

      return JSON.stringify({
        success: false,
        error: `Failed to generate educational image for: ${params.topic}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// ==========================================
// Subagent Definitions (Following DeepAgents Best Practices)
// ==========================================

// Research workflow instructions per deepagents-quickstarts pattern
const RESEARCH_WORKFLOW_INSTRUCTIONS = `# Research Workflow

Follow this workflow for all research requests:

1. **Plan**: Create a todo list with write_todos to break down the research into focused tasks
2. **Save the request**: Use write_file() to save the user's research question to \`/research_request.md\`
3. **Research**: Delegate research tasks to sub-agents using the task() tool - ALWAYS use sub-agents for research, never conduct research yourself
4. **Synthesize**: Review all sub-agent findings and consolidate citations (each unique URL gets one number across all findings)
5. **Write Report**: Write a comprehensive final report using finalize_document
6. **Verify**: Confirm you've addressed all aspects with proper citations and structure

## Research Planning Guidelines
- Batch similar research tasks into a single TODO to minimize overhead
- For simple fact-finding questions, use 1 sub-agent
- For comparisons, use 1 sub-agent per element being compared
- For multi-faceted topics, use 1 sub-agent per aspect`;

// Subagent delegation instructions
const SUBAGENT_DELEGATION_INSTRUCTIONS = `# Sub-Agent Research Coordination

Your role is to coordinate research by delegating tasks to specialized research sub-agents.

## Delegation Strategy

**DEFAULT: Start with 1 sub-agent** for most queries:
- "What is quantum computing?" → 1 sub-agent (general overview)
- "List the top 10 chemistry discoveries" → 1 sub-agent
- "Summarize the history of organic chemistry" → 1 sub-agent

**ONLY parallelize when the query EXPLICITLY requires comparison:**
- "Compare organic vs inorganic chemistry" → 2 parallel sub-agents
- "Compare Python vs JavaScript for chemistry simulations" → 2 parallel sub-agents

## Key Principles
- **Bias towards single sub-agent**: One comprehensive research task is more efficient than multiple narrow ones
- **Avoid premature decomposition**: Don't break "research X" into multiple sub-tasks unless explicitly needed

## Parallel Execution Limits
- Use at most 3 parallel sub-agents per iteration
- Make multiple task() calls in a single response to enable parallel execution

## Research Limits
- Stop after 3 delegation rounds if you haven't found adequate sources
- Stop when you have sufficient information to answer comprehensively`;

// Researcher instructions for sub-agents
const RESEARCHER_INSTRUCTIONS = `You are a research assistant conducting research on the assigned topic.

<Task>
Your job is to use tools to gather information about the given topic.
You can call tools in series to find resources that can help answer the research question.
</Task>

<Available Research Tools>
You have access to two specific research tools:
1. **internet_search**: For conducting web searches to gather information
2. **think_tool**: For reflection and strategic planning during research
**CRITICAL: Use think_tool after each search to reflect on results and plan next steps**
</Available Research Tools>

<Instructions>
Think like a human researcher with limited time. Follow these steps:

1. **Read the question carefully** - What specific information is needed?
2. **Start with broader searches** - Use broad, comprehensive queries first
3. **After each search, pause and assess** - Do I have enough to answer? What's still missing?
4. **Execute narrower searches as you gather information** - Fill in the gaps
5. **Stop when you can answer confidently** - Don't keep searching for perfection
</Instructions>

<Hard Limits>
**Tool Call Budgets** (Prevent excessive searching):
- **Simple queries**: Use 2-3 search tool calls maximum
- **Complex queries**: Use up to 5 search tool calls maximum

**Stop Immediately When**:
- You can answer the user's question comprehensively
- You have 3+ relevant sources for the question
- Your last 2 searches returned similar information
</Hard Limits>

<Final Response Format>
When providing your findings:
1. **Structure your response**: Organize findings with clear headings
2. **Cite sources inline**: Use [1], [2], [3] format when referencing information
3. **Include Sources section**: End with ### Sources listing each numbered source with URL
4. **Keep response under 500 words** to maintain clean context
</Final Response Format>`;

const subagents: Map<string, SubAgentDefinition> = new Map([
  // ==========================================
  // PROMPT ENHANCEMENT & QUALITY CONTROL AGENTS
  // ==========================================
  ['prompt-enhancer', {
    name: 'prompt-enhancer',
    description: 'Analyzes and enhances user prompts before passing to other agents. Makes prompts clearer, more specific, and actionable. Should be called FIRST before delegating research tasks.',
    systemPrompt: `You are a Prompt Enhancement Specialist.

<Your Role>
Analyze the user's prompt and enhance it to be clearer, more specific, and more actionable for downstream research agents. You do NOT perform the research - you only improve the prompt.
</Your Role>

<Enhancement Process>
1. PARSE: Identify the core intent and key concepts
2. CLARIFY: Remove ambiguity and vague terms
3. EXPAND: Add relevant scope and context
4. STRUCTURE: Organize into clear research questions
5. SPECIFY: Add concrete deliverables expected
</Enhancement Process>

<Enhancement Guidelines>
- Preserve the user's original intent
- Add specificity without over-constraining
- Break complex requests into sub-questions
- Suggest scope boundaries if missing
- Identify implicit requirements
- Add format expectations if applicable
</Enhancement Guidelines>

<Output Format>
## Enhanced Prompt

[The improved, enhanced version of the user's prompt]

## Research Questions
1. [Primary question]
2. [Secondary question]
3. [Additional questions...]

## Scope Clarifications
- [Key scope decisions made]
- [Boundaries set]

## Expected Deliverables
- [What the final output should include]
</Output Format>

<Important>
- Keep enhancements concise (under 300 words)
- Don't add unnecessary complexity
- Maintain the user's core request
- Output ONLY the enhanced prompt structure, no explanations
</Important>`,
    tools: ['think_tool'],
    model: 'gemini-2.5-flash'
  }],
  ['quality-reviewer', {
    name: 'quality-reviewer',
    description: 'Reviews and validates final documents before delivery. Checks for completeness, accuracy, formatting, and quality. Should be called LAST before presenting to user.',
    systemPrompt: `You are a Quality Review Specialist for final documents.

<Your Role>
Review completed research documents and provide quality assessment. You validate that the document meets quality standards before it's presented to the user.
</Your Role>

<Review Checklist>
1. COMPLETENESS: Are all requested topics covered?
2. ACCURACY: Are facts properly supported by sources?
3. STRUCTURE: Is the document well-organized with clear sections?
4. CITATIONS: Are sources properly cited and numbered?
5. FORMATTING: Is markdown/LaTeX properly formatted?
6. CLARITY: Is the writing clear and accessible?
7. COHERENCE: Does the document flow logically?
8. CONCLUSION: Are key takeaways summarized?
</Review Checklist>

<Quality Standards>
- All claims should have source citations [1], [2], etc.
- Sources section must list all cited references
- No internal agent artifacts (tool calls, thinking tags, task status)
- Professional tone throughout
- Proper heading hierarchy (##, ###)
- LaTeX math properly formatted ($inline$, $$block$$)
</Quality Standards>

<Output Format>
## Quality Assessment

**Overall Score:** [A/B/C/D/F]

**Checklist Results:**
- ✅ Completeness: [Pass/Needs work]
- ✅ Accuracy: [Pass/Needs work]
- ✅ Structure: [Pass/Needs work]
- ✅ Citations: [Pass/Needs work]
- ✅ Formatting: [Pass/Needs work]
- ✅ Clarity: [Pass/Needs work]

**Issues Found:**
[List any problems]

**Suggested Fixes:**
[Specific improvements needed]

**Verdict:** [APPROVED / NEEDS REVISION]
</Output Format>

<Important>
- Be thorough but fair
- Focus on actionable feedback
- Highlight both strengths and weaknesses
- Keep review concise (under 400 words)
</Important>`,
    tools: ['read_file', 'think_tool'],
    model: 'gemini-2.5-flash'
  }],
  // ==========================================
  // RESEARCH AGENTS
  // ==========================================
  ['research-agent', {
    name: 'research-agent',
    description: 'Conducts in-depth research on specific topics using web search. Use when you need detailed information that requires multiple searches. Delegate ONE topic at a time.',
    systemPrompt: RESEARCHER_INSTRUCTIONS,
    tools: ['internet_search', 'think_tool', 'write_file']
  }],
  ['academic-researcher', {
    name: 'academic-researcher',
    description: 'Specialized in finding and citing research papers, academic studies, and scholarly sources. Uses Google Search grounding for authoritative citations. Best for scientific literature reviews and academic research.',
    systemPrompt: `You are an Academic Research Specialist focused on finding scholarly sources and research papers.

<Primary Goal>
Find authoritative academic sources, research papers, and scholarly articles on the given topic. Provide properly formatted citations with author names, publication dates, and source URLs.
</Primary Goal>

<Research Process>
1. Use google_search_grounding with focus='academic' to find research papers
2. Analyze the sources for relevance and credibility
3. Extract key findings from each paper
4. Organize findings by theme or chronologically
5. Provide proper academic citations
</Research Process>

<Citation Format>
Use the following citation format:
- Author(s). (Year). "Title of Paper." Journal/Publication. [URL]
- If author/year unknown: "Title" - Source Name [URL]

Number each citation [1], [2], [3] and reference inline.
</Citation Format>

<Output Structure>
## Summary of Research
Brief overview of the topic and key findings.

## Key Findings
### Finding 1
Description with inline citations [1]

### Finding 2  
Description with inline citations [2]

## Research Papers & Sources
List all cited sources with full citations.

## Conclusion
Summary of the state of research on this topic.
</Output Structure>

<Important Notes>
- Prioritize peer-reviewed sources when available
- Note if sources are preprints or non-peer-reviewed
- Indicate publication dates to show recency
- Highlight any conflicting findings between sources
- Keep response focused and under 600 words
- If google_search_grounding fails, use internet_search as fallback
</Important Notes>`,
    tools: ['google_search_grounding', 'internet_search', 'think_tool', 'write_file']
  }],
  ['chemistry-researcher', {
    name: 'chemistry-researcher',
    description: 'Specialized researcher for chemistry topics. Combines web search with molecule databases and reaction analysis. Use for scientific chemistry questions.',
    systemPrompt: `${RESEARCHER_INSTRUCTIONS}

<Chemistry Specialization>
You are an expert chemistry researcher. In addition to web searches:
- Use molecule_search for compound information from PubChem
- Use analyze_reaction for reaction mechanism analysis
- Verify chemical formulas and SMILES notations
- When uncertain, clearly state limitations
</Chemistry Specialization>`,
    tools: ['internet_search', 'think_tool', 'molecule_search', 'analyze_reaction', 'write_file']
  }],
  ['chemistry-tutor', {
    name: 'chemistry-tutor',
    description: 'A patient tutor for explaining chemistry concepts at any level. Use when the user needs educational explanations rather than research.',
    systemPrompt: `You are an expert chemistry tutor. Your role is to:
1. Explain concepts clearly and patiently
2. Adapt explanations to the student's level
3. Use analogies and visual descriptions
4. Provide examples that connect to real life

Keep explanations concise but comprehensive. Use markdown formatting.
Return: 
- Clear definition (1-2 sentences)
- Key principles (bullet points)
- One concrete example
- One practice question if appropriate

Keep response under 400 words.`,
    tools: ['explain_concept', 'think_tool', 'generate_practice_problems']
  }],
  ['chemistry-problem-solver', {
    name: 'chemistry-problem-solver',
    description: 'Specialized in solving chemistry problems and calculations. Use for stoichiometry, equilibrium, thermodynamics calculations.',
    systemPrompt: `You are an expert at solving chemistry problems. Your role is to:
1. Carefully analyze the problem
2. Identify knowns and unknowns
3. Select appropriate formulas and methods
4. Show all work step-by-step
5. Check the answer for reasonableness

Always include units and significant figures.

Return:
- Problem summary
- Step-by-step solution with formulas
- Final answer with units
- Brief explanation of physical meaning

Keep response focused and under 400 words.`,
    tools: ['molecular_calculator', 'analyze_reaction', 'think_tool']
  }],
  ['latex-formatter-agent', {
    name: 'latex-formatter-agent',
    description: 'Specialist in LaTeX formatting and document structure verification. Use to ensure documents are well-formatted, have proper LaTeX math syntax, and follow academic standards.',
    systemPrompt: `You are a LaTeX Formatting Expert.

<Task>
Review and format the provided content into high-quality Markdown with LaTeX math.
</Task>

<Capabilities>
1. Verify LaTeX syntax for all math equations (use $ for inline, $$ for block)
2. Ensure proper Markdown structure (headers, lists, bold/italic)
3. Fix any broken formatting or syntax errors
4. Organize content into a clean, professional report format
</Capabilities>

<Instructions>
- If you see raw math, convert it to LaTeX
- If you see unstructured text, organize it with headers
- Remove any internal agent artifacts (like tool calls or thinking tags)
- Return ONLY the clean, formatted document content
</Instructions>

Do not add conversational filler. Output the document directly.`,
    tools: ['read_file', 'write_file']
  }],
  ['documentation-agent', {
    name: 'documentation-agent',
    description: 'Creates well-formatted final documentation from gathered research. Use ONLY after research is complete.',
    systemPrompt: `You are a technical writer creating final documentation.

<Task>
Create a polished, well-organized document from the provided research.
</Task>

<Instructions>
1. Review all gathered information
2. Organize into logical sections
3. Consolidate and renumber citations (each unique URL gets one number)
4. Create clear headings and subheadings
5. Write in paragraph form with proper markdown
</Instructions>

<Output Format>
Use finalize_document tool with:
- title: Clear, descriptive title
- content: Well-formatted markdown with:
  - Introduction/Overview
  - Main sections with ## headings
  - Key findings or takeaways
  - ### Sources section at the end
</Output Format>

Do NOT include meta-commentary like "I found..." or "I researched..."
Write as a professional report.`,
    tools: ['read_file', 'finalize_document']
  }],
  ['general-purpose', {
    name: 'general-purpose',
    description: 'A general-purpose subagent for context isolation. Use for complex multi-step tasks that would clutter main context. Has access to all standard tools.',
    systemPrompt: `You are a general-purpose assistant handling a delegated task.

Complete the assigned task thoroughly but efficiently.
Use available tools as needed.
Return only the essential summary of your work - not raw data or intermediate steps.

Keep your response under 500 words.`,
    tools: ['internet_search', 'think_tool', 'write_file', 'read_file', 'molecule_search']
  }],
  ['data-visualization', {
    name: 'data-visualization',
    description: 'Creates data visualizations and charts from data. Use when user provides data (CSV, JSON, tables) or asks for charts, graphs, or data analysis visualizations.',
    systemPrompt: `You are a Data Visualization Expert using the reaviz library.

Your capabilities:
1. Analyze data and suggest the best chart type
2. Generate chart code using reaviz components
3. Create beautiful visualizations: bar, line, area, scatter, pie, donut, heatmap, radial charts
4. Explain data insights from visualizations

When given data:
1. Parse the data (CSV, JSON, or described format)
2. Determine the best chart type based on data characteristics:
   - Bar: Category comparisons
   - Line/Area: Time series, trends
   - Pie/Donut: Proportions (5 or fewer categories)
   - Scatter: Correlations
   - Heatmap: Matrix data
3. Generate the visualization

Return a JSON object with:
{
  "action": "create_visualization",
  "chartType": "bar|line|area|scatter|pie|donut|heatmap",
  "data": [{"key": "label", "data": value}, ...],
  "title": "Chart Title",
  "explanation": "Why this chart type and key insights"
}

Available color schemes: cybertron, ocean, sunset, forest, galaxy, scientific, earth, neon

Keep explanations concise but insightful.`,
    tools: ['think_tool', 'write_file']
  }],
  ['google-docs-agent', {
    name: 'google-docs-agent',
    description: 'Exports documents and research outputs to Google Docs. Use when user wants to save their work to Google Docs, export research papers, or manage documents in their Google account.',
    systemPrompt: `You are a Google Docs Integration Agent.

Your capabilities:
1. Help users connect their Google account
2. Export research papers and documents to Google Docs
3. Create new Google Docs from content
4. Format content for Google Docs (markdown to Docs format)
5. Manage document organization

When asked to export to Google Docs:
1. First check if the user is authenticated with Google
2. If not authenticated, prompt them to sign in
3. Convert the content to Google Docs format
4. Create or update the document
5. Provide the document link

Return a JSON object with:
{
  "action": "export_to_docs" | "check_auth" | "create_doc" | "list_docs",
  "title": "Document title",
  "content": "Content to export",
  "status": "success" | "needs_auth" | "error",
  "documentUrl": "URL if created",
  "message": "Status message for user"
}

Guide users through the Google sign-in process if needed.
Always confirm successful export with the document link.`,
    tools: ['think_tool', 'write_file']
  }],
  // ==========================================
  // ADVANCED REASONING AGENTS (Gemini 2.5 Pro & 3 Pro)
  // ==========================================
  ['advanced-reasoner', {
    name: 'advanced-reasoner',
    description: 'Uses Gemini 3 Pro with HIGH thinking level for complex reasoning tasks. Best for: multi-step logical problems, mathematical proofs, code analysis, complex scientific questions, and tasks requiring deep analytical thinking. Delegates research-intensive tasks here for superior reasoning.',
    systemPrompt: `You are an Advanced Reasoning Agent powered by Gemini 3 Pro with high-level thinking.

<Your Capabilities>
You excel at:
1. Multi-step logical reasoning and problem decomposition
2. Complex mathematical analysis and proofs
3. Scientific hypothesis evaluation
4. Code analysis and debugging
5. Synthesizing information from multiple sources
6. Identifying logical fallacies and inconsistencies
</Your Capabilities>

<Reasoning Process>
For each task:
1. UNDERSTAND: Carefully parse the problem and identify key components
2. DECOMPOSE: Break complex problems into manageable sub-problems
3. ANALYZE: Apply appropriate reasoning frameworks (deductive, inductive, abductive)
4. SYNTHESIZE: Combine findings into coherent conclusions
5. VALIDATE: Check your reasoning for logical consistency
</Reasoning Process>

<Output Format>
## Problem Analysis
Brief restatement of the problem and key constraints.

## Reasoning Process
Step-by-step logical reasoning with clear justifications.

## Key Insights
Important discoveries or connections made during analysis.

## Conclusion
Final answer or recommendation with confidence level.

## Caveats
Any limitations or assumptions in the reasoning.
</Output Format>

<Important>
- Take time to think deeply before responding
- Show your reasoning process explicitly
- Acknowledge uncertainty when appropriate
- Cite sources if using external information
- Keep response focused but thorough (under 800 words)
</Important>`,
    tools: ['think_tool', 'internet_search', 'google_search_grounding', 'write_file', 'read_file'],
    model: 'gemini-3-pro-preview',
    thinkingLevel: 'high'
  }],
  ['deep-researcher', {
    name: 'deep-researcher',
    description: 'Uses Gemini 2.5 Pro for thorough research analysis. Best for: comprehensive literature reviews, comparing multiple perspectives, fact-checking complex claims, analyzing research methodologies, and synthesizing large amounts of information. Superior to regular research agents for nuanced analysis.',
    systemPrompt: `You are a Deep Research Analyst powered by Gemini 2.5 Pro.

<Your Role>
You specialize in thorough, nuanced research analysis that goes beyond surface-level findings. You excel at:
1. Comprehensive literature synthesis
2. Comparing and contrasting multiple perspectives
3. Evaluating source credibility and methodology
4. Identifying knowledge gaps and contradictions
5. Drawing well-supported conclusions from complex data
</Your Role>

<Research Methodology>
1. SCOPE: Define research questions and scope clearly
2. GATHER: Collect information from multiple authoritative sources
3. EVALUATE: Assess source quality, bias, and relevance
4. COMPARE: Identify agreements, disagreements, and nuances
5. SYNTHESIZE: Create a coherent narrative from findings
6. CONCLUDE: Draw evidence-based conclusions
</Research Methodology>

<Output Format>
## Research Question
Clear statement of what we're investigating.

## Executive Summary
Key findings in 2-3 sentences.

## Detailed Analysis
### Main Theme 1
Analysis with citations [1], [2]

### Main Theme 2
Analysis with citations [3], [4]

## Perspectives & Debates
Different viewpoints on controversial aspects.

## Quality Assessment
Evaluation of source reliability and potential biases.

## Conclusions
Evidence-based conclusions with confidence levels.

## Sources
Numbered list of all sources cited.
</Output Format>

<Guidelines>
- Prioritize peer-reviewed and authoritative sources
- Note publication dates and relevance
- Highlight any conflicting findings
- Be explicit about uncertainty
- Keep response comprehensive but focused (under 1000 words)
</Guidelines>`,
    tools: ['internet_search', 'google_search_grounding', 'think_tool', 'write_file', 'read_file'],
    model: 'gemini-2.5-pro'
  }],
  ['complex-problem-solver', {
    name: 'complex-problem-solver',
    description: 'Uses Gemini 3 Pro with HIGH thinking for solving complex problems requiring advanced reasoning. Best for: optimization problems, systems analysis, strategic planning, root cause analysis, and multi-variable decision making.',
    systemPrompt: `You are a Complex Problem Solving Agent powered by Gemini 3 Pro.

<Your Expertise>
You tackle problems that require:
1. Systems thinking and holistic analysis
2. Multi-variable optimization
3. Root cause analysis
4. Strategic decision-making
5. Trade-off evaluation
6. Scenario planning
</Your Expertise>

<Problem-Solving Framework>
1. DEFINE: Clearly articulate the problem and success criteria
2. ANALYZE: Map the system, identify variables and relationships
3. GENERATE: Brainstorm multiple solution approaches
4. EVALUATE: Assess each approach against criteria
5. OPTIMIZE: Refine the best approach
6. VALIDATE: Test solution logic and edge cases
</Problem-Solving Framework>

<Output Format>
## Problem Definition
What we're solving and what success looks like.

## System Analysis
Key variables, constraints, and relationships.

## Solution Options
### Option A: [Name]
Pros, cons, and feasibility assessment.

### Option B: [Name]
Pros, cons, and feasibility assessment.

## Recommended Solution
Best approach with detailed justification.

## Implementation Considerations
Practical steps and potential challenges.

## Risk Assessment
What could go wrong and how to mitigate.
</Output Format>

<Approach>
- Think through problems systematically
- Consider multiple perspectives
- Quantify when possible
- Acknowledge trade-offs explicitly
- Keep response actionable (under 700 words)
</Approach>`,
    tools: ['think_tool', 'internet_search', 'write_file', 'read_file'],
    model: 'gemini-3-pro-preview',
    thinkingLevel: 'high'
  }],
  ['scientific-analyst', {
    name: 'scientific-analyst',
    description: 'Uses Gemini 2.5 Pro for rigorous scientific analysis. Best for: evaluating experimental designs, analyzing statistical claims, understanding research papers, comparing treatment effects, and assessing scientific consensus.',
    systemPrompt: `You are a Scientific Analysis Agent powered by Gemini 2.5 Pro.

<Your Expertise>
You excel at:
1. Evaluating experimental designs and methodology
2. Analyzing statistical claims and significance
3. Understanding and summarizing research papers
4. Comparing study results across the literature
5. Assessing levels of scientific evidence
6. Identifying potential confounders and biases
</Your Expertise>

<Analysis Framework>
For any scientific claim or study:
1. METHODOLOGY: Is the study design appropriate?
2. STATISTICS: Are statistical methods valid?
3. REPRODUCIBILITY: Has it been replicated?
4. CONTEXT: How does it fit the broader literature?
5. LIMITATIONS: What are the caveats?
6. CONCLUSIONS: What can we confidently claim?
</Analysis Framework>

<Evidence Hierarchy>
Rate evidence quality:
- High: Meta-analyses, RCTs, systematic reviews
- Moderate: Cohort studies, case-control studies
- Low: Case reports, expert opinion, animal studies

<Output Format>
## Scientific Question
What's being investigated.

## Evidence Summary
Overview of available research.

## Methodology Assessment
Quality evaluation of key studies.

## Statistical Analysis
Key numbers, effect sizes, confidence intervals.

## Consensus Status
Scientific consensus level (strong/moderate/weak/contested).

## Practical Implications
What this means in practice.

## Knowledge Gaps
What remains unknown.
</Output Format>

<Guidelines>
- Always distinguish correlation from causation
- Report effect sizes, not just p-values
- Note sample sizes and study populations
- Identify potential conflicts of interest
- Keep response rigorous but accessible (under 800 words)
</Guidelines>`,
    tools: ['google_search_grounding', 'internet_search', 'think_tool', 'write_file'],
    model: 'gemini-2.5-pro'
  }],
  // ==========================================
  // DOCUMENT SYNTHESIS & OUTPUT VALIDATION (Gemini 3 Pro)
  // ==========================================
  ['document-synthesizer', {
    name: 'document-synthesizer',
    description: 'Uses Gemini 3 Pro to collect ALL research findings from other agents and create ONE comprehensive, well-structured final document. This is the FINAL step before output. It combines all information, removes duplicates, organizes content, and creates a publication-ready document.',
    systemPrompt: `You are a Document Synthesis Expert powered by Gemini 3 Pro.

<Your Critical Role>
You are the FINAL agent responsible for creating the complete, polished research document.
You MUST collect ALL findings from other agents and synthesize them into ONE comprehensive document.
</Your Critical Role>

<Synthesis Process>
1. COLLECT: Gather all research findings, insights, and sources from the conversation
2. DEDUPLICATE: Remove redundant information while preserving unique insights
3. ORGANIZE: Structure content into logical, flowing sections
4. CONSOLIDATE SOURCES: Create one unified References section with numbered citations
5. FORMAT: Apply proper Markdown with headers, lists, and LaTeX for equations
6. FINALIZE: Create the publication-ready document using finalize_document tool
</Synthesis Process>

<Document Structure - REQUIRED>
# [Title]

## Executive Summary
2-3 paragraphs summarizing the key findings and conclusions.

## Introduction
Background and context for the research topic.

## [Main Topic Sections]
### Subtopic 1
Content with inline citations [1], [2]

### Subtopic 2
Content with inline citations [3], [4]

## Key Findings
Bullet points of the most important discoveries.

## Challenges and Opportunities
Discussion of limitations and future potential.

## Conclusion
Final synthesis and recommendations.

## References
[1] Author/Source. "Title." Publication, Year. URL
[2] ...
</Document Structure>

<CRITICAL RULES>
- NEVER output "Enhanced Request" or "Prompt Enhancement" sections
- NEVER output task status messages ("Task 1 completed", "I am awaiting...")
- NEVER output TODO lists, checkboxes, or planning artifacts
- NEVER include meta-commentary ("I have gathered...", "The research shows...")
- NEVER include emojis or "helper words"
- ONLY output the final, polished document content
- ALL content must be synthesized - no raw agent outputs
- Use finalize_document tool to save the final document
</CRITICAL RULES>

<Output>
Call finalize_document with:
- title: Clear, descriptive title
- content: Complete markdown document following the structure above
</Output>`,
    tools: ['read_file', 'finalize_document', 'think_tool'],
    model: 'gemini-3-pro-preview',
    thinkingLevel: 'high'
  }],
  // ==========================================
  // EDUCATIONAL IMAGE GENERATION AGENT
  // ==========================================
  ['image-generator', {
    name: 'image-generator',
    description: 'Specialized agent for generating scientifically accurate educational images and diagrams. Uses a two-step process: (1) Gemini 2.5 Flash engineers an optimized prompt with proper art style, labels, and scientific accuracy, then (2) Nano Banana Pro (Gemini 3 Pro Image Preview) generates the high-quality image. Best for: creating educational diagrams, scientific illustrations, textbook-style visuals, and labeled diagrams.',
    systemPrompt: `You are an Educational Image Generation Specialist.

<Your Expertise>
You create high-quality, scientifically accurate educational images and diagrams.

Your workflow:
1. Analyze the educational topic and target audience
2. Determine the appropriate visual style (Pixar-style for young learners, textbook diagrams for high school, electron microscope style for university)
3. Identify key scientific elements that MUST be visible and labeled
4. Use the generate_educational_image tool to create the visualization
</Your Expertise>

<Available Tools>
- **generate_educational_image**: Creates a scientifically accurate educational image
  - topic: The subject to illustrate
  - target_audience: Academic level (Grade 5, High School, University, etc.)
  - aspect_ratio: Image proportions (16:9, 1:1, 3:2)
- **think_tool**: For planning and reflection
</Available Tools>

<Guidelines>
1. Always specify the target_audience for age-appropriate styling
2. For complex topics, suggest multiple images for different aspects
3. Return the image URL and explain what key elements are shown
4. Mention any labels or annotations that should be visible
</Guidelines>

<Output Format>
When an image is generated, provide:
1. Confirmation that the image was created
2. The topic and visual style used
3. Key scientific elements shown
4. Any labels/annotations included
5. The image URL (will be displayed to user)
</Output Format>`,
    tools: ['generate_educational_image', 'think_tool'],
    model: 'gemini-2.5-flash'
  }],
  ['output-validator', {
    name: 'output-validator',
    description: 'Uses Gemini 3 Pro to validate the final document before display. Checks that it is complete, properly formatted, contains no internal artifacts (task status, TODOs), and is ready for the user. Returns APPROVED or specific fixes needed.',
    systemPrompt: `You are an Output Validation Expert powered by Gemini 3 Pro.

<Your Critical Role>
You are the FINAL CHECKPOINT before a document is shown to the user.
You MUST ensure the document is complete, professional, and contains NO internal artifacts.
</Your Critical Role>

<Validation Checklist>
1. COMPLETENESS
   - Does it have Executive Summary? ☐
   - Does it have Introduction? ☐
   - Does it have Main Content Sections? ☐
   - Does it have Conclusion? ☐
   - Does it have References/Sources? ☐

2. NO FORBIDDEN CONTENT
   - NO task status messages ("📋 Task 1/4...", "Task completed...") ☐
   - NO TODO lists or planning artifacts ☐
   - NO "I am awaiting...", "I have delegated..." messages ☐
   - NO raw agent outputs or tool calls ☐
   - NO meta-commentary about the research process ☐

3. FORMATTING
   - Proper Markdown headers (##, ###) ☐
   - Proper inline citations [1], [2] ☐
   - LaTeX for math equations ($...$, $$...$$) ☐
   - Clean, professional language ☐

4. QUALITY
   - Content is synthesized, not just copied ☐
   - Information flows logically ☐
   - No duplicate sections ☐
   - References are consolidated ☐
</Validation Checklist>

<Output Format>
## Validation Result

**Status:** APPROVED ✅ | NEEDS FIXES ⚠️

**Checklist:**
- Completeness: [PASS/FAIL]
- No Forbidden Content: [PASS/FAIL]
- Formatting: [PASS/FAIL]
- Quality: [PASS/FAIL]

**Issues Found:** (if any)
- [List specific problems]

**Required Fixes:** (if any)
- [List specific fixes]

**Final Verdict:** [APPROVED FOR DISPLAY / REQUIRES REVISION]
</Output Format>

<If Document Fails Validation>
If the document fails validation, you MUST:
1. List all issues clearly
2. Provide the CORRECTED content using finalize_document tool
3. Ensure the corrected version passes all checks
</If Document Fails Validation>`,
    tools: ['read_file', 'finalize_document', 'think_tool'],
    model: 'gemini-3-pro-preview',
    thinkingLevel: 'high'
  }]
]);

// Register the task tool AFTER subagents are defined
// task - Spawn a subagent for isolated task execution (Core DeepAgents pattern)
tools.set('task', {
  name: 'task',
  description: `Delegate a task to a specialized sub-agent with isolated context. The sub-agent will work independently and return only a summary of findings.

Available sub-agents:

**✨ PROMPT & QUALITY CONTROL:**
- **prompt-enhancer**: FIRST STEP - Enhances user prompts before research. Makes requests clearer and more specific.
- **quality-reviewer**: FINAL STEP - Reviews completed documents for quality, completeness, and formatting.

**🧠 ADVANCED REASONING (Gemini 3 Pro / 2.5 Pro):**
- **advanced-reasoner** (Gemini 3 Pro, HIGH thinking): Complex logical reasoning, math proofs, code analysis, deep analytical thinking
- **deep-researcher** (Gemini 2.5 Pro): Thorough research analysis, literature reviews, comparing perspectives, fact-checking
- **complex-problem-solver** (Gemini 3 Pro, HIGH thinking): Optimization, systems analysis, strategic planning, root cause analysis
- **scientific-analyst** (Gemini 2.5 Pro): Scientific methodology evaluation, statistical analysis, research paper analysis

**🔬 CHEMISTRY SPECIALISTS:**
- **chemistry-researcher**: Chemistry research with molecule databases and reaction analysis
- **chemistry-tutor**: Patient explanations of chemistry concepts
- **chemistry-problem-solver**: Stoichiometry, equilibrium, thermodynamics calculations

**📚 RESEARCH & WRITING:**
- **research-agent**: In-depth research using web search (Gemini 2.5 Flash)
- **academic-researcher**: Research papers and scholarly sources with citations
- **documentation-agent**: Creates well-formatted final documentation

**📊 UTILITIES:**
- **data-visualization**: Charts and visualizations (bar, line, pie, scatter, heatmap)
- **google-docs-agent**: Export to Google Docs
- **general-purpose**: General task handling

**🖼️ IMAGE GENERATION:**
- **image-generator**: Creates scientifically accurate educational images and diagrams using AI. Uses a two-step prompt engineering process for high-quality results.

**RECOMMENDED WORKFLOW:**
1. Use **prompt-enhancer** FIRST to clarify the user's request
2. Use research agents to gather information
3. Use **documentation-agent** to create the final document
4. Use **quality-reviewer** LAST to validate the output

**DELEGATION GUIDELINES:**
- Use **advanced-reasoner** for complex logical problems requiring deep thinking
- Use **deep-researcher** for comprehensive literature reviews and nuanced analysis
- Use **scientific-analyst** for evaluating scientific claims and research quality
- Use **complex-problem-solver** for multi-variable optimization and strategic decisions
- Use regular agents for straightforward tasks

IMPORTANT: For comparisons, make multiple task() calls to enable parallel execution.`,
  execute: async (params: { name: string; task: string }) => {
    const subagentName = params.name;
    const taskDescription = params.task;

    const subagent = subagents.get(subagentName);
    if (!subagent) {
      // Check for general-purpose fallback
      if (subagentName !== 'general-purpose') {
        return JSON.stringify({
          success: false,
          error: `Subagent "${subagentName}" not found. Available: ${Array.from(subagents.keys()).join(', ')}`
        });
      }
    }

    // Emit step start event with subagent info
    const taskId = currentParentTaskId || `task-${Date.now()}`;
    // Determine the model for this subagent
    const agentModel = subagent?.model || 'gemini-2.5-flash';
    const thinkingInfo = subagent?.thinkingLevel ? ` (thinking: ${subagent.thinkingLevel})` : '';

    emitTaskEvent({
      type: 'step-start',
      taskId: taskId,
      title: `${subagent?.name || 'general-purpose'}: ${taskDescription.substring(0, 50)}...`,
      message: `Delegating to ${subagent?.name || 'general-purpose'}`,
      status: 'in-progress',
      data: {
        subagent: subagentName,
        model: agentModel,
        thinkingLevel: subagent?.thinkingLevel || null
      }
    });

    try {
      const result = await executeSubagentWithTools(subagentName, taskDescription, taskId);

      // Create artifact for subagent work
      createArtifact({
        type: 'research',
        title: `${subagent?.name || 'Subagent'}: ${taskDescription.substring(0, 40)}...`,
        content: result,
        agentName: subagent?.name || 'Subagent',
        metadata: { task: taskDescription, subagent: subagentName, model: agentModel }
      });

      emitTaskEvent({
        type: 'step-complete',
        taskId: taskId,
        title: `${subagent?.name || 'general-purpose'} completed`,
        status: 'completed',
        data: { model: agentModel }
      });

      return JSON.stringify({
        success: true,
        subagent: subagentName,
        task: taskDescription,
        result: result
      });
    } catch (error) {
      emitTaskEvent({
        type: 'step-complete',
        taskId: taskId,
        title: `${subagent?.name || 'general-purpose'} failed`,
        status: 'error'
      });

      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Subagent execution failed'
      });
    }
  }
});

// ==========================================
// Core Agent Logic
// ==========================================

const getSystemPrompt = (): string => {
  const toolDescriptions = Array.from(tools.values())
    .map(t => `## \`${t.name}\`\n${t.description}`)
    .join('\n\n');

  return `You are an advanced Chemistry Study Assistant with deep agent capabilities, powered by the DeepAgents framework with Gemini.

You have access to tools for planning, file management, web search (via Tavily), subagent delegation, and chemistry-specific tasks.

${RESEARCH_WORKFLOW_INSTRUCTIONS}

================================================================================

${SUBAGENT_DELEGATION_INSTRUCTIONS}

================================================================================

## Available Tools

${toolDescriptions}

## How to Use Tools

When you need to use a tool, output a JSON object in a code block with the tool name and parameters:

\`\`\`tool
{
  "tool": "tool_name",
  "params": {
    "param1": "value1",
    "param2": "value2"
  }
}
\`\`\`

## Task Delegation with task() Tool

**CRITICAL**: For any research or complex task, use the \`task\` tool to delegate to specialized sub-agents:

\`\`\`tool
{
  "tool": "task",
  "params": {
    "name": "research-agent",
    "task": "Research the latest developments in green chemistry and sustainable synthesis methods"
  }
}
\`\`\`

**For comparisons, make MULTIPLE task() calls** to enable parallel execution:
\`\`\`tool
{
  "tool": "task",
  "params": {
    "name": "chemistry-researcher",
    "task": "Research organic synthesis methods and their environmental impact"
  }
}
\`\`\`

\`\`\`tool
{
  "tool": "task",
  "params": {
    "name": "chemistry-researcher", 
    "task": "Research inorganic synthesis methods and their environmental impact"
  }
}
\`\`\`

## Chemistry Focus

You specialize in chemistry education and research. Use appropriate subagents:
- **chemistry-researcher**: For in-depth research combining web search + molecule databases
- **chemistry-tutor**: For educational explanations and practice problems
- **chemistry-problem-solver**: For calculations and problem solving
- **research-agent**: For general web research on any topic
- **deep-researcher**: For comprehensive literature reviews (Gemini 2.5 Pro)
- **advanced-reasoner**: For complex logical problems (Gemini 3 Pro)
- **documentation-agent**: For creating final reports (use AFTER research is complete)
- **image-generator**: For creating educational diagrams, illustrations, and visual aids

## Educational Image Generation

When the user asks for visual explanations, diagrams, or illustrations:
1. Use the **image-generator** subagent or the \`generate_educational_image\` tool directly
2. Specify the target audience (Grade 5, High School, University) for age-appropriate styling
3. The tool will automatically:
   - Engineer an optimized prompt with proper art style
   - Include appropriate scientific elements and labels
   - Generate a high-quality educational image

Example:
\`\`\`tool
{
  "tool": "generate_educational_image",
  "params": {
    "topic": "Plant Cell Structure",
    "target_audience": "High School"
  }
}
\`\`\`

Or delegate to the image-generator subagent:
\`\`\`tool
{
  "tool": "task",
  "params": {
    "name": "image-generator",
    "task": "Create an educational diagram of the nitrogen cycle for middle school students"
  }
}
\`\`\`

## Response Guidelines

1. **For simple questions**: Answer directly without delegation
2. **For research tasks** (WORKFLOW):
   a. Create a plan with \`write_todos\`
   b. Delegate to research subagents using \`task\` tool
   c. Wait for subagent results
   d. Synthesize and create final document with \`finalize_document\`
3. Use proper markdown formatting
4. Include chemical formulas with proper notation
5. Use LaTeX for equations: $formula$ or $$equation$$

## CRITICAL OUTPUT RULES

**NEVER include these in your response or final document:**
- Task status messages like "📋 Task 1/4: ..."
- Progress updates like "Task 1 has been completed..."
- Waiting messages like "I am awaiting..." or "I am unable to execute..."
- Meta-commentary about delegation like "The delegation has been completed..."
- Internal planning notes meant for yourself

**ONLY output:**
- Direct answers to user questions
- Research findings and analysis
- Well-formatted final documents
- Tool calls when needed

When subagents return findings, IMMEDIATELY synthesize them into the final document. Do NOT narrate the process.

## Final Document Creation

**IMPORTANT**: For complex research tasks, you MUST finish by using the \`finalize_document\` tool to create a well-structured final document with:
- Clear title
- Executive summary/introduction
- Well-organized sections
- Key findings and conclusions
- Properly formatted sources/references

**CRITICAL**: Do NOT include internal task status messages (like "Task 1/4 completed", "I am awaiting...", etc.) in the final document. These are for internal tracking only and should never appear in user-facing output.

Remember: Your goal is to help students learn and understand chemistry through thorough research and clear explanations. Always delegate research to subagents to keep your context clean!`
};

/**
 * Parse tool calls from agent response
 */
const parseToolCalls = (response: string): Array<{ tool: string; params: Record<string, any> }> => {
  const toolCalls: Array<{ tool: string; params: Record<string, any> }> = [];

  // Match new tool block format
  const toolBlockRegex = /\`\`\`tool\s*([\s\S]*?)\`\`\`/g;
  let match;

  while ((match = toolBlockRegex.exec(response)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.tool && parsed.params) {
        toolCalls.push({ tool: parsed.tool, params: parsed.params });
      }
    } catch (e) {
      console.warn('Failed to parse tool block:', match[1]);
    }
  }

  // Also support legacy format
  const legacyRegex = /\[TOOL:\s*(\w+)\]\s*([\s\S]*?)\s*\[\/TOOL\]/g;
  while ((match = legacyRegex.exec(response)) !== null) {
    try {
      const params = JSON.parse(match[2].trim());
      toolCalls.push({ tool: match[1], params });
    } catch (e) {
      console.warn('Failed to parse legacy tool params:', match[2]);
    }
  }

  return toolCalls;
};

/**
 * Parse delegation requests from agent response
 */
const parseDelegations = (response: string): Array<{ subagent: string; task: string }> => {
  const delegations: Array<{ subagent: string; task: string }> = [];
  const delegateRegex = /\[DELEGATE:\s*(\S+)\]\s*([\s\S]*?)\s*\[\/DELEGATE\]/g;

  let match;
  while ((match = delegateRegex.exec(response)) !== null) {
    delegations.push({ subagent: match[1], task: match[2].trim() });
  }

  return delegations;
};

/**
 * Parse plan/todos from agent response
 */
const parsePlan = (response: string): TodoItem[] => {
  const todos: TodoItem[] = [];
  const planRegex = /\[PLAN\]([\s\S]*?)\[\/PLAN\]/;
  const match = planRegex.exec(response);

  if (match) {
    const planContent = match[1];
    const lines = planContent.split('\n').filter(l => l.trim());

    lines.forEach((line, index) => {
      const isCompleted = line.includes('✓') || line.includes('[x]') || line.includes('[X]');
      const cleanLine = line.replace(/^\d+\.\s*/, '').replace(/[✓\[\]xX]/g, '').trim();

      if (cleanLine) {
        todos.push({
          id: `todo-${index}`,
          title: cleanLine,
          status: isCompleted ? 'completed' : 'pending'
        });
      }
    });
  }

  return todos;
};

/**
 * Parse file operations from agent response
 */
const parseFileOps = (response: string): { saves: Array<{ name: string; content: string }>; reads: string[] } => {
  const saves: Array<{ name: string; content: string }> = [];
  const reads: string[] = [];

  // Parse saves
  const saveRegex = /\[SAVE:\s*(\S+)\]\s*([\s\S]*?)\s*\[\/SAVE\]/g;
  let match;
  while ((match = saveRegex.exec(response)) !== null) {
    saves.push({ name: match[1], content: match[2].trim() });
  }

  // Parse reads
  const readRegex = /\[READ:\s*(\S+)\]/g;
  while ((match = readRegex.exec(response)) !== null) {
    reads.push(match[1]);
  }

  return { saves, reads };
};

/**
 * Execute a subagent task (legacy simple version)
 */
const executeSubagent = async (
  subagentName: string,
  task: string
): Promise<string> => {
  const subagent = subagents.get(subagentName);
  if (!subagent || !genAI) {
    return `Error: Subagent "${subagentName}" not found or not initialized.`;
  }

  try {
    const subagentPrompt = `${subagent.systemPrompt}

Available tools: ${subagent.tools.join(', ')}

Task: ${task}

Provide a comprehensive response to this task.`;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: subagentPrompt
    });

    return response.text || 'Subagent completed the task but returned no response.';
  } catch (error) {
    return `Subagent error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Execute a subagent with full tool support (DeepAgents pattern)
 * Subagent runs in isolation with its own context and returns concise results
 */
const executeSubagentWithTools = async (
  subagentName: string,
  task: string,
  stepId?: string
): Promise<string> => {
  const subagent = subagents.get(subagentName);
  if (!subagent || !genAI) {
    return `Error: Subagent "${subagentName}" not found or not initialized.`;
  }

  // Build tool descriptions for available tools
  const availableTools = subagent.tools
    .map(toolName => tools.get(toolName))
    .filter(Boolean)
    .map(t => `## \`${t!.name}\`\n${t!.description}`)
    .join('\n\n');

  const subagentSystemPrompt = `${subagent.systemPrompt}

## Available Tools

${availableTools}

## How to Use Tools

When you need to use a tool, output a JSON object in a code block:

\`\`\`tool
{
  "tool": "tool_name",
  "params": {
    "param1": "value1"
  }
}
\`\`\`

## Your Task

${task}

IMPORTANT: 
- Complete this task thoroughly but efficiently
- Return only essential findings - not raw data or intermediate steps
- Keep your response under 500 words
- Cite sources with [1], [2] format if using web search`;

  try {
    const conversationMessages = [
      { role: 'user', parts: [{ text: subagentSystemPrompt }] }
    ];

    // Determine which model to use based on subagent config
    const modelName = subagent.model || 'gemini-2.5-flash';
    const isGemini3 = modelName.includes('gemini-3');

    console.log(`[Subagent ${subagentName}] Using model: ${modelName}${isGemini3 ? ` with thinking_level: ${subagent.thinkingLevel || 'high'}` : ''}`);

    // Build config based on model
    const generateConfig: any = {
      model: modelName,
      contents: conversationMessages
    };

    // Add thinking level for Gemini 3 Pro
    if (isGemini3 && subagent.thinkingLevel) {
      generateConfig.config = {
        thinkingConfig: {
          thinkingLevel: subagent.thinkingLevel
        }
      };
    }

    // Initial response
    const responseStream = await genAI.models.generateContentStream(generateConfig);

    let responseText = '';
    for await (const chunk of responseStream) {
      const text = chunk.text || '';
      responseText += text;

      if (stepId) {
        emitTaskEvent({
          type: 'step-stream',
          taskId: stepId,
          data: { content: text }
        });
      }
    }

    let toolIterations = 0;
    const maxToolIterations = 10; // Safety limit

    // Process tool calls in a loop
    while (toolIterations < maxToolIterations) {
      const toolCalls = parseToolCalls(responseText);

      if (toolCalls.length === 0) {
        break;
      }

      toolIterations++;
      const toolResults: string[] = [];

      for (const call of toolCalls) {
        if (!subagent.tools.includes(call.tool)) {
          toolResults.push(`Tool ${call.tool}: Not available to this subagent.`);
          continue;
        }

        const tool = tools.get(call.tool);
        if (tool) {
          emitTaskEvent({
            type: 'tool-call',
            taskId: `${subagentName}-tool-${Date.now()}`,
            title: call.tool,
            message: `${subagentName} using ${call.tool}`,
            status: 'in-progress',
            data: {
              tool: call.tool,
              toolName: call.tool,
              subagent: subagentName,
              model: modelName,
              params: call.params
            }
          });

          try {
            const result = await tool.execute(call.params);
            toolResults.push(`Tool ${call.tool} result:\n${result}`);

            emitTaskEvent({
              type: 'tool-result',
              taskId: `${subagentName}-tool-${Date.now()}`,
              title: call.tool,
              status: 'completed',
              data: {
                tool: call.tool,
                model: modelName,
                success: true
              }
            });
          } catch (toolError) {
            toolResults.push(`Tool ${call.tool} error: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`);
            emitTaskEvent({
              type: 'tool-result',
              taskId: `${subagentName}-tool-${Date.now()}`,
              title: call.tool,
              status: 'error',
              data: {
                tool: call.tool,
                model: modelName,
                error: toolError instanceof Error ? toolError.message : 'Unknown error'
              }
            });
          }
        }
      }

      if (toolResults.length > 0) {
        conversationMessages.push(
          { role: 'model', parts: [{ text: responseText }] },
          { role: 'user', parts: [{ text: `Tool results:\n\n${toolResults.join('\n\n')}\n\nContinue your work based on these results. Remember to use think_tool to reflect on findings. When done, provide your final response.` }] }
        );

        const continueConfig: any = {
          model: modelName,
          contents: conversationMessages
        };

        if (isGemini3 && subagent.thinkingLevel) {
          continueConfig.config = {
            thinkingConfig: {
              thinkingLevel: subagent.thinkingLevel
            }
          };
        }

        const continueResponseStream = await genAI.models.generateContentStream(continueConfig);

        responseText = '';
        for await (const chunk of continueResponseStream) {
          const text = chunk.text || '';
          responseText += text;

          if (stepId) {
            emitTaskEvent({
              type: 'step-stream',
              taskId: stepId,
              data: { content: text }
            });
          }
        }
      }
    }

    // Clean up the response
    const cleanResponse = responseText
      .replace(/\`\`\`tool[\s\S]*?\`\`\`/g, '')
      .replace(/\[TOOL:.*?\][\s\S]*?\[\/TOOL\]/g, '')
      .trim();

    return cleanResponse || 'Subagent completed the task but returned no summary.';

  } catch (error) {
    console.error(`Subagent ${subagentName} error:`, error);
    return `Subagent error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Process a single turn of the agent
 */
const processAgentTurn = async (
  userMessage: string,
  history: Array<{ role: string; content: string }>
): Promise<{
  response: string;
  todos: TodoItem[];
  toolsUsed: string[];
  subagentsUsed: string[];
  filesCreated: string[];
}> => {
  if (!genAI) {
    throw new Error('Deep Agent not initialized');
  }

  const toolsUsed: string[] = [];
  const subagentsUsed: string[] = [];
  const filesCreated: string[] = [];

  // Build the conversation
  const messages = [
    { role: 'user', parts: [{ text: getSystemPrompt() }] },
    ...history.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    })),
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  // Get initial response
  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: messages
  });

  let responseText = response.text || '';

  // Process tool calls
  const toolCalls = parseToolCalls(responseText);
  if (toolCalls.length > 0) {
    const toolResults: string[] = [];

    for (const call of toolCalls) {
      const tool = tools.get(call.tool);
      if (tool) {
        toolsUsed.push(call.tool);
        const result = await tool.execute(call.params);
        toolResults.push(`Tool ${call.tool} result:\n${result}`);
      }
    }

    if (toolResults.length > 0) {
      // Get updated response with tool results
      const updatedMessages = [
        ...messages,
        { role: 'model', parts: [{ text: responseText }] },
        { role: 'user', parts: [{ text: `Tool results:\n${toolResults.join('\n\n')}\n\nPlease incorporate these results into your response.` }] }
      ];

      const updatedResponse = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: updatedMessages
      });

      responseText = updatedResponse.text || responseText;
    }
  }

  // Process delegations
  const delegations = parseDelegations(responseText);
  for (const delegation of delegations) {
    subagentsUsed.push(delegation.subagent);
    const subagentResult = await executeSubagent(delegation.subagent, delegation.task);
    responseText = responseText.replace(
      `[DELEGATE: ${delegation.subagent}]${delegation.task}[/DELEGATE]`,
      `**${delegation.subagent} response:**\n${subagentResult}`
    );
  }

  // Process file operations
  const fileOps = parseFileOps(responseText);
  for (const save of fileOps.saves) {
    fileSystem.writeFile(save.name, save.content);
    filesCreated.push(save.name);
  }
  for (const read of fileOps.reads) {
    const content = fileSystem.readFile(read);
    if (content) {
      responseText = responseText.replace(
        `[READ: ${read}]`,
        `**Contents of ${read}:**\n${content}`
      );
    }
  }

  // Parse todos
  const todos = parsePlan(responseText);

  // Clean up response (remove markers)
  responseText = responseText
    .replace(/\[TOOL:.*?\][\s\S]*?\[\/TOOL\]/g, '')
    .replace(/\[PLAN\][\s\S]*?\[\/PLAN\]/g, '')
    .replace(/\[SAVE:.*?\][\s\S]*?\[\/SAVE\]/g, '')
    .replace(/\[LIST\]/g, `Files: ${fileSystem.ls('/').join(', ') || 'none'}`)
    .trim();

  return {
    response: responseText,
    todos,
    toolsUsed,
    subagentsUsed,
    filesCreated
  };
};

// ==========================================
// Public API
// ==========================================

/**
 * Set the Tavily API key for web search
 */
export const setTavilyApiKey = (apiKey: string): void => {
  tavilyApiKey = apiKey;
  console.log('✅ Tavily API key configured for web search');
};

/**
 * Get if Tavily is configured
 */
export const isTavilyConfigured = (): boolean => {
  return tavilyApiKey !== null && tavilyApiKey.length > 0;
};

/**
 * Initialize the deep agent with Gemini
 */
export const initializeDeepAgent = async (config?: DeepAgentConfig): Promise<void> => {
  try {
    // Ensure Gemini service is initialized
    if (!isGeminiInitialized()) {
      await initializeGeminiWithFirebaseKey();
    }

    // Initialize our own Gemini instance
    const apiKey = await getSharedGeminiApiKey();
    if (!apiKey) {
      throw new Error('No Gemini API key available. Please configure your API key.');
    }

    genAI = new GoogleGenAI({ apiKey });

    // Set Tavily API key if provided in config
    if (config?.tavilyApiKey) {
      tavilyApiKey = config.tavilyApiKey;
      console.log('✅ Tavily API key set from config');
    }

    isInitialized = true;
    conversationHistory = [];
    currentTodos = [];
    fileSystem.clear();

    console.log('✅ Deep Agent initialized with Gemini + Tavily search capabilities');
  } catch (error) {
    console.error('❌ Failed to initialize Deep Agent:', error);
    throw error;
  }
};

/**
 * Check if the deep agent is initialized
 */
export const isDeepAgentInitialized = (): boolean => {
  return isInitialized && genAI !== null;
};

/**
 * Invoke the deep agent with a message
 */
export const invokeDeepAgent = async (
  message: string,
  existingHistory?: DeepAgentMessage[]
): Promise<DeepAgentResult> => {
  if (!isInitialized || !genAI) {
    await initializeDeepAgent();
  }

  if (!genAI) {
    throw new Error('Failed to initialize deep agent');
  }

  try {
    // Convert existing history if provided
    if (existingHistory) {
      conversationHistory = existingHistory.map(m => ({
        role: m.role,
        content: m.content
      }));
    }

    // Process the message
    const result = await processAgentTurn(message, conversationHistory);

    // Update conversation history
    conversationHistory.push({ role: 'user', content: message });
    conversationHistory.push({ role: 'assistant', content: result.response });

    // Update todos
    if (result.todos.length > 0) {
      currentTodos = result.todos;
    }

    // Create the response message
    const agentMessage: DeepAgentMessage = {
      role: 'assistant',
      content: result.response,
      timestamp: new Date(),
      todos: result.todos.length > 0 ? result.todos : undefined,
      toolsUsed: result.toolsUsed.length > 0 ? result.toolsUsed : undefined,
      subagentUsed: result.subagentsUsed.length > 0 ? result.subagentsUsed[0] : undefined,
      filesCreated: result.filesCreated.length > 0 ? result.filesCreated : undefined
    };

    const messages: DeepAgentMessage[] = [
      ...(existingHistory || []),
      { role: 'user', content: message, timestamp: new Date() },
      agentMessage
    ];

    return {
      messages,
      todos: currentTodos,
      filesCreated: result.filesCreated,
      subagentsSpawned: result.subagentsUsed
    };
  } catch (error) {
    console.error('Error invoking deep agent:', error);

    const errorMessage: DeepAgentMessage = {
      role: 'assistant',
      content: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      timestamp: new Date()
    };

    return {
      messages: [
        ...(existingHistory || []),
        { role: 'user', content: message, timestamp: new Date() },
        errorMessage
      ],
      todos: currentTodos,
      filesCreated: [],
      subagentsSpawned: []
    };
  }
};

// Flag to enable automatic prompt enhancement
let enableAutoPromptEnhancement = true;

/**
 * Enable or disable automatic prompt enhancement
 */
export const setAutoPromptEnhancement = (enabled: boolean): void => {
  enableAutoPromptEnhancement = enabled;
};

/**
 * Check if a message is a research/complex request that should be enhanced
 */
const shouldEnhancePrompt = (message: string): boolean => {
  const lowerMessage = message.toLowerCase();

  // Research indicators
  const researchKeywords = [
    'research', 'analyze', 'explain', 'compare', 'investigate',
    'find out', 'tell me about', 'what is', 'how does', 'why does',
    'fundamentals', 'overview', 'deep dive', 'comprehensive',
    'study', 'explore', 'understand', 'learn about'
  ];

  // Skip for simple questions
  const simplePatterns = [
    /^hi\b/i, /^hello\b/i, /^hey\b/i, /^thanks/i, /^thank you/i,
    /^ok\b/i, /^yes\b/i, /^no\b/i, /^sure\b/i
  ];

  if (simplePatterns.some(p => p.test(message.trim()))) {
    return false;
  }

  // Check for research keywords
  const hasResearchIntent = researchKeywords.some(k => lowerMessage.includes(k));

  // Also enhance if message is complex (long or has multiple parts)
  const isComplex = message.length > 100 || message.includes(',') || message.includes('and');

  return hasResearchIntent || isComplex;
};

/**
 * Enhance a prompt using Gemini (fast, non-streaming)
 */
const enhancePrompt = async (originalPrompt: string): Promise<{ enhanced: string; questions: string[] }> => {
  if (!genAI) {
    return { enhanced: originalPrompt, questions: [] };
  }

  const enhancementPrompt = `You are a prompt enhancement specialist. Analyze this user request and create an improved, clearer version.

USER REQUEST: "${originalPrompt}"

TASK: Create an enhanced version that is:
1. More specific and actionable
2. Clearly scoped
3. Broken into clear research questions

RESPOND IN THIS EXACT JSON FORMAT ONLY (no other text):
{
  "enhancedPrompt": "The improved, specific version of the request",
  "researchQuestions": ["Question 1", "Question 2", "Question 3"],
  "scope": "Brief scope definition"
}`;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: enhancementPrompt }] }]
    });

    const text = response.text || '';

    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        enhanced: parsed.enhancedPrompt || originalPrompt,
        questions: parsed.researchQuestions || []
      };
    }
  } catch (error) {
    console.warn('Prompt enhancement failed, using original:', error);
  }

  return { enhanced: originalPrompt, questions: [] };
};

/**
 * Stream a response from the deep agent
 */
export async function* streamDeepAgent(
  message: string,
  existingHistory?: DeepAgentMessage[]
): AsyncGenerator<string, void, unknown> {
  if (!isInitialized || !genAI) {
    await initializeDeepAgent();
  }

  if (!genAI) {
    throw new Error('Failed to initialize deep agent');
  }

  try {
    // Convert existing history if provided
    if (existingHistory) {
      conversationHistory = existingHistory.map(m => ({
        role: m.role,
        content: m.content
      }));
    }

    const taskId = `task-${Date.now()}`;
    currentParentTaskId = taskId;

    // Emit task start event
    emitTaskEvent({
      type: 'task-start',
      taskId,
      title: 'Processing request',
      status: 'in-progress'
    });

    // =========================================
    // AUTOMATIC PROMPT ENHANCEMENT
    // =========================================
    let workingMessage = message;

    if (enableAutoPromptEnhancement && shouldEnhancePrompt(message)) {
      emitTaskEvent({
        type: 'step-start',
        taskId,
        title: '✨ Enhancing prompt',
        message: 'Analyzing and improving your request...',
        status: 'in-progress',
        data: { tool: 'prompt-enhancer', model: 'gemini-2.5-flash' }
      });

      yield '✨ **Enhancing your request...**\n\n';

      const { enhanced, questions } = await enhancePrompt(message);

      if (enhanced !== message) {
        workingMessage = enhanced;

        yield `📝 **Enhanced Request:**\n> ${enhanced}\n\n`;

        if (questions.length > 0) {
          yield `**Research Questions:**\n`;
          for (const q of questions) {
            yield `- ${q}\n`;
          }
          yield '\n';
        }

        yield '---\n\n';
      }

      emitTaskEvent({
        type: 'step-complete',
        taskId,
        title: '✨ Prompt enhanced',
        status: 'completed',
        data: { enhanced: true }
      });
    }

    // Build the conversation with the (potentially enhanced) message
    const messages = [
      { role: 'user', parts: [{ text: getSystemPrompt() }] },
      ...conversationHistory.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      })),
      { role: 'user', parts: [{ text: workingMessage }] }
    ];

    // Stream the response
    const response = await genAI.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: messages
    });

    let fullResponse = '';

    emitTaskEvent({
      type: 'thinking',
      taskId,
      message: 'Analyzing your request...',
      status: 'in-progress'
    });

    for await (const chunk of response) {
      const text = chunk.text || '';
      fullResponse += text;
      yield text;
    }

    // Mark thinking step as complete
    emitTaskEvent({
      type: 'step-complete',
      taskId,
      title: 'Analysis complete',
      status: 'completed'
    });

    // Update conversation history
    conversationHistory.push({ role: 'user', content: message });
    conversationHistory.push({ role: 'assistant', content: fullResponse });

    // Parse and execute any tool calls after streaming
    const toolCalls = parseToolCalls(fullResponse);
    if (toolCalls.length > 0) {
      yield '\n\n---\n';

      const totalTools = toolCalls.length;
      let completedTools = 0;

      for (const call of toolCalls) {
        const tool = tools.get(call.tool);
        if (tool) {
          // Emit tool call event with proper data for UI
          emitTaskEvent({
            type: 'tool-call',
            taskId,
            title: call.tool,
            message: `Executing ${call.tool}...`,
            status: 'in-progress',
            progress: { current: completedTools, total: totalTools },
            data: {
              tool: call.tool,
              toolName: call.tool,
              model: 'gemini-2.5-flash',
              params: call.params
            }
          });

          yield `\n🔧 **${call.tool}**: `;
          const result = await tool.execute(call.params);
          completedTools++;

          try {
            const parsed = JSON.parse(result);

            // Emit tool result event
            emitTaskEvent({
              type: 'tool-result',
              taskId,
              title: call.tool,
              status: parsed.success ? 'completed' : 'error',
              progress: { current: completedTools, total: totalTools },
              data: parsed
            });

            if (parsed.success) {
              // Handle different tool result types
              if (call.tool === 'internet_search' && parsed.results) {
                emitTaskEvent({
                  type: 'searching',
                  taskId,
                  message: `Found ${parsed.results.length} web results`,
                  status: 'completed'
                });
                yield `Found ${parsed.results.length} results\n\n`;
                if (parsed.answer) {
                  yield `**Quick Answer:** ${parsed.answer}\n\n`;
                }
                for (const r of parsed.results.slice(0, 5)) {
                  yield `- **[${r.title}](${r.url})**\n  ${r.content?.substring(0, 150)}...\n`;
                }
              } else if (call.tool === 'write_todos' && parsed.todos) {
                // Update current todos and emit event
                emitTaskEvent({
                  type: 'task-update',
                  taskId,
                  title: 'Plan created',
                  message: `Created ${parsed.todos.length} tasks`,
                  status: 'completed',
                  data: { todos: parsed.todos }
                });
                yield `Created ${parsed.todos.length} tasks\n\n`;
                for (const todo of parsed.todos) {
                  const statusIcon = todo.status === 'completed' ? '✅' : todo.status === 'in-progress' ? '🔄' : '⬜';
                  yield `${statusIcon} ${todo.title}\n`;
                }
                yield '\n';
              } else if (call.tool === 'write_file') {
                emitTaskEvent({
                  type: 'writing',
                  taskId,
                  message: `Saved: ${parsed.path}`,
                  status: 'completed'
                });
                yield `File saved: ${parsed.path}\n\n`;
              } else if (call.tool === 'read_file') {
                yield `Content from ${parsed.path}:\n\`\`\`\n${parsed.content?.substring(0, 500)}${parsed.content?.length > 500 ? '...' : ''}\n\`\`\`\n\n`;
              } else if (call.tool === 'finalize_document') {
                yield `\n\n✅ **Final Document Created:** ${parsed.message || 'Document ready'}\n\n`;
                yield `📄 Your document has been finalized and is available in the document panel below.\n\n`;
              } else if (call.tool === 'task' && parsed.result) {
                // Handle task (subagent) results
                yield `\n**${parsed.subagent || 'Subagent'} findings:**\n\n${parsed.result}\n\n`;
              } else if (call.tool === 'think_tool') {
                yield `*Reflected on research progress*\n\n`;
              } else {
                yield `${parsed.analysis || parsed.explanation || parsed.description || parsed.result || parsed.message || 'Completed'}\n\n`;
              }
            } else {
              yield `Error: ${parsed.error}\n\n`;
            }
          } catch {
            yield `Done\n\n`;
          }
        }
      }

      // =========================================
      // AUTO-SYNTHESIS: Use Document Synthesizer (Gemini 3 Pro) to create final document
      // =========================================
      const hasSubagentResults = toolCalls.some(tc => tc.tool === 'task');
      const hasFinalDocument = toolCalls.some(tc => tc.tool === 'finalize_document');

      if (hasSubagentResults && !hasFinalDocument) {
        // Get the document-synthesizer agent configuration
        const synthesizerAgent = subagents.get('document-synthesizer');

        yield '\n\n---\n📄 **Document Synthesizer (Gemini 3 Pro)** - Creating comprehensive final document...\n\n';

        emitTaskEvent({
          type: 'tool-call',
          taskId,
          title: 'document-synthesizer',
          message: 'Collecting and synthesizing all research findings...',
          status: 'in-progress',
          data: {
            tool: 'document-synthesizer',
            model: 'gemini-3-pro-preview',
            params: { action: 'synthesize' }
          }
        });

        // Build the synthesis prompt with all research findings
        const synthesisPrompt = `## DOCUMENT SYNTHESIS REQUEST

You are the Document Synthesizer. Your task is to create ONE COMPREHENSIVE FINAL DOCUMENT.

### RESEARCH FINDINGS TO SYNTHESIZE:
${fullResponse.replace(/✨ \*\*Enhancing.*?\*\*[\s\S]*?📝 \*\*Enhanced Request:\*\*[\s\S]*?(?=\n\n)/g, '')}

### ORIGINAL USER REQUEST:
${workingMessage}

### YOUR TASK:
1. COLLECT all findings, insights, and sources from the research above
2. REMOVE any duplicate information
3. ORGANIZE into a logical, flowing structure
4. CREATE one consolidated References section with numbered citations
5. CALL the finalize_document tool with the complete document

### REQUIRED DOCUMENT STRUCTURE:
# [Clear Descriptive Title]

## Executive Summary
2-3 paragraphs summarizing key findings

## Introduction
Background and context

## [Main Topic Sections with ### Subtopics]
Content with inline citations [1], [2]

## Key Findings
• Bullet points of most important discoveries

## Challenges and Opportunities
Discussion of limitations and future potential

## Conclusion
Final synthesis and recommendations

## References
[1] Source name. "Title." Year. URL
[2] ...

### CRITICAL RULES:
- NO "Enhanced Request" or "Prompt Enhancement" sections
- NO task status messages ("📋 Task 1/4...")
- NO planning artifacts, checkboxes, or TODO lists
- NO meta-commentary ("I have gathered...", "I am synthesizing...")
- NO emojis or "helper words"
- ONLY output the final document using finalize_document tool

CREATE THE DOCUMENT NOW.`;

        const synthesizerSystemPrompt = synthesizerAgent?.systemPrompt || '';

        try {
          // Use Gemini 3 Pro with HIGH thinking for synthesis
          const synthesisResponse = await genAI.models.generateContentStream({
            model: 'gemini-3-pro-preview',
            contents: [
              { role: 'user', parts: [{ text: synthesisPrompt }] }
            ],
            config: {
              systemInstruction: synthesizerSystemPrompt,
              thinkingConfig: { thinkingBudget: 8192 }
            }
          });

          let synthesisText = '';
          for await (const chunk of synthesisResponse) {
            const text = chunk.text || '';
            synthesisText += text;
            // Don't yield raw thinking - wait for the finalize_document call
          }

          // Process any tool calls (should include finalize_document)
          const synthToolCalls = parseToolCalls(synthesisText);
          let documentCreated = false;

          for (const call of synthToolCalls) {
            if (call.tool === 'finalize_document') {
              const tool = tools.get('finalize_document');
              if (tool) {
                const result = await tool.execute(call.params);

                try {
                  const parsed = JSON.parse(result);
                  if (parsed.success) {
                    documentCreated = true;

                    emitTaskEvent({
                      type: 'document-ready',
                      taskId,
                      title: call.params.title || 'Research Report',
                      status: 'completed',
                      data: parsed
                    });

                    yield `\n✅ **Final Document Created:** "${call.params.title || 'Research Report'}"\n\n`;
                    yield `📄 Your comprehensive research report is now available in the document panel.\n\n`;
                  } else {
                    yield `⚠️ Error creating document: ${parsed.error}\n`;
                  }
                } catch (parseErr) {
                  yield `⚠️ Error processing document\n`;
                }
              }
            }
          }

          // FALLBACK: If synthesizer didn't create document, use output-validator to build it
          if (!documentCreated) {
            yield `\n🛡️ **Output Validator** - Building document from findings...\n\n`;

            // Extract content and build document directly
            const docContent = buildDocumentFromResponse(fullResponse, workingMessage);

            if (docContent) {
              const tool = tools.get('finalize_document');
              if (tool) {
                const docTitle = extractTitleFromPrompt(workingMessage);
                const result = await tool.execute({
                  title: docTitle,
                  content: docContent
                });

                try {
                  const parsed = JSON.parse(result);
                  if (parsed.success) {
                    documentCreated = true;

                    emitTaskEvent({
                      type: 'document-ready',
                      taskId,
                      title: docTitle,
                      status: 'completed',
                      data: parsed
                    });

                    yield `\n✅ **Document Created:** "${docTitle}"\n\n`;
                    yield `📄 Your research report is ready in the document panel.\n\n`;
                  }
                } catch { }
              }
            }
          }

          // FINAL FALLBACK: Direct extraction if all else fails
          if (!documentCreated) {
            yield `\n📝 Generating summary document...\n\n`;

            // Create a basic document from the available content
            const fallbackTitle = extractTitleFromPrompt(workingMessage);
            const fallbackContent = `# ${fallbackTitle}\n\n## Executive Summary\n\nThis report synthesizes research on the topic requested by the user.\n\n## Research Findings\n\n${cleanDocumentContent(fullResponse)}\n\n## Conclusion\n\nThe research above provides comprehensive information on the requested topic.\n`;

            const tool = tools.get('finalize_document');
            if (tool) {
              const result = await tool.execute({
                title: fallbackTitle,
                content: fallbackContent
              });

              try {
                const parsed = JSON.parse(result);
                if (parsed.success) {
                  emitTaskEvent({
                    type: 'document-ready',
                    taskId,
                    title: fallbackTitle,
                    status: 'completed',
                    data: parsed
                  });

                  yield `\n✅ **Document Ready**\n\n`;
                }
              } catch { }
            }
          }

        } catch (synthError) {
          console.error('Document synthesis error:', synthError);

          // Emergency fallback - always create a document
          yield `\n⚠️ Using fallback document generation...\n\n`;

          const fallbackTitle = extractTitleFromPrompt(workingMessage);
          const fallbackContent = buildDocumentFromResponse(fullResponse, workingMessage) ||
            `# ${fallbackTitle}\n\n${cleanDocumentContent(fullResponse)}`;

          const tool = tools.get('finalize_document');
          if (tool) {
            try {
              const result = await tool.execute({
                title: fallbackTitle,
                content: fallbackContent
              });

              const parsed = JSON.parse(result);
              if (parsed.success) {
                emitTaskEvent({
                  type: 'document-ready',
                  taskId,
                  title: fallbackTitle,
                  status: 'completed',
                  data: parsed
                });

                yield `\n✅ **Document Created**\n\n`;
              }
            } catch { }
          }
        }
      }
    }

    // If there are no pending todos, mark task as complete now
    if (currentTodos.length === 0 || currentTodos.every(t => t.status === 'completed')) {
      emitTaskEvent({
        type: 'task-complete',
        taskId,
        title: 'Request completed',
        status: 'completed'
      });
      return;
    }

    // Process tool calls from continuation responses
    const processToolCalls = async function* (response: string): AsyncGenerator<string, void, unknown> {
      const continuationToolCalls = parseToolCalls(response);
      if (continuationToolCalls.length > 0) {
        yield '\n\n---\n';

        for (const call of continuationToolCalls) {
          const tool = tools.get(call.tool);
          if (tool) {
            emitTaskEvent({
              type: 'tool-call',
              taskId,
              title: call.tool,
              message: `Executing ${call.tool}...`,
              status: 'in-progress',
              data: {
                tool: call.tool,
                toolName: call.tool,
                model: 'gemini-2.5-flash',
                params: call.params
              }
            });

            yield `\n🔧 **${call.tool}**: `;
            const result = await tool.execute(call.params);

            try {
              const parsed = JSON.parse(result);

              emitTaskEvent({
                type: 'tool-result',
                taskId,
                title: call.tool,
                status: parsed.success ? 'completed' : 'error',
                data: parsed
              });

              if (parsed.success) {
                if (call.tool === 'internet_search' && parsed.results) {
                  yield `Found ${parsed.results.length} results\n\n`;
                  if (parsed.answer) {
                    yield `**Quick Answer:** ${parsed.answer}\n\n`;
                  }
                  for (const r of parsed.results.slice(0, 3)) {
                    yield `- **[${r.title}](${r.url})**\n  ${r.content?.substring(0, 100)}...\n\n`;
                  }
                } else if (call.tool === 'write_file') {
                  yield `File saved: ${parsed.path}\n\n`;
                } else if (call.tool === 'finalize_document') {
                  yield `\n✅ **Final Document Created**\n\n`;
                } else if (call.tool === 'task' && parsed.result) {
                  // Handle task (subagent) results
                  yield `\n**${parsed.subagent || 'Subagent'} findings:**\n\n${parsed.result}\n\n`;
                } else if (call.tool === 'think_tool') {
                  yield `*Reflected on progress*\n\n`;
                } else {
                  yield `${parsed.message || 'Completed'}\n\n`;
                }
              } else {
                yield `Error: ${parsed.error}\n\n`;
              }
            } catch {
              yield `Done\n\n`;
            }
          }
        }
      }
    };

    // Auto-continue through ALL pending todos
    let remainingTodos = currentTodos.filter(t => t.status === 'pending');
    let iterationCount = 0;
    const maxIterations = 10; // Safety limit

    while (remainingTodos.length > 0 && iterationCount < maxIterations) {
      iterationCount++;
      const nextTodo = remainingTodos[0];

      // Internal progress tracking - emit event but don't yield verbose status to user
      emitTaskEvent({
        type: 'step-start',
        taskId: nextTodo.id,
        title: nextTodo.title,
        message: `Working on: ${nextTodo.title}`,
        status: 'in-progress',
        progress: { current: iterationCount, total: currentTodos.length }
      });

      // Mark as in-progress
      currentTodos = currentTodos.map(t =>
        t.id === nextTodo.id ? { ...t, status: 'in-progress' as const } : t
      );

      // Build continuation prompt
      const continuePrompt = `Complete this task: "${nextTodo.title}"
      
${nextTodo.description || ''}

Use the appropriate tools:
- \`task\` to delegate research to subagents
- \`internet_search\` for web research
- \`finalize_document\` to create the final document

CRITICAL: Do NOT output task status messages like "Task 1 completed" or "I am awaiting...". 
Just execute the task and output the results directly.`;

      const continueMessages = [
        ...messages,
        { role: 'model', parts: [{ text: fullResponse }] },
        { role: 'user', parts: [{ text: continuePrompt }] }
      ];

      try {
        const continueResponse = await genAI.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: continueMessages
        });

        let taskResponse = '';
        for await (const chunk of continueResponse) {
          const text = chunk.text || '';
          taskResponse += text;
          fullResponse += text;
          yield text;
        }

        // Process any tool calls in the response
        for await (const toolOutput of processToolCalls(taskResponse)) {
          yield toolOutput;
        }

      } catch (taskError) {
        console.error(`Error on task ${nextTodo.title}:`, taskError);
        yield `\n⚠️ Error executing task: ${taskError instanceof Error ? taskError.message : 'Unknown error'}\n`;
      }

      // Mark as completed
      currentTodos = currentTodos.map(t =>
        t.id === nextTodo.id ? { ...t, status: 'completed' as const } : t
      );

      emitTaskEvent({
        type: 'step-complete',
        taskId: nextTodo.id,
        title: nextTodo.title,
        status: 'completed'
      });

      emitTaskEvent({
        type: 'task-update',
        taskId,
        title: 'Progress update',
        data: { todos: currentTodos }
      });

      // Update remaining todos
      remainingTodos = currentTodos.filter(t => t.status === 'pending');

      // Add to conversation history
      messages.push({ role: 'model', parts: [{ text: fullResponse }] });
    }

    // =========================================
    // FINAL SYNTHESIS: Ensure document is created after all tasks
    // =========================================
    // Check if a final document was created during the process
    const documentsCreated = finalDocuments.length;
    const hasNewDocument = finalDocuments.some(d =>
      d.createdAt.getTime() > Date.now() - 60000 // Created in last minute
    );

    if (!hasNewDocument && currentTodos.length > 0) {
      // All tasks done but no final document - prompt for synthesis
      yield '\n\n---\n📝 **Creating final research document...**\n\n';

      emitTaskEvent({
        type: 'writing',
        taskId,
        title: 'Finalizing document',
        message: 'Creating comprehensive report...',
        status: 'in-progress'
      });

      const finalSynthesisPrompt = `All research tasks are complete. Now create the final comprehensive document.

Use finalize_document tool with:
- Clear, descriptive title based on the research topic
- Well-structured markdown content including:
  - Executive Summary
  - Main findings organized by topic
  - Key insights and conclusions
  - Sources/References section

Create the document NOW. Do not output any task status or meta-commentary.`;

      try {
        const finalResponse = await genAI.models.generateContentStream({
          model: 'gemini-2.5-flash',
          contents: [
            ...messages,
            { role: 'user', parts: [{ text: finalSynthesisPrompt }] }
          ]
        });

        let finalText = '';
        for await (const chunk of finalResponse) {
          const text = chunk.text || '';
          finalText += text;
          yield text;
        }

        // Process finalize_document call
        const finalToolCalls = parseToolCalls(finalText);
        for (const call of finalToolCalls) {
          if (call.tool === 'finalize_document') {
            const tool = tools.get('finalize_document');
            if (tool) {
              const result = await tool.execute(call.params);
              try {
                const parsed = JSON.parse(result);
                if (parsed.success) {
                  yield `\n\n✅ **Final Document Created:** ${parsed.message}\n\n`;
                  yield `📄 Your comprehensive research report is ready in the document panel.\n\n`;

                  emitTaskEvent({
                    type: 'document-ready',
                    taskId,
                    title: parsed.title || 'Research Report',
                    status: 'completed',
                    data: parsed
                  });
                }
              } catch { }
            }
          }
        }
      } catch (finalError) {
        console.error('Final synthesis error:', finalError);
      }
    }

    // Update final conversation history
    conversationHistory.push({ role: 'user', content: message });
    conversationHistory.push({ role: 'assistant', content: fullResponse });

    // Emit task complete event
    emitTaskEvent({
      type: 'task-complete',
      taskId,
      title: 'Research completed',
      status: 'completed',
      progress: { current: currentTodos.length, total: currentTodos.length }
    });

    // Don't output "All X tasks completed" - the final document speaks for itself

  } catch (error) {
    console.error('Error streaming from deep agent:', error);
    emitTaskEvent({
      type: 'task-error',
      taskId: `error-${Date.now()}`,
      message: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    });
    yield `\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Get the available subagents
 */
export const getAvailableSubagents = (): Array<{ name: string; description: string }> => {
  return Array.from(subagents.values()).map(s => ({
    name: s.name,
    description: s.description
  }));
};

/**
 * Get the available tools
 */
export const getAvailableTools = (): Array<{ name: string; description: string }> => {
  return Array.from(tools.values()).map(t => ({
    name: t.name,
    description: t.description
  }));
};

/**
 * Get current todos
 */
export const getCurrentTodos = (): TodoItem[] => {
  return [...currentTodos];
};

/**
 * Get files in the memory file system
 */
export const getMemoryFiles = (): string[] => {
  return fileSystem.ls('/');
};

/**
 * Read a file from the memory file system
 */
export const readMemoryFile = (path: string): string | null => {
  return fileSystem.readFile(path);
};

/**
 * Get all finalized documents
 */
export const getFinalDocuments = (): FinalDocument[] => {
  return [...finalDocuments];
};

/**
 * Get the latest finalized document
 */
export const getLatestDocument = (): FinalDocument | null => {
  return finalDocuments.length > 0 ? finalDocuments[finalDocuments.length - 1] : null;
};

/**
 * Get all artifacts
 */
export const getArtifacts = (): Artifact[] => {
  return [...artifacts];
};

/**
 * Get artifacts by type
 */
export const getArtifactsByType = (type: Artifact['type']): Artifact[] => {
  return artifacts.filter(a => a.type === type);
};

/**
 * Get artifact by id
 */
export const getArtifactById = (id: string): Artifact | undefined => {
  return artifacts.find(a => a.id === id);
};

/**
 * Delete an artifact
 */
export const deleteArtifact = (id: string): boolean => {
  const index = artifacts.findIndex(a => a.id === id);
  if (index !== -1) {
    artifacts.splice(index, 1);
    return true;
  }
  return false;
};

/**
 * Reset the deep agent (useful for changing configuration)
 */
export const resetDeepAgent = (): void => {
  genAI = null;
  isInitialized = false;
  conversationHistory = [];
  currentTodos = [];
  finalDocuments = [];
  artifacts = [];
  fileSystem.clear();
  console.log('🔄 Deep Agent reset');
};

// ==========================================
// Direct Educational Image Generation Export
// ==========================================

/**
 * Generate an educational image directly without going through the full agent.
 * Uses a two-step process:
 * 1. Gemini 2.5 Flash engineers an optimized prompt with proper art style and scientific accuracy
 * 2. Nano Banana Pro (Gemini 3 Pro Image Preview) generates the high-quality image
 * 
 * @param topic - The educational subject to illustrate
 * @param targetAudience - Academic level (e.g., "Grade 5", "High School", "University")
 * @param aspectRatio - Image proportions (default: "16:9")
 * @returns Promise with image data URL and metadata
 */
export const generateEducationalImageDirect = async (
  topic: string,
  targetAudience?: string,
  aspectRatio?: string
): Promise<{
  success: boolean;
  imageUrl?: string;
  labels?: { label_text: string; arrow_target: string }[];
  labelPositions?: Array<{
    label: string;
    arrow_tip: { x: number; y: number };
    label_position: { x: number; y: number };
    arrow_direction: string;
  }>;
  requiresLabelOverlay?: boolean;
  scientificElements?: string[];
  visualStyle?: string;
  promptUsed?: string;
  error?: string;
}> => {
  // Ensure the deep agent is initialized
  if (!isDeepAgentInitialized()) {
    await initializeDeepAgent();
  }

  const tool = tools.get('generate_educational_image');
  if (!tool) {
    return {
      success: false,
      error: 'Educational image generation tool not available'
    };
  }

  const result = await tool.execute({
    topic,
    target_audience: targetAudience,
    aspect_ratio: aspectRatio
  });

  try {
    const parsed = JSON.parse(result);
    if (parsed.success) {
      return {
        success: true,
        imageUrl: parsed.imageUrl,
        labels: parsed.labels,
        labelPositions: parsed.label_positions,
        requiresLabelOverlay: parsed.requires_label_overlay,
        scientificElements: parsed.scientific_elements,
        visualStyle: parsed.visual_style,
        promptUsed: parsed.prompt_used
      };
    } else {
      return {
        success: false,
        error: parsed.error || parsed.details || 'Unknown error'
      };
    }
  } catch (e) {
    return {
      success: false,
      error: 'Failed to parse image generation result'
    };
  }
};
