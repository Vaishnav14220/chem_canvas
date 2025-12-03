/**
 * ToolCallBox Component
 * Based on deep-agents-ui pattern for displaying tool calls with expandable args/results
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import type { ToolCall } from './types';

interface ToolCallBoxProps {
  toolCall: ToolCall;
  isInterrupted?: boolean;
}

const statusIcons = {
  pending: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  interrupted: <XCircle className="w-4 h-4 text-yellow-400" />,
};

const statusLabels = {
  pending: 'Running...',
  completed: 'Completed',
  error: 'Error',
  interrupted: 'Interrupted',
};

const statusBorderColors = {
  pending: 'border-blue-500/30',
  completed: 'border-green-500/30',
  error: 'border-red-500/30',
  interrupted: 'border-yellow-500/30',
};

const statusBgColors = {
  pending: 'bg-blue-500/5',
  completed: 'bg-green-500/5',
  error: 'bg-red-500/5',
  interrupted: 'bg-yellow-500/5',
};

export const ToolCallBox = React.memo<ToolCallBoxProps>(
  ({ toolCall, isInterrupted }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedArgs, setExpandedArgs] = useState<Record<string, boolean>>({});

    const status = isInterrupted ? 'interrupted' : toolCall.status;
    const { name, args, result } = toolCall;

    const toggleArgExpanded = useCallback((key: string) => {
      setExpandedArgs(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    }, []);

    const formatToolName = (name: string) => {
      return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    const formatValue = (value: unknown): string => {
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return JSON.stringify(value, null, 2);
    };

    return (
      <div className={`rounded-lg border ${statusBorderColors[status]} ${statusBgColors[status]} overflow-hidden`}>
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-700/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            {statusIcons[status]}
            <span className="font-medium text-sm text-gray-200">
              {formatToolName(name)}
            </span>
            <span className="text-xs text-gray-500">
              {statusLabels[status]}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-3">
            {/* Arguments */}
            {Object.keys(args).length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Arguments
                </h4>
                <div className="space-y-2">
                  {Object.entries(args).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-sm border border-gray-700 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleArgExpanded(key)}
                        className="flex w-full items-center justify-between bg-gray-800/50 p-2 text-left text-xs font-medium transition-colors hover:bg-gray-700/50"
                      >
                        <span className="font-mono text-purple-300">{key}</span>
                        {expandedArgs[key] ? (
                          <ChevronUp className="w-3 h-3 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-gray-400" />
                        )}
                      </button>
                      {expandedArgs[key] && (
                        <div className="p-2 bg-gray-900/50 text-xs">
                          <pre className="whitespace-pre-wrap break-words text-gray-300 font-mono">
                            {formatValue(value)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Result
                </h4>
                <div className="p-2 bg-gray-900/50 rounded-sm border border-gray-700 text-xs">
                  <pre className="whitespace-pre-wrap break-words text-gray-300 font-mono max-h-40 overflow-y-auto">
                    {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

ToolCallBox.displayName = 'ToolCallBox';

export default ToolCallBox;
