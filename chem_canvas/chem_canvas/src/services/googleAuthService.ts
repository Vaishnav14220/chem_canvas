/**
 * Google Authentication Service
 * Handles OAuth2 authentication for Google Docs integration
 * 
 * Uses Google Identity Services (GIS) for sign-in
 * and Google API Client Library for Docs API access
 */

// ==========================================
// Types
// ==========================================

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  expiresAt: number;
}

export interface GoogleAuthState {
  isSignedIn: boolean;
  user: GoogleUser | null;
  isLoading: boolean;
  error: string | null;
}

type AuthStateListener = (state: GoogleAuthState) => void;

// ==========================================
// Configuration
// ==========================================

// Google Cloud Console Client ID - Users need to set this in their environment
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Scopes required for Google Docs
const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

// Storage keys
const STORAGE_KEY = 'google_auth_user';

// ==========================================
// State Management
// ==========================================

let authState: GoogleAuthState = {
  isSignedIn: false,
  user: null,
  isLoading: false,
  error: null
};

const listeners: Set<AuthStateListener> = new Set();

function notifyListeners() {
  listeners.forEach(listener => listener(authState));
}

function updateAuthState(updates: Partial<GoogleAuthState>) {
  authState = { ...authState, ...updates };
  notifyListeners();
}

// ==========================================
// Google Identity Services Integration
// ==========================================

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let isGisLoaded = false;

/**
 * Load Google Identity Services script
 */
function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isGisLoaded) {
      resolve();
      return;
    }

    // Check if already loaded
    if (window.google?.accounts?.oauth2) {
      isGisLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isGisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Initialize the token client
 */
function initTokenClient(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your environment.'));
      return;
    }

    try {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error) {
            updateAuthState({
              isLoading: false,
              error: response.error_description || 'Authentication failed'
            });
            return;
          }

          try {
            // Get user info
            const userInfo = await fetchUserInfo(response.access_token);
            const user: GoogleUser = {
              id: userInfo.id,
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture,
              accessToken: response.access_token,
              expiresAt: Date.now() + (response.expires_in * 1000)
            };

            // Save to storage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(user));

            updateAuthState({
              isSignedIn: true,
              user,
              isLoading: false,
              error: null
            });
          } catch (err) {
            updateAuthState({
              isLoading: false,
              error: 'Failed to get user info'
            });
          }
        },
        error_callback: (error) => {
          console.error('Token client error:', error);
          updateAuthState({
            isLoading: false,
            error: error.message || 'Authentication error'
          });
        }
      });
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fetch user info from Google
 */
async function fetchUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
}> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return response.json();
}

// ==========================================
// Public API
// ==========================================

/**
 * Initialize the Google Auth service
 */
export async function initGoogleAuth(): Promise<void> {
  updateAuthState({ isLoading: true, error: null });

  try {
    // Load Google script
    await loadGoogleScript();

    // Initialize token client
    await initTokenClient();

    // Check for existing session
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const user: GoogleUser = JSON.parse(stored);
      
      // Check if token is still valid
      if (user.expiresAt > Date.now()) {
        updateAuthState({
          isSignedIn: true,
          user,
          isLoading: false
        });
        return;
      } else {
        // Token expired, clear it
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    updateAuthState({ isLoading: false });
  } catch (err) {
    console.error('Failed to initialize Google Auth:', err);
    updateAuthState({
      isLoading: false,
      error: err instanceof Error ? err.message : 'Failed to initialize'
    });
  }
}

/**
 * Sign in with Google
 */
export function signInWithGoogle(): void {
  if (!tokenClient) {
    updateAuthState({ error: 'Auth not initialized. Please refresh the page.' });
    return;
  }

  updateAuthState({ isLoading: true, error: null });

  // Check if we have a stored token that's still valid
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const user: GoogleUser = JSON.parse(stored);
    if (user.expiresAt > Date.now()) {
      // Token still valid, just use it
      updateAuthState({
        isSignedIn: true,
        user,
        isLoading: false
      });
      return;
    }
  }

  // Request new token
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

/**
 * Sign out
 */
export function signOutGoogle(): void {
  const user = authState.user;
  
  if (user?.accessToken) {
    // Revoke the token
    google.accounts.oauth2.revoke(user.accessToken, () => {
      console.log('Token revoked');
    });
  }

  localStorage.removeItem(STORAGE_KEY);
  
  updateAuthState({
    isSignedIn: false,
    user: null,
    error: null
  });
}

/**
 * Get current auth state
 */
export function getAuthState(): GoogleAuthState {
  return authState;
}

/**
 * Get current access token (refreshing if needed)
 */
export async function getAccessToken(): Promise<string | null> {
  const user = authState.user;
  
  if (!user) {
    return null;
  }

  // Check if token is still valid (with 5 min buffer)
  if (user.expiresAt > Date.now() + 5 * 60 * 1000) {
    return user.accessToken;
  }

  // Token expired or about to expire, request new one
  return new Promise((resolve) => {
    if (!tokenClient) {
      resolve(null);
      return;
    }

    const originalCallback = tokenClient.callback;
    tokenClient.callback = async (response) => {
      if (response.error) {
        resolve(null);
        return;
      }

      const newUser: GoogleUser = {
        ...user,
        accessToken: response.access_token,
        expiresAt: Date.now() + (response.expires_in * 1000)
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      updateAuthState({ user: newUser });
      resolve(response.access_token);
    };

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuthState(listener: AuthStateListener): () => void {
  listeners.add(listener);
  // Immediately call with current state
  listener(authState);
  
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Check if Google Auth is configured
 */
export function isGoogleAuthConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

/**
 * Check if user is signed in
 */
export function isSignedIn(): boolean {
  return authState.isSignedIn;
}

/**
 * Get current user
 */
export function getCurrentUser(): GoogleUser | null {
  return authState.user;
}

// ==========================================
// Aliases for compatibility with GoogleDocsIntegration
// ==========================================

/** Alias for initGoogleAuth */
export const initializeGoogleAuth = initGoogleAuth;

/** Alias for signOutGoogle */
export const signOut = signOutGoogle;

/** Check if Google Auth has been initialized */
export function isGoogleAuthInitialized(): boolean {
  return isGisLoaded && tokenClient !== null;
}

/** Alias for GoogleUser type */
export type GoogleUserInfo = GoogleUser;

// ==========================================
// Type declarations for Google Identity Services
// ==========================================

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token: string;
              expires_in: number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: { message: string }) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
            callback: (response: any) => void;
          };
          revoke: (token: string, callback: () => void) => void;
        };
      };
    };
  }
}

export default {
  initGoogleAuth,
  initializeGoogleAuth,
  signInWithGoogle,
  signOutGoogle,
  signOut,
  getAuthState,
  getAccessToken,
  subscribeToAuthState,
  isGoogleAuthConfigured,
  isGoogleAuthInitialized,
  isSignedIn,
  getCurrentUser
};
