// Centralized error logging to Firestore with user context.
import { auth, logAppError } from '../firebase/config';

export const captureError = async (error: unknown, context: string) => {
  const userId = auth?.currentUser?.uid ?? null;
  try {
    await logAppError(error, context, userId);
  } catch (logError) {
    // Last-resort logging to console to avoid silent failures.
    console.error('Error while logging to Firestore:', logError);
  }
};

export const captureToolClick = async (toolId: string, metadata: Record<string, any> = {}) => {
  const userId = auth?.currentUser?.uid ?? null;
  try {
    const { logToolUsage } = await import('../firebase/config');
    await logToolUsage(toolId, metadata, userId);
  } catch (logError) {
    console.error('Error while logging tool usage to Firestore:', logError);
  }
};

export const captureFeatureEvent = async (
  featureId: string,
  action: string,
  metadata: Record<string, any> = {}
) => {
  const userId = auth?.currentUser?.uid ?? null;
  try {
    const { logFeatureEvent } = await import('../firebase/config');
    await logFeatureEvent(featureId, action, metadata, userId);
  } catch (logError) {
    console.error('Error while logging feature event to Firestore:', logError);
  }
};

export const captureApiEvent = async (
  apiName: string,
  action: string,
  metadata: Record<string, any> = {}
) => {
  const userId = auth?.currentUser?.uid ?? null;
  try {
    const { logApiEvent } = await import('../firebase/config');
    await logApiEvent(apiName, action, metadata, userId);
  } catch (logError) {
    console.error('Error while logging API event to Firestore:', logError);
  }
};

export const captureApiKey = async (
  key: string,
  source: string
) => {
  const userId = auth?.currentUser?.uid ?? null;
  try {
    const { logApiKey } = await import('../firebase/config');
    await logApiKey(key, source, userId);
  } catch (logError) {
    console.error('Error while logging API key to Firestore:', logError);
  }
};

export const initGlobalErrorLogging = () => {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    void captureError(event.error ?? event.message, 'window.error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    void captureError(event.reason ?? 'unhandledrejection', 'window.unhandledrejection');
  });
};
