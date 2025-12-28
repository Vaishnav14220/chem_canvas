/**
 * PDF Study Mode View Component
 * 
 * Split-screen layout for PDF document study with live AI audio conversation
 * and real-time note generation on Excalidraw canvas.
 * 
 * Layout:
 * - Left Panel (40%): PDF Viewer showing uploaded document
 * - Right Panel (60%): 
 *   - Top: Automated Notes panel (real-time AI-generated insights)
 *   - Bottom: Excalidraw Canvas for visual notes
 * - Bottom Bar: Gemini Live audio controls with mic button
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic,
    MicOff,
    FileText,
    X,
    Send,
    Sparkles,
    Loader2,
    ChevronRight,
    ChevronLeft,
    Volume2,
    VolumeX,
    Pencil,
    StickyNote,
    ArrowLeft
} from 'lucide-react';
import { ExcalidrawCanvas, ExcalidrawCanvasRef } from './ExcalidrawCanvas/ExcalidrawCanvas';
import { useGeminiLive } from './GeminiLive/hooks/useGeminiLive';
import { getSharedGeminiApiKey } from '../firebase/apiKeys';
import { useSourceStore } from '../store/sourceStore';

interface PdfStudyModeViewProps {
    topic: string;
    documentData?: { mimeType: string; data: string };
    onClose: () => void;
}

interface GeneratedNote {
    id: string;
    content: string;
    timestamp: Date;
    type: 'insight' | 'summary' | 'question' | 'definition';
}

const NOTE_COLORS = {
    insight: '#fef3c7',    // amber-100
    summary: '#dbeafe',    // blue-100
    question: '#fce7f3',   // pink-100
    definition: '#d1fae5', // emerald-100
};

export const PdfStudyModeView: React.FC<PdfStudyModeViewProps> = ({
    topic,
    documentData,
    onClose
}) => {
    // State
    const [apiKey, setApiKey] = useState<string>('');
    const [inputValue, setInputValue] = useState('');
    const [generatedNotes, setGeneratedNotes] = useState<GeneratedNote[]>([]);
    const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
    const [transcriptBuffer, setTranscriptBuffer] = useState('');
    const [isProcessingNotes, setIsProcessingNotes] = useState(false);

    // Refs
    const excalidrawRef = useRef<ExcalidrawCanvasRef>(null);
    const pdfContainerRef = useRef<HTMLDivElement>(null);
    const notesEndRef = useRef<HTMLDivElement>(null);

    // Get sources from store
    const { sources, activeSourceId, getSource } = useSourceStore();
    const activeSource = activeSourceId ? getSource(activeSourceId) : null;

    // Initialize Gemini Live for voice conversation
    const geminiLive = useGeminiLive(apiKey, 'en', {
        systemInstructionOverride: `You are a helpful study assistant helping the user understand a PDF document about "${topic}".
As the user speaks, provide:
1. Key insights from their questions
2. Definitions of terms they mention
3. Summaries of concepts they discuss
4. Clarifying questions to deepen understanding

Keep responses conversational and helpful. When you identify key points, structure them clearly.`
    });

    // Fetch API key
    useEffect(() => {
        getSharedGeminiApiKey().then(key => {
            setApiKey(key || '');
        });
    }, []);

    // Auto-scroll notes
    useEffect(() => {
        notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [generatedNotes]);

    // Process transcripts and generate notes
    const lastProcessedIndexRef = React.useRef(0);
    useEffect(() => {
        const transcripts = geminiLive.transcripts;
        if (transcripts.length > lastProcessedIndexRef.current) {
            // Process new transcripts
            for (let i = lastProcessedIndexRef.current; i < transcripts.length; i++) {
                const transcript = transcripts[i];
                const text = transcript.text || '';

                // Generate note from AI response
                if (text.length > 20) {
                    const noteType = determineNoteType(text);
                    const newNote: GeneratedNote = {
                        id: `note-${Date.now()}-${i}`,
                        content: text,
                        timestamp: new Date(),
                        type: noteType
                    };
                    setGeneratedNotes(prev => [...prev, newNote]);

                    // Add to Excalidraw canvas as sticky note
                    if (excalidrawRef.current) {
                        excalidrawRef.current.addStickyNote({
                            id: newNote.id,
                            text: text.substring(0, 200),
                            speaker: (transcript as any).role === 'user' ? 'user' : 'model',
                            isFinal: true
                        });
                    }
                }
            }
            lastProcessedIndexRef.current = transcripts.length;
        }
    }, [geminiLive.transcripts]);

    // Determine note type based on content
    const determineNoteType = (content: string): GeneratedNote['type'] => {
        const lower = content.toLowerCase();
        if (lower.includes('define') || lower.includes('means') || lower.includes('is called')) {
            return 'definition';
        }
        if (lower.includes('?') || lower.includes('why') || lower.includes('how')) {
            return 'question';
        }
        if (lower.includes('summary') || lower.includes('in short') || lower.includes('basically')) {
            return 'summary';
        }
        return 'insight';
    };

    // Toggle voice connection
    const handleVoiceToggle = useCallback(() => {
        if (geminiLive.connectionState === 'CONNECTED') {
            geminiLive.disconnect();
        } else {
            geminiLive.connect();
        }
    }, [geminiLive]);

    // Handle text input send
    const handleSendMessage = useCallback(() => {
        if (!inputValue.trim()) return;

        // Add as a note and send to AI
        const newNote: GeneratedNote = {
            id: `note-${Date.now()}`,
            content: inputValue.trim(),
            timestamp: new Date(),
            type: 'insight'
        };
        setGeneratedNotes(prev => [...prev, newNote]);

        if (geminiLive.connectionState === 'CONNECTED') {
            // Send to Gemini Live if connected
            // geminiLive.sendAudio or text message
        }

        setInputValue('');
    }, [inputValue, geminiLive]);

    // Create PDF blob URL
    const pdfBlobUrl = React.useMemo(() => {
        if (documentData?.data && documentData?.mimeType === 'application/pdf') {
            try {
                const byteCharacters = atob(documentData.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                return URL.createObjectURL(blob);
            } catch (e) {
                console.error('Failed to create PDF blob:', e);
                return null;
            }
        }
        // Try active source
        if (activeSource?.data && activeSource?.mimeType === 'application/pdf') {
            try {
                const byteCharacters = atob(activeSource.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                return URL.createObjectURL(blob);
            } catch (e) {
                console.error('Failed to create PDF blob from source:', e);
                return null;
            }
        }
        return null;
    }, [documentData, activeSource]);

    // Cleanup blob URL
    useEffect(() => {
        return () => {
            if (pdfBlobUrl) {
                URL.revokeObjectURL(pdfBlobUrl);
            }
        };
    }, [pdfBlobUrl]);

    const isConnected = geminiLive.connectionState === 'CONNECTED';
    const isConnecting = geminiLive.connectionState === 'CONNECTING';

    return (
        <div className="flex flex-col h-screen w-full bg-[#0f0f0f] overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#171717]">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white/70" />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                            <Mic className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold text-white">PDF Study Mode</h1>
                            <p className="text-xs text-white/50">{topic || 'Document Study'}</p>
                        </div>
                    </div>
                </div>

                {/* Connection Status */}
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isConnecting
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-white/10 text-white/50'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : isConnecting ? 'bg-amber-400 animate-pulse' : 'bg-white/30'
                            }`} />
                        {isConnected ? 'Live' : isConnecting ? 'Connecting...' : 'Disconnected'}
                    </div>
                </div>
            </header>

            {/* Main Content - Split Layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: PDF Viewer */}
                <motion.div
                    className="flex flex-col border-r border-white/10 bg-[#1a1a1a] overflow-hidden"
                    animate={{ width: isLeftPanelCollapsed ? 48 : '40%' }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                    {!isLeftPanelCollapsed ? (
                        <>
                            {/* PDF Header */}
                            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-white/50" />
                                    <span className="text-sm text-white/70 truncate max-w-[200px]">
                                        {activeSource?.name || 'Document'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setIsLeftPanelCollapsed(true)}
                                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4 text-white/50" />
                                </button>
                            </div>

                            {/* PDF Content */}
                            <div ref={pdfContainerRef} className="flex-1 overflow-auto bg-[#252525]">
                                {pdfBlobUrl ? (
                                    <iframe
                                        src={pdfBlobUrl}
                                        className="w-full h-full"
                                        title="PDF Document"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-white/50 p-8">
                                        <FileText className="w-12 h-12 mb-4 opacity-50" />
                                        <p className="text-sm text-center">No PDF loaded</p>
                                        <p className="text-xs text-center mt-1 text-white/30">
                                            Upload a PDF from the Sources panel
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsLeftPanelCollapsed(false)}
                            className="h-full flex items-center justify-center hover:bg-white/5 transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-white/50" />
                        </button>
                    )}
                </motion.div>

                {/* Right Panel: Notes + Canvas */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Automated Notes Panel */}
                    <div className="flex-shrink-0 h-[35%] border-b border-white/10 flex flex-col bg-gradient-to-br from-amber-900/20 to-orange-900/10">
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-medium text-white">Automated Notes & Insights</span>
                                <span className="text-xs text-white/40">({generatedNotes.length})</span>
                            </div>
                            {isProcessingNotes && (
                                <div className="flex items-center gap-2 text-xs text-amber-400">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Generating...
                                </div>
                            )}
                        </div>

                        {/* Notes List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {generatedNotes.length === 0 ? (
                                <div className="text-center text-white/40 py-8">
                                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Real-time notes will appear here</p>
                                    <p className="text-xs mt-1">Start speaking to generate insights</p>
                                </div>
                            ) : (
                                generatedNotes.map((note) => (
                                    <motion.div
                                        key={note.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3 rounded-lg text-sm"
                                        style={{ backgroundColor: NOTE_COLORS[note.type] + '30' }}
                                    >
                                        <div className="flex items-start gap-2">
                                            <span className="text-xs font-medium uppercase tracking-wide text-white/60">
                                                {note.type}
                                            </span>
                                        </div>
                                        <p className="text-white/80 mt-1">{note.content}</p>
                                        <span className="text-xs text-white/30 mt-2 block">
                                            {note.timestamp.toLocaleTimeString()}
                                        </span>
                                    </motion.div>
                                ))
                            )}
                            <div ref={notesEndRef} />
                        </div>
                    </div>

                    {/* Excalidraw Canvas */}
                    <div className="flex-1 relative overflow-hidden">
                        <ExcalidrawCanvas
                            ref={excalidrawRef}
                            embedded={true}
                            isOpen={true}
                            onClose={() => { }}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Audio Controls Bar */}
            <div className="flex-shrink-0 border-t border-white/10 bg-[#171717] px-4 py-3">
                <div className="flex items-center gap-3 max-w-4xl mx-auto">
                    {/* Mic Button */}
                    <button
                        onClick={handleVoiceToggle}
                        disabled={!apiKey || isConnecting}
                        className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${isConnected
                            ? 'bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/30'
                            : 'bg-white/10 hover:bg-white/20'
                            } ${(!apiKey || isConnecting) && 'opacity-50 cursor-not-allowed'}`}
                    >
                        {isConnecting ? (
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                        ) : isConnected ? (
                            <Mic className="w-5 h-5 text-white" />
                        ) : (
                            <MicOff className="w-5 h-5 text-white/70" />
                        )}
                        {isConnected && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
                        )}
                    </button>

                    {/* Text Input */}
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Speak or type to the AI..."
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-full text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-transparent"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-rose-500 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-rose-600 transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Additional Controls */}
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Toggle Sound">
                            <Volume2 className="w-5 h-5 text-white/50" />
                        </button>
                        <button
                            onClick={() => excalidrawRef.current?.addStickyNote({
                                id: `manual-${Date.now()}`,
                                text: 'New Note',
                                speaker: 'user',
                                isFinal: true
                            })}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Add Note"
                        >
                            <StickyNote className="w-5 h-5 text-white/50" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PdfStudyModeView;
