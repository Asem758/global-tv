import type { YouTubeLiveItem } from '../../src/types/tv.ts';

interface CachedSearch {
  expiresAt: number;
  items: YouTubeLiveItem[];
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes to protect API quota
const searchCache = new Map<string, CachedSearch>();

export function isYouTubeApiConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.trim().length > 0);
}

export async function searchYouTubeLiveBroadcasts(options: {
  query: string;
  regionCode?: string;
  maxResults?: number;
}): Promise<{
  configured: boolean;
  cached: boolean;
  items: YouTubeLiveItem[];
  message?: string;
}> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    return {
      configured: false,
      cached: false,
      items: [],
      message:
        'YOUTUBE_API_KEY is not configured on the server. Add it to your environment secrets to enable live YouTube broadcast discovery.',
    };
  }

  const maxResults = Math.min(Math.max(options.maxResults || 12, 1), 25);
  const cacheKey = `${options.query.toLowerCase()}::${options.regionCode || ''}::${maxResults}`;
  const now = Date.now();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return {
      configured: true,
      cached: true,
      items: cached.items,
    };
  }

  const params = new URLSearchParams({
    part: 'snippet',
    eventType: 'live',
    type: 'video',
    videoEmbeddable: 'true',
    q: options.query,
    maxResults: String(maxResults),
    key: apiKey,
  });

  if (options.regionCode && /^[A-Z]{2}$/.test(options.regionCode)) {
    params.set('regionCode', options.regionCode);
  }

  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`YouTube API error (${response.status}): ${errBody.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: {
          high?: { url?: string };
          medium?: { url?: string };
          default?: { url?: string };
        };
      };
    }>;
  };

  const items: YouTubeLiveItem[] = (data.items || [])
    .filter((entry) => entry.id?.videoId && entry.snippet?.title)
    .map((entry) => ({
      videoId: entry.id!.videoId!,
      title: entry.snippet!.title!,
      channelTitle: entry.snippet!.channelTitle || 'Official Broadcaster',
      description: entry.snippet!.description || '',
      thumbnailUrl:
        entry.snippet!.thumbnails?.high?.url ||
        entry.snippet!.thumbnails?.medium?.url ||
        entry.snippet!.thumbnails?.default?.url ||
        '',
      publishedAt: entry.snippet!.publishedAt || new Date().toISOString(),
    }));

  searchCache.set(cacheKey, {
    expiresAt: now + CACHE_TTL_MS,
    items,
  });

  return {
    configured: true,
    cached: false,
    items,
  };
}
