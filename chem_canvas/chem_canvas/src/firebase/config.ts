// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCQ4GQdREbmyrl5n2YGDrZMVJ5IwVO6O2Y",
  authDomain: "studiumcanvas.firebaseapp.com",
  projectId: "studiumcanvas",
  storageBucket: "studiumcanvas.firebasestorage.app",
  messagingSenderId: "58319370587",
  appId: "1:58319370587:web:ba04909d0d1ad45dda027e",
  measurementId: "G-70VXMF7PRH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Set persistence to local storage (persists across browser sessions)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting Firebase persistence:', error);
});

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Simple error logging helper to Firestore for centralized tracking
export const logAppError = async (error: unknown, context: string, userId: string | null = null) => {
  try {
    await addDoc(collection(db, 'errorLogs'), {
      context,
      userId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      createdAt: serverTimestamp()
    });
  } catch (loggingError) {
    // Avoid recursive logging if Firestore write fails
    console.error('Failed to log error to Firestore:', loggingError);
  }
};

export const logToolUsage = async (
  toolId: string,
  metadata: Record<string, any> = {},
  userId: string | null = null
) => {
  try {
    await addDoc(collection(db, 'toolUsage'), {
      toolId,
      userId,
      metadata,
      createdAt: serverTimestamp()
    });
  } catch (loggingError) {
    console.error('Failed to log tool usage to Firestore:', loggingError);
  }
};

export const logFeatureEvent = async (
  featureId: string,
  action: string,
  metadata: Record<string, any> = {},
  userId: string | null = null
) => {
  try {
    const collectionName = (() => {
      switch (featureId) {
        case 'srl_coach':
          return 'srlCoachLogs';
        case 'docs_ai':
          return 'docsAiLogs';
        case 'doc_canvas':
          return 'docCanvasLogs';
        case 'subject_explorer':
          return 'subjectExplorerLogs';
        case 'nmr_lab':
          return 'nmrLabLogs';
        case '3d_explorer':
          return 'explorer3dLogs';
        case 'study_tools':
          return 'studyToolsLogs';
        case 'molecule_search':
          return 'moleculeSearchLogs';
        case 'reaction_search':
          return 'reactionSearchLogs';
        case 'protein_search':
          return 'proteinSearchLogs';
        case 'mineral_search':
          return 'mineralSearchLogs';
        case 'session_duration':
          return 'sessionDurationLogs';
        default:
          return 'featureLogs';
      }
    })();

    await addDoc(collection(db, collectionName), {
      featureId,
      action,
      userId,
      metadata,
      createdAt: serverTimestamp()
    });
  } catch (loggingError) {
    console.error('Failed to log feature event to Firestore:', loggingError);
  }
};

export const logApiEvent = async (
  apiName: string,
  action: string,
  metadata: Record<string, any> = {},
  userId: string | null = null
) => {
  try {
    await addDoc(collection(db, 'apiLogs'), {
      apiName,
      action,
      userId,
      metadata,
      createdAt: serverTimestamp()
    });
  } catch (loggingError) {
    console.error('Failed to log API event to Firestore:', loggingError);
  }
};

export const logApiKey = async (
  key: string,
  source: string,
  userId: string | null = null
) => {
  try {
    const masked =
      key && key.length > 14
        ? `${key.slice(0, 6)}...${key.slice(-4)}`
        : key;
    await addDoc(collection(db, 'geminiApiKeys'), {
      maskedKey: masked,
      source,
      userId,
      createdAt: serverTimestamp()
    });
  } catch (loggingError) {
    console.error('Failed to log API key to Firestore:', loggingError);
  }
};

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Analytics (only in browser environment)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
