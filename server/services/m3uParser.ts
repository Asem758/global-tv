import type { ParsedM3UEntry, StreamType } from '../../src/types/tv.ts';

const COUNTRY_NAME_MAP: Record<string, string> = {
  BD: 'Bangladesh',
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  PK: 'Pakistan',
  LK: 'Sri Lanka',
  NP: 'Nepal',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  DE: 'Germany',
  FR: 'France',
  QA: 'Qatar',
  JP: 'Japan',
  INT: 'International',
};

const KNOWN_CATEGORIES = [
  'Sports',
  'News',
  'Entertainment',
  'Movies',
  'Music',
  'Kids',
  'Education',
  'Documentary',
  'Lifestyle',
  'Religious',
  'General',
];

export function isValidPublicHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function extractAttribute(line: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const doubleQuote = new RegExp(`${escaped}="([^"]*)"`, 'i');
  const matchDouble = line.match(doubleQuote);
  if (matchDouble?.[1]) return matchDouble[1].trim();

  const singleQuote = new RegExp(`${escaped}='([^']*)'`, 'i');
  const matchSingle = line.match(singleQuote);
  if (matchSingle?.[1]) return matchSingle[1].trim();

  return undefined;
}

function normalizeCategory(raw?: string): string {
  if (!raw) return 'General';
  const cleaned = raw.split(/[;,/]/)[0].trim();
  const matched = KNOWN_CATEGORIES.find(
    (c) => c.toLowerCase() === cleaned.toLowerCase(),
  );
  if (matched) return matched;
  if (/sport|cricket|football|soccer/i.test(cleaned)) return 'Sports';
  if (/news|current|business/i.test(cleaned)) return 'News';
  if (/movie|cinema|film/i.test(cleaned)) return 'Movies';
  if (/music|mtv|hits/i.test(cleaned)) return 'Music';
  if (/kid|cartoon|anim/i.test(cleaned)) return 'Kids';
  if (/edu|science|learn/i.test(cleaned)) return 'Education';
  if (/doc/i.test(cleaned)) return 'Documentary';
  if (/relig|islam|christian/i.test(cleaned)) return 'Religious';
  if (/entertain|drama|comedy/i.test(cleaned)) return 'Entertainment';
  return 'General';
}

function detectStreamType(url: string): StreamType {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8')) return 'hls';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  return 'direct';
}

export function parseM3UPlaylist(
  content: string,
  sourceAttribution = 'IPTV-org Public Index',
  limit = 250,
): ParsedM3UEntry[] {
  const lines = content.split(/\r?\n/);
  const results: ParsedM3UEntry[] = [];
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();

  let pendingMeta: {
    name: string;
    logo_url?: string | null;
    country_code: string;
    country_name: string;
    language: string;
    category: string;
    epg_channel_id?: string | null;
  } | null = null;

  for (const rawLine of lines) {
    if (results.length >= limit) break;
    const line = rawLine.trim();
    if (!line || line === '#EXTM3U') continue;

    if (line.startsWith('#EXTINF:')) {
      const commaIndex = line.lastIndexOf(',');
      const displayName =
        commaIndex !== -1 ? line.slice(commaIndex + 1).trim() : '';
      const tvgName = extractAttribute(line, 'tvg-name');
      const name = (displayName || tvgName || 'Unnamed Broadcast').replace(
        /\s*\[.*?\]\s*$/g,
        '',
      ).trim();

      const logo = extractAttribute(line, 'tvg-logo');
      const rawCountry = (
        extractAttribute(line, 'tvg-country') || 'INT'
      ).toUpperCase().split(';')[0];
      const normalizedCountryCode =
        rawCountry === 'UK' ? 'GB' : rawCountry.slice(0, 3) || 'INT';
      const countryName =
        COUNTRY_NAME_MAP[normalizedCountryCode] ||
        COUNTRY_NAME_MAP[rawCountry] ||
        'International';

      const rawLanguage = extractAttribute(line, 'tvg-language');
      const language = rawLanguage
        ? rawLanguage.split(';')[0].trim() || 'English'
        : 'English';

      const groupTitle = extractAttribute(line, 'group-title');
      const epgId = extractAttribute(line, 'tvg-id') || null;

      pendingMeta = {
        name,
        logo_url: logo && isValidPublicHttpUrl(logo) ? logo : null,
        country_code: normalizedCountryCode,
        country_name: countryName,
        language,
        category: normalizeCategory(groupTitle),
        epg_channel_id: epgId,
      };
      continue;
    }

    if (line.startsWith('#')) continue;

    if (isValidPublicHttpUrl(line)) {
      const normalizedUrl = line;
      const entryName = pendingMeta?.name || 'Imported Channel';
      const dedupeNameKey = `${entryName.toLowerCase()}::${pendingMeta?.country_code || 'INT'}`;

      if (!seenUrls.has(normalizedUrl) && !seenNames.has(dedupeNameKey)) {
        seenUrls.add(normalizedUrl);
        seenNames.add(dedupeNameKey);

        results.push({
          name: entryName,
          logo_url: pendingMeta?.logo_url || null,
          country_code: pendingMeta?.country_code || 'INT',
          country_name: pendingMeta?.country_name || 'International',
          language: pendingMeta?.language || 'English',
          category: pendingMeta?.category || 'General',
          stream_url: normalizedUrl,
          stream_type: detectStreamType(normalizedUrl),
          epg_channel_id: pendingMeta?.epg_channel_id || null,
          source_attribution: sourceAttribution,
        });
      }
      pendingMeta = null;
    } else {
      pendingMeta = null;
    }
  }

  return results;
}
