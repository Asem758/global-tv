import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AppRole,
  AuditLog,
  Category,
  Channel,
  Country,
  EpgNowNext,
  EpgProgram,
  PaginatedChannelsResponse,
  StreamHealthCheck,
  StreamReport,
  UserProfile,
} from '../src/types/tv.ts';
import {
  RETIRED_SEED_CHANNEL_IDS,
  SEED_CATEGORIES,
  SEED_CHANNELS,
  SEED_COUNTRIES,
  SEED_EPG_PROGRAMS,
} from './seedData.ts';

export interface LocalUserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url?: string | null;
  preferred_language?: string;
  preferred_country?: string | null;
  role: AppRole;
  created_at: string;
}

export interface LocalDatabaseState {
  countries: Country[];
  categories: Category[];
  channels: Channel[];
  users: LocalUserRecord[];
  favorites: Array<{ id: string; user_id: string; channel_id: string; created_at: string }>;
  watch_history: Array<{ id: string; user_id: string; channel_id: string; watched_at: string }>;
  stream_reports: StreamReport[];
  stream_health_checks: StreamHealthCheck[];
  audit_logs: AuditLog[];
  epg_programs: EpgProgram[];
}

export const ADMIN_ROLES: AppRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'CHANNEL_MANAGER',
  'CONTENT_EDITOR',
];

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'global_tv_hub.db.json');

let supabaseAdminClient: SupabaseClient | null = null;
let memoryState: LocalDatabaseState | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.VITE_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      process.env.VITE_SUPABASE_URL!.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return supabaseAdminClient;
}

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    'global-tv-hub-local-dev-secret-change-in-prod'
  );
}

export function signLocalToken(payload: { sub: string; email: string; role: AppRole }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyLocalToken(
  token: string,
): { sub: string; email: string; role: AppRole } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(`${header}.${body}`)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      sub: string;
      email: string;
      role: AppRole;
      exp: number;
    };
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: parsed.sub, email: parsed.email, role: parsed.role };
  } catch {
    return null;
  }
}

function createInitialState(): LocalDatabaseState {
  const adminPasswordHash = bcrypt.hashSync(
    process.env.INITIAL_ADMIN_PASSWORD || 'Admin@GlobalTV2026!',
    10,
  );

  return {
    countries: structuredClone(SEED_COUNTRIES),
    categories: structuredClone(SEED_CATEGORIES),
    channels: structuredClone(SEED_CHANNELS),
    users: [
      {
        id: 'user-super-admin',
        email: 'admin@globaltvhub.local',
        password_hash: adminPasswordHash,
        display_name: 'Platform Super Admin',
        preferred_language: 'English',
        preferred_country: 'BD',
        role: 'SUPER_ADMIN',
        created_at: new Date().toISOString(),
      },
    ],
    favorites: [],
    watch_history: [],
    stream_reports: [],
    stream_health_checks: [],
    audit_logs: [
      {
        id: 'audit-init',
        admin_user_id: 'user-super-admin',
        admin_email: 'admin@globaltvhub.local',
        action: 'SYSTEM_SEED_INITIALIZED',
        entity_type: 'channel',
        entity_id: 'seed-catalog',
        details: { message: 'Initialized verified reference streams and broadcaster discovery directory' },
        created_at: new Date().toISOString(),
      },
    ],
    epg_programs: structuredClone(SEED_EPG_PROGRAMS),
  };
}

export function loadLocalDb(): LocalDatabaseState {
  if (memoryState) return memoryState;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      memoryState = JSON.parse(raw) as LocalDatabaseState;
      const seedMap = new Map(SEED_CHANNELS.map((c) => [c.id, c]));
      const retiredSet = new Set(RETIRED_SEED_CHANNEL_IDS);
      let upgraded = false;

      const beforeCount = memoryState.channels.length;
      memoryState.channels = memoryState.channels
        .filter((ch) => !retiredSet.has(ch.id))
        .map((ch) => {
          const seed = seedMap.get(ch.id);
          if (
            seed &&
            (ch.logo_url !== seed.logo_url ||
              ch.stream_type !== seed.stream_type ||
              ch.stream_url !== seed.stream_url ||
              ch.youtube_channel_id !== seed.youtube_channel_id ||
              ch.youtube_video_id !== seed.youtube_video_id ||
              ch.verification_status !== seed.verification_status ||
              ch.official_website !== seed.official_website ||
              ch.source_attribution !== seed.source_attribution ||
              ch.sports_subcategory !== seed.sports_subcategory ||
              Boolean(ch.is_featured) !== Boolean(seed.is_featured))
          ) {
            upgraded = true;
            return {
              ...seed,
              view_count: Math.max(ch.view_count, seed.view_count),
              created_at: ch.created_at,
            };
          }
          return ch;
        });
      if (memoryState.channels.length !== beforeCount) {
        upgraded = true;
      }
      for (const seed of SEED_CHANNELS) {
        if (!memoryState.channels.some((c) => c.id === seed.id)) {
          memoryState.channels.push(seed);
          upgraded = true;
        }
      }
      const seedEpgMap = new Map(SEED_EPG_PROGRAMS.map((e) => [e.id, e]));
      memoryState.epg_programs = memoryState.epg_programs.map((e) => {
        const seedEpg = seedEpgMap.get(e.id);
        if (seedEpg && e.epg_channel_id !== seedEpg.epg_channel_id) {
          upgraded = true;
          return seedEpg;
        }
        return e;
      });
      for (const seedEpg of SEED_EPG_PROGRAMS) {
        if (!memoryState.epg_programs.some((e) => e.id === seedEpg.id)) {
          memoryState.epg_programs.push(seedEpg);
          upgraded = true;
        }
      }
      if (upgraded) saveLocalDb();
      return memoryState;
    }
  } catch (err) {
    console.warn('[DB] Failed reading local DB file, initializing fresh store:', err);
  }
  memoryState = createInitialState();
  saveLocalDb();
  return memoryState;
}

