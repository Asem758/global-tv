import { XMLParser } from 'fast-xml-parser';
import type { EpgProgram } from '../../src/types/tv.ts';
import { randomUUID } from 'node:crypto';

/**
 * Parses XMLTV timestamp format: YYYYMMDDHHmmss +ZZZZ (or without offset)
 */
export function parseXmltvTimestamp(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  const match = cleaned.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}|Z))?$/,
  );
  if (!match) {
    const parsed = Date.parse(cleaned);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  const [, year, month, day, hour, minute, second, offset] = match;
  let isoOffset = 'Z';
  if (offset && offset !== 'Z') {
    isoOffset = `${offset.slice(0, 3)}:${offset.slice(3, 5)}`;
  }

  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${isoOffset}`;
  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readXmlText(val: unknown): string {
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val) && val.length > 0) return readXmlText(val[0]);
  if (val && typeof val === 'object' && '#text' in val) {
    return String((val as Record<string, unknown>)['#text'] ?? '').trim();
  }
  return '';
}

export function parseXmltvContent(
  xmlContent: string,
  sourceUrl?: string,
  maxPrograms = 1500,
): EpgProgram[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  });

  const parsed = parser.parse(xmlContent);
  const tvRoot = parsed?.tv;
  if (!tvRoot) return [];

  const rawProgrammes = Array.isArray(tvRoot.programme)
    ? tvRoot.programme
    : tvRoot.programme
      ? [tvRoot.programme]
      : [];

  const programs: EpgProgram[] = [];

  for (const item of rawProgrammes) {
    if (programs.length >= maxPrograms) break;
    const channelId = item?.['@_channel'];
    const startIso = parseXmltvTimestamp(item?.['@_start']);
    const endIso = parseXmltvTimestamp(item?.['@_stop']);
    const title = readXmlText(item?.title);

    if (!channelId || !startIso || !endIso || !title) continue;

    const description = readXmlText(item?.desc) || null;
    const category = readXmlText(item?.category) || null;

    programs.push({
      id: randomUUID(),
      epg_channel_id: String(channelId).trim(),
      title,
      description,
      category,
      start_time: startIso,
      end_time: endIso,
      source_url: sourceUrl || null,
    });
  }

  return programs;
}
