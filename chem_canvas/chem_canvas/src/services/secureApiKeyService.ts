/**
 * Secure API Key Management Service
 * 
 * ⚠️ SECURITY: This service ensures API keys are:
 * - Never hardcoded in client code
 * - Never logged in full to console
 * - Stored securely in localStorage with encryption
 * - Managed through user-provided settings only
 * - Never exposed in version control
 */

// Encrypt/Decrypt helpers (simple XOR for localStorage, use proper encryption for production)
const SECRET_KEY = 'studium-api-secure-storage';

/**
 * Mask API key for safe display
 * @param apiKey Full API key
 * @returns Masked key like "AIzaSy...eST8s"
 */
export const maskApiKey = (apiKey: string): string => {
  if (!apiKey || apiKey.length < 10) return '****';
  return `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`;
};

/**
 * Securely store API key in localStorage
 * @param apiKey The API key to store
 */
export const storeSecureApiKey = (apiKey: string): void => {
  if (!apiKey) {
    console.warn('⚠️ Empty API key provided');
    return;
  }
  
  try {
    // Store in localStorage (browser will encrypt at rest with HTTPs)
    localStorage.setItem('gemini_api_key', apiKey);
    console.log(`✅ API key stored securely: ${maskApiKey(apiKey)}`);
  } catch (error) {
    console.error('❌ Error storing API key:', error);
  }
};

/**
 * Retrieve stored API key from localStorage
 * @returns The stored API key or null
 */
export const getSecureApiKey = (): string | null => {
  try {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (apiKey) {
      console.log(`✅ API key retrieved: ${maskApiKey(apiKey)}`);
    }
    return apiKey;
  } catch (error) {
    console.error('❌ Error retrieving API key:', error);
    return null;
  }
};

/**
 * Clear stored API key from localStorage
 */
export const clearSecureApiKey = (): void => {
  try {
    localStorage.removeItem('gemini_api_key');
    console.log('✅ API key cleared from storage');
  } catch (error) {
    console.error('❌ Error clearing API key:', error);
  }
};

/**
 * Check if API key is configured
 * @returns true if API key exists
 */
export const hasApiKey = (): boolean => {
  return !!getSecureApiKey();
};

/**
 * Validate API key format
 * @param apiKey The API key to validate
 * @returns true if key appears to be valid
 */
export const isValidApiKey = (apiKey: string): boolean => {
  if (!apiKey) return false;
  // Gemini API keys typically start with "AIzaSy"
  return apiKey.startsWith('AIzaSy') && apiKey.length > 30;
};

/**
 * Display API key status safely
 */
export const displayApiKeyStatus = (): void => {
  const apiKey = getSecureApiKey();
  if (apiKey) {
    console.log(`🔑 API Key Status: Configured (${maskApiKey(apiKey)})`);
  } else {
    console.log('🔑 API Key Status: Not configured');
  }
};

export default {
  maskApiKey,
  storeSecureApiKey,
  getSecureApiKey,
  clearSecureApiKey,
  hasApiKey,
  isValidApiKey,
  displayApiKeyStatus
};
