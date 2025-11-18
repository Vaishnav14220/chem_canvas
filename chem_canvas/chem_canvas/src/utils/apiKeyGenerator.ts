/**
 * Pool of available Gemini API keys
 */
const GEMINI_API_KEYS = [
  'AIzaSyDCU9K42G7wKxgszFe-1UeT7rtU0WeST8s',
  'AIzaSyADO5LrzSQ8qlvJIzIIatoAZpdHwj6ALIU',
  'AIzaSyCUfMvcDk8WL1x4PhhVY0LTb-AQv-JuYxY',
  'AIzaSyCWhMeny53BDqW00eEkJTNJpwbBxTnln90'
];

/**
 * Assign a random Gemini API key from the pool
 */
export const assignGeminiApiKey = (): string => {
  // Generate random index to select from the pool
  const randomIndex = Math.floor(Math.random() * GEMINI_API_KEYS.length);
  return GEMINI_API_KEYS[randomIndex];
};

/**
 * Get all available API keys (for admin purposes)
 */
export const getAllApiKeys = (): string[] => {
  return [...GEMINI_API_KEYS];
};

/**
 * Get API key count
 */
export const getApiKeyCount = (): number => {
  return GEMINI_API_KEYS.length;
};

/**
 * Validate API key format (Google Gemini API key format)
 */
export const isValidApiKeyFormat = (apiKey: string): boolean => {
  // Google API keys typically start with AIza and are 39 characters long
  const pattern = /^AIza[0-9A-Za-z-_]{35}$/;
  return pattern.test(apiKey);
};

/**
 * Check if API key is from our pool
 */
export const isFromApiKeyPool = (apiKey: string): boolean => {
  return GEMINI_API_KEYS.includes(apiKey);
};

/**
 * Get API key assignment info
 */
export const getApiKeyInfo = (apiKey: string): { isValid: boolean; isFromPool: boolean; poolIndex?: number } => {
  const isValid = isValidApiKeyFormat(apiKey);
  const isFromPool = isFromApiKeyPool(apiKey);
  const poolIndex = isFromPool ? GEMINI_API_KEYS.indexOf(apiKey) : undefined;
  
  return {
    isValid,
    isFromPool,
    poolIndex
  };
};

/**
 * Get API key usage statistics (for admin purposes)
 */
export const getApiKeyStats = () => {
  return {
    totalKeys: GEMINI_API_KEYS.length,
    keys: GEMINI_API_KEYS.map((key, index) => ({
      index: index + 1,
      key: key.substring(0, 10) + '...', // Show only first 10 chars for security
      fullKey: key
    }))
  };
};
