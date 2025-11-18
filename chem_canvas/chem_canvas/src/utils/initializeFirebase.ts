import { initializeApiKeys, checkApiKeysInitialized } from '../firebase/apiKeys';

// Initialize Firebase API keys on app startup
export const initializeFirebaseOnStartup = async (): Promise<void> => {
  try {
    console.log('🔧 Checking Firebase API keys initialization...');
    
    const keysInitialized = await checkApiKeysInitialized();
    
    if (!keysInitialized) {
      console.log('📝 Initializing API keys in Firebase...');
      await initializeApiKeys();
      console.log('✅ API keys initialized successfully in Firebase!');
    } else {
      console.log('✅ API keys already initialized in Firebase');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase API keys:', error);
    // Don't throw error to prevent app from crashing
    // The app can still work with fallback API keys
  }
};
