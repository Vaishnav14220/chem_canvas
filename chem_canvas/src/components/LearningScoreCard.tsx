/**
 * LearningScoreCard Component
 * 
 * A visual progress tracker showing:
 * - Total mastery score (circular gauge)
 * - Concepts cleared with details
 * - Misconceptions addressed with details
 * - Key insights gained with descriptions
 * 
 * EXPANDABLE: User can click to see full details of each category
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trophy,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    Sparkles,
    ChevronDown,
    ChevronUp,
    XCircle,
    Check
} from 'lucide-react';

// Detailed item types
export interface MisconceptionItem {
    id: string;
    text: string;
    resolved: boolean;
    timestamp?: Date;
}

export interface ConceptItem {
    id: string;
    name: string;
    cleared: boolean;
    timestamp?: Date;
}

export interface InsightItem {
    id: string;
    text: string;
    timestamp?: Date;
}

interface LearningScoreCardProps {
    masteryScore: number;
    conceptsCleared: number;
    totalConcepts: number;
    misconceptionsFound: number;
    misconceptionsResolved: number;
    insightsGained: number;
    // Detailed lists
    misconceptionsList?: MisconceptionItem[];
    conceptsList?: ConceptItem[];
    insightsList?: InsightItem[];
    isLoading?: boolean;
}

export const LearningScoreCard: React.FC<LearningScoreCardProps> = ({
    masteryScore,
    conceptsCleared,
    totalConcepts,
    misconceptionsFound,
    misconceptionsResolved,
    insightsGained,
    misconceptionsList = [],
    conceptsList = [],
    insightsList = [],
    isLoading = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'concepts' | 'misconceptions' | 'insights'>('concepts');

    const conceptProgress = totalConcepts > 0 ? (conceptsCleared / totalConcepts) * 100 : 0;
    const misconceptionProgress = misconceptionsFound > 0
        ? (misconceptionsResolved / misconceptionsFound) * 100
        : 100;

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-500';
        if (score >= 60) return 'text-blue-500';
        if (score >= 40) return 'text-yellow-500';
        return 'text-orange-500';
    };

    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (masteryScore / 100) * circumference;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Compact Header - Click to expand */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 transition-colors"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Mini Score Circle */}
                        <div className="relative w-12 h-12 flex-shrink-0">
                            <svg className="w-12 h-12 transform -rotate-90">
                                <circle cx="24" cy="24" r={radius / 2} stroke="#e5e7eb" strokeWidth="4" fill="none" />
                                <motion.circle
                                    cx="24" cy="24" r={radius / 2}
                                    stroke="#8b5cf6" strokeWidth="4" fill="none" strokeLinecap="round"
                                    initial={{ strokeDashoffset: circumference / 2 }}
                                    animate={{ strokeDashoffset: (circumference / 2) - (masteryScore / 100) * (circumference / 2) }}
                                    style={{ strokeDasharray: circumference / 2 }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-xs font-bold ${getScoreColor(masteryScore)}`}>{masteryScore}%</span>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                <span className="font-medium text-green-700">{conceptsCleared}/{totalConcepts}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                                <span className="font-medium text-orange-700">{misconceptionsResolved}/{misconceptionsFound}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Lightbulb className="w-3.5 h-3.5 text-purple-500" />
                                <span className="font-medium text-purple-700">{insightsGained}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                            {isExpanded ? 'Hide details' : 'View details'}
                        </span>
                        {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                    </div>
                </div>
            </button>

            {/* Expanded Details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 border-t border-gray-100">
                            {/* Tab Buttons */}
                            <div className="flex gap-1 mb-3 p-1 bg-gray-100 rounded-lg">
                                <button
                                    onClick={() => setActiveTab('concepts')}
                                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'concepts'
                                            ? 'bg-white text-green-700 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                                    Concepts ({conceptsCleared}/{totalConcepts})
                                </button>
                                <button
                                    onClick={() => setActiveTab('misconceptions')}
                                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'misconceptions'
                                            ? 'bg-white text-orange-700 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                                    Gaps ({misconceptionsResolved}/{misconceptionsFound})
                                </button>
                                <button
                                    onClick={() => setActiveTab('insights')}
                                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'insights'
                                            ? 'bg-white text-purple-700 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    <Lightbulb className="w-3 h-3 inline mr-1" />
                                    Insights ({insightsGained})
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="max-h-48 overflow-y-auto">
                                {/* Concepts Tab */}
                                {activeTab === 'concepts' && (
                                    <div className="space-y-2">
                                        {conceptsList.length > 0 ? (
                                            conceptsList.map((concept) => (
                                                <div
                                                    key={concept.id}
                                                    className={`flex items-center gap-2 p-2 rounded-lg ${concept.cleared ? 'bg-green-50' : 'bg-gray-50'
                                                        }`}
                                                >
                                                    {concept.cleared ? (
                                                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                    ) : (
                                                        <div className="w-4 h-4 border-2 border-gray-300 rounded flex-shrink-0" />
                                                    )}
                                                    <span className={`text-sm ${concept.cleared ? 'text-green-700' : 'text-gray-600'}`}>
                                                        {concept.name}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-400 italic text-center py-4">
                                                Concepts will appear as you learn
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Misconceptions Tab */}
                                {activeTab === 'misconceptions' && (
                                    <div className="space-y-2">
                                        {misconceptionsList.length > 0 ? (
                                            misconceptionsList.map((misconception) => (
                                                <div
                                                    key={misconception.id}
                                                    className={`flex items-start gap-2 p-2 rounded-lg ${misconception.resolved ? 'bg-green-50' : 'bg-orange-50'
                                                        }`}
                                                >
                                                    {misconception.resolved ? (
                                                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                                                    )}
                                                    <div className="flex-1">
                                                        <span className={`text-sm ${misconception.resolved ? 'text-green-700 line-through' : 'text-orange-700'}`}>
                                                            {misconception.text}
                                                        </span>
                                                        {misconception.resolved && (
                                                            <span className="ml-2 text-xs text-green-500">✓ Resolved</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-400 italic text-center py-4">
                                                No misconceptions identified yet - keep explaining!
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Insights Tab */}
                                {activeTab === 'insights' && (
                                    <div className="space-y-2">
                                        {insightsList.length > 0 ? (
                                            insightsList.map((insight, index) => (
                                                <div
                                                    key={insight.id}
                                                    className="flex items-start gap-2 p-2 rounded-lg bg-purple-50"
                                                >
                                                    <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                                    <span className="text-sm text-purple-700">
                                                        {insight.text}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-400 italic text-center py-4">
                                                Insights will be captured as you learn
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Progress Summary */}
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Overall Progress</span>
                                    <span>{masteryScore}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-purple-400 to-blue-500 rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${masteryScore}%` }}
                                        transition={{ duration: 0.8 }}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LearningScoreCard;
