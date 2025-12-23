import { useMemo, type FC, type ReactNode } from 'react';
import type { MonitoringCheckin, PlanNode } from '../types/srlCoach';
import {
  Activity,
  Flame,
  Zap,
  TrendingUp,
  CalendarClock,
  MessageCircle,
  BarChart3,
  Target,
  BellRing,
  AlertTriangle,
  CheckSquare,
  Clock4,
  LayoutDashboard,
  PieChart,
  ListTodo,
  Users
} from 'lucide-react';
import FrappeChart from './FrappeChart';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

interface MonitoringDashboardProps {
  momentumScore: number;
  phaseStreak: number;
  coachEnergy: number;
  experiencePoints: number;
  streakBonus: number;
  checkins: MonitoringCheckin[];
  progressTrend: number[];
  progressSummary: {
    totalMinutes: number;
    averageRating: number;
    completionRate: number;
    engagementScore: number;
  };
  engagementBreakdown: Array<{ label: string; value: string; delta: number }>;
  activeTasks: Array<{
    id: string;
    title: string;
    status: PlanNode['status'];
    eta: string;
    tool: string;
  }>;
  feedbackHighlights: string[];
  goalAlerts: Array<{
    id: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'critical';
    action?: string;
  }>;
  activityCalendar: Array<{ date: string; count: number; intensity: number }>;
  onRequestCheckin: () => void;
  onOpenInsights: () => void;
  isBusy?: boolean;
}

const severityStyles: Record<'info' | 'warning' | 'critical', { container: string; badge: string; icon: ReactNode }> = {
  info: {
    container: 'border-sky-400/40 bg-sky-500/10 text-sky-100',
    badge: 'bg-sky-500/20 text-sky-100 border-sky-400/40',
    icon: <BellRing size={16} className="text-sky-200" />
  },
  warning: {
    container: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
    badge: 'bg-amber-500/20 text-amber-100 border-amber-400/40',
    icon: <Target size={16} className="text-amber-200" />
  },
  critical: {
    container: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
    badge: 'bg-rose-500/20 text-rose-100 border-rose-400/40',
    icon: <AlertTriangle size={16} className="text-rose-200" />
  }
};

const statusStyles: Record<PlanNode['status'], { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'border-slate-500/40 bg-slate-800/60 text-slate-200'
  },
  'in-progress': {
    label: 'In Progress',
    className: 'border-amber-400/50 bg-amber-500/15 text-amber-100'
  },
  completed: {
    label: 'Completed',
    className: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
  }
};

