
import React, { useState } from 'react';
import Header from './components/Header';
import AudioVisualizer from './components/AudioVisualizer';
import MessageList from './components/MessageList';
import KineticsSimulation from './components/KineticsSimulation';
import ChatInterface from './components/ChatInterface';
import { useGeminiLive } from './hooks/useGeminiLive';
import { ConnectionState } from './types';
import { Mic, PhoneOff, Loader2, BrainCircuit, Info, FlaskConical, MessageSquareText, Waves } from 'lucide-react';

type AppTab = 'VOICE' | 'TEXT';

const App: React.FC = () => {
  const { 
    connect, 
    disconnect, 
    connectionState, 
    transcripts, 
    analyser,
    simulationState,
    error 
  } = useGeminiLive();

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Tab Navigation (Mobile/Desktop) */}
        <div className="lg:col-span-12 flex justify-center mb-2">
           <div className="bg-slate-900/50 p-1 rounded-full border border-slate-800 inline-flex">
              <button 
                onClick={() => setActiveTab('VOICE')}
                className={`px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                   activeTab === 'VOICE' 
                   ? 'bg-slate-800 text-white shadow-lg shadow-black/20' 
                   : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                 <Waves size={16} /> Voice Tutor
              </button>
              <button 
                onClick={() => setActiveTab('TEXT')}
                className={`px-6 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                   activeTab === 'TEXT' 
                   ? 'bg-slate-800 text-white shadow-lg shadow-black/20' 
                   : 'text-slate-400 hover:text-slate-200'
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
              <div className="bg-slate-900/50 rounded-2xl p-6 md:p-8 border border-slate-800 backdrop-blur relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-molecule-teal/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10">
                  <h2 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
                    <BrainCircuit className="text-molecule-purple" />
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
                        flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-200 w-full sm:w-auto justify-center
                        ${isConnected 
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/50' 
                          : 'bg-gradient-to-r from-molecule-teal to-molecule-600 text-white hover:shadow-lg hover:shadow-molecule-teal/25'}
                        ${isConnecting ? 'opacity-70 cursor-wait' : ''}
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
                      <><FlaskConical className="w-4 h-4 text-molecule-purple"/> Kinetic Simulation</>
                    ) : (
                      "Voice Frequency Analysis"
                    )}
                  </h3>
                  {simulationState.isActive && (
                    <span className="text-xs text-molecule-teal animate-pulse">AI Controlled</span>
                  )}
                </div>
                
                {simulationState.isActive ? (
                  <KineticsSimulation params={simulationState.params} />
                ) : (
                  <AudioVisualizer analyser={analyser} isConnected={isConnected} isSpeaking={false} />
                )}
                
                {/* Tips Section */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-molecule-teal shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-slate-200 text-sm mb-1">Try the Simulation</h4>
                          <p className="text-xs text-slate-400">Ask: "Show me a simulation of reaction kinetics" or "Increase the temperature to see what happens to the rate."</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                      <div className="flex items-start gap-3">
                        <BrainCircuit className="w-5 h-5 text-molecule-purple shrink-0 mt-0.5" />
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
            <div className="lg:col-span-5 h-[500px] lg:h-auto bg-slate-900/30 rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                    Live Transcript
                  </h3>
              </div>
              <div className="flex-1 relative">
                <div className="absolute inset-0">
                  <MessageList transcripts={transcripts} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-12 h-[80vh]">
             <ChatInterface />
          </div>
        )}

      </main>
      
      <footer className="p-6 text-center text-slate-600 text-xs font-mono border-t border-slate-900">
         Powered by Google Gemini 2.5 & 3.0 • Web Audio API • React
      </footer>
    </div>
  );
};

export default App;
