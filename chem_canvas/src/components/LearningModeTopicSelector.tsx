/**
 * Learning Mode Topic Selector Component
 * 
 * A popup modal for selecting a topic and optionally uploading documents
 * to narrow down the learning focus for Socratic and Feynman modes.
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    FileText,
    Upload,
    Loader2,
    Sparkles,
    BookOpen,
    MessageCircle,
    Check,
    AlertCircle,
    File,
    Trash2
} from 'lucide-react';
import { streamTextContent } from '../services/geminiService';

interface UploadedDocument {
    name: string;
    mimeType: string;
    data: string; // base64
    size: number;
}

interface LearningModeTopicSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (topic: string, documentData?: { mimeType: string; data: string }) => void;
    mode: 'socratic' | 'feynman';
}

export const LearningModeTopicSelector: React.FC<LearningModeTopicSelectorProps> = ({
    isOpen,
    onClose,
    onStart,
    mode
}) => {
    const [topic, setTopic] = useState('');
    const [documents, setDocuments] = useState<UploadedDocument[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle file upload
    const handleFileUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const file = files[0];
        const validTypes = ['application/pdf', 'text/plain', 'text/markdown', 'text/html'];

        if (!validTypes.includes(file.type) && !file.name.endsWith('.md')) {
            setError('Please upload a PDF, TXT, MD, or HTML file');
            return;
        }

        if (file.size > 20 * 1024 * 1024) { // 20MB limit
            setError('File size must be less than 20MB');
            return;
        }

        setError(null);

        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const newDoc: UploadedDocument = {
                name: file.name,
                mimeType: file.type || 'text/plain',
                data: base64,
                size: file.size
            };

            setDocuments(prev => [...prev, newDoc]);

            // Auto-analyze document for topic suggestions
            analyzeDocumentForTopics(newDoc);
        } catch (err) {
            setError('Failed to read file');
            console.error('File read error:', err);
        }
    }, []);

    // Analyze document to extract topic suggestions
    const analyzeDocumentForTopics = async (doc: UploadedDocument) => {
        setIsAnalyzing(true);
        setSuggestedTopics([]);

        try {
            const prompt = `Analyze the following document content and extract 3-5 specific learning topics that would be suitable for focused study.

Return ONLY a JSON array of strings, no other text:
["Topic 1", "Topic 2", "Topic 3"]

Focus on extracting:
- Key concepts
- Main themes
- Specific subjects that can be deeply explored

Document content is attached.`;

            let response = '';
            await streamTextContent(
                prompt,
                (chunk) => {
                    response += chunk;
                },
                {
                    model: 'gemini-3-flash-preview',
                    thinking: 'high',
                    inlineData: {
                        mimeType: doc.mimeType,
                        data: doc.data
                    }
                }
            );

            // Parse response
            const jsonMatch = response.match(/\[[\s\S]*?\]/);
            if (jsonMatch) {
                const topics = JSON.parse(jsonMatch[0]);
                if (Array.isArray(topics)) {
                    setSuggestedTopics(topics.slice(0, 5));
                }
            }
        } catch (err) {
            console.error('Failed to analyze document:', err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Handle drag and drop
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFileUpload(e.dataTransfer.files);
    }, [handleFileUpload]);

    // Remove document
    const removeDocument = (index: number) => {
        setDocuments(prev => prev.filter((_, i) => i !== index));
        setSuggestedTopics([]);
    };

    // Handle start
    const handleStart = () => {
        if (!topic.trim()) {
            setError('Please enter a topic');
            return;
        }

        // Combine all documents into one if multiple
        const documentData = documents.length > 0 ? {
            mimeType: documents[0].mimeType,
            data: documents[0].data
        } : undefined;

        onStart(topic.trim(), documentData);

        // Reset state
        setTopic('');
        setDocuments([]);
        setSuggestedTopics([]);
        setError(null);
    };

    // Format file size
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const modeConfig = {
        socratic: {
            title: 'Socratic Learning',
            icon: MessageCircle,
            color: 'blue',
            gradient: 'from-blue-500 to-indigo-500',
            description: 'Learn through guided questions and discovery'
        },
        feynman: {
            title: 'Feynman Technique',
            icon: BookOpen,
            color: 'purple',
            gradient: 'from-purple-500 to-pink-500',
            description: 'Master concepts by teaching them back'
        }
    };

    const config = modeConfig[mode];
    const Icon = config.icon;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-lg"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className={`p-6 border-b border-slate-700 bg-gradient-to-r ${config.gradient} rounded-t-2xl`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{config.title}</h2>
                                    <p className="text-sm text-white/70">{config.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5">
                        {/* Topic Input */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                What topic would you like to learn?
                            </label>
                            <input
                                type="text"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                placeholder="e.g., Photosynthesis, Chemical Bonding, Thermodynamics..."
                                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && topic.trim()) {
                                        handleStart();
                                    }
                                }}
                            />
                        </div>

                        {/* Document Upload */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Upload study material (optional)
                            </label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragOver
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
                                    }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.txt,.md,.html"
                                    onChange={e => handleFileUpload(e.target.files)}
                                    className="hidden"
                                />
                                <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? 'text-blue-500' : 'text-slate-400'}`} />
                                <p className="text-sm text-slate-400">
                                    Drop a PDF, TXT, or MD file here, or click to browse
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Max 20MB
                                </p>
                            </div>
                        </div>

                        {/* Uploaded Documents */}
                        {documents.length > 0 && (
                            <div className="space-y-2">
                                {documents.map((doc, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700"
                                    >
                                        <div className="flex items-center gap-3">
                                            <File className="w-5 h-5 text-blue-400" />
                                            <div>
                                                <p className="text-sm text-white font-medium truncate max-w-[200px]">
                                                    {doc.name}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {formatSize(doc.size)}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeDocument(index)}
                                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4 text-slate-400" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Analyzing Indicator */}
                        {isAnalyzing && (
                            <div className="flex items-center gap-2 text-sm text-blue-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Analyzing document for topics...</span>
                            </div>
                        )}

                        {/* Suggested Topics */}
                        {suggestedTopics.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    <Sparkles className="w-4 h-4 inline-block mr-1 text-yellow-400" />
                                    Suggested topics from document
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {suggestedTopics.map((suggestion, index) => (
                                        <button
                                            key={index}
                                            onClick={() => setTopic(suggestion)}
                                            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${topic === suggestion
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
                                                }`}
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 text-sm text-red-400">
                                <AlertCircle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleStart}
                            disabled={!topic.trim() || isAnalyzing}
                            className={`px-6 py-2 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-2 ${topic.trim() && !isAnalyzing
                                    ? `bg-gradient-to-r ${config.gradient} hover:shadow-lg hover:shadow-${config.color}-500/25`
                                    : 'bg-slate-700 cursor-not-allowed'
                                }`}
                        >
                            <Check className="w-4 h-4" />
                            Start Learning
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default LearningModeTopicSelector;
