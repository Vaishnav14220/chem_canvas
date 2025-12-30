import type { SupportedLanguage } from '../components/GeminiLive/types';

export type GeminiResponseStyle = 'concise' | 'balanced' | 'detailed';
export type GeminiPreferenceLanguage = SupportedLanguage | 'auto';

export interface GeminiPreferences {
  model: string;
  language: GeminiPreferenceLanguage;
  responseStyle: GeminiResponseStyle;
}

const STORAGE_KEY = 'studium_gemini_preferences';

export const DEFAULT_GEMINI_PREFERENCES: GeminiPreferences = {
  model: 'auto',
  language: 'auto',
  responseStyle: 'balanced',
};

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizePreferences = (value: Partial<GeminiPreferences> | null | undefined): GeminiPreferences => ({
  model: value?.model ?? DEFAULT_GEMINI_PREFERENCES.model,
  language: value?.language ?? DEFAULT_GEMINI_PREFERENCES.language,
  responseStyle: value?.responseStyle ?? DEFAULT_GEMINI_PREFERENCES.responseStyle,
});

export const getGeminiPreferences = (): GeminiPreferences => {
  if (!isBrowser()) {
    return DEFAULT_GEMINI_PREFERENCES;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_GEMINI_PREFERENCES;
    }
    const parsed = JSON.parse(stored) as Partial<GeminiPreferences>;
    return normalizePreferences(parsed);
  } catch (error) {
    console.warn('Failed to read Gemini preferences:', error);
    return DEFAULT_GEMINI_PREFERENCES;
  }
};

export const setGeminiPreferences = (preferences: GeminiPreferences): void => {
  if (!isBrowser()) {
    return;
  }
  const normalized = normalizePreferences(preferences);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
};

export const updateGeminiPreferences = (updates: Partial<GeminiPreferences>): GeminiPreferences => {
  const current = getGeminiPreferences();
  const next = normalizePreferences({ ...current, ...updates });
  setGeminiPreferences(next);
  return next;
};

export const getPreferredGeminiModel = (): string | null => {
  const { model } = getGeminiPreferences();
  return model && model !== 'auto' ? model : null;
};

export const getPreferredGeminiLanguage = (): SupportedLanguage => {
  const { language } = getGeminiPreferences();
  return language === 'auto' ? 'en' : language;
};

export const getPreferredGeminiResponseStyle = (): GeminiResponseStyle => {
  return getGeminiPreferences().responseStyle;
};
