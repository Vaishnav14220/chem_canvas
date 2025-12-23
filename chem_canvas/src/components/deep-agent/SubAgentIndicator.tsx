/**
 * SubAgentIndicator Component
 * Based on deep-agents-ui pattern for displaying subagent status
 */

import React from 'react';
import { ChevronDown, ChevronUp, Users, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { SubAgent } from './types';

interface SubAgentIndicatorProps {
  subAgent: SubAgent;
  onClick: () => void;
  isExpanded?: boolean;
}

const statusIcons = {
  pending: <div className="w-2 h-2 rounded-full bg-gray-400" />,
  active: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
};

const statusColors = {
  pending: 'text-gray-400',
  active: 'text-blue-400',
  completed: 'text-green-400',
  error: 'text-red-400',
};

export const SubAgentIndicator = React.memo<SubAgentIndicatorProps>(
  ({ subAgent, onClick, isExpanded = true }) => {
    return (
      <div className="w-fit max-w-[70vw] overflow-hidden rounded-lg border border-gray-700 bg-gray-800/50">
        <button
          onClick={onClick}
          className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition-colors duration-200 hover:bg-gray-700/50"
        >
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span className={`font-medium text-sm ${statusColors[subAgent.status]}`}>
                {subAgent.subAgentName}
              </span>
              {statusIcons[subAgent.status]}
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <span className="text-xs capitalize">{subAgent.status}</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </button>
      </div>
    );
  }
);

SubAgentIndicator.displayName = 'SubAgentIndicator';

interface SubAgentContentProps {
  subAgent: SubAgent;
  isExpanded: boolean;
}

export const SubAgentContent = React.memo<SubAgentContentProps>(
  ({ subAgent, isExpanded }) => {
    if (!isExpanded) return null;

    const extractContent = (data: unknown): string => {
      if (typeof data === 'string') return data;
      if (typeof data === 'object' && data !== null) {
        if ('content' in data) return extractContent((data as any).content);
        if ('message' in data) return extractContent((data as any).message);
        if ('task' in data) return extractContent((data as any).task);
        return JSON.stringify(data, null, 2);
      }
      return String(data);
    };

    return (
      <div className="w-full max-w-full mt-2">
        <div className="bg-gray-800/50 border border-gray-700 rounded-md p-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Input
          </h4>
          <div className="mb-4 text-sm text-gray-300 whitespace-pre-wrap break-words">
            {extractContent(subAgent.input)}
          </div>
          {subAgent.output && (
            <>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Output
              </h4>
              <div className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                {extractContent(subAgent.output)}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
);

SubAgentContent.displayName = 'SubAgentContent';

export default SubAgentIndicator;
