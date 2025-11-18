/**
 * API Key Rotation Service
 * Manages multiple Gemini API keys and rotates between them when rate limits are hit
 */

interface ApiKeyStatus {
  key: string;
  isAvailable: boolean;
  rateLimitResetTime: number | null;
  failureCount: number;
}

const maskExternalKey = (key: string): string => {
  if (!key) return '';
  return key.length <= 13 ? key : `${key.substring(0, 10)}...${key.substring(key.length - 3)}`;
};

class ApiKeyRotationService {
  private apiKeys: ApiKeyStatus[] = [];
  private currentIndex: number = 0;
  private readonly RATE_LIMIT_COOLDOWN = 60000; // 60 seconds cooldown after rate limit

  constructor(keys: string[]) {
    this.apiKeys = keys.map(key => ({
      key: key.trim(),
      isAvailable: true,
      rateLimitResetTime: null,
      failureCount: 0,
    }));
  }

  /**
   * Get the next available API key
   */
  getNextKey(): string | null {
    const now = Date.now();

    // Reset keys that have passed their cooldown period
    this.apiKeys.forEach(keyStatus => {
      if (keyStatus.rateLimitResetTime && now >= keyStatus.rateLimitResetTime) {
        keyStatus.isAvailable = true;
        keyStatus.rateLimitResetTime = null;
        keyStatus.failureCount = 0;
        console.log(`🔄 API key ${this.maskKey(keyStatus.key)} cooldown expired, now available`);
      }
    });

    // Try to find an available key starting from current index
    for (let i = 0; i < this.apiKeys.length; i++) {
      const index = (this.currentIndex + i) % this.apiKeys.length;
      const keyStatus = this.apiKeys[index];

      if (keyStatus.isAvailable) {
        this.currentIndex = (index + 1) % this.apiKeys.length;
        console.log(`✅ Using API key: ${this.maskKey(keyStatus.key)} (${index + 1}/${this.apiKeys.length})`);
        return keyStatus.key;
      }
    }

    console.error('❌ No available API keys! All keys are rate limited.');
    return null;
  }

  /**
   * Get current API key without rotating
   */
  getCurrentKey(): string | null {
    const index = (this.currentIndex - 1 + this.apiKeys.length) % this.apiKeys.length;
    const keyStatus = this.apiKeys[index];
    return keyStatus.isAvailable ? keyStatus.key : this.getNextKey();
  }

  /**
   * Mark a key as rate limited
   */
  markAsRateLimited(key: string, retryAfterSeconds?: number): void {
    const keyStatus = this.apiKeys.find(k => k.key === key);
    if (keyStatus) {
      if (this.apiKeys.length <= 1) {
        console.warn(
          `⚠️ Single-key mode: received rate limit for ${this.maskKey(key)} but keeping it active per configuration.`
        );
        keyStatus.failureCount++;
        return;
      }
      keyStatus.isAvailable = false;
      keyStatus.failureCount++;
      
      // Use provided retry time or default cooldown
      const cooldownMs = retryAfterSeconds 
        ? retryAfterSeconds * 1000 
        : this.RATE_LIMIT_COOLDOWN;
      
      keyStatus.rateLimitResetTime = Date.now() + cooldownMs;
      
      const minutes = Math.ceil(cooldownMs / 60000);
      console.warn(`⚠️ API key ${this.maskKey(key)} rate limited. Cooldown: ${minutes} minute(s)`);
      console.log(`🔄 Rotating to next available API key...`);
    }
  }

  /**
   * Mark a key as failed (for non-rate-limit errors)
   */
  markAsFailed(key: string, isExpired: boolean = false): void {
    const keyStatus = this.apiKeys.find(k => k.key === key);
    if (keyStatus) {
      keyStatus.failureCount++;
      
      // If key is expired, disable it permanently
      if (isExpired) {
        keyStatus.isAvailable = false;
        keyStatus.rateLimitResetTime = null; // No cooldown for expired keys
        console.error(`❌ API key ${this.maskKey(key)} is EXPIRED and needs renewal`);
        return;
      }
      
      // If key fails too many times, temporarily disable it
      if (keyStatus.failureCount >= 3) {
        if (this.apiKeys.length <= 1) {
          console.warn(
            `⚠️ Single-key mode: encountered repeated failures for ${this.maskKey(
              key
            )} but keeping it active per configuration.`
          );
          return;
        }
        keyStatus.isAvailable = false;
        keyStatus.rateLimitResetTime = Date.now() + this.RATE_LIMIT_COOLDOWN;
        console.warn(`⚠️ API key ${this.maskKey(key)} disabled due to repeated failures`);
      }
    }
  }

