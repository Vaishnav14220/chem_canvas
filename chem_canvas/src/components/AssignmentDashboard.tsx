import React, { useState, useRef } from 'react';
import {
    FileUp,
    Check,
    Search,
    Settings,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    MessageSquare,
    GitBranch,
    FileText,
    Layers,
    Calendar,
    Brain,
    CheckCircle
} from 'lucide-react';

interface AssignmentDashboardProps {
    onSelectFeature: (feature: string) => void;
    assignmentTab: 'exam-prep' | 'latex-prep';
    onTabChange: (tab: 'exam-prep' | 'latex-prep') => void;
    onFileUpload?: (file: File) => void;
    uploadedFileName?: string;
    topic?: string;
    onTopicChange?: (topic: string) => void;
    recentSessions?: { id: string; title: string }[];
}

// Feature card data
const features = [
    {
        id: 'extract-formulas',
        title: 'Extract Formulas',
        description: 'Automatically identify and compile a cheat sheet of all formulas from your uploaded notes.',
        icon: 'formulas',
        color: 'blue',
        bgColor: 'bg-blue-50',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        decorationColor: 'text-blue-200',
    },
    {
        id: 'check-my-work',
        title: 'Check My Work',
        description: 'Upload your answers or solutions and get AI-powered feedback with annotations and corrections.',
        icon: 'check-work',
        color: 'emerald',
        bgColor: 'bg-emerald-50',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        decorationColor: 'text-emerald-200',
    },
    {
        id: 'qa-generator',
        title: 'Q&A Generator',
        description: 'Create interactive quizzes and flashcards to test your understanding of the core concepts.',
        icon: 'qa',
        color: 'purple',
        bgColor: 'bg-purple-50',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        decorationColor: 'text-purple-200',
    },
    {
        id: 'tree-of-thoughts',
        title: 'Tree of Thoughts',
        description: 'Generate a structured study plan tree, breaking down complex topics into digestible branches.',
        icon: 'tot',
        color: 'amber',
        bgColor: 'bg-amber-50',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        decorationColor: 'text-amber-200',
        recommended: true,
    },
    {
        id: 'smart-summary',
        title: 'Smart Summary',
        description: 'Get a concise summary of the key points, extracting only the most vital information.',
        icon: 'summary',
        color: 'blue',
        bgColor: 'bg-blue-50',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        decorationColor: 'text-blue-200',
    },
    {
        id: 'flashcards',
        title: 'Flashcards',
        description: 'Convert your notes into a set of digital flashcards for spaced repetition learning.',
        icon: 'flashcards',
        color: 'rose',
        bgColor: 'bg-rose-50',
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-600',
        decorationColor: 'text-rose-200',
    },
    {
        id: 'timeline-generator',
        title: 'Timeline Generator',
        description: 'Create a week-by-week study schedule based on the density of your material.',
        icon: 'timeline',
        color: 'cyan',
        bgColor: 'bg-cyan-50',
        iconBg: 'bg-cyan-100',
        iconColor: 'text-cyan-600',
        decorationColor: 'text-cyan-200',
    },
];

// Icon components for each feature
const FeatureIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className = '' }) => {
    switch (icon) {
        case 'formulas':
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M7 8h10M7 12h6M7 16h8" />
                </svg>
            );
        case 'check-work':
            return <CheckCircle className={className} />;
        case 'qa':
            return <MessageSquare className={className} />;
        case 'tot':
            return <GitBranch className={className} />;
        case 'summary':
            return <FileText className={className} />;
        case 'flashcards':
            return <Layers className={className} />;
        case 'timeline':
            return <Calendar className={className} />;
        default:
            return <Sparkles className={className} />;
    }
};

// Decoration icon (top-right of card)
const DecorationIcon: React.FC<{ icon: string; className?: string }> = ({ icon, className = '' }) => {
    switch (icon) {
        case 'formulas':
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l16 16M20 4L4 20" />
                    <path d="M7 4v6M4 7h6" />
                </svg>
            );
        case 'check-work':
            return <CheckCircle className={className} />;
        case 'qa':
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <circle cx="12" cy="17" r="1" />
                </svg>
            );
        case 'tot':
            return <GitBranch className={className} />;
        case 'summary':
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 6h16M4 12h10M4 18h14" />
                </svg>
            );
        case 'flashcards':
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="6" width="16" height="12" rx="2" />
                    <rect x="6" y="4" width="16" height="12" rx="2" />
                </svg>
            );
        case 'timeline':
            return (
                <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M3 10h18M10 4v18" />
                </svg>
            );
        default:
            return null;
    }
};

