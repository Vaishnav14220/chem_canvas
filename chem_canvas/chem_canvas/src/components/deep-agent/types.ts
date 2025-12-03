/**
 * Deep Agent UI Types
 * Based on deep-agents-ui patterns from LangChain
 */

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'completed' | 'error' | 'interrupted';
}

export interface SubAgent {
  id: string;
  name: string;
  subAgentName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface FileItem {
  path: string;
  content: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  updatedAt?: Date;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  status?: 'active' | 'completed' | 'error' | 'interrupted';
  messageCount?: number;
}

export interface ChatMessage {
  id: string;
  type: 'human' | 'ai' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  subAgents?: SubAgent[];
  timestamp: Date;
}

export interface ProcessedMessage {
  message: ChatMessage;
  toolCalls: ToolCall[];
  showAvatar: boolean;
}

// Task event types for real-time updates
export interface TaskProgressStep {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  type: 'thinking' | 'tool' | 'search' | 'file' | 'text';
  message?: string;
  startTime?: number;
  endTime?: number;
  streamContent?: string;
}

export interface ActiveTask {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  steps: TaskProgressStep[];
  startTime: number;
  endTime?: number;
}

// Configuration for the deep agent
export interface DeepAgentConfig {
  assistantId?: string;
  deploymentUrl?: string;
  apiKey?: string;
  tavilyApiKey?: string;
  debugMode?: boolean;
}

// State for chat context
export interface ChatContextState {
  messages: ChatMessage[];
  todos: TodoItem[];
  files: Record<string, string>;
  isLoading: boolean;
  isThreadLoading: boolean;
  interrupt?: any;
  threadId?: string;
}
