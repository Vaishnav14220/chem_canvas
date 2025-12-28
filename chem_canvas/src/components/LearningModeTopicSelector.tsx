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
    MessageCircle,
    AlertCircle,
    Trash2,
    GraduationCap,
    ArrowLeft,
    Mic
} from 'lucide-react';
import { streamTextContent } from '../services/geminiService';
import { useSourceStore } from '../store/sourceStore';
import { SourceSelector } from './ui/SourceSelector';
import { addFileToSourceLibrary } from '../utils/sourceLibrary';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Field, FieldContent, FieldDescription as FieldHelp, FieldGroup, FieldLabel } from './ui/field';
import { Input } from './ui/input';
import { Separator } from './ui/separator';

interface UploadedDocument {
    name: string;
    mimeType: string;
    data: string; // base64
    size: number;
}

interface LearningModeTopicSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (topic: string, mode: 'auto' | 'socratic' | 'feynman' | 'pdf-study', documentData?: { mimeType: string; data: string }, remainingTopics?: string[]) => void;
    mode?: 'socratic' | 'feynman' | 'auto' | 'pdf-study' | null;
}

export const LearningModeTopicSelector: React.FC<LearningModeTopicSelectorProps> = ({
    isOpen,
    onClose,
    onStart,
    mode: initialMode
}) => {
    // Step state: 'mode-selection' | 'context-input'
    // If initialMode is provided, skip directly to context-input
    const [step, setStep] = useState<'mode-selection' | 'context-input'>(initialMode ? 'context-input' : 'mode-selection');
    const [selectedMode, setSelectedMode] = useState<'auto' | 'socratic' | 'feynman' | 'pdf-study'>(initialMode as any || 'auto');

    const [topic, setTopic] = useState('');
    const [documents, setDocuments] = useState<UploadedDocument[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when opening/closing
    React.useEffect(() => {
        if (isOpen) {
            if (initialMode) {
                setSelectedMode(initialMode);
                setStep('context-input');
            } else {
                setStep('mode-selection');
            }
            setTopic('');
            setDocuments([]);
            setSuggestedTopics([]);
            setError(null);
        }
    }, [isOpen, initialMode]);

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

            // Add to Global Source Store
            addFileToSourceLibrary(file, {
                data: base64,
                mimeType: file.type,
                name: file.name
            }).catch((error) => {
                console.warn('[LearningModeTopicSelector] Failed to add source to library:', error);
            });

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

        const { activeSourceId, getSource } = useSourceStore.getState();
        const activeSource = activeSourceId ? getSource(activeSourceId) : null;

        // Combine all documents into one if multiple
        let documentData = undefined;

        if (documents.length > 0) {
            documentData = {
                mimeType: documents[0].mimeType,
                data: documents[0].data
            };
        } else if (activeSource && activeSource.data) {
            documentData = {
                mimeType: activeSource.mimeType || 'application/pdf',
                data: activeSource.data
            };
        }

        // Filter out the selected topic from suggested topics
        const remainingTopicsToPass = suggestedTopics.filter(t => t !== topic.trim());
        onStart(topic.trim(), selectedMode, documentData, remainingTopicsToPass);

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

    type LearningModeType = 'auto' | 'socratic' | 'feynman' | 'pdf-study';
    const modeConfig: Record<LearningModeType, { title: string; icon: any; description: string; badge?: string }> = {
        auto: {
            title: 'Auto Mode',
            icon: Sparkles,
            description: 'AI adapts to your pace and learning style automatically.',
            badge: 'Recommended'
        },
        socratic: {
            title: 'Socratic',
            icon: MessageCircle,
            description: 'Learn through guided questioning and deep inquiry.'
        },
        feynman: {
            title: 'Feynman',
            icon: GraduationCap,
            description: 'Master concepts by teaching them in simple terms.'
        },
        'pdf-study': {
            title: 'PDF Study Mode',
            icon: Mic,
            description: 'Upload PDF to chat with AI and generate real-time notes on a side canvas.',
            badge: 'New'
        }
    };

    const currentConfig = modeConfig[selectedMode];
    const CurrentIcon = currentConfig.icon;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="fixed left-1/2 top-32 z-[60] w-full max-w-3xl -translate-x-1/2 px-4"
            >
                <Card className="rounded-2xl border-slate-800/80 bg-[#171717] text-slate-100 shadow-2xl backdrop-blur">
                    {step === 'mode-selection' ? (
                        /* =========================================================================
                           STEP 1: MODE SELECTION LAUNCHPAD
                           ========================================================================= */
                        <>
                            <CardHeader>
                                <CardTitle className="text-lg text-slate-100">Select learning mode</CardTitle>
                                <CardDescription className="text-slate-400">
                                    Pick the tutoring style for this session.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 md:grid-cols-3">
                                {(Object.keys(modeConfig) as Array<keyof typeof modeConfig>).map((m) => {
                                    const config = modeConfig[m];
                                    const Icon = config.icon;
                                    const isRecommended = Boolean(config.badge);

                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => {
                                                setSelectedMode(m);
                                                setStep('context-input');
                                            }}
                                            className="flex h-full flex-col gap-3 rounded-lg border border-slate-800 bg-black px-4 py-3 text-left transition hover:border-slate-700 hover:bg-slate-900"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-800 bg-black text-slate-200">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                {isRecommended && (
                                                    <Badge variant="secondary" className="border border-slate-800 bg-slate-900 text-slate-200">
                                                        {config.badge}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-sm font-semibold text-slate-100">{config.title}</div>
                                            <div className="text-xs text-slate-400">{config.description}</div>
                                        </button>
                                    );
                                })}
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    className="border-slate-800 bg-black text-slate-100 hover:bg-slate-900 hover:text-slate-100"
                                >
                                    Cancel
                                </Button>
                            </CardFooter>
                        </>
                    ) : (
                        /* =========================================================================
                           STEP 2: CONTEXT INPUT (TOPIC/FILE)
                           ========================================================================= */
                        <div className="flex max-h-[85vh] flex-col">
                            <CardHeader className="flex flex-row items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-800 bg-black text-slate-200">
                                        <CurrentIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg text-slate-100">{currentConfig.title}</CardTitle>
                                        <CardDescription className="text-slate-400">
                                            {currentConfig.badge || 'Learning session'}
                                        </CardDescription>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!initialMode && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setStep('mode-selection')}
                                            className="border-slate-800 bg-black text-slate-100 hover:bg-slate-900"
                                        >
                                            <ArrowLeft className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={onClose}
                                        className="text-slate-200 hover:bg-slate-900 hover:text-slate-100"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 space-y-6 overflow-y-auto">
                                <FieldGroup>
                                    {/* Topic Input */}
                                    <Field>
                                        <FieldLabel htmlFor="learning-topic" className="text-slate-200">Topic</FieldLabel>
                                        <FieldContent>
                                            <Input
                                                id="learning-topic"
                                                value={topic}
                                                onChange={e => setTopic(e.target.value)}
                                                placeholder="e.g., Photosynthesis, Quantum Mechanics, French Revolution..."
                                                className="border-transparent bg-[#111111] text-slate-100 placeholder:text-slate-500 shadow-[0_10px_24px_-20px_rgba(0,0,0,0.9)] focus-visible:ring-slate-500/60"
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && topic.trim()) {
                                                        handleStart();
                                                    }
                                                }}
                                            />
                                            <FieldHelp className="text-slate-400">
                                                Focus on one concept or question to guide the session.
                                            </FieldHelp>
                                        </FieldContent>
                                    </Field>

                                    {/* Suggestion Pills */}
                                    {suggestedTopics.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                                                <Sparkles className="h-4 w-4 text-slate-400" />
                                                Suggested topics
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {suggestedTopics.map((suggestion, index) => (
                                                    <Button
                                                        key={index}
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setTopic(suggestion)}
                                                        className="border-slate-800 bg-[#111111] text-slate-200 hover:bg-[#1b1b1b] hover:text-slate-100"
                                                    >
                                                        {suggestion}
                                                    </Button>
                                                ))}
                                            </div>
                                            {isAnalyzing && (
                                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Analyzing content for topics...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {isAnalyzing && suggestedTopics.length === 0 && (
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Analyzing content for topics...
                                        </div>
                                    )}

                                    <Separator className="bg-slate-800" />

                                    {/* Document Upload Area */}
                                    <Field>
                                        <FieldLabel className="text-slate-200">Sources</FieldLabel>
                                        <FieldHelp className="text-slate-400">
                                            Select from your library or upload a file for context.
                                        </FieldHelp>
                                        <FieldContent className="gap-3">
                                            <SourceSelector className="w-full" variant="black" />
                                            {documents.length === 0 ? (
                                                <div
                                                    onClick={() => fileInputRef.current?.click()}
                                                    onDragOver={handleDragOver}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={handleDrop}
                                                    className={`cursor-pointer rounded-lg border border-transparent p-4 text-center text-sm text-slate-400 shadow-[0_12px_26px_-20px_rgba(0,0,0,0.9)] transition ${isDragOver
                                                        ? 'bg-[#1b1b1b] text-slate-200'
                                                        : 'bg-[#111111] hover:bg-[#1b1b1b]'
                                                        }`}
                                                >
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept=".pdf,.txt,.md,.html"
                                                        onChange={e => handleFileUpload(e.target.files)}
                                                        className="hidden"
                                                    />
                                                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-[#111111] text-slate-300 shadow-[0_8px_18px_-12px_rgba(0,0,0,0.85)]">
                                                        <Upload className="h-4 w-4" />
                                                    </div>
                                                    <div className="font-medium text-slate-200">Upload or drag a file</div>
                                                    <div className="text-xs text-slate-500">
                                                        PDF, TXT, MD, HTML up to 20MB
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {documents.map((doc, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex items-center justify-between rounded-lg border border-transparent bg-[#111111] px-3 py-2 shadow-[0_10px_22px_-18px_rgba(0,0,0,0.9)]"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-[#111111] shadow-[0_6px_16px_-12px_rgba(0,0,0,0.85)]">
                                                                    <FileText className="h-4 w-4 text-slate-400" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-medium text-slate-100">{doc.name}</div>
                                                                    <div className="text-xs text-slate-500">{formatSize(doc.size)}</div>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => removeDocument(index)}
                                                                className="text-slate-300 hover:bg-slate-900 hover:text-slate-100"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </FieldContent>
                                    </Field>
                                </FieldGroup>

                            </CardContent>

                            {error && (
                                <div className="px-6 pb-2">
                                    <Alert variant="destructive" className="border-rose-500/50 bg-black text-rose-200">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                </div>
                            )}

                            <CardFooter className="justify-between">
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    className="border-transparent bg-[#111111] text-slate-100 shadow-[0_10px_22px_-18px_rgba(0,0,0,0.9)] hover:bg-[#1b1b1b] hover:text-slate-100"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleStart}
                                    disabled={!topic.trim() || isAnalyzing}
                                    className="border border-transparent bg-[#111111] text-slate-100 shadow-[0_10px_22px_-18px_rgba(0,0,0,0.9)] hover:bg-[#1b1b1b] hover:text-white"
                                >
                                    Start session
                                </Button>
                            </CardFooter>
                        </div>
                    )}
                </Card>
            </motion.div>
        </AnimatePresence>
    );
};

export default LearningModeTopicSelector;
