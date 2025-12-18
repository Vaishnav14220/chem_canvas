import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Rocket, Brain, Sparkles, Check, Info, Key, ExternalLink, X } from 'lucide-react';
import { GeminiModelId, MODEL_CONFIGS, ModelConfig, modelRequiresApiKey } from '../../types/modelTypes';
import { getStoredGroqApiKey, storeGroqApiKey, isGroqConfigured } from '../../services/groqService';
import { cn } from '@/lib/utils';

interface ModelSelectorProps {
    selectedModel: GeminiModelId;
    onModelChange: (modelId: GeminiModelId) => void;
    disabled?: boolean;
    compact?: boolean;
}

const getModelIcon = (config: ModelConfig) => {
    switch (config.tier) {
        case 'lite': return <Zap size={14} className="text-yellow-400" />;
        case 'standard': return <Rocket size={14} className="text-cyan-400" />;
        case 'pro': return <Brain size={14} className="text-purple-400" />;
        case 'flagship': return <Sparkles size={14} className="text-pink-400" />;
        case 'external': return <span className="text-sm">🔮</span>;
        default: return <Zap size={14} />;
    }
};

const getTierColor = (tier: ModelConfig['tier']) => {
    switch (tier) {
        case 'lite': return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30';
        case 'standard': return 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30';
        case 'pro': return 'from-purple-500/20 to-purple-600/10 border-purple-500/30';
        case 'flagship': return 'from-pink-500/20 to-pink-600/10 border-pink-500/30';
        case 'external': return 'from-violet-500/20 to-violet-600/10 border-violet-500/30';
        default: return 'from-slate-500/20 to-slate-600/10 border-slate-500/30';
    }
};

