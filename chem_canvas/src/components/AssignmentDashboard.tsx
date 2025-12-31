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
    CheckCircle,
    Atom,
    Box,
    Headphones,
    Video,
    Network,
    Eye,
    X,
    Microscope,
} from 'lucide-react';
import {
    DEFAULT_GEMINI_PREFERENCES,
    getGeminiPreferences,
    setGeminiPreferences,
    type GeminiPreferences
} from '../utils/geminiPreferences';

interface AssignmentDashboardProps {
    onSelectFeature: (feature: string) => void;
    assignmentTab: 'exam-prep' | 'latex-prep';
    onTabChange: (tab: 'exam-prep' | 'latex-prep') => void;
    onFileUpload?: (file: File) => void;
    uploadedFileName?: string;
    topic?: string;
    onTopicChange?: (topic: string) => void;
    useTreeOfThoughts?: boolean;
    onToggleTreeOfThoughts?: (enabled: boolean) => void;
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
        id: 'latex-prep',
        title: 'LaTeX Prep',
        description: 'Generate clean LaTeX notes and equations from your source material.',
        icon: 'latex',
        color: 'slate',
        bgColor: 'bg-slate-50',
        iconBg: 'bg-slate-100',
        iconColor: 'text-slate-600',
        decorationColor: 'text-slate-200',
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
    {
        id: 'simulation',
        title: 'Simulation',
        description: 'Build an interactive simulation to explore the concept step-by-step.',
        icon: 'simulation',
        color: 'orange',
        bgColor: 'bg-orange-50',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600',
        decorationColor: 'text-orange-200',
    },
    {
        id: '3d-explorer',
        title: '3D Explorer',
        description: 'Load and manipulate 3D models with gesture controls.',
        icon: '3d-explorer',
        color: 'violet',
        bgColor: 'bg-violet-50',
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-600',
        decorationColor: 'text-violet-200',
    },
    {
        id: 'audio-module',
        title: 'Audio Lesson',
        description: 'Generate a narrated audio walkthrough of the key concepts.',
        icon: 'audio',
        color: 'sky',
        bgColor: 'bg-sky-50',
        iconBg: 'bg-sky-100',
        iconColor: 'text-sky-600',
        decorationColor: 'text-sky-200',
    },
    {
        id: 'video-module',
        title: 'Video Lesson',
        description: 'Create a short visual explainer with voiceover and key frames.',
        icon: 'video',
        color: 'fuchsia',
        bgColor: 'bg-fuchsia-50',
        iconBg: 'bg-fuchsia-100',
        iconColor: 'text-fuchsia-600',
        decorationColor: 'text-fuchsia-200',
    },
    {
        id: 'mindmap',
        title: 'Mind Map',
        description: 'Organize the topic into a connected visual map of ideas.',
        icon: 'mindmap',
        color: 'teal',
        bgColor: 'bg-teal-50',
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-600',
        decorationColor: 'text-teal-200',
    },
    {
        id: 'visual-activity',
        title: 'Visual Activity',
        description: 'Launch a visual activity with interactive prompts and diagrams.',
        icon: 'visual-activity',
        color: 'indigo',
        bgColor: 'bg-indigo-50',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        decorationColor: 'text-indigo-200',
    },
    {
        id: 'lab-manual-explorer',
        title: 'Lab Manual Explorer',
        description: 'Upload lab manuals and get AI-powered topic maps, grounded Q&A, and schematic generation.',
        icon: 'lab-manual',
        color: 'amber',
        bgColor: 'bg-amber-50',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        decorationColor: 'text-amber-200',
    },
];

const GEMINI_MODEL_OPTIONS = [
    'auto',
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-preview-09-2025',
    'gemini-2.5-flash-lite-preview-09-2025',
    'gemini-2.5-flash-native-audio-preview-09-2025',
    'gemini-2.5-flash-native-audio-preview-12-2025',
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-lite-001',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-3-pro-image-preview',
    'gemini-flash-latest',
];

