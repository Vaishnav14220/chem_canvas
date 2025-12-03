/**
 * AI Task Component - Interactive Task Progress Visualization
 * 
 * Based on Vercel AI Elements pattern for showing AI workflow progress.
 * Provides collapsible task containers, file references, and status tracking.
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Loader2, 
  Circle,
  FileText,
  Search,
  Brain,
  Folder,
  Globe,
  AlertCircle,
  Clock
} from 'lucide-react';

// ==========================================
// Types
// ==========================================

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'error';

export interface TaskItemData {
  id: string;
  text: string;
  type: 'text' | 'file' | 'search' | 'thinking';
  file?: {
    name: string;
    icon?: string;
  };
  status: TaskStatus;
  duration?: number;
}

export interface TaskData {
  id: string;
  title: string;
  items: TaskItemData[];
  status: TaskStatus;
  startTime?: number;
  endTime?: number;
}

// ==========================================
// Context
// ==========================================

interface TaskContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  status: TaskStatus;
}

const TaskContext = createContext<TaskContextValue | null>(null);

const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('Task components must be used within a Task');
  }
  return context;
};

// ==========================================
// Status Icon Component
// ==========================================

const StatusIcon: React.FC<{ status: TaskStatus; className?: string }> = ({ status, className = '' }) => {
  switch (status) {
    case 'completed':
      return <Check className={`w-4 h-4 text-green-500 ${className}`} />;
    case 'in-progress':
      return <Loader2 className={`w-4 h-4 text-blue-500 animate-spin ${className}`} />;
    case 'error':
      return <AlertCircle className={`w-4 h-4 text-red-500 ${className}`} />;
    default:
      return <Circle className={`w-4 h-4 text-gray-400 ${className}`} />;
  }
};

// ==========================================
// Task Container
// ==========================================

interface TaskProps {
  defaultOpen?: boolean;
  status?: TaskStatus;
  className?: string;
  children: React.ReactNode;
}

export const Task: React.FC<TaskProps> = ({ 
  defaultOpen = false, 
  status = 'pending',
  className = '',
  children 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Auto-expand when in-progress
  useEffect(() => {
    if (status === 'in-progress') {
      setIsOpen(true);
    }
  }, [status]);

  return (
    <TaskContext.Provider value={{ isOpen, setIsOpen, status }}>
      <div className={`
        rounded-lg border transition-all duration-200
        ${status === 'in-progress' ? 'border-blue-500/50 bg-blue-500/5' : ''}
        ${status === 'completed' ? 'border-green-500/30 bg-green-500/5' : ''}
        ${status === 'error' ? 'border-red-500/30 bg-red-500/5' : ''}
        ${status === 'pending' ? 'border-gray-700 bg-gray-800/50' : ''}
        ${className}
      `}>
        {children}
      </div>
    </TaskContext.Provider>
  );
};

// ==========================================
// Task Trigger (Header)
// ==========================================

interface TaskTriggerProps {
  title: string;
  subtitle?: string;
  duration?: number;
  className?: string;
}

export const TaskTrigger: React.FC<TaskTriggerProps> = ({ 
  title, 
  subtitle,
  duration,
  className = '' 
}) => {
  const { isOpen, setIsOpen, status } = useTaskContext();

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={`
        w-full flex items-center justify-between p-3 text-left
        hover:bg-gray-700/30 transition-colors rounded-t-lg
        ${className}
      `}
    >
      <div className="flex items-center space-x-3">
        <StatusIcon status={status} />
        <div>
          <span className="font-medium text-white">{title}</span>
          {subtitle && (
            <span className="ml-2 text-xs text-gray-500">{subtitle}</span>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {duration && status === 'completed' && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(duration)}
          </span>
        )}
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </div>
    </button>
  );
};

// ==========================================
// Task Content (Collapsible)
// ==========================================

interface TaskContentProps {
  className?: string;
  children: React.ReactNode;
}

export const TaskContent: React.FC<TaskContentProps> = ({ className = '', children }) => {
  const { isOpen } = useTaskContext();

  if (!isOpen) return null;

  return (
    <div className={`
      px-3 pb-3 space-y-1 animate-in slide-in-from-top-2 duration-200
      ${className}
    `}>
      {children}
    </div>
  );
};

// ==========================================
// Task Item
// ==========================================

interface TaskItemProps {
  status?: TaskStatus;
  className?: string;
  children: React.ReactNode;
}

export const TaskItem: React.FC<TaskItemProps> = ({ 
  status = 'completed',
  className = '', 
  children 
}) => {
  return (
    <div className={`
      flex items-start space-x-2 text-sm py-1 pl-6
      ${status === 'in-progress' ? 'text-blue-400' : ''}
      ${status === 'completed' ? 'text-gray-400' : ''}
      ${status === 'pending' ? 'text-gray-500' : ''}
      ${status === 'error' ? 'text-red-400' : ''}
      ${className}
    `}>
      <div className="mt-1 flex-shrink-0">
        {status === 'in-progress' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : status === 'completed' ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : status === 'error' ? (
          <AlertCircle className="w-3 h-3" />
        ) : (
          <Circle className="w-3 h-3" />
        )}
      </div>
      <span>{children}</span>
    </div>
  );
};

// ==========================================
// Task Item File Badge
// ==========================================

interface TaskItemFileProps {
  icon?: 'file' | 'folder' | 'search' | 'globe' | 'brain';
  className?: string;
  children: React.ReactNode;
}

export const TaskItemFile: React.FC<TaskItemFileProps> = ({ 
  icon = 'file',
  className = '', 
  children 
}) => {
  const IconComponent = {
    file: FileText,
    folder: Folder,
    search: Search,
    globe: Globe,
    brain: Brain,
  }[icon];

  return (
    <span className={`
      inline-flex items-center gap-1 px-1.5 py-0.5 
      bg-gray-700 rounded text-xs font-mono text-gray-300
      ${className}
    `}>
      <IconComponent className="w-3 h-3" />
      {children}
    </span>
  );
};

// ==========================================
// Progress Bar Component
// ==========================================

interface TaskProgressProps {
  current: number;
  total: number;
  className?: string;
}

export const TaskProgress: React.FC<TaskProgressProps> = ({ 
  current, 
  total,
  className = '' 
}) => {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className={`flex items-center gap-2 px-3 pb-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{current}/{total}</span>
    </div>
  );
};

// ==========================================
// Task List Container
// ==========================================

interface TaskListProps {
  tasks: TaskData[];
  className?: string;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, className = '' }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {tasks.map((task, index) => (
        <Task 
          key={task.id} 
          status={task.status}
          defaultOpen={task.status === 'in-progress' || index === tasks.length - 1}
        >
          <TaskTrigger 
            title={task.title}
            duration={task.endTime && task.startTime ? task.endTime - task.startTime : undefined}
          />
          <TaskContent>
            {task.items.map((item) => (
              <TaskItem key={item.id} status={item.status}>
                {item.type === 'file' && item.file ? (
                  <span>
                    {item.text} <TaskItemFile icon="file">{item.file.name}</TaskItemFile>
                  </span>
                ) : item.type === 'search' ? (
                  <span>
                    {item.text} <TaskItemFile icon="globe">web search</TaskItemFile>
                  </span>
                ) : item.type === 'thinking' ? (
                  <span>
                    {item.text} <TaskItemFile icon="brain">reasoning</TaskItemFile>
                  </span>
                ) : (
                  item.text
                )}
              </TaskItem>
            ))}
          </TaskContent>
        </Task>
      ))}
    </div>
  );
};

export default Task;
