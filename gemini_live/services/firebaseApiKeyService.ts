/**
 * Firebase API Key Service for Gemini Live
 * 
 * This service integrates with the Firebase Firestore API key management
 * system used by the chem_canvas project. It fetches the Gemini API key
 * from the shared Firestore collection.
 */

import { collection, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration - shared with chem_canvas
const firebaseConfig = {
    apiKey: "AIzaSyDCU9K42G7wKxgszFe-1UeT7rtU0WeST8s",
    authDomain: "studytools-62d7e.firebaseapp.com",
    projectId: "studytools-62d7e",
    storageBucket: "studytools-62d7e.firebasestorage.app",
    messagingSenderId: "455556633861",
    appId: "1:455556633861:web:d2a6b900854c3b50e9c5bf",
    measurementId: "G-TE63PBZCN6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Cache for API key
let apiKeyCache: string | null = null;
let lastCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the Gemini API key from Firestore "apikey" collection
 */
const fetchApiKeyFromFirestore = async (): Promise<string | null> => {
    try {
        console.log('📡 [Gemini Live] Fetching API key from Firestore...');
        const apiKeysRef = collection(db, 'apikey');
        const querySnapshot = await getDocs(apiKeysRef);

        // Get the first API key from the collection
        for (const doc of querySnapshot.docs) {
            const data = doc.data();
            if (data.api_key && typeof data.api_key === 'string' && data.api_key.trim()) {
                const apiKey = data.api_key.trim();
                console.log(`✅ [Gemini Live] Found API key: ${apiKey.substring(0, 10)}...`);
                return apiKey;
            }
        }

        console.warn('⚠️ [Gemini Live] No API key found in Firestore "apikey" collection');
        return null;
    } catch (error) {
        console.error('❌ [Gemini Live] Error fetching API key from Firestore:', error);
        return null;
    }
};

/**
 * Get the Gemini API key with caching
 * Returns null if no key is found
 */
export const getGeminiApiKey = async (): Promise<string | null> => {
    const now = Date.now();

    // Return cached key if still valid
    if (apiKeyCache && (now - lastCacheTime) < CACHE_DURATION) {
        console.log('📦 [Gemini Live] Using cached API key');
        return apiKeyCache;
    }

    // Fetch fresh key
    const freshKey = await fetchApiKeyFromFirestore();
    if (freshKey) {
        apiKeyCache = freshKey;
        lastCacheTime = now;
    }

    return freshKey;
};

/**
 * Clear the API key cache (useful for testing or forced refresh)
 */
export const clearApiKeyCache = (): void => {
    apiKeyCache = null;
    lastCacheTime = 0;
    console.log('🔄 [Gemini Live] API key cache cleared');
};