  /**
   * Get statistics about key usage
   */
  getStats(): { total: number; available: number; rateLimited: number; expired: number } {
    const now = Date.now();
    let available = 0;
    let rateLimited = 0;
    let expired = 0;
    
    this.apiKeys.forEach(k => {
      if (k.isAvailable || (k.rateLimitResetTime && now >= k.rateLimitResetTime)) {
        available++;
      } else if (!k.isAvailable && !k.rateLimitResetTime) {
        expired++;
      } else {
        rateLimited++;
      }
    });
    
    return {
      total: this.apiKeys.length,
      available,
      rateLimited,
      expired
    };
  }

  /**
   * Mask API key for logging (show first 10 and last 3 characters)
   */
  private maskKey(key: string): string {
    if (key.length <= 13) return key;
    return `${key.substring(0, 10)}...${key.substring(key.length - 3)}`;
  }

  /**
   * Reset all keys to available state
   */
  resetAllKeys(): void {
    this.apiKeys.forEach(keyStatus => {
      keyStatus.isAvailable = true;
      keyStatus.rateLimitResetTime = null;
      keyStatus.failureCount = 0;
    });
    console.log('🔄 All API keys reset to available state');
  }
}

// Initialize with API keys from Firestore (these are fallback keys)
// The actual keys are loaded dynamically from Firestore at runtime
const FALLBACK_API_KEYS: string[] = [];

let apiKeyRotation: ApiKeyRotationService = new ApiKeyRotationService(FALLBACK_API_KEYS);

/**
 * Initialize API key rotation with keys from Firestore
 */
export const initializeApiKeyRotation = async (): Promise<void> => {
  try {
    const { getAllApiKeys } = await import('../firebase/apiKeys');
    const firestoreKeys = await getAllApiKeys();
    
    if (firestoreKeys.length > 0) {
      console.log(`✅ Initializing API key rotation with ${firestoreKeys.length} keys from Firestore`);
      apiKeyRotation = new ApiKeyRotationService(firestoreKeys);
    } else {
      console.warn('⚠️ No API keys found in Firestore, using empty rotation service');
      apiKeyRotation = new ApiKeyRotationService([]);
    }
  } catch (error) {
    console.error('❌ Error initializing API key rotation:', error);
    apiKeyRotation = new ApiKeyRotationService([]);
  }
};

export { apiKeyRotation };

const USER_KEY_COOLDOWN_MS = 60000;
let userProvidedApiKey: string | null = null;
let userApiKeyCooldownUntil: number | null = null;
let userApiKeyFailureCount = 0;

const isUserKeyAvailable = () => {
  if (!userProvidedApiKey) return false;
  if (userApiKeyCooldownUntil && Date.now() < userApiKeyCooldownUntil) {
    return false;
  }
  return true;
};

const markUserKeyRateLimited = (retrySeconds?: number) => {
  if (!userProvidedApiKey) {
    return;
  }
  const cooldownMs = retrySeconds ? retrySeconds * 1000 : USER_KEY_COOLDOWN_MS;
  userApiKeyCooldownUntil = Date.now() + cooldownMs;
  userApiKeyFailureCount++;
  const seconds = Math.ceil(cooldownMs / 1000);
  console.warn(
    `⚠️ User API key ${maskExternalKey(userProvidedApiKey)} rate limited. Cooldown: ~${seconds}s`
  );
};

export const registerUserProvidedApiKey = (apiKey: string | null): void => {
  if (apiKey) {
    userProvidedApiKey = apiKey.trim();
    console.log(`🔑 Registered user Gemini key ${maskExternalKey(userProvidedApiKey)}`);
  } else {
    userProvidedApiKey = null;
  }
  userApiKeyCooldownUntil = null;
  userApiKeyFailureCount = 0;
};

export const clearUserProvidedApiKey = (): void => {
  registerUserProvidedApiKey(null);
};

/**
 * Wrapper function to execute a Gemini API call with automatic key rotation
 */
