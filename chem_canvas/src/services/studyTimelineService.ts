import { nanoid } from 'nanoid';
import { extractJsonBlock, generateTextContent } from './geminiService';
import type {
  StudyTimelineItem,
  StudyTimelineItemType,
  StudyTimelinePlan,
  StudyTimelinePreferences,
  StudyTimelineStatus,
} from '../types/studyTimeline';

interface StudyTimelineRequest {
  topic: string;
  fileName?: string;
  sourceText?: string;
  preferences: StudyTimelinePreferences;
}

const ITEM_TYPES: StudyTimelineItemType[] = ['lecture', 'reading', 'exam', 'assignment'];
const STATUS_TYPES: StudyTimelineStatus[] = ['planned', 'in-progress', 'completed'];

const isValidDate = (value: string) => !Number.isNaN(Date.parse(value));

const normalizeDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!isValidDate(trimmed)) return undefined;
  return trimmed;
};

const normalizeStatus = (value: unknown): StudyTimelineStatus | undefined => {
  if (typeof value !== 'string') return undefined;
  const lowered = value.toLowerCase().trim();
  if (STATUS_TYPES.includes(lowered as StudyTimelineStatus)) {
    return lowered as StudyTimelineStatus;
  }
  if (['done', 'complete', 'completed'].includes(lowered)) return 'completed';
  if (['active', 'working', 'progress', 'inprogress', 'in-progress'].includes(lowered)) return 'in-progress';
  if (['planned', 'todo', 'pending', 'upcoming'].includes(lowered)) return 'planned';
  return undefined;
};

const normalizeItemType = (value: unknown): StudyTimelineItemType => {
  if (typeof value !== 'string') return 'reading';
  const lowered = value.toLowerCase().trim();
  return ITEM_TYPES.includes(lowered as StudyTimelineItemType)
    ? (lowered as StudyTimelineItemType)
    : 'reading';
};

const normalizeReminderDays = (value: unknown): number[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const days = value
    .map((item) => Number(item))
    .filter((num) => Number.isFinite(num) && num > 0)
    .map((num) => Math.round(num));
  return days.length ? Array.from(new Set(days)).slice(0, 4) : undefined;
};

const normalizeItems = (raw: unknown): StudyTimelineItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const date =
        normalizeDate(item.date) ||
        normalizeDate(item.startDate) ||
        normalizeDate(item.endDate);
      const title = typeof item.title === 'string' ? item.title.trim() : '';

      if (!date || !title) return null;

      return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id : nanoid(),
        date,
        type: normalizeItemType(item.type),
        title,
        description: typeof item.description === 'string' ? item.description.trim() : undefined,
        status: normalizeStatus(item.status),
        startDate: normalizeDate(item.startDate),
        endDate: normalizeDate(item.endDate),
        estimateHours: Number.isFinite(Number(item.estimateHours))
          ? Math.max(0.5, Math.round(Number(item.estimateHours) * 2) / 2)
          : undefined,
        reminders: normalizeReminderDays(item.reminders),
        studyTime: typeof item.studyTime === 'string' ? item.studyTime.trim() : undefined,
      } satisfies StudyTimelineItem;
    })
    .filter((item): item is StudyTimelineItem => Boolean(item));
};

export const generateStudyTimelinePlan = async ({
  topic,
  fileName,
  sourceText,
  preferences,
}: StudyTimelineRequest): Promise<StudyTimelinePlan> => {
  const trimmedSource = sourceText?.trim().slice(0, 12000);
  const blockedDays = preferences.blockedDays.length ? preferences.blockedDays.join(', ') : 'None';
  const reminderDays = preferences.reminderDays.length ? preferences.reminderDays.join(', ') : '7, 3, 1';
  const targetDate = preferences.targetDate ? `Target date: ${preferences.targetDate}` : 'Target date: Not specified';

  const prompt = [
    'You are a study planning engine.',
    'Create a study timeline and reminder plan based on the provided materials.',
    'Return ONLY valid JSON in the following shape:',
    '{',
    '  "summary": "Short overview of the plan and timeline span",',
    '  "items": [',
    '    {',
    '      "id": "unique-id",',
    '      "date": "YYYY-MM-DD",',
    '      "type": "lecture | reading | exam | assignment",',
    '      "title": "Short label",',
    '      "description": "What to do and why",',
    '      "status": "planned | in-progress | completed",',
    '      "startDate": "YYYY-MM-DD (optional for ranges)",',
    '      "endDate": "YYYY-MM-DD (optional for ranges)",',
    '      "estimateHours": 2.5,',
    '      "reminders": [7, 3, 1],',
    '      "studyTime": "morning | afternoon | evening"',
    '    }',
    '  ]',
    '}',
    'Rules:',
    '- Use ISO date strings (YYYY-MM-DD).',
    '- Include 10-20 items spanning the study period.',
    '- Use startDate/endDate for multi-day assignments or projects.',
    '- Schedule review checkpoints and mock exams.',
    '- Highlight exams as their own items.',
    '- Make the workload realistic based on the effort per day.',
    '- Avoid blocked days.',
    '',
    `Topic: ${topic}`,
    fileName ? `File name: ${fileName}` : '',
    targetDate,
    `Effort per day: ${preferences.effortHoursPerDay} hours`,
    `Blocked days: ${blockedDays}`,
    `Preferred study time: ${preferences.preferredStudyTime}`,
    `Reminder offsets (days before due date): ${reminderDays}`,
    trimmedSource ? 'Source notes:' : '',
    trimmedSource ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  const responseText = await generateTextContent(prompt, {
    maxOutputTokens: 4096,
    model: 'gemini-3-pro-preview',
    thinking: 'high',
    applyPreferences: false,
  });

  const jsonPayload = extractJsonBlock(responseText);
  const parsed = JSON.parse(jsonPayload);

  const rawItems = Array.isArray(parsed)
    ? parsed
    : parsed?.items || parsed?.timeline || parsed?.plan || [];
  const items = normalizeItems(rawItems);

  if (!items.length) {
    throw new Error('No valid timeline items returned.');
  }

  return {
    summary: typeof parsed?.summary === 'string' ? parsed.summary.trim() : undefined,
    items,
  };
};
