import { collection, getDocs } from 'firebase/firestore';
import { db } from './config';

// ⚠️ SECURITY: API keys are now fetched from Firebase Firestore "apikey" collection
// This is the primary source of truth for Gemini API keys

// Cache for API keys (refreshed periodically)
let apiKeyCache: string[] = [];
let lastCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

let vertexApiKeyCache: string | null = null;
let lastVertexCacheTime = 0;

/**
 * Fetch all API keys from Firestore "apikey" collection
 * Each document should have an "api_key" field
 */
export const fetchApiKeysFromFirestore = async (): Promise<string[]> => {
  try {
    console.log('📡 Fetching API keys from Firestore...');
    const apiKeysRef = collection(db, 'apikey');
    const querySnapshot = await getDocs(apiKeysRef);
    
    const apiKeys: string[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Check for api_key field (from your screenshot)
      if (data.api_key && typeof data.api_key === 'string' && data.api_key.trim()) {
        apiKeys.push(data.api_key.trim());
        console.log(`✅ Found API key: ${data.api_key.substring(0, 10)}...`);
      }
    });
    
    if (apiKeys.length === 0) {
      console.warn('⚠️ No API keys found in Firestore "apikey" collection');
      return [];
    }
    
    console.log(`✅ Successfully fetched ${apiKeys.length} API key(s) from Firestore`);
    return apiKeys;
  } catch (error) {
    console.error('❌ Error fetching API keys from Firestore:', error);
    return [];
  }
};

/**
 * Get cached API keys or fetch fresh ones if cache expired
 */
export const getApiKeysWithCache = async (): Promise<string[]> => {
  const now = Date.now();
  
  // Return cached keys if still valid
  if (apiKeyCache.length > 0 && (now - lastCacheTime) < CACHE_DURATION) {
    console.log('📦 Using cached API keys');
    return apiKeyCache;
  }
  
  // Fetch fresh keys
  const freshKeys = await fetchApiKeysFromFirestore();
  if (freshKeys.length > 0) {
    apiKeyCache = freshKeys;
    lastCacheTime = now;
  }
  
  return freshKeys;
};

/**
 * Get the shared Gemini API key from Firestore
 * Always returns the first key found (single shared key for all users)
 */
export const getSharedGeminiApiKey = async (): Promise<string> => {
  const apiKeys = await getApiKeysWithCache();

  if (!apiKeys.length) {
    console.error('❌ No API keys available in Firestore (collection "apikey")');
    throw new Error('No Gemini API key configured. Please add one document with api_key field to Firestore.');
  }

  const sharedKey = apiKeys[0];
  console.log(`✅ Using shared Gemini API key from Firestore: ${sharedKey.substring(0, 10)}...`);
  return sharedKey;
};

/**
 * Backwards compatible export (still called assignRandomApiKey in some modules)
 * Now simply returns the shared Gemini API key from Firestore
 */
export const assignRandomApiKey = async (): Promise<string> => {
  try {
    return await getSharedGeminiApiKey();
  } catch (error) {
    console.error('❌ Error retrieving shared API key:', error);
    throw error;
  }
};

/**
 * Get all API keys from Firestore for rotation
 */
export const getAllApiKeys = async (): Promise<string[]> => {
  const keys = await getApiKeysWithCache();
  if (!keys.length) {
    return [];
  }
  // Always use the first key as the shared key, but keep the signature for compatibility
  return [keys[0]];
};

/**
 * Check if API keys exist in Firestore
 */
export const checkApiKeysInitialized = async (): Promise<boolean> => {
  try {
    const apiKeys = await getApiKeysWithCache();
    return apiKeys.length > 0;
  } catch (error) {
    console.error('❌ Error checking API keys:', error);
    return false;
  }
};

/**
 * Display all API keys from Firestore (masked for security)
 */
export const displayAllApiKeys = async (): Promise<void> => {
  try {
    const apiKeys = await getApiKeysWithCache();
    
    console.log('🔑 API Keys from Firestore:');
    console.log('========================================');
    
    if (apiKeys.length === 0) {
      console.log('❌ No API keys found in Firestore');
      return;
    }
    
    apiKeys.forEach((key, index) => {
      const masked = `${key.substring(0, 10)}...${key.substring(key.length - 4)}`;
      console.log(`${index + 1}. ${masked}`);
    });
    
    console.log(`✅ Total API keys: ${apiKeys.length}`);
  } catch (error) {
    console.error('❌ Error displaying API keys:', error);
  }
};

/**
 * Initialize API keys in Firebase (admin function - if needed)
 */
export const initializeApiKeys = async (apiKeys: string[] = []): Promise<void> => {
  console.log('ℹ️ API keys are now managed directly in Firestore "apikey" collection');
  console.log('ℹ️ To add API keys, use Firebase Console or admin panel');
};

/**
 * Fetch the Vertex AI API key from Firestore.
 * Looks for a document containing a "vertex_ai" field.
 */
export const fetchVertexAiKeyFromFirestore = async (): Promise<string | null> => {
  try {
    console.log('📡 Fetching Vertex AI API key from Firestore...');
    const apiKeysRef = collection(db, 'apikey');
    const querySnapshot = await getDocs(apiKeysRef);

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      if (typeof data.vertex_ai === 'string' && data.vertex_ai.trim()) {
        const key = data.vertex_ai.trim();
        console.log(`✅ Found Vertex AI API key in doc ${docSnap.id}`);
        return key;
      }
    }

    console.warn('⚠️ No Vertex AI API key found in Firestore "apikey" collection');
    return null;
  } catch (error) {
    console.error('❌ Error fetching Vertex AI API key from Firestore:', error);
    return null;
  }
};

/**
 * Get the cached Vertex AI API key or fetch a fresh one if needed.
 */
export const getVertexAiApiKey = async (): Promise<string | null> => {
  const now = Date.now();

  if (vertexApiKeyCache && now - lastVertexCacheTime < CACHE_DURATION) {
    console.log('📦 Using cached Vertex AI API key');
    return vertexApiKeyCache;
  }

  const freshKey = await fetchVertexAiKeyFromFirestore();
  if (freshKey) {
    vertexApiKeyCache = freshKey;
    lastVertexCacheTime = now;
    console.log(`✅ Using Vertex AI API key from Firestore: ${freshKey.substring(0, 10)}...`);
  }

  return freshKey;
};
