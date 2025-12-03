/**
 * TasksFilesPanel Component
 * Based on deep-agents-ui TasksFilesSidebar pattern
 * Displays inline tasks and files with collapsible sections
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  ChevronDown, 
  FileText,
  FolderOpen,
  X,
  Copy,
  Download,
  Edit3,
  Save
} from 'lucide-react';
import type { TodoItem, FileItem } from './types';

interface TasksFilesPanelProps {
  todos: TodoItem[];
  files: Record<string, string>;
  onFileUpdate?: (files: Record<string, string>) => void;
  isLoading?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  position?: 'inline' | 'sidebar';
}

const getStatusIcon = (status: TodoItem['status'], className?: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className={`w-4 h-4 text-green-400 ${className || ''}`} />;
    case 'in_progress':
      return <Clock className={`w-4 h-4 text-blue-400 animate-pulse ${className || ''}`} />;
    default:
      return <Circle className={`w-4 h-4 text-gray-500 ${className || ''}`} />;
  }
};

export const TasksFilesPanel = React.memo<TasksFilesPanelProps>(
  ({ todos, files, onFileUpdate, isLoading, isExpanded = false, onToggle, position = 'inline' }) => {
    const [tasksOpen, setTasksOpen] = useState(false);
    const [filesOpen, setFilesOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');

    const prevTodosCount = useRef(todos.length);
    const prevFilesCount = useRef(Object.keys(files).length);

    // Auto-expand when content goes from empty to having items
    useEffect(() => {
      if (prevTodosCount.current === 0 && todos.length > 0) {
        setTasksOpen(true);
      }
      prevTodosCount.current = todos.length;
    }, [todos.length]);

    const filesCount = Object.keys(files).length;
    useEffect(() => {
      if (prevFilesCount.current === 0 && filesCount > 0) {
        setFilesOpen(true);
      }
      prevFilesCount.current = filesCount;
    }, [filesCount]);

    const groupedTodos = useMemo(() => ({
      in_progress: todos.filter(t => t.status === 'in_progress'),
      pending: todos.filter(t => t.status === 'pending'),
      completed: todos.filter(t => t.status === 'completed'),
    }), [todos]);

    const hasTasks = todos.length > 0;
    const hasFiles = filesCount > 0;

    const handleFileSelect = useCallback((filePath: string) => {
      const content = files[filePath];
      setSelectedFile({ path: filePath, content: String(content || '') });
      setEditContent(String(content || ''));
      setIsEditing(false);
    }, [files]);

    const handleSaveFile = useCallback(() => {
      if (selectedFile && onFileUpdate) {
        onFileUpdate({ ...files, [selectedFile.path]: editContent });
        setSelectedFile({ ...selectedFile, content: editContent });
        setIsEditing(false);
      }
    }, [selectedFile, editContent, files, onFileUpdate]);

    const handleCopyFile = useCallback(() => {
      if (selectedFile) {
        navigator.clipboard.writeText(selectedFile.content);
      }
    }, [selectedFile]);

    const handleDownloadFile = useCallback(() => {
      if (selectedFile) {
        const blob = new Blob([selectedFile.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.path.split('/').pop() || 'file.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
    }, [selectedFile]);

    // Inline mode (inside input area)
    if (position === 'inline') {
      return (
        <div className="flex flex-col overflow-y-auto border-b border-gray-700 bg-gray-800/30 empty:hidden">
          {/* Tasks Section */}
          {hasTasks && (
            <div className="border-b border-gray-700">
              <button
                onClick={() => setTasksOpen(!tasksOpen)}
                className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const activeTask = todos.find(t => t.status === 'in_progress');
                    const totalTasks = todos.length;
                    const completedTasks = groupedTodos.completed.length;
                    const isCompleted = totalTasks === completedTasks;

                    if (isCompleted) {
                      return (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span>All tasks completed</span>
                        </>
                      );
                    }

                    if (activeTask) {
                      return (
                        <>
                          <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
                          <span>Task {completedTasks + 1} of {totalTasks}</span>
                          <span className="text-gray-500 truncate max-w-48">{activeTask.content}</span>
                        </>
                      );
                    }

                    return (
                      <>
                        <Circle className="w-4 h-4 text-gray-500" />
                        <span>Task {completedTasks} of {totalTasks}</span>
                      </>
                    );
                  })()}
                </div>
                {tasksOpen ? <ChevronDown className="w-4 h-4 rotate-180" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {tasksOpen && (
                <div className="px-4 pb-3 space-y-2">
                  {Object.entries(groupedTodos)
                    .filter(([_, items]) => items.length > 0)
                    .map(([status, items]) => (
                      <div key={status} className="space-y-1">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          {status === 'pending' ? 'Pending' : status === 'in_progress' ? 'In Progress' : 'Completed'}
                        </h4>
                        {items.map((todo, idx) => (
                          <div
                            key={`${status}_${todo.id}_${idx}`}
                            className="flex items-start gap-2 p-1 text-sm"
                          >
                            {getStatusIcon(todo.status, 'mt-0.5 flex-shrink-0')}
                            <span className="break-words text-gray-300">{todo.content}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Files Section */}
          {hasFiles && (
            <div>
              <button
                onClick={() => setFilesOpen(!filesOpen)}
                className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-teal-400" />
                  <span>Files (State)</span>
                  <span className="px-1.5 rounded-full bg-teal-500/30 text-teal-300 text-[10px] min-w-4 text-center">
                    {filesCount}
                  </span>
                </div>
                {filesOpen ? <ChevronDown className="w-4 h-4 rotate-180" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {filesOpen && (
                <div className="px-4 pb-3">
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                    {Object.keys(files).map(filePath => (
                      <button
                        key={filePath}
                        onClick={() => handleFileSelect(filePath)}
                        className={`flex items-center gap-2 p-2 rounded-lg text-sm text-left transition-colors ${
                          selectedFile?.path === filePath
                            ? 'bg-purple-500/20 border border-purple-500/50'
                            : 'bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate text-gray-300">{filePath.split('/').pop()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Sidebar mode
    return (
      <div className="h-full flex flex-col bg-gray-850 border-l border-gray-700">
        {/* Tasks Section */}
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden p-3">
          <div className="flex items-center justify-between pb-1.5 pt-2">
            <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
              Agent Tasks
            </span>
            <button
              onClick={() => setTasksOpen(!tasksOpen)}
              className="p-1 text-gray-400 hover:bg-gray-700 rounded transition-transform"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${tasksOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {tasksOpen && (
            <div className="bg-gray-800/50 rounded-xl px-3 py-2 overflow-y-auto">
              {todos.length === 0 ? (
                <div className="flex items-center justify-center p-4 text-center">
                  <p className="text-xs text-gray-500">No tasks created yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(groupedTodos)
                    .filter(([_, items]) => items.length > 0)
                    .map(([status, items]) => (
                      <div key={status}>
                        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                          {status === 'pending' ? 'Pending' : status === 'in_progress' ? 'In Progress' : 'Completed'}
                        </h3>
                        {items.map((todo, idx) => (
                          <div
                            key={`${status}_${todo.id}_${idx}`}
                            className="flex items-start gap-2 p-1 text-sm rounded-sm"
                          >
                            {getStatusIcon(todo.status)}
                            <span className="flex-1 break-words text-gray-300">{todo.content}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Files Section */}
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden p-3 border-t border-gray-700">
          <div className="flex items-center justify-between pb-1.5 pt-2">
            <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
              File System
            </span>
            <button
              onClick={() => setFilesOpen(!filesOpen)}
              className="p-1 text-gray-400 hover:bg-gray-700 rounded transition-transform"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${filesOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {filesOpen && (
            <div className="overflow-y-auto">
              {filesCount === 0 ? (
                <div className="flex items-center justify-center p-4 text-center">
                  <p className="text-xs text-gray-500">No files created yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
                  {Object.keys(files).map(filePath => (
                    <button
                      key={filePath}
                      onClick={() => handleFileSelect(filePath)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-sm text-left transition-colors ${
                        selectedFile?.path === filePath
                          ? 'bg-purple-500/20 border border-purple-500/50'
                          : 'bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700'
                      }`}
                    >
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate text-gray-300">{filePath.split('/').pop()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* File View Dialog */}
        {selectedFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-2xl max-h-[80vh] bg-gray-900 rounded-lg border border-gray-700 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <span className="font-medium text-gray-200">{selectedFile.path}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyFile}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                    title="Copy"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDownloadFile}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {onFileUpdate && !isLoading && (
                    isEditing ? (
                      <button
                        onClick={handleSaveFile}
                        className="p-1.5 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded"
                        title="Save"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full min-h-[300px] p-3 bg-gray-800 border border-gray-700 rounded-lg font-mono text-sm text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap break-words text-sm font-mono text-gray-300">
                    {selectedFile.content}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

TasksFilesPanel.displayName = 'TasksFilesPanel';

export default TasksFilesPanel;
