/**
 * FeynmanProgress Component
 * 
 * Displays learning progress using the Feynman Technique stages:
 * 1. Introduction - Learning the concept basics
 * 2. Teach-Back - Explaining in your own words  
 * 3. Gap Analysis - Identifying knowledge gaps
 * 4. Mastery - Demonstrating full understanding
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
    BookOpen,
    MessageSquare,
    Search,
    Trophy,
    CheckCircle2,
    Circle,
    Loader2
} from 'lucide-react';

export type FeynmanStage = 'introduction' | 'teach-back' | 'gap-analysis' | 'mastery';

interface ProgressStage {
    id: FeynmanStage;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const STAGES: ProgressStage[] = [
    {
        id: 'introduction',
        label: 'Introduction',
        description: 'Learn the basics',
        icon: <BookOpen className="w-4 h-4" />
    },
    {
        id: 'teach-back',
        label: 'Teach-Back',
        description: 'Explain it simply',
        icon: <MessageSquare className="w-4 h-4" />
    },
    {
        id: 'gap-analysis',
        label: 'Gap Analysis',
        description: 'Find knowledge gaps',
        icon: <Search className="w-4 h-4" />
    },
    {
        id: 'mastery',
        label: 'Mastery',
        description: 'Full understanding',
        icon: <Trophy className="w-4 h-4" />
    },
];

interface FeynmanProgressProps {
    currentStage: FeynmanStage;
    completedStages: FeynmanStage[];
    teachBackAttempts: number;
    gapsIdentified: number;
    gapsResolved: number;
    isLoading?: boolean;
}

export const FeynmanProgress: React.FC<FeynmanProgressProps> = ({
    currentStage,
    completedStages,
    teachBackAttempts,
    gapsIdentified,
    gapsResolved,
    isLoading = false,
}) => {
    const getStageIndex = (stage: FeynmanStage) => STAGES.findIndex(s => s.id === stage);
    const currentIndex = getStageIndex(currentStage);
    const progressPercentage = ((currentIndex + 1) / STAGES.length) * 100;

    const getStageStatus = (stage: ProgressStage, index: number): 'completed' | 'current' | 'upcoming' => {
        if (completedStages.includes(stage.id)) return 'completed';
        if (stage.id === currentStage) return 'current';
        return 'upcoming';
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Learning Progress</h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {Math.round(progressPercentage)}% Complete
                </span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </div>

            {/* Stages */}
            <div className="flex justify-between">
                {STAGES.map((stage, index) => {
                    const status = getStageStatus(stage, index);
                    return (
                        <div
                            key={stage.id}
                            className="flex flex-col items-center gap-1"
                        >
                            <div
                                className={`
                  w-8 h-8 rounded-full flex items-center justify-center transition-all
                  ${status === 'completed' ? 'bg-green-500 text-white' : ''}
                  ${status === 'current' ? 'bg-blue-500 text-white ring-2 ring-blue-200' : ''}
                  ${status === 'upcoming' ? 'bg-gray-200 text-gray-400' : ''}
                `}
                            >
                                {status === 'completed' ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : status === 'current' && isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    stage.icon
                                )}
                            </div>
                            <span
                                className={`text-xs font-medium text-center ${status === 'current' ? 'text-blue-600' :
                                        status === 'completed' ? 'text-green-600' : 'text-gray-400'
                                    }`}
                            >
                                {stage.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{teachBackAttempts}</div>
                    <div className="text-xs text-gray-500">Explanations</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-bold text-orange-500">{gapsIdentified}</div>
                    <div className="text-xs text-gray-500">Gaps Found</div>
                </div>
                <div className="text-center">
                    <div className="text-lg font-bold text-green-500">{gapsResolved}</div>
                    <div className="text-xs text-gray-500">Resolved</div>
                </div>
            </div>
        </div>
    );
};

export default FeynmanProgress;
