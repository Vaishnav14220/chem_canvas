/**
 * ChatMessage Component
 * Based on deep-agents-ui ChatMessage pattern
 */

import React, { useState, useCallback, useMemo } from 'react';
import { RotateCcw, Sparkles, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { SubAgentIndicator, SubAgentContent } from './SubAgentIndicator';
import { ToolCallBox } from './ToolCallBox';
import type { ChatMessage as ChatMessageType, ToolCall, SubAgent } from './types';

interface ChatMessageProps {
  message: ChatMessageType;
  toolCalls: ToolCall[];
  onRestartFromAIMessage?: (message: ChatMessageType) => void;
  onRestartFromSubTask?: (toolCallId: string) => void;
  debugMode?: boolean;
  isLastMessage?: boolean;
  isLoading?: boolean;
}

const extractStringFromContent = (message: ChatMessageType): string => {
  if (typeof message.content === 'string') return message.content;
  return '';
};

// Clean message content by removing raw tool JSON blocks
const cleanMessageContent = (content: string): string => {
  // Remove ```tool ... ``` blocks
  let cleaned = content.replace(/```tool\s*[\s\S]*?```/g, '');
  // Remove [TOOL: ...] ... [/TOOL] blocks
  cleaned = cleaned.replace(/\[TOOL:\s*\w+\][\s\S]*?\[\/TOOL\]/g, '');
  // Remove [DELEGATE: ...] ... [/DELEGATE] blocks  
  cleaned = cleaned.replace(/\[DELEGATE:\s*\S+\][\s\S]*?\[\/DELEGATE\]/g, '');
  // Remove standalone JSON objects that look like tool calls
  cleaned = cleaned.replace(/^\s*\{\s*"tool"\s*:[\s\S]*?\}\s*$/gm, '');
  // Clean up extra newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
};

export const ChatMessageComponent = React.memo<ChatMessageProps>(
  ({
    message,
    toolCalls,
    onRestartFromAIMessage,
    onRestartFromSubTask,
    debugMode,
    isLastMessage,
    isLoading,
  }) => {
    const isUser = message.type === 'human';
    const isAI = message.type === 'ai';

    const messageContent = extractStringFromContent(message);
    const hasContent = messageContent && messageContent.trim() !== '';
    const hasToolCalls = toolCalls.length > 0;

    // Extract subagents from tool calls with name === 'task'
    const subAgents = useMemo(() => {
      return toolCalls
        .filter((tc) => tc.name === 'task' && tc.args?.subagent_type)
        .map((tc) => ({
          id: tc.id,
          name: tc.name,
          subAgentName: String(tc.args.subagent_type || ''),
          input: tc.args,
          output: tc.result ? { result: tc.result } : undefined,
          status: tc.status === 'completed' 
            ? 'completed' as const
            : tc.status === 'error' 
            ? 'error' as const
            : tc.status === 'pending'
            ? 'active' as const
            : 'pending' as const,
        }));
    }, [toolCalls]);

    const [expandedSubAgents, setExpandedSubAgents] = useState<Record<string, boolean>>({});

    const isSubAgentExpanded = useCallback(
      (id: string) => expandedSubAgents[id] ?? true,
      [expandedSubAgents]
    );

    const toggleSubAgent = useCallback((id: string) => {
      setExpandedSubAgents(prev => ({
        ...prev,
        [id]: prev[id] === undefined ? false : !prev[id],
      }));
    }, []);

    return (
      <div className={`flex w-full max-w-full overflow-x-hidden ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`min-w-0 max-w-full ${isUser ? 'max-w-[70%]' : 'w-full'}`}>
          {/* Message Content */}
          {(hasContent || debugMode) && (
            <div className="relative flex items-end gap-0">
              <div
                className={`mt-4 overflow-hidden break-words text-sm font-normal leading-relaxed rounded-lg p-3 ${
                  isUser
                    ? 'bg-purple-500 text-white ml-auto'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                {/* AI Header */}
                {isAI && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-gray-400">Deep Agent</span>
                  </div>
                )}

                {/* Content */}
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {cleanMessageContent(messageContent)}
                  </ReactMarkdown>
                </div>

                {/* Debug restart button */}
                {debugMode && isAI && onRestartFromAIMessage && (
                  <button
                    onClick={() => onRestartFromAIMessage(message)}
                    className="absolute -right-8 bottom-1 p-1 rounded-full bg-gray-700/50 hover:bg-gray-600 transition-colors"
                    title="Restart from this message"
                  >
                    <RotateCcw className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tool Calls (excluding task tool for subagents) */}
          {hasToolCalls && (
            <div className="mt-4 flex w-full flex-col gap-2">
              {toolCalls
                .filter(tc => tc.name !== 'task')
                .map((toolCall) => (
                  <ToolCallBox
                    key={toolCall.id}
                    toolCall={toolCall}
                  />
                ))}
            </div>
          )}

          {/* SubAgents */}
          {!isUser && subAgents.length > 0 && (
            <div className="flex w-fit max-w-full flex-col gap-4 mt-4">
              {subAgents.map((subAgent) => (
                <div key={subAgent.id} className="flex w-full flex-col gap-2">
                  <div className="flex items-end gap-2">
                    <div className="w-full">
                      <SubAgentIndicator
                        subAgent={subAgent}
                        onClick={() => toggleSubAgent(subAgent.id)}
                        isExpanded={isSubAgentExpanded(subAgent.id)}
                      />
                    </div>
                    {debugMode && subAgent.status === 'completed' && onRestartFromSubTask && (
                      <button
                        onClick={() => onRestartFromSubTask(subAgent.id)}
                        className="p-1 rounded-full bg-gray-700/50 hover:bg-gray-600 transition-colors"
                        title="Restart from this subtask"
                      >
                        <RotateCcw className="w-3 h-3 text-gray-400" />
                      </button>
                    )}
                  </div>
                  <SubAgentContent
                    subAgent={subAgent}
                    isExpanded={isSubAgentExpanded(subAgent.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatMessageComponent.displayName = 'ChatMessage';

export default ChatMessageComponent;
