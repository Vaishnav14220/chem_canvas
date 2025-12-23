// Activity Service - Tracks user activity for analytics and history
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getCurrentUserId } from './userService';
import type { ActivityLog, ResourceType } from '../../types/database';

// ============================================
// ACTIVITY LOGGING
// ============================================

/**
 * Log an activity
 */
export const logActivity = async (
  type: ActivityLog['type'],
  resourceType: ResourceType,
  resourceId: string,
  resourceName?: string,
  metadata?: Record<string, any>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) return; // Silently fail if not authenticated

  try {
    const activityRef = collection(db, 'users', uid, 'activity');
    await addDoc(activityRef, {
      type,
      resourceType,
      resourceId,
      resourceName,
      metadata,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw - activity logging shouldn't break the app
  }
};

/**
 * Log view activity
 */
export const logView = async (
  resourceType: ResourceType,
  resourceId: string,
  resourceName?: string
): Promise<void> => {
  await logActivity('view', resourceType, resourceId, resourceName);
};

/**
 * Log create activity
 */
export const logCreate = async (
  resourceType: ResourceType,
  resourceId: string,
  resourceName?: string
): Promise<void> => {
  await logActivity('create', resourceType, resourceId, resourceName);
};

/**
 * Log edit activity
 */
export const logEdit = async (
  resourceType: ResourceType,
  resourceId: string,
  resourceName?: string,
  changes?: Record<string, any>
): Promise<void> => {
  await logActivity('edit', resourceType, resourceId, resourceName, { changes });
};

/**
 * Log delete activity
 */
export const logDelete = async (
  resourceType: ResourceType,
  resourceId: string,
  resourceName?: string
): Promise<void> => {
  await logActivity('delete', resourceType, resourceId, resourceName);
};

/**
 * Log share activity
 */
export const logShare = async (
  resourceType: ResourceType,
  resourceId: string,
  resourceName?: string,
  sharedWith?: string[]
): Promise<void> => {
  await logActivity('share', resourceType, resourceId, resourceName, { sharedWith });
};

/**
 * Log export activity
 */
export const logExport = async (
  resourceType: ResourceType,
  resourceId: string,
  resourceName?: string,
  format?: string
): Promise<void> => {
  await logActivity('export', resourceType, resourceId, resourceName, { format });
};

// ============================================
// ACTIVITY RETRIEVAL
// ============================================

/**
 * Get recent activity
 */
export const getRecentActivity = async (
  options: {
    resourceType?: ResourceType;
    type?: ActivityLog['type'];
    limit?: number;
    since?: Timestamp;
  } = {}
): Promise<ActivityLog[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const {
    resourceType,
    type,
    limit: limitCount = 50,
    since,
  } = options;

  try {
    const activityRef = collection(db, 'users', uid, 'activity');
    let q = query(
      activityRef,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    if (resourceType) {
      q = query(
        activityRef,
        where('resourceType', '==', resourceType),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }

    if (type) {
      q = query(
        activityRef,
        where('type', '==', type),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    let activities = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ActivityLog[];

    // Filter by since if provided
    if (since) {
      activities = activities.filter(a => 
        (a.timestamp as Timestamp).toMillis() >= since.toMillis()
      );
    }

    return activities;
  } catch (error) {
    console.error('Error getting activity:', error);
    throw error;
  }
};

/**
 * Get activity for a specific resource
 */
export const getResourceActivity = async (
  resourceType: ResourceType,
  resourceId: string
): Promise<ActivityLog[]> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  try {
    const activityRef = collection(db, 'users', uid, 'activity');
    const q = query(
      activityRef,
      where('resourceType', '==', resourceType),
      where('resourceId', '==', resourceId),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ActivityLog[];
  } catch (error) {
    console.error('Error getting resource activity:', error);
    throw error;
  }
};

/**
 * Get recently viewed resources
 */
export const getRecentlyViewed = async (
  resourceType?: ResourceType,
  count: number = 10
): Promise<ActivityLog[]> => {
  const activities = await getRecentActivity({
    resourceType,
    type: 'view',
    limit: count * 3, // Get more to filter duplicates
  });

  // Remove duplicates (keep most recent view per resource)
  const seen = new Set<string>();
  const unique: ActivityLog[] = [];

  for (const activity of activities) {
    const key = `${activity.resourceType}:${activity.resourceId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(activity);
      if (unique.length >= count) break;
    }
  }

  return unique;
};

/**
 * Get recently edited resources
 */
export const getRecentlyEdited = async (
  resourceType?: ResourceType,
  count: number = 10
): Promise<ActivityLog[]> => {
  const activities = await getRecentActivity({
    resourceType,
    type: 'edit',
    limit: count * 3,
  });

  // Remove duplicates
  const seen = new Set<string>();
  const unique: ActivityLog[] = [];

  for (const activity of activities) {
    const key = `${activity.resourceType}:${activity.resourceId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(activity);
      if (unique.length >= count) break;
    }
  }

  return unique;
};

// ============================================
// ACTIVITY STATISTICS
// ============================================

/**
 * Get activity statistics
 */
export const getActivityStats = async (
  days: number = 30
): Promise<{
  totalActivities: number;
  byType: Record<string, number>;
  byResourceType: Record<string, number>;
  dailyActivity: Array<{ date: string; count: number }>;
}> => {
  const since = Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
  const activities = await getRecentActivity({ limit: 1000, since });

  const byType: Record<string, number> = {};
  const byResourceType: Record<string, number> = {};
  const dailyMap: Record<string, number> = {};

  activities.forEach(activity => {
    // By type
    byType[activity.type] = (byType[activity.type] || 0) + 1;

    // By resource type
    byResourceType[activity.resourceType] = (byResourceType[activity.resourceType] || 0) + 1;

    // Daily activity
    const date = (activity.timestamp as Timestamp).toDate().toISOString().split('T')[0];
    dailyMap[date] = (dailyMap[date] || 0) + 1;
  });

  // Convert daily map to sorted array
  const dailyActivity = Object.entries(dailyMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalActivities: activities.length,
    byType,
    byResourceType,
    dailyActivity,
  };
};

/**
 * Get activity streak (consecutive days with activity)
 */
export const getActivityStreak = async (): Promise<{
  currentStreak: number;
  longestStreak: number;
}> => {
  const activities = await getRecentActivity({ limit: 365 });

  // Get unique dates with activity
  const dates = new Set<string>();
  activities.forEach(activity => {
    const date = (activity.timestamp as Timestamp).toDate().toISOString().split('T')[0];
    dates.add(date);
  });

  const sortedDates = Array.from(dates).sort().reverse();

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Check if today or yesterday has activity to start counting
  if (sortedDates[0] === today || sortedDates[0] === yesterday) {
    currentStreak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / (24 * 60 * 60 * 1000));

      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return { currentStreak, longestStreak };
};

// ============================================
// CLEANUP
// ============================================

/**
 * Delete old activity logs (older than specified days)
 * Note: This would typically be done by a Cloud Function
 */
export const cleanupOldActivity = async (olderThanDays: number = 90): Promise<number> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const cutoff = Timestamp.fromMillis(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  try {
    const activityRef = collection(db, 'users', uid, 'activity');
    const q = query(
      activityRef,
      where('timestamp', '<', cutoff),
      limit(500) // Delete in batches
    );

    const snapshot = await getDocs(q);
    let deleted = 0;

    // Note: For production, use batch deletes
    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref);
      deleted++;
    }

    return deleted;
  } catch (error) {
    console.error('Error cleaning up activity:', error);
    throw error;
  }
};
