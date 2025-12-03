import type { HelpChannel, HelpRequest } from '../types/srlCoach';
import type { LucideIcon } from 'lucide-react';
import { LifeBuoy, SendHorizonal, UsersRound, Bot, CheckCircle2, AlertTriangle, Compass } from 'lucide-react';

interface HelpHubProps {
  requests: HelpRequest[];
  onRequestHelp: (channel: HelpChannel) => void;
  onResolve: (requestId: string) => void;
  onForecastSupport: () => void;
  isBusy?: boolean;
}

const CHANNEL_CONFIG: Record<HelpChannel, { label: string; description: string; icon: LucideIcon }> = {
  ai: {
    label: 'AI Hint',
    description: 'Get a scaffolded explanation or a gentle nudge from ChemCanvas.',
  icon: Bot as LucideIcon
  },
  community: {
    label: 'Community Forum',
    description: 'Ask peers and mentors in the moderated workspace.',
  icon: UsersRound as LucideIcon
  },
  tutor: {
    label: 'Tutor Session',
    description: 'Schedule a deeper dive with a live chemistry coach.',
  icon: LifeBuoy as LucideIcon
  }
};

const HelpHub = ({ requests, onRequestHelp, onResolve, onForecastSupport, isBusy }: HelpHubProps) => {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-900/10 p-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-200">Help-Seeking Hub</p>
          <h3 className="text-sm font-semibold text-rose-100">Ask for scaffolds without losing autonomy</h3>
        </div>
        <button
          type="button"
          onClick={onForecastSupport}
          className="inline-flex items-center gap-1 rounded-lg border border-rose-400/60 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-100 transition hover:bg-rose-500/20"
        >
          <Compass size={14} />
          Help Forecast
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(Object.keys(CHANNEL_CONFIG) as HelpChannel[]).map((channel) => {
          const config = CHANNEL_CONFIG[channel];
          const Icon = config.icon;
          return (
            <button
              key={channel}
              type="button"
              onClick={() => onRequestHelp(channel)}
              disabled={isBusy}
              className="flex h-full flex-col rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-left text-xs text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
            >
              <Icon size={18} className="mb-2 text-rose-200" />
              <span className="text-sm font-semibold text-rose-100">{config.label}</span>
              <span className="mt-1 text-rose-100/80">{config.description}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-rose-200/70">
                <SendHorizonal size={12} />
                Request support
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-200">
          <AlertTriangle size={14} />
          Support Timeline
        </div>
        {requests.length === 0 ? (
          <p className="mt-2 text-xs text-rose-100/80">
            No help requests yet. Reach out early to keep your study momentum protected.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-lg border border-rose-500/30 bg-rose-900/10 p-2 text-xs text-rose-100"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{CHANNEL_CONFIG[request.channel].label}</span>
                  <span className="text-[11px] text-rose-200/70">
                    {new Date(request.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-rose-100/80">{request.topic}</p>
                {request.summary ? <p className="mt-1 text-rose-100/70">{request.summary}</p> : null}
                {request.aiForecast ? (
                  <p className="mt-1 rounded border border-rose-500/30 bg-rose-500/10 p-1 text-[11px] text-rose-100/80">
                    Forecast: {request.aiForecast}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-rose-200/70">
                  <span>Status: {request.status}</span>
                  {request.status !== 'resolved' ? (
                    <button
                      type="button"
                      onClick={() => onResolve(request.id)}
                      className="inline-flex items-center gap-1 rounded border border-rose-400/60 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/20"
                    >
                      <CheckCircle2 size={12} />
                      Mark Resolved
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default HelpHub;
