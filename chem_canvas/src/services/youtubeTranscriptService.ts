const TRANSCRIPT_LANGUAGES = ['en', 'en-US', 'en-GB', 'de', 'es'];

const normalizeTranscript = (segments: Array<{ text: string }>): string => {
  return segments
    .map((segment) => segment.text?.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const fetchYouTubeTranscript = async (videoId: string): Promise<string | null> => {
  for (const lang of TRANSCRIPT_LANGUAGES) {
    try {
      const response = await fetch(`https://youtubetranscript.googleapis.com/api/v1?lang=${lang}&v=${videoId}`);
      if (!response.ok) {
        continue;
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const transcript = normalizeTranscript(data as Array<{ text: string }>);
        if (transcript) {
          return transcript;
        }
      }
    } catch (error) {
      console.warn(`Transcript fetch failed for ${videoId} (${lang}):`, error);
    }
  }
  return null;
};

export const extractVideoIdFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '');
    }
    if (parsed.searchParams.has('v')) {
      return parsed.searchParams.get('v');
    }
    if (parsed.pathname.startsWith('/shorts/')) {
      return parsed.pathname.replace('/shorts/', '');
    }
    return null;
  } catch {
    return null;
  }
};
