import React, { useMemo, useState, useRef } from 'react';
import dayjs from 'dayjs';
import { AnimatePresence, motion, useInView } from 'motion/react';
import {
  Bell,
  BookOpen,
  Calendar,
  ClipboardList,
  GraduationCap,
  Layers,
} from 'lucide-react';
import type { StudyTimelineItem, StudyTimelineItemType } from '../types/studyTimeline';

interface StudyTimelineProps {
  items: StudyTimelineItem[];
  summary?: string | null;
  notice?: string | null;
}

const ALL_TYPES: StudyTimelineItemType[] = ['lecture', 'reading', 'assignment', 'exam'];
const DEFAULT_REMINDERS = [7, 3, 1];

const TYPE_STYLES: Record<
  StudyTimelineItemType,
  {
    label: string;
    accent: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  lecture: {
    label: 'Lecture',
    accent: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-700',
    icon: BookOpen,
  },
  reading: {
    label: 'Reading',
    accent: 'bg-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700',
    icon: Layers,
  },
  assignment: {
    label: 'Assignment',
    accent: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    icon: ClipboardList,
  },
  exam: {
    label: 'Exam',
    accent: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700',
    icon: GraduationCap,
  },
};

const STATUS_LABELS: Record<string, { label: string; badge: string }> = {
  planned: { label: 'Planned', badge: 'bg-slate-100 text-slate-600' },
  'in-progress': { label: 'In Progress', badge: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', badge: 'bg-emerald-100 text-emerald-700' },
};

const getItemDate = (item: StudyTimelineItem) => item.startDate || item.date;

const formatDateRange = (item: StudyTimelineItem) => {
  const start = dayjs(item.startDate || item.date);
  const end = dayjs(item.endDate || item.date);
  if (item.startDate && item.endDate && !start.isSame(end, 'day')) {
    return `${start.format('MMM D')} - ${end.format('MMM D')}`;
  }
  return start.format('MMM D, YYYY');
};

const getWeekLabel = (date: dayjs.Dayjs) => `Week of ${date.format('MMM D')}`;

const TimelineCard: React.FC<{ item: StudyTimelineItem; index: number }> = ({ item, index }) => {
  const ref = useRef<HTMLLIElement | null>(null);
  const isInView = useInView(ref, { margin: '-15% 0px', once: true });
  const style = TYPE_STYLES[item.type];
  const statusTag = item.status ? STATUS_LABELS[item.status] : undefined;
  const reminderDays = item.reminders?.length ? item.reminders : DEFAULT_REMINDERS;
  const Icon = style.icon;

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.4, delay: index * 0.03 }}
      className="relative"
    >
      <span className={`absolute -left-[34px] top-6 h-3 w-3 rounded-full ${style.accent}`} />
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${style.badge}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{formatDateRange(item)}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2 py-1 font-semibold ${style.badge}`}>{style.label}</span>
            {statusTag ? (
              <span className={`rounded-full px-2 py-1 font-semibold ${statusTag.badge}`}>
                {statusTag.label}
              </span>
            ) : null}
          </div>
        </div>
        {item.description ? (
          <p className="mt-3 text-sm text-slate-600">{item.description}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {item.estimateHours ? (
            <span className="rounded-full border border-slate-200 px-2 py-1">
              ~{item.estimateHours}h focus
            </span>
          ) : null}
          {item.studyTime ? (
            <span className="rounded-full border border-slate-200 px-2 py-1">{item.studyTime}</span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Bell className="h-3 w-3" />
            Reminders
          </span>
          {reminderDays.map((day) => (
            <span key={`${item.id}-${day}`} className="rounded-full border border-slate-200 px-2 py-1">
              {day}d before
            </span>
          ))}
        </div>
      </div>
    </motion.li>
  );
};

const StudyTimeline: React.FC<StudyTimelineProps> = ({ items, summary, notice }) => {
  const [activeTypes, setActiveTypes] = useState<StudyTimelineItemType[]>(ALL_TYPES);
  const [onlyThisWeek, setOnlyThisWeek] = useState(false);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aTime = dayjs(getItemDate(a)).valueOf();
      const bTime = dayjs(getItemDate(b)).valueOf();
      return aTime - bTime;
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    const now = dayjs();
    const weekStart = now.startOf('week');
    const weekEnd = now.endOf('week');
    return sortedItems.filter((item) => {
      if (!activeTypes.includes(item.type)) return false;
      if (!onlyThisWeek) return true;
      const itemDate = dayjs(getItemDate(item));
      return itemDate.isAfter(weekStart.subtract(1, 'day')) && itemDate.isBefore(weekEnd.add(1, 'day'));
    });
  }, [sortedItems, activeTypes, onlyThisWeek]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, { label: string; weekStart: dayjs.Dayjs; items: StudyTimelineItem[] }>();
    filteredItems.forEach((item) => {
      const weekStart = dayjs(getItemDate(item)).startOf('week');
      const key = weekStart.format('YYYY-MM-DD');
      if (!groups.has(key)) {
        groups.set(key, { label: getWeekLabel(weekStart), weekStart, items: [] });
      }
      groups.get(key)?.items.push(item);
    });
    return Array.from(groups.values()).sort((a, b) => a.weekStart.valueOf() - b.weekStart.valueOf());
  }, [filteredItems]);

  const nextMilestone = useMemo(() => {
    const today = dayjs().startOf('day');
    return sortedItems.find((item) => dayjs(getItemDate(item)).isAfter(today.subtract(1, 'day')));
  }, [sortedItems]);

  const counts = useMemo(() => {
    return ALL_TYPES.reduce((acc, type) => {
      acc[type] = items.filter((item) => item.type === type).length;
      return acc;
    }, {} as Record<StudyTimelineItemType, number>);
  }, [items]);

  const toggleType = (type: StudyTimelineItemType) => {
    setActiveTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((item) => item !== type);
      }
      return [...prev, type];
    });
  };

  const toggleAll = () => {
    setActiveTypes((prev) => (prev.length === ALL_TYPES.length ? [] : ALL_TYPES));
  };

  return (
    <div className="min-h-full bg-[#f6f8fc] px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Study Timeline</p>
            <h2 className="text-2xl font-semibold text-slate-900">Weekly plan and reminders</h2>
            <p className="text-sm text-slate-500">
              {summary || 'A paced schedule with checkpoints, review loops, and reminder nudges.'}
            </p>
          </div>
          {notice ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              {notice}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Milestone</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {nextMilestone ? nextMilestone.title : 'No upcoming items'}
              </p>
              <p className="text-xs text-slate-500">
                {nextMilestone ? formatDateRange(nextMilestone) : 'Add a target date to extend the plan.'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sessions</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{items.length}</p>
              <p className="text-xs text-slate-500">Across lectures, readings, and assessments.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assessments</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {counts.exam + counts.assignment}
              </p>
              <p className="text-xs text-slate-500">Exams and assignments tracked.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              {activeTypes.length === ALL_TYPES.length ? 'Clear filters' : 'Show all'}
            </button>
            {ALL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  activeTypes.includes(type)
                    ? TYPE_STYLES[type].badge
                    : 'border-slate-200 text-slate-400 hover:text-slate-600'
                }`}
              >
                {TYPE_STYLES[type].label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOnlyThisWeek((prev) => !prev)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                onlyThisWeek ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-200 text-slate-500'
              }`}
            >
              This week
            </button>
          </div>
        </div>

        {groupedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No timeline items match the current filters. Toggle a few items back on to see the schedule.
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <ol className="relative border-l border-slate-200 pl-6">
              <AnimatePresence initial={false}>
                {groupedItems.map((group) => (
                  <motion.li key={group.label} layout className="mb-8 last:mb-0">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      {group.label}
                    </div>
                    <ol className="space-y-4">
                      <AnimatePresence initial={false}>
                        {group.items.map((item, index) => (
                          <TimelineCard key={item.id} item={item} index={index} />
                        ))}
                      </AnimatePresence>
                    </ol>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyTimeline;
