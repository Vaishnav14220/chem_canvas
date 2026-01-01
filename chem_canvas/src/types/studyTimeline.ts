export type StudyTimelineItemType = 'lecture' | 'reading' | 'exam' | 'assignment';

export type StudyTimelineStatus = 'planned' | 'in-progress' | 'completed';

export interface StudyTimelineItem {
  id: string;
  date: string;
  type: StudyTimelineItemType;
  title: string;
  description?: string;
  status?: StudyTimelineStatus;
  startDate?: string;
  endDate?: string;
  estimateHours?: number;
  reminders?: number[];
  studyTime?: string;
}

export interface StudyTimelinePreferences {
  effortHoursPerDay: number;
  blockedDays: string[];
  preferredStudyTime: 'morning' | 'afternoon' | 'evening';
  reminderDays: number[];
  targetDate?: string;
}

export interface StudyTimelinePlan {
  summary?: string;
  notice?: string;
  items: StudyTimelineItem[];
}
