// useAuth - Hook to manage Firebase Authentication with user profile persistence
import { useState, useEffect, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  getCurrentUserId,
  getUserProfile,
  createOrUpdateUserProfile,
  updateUserProfile as updateProfileSvc,
  getUserSettings,
  saveUserSettings,
  updateUserPreferences,
} from '../services/database/userService';
import type { UserProfile, UserSettings, UserPreferences } from '../types/database';

interface CreateUserProfile {
  email: string;
  displayName: string;
  photoURL?: string;
}

interface UseAuthReturn {
  // Auth state
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Profile management
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<CreateUserProfile>) => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user profile from Firestore
  const loadProfile = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setUserProfile(null);
      return;
    }

    try {
      let profile = await getUserProfile(userId);
      
      // Create profile if it doesn't exist
      if (!profile && user) {
        profile = await createOrUpdateUserProfile({
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL || undefined,
        });
      }

      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }, [user]);

  // Update user profile
  const updateProfile = useCallback(async (
    updates: Partial<CreateUserProfile>
  ): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    try {
      await updateProfileSvc(updates);
      setUserProfile(prev => prev ? { ...prev, ...updates } as UserProfile : null);
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }, []);

  // Update user preferences
  const updatePreferences = useCallback(async (
    prefs: Partial<UserPreferences>
  ): Promise<void> => {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    try {
      await updateUserPreferences(prefs);
      setUserProfile(prev => prev ? { 
        ...prev, 
        preferences: { ...prev.preferences, ...prefs } 
      } as UserProfile : null);
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Load profile when user changes
  useEffect(() => {
    if (user) {
      loadProfile();
    } else {
      setUserProfile(null);
    }
  }, [user, loadProfile]);

  return {
    user,
    userProfile,
    isLoading,
    isAuthenticated: !!user,
    
    loadProfile,
    updateProfile,
    updatePreferences,
  };
}

export default useAuth;
