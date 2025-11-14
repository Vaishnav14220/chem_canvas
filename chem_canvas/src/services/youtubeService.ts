export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

interface YouTubeSearchParams {
  query: string;
  maxResults?: number;
}

const DEFAULT_YOUTUBE_API_KEY = 'AIzaSyCdlUBoT3kk1ymrQGtq1_g-v0iaJMDRYJA';

const getApiKey = () => {
  const key = import.meta.env?.VITE_YOUTUBE_API_KEY || DEFAULT_YOUTUBE_API_KEY;
  if (!key) {
    throw new Error('YouTube API key is not configured.');
  }
  return key;
};

export const fetchYouTubeVideos = async ({
  query,
  maxResults = 3,
}: YouTubeSearchParams): Promise<YouTubeVideo[]> => {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    key: apiKey,
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: String(maxResults),
    videoEmbeddable: 'true',
    safeSearch: 'moderate',
    order: 'relevance',
  });

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YouTube API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data?.items)) {
    return [];
  }

  return data.items.map((item: any) => {
    const snippet = item?.snippet || {};
    const videoId = item?.id?.videoId;
    return {
      id: videoId,
      title: snippet.title || 'Untitled video',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      description: snippet.description || '',
      channelTitle: snippet.channelTitle || 'Unknown channel',
      publishedAt: snippet.publishedAt || '',
      thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
    };
  });
};