export const AssignmentDashboard: React.FC<AssignmentDashboardProps> = ({
    onSelectFeature,
    assignmentTab,
    onTabChange,
    onFileUpload,
    uploadedFileName,
    topic = '',
    onTopicChange,
    recentSessions = [],
}) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [localTopic, setLocalTopic] = useState(topic);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onFileUpload) {
            onFileUpload(file);
        }
    };

    const handleTopicInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalTopic(e.target.value);
        onTopicChange?.(e.target.value);
    };

    return (
        <div className="flex h-full w-full bg-[#f6f8fc] overflow-hidden">
            {/* Left Sidebar */}
            {!sidebarCollapsed && (
                <div className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {/* Upload Section */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                1. Upload Source Material
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.txt,.md,.html,image/*"
                                    onChange={handleFileChange}
                                />
                                {uploadedFileName ? (
                                    <div className="flex flex-col items-center text-slate-700">
                                        <Check className="w-8 h-8 mb-2 text-green-500" />
                                        <span className="text-xs font-medium text-center break-all">{uploadedFileName}</span>
                                        <span className="text-[10px] text-slate-400 mt-1">Click to replace</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500 transition-colors">
                                        <FileUp className="w-8 h-8 mb-2" />
                                        <span className="text-sm font-medium">Upload / Paste Notes</span>
                                        <span className="text-[11px] mt-1">PDF, Text, or Markdown</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Topic Input */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                2. Topic / Concept
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="e.g. Projectile Motion..."
                                    value={localTopic}
                                    onChange={handleTopicInputChange}
                                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Recent Sessions */}
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Recent Sessions
                            </label>
                            <div className="space-y-2">
                                {recentSessions.length > 0 ? (
                                    recentSessions.map((session) => (
                                        <button
                                            key={session.id}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left transition-colors"
                                        >
                                            <Brain className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-700 truncate">{session.title}</span>
                                        </button>
                                    ))
                                ) : (
                                    <>
                                        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left transition-colors">
                                            <Brain className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-700">Thermodynamics Intro</span>
                                        </button>
                                        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left transition-colors">
                                            <Brain className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-700">Linear Algebra Basics</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Links */}
                    <div className="border-t border-slate-200 p-4 space-y-2">
                        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors">
                            <Settings className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-600">Settings & Preferences</span>
                        </button>
                        <button
                            onClick={() => setSidebarCollapsed(true)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-600">Collapse Panel</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Collapsed Sidebar Toggle */}
            {sidebarCollapsed && (
                <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Sub-tabs */}
                <div className="flex-shrink-0 flex items-center justify-center pt-4 pb-2">
                    <div className="flex bg-slate-100 rounded-full p-1">
                        <button
                            onClick={() => onTabChange('exam-prep')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${assignmentTab === 'exam-prep'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <span className="text-lg">🦉</span>
                            Exam Prep
                        </button>
                        <button
                            onClick={() => onTabChange('latex-prep')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${assignmentTab === 'latex-prep'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <span className="font-mono text-base">Σ</span>
                            LaTeX Prep
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-8 py-6">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Ready to Explore</h1>
                        <p className="text-slate-500 max-w-lg mx-auto">
                            Select a learning module to generate an interactive experience powered by
                            <br />
                            Gemini 3 Pro with live reasoning.
                        </p>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
                        {features.map((feature) => (
                            <div
                                key={feature.id}
                                onClick={() => onSelectFeature(feature.id)}
                                className={`relative group rounded-2xl p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${feature.bgColor} border border-white/50`}
                            >
                                {/* Recommended Badge */}
                                {feature.recommended && (
                                    <div className="absolute top-3 right-3 px-2 py-1 bg-amber-400 text-white text-[10px] font-bold uppercase rounded tracking-wider">
                                        Recommended
                                    </div>
                                )}

                                {/* Decoration */}
                                <div className="absolute top-4 right-4">
                                    <DecorationIcon icon={feature.icon} className={`w-12 h-12 ${feature.decorationColor} opacity-50`} />
                                </div>

                                {/* Icon */}
                                <div className={`w-10 h-10 ${feature.iconBg} rounded-lg flex items-center justify-center mb-4`}>
                                    <FeatureIcon icon={feature.icon} className={`w-5 h-5 ${feature.iconColor}`} />
                                </div>

                                {/* Content */}
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                                <p className="text-sm text-slate-600 mb-4 leading-relaxed">{feature.description}</p>

                                {/* Action */}
                                <button className={`text-sm font-semibold ${feature.iconColor} group-hover:underline flex items-center gap-1`}>
                                    GENERATE
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssignmentDashboard;
