import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { assignRandomApiKey, initializeApiKeys, checkApiKeysInitialized } from './apiKeys';
import { saveSession, clearSession } from '../utils/sessionStorage';

// User interface for additional profile data
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  gender?: string;
  course?: string;
  semester?: string;
  majorSubject?: string;
  university?: string;
  geminiApiKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Register a new user
export const registerUser = async (
  username: string, 
  password: string, 
  additionalData: {
    gender?: string;
    course?: string;
    semester?: string;
    majorSubject?: string;
    university?: string;
  }
): Promise<UserProfile> => {
  try {
    // Create a unique email for Firebase (Firebase requires email for authentication)
    const firebaseEmail = `${username}@studium.local`;
    
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, firebaseEmail, password);
    const user = userCredential.user;

    // Update the user's display name
    await updateProfile(user, {
      displayName: username
    });

    // Initialize API keys in Firebase if not already done
    const isInitialized = await checkApiKeysInitialized();
    if (!isInitialized) {
      await initializeApiKeys();
    }
    
    // Assign a random Gemini API key from Firebase
    const geminiApiKey = await assignRandomApiKey();

    // Create user profile in Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      email: firebaseEmail,
      displayName: username,
      username: username,
      gender: additionalData.gender,
      course: additionalData.course,
      semester: additionalData.semester,
      majorSubject: additionalData.majorSubject,
      university: additionalData.university,
      geminiApiKey: geminiApiKey,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save user profile to Firestore
    await setDoc(doc(db, 'users', user.uid), userProfile);

    return userProfile;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Sign in user with username
export const signInUser = async (username: string, password: string): Promise<UserProfile> => {
  try {
    // Convert username to Firebase email format
    const firebaseEmail = `${username}@studium.local`;
    
    const userCredential = await signInWithEmailAndPassword(auth, firebaseEmail, password);
    const user = userCredential.user;

    // Get user profile from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      const profile = userDoc.data() as UserProfile;
      
      // Assign API key if user doesn't have one
      if (!profile.geminiApiKey) {
        // Initialize API keys in Firebase if not already done
        const isInitialized = await checkApiKeysInitialized();
        if (!isInitialized) {
          await initializeApiKeys();
        }
        
        const geminiApiKey = await assignRandomApiKey();
        const updatedProfile = {
          ...profile,
          geminiApiKey: geminiApiKey,
          updatedAt: new Date()
        };
        
        await setDoc(doc(db, 'users', user.uid), updatedProfile);
        return updatedProfile;
      }
      
      return profile;
    } else {
      // If no profile exists, create a basic one with API key
      const isInitialized = await checkApiKeysInitialized();
      if (!isInitialized) {
        await initializeApiKeys([]);
      }
      const geminiApiKey = await assignRandomApiKey();
      const userProfile: UserProfile = {
        uid: user.uid,
        email: firebaseEmail,
        displayName: username,
        username: username,
        geminiApiKey: geminiApiKey,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);
      return userProfile;
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<{ userProfile: UserProfile; needsProfileCompletion: boolean }> => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Check if user profile exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      const profile = userDoc.data() as UserProfile;
      
      // Assign API key if user doesn't have one
      if (!profile.geminiApiKey) {
        // Initialize API keys in Firebase if not already done
        const isInitialized = await checkApiKeysInitialized();
        if (!isInitialized) {
          await initializeApiKeys();
        }
        
        const geminiApiKey = await assignRandomApiKey();
        const updatedProfile = {
          ...profile,
          geminiApiKey: geminiApiKey,
          updatedAt: new Date()
        };
        
        await setDoc(doc(db, 'users', user.uid), updatedProfile);
        profile.geminiApiKey = geminiApiKey;
      }
      
      // Check if profile is complete (has academic information)
      const needsCompletion = !profile.gender || !profile.course || !profile.semester || 
                             !profile.majorSubject || !profile.university;
      
      return { userProfile: profile, needsProfileCompletion: needsCompletion };
    } else {
      // Create new user profile from Google data (incomplete)
      // Initialize API keys in Firebase if not already done
      const isInitialized = await checkApiKeysInitialized();
      if (!isInitialized) {
        await initializeApiKeys();
      }
      
      const geminiApiKey = await assignRandomApiKey();
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        username: user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'user',
        geminiApiKey: geminiApiKey,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to Firestore
      await setDoc(doc(db, 'users', user.uid), userProfile);
      return { userProfile, needsProfileCompletion: true };
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Sign out user
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
    clearSession(); // Clear our custom session storage
    console.log('User signed out successfully');
  } catch (error: any) {
    console.error('Sign out error:', error);
    throw new Error(error.message);
  }
};

// Auth state listener to handle automatic login persistence
export const setupAuthStateListener = (onUserChange: (userProfile: UserProfile | null) => void) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      try {
        // Get user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          
          // Save session for 2 days
          saveSession(profile);
          
          // Notify the app about the authenticated user
          onUserChange(profile);
          
          console.log('User automatically logged in:', profile.username);
        } else {
          console.log('User authenticated but no profile found');
          onUserChange(null);
        }
      } catch (error) {
        console.error('Error loading user profile on auth state change:', error);
        onUserChange(null);
      }
    } else {
      // User is signed out
      clearSession();
      onUserChange(null);
      console.log('User signed out');
    }
  });
};

// Get current user profile
export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Update user profile
export const updateUserProfile = async (updates: Partial<UserProfile>): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');

  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      ...updates,
      updatedAt: new Date()
    }, { merge: true });
  } catch (error: any) {
    throw new Error(error.message);
  }
};
