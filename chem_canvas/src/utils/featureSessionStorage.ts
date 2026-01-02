import { getCurrentUserId } from '../services/database/userService';

const FEATURE_SESSION_PREFIX = 'feature_session:';

const buildSessionKey = (featureId: string, userId?: string) => {
  const resolvedUserId = userId ?? getCurrentUserId() ?? 'anonymous';
  return `${FEATURE_SESSION_PREFIX}${resolvedUserId}:${featureId}`;
};

export const getFeatureSessionKey = (featureId: string, userId?: string) => {
  return buildSessionKey(featureId, userId);
};

export const loadFeatureSession = <T>(featureId: string, userId?: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const key = buildSessionKey(featureId, userId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[featureSessionStorage] Failed to load session for ${featureId}:`, error);
    return null;
  }
};

export const saveFeatureSession = <T>(featureId: string, data: T, userId?: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const key = buildSessionKey(featureId, userId);
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`[featureSessionStorage] Failed to save session for ${featureId}:`, error);
  }
};

export const clearFeatureSession = (featureId: string, userId?: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const key = buildSessionKey(featureId, userId);
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error(`[featureSessionStorage] Failed to clear session for ${featureId}:`, error);
  }
};

export const clearAllFeatureSessions = (userId?: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const prefix = userId ? `${FEATURE_SESSION_PREFIX}${userId}:` : FEATURE_SESSION_PREFIX;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch (error) {
    console.error('[featureSessionStorage] Failed to clear feature sessions:', error);
  }
};
