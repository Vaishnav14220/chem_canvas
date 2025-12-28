import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flag,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings2,
  Table2,
  Tag,
  Trash2
} from 'lucide-react';
import AdaptivePlan from './AdaptivePlan';
import type { PlanNode } from '../types/srlCoach';

type PlannerTaskStatus = 'todo' | 'in-progress' | 'done';
type PlannerPriority = 'low' | 'medium' | 'high';
type PlannerView = 'list' | 'board' | 'table';
type PlannerSection = 'docs' | 'journals' | 'collections' | 'tags';

type PlannerTask = {
  id: string;
  title: string;
  description?: string;
  status: PlannerTaskStatus;
  priority: PlannerPriority;
  dueDate?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source?: 'manual' | 'plan';
  sourceId?: string;
};

type PlannerCollection = {
  id: string;
  name: string;
  filterStatus: 'all' | PlannerTaskStatus;
  tag?: string;
};

type PlannerStore = {
  tasks: PlannerTask[];
  journals: Record<string, string>;
  collections: PlannerCollection[];
};

const STORAGE_KEY = 'chemcanvas-planner-v2';
const LEGACY_STORAGE_KEY = 'chemcanvas-planner-v1';

const priorityStyles: Record<PlannerPriority, string> = {
  low: 'bg-slate-800 text-slate-300 border-slate-700',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  high: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
};

const statusLabel: Record<PlannerTaskStatus, string> = {
  todo: 'Todo',
  'in-progress': 'In progress',
  done: 'Done'
};

const viewOptions: Array<{ id: PlannerView; label: string; icon: typeof List }> = [
  { id: 'list', label: 'List', icon: List },
  { id: 'board', label: 'Board', icon: LayoutGrid },
  { id: 'table', label: 'Table', icon: Table2 }
];

const sectionOptions: Array<{ id: PlannerSection; label: string }> = [
  { id: 'docs', label: 'Docs' },
  { id: 'journals', label: 'Journals' },
  { id: 'collections', label: 'Collections' },
  { id: 'tags', label: 'Tags' }
];

const startOfWeek = (date: Date) => {
  const value = new Date(date);
  const day = value.getDay();
  value.setDate(value.getDate() - day);
  value.setHours(0, 0, 0, 0);
  return value;
};

const formatDateKey = (date: Date) => date.toISOString().split('T')[0];

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const normalizeTags = (value: string) =>
  value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

interface PlannerTabProps {
  initialTopic?: string;
  variant?: 'full' | 'panel';
}