export function saveLocalDb(): void {
  if (!memoryState) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(memoryState, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('[DB] Failed writing local DB file:', err);
  }
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || `channel-${Date.now()}`
  );
}

// === Repository Queries (supports Supabase when configured, else local DB) ===

export async function resolveAuthUser(authHeader?: string): Promise<UserProfile | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const sb = getSupabaseAdmin();
  if (sb) {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    const uid = data.user.id;
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      sb.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
      sb.from('user_roles').select('role').eq('user_id', uid).maybeSingle(),
    ]);
    return {
      id: uid,
      email: data.user.email || '',
      display_name: profile?.display_name || data.user.email?.split('@')[0] || 'Viewer',
      avatar_url: profile?.avatar_url || null,
      preferred_language: profile?.preferred_language || 'English',
      preferred_country: profile?.preferred_country || null,
      role: (roleRow?.role as AppRole) || 'USER',
      created_at: data.user.created_at,
    };
  }

  const decoded = verifyLocalToken(token);
  if (!decoded) return null;
  const db = loadLocalDb();
  const user = db.users.find((u) => u.id === decoded.sub);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url || null,
    preferred_language: user.preferred_language || 'English',
    preferred_country: user.preferred_country || null,
    role: user.role,
    created_at: user.created_at,
  };
}

export async function listChannels(filters: {
  country?: string;
  category?: string;
  language?: string;
  search?: string;
  verifiedOnly?: boolean;
  includeDisabled?: boolean;
  featuredOnly?: boolean;
  sportsSubcategory?: string;
  sort?: 'alpha' | 'popular' | 'recent';
  page?: number;
  limit?: number;
}): Promise<PaginatedChannelsResponse> {
  const page = Math.max(filters.page || 1, 1);
  const limit = Math.min(Math.max(filters.limit || 24, 1), 200);

  const sb = getSupabaseAdmin();
  if (sb) {
    let query = sb.from('channels').select('*', { count: 'exact' });
    if (!filters.includeDisabled) query = query.eq('is_enabled', true);
    if (filters.country) query = query.eq('country_code', filters.country.toUpperCase());
    if (filters.category) query = query.ilike('category', filters.category);
    if (filters.language) query = query.ilike('language', filters.language);
    if (filters.verifiedOnly) query = query.eq('verification_status', 'verified');
    if (filters.featuredOnly) query = query.eq('is_featured', true);
    if (filters.search) query = query.ilike('name', `%${filters.search}%`);

    if (filters.sort === 'alpha') {
      query = query.order('name', { ascending: true });
    } else if (filters.sort === 'popular') {
      query = query.order('view_count', { ascending: false });
    } else {
      query = query.order('verification_status', { ascending: false }).order('created_at', { ascending: false });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count, error } = await query.range(from, to);
    if (error) throw new Error(error.message);
    const total = count || 0;
    return {
      channels: (data || []) as Channel[],
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  const db = loadLocalDb();
  let items = [...db.channels];

  if (!filters.includeDisabled) {
    items = items.filter((c) => c.is_enabled);
  }
  if (filters.country) {
    const code = filters.country.toUpperCase();
    items = items.filter((c) => c.country_code.toUpperCase() === code);
  }
  if (filters.category) {
    const cat = filters.category.toLowerCase();
    items = items.filter((c) => c.category.toLowerCase() === cat);
  }
  if (filters.language) {
    const lang = filters.language.toLowerCase();
    items = items.filter((c) => c.language.toLowerCase() === lang);
  }
  if (filters.sportsSubcategory && filters.sportsSubcategory.toLowerCase() !== 'all') {
    const sub = filters.sportsSubcategory.toLowerCase();
    items = items.filter((c) => (c.sports_subcategory || 'Other').toLowerCase() === sub);
  }
  if (filters.verifiedOnly) {
    items = items.filter(
      (c) =>
        c.verification_status === 'verified' &&
        c.stream_type !== 'unconfigured' &&
        Boolean(c.stream_url || c.youtube_video_id || c.youtube_channel_id),
    );
  }
  if (filters.featuredOnly) {
    items = items.filter((c) => c.is_featured);
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    items = items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.country_name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.language.toLowerCase().includes(q),
    );
  }

  if (filters.sort === 'alpha') {
    items.sort((a, b) => a.name.localeCompare(b.name));
  } else if (filters.sort === 'popular') {
    items.sort((a, b) => {
      if (b.view_count !== a.view_count) return b.view_count - a.view_count;
      return a.name.localeCompare(b.name);
    });
  } else {
    // Put verified playable streams first, then recently updated/created
    items.sort((a, b) => {
      const aVerified = a.verification_status === 'verified' ? 1 : 0;
      const bVerified = b.verification_status === 'verified' ? 1 : 0;
      if (bVerified !== aVerified) return bVerified - aVerified;
      return b.created_at.localeCompare(a.created_at);
    });
  }

  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);

  return {
    channels: paged,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getChannelByIdOrSlug(
  idOrSlug: string,
  includeDisabled = false,
): Promise<Channel | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idOrSlug);
    const col = isUuid ? 'id' : 'slug';
    let q = sb.from('channels').select('*').eq(col, idOrSlug);
    if (!includeDisabled) q = q.eq('is_enabled', true);
    const { data } = await q.maybeSingle();
    return (data as Channel) || null;
  }

  const db = loadLocalDb();
  const found = db.channels.find(
    (c) => (c.id === idOrSlug || c.slug === idOrSlug) && (includeDisabled || c.is_enabled),
  );
  return found || null;
}