export async function executeWithRotation<T>(
  apiCall: (apiKey: string) => Promise<T>,
  maxRetries?: number
): Promise<T> {
  const stats = apiKeyRotation.getStats();
  const rotationKeyCount = Math.max(0, stats.total);
  const effectiveMaxRetries = typeof maxRetries === 'number' ? maxRetries : Math.max(1, rotationKeyCount);

  let lastError: Error | null = null;
  const totalAttempts = effectiveMaxRetries + (userProvidedApiKey ? 1 : 0);
  let userKeyAttempted = false;
  
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    let apiKey: string | null = null;
    let usingUserKey = false;

    if (attempt < effectiveMaxRetries) {
      apiKey = apiKeyRotation.getNextKey();
    }

    if (!apiKey) {
      if (userProvidedApiKey && !userKeyAttempted) {
        if (isUserKeyAvailable()) {
          apiKey = userProvidedApiKey;
          usingUserKey = true;
          userKeyAttempted = true;
          console.log(`✅ Using user-provided Gemini key ${maskExternalKey(userProvidedApiKey)}`);
        } else {
          const remainingMs = userApiKeyCooldownUntil ? Math.max(0, userApiKeyCooldownUntil - Date.now()) : USER_KEY_COOLDOWN_MS;
          const waitSeconds = Math.ceil(remainingMs / 1000);
          const cooldownError: any = new Error(
            `Your personal Gemini API key is cooling down for ~${waitSeconds}s due to rate limits. Add a fresh key in Settings or wait before retrying.`
          );
          cooldownError.code = 'USER_KEY_RATE_LIMITED';
          throw cooldownError;
        }
      } else {
        if (userProvidedApiKey) {
          const requireError: any = new Error(
            'All shared Gemini API keys are currently rate limited. Your personal key is required to continue. Please add a Gemini API key in Settings.'
          );
          requireError.code = 'USER_KEY_REQUIRED';
          throw requireError;
        }
        const stats = apiKeyRotation.getStats();
        const noKeyError: any = new Error(
          `All ${stats.total} shared Gemini API keys are currently rate limited. Please add your own Gemini API key in Settings or wait a few minutes and try again.`
        );
        noKeyError.code = 'USER_KEY_REQUIRED';
        throw noKeyError;
      }
    }

    try {
      const result = await apiCall(apiKey);
      return result;
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message ?? '').toLowerCase();
      const retryMatch = error?.message?.match(/retry in ([\d.]+)s/i);
      const retrySeconds = retryMatch ? parseFloat(retryMatch[1]) : undefined;

      if (message.includes('api key expired') || message.includes('api_key_invalid')) {
        if (usingUserKey) {
          const invalidError: any = new Error(
            'Your Gemini API key appears invalid or expired. Please update it in Settings.'
          );
          invalidError.code = 'USER_KEY_INVALID';
          throw invalidError;
        }
        apiKeyRotation.markAsFailed(apiKey, true);
        console.error(`Attempt ${attempt + 1}/${totalAttempts}: API key expired, rotating to next key...`);
        continue;
      }

      if (message.includes('429') || message.includes('quota exceeded') || message.includes('rate limit')) {
        if (usingUserKey) {
          markUserKeyRateLimited(retrySeconds);
          const stats = apiKeyRotation.getStats();
          if (stats.available === 0) {
            const exhaustedError: any = new Error(
              'Your Gemini API key hit its rate limit. Add another key in Settings or wait before retrying.'
            );
            exhaustedError.code = 'USER_KEY_RATE_LIMITED';
            throw exhaustedError;
          }
          console.warn('User-provided key rate limited, falling back to shared pool.');
          continue;
        }
        apiKeyRotation.markAsRateLimited(apiKey, retrySeconds);
        console.log(`Attempt ${attempt + 1}/${totalAttempts}: Rate limit hit, rotating to next key...`);
        continue;
      }

      if (message.includes('404') || message.includes('not found')) {
        throw error;
      }

      if (usingUserKey) {
        userApiKeyFailureCount++;
        throw error;
      }

      apiKeyRotation.markAsFailed(apiKey, false);
      console.warn(`Attempt ${attempt + 1}/${totalAttempts}: API call failed:`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error('All API key rotation attempts failed');
}

export default apiKeyRotation;