const PlannerTab: React.FC<PlannerTabProps> = ({ initialTopic = '', variant = 'full' }) => {
  const isPanel = variant === 'panel';
  const [section, setSection] = useState<PlannerSection>('docs');
  const [viewMode, setViewMode] = useState<PlannerView>('list');
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [journals, setJournals] = useState<Record<string, string>>({});
  const [collections, setCollections] = useState<PlannerCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | PlannerTaskStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [showPlanPanel, setShowPlanPanel] = useState(true);
  const [displayColumns, setDisplayColumns] = useState({
    description: true,
    priority: true,
    status: true,
    dueDate: true,
    tags: true,
    updatedAt: true
  });

  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemDueDate, setNewItemDueDate] = useState('');
  const [newItemPriority, setNewItemPriority] = useState<PlannerPriority>('medium');
  const [newItemStatus, setNewItemStatus] = useState<PlannerTaskStatus>('todo');
  const [newItemTags, setNewItemTags] = useState('');

  const [journalWeekStart, setJournalWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedJournalDate, setSelectedJournalDate] = useState(() => formatDateKey(new Date()));

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as PlannerStore;
      setTasks(Array.isArray(parsed.tasks) ? parsed.tasks : []);
      setJournals(parsed.journals && typeof parsed.journals === 'object' ? parsed.journals : {});
      setCollections(Array.isArray(parsed.collections) ? parsed.collections : []);
    } catch (error) {
      console.warn('[PlannerTab] Failed to restore planner data:', error);
    }
  }, []);

  useEffect(() => {
    const payload: PlannerStore = { tasks, journals, collections };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[PlannerTab] Failed to persist planner data:', error);
    }
  }, [tasks, journals, collections]);

  const taskSummary = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(task => task.status === 'done').length;
    const inProgress = tasks.filter(task => task.status === 'in-progress').length;
    return { total, done, inProgress };
  }, [tasks]);

  const tagsSummary = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach(task => {
      task.tags.forEach(tag => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [tasks]);

  const activeCollection = useMemo(
    () => collections.find(collection => collection.id === activeCollectionId) ?? null,
    [collections, activeCollectionId]
  );

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const effectiveStatus = activeCollection?.filterStatus ?? filterStatus;
    const effectiveTag = activeCollection?.tag ?? activeTag;

    return tasks.filter(task => {
      if (effectiveStatus !== 'all' && task.status !== effectiveStatus) return false;
      if (effectiveTag && !task.tags.includes(effectiveTag)) return false;
      if (!normalizedSearch) return true;
      return (
        task.title.toLowerCase().includes(normalizedSearch) ||
        (task.description ?? '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [tasks, filterStatus, searchTerm, activeCollection, activeTag]);

  const groupedTasks = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    const today: PlannerTask[] = [];
    const upcoming: PlannerTask[] = [];
    const noDate: PlannerTask[] = [];

    filteredTasks.forEach(task => {
      if (!task.dueDate) {
        noDate.push(task);
        return;
      }
      if (task.dueDate === todayKey) {
        today.push(task);
        return;
      }
      if (task.dueDate > todayKey) {
        upcoming.push(task);
        return;
      }
      noDate.push(task);
    });

    return [
      { id: 'today', label: 'Today', tasks: today },
      { id: 'upcoming', label: 'Upcoming', tasks: upcoming },
      { id: 'nodate', label: 'No due date', tasks: noDate }
    ];
  }, [filteredTasks]);

  const handleAddTask = useCallback(() => {
    const title = newItemTitle.trim();
    if (!title) return;

    const now = new Date().toISOString();
    const task: PlannerTask = {
      id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      description: newItemDescription.trim() || undefined,
      status: newItemStatus,
      priority: newItemPriority,
      dueDate: newItemDueDate || undefined,
      tags: normalizeTags(newItemTags),
      createdAt: now,
      updatedAt: now,
      source: 'manual'
    };

    setTasks(prev => [task, ...prev]);
    setNewItemTitle('');
    setNewItemDescription('');
    setNewItemDueDate('');
    setNewItemPriority('medium');
    setNewItemStatus('todo');
    setNewItemTags('');
    setShowNewItem(false);
  }, [newItemTitle, newItemDescription, newItemStatus, newItemPriority, newItemDueDate, newItemTags]);

  const updateTask = useCallback((taskId: string, updates: Partial<PlannerTask>) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? { ...task, ...updates, updatedAt: new Date().toISOString() }
          : task
      )
    );
  }, []);

  const handleToggleDone = useCallback((taskId: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? { ...task, status: task.status === 'done' ? 'todo' : 'done', updatedAt: new Date().toISOString() }
          : task
      )
    );
  }, []);

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    setSelectedIds(prev => prev.filter(id => id !== taskId));
  }, []);

  const handleToggleSelection = useCallback((taskId: string) => {
    setSelectedIds(prev => (prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]));
  }, []);

  const handleSelectGroup = useCallback((taskIds: string[]) => {
    setSelectedIds(prev => Array.from(new Set([...prev, ...taskIds])));
  }, []);

  const handlePlanGenerated = useCallback((nodes: PlanNode[]) => {
    if (!nodes.length) return;

    setTasks(prev => {
      const existingPlanIds = new Set(prev.filter(task => task.source === 'plan').map(task => task.sourceId));
      const newTasks = nodes
        .filter(node => !existingPlanIds.has(node.id))
        .map(node => ({
          id: `plan-${node.id}`,
          title: node.title,
          description: node.description,
          status: node.status === 'completed' ? 'done' : node.status === 'in-progress' ? 'in-progress' : 'todo',
          priority: 'medium',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'plan' as const,
          sourceId: node.id
        }));
      return [...newTasks, ...prev];
    });
  }, []);

  const handleCreateCollection = useCallback(() => {
    const name = prompt('Collection name');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const newCollection: PlannerCollection = {
      id: `collection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      filterStatus: filterStatus
    };
    setCollections(prev => [newCollection, ...prev]);
  }, [filterStatus]);

  const handlePickCollection = useCallback((collectionId: string) => {
    setActiveCollectionId(collectionId);
    setSection('docs');
  }, []);

  const journalWeekDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(journalWeekStart);
      date.setDate(journalWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [journalWeekStart]);

  const selectedJournalEntry = journals[selectedJournalDate] ?? '';

  return (
    <div className="flex-1 bg-[#0b1120] text-slate-100">
      <div
        className={`flex w-full flex-col gap-4 ${isPanel ? 'px-3 py-3' : 'mx-auto max-w-screen-2xl px-4 py-4 lg:px-6'}`}
      >
        {!isPanel && (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Planner</h2>
              <p className="text-xs text-slate-400">
                AFFiNE-style planning workspace with docs, journals, collections, and tags.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-slate-200">
                {taskSummary.done}/{taskSummary.total} done
              </span>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-200">
                {taskSummary.inProgress} active
              </span>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
            {sectionOptions.map(option => (
              <button
                key={option.id}
                onClick={() => setSection(option.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${section === option.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {option.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowPlanPanel(prev => !prev)}
                className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 hover:border-emerald-400/60"
              >
                {showPlanPanel ? 'Hide AI plan' : 'Show AI plan'}
              </button>
            </div>
          </div>

          {section === 'docs' && (
            <div className={`grid gap-4 ${showPlanPanel ? 'lg:grid-cols-[minmax(0,1fr)_420px]' : 'grid-cols-1'}`}>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {viewOptions.map(option => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setViewMode(option.id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${viewMode === option.id
                            ? 'border-slate-500 bg-slate-800 text-slate-100'
                            : 'border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative ml-auto flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowDisplayMenu(prev => !prev)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Display
                      </button>
                      {showDisplayMenu && (
                        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs shadow-xl">
                          {Object.entries(displayColumns).map(([key, value]) => (
                            <label key={key} className="flex items-center justify-between gap-2 py-1 text-slate-200">
                              <span className="capitalize">{key}</span>
                              <input
                                type="checkbox"
                                checked={value}
                                onChange={() =>
                                  setDisplayColumns(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setShowFilterMenu(prev => !prev)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-slate-500"
                      >
                        <Filter className="h-3.5 w-3.5" />
                        {activeCollection?.name ?? activeTag ?? (filterStatus === 'all' ? 'All' : statusLabel[filterStatus])}
                      </button>
                      {showFilterMenu && (
                        <div className="absolute right-0 mt-2 w-40 rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs shadow-xl">
                          {(['all', 'todo', 'in-progress', 'done'] as const).map(status => (
                            <button
                              key={status}
                              onClick={() => {
                                setFilterStatus(status);
                                setActiveCollectionId(null);
                                setActiveTag(null);
                                setShowFilterMenu(false);
                              }}
                              className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${filterStatus === status
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                              <span>{status === 'all' ? 'All' : statusLabel[status]}</span>
                              {filterStatus === status && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setShowNewItem(prev => !prev)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New doc
                    </button>

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search"
                        className="h-8 w-40 rounded-full border border-slate-700 bg-slate-900/80 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {showNewItem && (
                  <div className="border-b border-slate-800 px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
                      <input
                        value={newItemTitle}
                        onChange={(event) => setNewItemTitle(event.target.value)}
                        placeholder="Title"
                        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        value={newItemDescription}
                        onChange={(event) => setNewItemDescription(event.target.value)}
                        placeholder="Description"
                        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="date"
                        value={newItemDueDate}
                        onChange={(event) => setNewItemDueDate(event.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200"
                      />
                      <input
                        value={newItemTags}
                        onChange={(event) => setNewItemTags(event.target.value)}
                        placeholder="Tags (comma separated)"
                        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200"
                      />
                      <select
                        value={newItemPriority}
                        onChange={(event) => setNewItemPriority(event.target.value as PlannerPriority)}
                        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200"
                      >
                        <option value="low">Low priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="high">High priority</option>
                      </select>
                      <select
                        value={newItemStatus}
                        onChange={(event) => setNewItemStatus(event.target.value as PlannerTaskStatus)}
                        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200"
                      >
                        <option value="todo">Todo</option>
                        <option value="in-progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={handleAddTask}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create doc
                      </button>
                      <button
                        onClick={() => setShowNewItem(false)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="px-4 py-3">
                  {viewMode === 'list' && (
                    <div className="flex flex-col gap-4">
                      {groupedTasks.map(group => (
                        <div key={group.id} className="rounded-xl border border-slate-800 bg-slate-950/40">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300">
                            <span>{group.label}</span>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>{group.tasks.length}</span>
                              {group.tasks.length > 0 && (
                                <button
                                  onClick={() => handleSelectGroup(group.tasks.map(task => task.id))}
                                  className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] hover:text-slate-200"
                                >
                                  Select all
                                </button>
                              )}
                            </div>
                          </div>
                          {group.tasks.length === 0 ? (
                            <div className="px-3 py-6 text-center text-xs text-slate-500">
                              Nothing here yet.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-800">
                              {group.tasks.map(task => (
                                <div key={task.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(task.id)}
                                    onChange={() => handleToggleSelection(task.id)}
                                    className="h-4 w-4 accent-emerald-500"
                                  />
                                  <button
                                    onClick={() => handleToggleDone(task.id)}
                                    className={`rounded-full p-1 transition ${task.status === 'done'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-slate-800 text-slate-400 hover:text-white'
                                      }`}
                                    title={task.status === 'done' ? 'Mark as todo' : 'Mark as done'}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                  <div className="min-w-[200px] flex-1">
                                    <div className="text-sm font-medium text-slate-100">{task.title}</div>
                                    {displayColumns.description && task.description && (
                                      <div className="text-xs text-slate-400 line-clamp-1">{task.description}</div>
                                    )}
                                  </div>
                                  {displayColumns.status && (
                                    <select
                                      value={task.status}
                                      onChange={(event) => updateTask(task.id, { status: event.target.value as PlannerTaskStatus })}
                                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                                    >
                                      <option value="todo">Todo</option>
                                      <option value="in-progress">In progress</option>
                                      <option value="done">Done</option>
                                    </select>
                                  )}
                                  {displayColumns.priority && (
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${priorityStyles[task.priority]}`}>
                                      <Flag className="h-3 w-3" />
                                      {task.priority}
                                    </span>
                                  )}
                                  {displayColumns.dueDate && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
                                      <Calendar className="h-3 w-3" />
                                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                                    </span>
                                  )}
                                  {displayColumns.tags && (
                                    <div className="flex flex-wrap gap-1">
                                      {task.tags.map(tag => (
                                        <span
                                          key={tag}
                                          className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300"
                                        >
                                          <Tag className="h-3 w-3" />
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {displayColumns.updatedAt && (
                                    <span className="text-[11px] text-slate-500">
                                      {new Date(task.updatedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="rounded-lg border border-slate-700 p-1 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
                                    title="Remove doc"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {viewMode === 'board' && (
                    <div className="grid gap-3 md:grid-cols-3">
                      {(['todo', 'in-progress', 'done'] as const).map(status => (
                        <div key={status} className="rounded-xl border border-slate-800 bg-slate-950/40">
                          <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300">
                            {statusLabel[status]}
                          </div>
                          <div className="flex flex-col gap-2 p-3">
                            {filteredTasks.filter(task => task.status === status).map(task => (
                              <div key={task.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                                <div className="text-sm font-semibold text-slate-100">{task.title}</div>
                                {task.description && (
                                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">{task.description}</p>
                                )}
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${priorityStyles[task.priority]}`}>
                                    <Flag className="h-3 w-3" />
                                    {task.priority}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5">
                                    <Calendar className="h-3 w-3" />
                                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {viewMode === 'table' && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs text-slate-300">
                        <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-2 py-2">Title</th>
                            <th className="px-2 py-2">Status</th>
                            <th className="px-2 py-2">Priority</th>
                            <th className="px-2 py-2">Due</th>
                            <th className="px-2 py-2">Tags</th>
                            <th className="px-2 py-2">Updated</th>
                            <th className="px-2 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTasks.map(task => (
                            <tr key={task.id} className="border-b border-slate-800">
                              <td className="px-2 py-2 text-sm text-slate-100">{task.title}</td>
                              <td className="px-2 py-2">
                                <select
                                  value={task.status}
                                  onChange={(event) => updateTask(task.id, { status: event.target.value as PlannerTaskStatus })}
                                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                                >
                                  <option value="todo">Todo</option>
                                  <option value="in-progress">In progress</option>
                                  <option value="done">Done</option>
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${priorityStyles[task.priority]}`}>
                                  <Flag className="h-3 w-3" />
                                  {task.priority}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-[11px]">
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {task.tags.map(tag => (
                                    <span key={tag} className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px]">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-[11px]">{new Date(task.updatedAt).toLocaleDateString()}</td>
                              <td className="px-2 py-2 text-right">
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="rounded-lg border border-slate-700 p-1 text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
                                  title="Remove doc"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {showPlanPanel && (
                <div className="border-l border-slate-800 bg-slate-950/40 p-3">
                  <AdaptivePlan
                    initialTopic={initialTopic}
                    onPlanGenerated={handlePlanGenerated}
                  />
                </div>
              )}
            </div>
          )}

          {section === 'journals' && (
            <div className="px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Calendar className="h-4 w-4 text-emerald-300" />
                  Journals
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <button
                    onClick={() => setJournalWeekStart(prev => {
                      const next = new Date(prev);
                      next.setDate(prev.getDate() - 7);
                      return next;
                    })}
                    className="rounded-lg border border-slate-700 p-1 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setJournalWeekStart(prev => {
                      const next = new Date(prev);
                      next.setDate(prev.getDate() + 7);
                      return next;
                    })}
                    className="rounded-lg border border-slate-700 p-1 hover:text-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-7">
                {journalWeekDates.map(date => {
                  const key = formatDateKey(date);
                  const isSelected = key === selectedJournalDate;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedJournalDate(key)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${isSelected
                        ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                        : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      <div className="text-[10px] uppercase text-slate-400">
                        {date.toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className="text-lg">{date.getDate()}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-200">
                  <span>{formatDateLabel(new Date(selectedJournalDate))}</span>
                  {!selectedJournalEntry && (
                    <button
                      onClick={() => setJournals(prev => ({ ...prev, [selectedJournalDate]: '' }))}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:text-white"
                    >
                      Create Daily Journal
                    </button>
                  )}
                </div>
                <textarea
                  value={selectedJournalEntry}
                  onChange={(event) => setJournals(prev => ({ ...prev, [selectedJournalDate]: event.target.value }))}
                  placeholder="Write your journal entry..."
                  className="mt-3 min-h-[180px] w-full resize-none rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {section === 'collections' && (
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Collections</h3>
                <button
                  onClick={handleCreateCollection}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New collection
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {collections.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-700/70 px-3 py-6 text-center text-xs text-slate-400">
                    No collections yet. Create one to save your filters.
                  </div>
                ) : (
                  collections.map(collection => (
                    <button
                      key={collection.id}
                      onClick={() => handlePickCollection(collection.id)}
                      className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-left hover:border-slate-600"
                    >
                      <div className="text-sm font-semibold text-slate-100">{collection.name}</div>
                      <div className="text-xs text-slate-400">
                        Filter: {collection.filterStatus === 'all' ? 'All' : statusLabel[collection.filterStatus]}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {section === 'tags' && (
            <div className="px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-200">Tags</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {tagsSummary.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-700/70 px-3 py-6 text-center text-xs text-slate-400">
                    Add tags to your docs to organize them here.
                  </div>
                ) : (
                  tagsSummary.map(tag => (
                    <button
                      key={tag.name}
                      onClick={() => {
                        setActiveTag(tag.name);
                        setSection('docs');
                      }}
                      className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                    >
                      {tag.name} · {tag.count}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlannerTab;


