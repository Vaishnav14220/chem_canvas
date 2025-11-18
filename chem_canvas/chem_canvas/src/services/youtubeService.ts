// @ts-nocheck
export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  description: string;
  channelTitle: string;
  channelId?: string;
  subscriberCount?: number;
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

const fetchChannelSubscriberCounts = async (channelIds: string[], apiKey: string): Promise<Record<string, number>> => {
  const stats: Record<string, number> = {};
  const uniqueIds = Array.from(new Set(channelIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return stats;
  }

  const chunkSize = 50;
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const params = new URLSearchParams({
      key: apiKey,
      part: 'statistics',
      id: chunk.join(',')
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube Channels API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    if (Array.isArray(data?.items)) {
      data.items.forEach((item: any) => {
        const channelId = item?.id;
        const subs = Number(item?.statistics?.subscriberCount ?? 0);
        const hidden = item?.statistics?.hiddenSubscriberCount;
        if (channelId && !hidden && Number.isFinite(subs)) {
          stats[channelId] = subs;
        }
      });
    }
  }

  return stats;
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

  const channelStats = await fetchChannelSubscriberCounts(
    data.items
      .map((item: any) => item?.snippet?.channelId)
      .filter((id: string | null | undefined): id is string => Boolean(id)),
    apiKey
  );

  return data.items
    .map((item: any) => {
    const snippet = item?.snippet || {};
    const videoId = item?.id?.videoId;
    const channelId = snippet.channelId || '';
    const subscriberCount = channelStats[channelId];
    if (!subscriberCount || subscriberCount < 1000) {
      return null;
    }
    return {
      id: videoId,
      title: snippet.title || 'Untitled video',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      description: snippet.description || '',
      channelTitle: snippet.channelTitle || 'Unknown channel',
      channelId,
      subscriberCount,
      publishedAt: snippet.publishedAt || '',
      thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
    };
  })
    .filter((video): video is YouTubeVideo => Boolean(video && video.id));
};