const GEMINI_LANGUAGE_OPTIONS: { value: GeminiPreferences['language']; label: string }[] = [
    { value: 'auto', label: 'Auto (English)' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ru', label: 'Russian' },
    { value: 'hi', label: 'Hindi' },
    { value: 'ar', label: 'Arabic' },
];

const RESPONSE_STYLE_OPTIONS: { value: GeminiPreferences['responseStyle']; label: string }[] = [
    { value: 'balanced', label: 'Balanced' },
    { value: 'concise', label: 'Concise' },
    { value: 'detailed', label: 'Detailed' },
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
        case 'latex':
            return <FileText className={className} />;
        case 'flashcards':
            return <Layers className={className} />;
        case 'timeline':
            return <Calendar className={className} />;
        case 'simulation':
            return <Atom className={className} />;
        case '3d-explorer':
            return <Box className={className} />;
        case 'audio':
            return <Headphones className={className} />;
        case 'video':
            return <Video className={className} />;
        case 'mindmap':
            return <Network className={className} />;
        case 'visual-activity':
            return <Eye className={className} />;
        case 'lab-manual':
            return <Microscope className={className} />;
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
        case 'latex':
            return <FileText className={className} />;
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
        case 'simulation':
            return <Atom className={className} />;
        case '3d-explorer':
            return <Box className={className} />;
        case 'audio':
            return <Headphones className={className} />;
        case 'video':
            return <Video className={className} />;
        case 'mindmap':
            return <Network className={className} />;
        case 'visual-activity':
            return <Eye className={className} />;
        case 'lab-manual':
            return <Microscope className={className} />;
        default:
            return null;
    }
};

