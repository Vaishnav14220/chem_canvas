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

// Initialize with the provided API keys
const API_KEYS = [
  'AIzaSyB-tNZJbugXSKwwveqk7ji_RNbm5yWYe4E',
  'AIzaSyDy_DUCqFj_tmYsttiVDawfhJZI_FDR8UM',
  'AIzaSyDS4KZFYo-exE18dOd4-CazhaPZHQ7HCfM',
  'AIzaSyDdzG4KUT1tDBfG4mKLfd91vLsShhM0npM',
  'AIzaSyDduTBWvvw_Ic6dJxwkjQTC-4Q6olrokmk',
  'AIzaSyA32sBFWhWMmOshLa_vCMVvhC3gB0WQhZk',
  'AIzaSyApxHUbxothId5_jeoFHwuwz7fx7v2_H6k',
];

export const apiKeyRotation = new ApiKeyRotationService(API_KEYS);

/**
 * Wrapper function to execute a Gemini API call with automatic key rotation
 */
export async function executeWithRotation<T>(
  apiCall: (apiKey: string) => Promise<T>,
  maxRetries: number = API_KEYS.length
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = apiKeyRotation.getNextKey();
    
    if (!apiKey) {
      const stats = apiKeyRotation.getStats();
      
      // Check if keys are expired vs rate limited
      const expiredCount = API_KEYS.filter((_, idx) => {
        const keyStatus = (apiKeyRotation as any).apiKeys[idx];
        return !keyStatus.isAvailable && !keyStatus.rateLimitResetTime;
      }).length;
      
      if (expiredCount > 0) {
        throw new Error(
          `❌ ${expiredCount} API key(s) have EXPIRED and need to be renewed. ` +
          `Remaining ${stats.total - expiredCount} keys are rate limited. ` +
          `Please renew your API keys at: https://aistudio.google.com/app/apikey`
        );
      }
      
      throw new Error(
        `All ${stats.total} API keys are currently rate limited. ` +
        `Please wait a few minutes and try again.`
      );
    }

    try {
      const result = await apiCall(apiKey);
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's an expired API key error (400 with API_KEY_INVALID)
      if (error.message?.includes('400') && 
          (error.message?.toLowerCase().includes('api key expired') ||
           error.message?.toLowerCase().includes('api_key_invalid'))) {
        
        apiKeyRotation.markAsFailed(apiKey, true); // Mark as expired
        console.error(`Attempt ${attempt + 1}/${maxRetries}: API key expired, rotating to next key...`);
        continue;
      }
      
      // Check if it's a rate limit error (429)
      if (error.message?.includes('429') || 
          error.message?.toLowerCase().includes('quota exceeded') ||
          error.message?.toLowerCase().includes('rate limit')) {
        
        // Extract retry time if available
        const retryMatch = error.message.match(/retry in ([\d.]+)s/i);
        const retrySeconds = retryMatch ? parseFloat(retryMatch[1]) : undefined;
        
        apiKeyRotation.markAsRateLimited(apiKey, retrySeconds);
        console.log(`Attempt ${attempt + 1}/${maxRetries}: Rate limit hit, rotating to next key...`);
        continue;
      }
      
      // For other errors, mark as failed but continue trying
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        // Model not found - don't retry with other keys
        throw error;
      }
      
      apiKeyRotation.markAsFailed(apiKey, false);
      console.warn(`Attempt ${attempt + 1}/${maxRetries}: API call failed:`, error.message);
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error('All API key rotation attempts failed');
}

export default apiKeyRotation;
