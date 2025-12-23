import React from 'react';
import { Loader2, Mic, RefreshCw, Sparkles, Video } from 'lucide-react';
import { ConnectionState } from './GeminiLive/types';

export type FeynmanGuide = {
  topic: string;
  openingPrompt: string;
  drawPrompt: string;
  followUps: string[];
  listenFor: string[];
  nextChallenge: string;
};

interface FeynmanCoachPanelProps {
  topic: string;
  onTopicChange: (value: string) => void;
  guide: FeynmanGuide | null;
  isLoading: boolean;
  error?: string | null;
  onGenerateGuide: () => void;
  connectionState: ConnectionState;
  isListening: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  onShareSnapshot: () => void;
}

const StatusPill: React.FC<{ label: string; active?: boolean }> = ({ label, active }) => (
  <span
    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ${
      active
        ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/40'
        : 'bg-slate-800/60 text-slate-400 border border-slate-700/60'
    }`}
  >
    <span
      className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}
    />
    {label}
  </span>
);

const FeynmanCoachPanel: React.FC<FeynmanCoachPanelProps> = ({
  topic,
  onTopicChange,
  guide,
  isLoading,
  error,
  onGenerateGuide,
  connectionState,
  isListening,
  isSpeaking,
  isScreenSharing,
  onConnect,
  onDisconnect,
  onStartScreenShare,
  onStopScreenShare,
  onShareSnapshot
}) => {
  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-50 w-full max-w-[420px] border-l border-cyan-500/20 bg-[#0b0f17]/95 shadow-[0_0_40px_rgba(8,145,178,0.2)] backdrop-blur-xl"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(14,165,233,0.15), transparent 45%), radial-gradient(circle at 90% 20%, rgba(16,185,129,0.12), transparent 40%)'
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-emerald-400 shadow-lg shadow-cyan-500/30">
              <Mic className="h-5 w-5 text-slate-900" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Feynman Mode</h3>
              <p className="text-[11px] text-slate-400">Teach the student. The student asks back.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Live</span>
            <StatusPill label={isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Offline'} active={isConnected} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-100">Session Controls</h4>
              <div className="flex items-center gap-2">
                <StatusPill label="Listening" active={isListening} />
                <StatusPill label="Speaking" active={isSpeaking} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onConnect}
                disabled={isConnected || isConnecting}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-60"
              >
                {isConnecting ? 'Connecting...' : 'Start Audio'}
              </button>
              <button
                onClick={onDisconnect}
                disabled={!isConnected && !isConnecting}
                className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-60"
              >
                End Session
              </button>
              <button
                onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                className="rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25"
              >
                {isScreenSharing ? 'Stop Screen' : 'Share Screen'}
              </button>
              <button
                onClick={onShareSnapshot}
                className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Share Snapshot
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill label="Canvas Feed" active={isScreenSharing} />
              <StatusPill label="Mic Live" active={isListening} />
              <StatusPill label="Student Voice" active={isSpeaking} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-100">Topic</h4>
              <button
                onClick={onGenerateGuide}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-800/70 px-3 py-1 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700/80 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Coach Script
              </button>
            </div>
            <textarea
              value={topic}
              onChange={(event) => onTopicChange(event.target.value)}
              placeholder="What are you teaching today? (e.g., redox reactions, entropy, orbital hybridization)"
              className="w-full min-h-[110px] rounded-xl border border-slate-700/70 bg-slate-950/60 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
            />
            {error && (
              <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                {error}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-inner shadow-black/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-100">Coach Prompts</h4>
              <button
                onClick={onGenerateGuide}
                disabled={isLoading}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
            {isLoading && (
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                Generating a fresh teaching script...
              </div>
            )}
            {!isLoading && !guide && (
              <div className="text-xs text-slate-400">
                Generate a coach script to get tailored prompts, drawing cues, and gap checks.
              </div>
            )}
            {guide && !isLoading && (
              <div className="space-y-4 text-xs text-slate-200">
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-cyan-300 mb-1">Opening Prompt</div>
                  <p>{guide.openingPrompt}</p>
                </div>
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-300 mb-1">Draw Prompt</div>
                  <p>{guide.drawPrompt}</p>
                </div>
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-sky-300 mb-2">Follow Ups</div>
                  <ul className="space-y-1">
                    {guide.followUps.map((item, idx) => (
                      <li key={`follow-${idx}`} className="flex gap-2">
                        <span className="text-cyan-300">-</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-amber-300 mb-2">Listen For Gaps</div>
                  <ul className="space-y-1">
                    {guide.listenFor.map((item, idx) => (
                      <li key={`gap-${idx}`} className="flex gap-2">
                        <span className="text-amber-300">-</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-purple-300 mb-1">Next Challenge</div>
                  <p>{guide.nextChallenge}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-900/80 p-4 shadow-inner shadow-black/30">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-200">
              <Video className="h-4 w-4 text-cyan-300" />
              Real-time canvas coaching
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Keep the canvas visible while you explain. The student listens to your voice and watches the screen share for diagrams and labels.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeynmanCoachPanel;
