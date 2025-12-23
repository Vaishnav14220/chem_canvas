// @ts-nocheck
/**
 * YouTube Transcript Service
 * Fetches video transcripts using multiple methods
 */

export interface TranscriptSegment {
  text: string;
  start?: number;
  duration?: number;
}

export interface VideoTranscript {
  videoId: string;
  segments: TranscriptSegment[];
  fullText: string;
  language: string;
}

const TRANSCRIPT_LANGUAGES = ['en', 'en-US', 'en-GB', 'de', 'es'];

// List of public Invidious instances for transcript fetching
// Updated with more reliable instances as of late 2024/early 2025
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.f5.si',
  'https://invidious.nerdvpn.de',
  'https://inv.perditum.com',
  'https://invidious.privacyredirect.com',
];

const normalizeTranscript = (segments: Array<{ text: string }>): string => {
  return segments
    .map((segment) => segment.text?.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Parse YouTube timedtext XML format into segments
 */
const parseTranscriptXML = (xml: string): TranscriptSegment[] => {
  const segments: TranscriptSegment[] = [];

  try {
    // Match all <text> elements
    const textMatches = xml.matchAll(/<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]*)<\/text>/g);

    for (const match of textMatches) {
      const start = parseFloat(match[1]);
      const duration = parseFloat(match[2]);
      const text = decodeHTMLEntities(match[3]).trim();

      if (text) {
        segments.push({ start, duration, text });
      }
    }
  } catch (e) {
    console.error('Failed to parse transcript XML:', e);
  }

  return segments;
};

/**
 * Decode HTML entities in transcript text
 */
const decodeHTMLEntities = (text: string): string => {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#32;': ' ',
    '&nbsp;': ' ',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return decoded;
};

/**
 * Get transcript using Invidious API (open source YouTube frontend)
 */
const fetchTranscriptViaInvidious = async (videoId: string): Promise<VideoTranscript | null> => {
  // Shuffle instances to load balance and avoid sticking to a bad one
  const instances = [...INVIDIOUS_INSTANCES].sort(() => Math.random() - 0.5);

  for (const instance of instances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${instance}/api/v1/captions/${videoId}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const captions = await response.json();

      if (captions && captions.captions && captions.captions.length > 0) {
        // Find English captions
        const englishCaption = captions.captions.find((c: any) =>
          c.language_code === 'en' || c.language_code?.startsWith('en')
        ) || captions.captions[0];

        if (englishCaption?.url) {
          const captionUrl = englishCaption.url.startsWith('http')
            ? englishCaption.url
            : `${instance}${englishCaption.url}`;

          const captionResponse = await fetch(captionUrl, {
            signal: AbortSignal.timeout(5000)
          });

          if (captionResponse.ok) {
            const captionData = await captionResponse.text();
            const segments = parseTranscriptXML(captionData);

            if (segments.length > 0) {
              return {
                videoId,
                segments,
                fullText: segments.map(s => s.text).join(' '),
                language: englishCaption.language_code || 'en'
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Invidious instance ${instance} failed:`, e);
      continue;
    }
  }

  return null;
};

/**
 * Legacy method - try YouTube transcript API
 */
const fetchTranscriptLegacy = async (videoId: string): Promise<string | null> => {
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

/**
 * Main function to fetch YouTube transcript - tries multiple methods
 */
export const fetchYouTubeTranscript = async (videoId: string): Promise<string | null> => {
  console.log(`📝 Fetching transcript for video: ${videoId}`);

  // Method 1: Try Invidious API first (most reliable)
  try {
    const invidiousResult = await fetchTranscriptViaInvidious(videoId);
    if (invidiousResult && invidiousResult.fullText) {
      console.log(`✅ Got transcript via Invidious: ${invidiousResult.segments.length} segments`);
      return invidiousResult.fullText;
    }
  } catch (e) {
    console.warn('Invidious transcript fetch failed:', e);
  }

  // Method 2: Try legacy YouTube transcript API
  try {
    const legacyResult = await fetchTranscriptLegacy(videoId);
    if (legacyResult) {
      console.log(`✅ Got transcript via legacy API`);
      return legacyResult;
    }
  } catch (e) {
    console.warn('Legacy transcript fetch failed:', e);
  }

  console.warn('❌ Could not fetch transcript for video:', videoId);
  return null;
};

/**
 * Get full transcript with segments (timestamps included)
 */
export const getVideoTranscriptWithTimestamps = async (videoId: string): Promise<VideoTranscript | null> => {
  console.log(`📝 Fetching transcript with timestamps for video: ${videoId}`);

  // Try Invidious for timestamped transcripts
  try {
    const result = await fetchTranscriptViaInvidious(videoId);
    if (result) {
      return result;
    }
  } catch (e) {
    console.warn('Failed to get timestamped transcript:', e);
  }

  // Fallback to simple text
  const simpleText = await fetchYouTubeTranscript(videoId);
  if (simpleText) {
    return {
      videoId,
      segments: [{ text: simpleText }],
      fullText: simpleText,
      language: 'en'
    };
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
