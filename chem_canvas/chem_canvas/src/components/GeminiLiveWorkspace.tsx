import React, { useState } from 'react';
import { Mic, PhoneOff, Loader2, BrainCircuit, Info, FlaskConical, MessageSquareText, Waves, X } from 'lucide-react';
import GeminiLiveAudioVisualizer from './GeminiLive/GeminiLiveAudioVisualizer';
import GeminiLiveMessageList from './GeminiLive/GeminiLiveMessageList';
import GeminiLiveKineticsSimulation from './GeminiLive/GeminiLiveKineticsSimulation';
import GeminiLiveChatInterface from './GeminiLive/GeminiLiveChatInterface';
import GeminiLiveVisualization from './GeminiLive/GeminiLiveVisualization';
import { useGeminiLive as useGeminiLiveHook } from './GeminiLive/hooks/useGeminiLive';
import { ConnectionState } from './GeminiLive/types';

type AppTab = 'VOICE' | 'TEXT';

interface GeminiLiveWorkspaceProps {
    onClose: () => void;
    apiKey: string;
}

const GeminiLiveWorkspace: React.FC<GeminiLiveWorkspaceProps> = ({ onClose, apiKey }) => {
    const {
        connect,
        disconnect,
        connectionState,
        transcripts,
        analyser,
        simulationState,
        error
    } = useGeminiLiveHook(apiKey);

    const [activeTab, setActiveTab] = useState<AppTab>('VOICE');

    const isConnected = connectionState === ConnectionState.CONNECTED;
    const isConnecting = connectionState === ConnectionState.CONNECTING;

    const handleToggleConnection = () => {
        if (isConnected || isConnecting) {
            disconnect();
        } else {
            connect();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 font-sans animate-in fade-in duration-200"
             style={{
                 backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(34,211,238,0.08), transparent 32%), radial-gradient(circle at 80% 10%, rgba(168,85,247,0.10), transparent 30%)'
             }}
        >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-6 py-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-teal-600 shadow-lg shadow-emerald-500/30 ring-1 ring-white/10">
                        <Waves className="h-6 w-6 text-white drop-shadow" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white">Gemini Live Tutor</h1>
                        <p className="text-xs font-semibold text-slate-300/90">Realtime voice • Kinetics • Visuals</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold text-emerald-200 bg-emerald-500/10 border border-emerald-500/40 shadow-[0_0_18px_rgba(16,185,129,0.25)]">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live
                    </span>
                    <button
                        onClick={onClose}
                        className="rounded-xl p-2.5 text-slate-300 transition-all hover:text-white hover:bg-slate-800/80 border border-slate-800/80 shadow-inner shadow-black/30"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-hidden">
                <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-4 px-4 pb-6">

                    {/* Tab Navigation */}
                    <div className="lg:col-span-12 flex justify-center mb-2">
                        <div className="bg-slate-900/70 p-1.5 rounded-full border border-slate-800/80 inline-flex shadow-[0_10px_35px_rgba(0,0,0,0.35)] backdrop-blur">
                            <button
                                onClick={() => setActiveTab('VOICE')}
                                className={`px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${
                                    activeTab === 'VOICE'
                                        ? 'bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 text-white shadow-[0_12px_30px_rgba(34,211,238,0.25)]'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                                    }`}
                            >
                                <Waves size={16} /> Voice Tutor
                            </button>
                            <button
                                onClick={() => setActiveTab('TEXT')}
                                className={`px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${
                                    activeTab === 'TEXT'
                                        ? 'bg-gradient-to-r from-purple-500/80 to-blue-500/80 text-white shadow-[0_12px_30px_rgba(168,85,247,0.25)]'
                                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                                    }`}
                            >
                                <MessageSquareText size={16} /> Text & Visuals
                            </button>
                        </div>
                    </div>

                    {activeTab === 'VOICE' ? (
                        <>
                            {/* Left Panel: Controls & Visualizer */}
                            <div className="lg:col-span-7 flex flex-col gap-6">

                                {/* Hero Section / Status */}
                                <div className="bg-slate-900/70 rounded-3xl p-6 md:p-8 border border-slate-800/80 backdrop-blur relative overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
                                    {/* Background decoration */}
                                    <div className="absolute -top-28 -right-16 w-80 h-80 bg-emerald-500/12 rounded-full blur-3xl pointer-events-none"></div>
                                    <div className="absolute -bottom-32 -left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

                                    <div className="relative z-10">
                                        <h2 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2 text-white">
                                            <BrainCircuit className="text-emerald-400" />
                                            Interactive Voice Tutor
                                        </h2>
                                        <p className="text-slate-400 mb-6 max-w-lg">
                                            Discuss complex chemistry topics in real-time. The AI can launch simulations to demonstrate concepts like reaction rates and kinetics.
                                        </p>

                                        {error && (
                                            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg mb-4 text-sm">
                                                Error: {error}
                                            </div>
                                        )}

                                        <div className="flex flex-col sm:flex-row items-center gap-4">
                                            <button
                                                onClick={handleToggleConnection}
                                                disabled={isConnecting}
                                                className={`
                          flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold transition-all duration-200 w-full sm:w-auto justify-center ring-1 ring-white/10
                          ${isConnected
                                                        ? 'bg-gradient-to-r from-rose-600 to-red-500 text-white hover:shadow-[0_18px_36px_rgba(248,113,113,0.25)]'
                                                        : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white hover:shadow-[0_18px_36px_rgba(34,211,238,0.25)]'}
                          ${isConnecting ? 'opacity-70 cursor-wait' : 'hover:-translate-y-[1px]'}
                        `}
                                            >
                                                {isConnecting ? (
                                                    <><Loader2 className="w-5 h-5 animate-spin" /> Connecting...</>
                                                ) : isConnected ? (
                                                    <><PhoneOff className="w-5 h-5" /> End Session</>
                                                ) : (
                                                    <><Mic className="w-5 h-5" /> Start Tutoring Session</>
                                                )}
                                            </button>

                                            {isConnected && (
                                                <div className="flex items-center gap-2 text-emerald-400 text-sm font-mono animate-pulse">
                                                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                                                    Live Audio
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Audio Visualizer OR Simulation */}
                                <div className="flex-1 min-h-[350px] flex flex-col">
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <h3 className="text-sm font-mono text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                            {simulationState.isActive ? (
                                                <><FlaskConical className="w-4 h-4 text-emerald-400" /> Kinetic Simulation</>
                                            ) : (
                                                "Voice Frequency Analysis"
                                            )}
                                        </h3>
                                        {simulationState.isActive && (
                                            <span className="text-xs text-emerald-400 animate-pulse">AI Controlled</span>
                                        )}
                                    </div>

                                    {simulationState.isActive ? (
                                        <GeminiLiveKineticsSimulation params={simulationState.params} />
                                    ) : (
                                        <GeminiLiveAudioVisualizer analyser={analyser} isConnected={isConnected} isSpeaking={false} />
                                    )}

                                    {/* Tips Section */}
                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-xl shadow-inner shadow-black/30">
                                            <div className="flex items-start gap-3">
                                                <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="font-medium text-slate-200 text-sm mb-1">Try the Simulation</h4>
                                                    <p className="text-xs text-slate-400">Ask: "Show me a simulation of reaction kinetics" or "Increase the temperature to see what happens to the rate."</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-xl shadow-inner shadow-black/30">
                                            <div className="flex items-start gap-3">
                                                <BrainCircuit className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="font-medium text-slate-200 text-sm mb-1">Concepts</h4>
                                                    <p className="text-xs text-slate-400">Explore Activation Energy, Collision Theory, and Rate Laws through conversation.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Transcript */}
                            <div className="lg:col-span-5 h-[500px] lg:h-auto bg-slate-900/60 rounded-3xl border border-slate-800/80 flex flex-col overflow-hidden shadow-[0_22px_48px_rgba(0,0,0,0.45)]">
                                <div className="p-4 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                                        Live Transcript
                                    </h3>
                                    <span className="text-[11px] text-slate-400 font-mono">Auto-scrolling</span>
                                </div>
                                <div className="flex-1 relative">
                                    <div className="absolute inset-0">
                                        <GeminiLiveMessageList transcripts={transcripts} />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="col-span-12 h-[80vh]">
                            <GeminiLiveVisualization />
                        </div>
                    )}
                </div>
            </main>

            <footer className="p-6 text-center text-slate-600 text-xs font-mono border-t border-slate-900 bg-slate-950">
                Powered by Google Gemini 2.5 & 3.0 • Web Audio API • React
            </footer>
        </div>
    );
};

export default GeminiLiveWorkspace;