export const AssignmentDashboard: React.FC<AssignmentDashboardProps> = ({
    onSelectFeature,
    assignmentTab: _assignmentTab,
    onTabChange: _onTabChange,
    onFileUpload,
    uploadedFileName,
    topic = '',
    onTopicChange,
    useTreeOfThoughts = false,
    onToggleTreeOfThoughts,
    recentSessions = [],
}) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [localTopic, setLocalTopic] = useState(topic);
    const [showPreferences, setShowPreferences] = useState(false);
    const [preferences, setPreferences] = useState<GeminiPreferences>(() => getGeminiPreferences());
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

    const showToTToggle = Boolean(uploadedFileName);
    const topicLabelNumber = showToTToggle ? '3' : '2';

    const openPreferences = () => {
        setPreferences(getGeminiPreferences());
        setShowPreferences(true);
    };

    const handleSavePreferences = () => {
        setGeminiPreferences(preferences);
        setShowPreferences(false);
    };

    const handleResetPreferences = () => {
        setPreferences(DEFAULT_GEMINI_PREFERENCES);
        setGeminiPreferences(DEFAULT_GEMINI_PREFERENCES);
    };

    return (
        <div className="flex h-full w-full bg-[#f6f8fc] overflow-hidden">
            {/* Left Sidebar */}
            {!sidebarCollapsed && (
                <div className="w-72 flex-shrink-0 bg-[#1F1F1F] border-r border-white/10 flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {/* Upload Section */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                1. Upload Source Material
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border border-dashed border-white/15 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-300/60 hover:bg-white/5 transition-all group"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.txt,.md,.html,image/*"
                                    onChange={handleFileChange}
                                />
                                {uploadedFileName ? (
                                    <div className="flex flex-col items-center text-slate-100">
                                        <Check className="w-8 h-8 mb-2 text-emerald-400" />
                                        <span className="text-xs font-medium text-center break-all">{uploadedFileName}</span>
                                        <span className="text-[10px] text-slate-400 mt-1">Click to replace</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400 group-hover:text-white transition-colors">
                                        <FileUp className="w-8 h-8 mb-2" />
                                        <span className="text-sm font-medium">Upload / Paste Notes</span>
                                        <span className="text-[11px] mt-1">PDF, Text, or Markdown</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tree of Thoughts Toggle */}
                        {showToTToggle && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                    2. Tree of Thoughts
                                </label>
                                <button
                                    type="button"
                                    onClick={() => onToggleTreeOfThoughts?.(!useTreeOfThoughts)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${useTreeOfThoughts
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <GitBranch className="w-4 h-4" />
                                        Tree of Thoughts
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${useTreeOfThoughts
                                        ? 'bg-amber-500/30 text-amber-200'
                                        : 'bg-white/10 text-slate-400'
                                        }`}
                                    >
                                        {useTreeOfThoughts ? 'On' : 'Off'}
                                    </span>
                                </button>
                                <p className="text-[11px] text-slate-400">
                                    Plan the best approach before generating any module output.
                                </p>
                            </div>
                        )}

                        {/* Topic Input */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                {topicLabelNumber}. Topic / Concept
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="e.g. Projectile Motion..."
                                    value={localTopic}
                                    onChange={handleTopicInputChange}
                                    className="w-full pl-10 pr-4 py-2.5 border border-white/10 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#3b5b8a] focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Recent Sessions */}
                        <div className="space-y-3">
                            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                Recent Sessions
                            </label>
                            <div className="space-y-2">
                                {recentSessions.length > 0 ? (
                                    recentSessions.map((session) => (
                                        <button
                                            key={session.id}
                                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 text-left transition-colors"
                                        >
                                            <Brain className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-200 truncate">{session.title}</span>
                                        </button>
                                    ))
                                ) : (
                                    <>
                                        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 text-left transition-colors">
                                            <Brain className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-200">Thermodynamics Intro</span>
                                        </button>
                                        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 text-left transition-colors">
                                            <Brain className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-200">Linear Algebra Basics</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Links */}
                    <div className="border-t border-slate-700 p-4 space-y-2">
                        <button
                            type="button"
                            onClick={openPreferences}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-left transition-colors"
                        >
                            <Settings className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-300">Settings & Preferences</span>
                        </button>
                        <button
                            onClick={() => setSidebarCollapsed(true)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 text-left transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-300">Collapse Panel</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Collapsed Sidebar Toggle */}
            {sidebarCollapsed && (
                <button
                    onClick={() => setSidebarCollapsed(false)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-slate-900 border border-slate-700 rounded-lg shadow-sm hover:bg-slate-800 transition-colors"
                >
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                </button>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-8 py-6 bg-slate-200">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Ready to Explore</h1>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 max-w-7xl mx-auto">
                        {features.map((feature) => (
                            <div
                                key={feature.id}
                                onClick={() => onSelectFeature(feature.id)}
                                className={`relative group rounded-2xl p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${feature.bgColor} border border-white/50`}
                            >
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
                                    Start
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showPreferences && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
                    onClick={() => setShowPreferences(false)}
                >
                    <div
                        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">Gemini Preferences</h2>
                                <p className="text-xs text-slate-500">Saved locally for this device.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPreferences(false)}
                                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>

                        <div className="px-6 py-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                    Preferred Gemini model
                                </label>
                                <select
                                    value={preferences.model}
                                    onChange={(event) => setPreferences((prev) => ({ ...prev, model: event.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                >
                                    {GEMINI_MODEL_OPTIONS.map((model) => (
                                        <option key={model} value={model}>
                                            {model === 'auto' ? 'Auto (best available)' : model}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-slate-500">
                                    Auto uses the best available Gemini model for your API key. Some audio or image tools use specialized models.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                        Response language
                                    </label>
                                    <select
                                        value={preferences.language}
                                        onChange={(event) => setPreferences((prev) => ({ ...prev, language: event.target.value as GeminiPreferences['language'] }))}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                    >
                                        {GEMINI_LANGUAGE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-500">
                                        Applies to Gemini responses unless a tool requires strict formatting.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                        Response style
                                    </label>
                                    <select
                                        value={preferences.responseStyle}
                                        onChange={(event) => setPreferences((prev) => ({ ...prev, responseStyle: event.target.value as GeminiPreferences['responseStyle'] }))}
                                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                    >
                                        {RESPONSE_STYLE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                            <button
                                type="button"
                                onClick={handleResetPreferences}
                                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                            >
                                Reset to defaults
                            </button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPreferences(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSavePreferences}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignmentDashboard;
