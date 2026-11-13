import { isValidPublicHttpUrl } from './m3uParser.ts';

export interface HealthCheckOutcome {
  status: 'healthy' | 'warning' | 'unreachable' | 'unconfigured';
  details: {
    http_status?: number;
    content_type?: string;
    is_hls_manifest?: boolean;
    cors_enabled?: boolean;
    latency_ms?: number;
    error?: string;
  };
}

export async function checkStreamHealth(
  streamType: string,
  streamUrl?: string | null,
  youtubeVideoId?: string | null,
  youtubeChannelId?: string | null,
): Promise<HealthCheckOutcome> {
  if (streamType === 'unconfigured') {
    return {
      status: 'unconfigured',
      details: { error: 'No official stream URL or embed configured yet.' },
    };
  }

  if (streamType === 'youtube') {
    if (!youtubeVideoId && !youtubeChannelId) {
      return {
        status: 'unconfigured',
        details: { error: 'Missing YouTube video ID or channel ID.' },
      };
    }
    const start = Date.now();
    try {
      const targetUrl = youtubeVideoId
        ? `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}&format=json`
        : `https://www.youtube.com/channel/${encodeURIComponent(youtubeChannelId!)}/live`;
      const res = await fetch(targetUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const latency = Date.now() - start;

      if (!res.ok) {
        return {
          status: 'unreachable',
          details: {
            http_status: res.status,
            latency_ms: latency,
            error: 'YouTube stream unavailable or embedding restricted.',
          },
        };
      }

      if (youtubeChannelId) {
        const html = await res.text();
        const isLive = html.includes('"isLive":true');
        if (!isLive) {
          return {
            status: 'warning',
            details: {
              http_status: res.status,
              latency_ms: latency,
              content_type: 'youtube/live',
              error: 'Channel is reachable but is not actively broadcasting live right now.',
            },
          };
        }
      }

      return {
        status: 'healthy',
        details: { http_status: res.status, latency_ms: latency, content_type: 'youtube/live' },
      };
    } catch (err) {
      return {
        status: 'unreachable',
        details: {
          latency_ms: Date.now() - start,
          error: err instanceof Error ? err.message : 'Failed to verify YouTube embed',
        },
      };
    }
  }

  if (!streamUrl || !isValidPublicHttpUrl(streamUrl)) {
    return {
      status: 'unreachable',
      details: { error: 'Invalid or disallowed stream URL.' },
    };
  }

  if (streamType === 'external') {
    return {
      status: 'healthy',
      details: { error: 'External broadcaster link configured.' },
    };
  }

  const start = Date.now();
  try {
    const res = await fetch(streamUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Origin: 'https://globaltvhub.local',
        Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*',
      },
    });

    const latency = Date.now() - start;
    const contentType = res.headers.get('content-type') || '';
    const corsEnabled = Boolean(res.headers.get('access-control-allow-origin'));

    if (!res.ok) {
      return {
        status: 'unreachable',
        details: {
          http_status: res.status,
          content_type: contentType,
          cors_enabled: corsEnabled,
          latency_ms: latency,
          error: `HTTP ${res.status} returned by stream origin`,
        },
      };
    }

    if (streamType === 'hls' || streamUrl.toLowerCase().includes('.m3u8')) {
      const text = await res.text();
      const isHlsManifest = text.trimStart().startsWith('#EXTM3U');
      if (!isHlsManifest) {
        return {
          status: 'warning',
          details: {
            http_status: res.status,
            content_type: contentType,
            is_hls_manifest: false,
            cors_enabled: corsEnabled,
            latency_ms: latency,
            error: 'Response is HTTP 200 but did not contain a valid #EXTM3U manifest header.',
          },
        };
      }

      // Verify downstream variant playlist when master manifest is returned
      if (text.includes('#EXT-X-STREAM-INF')) {
        const lines = text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith('#'));
        if (lines[0]) {
          const variantUrl = new URL(lines[0], streamUrl).href;
          const variantRes = await fetch(variantUrl, {
            signal: AbortSignal.timeout(7000),
            headers: {
              'User-Agent': 'Mozilla/5.0',
              Origin: 'https://globaltvhub.local',
            },
          });
          if (!variantRes.ok) {
            return {
              status: 'unreachable',
              details: {
                http_status: variantRes.status,
                content_type: contentType,
                is_hls_manifest: true,
                cors_enabled: corsEnabled,
                latency_ms: Date.now() - start,
                error: `Variant playlist returned HTTP ${variantRes.status}`,
              },
            };
          }
        }
      }

      return {
        status: corsEnabled ? 'healthy' : 'warning',
        details: {
          http_status: res.status,
          content_type: contentType,
          is_hls_manifest: true,
          cors_enabled: corsEnabled,
          latency_ms: Date.now() - start,
          error: corsEnabled
            ? undefined
            : 'Stream manifest reachable, but origin lacks Access-Control-Allow-Origin headers for browser playback.',
        },
      };
    }

    return {
      status: 'healthy',
      details: {
        http_status: res.status,
        content_type: contentType,
        cors_enabled: corsEnabled,
        latency_ms: latency,
      },
    };
  } catch (err) {
    return {
      status: 'unreachable',
      details: {
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : 'Network timeout or unreachable origin',
      },
    };
  }
}