const MonitoringDashboard: FC<MonitoringDashboardProps> = ({
  momentumScore,
  phaseStreak,
  coachEnergy,
  experiencePoints,
  streakBonus,
  checkins,
  progressTrend,
  progressSummary,
  engagementBreakdown,
  activeTasks,
  feedbackHighlights,
  goalAlerts,
  activityCalendar,
  onRequestCheckin,
  onOpenInsights,
  isBusy
}) => {
  const statusProgress: Record<PlanNode['status'], number> = {
    pending: 18,
    'in-progress': 62,
    completed: 100
  };
  const trendPoints = useMemo(() => {
    const base = progressTrend.length ? progressTrend : [35, 42, 38, 45, 48, 50, 53];
    const normalized = base.map((value) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return 0;
      }
      const clamped = Math.max(0, Math.min(100, value));
      return Number(clamped.toFixed(1));
    });
    if (normalized.length === 1) {
      return [...normalized, normalized[0]];
    }
    return normalized;
  }, [progressTrend]);

  const trendChartData = useMemo(() => ({
    labels: trendPoints.map((_, index) => `Session ${index + 1}`),
    datasets: [{
      name: 'Engagement',
      values: trendPoints,
      chartType: 'line' as const,
      color: '#38bdf8'
    }]
  }), [trendPoints]);

  const chartColors = useMemo(() => ['#38bdf8'], []);

  const axisOptions = useMemo(
    () => ({
      xAxisMode: 'tick',
      yAxisMode: 'span',
      xIsSeries: true
    }),
    []
  );

  const lineOptions = useMemo(
    () => ({
      regionFill: 1,
      heatline: 1,
      dotSize: 6,
      hideLine: 0,
      hideDots: 0
    }),
    []
  );

  const tooltipOptions = useMemo(
    () => ({
      formatTooltipX: (label: string) => label,
      formatTooltipY: (value: number) => `${Math.round(value)} engagement`
    }),
    []
  );

  const breakdownChartData = useMemo(() => {
    if (!engagementBreakdown.length) {
      return null;
    }
    const values = engagementBreakdown.map((item) => {
      const numeric = Number.parseFloat((item.value ?? '').toString().replace(/[^\d.-]/g, ''));
      if (!Number.isFinite(numeric) || numeric < 0) {
        return 0;
      }
      return Number(numeric.toFixed(2));
    });
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return null;
    }
    return {
      labels: engagementBreakdown.map((item) => item.label),
      datasets: [{
        name: 'Engagement mix',
        values
      }]
    };
  }, [engagementBreakdown]);

  const breakdownColors = useMemo(
    () => ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1'],
    []
  );

  const hasBreakdownData = Boolean(breakdownChartData);

  const liveSignal = useMemo(() => {
    const latest = trendPoints[trendPoints.length - 1] ?? 0;
    const previous = trendPoints[trendPoints.length - 2] ?? latest;
    const delta = Number((latest - previous).toFixed(1));
    return {
      latest: Number(latest.toFixed(1)),
      delta,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
    } as const;
  }, [trendPoints]);

  const lastCheckinSnapshot = useMemo(() => {
    if (!checkins.length) {
      return null;
    }
    const timestamp = checkins[0]?.createdAt;
    if (!timestamp) {
      return null;
    }
    const date = new Date(timestamp);
    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [checkins]);

  const latestCheckins = checkins.slice(0, 5);

  const intensityClass = (intensity: number) => {
    switch (intensity) {
      case 0:
        return 'bg-white/10 border-white/20';
      case 1:
        return 'bg-blue-400/40 border-white/30';
      case 2:
        return 'bg-blue-500/50 border-blue-200/40';
      case 3:
        return 'bg-indigo-500/60 border-indigo-300/50';
      case 4:
      default:
        return 'bg-indigo-600/70 border-indigo-400/60';
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
      <div className="flex h-screen flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 transition hover:bg-white/20">
              <LayoutDashboard size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">Fitness Mode Analytics</p>
              <h1 className="text-xl font-bold text-white">SRL self-monitoring dashboard</h1>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            {[{ icon: Activity, label: 'Overview' }, { icon: PieChart, label: 'Analytics' }, { icon: ListTodo, label: 'Tasks' }, { icon: MessageCircle, label: 'Check-ins' }].map(({ icon: Icon, label }, index) => (
              <button
                key={label}
                type="button"
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition hover:scale-110 ${index === 0 ? 'bg-blue-500/80 text-white shadow-lg' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
                aria-label={label}
              >
                <Icon size={18} />
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onRequestCheckin}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-full bg-blue-500/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-blue-400 hover:scale-105 disabled:opacity-60"
            >
              <CalendarClock size={16} />
              Log Check-in
            </button>
            <button
              type="button"
              onClick={onOpenInsights}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-400 hover:scale-105"
            >
              <TrendingUp size={16} />
              Weekly Insights
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="h-full p-6">
            <div className="flex h-full flex-col gap-6">
              <section className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Momentum', value: `${momentumScore}%`, icon: Flame, caption: `Streak ${phaseStreak}` },
                    { label: 'Energy', value: `${coachEnergy}%`, icon: Zap, caption: 'Coach vitality' },
                    { label: 'XP', value: experiencePoints, icon: BarChart3, caption: `Bonus ${streakBonus}%` },
                    { label: 'Minutes', value: progressSummary.totalMinutes, icon: Clock4, caption: `${progressSummary.averageRating} avg rating` }
                  ].map(({ label, value, icon: Icon, caption }) => (
                    <div key={label} className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/15 via-white/5 to-white/0 p-4 shadow-lg shadow-blue-900/30 backdrop-blur-xl transition-all hover:scale-105 hover:shadow-blue-900/50">
                      <div className="absolute -top-8 right-0 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
                      <div className="relative flex items-center justify-between text-white/80">
                        <span className="text-[10px] uppercase tracking-[0.3em]">{label}</span>
                        <Icon size={16} className="text-white" />
                      </div>
                      <p className="relative mt-2 text-2xl font-bold text-white">{value}</p>
                      <p className="relative text-[10px] text-white/70">{caption}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-blue-500/30 via-blue-400/20 to-indigo-500/20 p-6 shadow-xl shadow-blue-900/40 backdrop-blur-2xl transition-all hover:shadow-blue-900/60 xl:col-span-7">
                    <div className="absolute -top-24 right-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
                    <div className="relative">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Engagement overview</p>
                          <h4 className="text-lg font-semibold text-white">Session velocity</h4>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-black/30 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
                          <Users size={14} />
                          {checkins.length} sessions logged
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/20 bg-black/20 p-3">
                        <FrappeChart
                          data={trendChartData}
                          type="line"
                          colors={chartColors}
                          axisOptions={axisOptions}
                          lineOptions={lineOptions}
                          tooltipOptions={tooltipOptions}
                          height={220}
                          valuesOverPoints={1}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg shadow-blue-900/30 backdrop-blur-xl transition-all hover:shadow-blue-900/50 xl:col-span-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Engagement mix</p>
                        <h4 className="text-sm font-semibold text-white">Where your focus landed</h4>
                      </div>
                    </div>
                    {hasBreakdownData && breakdownChartData ? (
                      <div className="h-52">
                        <FrappeChart
                          data={breakdownChartData}
                          type="percentage"
                          colors={breakdownColors}
                          height={210}
                        />
                      </div>
                    ) : (
                      <div className="flex h-52 items-center justify-center">
                        <p className="text-sm text-white/70">Complete sessions to see breakdown</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg shadow-blue-900/30 backdrop-blur-xl xl:col-span-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Adaptive task lane</p>
                        <h4 className="text-sm font-semibold text-white">Next reps in your chemistry sprint</h4>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-wide text-white/60">
                        {activeTasks.length} active tasks
                      </span>
                    </div>
                    <div className="mt-5 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: '18rem' }}>
                      {activeTasks.length === 0 ? (
                        <p className="text-sm text-white/70">No checkpoints queued. Drop milestones in the planning lane to let the coach schedule your next moves.</p>
                      ) : (
                        activeTasks.map((task) => {
                          const status = statusStyles[task.status];
                          const progress = statusProgress[task.status];
                          return (
                            <div key={task.id} className="relative overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-white/20 via-white/10 to-white/0 p-4 text-xs text-white shadow-lg shadow-blue-900/30 transition-all hover:shadow-blue-900/50">
                              <div className="absolute -top-8 right-0 h-16 w-16 rounded-full bg-white/10 blur-2xl" />
                              <div className="relative flex items-start justify-between">
                                <span className="text-sm font-semibold text-white">{task.title}</span>
                                <span className={`rounded-full border px-2 py-[2px] text-[10px] uppercase tracking-wide ${status.className}`}>
                                  {status.label}
                                </span>
                              </div>
                              <div className="relative mt-3 flex items-center gap-3 text-[11px] text-white/70">
                                <span className="inline-flex items-center gap-1"><Clock4 size={12} /> {task.eta}</span>
                                <span className="inline-flex items-center gap-1"><CheckSquare size={12} /> {task.tool}</span>
                              </div>
                              <div className="mt-3 h-1 rounded-full bg-white/20">
                                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg shadow-blue-900/30 backdrop-blur-xl xl:col-span-5">
                    <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Activity heatmap</p>
                    {activityCalendar.length === 0 ? (
                      <p className="text-sm text-white/70">Log a few check-ins to reveal your cadence streak map.</p>
                    ) : (
                      <div>
                        <CalendarHeatmap
                          startDate={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)}
                          endDate={new Date()}
                          values={activityCalendar.map((day) => ({
                            date: day.date,
                            count: day.count
                          }))}
                          classForValue={(value) => {
                            if (!value || value.count === 0) {
                              return 'color-empty';
                            }
                            if (value.count === 1) {
                              return 'color-scale-1';
                            }
                            if (value.count === 2) {
                              return 'color-scale-2';
                            }
                            if (value.count === 3) {
                              return 'color-scale-3';
                            }
                            return 'color-scale-4';
                          }}
                          tooltipDataAttrs={(value) => {
                            if (!value || !value.date) {
                              return { 'data-tooltip': 'No activity' };
                            }
                            return {
                              'data-tooltip': `${value.date} • ${value.count} check-in${value.count === 1 ? '' : 's'}`
                            };
                          }}
                          showWeekdayLabels={true}
                        />
                        <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-wide text-white/60">
                          <span>Less</span>
                          <div className="flex gap-1">
                            {[0, 1, 2, 3, 4].map((level) => (
                              <span key={`legend-${level}`} className={`h-3 w-3 rounded-sm border ${intensityClass(level)}`} />
                            ))}
                          </div>
                          <span>More</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg shadow-blue-900/30 backdrop-blur-xl xl:col-span-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Coach snapshot</p>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white/80">Live index</p>
                        <p className="text-3xl font-bold text-white">{liveSignal.latest}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-[4px] text-xs font-semibold uppercase tracking-wide ${liveSignal.direction === 'up' ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100' : liveSignal.direction === 'down' ? 'border-rose-400/60 bg-rose-500/20 text-rose-100' : 'border-white/30 bg-white/10 text-white/80'}`}>
                        {liveSignal.direction === 'flat' ? 'steady' : `${liveSignal.direction === 'up' ? '+' : ''}${liveSignal.delta}`}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-white/60">vs previous session</p>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {[
                        { label: 'Minutes logged', value: `${progressSummary.totalMinutes}m` },
                        { label: 'Avg rating', value: `${progressSummary.averageRating}/5` },
                        { label: 'Completion', value: `${progressSummary.completionRate}%` },
                        { label: 'Engagement', value: `${progressSummary.engagementScore}` }
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/15 bg-black/20 p-3">
                          <p className="text-[10px] uppercase tracking-[0.25em] text-white/60">{label}</p>
                          <p className="mt-1 text-sm font-semibold text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-xl border border-white/15 bg-black/20 p-3 text-[11px] text-white/70">
                      <p className="uppercase tracking-[0.25em] text-white/60">Last update</p>
                      <p className="mt-1 text-sm text-white">{lastCheckinSnapshot ?? 'Awaiting activity'}</p>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg shadow-blue-900/30 backdrop-blur-xl xl:col-span-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Goal alignment alerts</p>
                        <h4 className="text-sm font-semibold text-white">AI watches your roadmap</h4>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] uppercase tracking-wide text-white/60">{goalAlerts.length} alert{goalAlerts.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {goalAlerts.length === 0 ? (
                        <p className="text-sm text-white/70">No drifts detected. Stay consistent and the coach will raise a flag when needed.</p>
                      ) : (
                        goalAlerts.map((alert) => {
                          const meta = severityStyles[alert.severity];
                          return (
                            <div key={alert.id} className={`rounded-2xl border p-3 text-xs ${meta.container}`}>
                              <div className="flex items-center justify-between gap-3 font-semibold">
                                <div className="flex items-center gap-2">
                                  {meta.icon}
                                  <span>{alert.title}</span>
                                </div>
                                <span className={`rounded-full border px-2 py-[2px] uppercase tracking-wide ${meta.badge}`}>
                                  {alert.severity}
                                </span>
                              </div>
                              <p className="mt-2 text-[11px] opacity-90">{alert.description}</p>
                              {alert.action ? (
                                <button
                                  type="button"
                                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 transition hover:bg-white/20"
                                  onClick={onOpenInsights}
                                >
                                  {alert.action}
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg shadow-blue-900/30 backdrop-blur-xl xl:col-span-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Personalized feedback</p>
                    <h4 className="mt-1 text-sm font-semibold text-white">Actionable nudges after each session</h4>
                    <ul className="mt-4 space-y-3 max-h-36 overflow-y-auto pr-1">
                      {feedbackHighlights.length === 0 ? (
                        <li className="text-sm text-white/70">Log a check-in or finish a milestone to surface targeted feedback.</li>
                      ) : (
                        feedbackHighlights.map((item, index) => (
                          <li
                            key={`${item}-${index}`}
                            className="rounded-xl border border-white/20 bg-white/10 p-3 text-xs text-white/80 transition hover:bg-white/20"
                          >
                            {item}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-12">
                  <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-6 shadow-lg shadow-blue-900/30 backdrop-blur-xl xl:col-span-12">
                    <div className="mb-4 flex items-center gap-2">
                      <MessageCircle size={16} className="text-white/70" />
                      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Recent check-ins</span>
                    </div>
                    {latestCheckins.length === 0 ? (
                      <p className="text-sm text-white/70">No monitoring entries yet. Log a quick check-in to unlock personalized nudges.</p>
                    ) : (
                      <ul className="space-y-3 max-h-56 overflow-y-auto pr-1">
                        {latestCheckins.map((entry) => (
                          <li
                            key={entry.id}
                            className="rounded-xl border border-white/20 bg-white/10 p-4 text-xs text-white/80 transition hover:bg-white/20"
                          >
                            <div className="flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold text-white">{entry.note || 'Quick check-in'}</span>
                                <span className={`rounded-full px-2 py-[2px] text-[10px] uppercase tracking-wide ${entry.rating >= 4 ? 'bg-emerald-500/20 text-emerald-300' : entry.rating >= 3 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>
                                  {entry.rating}/5
                                </span>
                              </div>
                              {entry.note ? <p className="text-white/60">{entry.note}</p> : null}
                              {entry.aiNudge ? (
                                <p className="rounded-lg border border-white/20 bg-white/10 p-2 text-[11px] text-white">
                                  Coach Nudge: {entry.aiNudge}
                                </p>
                              ) : null}
                            </div>
                            <span className="mt-2 block text-[11px] text-white/50">
                              {new Date(entry.createdAt).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MonitoringDashboard;
