// User Service - Manages user profiles and settings
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import type {
  UserProfile,
  UserPreferences,
  UserUsage,
  UserSettings,
} from '../../types/database';

// Get current user ID helper - checks Firebase auth first, then session storage
export const getCurrentUserId = (): string | null => {
  // First try Firebase Auth
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  
  // Fallback to session storage for demo users
  try {
    const sessionData = localStorage.getItem('studium_session');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      if (parsed?.userProfile?.uid && parsed?.expiresAt && Date.now() < parsed.expiresAt) {
        return parsed.userProfile.uid;
      }
    }
  } catch (error) {
    console.error('Error reading session for user ID:', error);
  }
  
  return null;
};

// ============================================
// USER PROFILE
// ============================================

/**
 * Get user profile
 */
export const getUserProfile = async (userId?: string): Promise<UserProfile | null> => {
  const uid = userId || getCurrentUserId();
  if (!uid) return null;

  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

/**
 * Create or update user profile (called on login/signup)
 */
export const createOrUpdateUserProfile = async (
  userData: Partial<UserProfile>
): Promise<UserProfile> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const docRef = doc(db, 'users', uid);
  const existingDoc = await getDoc(docRef);

  if (existingDoc.exists()) {
    // Update existing profile
    await updateDoc(docRef, {
      ...userData,
      lastLoginAt: serverTimestamp(),
    });
  } else {
    // Create new profile
    const newProfile: Omit<UserProfile, 'id'> = {
      email: auth.currentUser?.email || '',
      displayName: auth.currentUser?.displayName || 'User',
      photoURL: auth.currentUser?.photoURL || undefined,
      createdAt: serverTimestamp() as Timestamp,
      lastLoginAt: serverTimestamp() as Timestamp,
      subscription: 'free',
      preferences: {
        theme: 'system',
        aiModel: 'gemini-pro',
        autoSave: true,
        notifications: true,
      },
      usage: {
        aiCreditsUsed: 0,
        storageUsed: 0,
        lastResetDate: serverTimestamp() as Timestamp,
      },
      ...userData,
    };
    await setDoc(docRef, newProfile);
  }

  const updatedDoc = await getDoc(docRef);
  return { id: updatedDoc.id, ...updatedDoc.data() } as UserProfile;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  updates: Partial<UserProfile>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const docRef = doc(db, 'users', uid);
  await updateDoc(docRef, updates);
};

// ============================================
// USER PREFERENCES
// ============================================

/**
 * Get user preferences
 */
export const getUserPreferences = async (): Promise<UserPreferences | null> => {
  const profile = await getUserProfile();
  return profile?.preferences || null;
};

/**
 * Update user preferences
 */
export const updateUserPreferences = async (
  preferences: Partial<UserPreferences>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const docRef = doc(db, 'users', uid);
  const currentProfile = await getUserProfile();

  await updateDoc(docRef, {
    preferences: {
      ...currentProfile?.preferences,
      ...preferences,
    },
  });
};

// ============================================
// USER USAGE
// ============================================

/**
 * Get user usage stats
 */
export const getUserUsage = async (): Promise<UserUsage | null> => {
  const profile = await getUserProfile();
  return profile?.usage || null;
};

/**
 * Update user usage (e.g., AI credits used)
 */
export const updateUserUsage = async (
  usageUpdates: Partial<UserUsage>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const docRef = doc(db, 'users', uid);
  const currentProfile = await getUserProfile();

  await updateDoc(docRef, {
    usage: {
      ...currentProfile?.usage,
      ...usageUpdates,
    },
  });
};

/**
 * Increment AI credits used
 */
export const incrementAiCredits = async (amount: number = 1): Promise<void> => {
  const usage = await getUserUsage();
  if (usage) {
    await updateUserUsage({
      aiCreditsUsed: (usage.aiCreditsUsed || 0) + amount,
    });
  }
};

// ============================================
// USER SETTINGS (Detailed settings by category)
// ============================================

/**
 * Get settings by category
 */
export const getUserSettings = async (
  category: UserSettings['category']
): Promise<UserSettings | null> => {
  const uid = getCurrentUserId();
  if (!uid) return null;

  try {
    const docRef = doc(db, 'users', uid, 'settings', category);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as UserSettings;
    }
    return null;
  } catch (error) {
    console.error('Error getting user settings:', error);
    throw error;
  }
};

/**
 * Save settings by category
 */
export const saveUserSettings = async (
  category: UserSettings['category'],
  settings: Record<string, any>
): Promise<void> => {
  const uid = getCurrentUserId();
  if (!uid) throw new Error('User not authenticated');

  const docRef = doc(db, 'users', uid, 'settings', category);
  await setDoc(docRef, {
    category,
    settings,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

// ============================================
// AUTH STATE LISTENER HELPER
// ============================================

/**
 * Setup profile sync on auth state change
 * Call this once in your app initialization
 */
export const setupAuthProfileSync = (
  onProfileLoaded?: (profile: UserProfile | null) => void
): (() => void) => {
  const unsubscribe = auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const profile = await createOrUpdateUserProfile({
          email: user.email || '',
          displayName: user.displayName || 'User',
          photoURL: user.photoURL || undefined,
        });
        onProfileLoaded?.(profile);
      } catch (error) {
        console.error('Error syncing profile:', error);
        onProfileLoaded?.(null);
      }
    } else {
      onProfileLoaded?.(null);
    }
  });

  return unsubscribe;
};