export async function listCountriesWithChannels(): Promise<Country[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    const [{ data: countries }, { data: channels }] = await Promise.all([
      sb.from('countries').select('*').order('country_name'),
      sb.from('channels').select('country_code, country_name, verification_status, is_enabled').eq('is_enabled', true),
    ]);
    const counts = new Map<string, { total: number; verified: number }>();
    for (const ch of channels || []) {
      const curr = counts.get(ch.country_code) || { total: 0, verified: 0 };
      curr.total += 1;
      if (ch.verification_status === 'verified') curr.verified += 1;
      counts.set(ch.country_code, curr);
    }
    return ((countries || []) as Country[])
      .map((c) => ({
        ...c,
        channel_count: counts.get(c.country_code)?.total || 0,
        verified_count: counts.get(c.country_code)?.verified || 0,
      }))
      .filter((c) => (c.channel_count || 0) > 0);
  }

  const db = loadLocalDb();
  const counts = new Map<string, { total: number; verified: number; name: string }>();
  for (const ch of db.channels) {
    if (!ch.is_enabled) continue;
    const curr = counts.get(ch.country_code) || { total: 0, verified: 0, name: ch.country_name };
    curr.total += 1;
    if (ch.verification_status === 'verified') curr.verified += 1;
    counts.set(ch.country_code, curr);
  }

  const existingCodes = new Set(db.countries.map((c) => c.country_code));
  const result: Country[] = db.countries
    .map((c) => ({
      ...c,
      channel_count: counts.get(c.country_code)?.total || 0,
      verified_count: counts.get(c.country_code)?.verified || 0,
    }))
    .filter((c) => (c.channel_count || 0) > 0);

  for (const [code, info] of counts.entries()) {
    if (!existingCodes.has(code)) {
      result.push({
        id: `c-${code.toLowerCase()}`,
        country_code: code,
        country_name: info.name,
        flag_emoji: '📺',
        channel_count: info.total,
        verified_count: info.verified,
      });
    }
  }

  return result;
}

export async function listCategories(): Promise<Category[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data } = await sb.from('categories').select('*').order('sort_order');
    return (data || []) as Category[];
  }
  const db = loadLocalDb();
  return [...db.categories].sort((a, b) => a.sort_order - b.sort_order);
}

export async function getEpgForChannel(epgChannelId: string): Promise<EpgNowNext> {
  const now = Date.now();
  const sb = getSupabaseAdmin();
  let programs: EpgProgram[] = [];

  if (sb) {
    const { data } = await sb
      .from('epg_programs')
      .select('*')
      .eq('epg_channel_id', epgChannelId)
      .gte('end_time', new Date(now - 3600000).toISOString())
      .order('start_time', { ascending: true })
      .limit(20);
    programs = (data || []) as EpgProgram[];
  } else {
    const db = loadLocalDb();
    programs = db.epg_programs
      .filter((p) => p.epg_channel_id === epgChannelId)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  const current =
    programs.find((p) => {
      const start = Date.parse(p.start_time);
      const end = Date.parse(p.end_time);
      return start <= now && end > now;
    }) || null;

  const upcoming = programs.filter((p) => Date.parse(p.start_time) > now);
  const next = upcoming[0] || null;

  return {
    epg_channel_id: epgChannelId,
    current,
    next,
    upcoming: upcoming.slice(0, 6),
  };
}
