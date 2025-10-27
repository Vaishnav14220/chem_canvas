import type { FC } from 'react';
import type { MonitoringCheckin } from '../types/srlCoach';
import { Activity, Flame, Zap, TrendingUp, CalendarClock, MessageCircle } from 'lucide-react';

interface MonitoringDashboardProps {
  momentumScore: number;
  phaseStreak: number;
  coachEnergy: number;
  experiencePoints: number;
  streakBonus: number;
  checkins: MonitoringCheckin[];
  onRequestCheckin: () => void;
  onOpenInsights: () => void;
  isBusy?: boolean;
}

const MonitoringDashboard: FC<MonitoringDashboardProps> = ({
  momentumScore,
  phaseStreak,
  coachEnergy,
  experiencePoints,
  streakBonus,
  checkins,
  onRequestCheckin,
  onOpenInsights,
  isBusy
}) => {
  const latestCheckins = checkins.slice(0, 5);

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/10 p-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Momentum Monitor</p>
          <h3 className="text-sm font-semibold text-emerald-100">Stay on track with adaptive nudges</h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRequestCheckin}
            disabled={isBusy}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <CalendarClock size={14} />
            Log Check-in
          </button>
          <button
            type="button"
            onClick={onOpenInsights}
            className="inline-flex items-center gap-1 rounded-lg border border-teal-400/60 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-teal-100 transition hover:bg-teal-500/20"
          >
            <TrendingUp size={14} />
            Weekly Insights
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs text-emerald-100">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-200">
            <Activity size={16} />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-100">{momentumScore}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-200/80">Momentum</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs text-emerald-100">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-200">
            <Flame size={16} />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-100">{phaseStreak}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-200/80">Phase Streak</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs text-emerald-100">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-200">
            <Zap size={16} />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-100">{coachEnergy}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-200/80">Energy</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs text-emerald-100">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-200">
            <TrendingUp size={16} />
          </div>
          <p className="mt-2 text-xl font-bold text-emerald-100">{experiencePoints} XP</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-200/80">Streak Bonus {streakBonus}%</p>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-200">
          <MessageCircle size={14} />
          Recent Check-ins
        </div>
        {latestCheckins.length === 0 ? (
          <p className="mt-2 text-xs text-emerald-100/70">
            No monitoring entries yet. Log a quick check-in to unlock personalized nudges.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {latestCheckins.map((entry: MonitoringCheckin) => (
              <li
                key={entry.id}
                className="rounded-lg border border-emerald-500/30 bg-emerald-900/10 p-2 text-xs text-emerald-100"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{entry.focus || 'General progress'}</span>
                  <span className="text-[11px] text-emerald-200/70">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-emerald-100/80">
                  Rating {entry.rating}/5{entry.confidence ? ` | Confidence ${entry.confidence}/5` : ''}
                </p>
                {entry.note ? <p className="mt-1 text-emerald-100/70">{entry.note}</p> : null}
                {entry.aiNudge ? (
                  <p className="mt-1 rounded border border-emerald-500/30 bg-emerald-500/10 p-1 text-[11px] text-emerald-100/80">
                    Coach Nudge: {entry.aiNudge}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MonitoringDashboard;