const getTierBadgeColor = (tier: ModelConfig['tier']) => {
    switch (tier) {
        case 'lite': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
        case 'standard': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
        case 'pro': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
        case 'flagship': return 'bg-pink-500/20 text-pink-300 border-pink-500/40';
        case 'external': return 'bg-violet-500/20 text-violet-300 border-violet-500/40';
        default: return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
    selectedModel,
    onModelChange,
    disabled = false,
    compact = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showTooltip, setShowTooltip] = useState<string | null>(null);
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const [pendingModel, setPendingModel] = useState<GeminiModelId | null>(null);
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [groqConfigured, setGroqConfigured] = useState(isGroqConfigured());
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedConfig = MODEL_CONFIGS.find(m => m.id === selectedModel) || MODEL_CONFIGS[1];

    // Check Groq configuration on mount
    useEffect(() => {
        setGroqConfigured(isGroqConfigured());
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (modelId: GeminiModelId) => {
        const config = MODEL_CONFIGS.find(m => m.id === modelId);

        // Check if model requires API key and it's not configured
        if (config?.requiresApiKey && !isGroqConfigured()) {
            setPendingModel(modelId);
            setShowApiKeyModal(true);
            setIsOpen(false);
            return;
        }

        onModelChange(modelId);
        setIsOpen(false);
    };

    const handleSaveApiKey = () => {
        if (apiKeyInput.trim().length > 10) {
            storeGroqApiKey(apiKeyInput.trim());
            setGroqConfigured(true);
            setShowApiKeyModal(false);

            // Now select the model
            if (pendingModel) {
                onModelChange(pendingModel);
                setPendingModel(null);
            }
            setApiKeyInput('');
        }
    };

    const handleCancelApiKey = () => {
        setShowApiKeyModal(false);
        setPendingModel(null);
        setApiKeyInput('');
    };

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                {/* Trigger Button */}
                <button
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
                        "bg-slate-800/60 border border-slate-700/50",
                        "text-xs text-slate-200 font-semibold",
                        "hover:bg-slate-700/70 hover:border-slate-600/50",
                        "transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-primary/40",
                        disabled && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {getModelIcon(selectedConfig)}
                    <span className={compact ? "hidden sm:inline" : ""}>
                        {selectedConfig.shortName}
                    </span>
                    <ChevronDown
                        size={12}
                        className={cn(
                            "text-slate-400 transition-transform duration-200",
                            isOpen && "rotate-180"
                        )}
                    />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className={cn(
                        "absolute left-0 bottom-full mb-2 z-50",
                        "w-80 max-h-[400px] overflow-y-auto",
                        "bg-slate-900/95 backdrop-blur-xl",
                        "border border-slate-700/60 rounded-2xl",
                        "shadow-[0_20px_50px_rgba(0,0,0,0.5)]",
                        "animate-in fade-in slide-in-from-bottom-2 duration-200"
                    )}>
                        <div className="p-2">
                            <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Select Model
                            </div>

                            {MODEL_CONFIGS.map((config) => (
                                <div
                                    key={config.id}
                                    className="relative"
                                    onMouseEnter={() => setShowTooltip(config.id)}
                                    onMouseLeave={() => setShowTooltip(null)}
                                >
                                    <button
                                        onClick={() => handleSelect(config.id)}
                                        className={cn(
                                            "w-full flex items-start gap-3 p-3 rounded-xl",
                                            "text-left transition-all duration-150",
                                            "hover:bg-slate-800/60",
                                            selectedModel === config.id && "bg-gradient-to-r " + getTierColor(config.tier)
                                        )}
                                    >
                                        {/* Icon */}
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                            "bg-slate-800/80 border border-slate-700/60"
                                        )}>
                                            {getModelIcon(config)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-100">
                                                    {config.name}
                                                </span>
                                                {selectedModel === config.id && (
                                                    <Check size={14} className="text-cyan-400" />
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                                {config.description}
                                            </p>

                                            {/* Capability badges */}
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                <span className={cn(
                                                    "text-[10px] px-1.5 py-0.5 rounded-full border",
                                                    getTierBadgeColor(config.tier)
                                                )}>
                                                    {config.tier === 'flagship' ? 'Best' : config.tier === 'external' ? 'External' : config.tier}
                                                </span>
                                                {config.requiresApiKey && (
                                                    <span className={cn(
                                                        "text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-1",
                                                        groqConfigured
                                                            ? "bg-green-500/20 text-green-300 border-green-500/40"
                                                            : "bg-orange-500/20 text-orange-300 border-orange-500/40"
                                                    )}>
                                                        <Key size={8} />
                                                        {groqConfigured ? 'Key Set' : 'Needs Key'}
                                                    </span>
                                                )}
                                                {config.capabilities.thinking && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/50">
                                                        {config.thinkingType === 'level' ? '🧠 Level' : config.thinkingType === 'reasoning' ? '🧠 Reasoning' : '🧠 Budget'}
                                                    </span>
                                                )}
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300 border border-slate-600/50">
                                                    {(config.capabilities.maxInputTokens / 1000).toFixed(0)}K ctx
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    {/* Info tooltip */}
                                    {showTooltip === config.id && (
                                        <div className={cn(
                                            "absolute left-full top-0 ml-2 z-50",
                                            "w-56 p-3 bg-slate-800 border border-slate-700",
                                            "rounded-xl shadow-xl",
                                            "animate-in fade-in slide-in-from-left-1 duration-150"
                                        )}>
                                            <div className="text-xs font-semibold text-slate-200 mb-2">
                                                {config.provider === 'groq' ? 'Groq API' : 'Capabilities'}
                                            </div>
                                            <div className="space-y-1 text-[11px] text-slate-400">
                                                {config.provider === 'groq' && (
                                                    <div className="mb-2 pb-2 border-b border-slate-700">
                                                        <a
                                                            href="https://console.groq.com/keys"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-1 text-violet-400 hover:text-violet-300"
                                                        >
                                                            Get Groq API Key <ExternalLink size={10} />
                                                        </a>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span>Function Calling</span>
                                                    <span className={config.capabilities.functionCalling ? "text-green-400" : "text-slate-600"}>
                                                        {config.capabilities.functionCalling ? "✓" : "✗"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Document Processing</span>
                                                    <span className={config.capabilities.documentProcessing ? "text-green-400" : "text-slate-600"}>
                                                        {config.capabilities.documentProcessing ? "✓" : "✗"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Search Grounding</span>
                                                    <span className={config.capabilities.searchGrounding ? "text-green-400" : "text-slate-600"}>
                                                        {config.capabilities.searchGrounding ? "✓" : "✗"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Thinking/Reasoning</span>
                                                    <span className={config.capabilities.thinking ? "text-green-400" : "text-slate-600"}>
                                                        {config.capabilities.thinking ? `✓ (${config.thinkingType})` : "✗"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Footer hint */}
                        <div className="px-4 py-2 border-t border-slate-800/60">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                <Info size={10} />
                                <span>Hover on a model for detailed capabilities</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* API Key Modal */}
            {showApiKeyModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={handleCancelApiKey}
                    />
                    <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={handleCancelApiKey}
                            className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                <span className="text-xl">🔮</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Groq API Key Required</h3>
                                <p className="text-sm text-slate-400">Enter your API key to use Qwen3-32B</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    API Key
                                </label>
                                <input
                                    type="password"
                                    value={apiKeyInput}
                                    onChange={(e) => setApiKeyInput(e.target.value)}
                                    placeholder="gsk_..."
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                                    autoFocus
                                />
                            </div>

                            <a
                                href="https://console.groq.com/keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                            >
                                <ExternalLink size={14} />
                                Get your free Groq API key
                            </a>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleCancelApiKey}
                                    className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveApiKey}
                                    disabled={apiKeyInput.trim().length < 10}
                                    className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Save & Use Model
                                </button>
                            </div>
                        </div>

                        <p className="mt-4 text-xs text-slate-500 text-center">
                            Your API key is stored locally in your browser
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export default ModelSelector;
