/**
 * TaskPanel Component
 * 
 * A collapsible panel that displays the current task/question for the user.
 * Inspired by AI SDK's Plan component pattern.
 * Makes it easy to see what the user needs to answer without scrolling through chat.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Target, CheckCircle2, Circle, Lightbulb } from 'lucide-react';

export interface TaskItem {
    id: string;
    text: string;
    type: 'question' | 'action' | 'hint';
    completed?: boolean;
}

interface TaskPanelProps {
    title?: string;
    description?: string;
    tasks: TaskItem[];
    isLoading?: boolean;
    defaultOpen?: boolean;
    onTaskComplete?: (taskId: string) => void;
}

export const TaskPanel: React.FC<TaskPanelProps> = ({
    title = "Your Task",
    description,
    tasks,
    isLoading = false,
    defaultOpen = true,
    onTaskComplete,
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const completedCount = tasks.filter(t => t.completed).length;
    const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

    const getIcon = (type: TaskItem['type'], completed?: boolean) => {
        if (completed) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        switch (type) {
            case 'question':
                return <Circle className="w-4 h-4 text-blue-500" />;
            case 'action':
                return <Target className="w-4 h-4 text-purple-500" />;
            case 'hint':
                return <Lightbulb className="w-4 h-4 text-yellow-500" />;
            default:
                return <Circle className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl shadow-sm overflow-hidden">
            {/* Header - Always visible */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                        <Target className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
                        {tasks.length > 0 && (
                            <p className="text-xs text-gray-500">
                                {completedCount} of {tasks.length} completed
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Progress indicator */}
                    {tasks.length > 0 && (
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        </div>
                    )}
                    {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </div>
            </button>

            {/* Content - Collapsible */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-3">
                            {/* Description */}
                            {description && (
                                <p className="text-sm text-gray-600 bg-white/60 rounded-lg p-3">
                                    {description}
                                </p>
                            )}

                            {/* Loading shimmer */}
                            {isLoading && (
                                <div className="space-y-2">
                                    {[1, 2].map(i => (
                                        <div key={i} className="flex items-center gap-3 animate-pulse">
                                            <div className="w-4 h-4 bg-gray-200 rounded-full" />
                                            <div className="flex-1 h-4 bg-gray-200 rounded" />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Task list */}
                            {!isLoading && tasks.length > 0 && (
                                <ul className="space-y-2">
                                    {tasks.map((task) => (
                                        <li
                                            key={task.id}
                                            onClick={() => !task.completed && onTaskComplete?.(task.id)}
                                            className={`flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer ${task.completed
                                                    ? 'bg-green-50 border border-green-200'
                                                    : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className="mt-0.5">
                                                {getIcon(task.type, task.completed)}
                                            </div>
                                            <span
                                                className={`text-sm flex-1 ${task.completed ? 'text-gray-500 line-through' : 'text-gray-800 font-medium'
                                                    }`}
                                            >
                                                {task.text}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {/* Empty state */}
                            {!isLoading && tasks.length === 0 && (
                                <p className="text-sm text-gray-400 italic text-center py-4">
                                    No tasks yet. The tutor will assign you a task as you learn.
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TaskPanel;
