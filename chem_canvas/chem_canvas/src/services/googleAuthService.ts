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
  'https://www.googleapis.com/auth/drive.readonly', // Changed from drive.file to see all docs
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

/**
 * Create a new Google Doc
 */
export async function createGoogleDoc(title: string): Promise<{ documentId: string; title: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error('Failed to create document');
  }

  return response.json();
}

/**
 * Update a Google Doc content with proper formatting
 * Uses a simplified approach to avoid index calculation bugs
 */
export async function updateGoogleDoc(documentId: string, content: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  // First, get the document to know the end index
  const docResponse = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  if (!docResponse.ok) throw new Error('Failed to get document details');
  const doc = await docResponse.json();
  const endIndex = doc.body?.content?.[doc.body.content.length - 1]?.endIndex || 1;

  // Build requests to clear and insert new content
  const requests: any[] = [];

  // Delete existing content if any (keep last newline)
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }

  // Convert markdown to clean plain text (no formatting attempts to avoid index bugs)
  const plainText = convertMarkdownToPlainText(content);

  // Insert plain text
  if (plainText && plainText.trim()) {
    requests.push({
      insertText: {
        location: { index: 1 },
        text: plainText,
      },
    });
  }

  if (requests.length === 0) return;

  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Google Docs API error:', error);
    throw new Error(error.error?.message || 'Failed to update document');
  }
}

/**
 * Convert markdown content to clean plain text
 * Removes markdown syntax while preserving readable structure
 */
function convertMarkdownToPlainText(markdown: string): string {
  let text = markdown;

  // Remove bold markers **text** -> text
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  // Remove italic markers *text* -> text
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
  
  // Convert headers # Title -> TITLE (uppercase for emphasis)
  text = text.replace(/^###\s+(.+)$/gm, (_, title) => `\n${title}\n`);
  text = text.replace(/^##\s+(.+)$/gm, (_, title) => `\n${title.toUpperCase()}\n${'─'.repeat(Math.min(title.length, 40))}\n`);
  text = text.replace(/^#\s+(.+)$/gm, (_, title) => `\n${'═'.repeat(Math.min(title.length, 40))}\n${title.toUpperCase()}\n${'═'.repeat(Math.min(title.length, 40))}\n`);
  
  // Convert bullet points
  text = text.replace(/^[\*\-]\s+/gm, '• ');
  
  // Convert numbered lists (preserve)
  text = text.replace(/^(\d+)\.\s+/gm, '$1. ');
  
  // Convert code blocks ```code``` -> [code]
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, '\n────────────────────\n$1\n────────────────────\n');
  
  // Convert inline code `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1');
  
  // Convert links [text](url) -> text (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  
  // Convert horizontal rules
  text = text.replace(/^---+$/gm, '\n' + '─'.repeat(40) + '\n');
  
  // Clean up excessive newlines
  text = text.replace(/\n{4,}/g, '\n\n\n');
  
  // Trim whitespace
  text = text.trim();
  
  return text;
}

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

// Alias exports for backward compatibility
export const initializeGoogleAuth = initGoogleAuth;
export const signOut = signOutGoogle;
export const isGoogleAuthInitialized = isGoogleAuthConfigured;
export type GoogleUserInfo = GoogleUser;

export default {
  initGoogleAuth,
  signInWithGoogle,
  signOutGoogle,
  getAuthState,
  getAccessToken,
  subscribeToAuthState,
  isGoogleAuthConfigured,
  isSignedIn,
  getCurrentUser,
  // Aliases
  initializeGoogleAuth: initGoogleAuth,
  signOut: signOutGoogle,
  isGoogleAuthInitialized: isGoogleAuthConfigured
};
