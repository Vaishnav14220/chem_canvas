/**
 * Deep Agent Chat Component
 * 
 * Enhanced version based on deep-agents-ui patterns from LangChain.
 * 
 * Features:
 * - Chat/Workflow toggle view
 * - Inline tasks and files panel (deep-agents-ui style)
 * - SubAgent indicators with expand/collapse
 * - ToolCall boxes with argument details  
 * - Resizable sidebar for tools/subagents
 * - Real-time task progress visualization
 * - Artifacts tab for generated content
 * - Final document panel
 * - Streaming responses with Gemini
 * - Tavily web search integration
 * 
 * This file re-exports the enhanced component from DeepAgentChatEnhanced.tsx
 * for backward compatibility.
 */

// Re-export the enhanced component as default
export { default } from './DeepAgentChatEnhanced';

// Also export the deep-agent sub-components for custom usage
export * from './deep-agent';

// Legacy types for backward compatibility
import type { TaskStatus } from '../services/deepAgentService';

export interface TaskStep {
  id: string;
  title: string;
  status: TaskStatus;
  type: 'text' | 'tool' | 'search' | 'file' | 'thinking';
  message?: string;
  startTime?: number;
  endTime?: number;
}

export interface ActiveTask {
  id: string;
  title: string;
  status: TaskStatus;
  steps: TaskStep[];
  startTime: number;
  endTime?: number;
}

export interface DeepAgentChatProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  initialMessage?: string;
  tavilyApiKey?: string;
  debugMode?: boolean;
}
