import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  ADMIN_ROLES,
  getChannelByIdOrSlug,
  getEpgForChannel,
  getSupabaseAdmin,
  isSupabaseConfigured,
  listCategories,
  listChannels,
  listCountriesWithChannels,
  loadLocalDb,
  resolveAuthUser,
  saveLocalDb,
  signLocalToken,
  slugify,
} from './db.ts';
import { isValidPublicHttpUrl, parseM3UPlaylist } from './services/m3uParser.ts';
import { parseXmltvContent } from './services/epgParser.ts';
import { checkStreamHealth } from './services/streamValidator.ts';
import { isYouTubeApiConfigured, searchYouTubeLiveBroadcasts } from './services/youtubeService.ts';
import type { AppRole, Channel, UserProfile } from '../src/types/tv.ts';

interface AuthedRequest extends Request {
  user?: UserProfile;
}

const channelSchema = z.object({
  name: z.string().trim().min(1).max(120),
  logo_url: z.string().trim().max(500).optional().nullable().or(z.literal('')),
  country_code: z.string().trim().min(2).max(10).transform((s) => s.toUpperCase()),
  country_name: z.string().trim().min(2).max(80),
  language: z.string().trim().min(1).max(60).default('English'),
  category: z.string().trim().min(1).max(60).default('General'),
  sports_subcategory: z.string().trim().max(40).optional().nullable(),
  stream_type: z.enum(['hls', 'youtube', 'direct', 'external', 'unconfigured']),
  stream_url: z.string().trim().optional().nullable(),
  youtube_video_id: z.string().trim().max(40).optional().nullable(),
  youtube_channel_id: z.string().trim().max(40).optional().nullable(),
  official_website: z.string().trim().optional().nullable(),
  source_url: z.string().trim().optional().nullable(),
  source_attribution: z.string().trim().max(240).optional().nullable(),
  epg_channel_id: z.string().trim().max(120).optional().nullable(),
  verification_status: z.enum(['verified', 'pending', 'unverified', 'unavailable']).default('pending'),
  is_enabled: z.boolean().default(false),
  is_featured: z.boolean().optional().default(false),
});

function sanitizeOptionalUrl(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  if (!isValidPublicHttpUrl(raw)) {
    throw new Error(`Invalid or disallowed URL: ${raw}`);
  }
  return raw.trim();
}

function sanitizeLogoUrl(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (/^\/logos\/[a-z0-9._-]+$/i.test(trimmed)) {
    return trimmed;
  }
  if (!isValidPublicHttpUrl(trimmed)) {
    throw new Error(`Invalid or disallowed logo URL: ${raw}`);
  }
  return trimmed;
}

function recordLocalAudit(
  admin: UserProfile,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
) {
  const db = loadLocalDb();
  db.audit_logs.unshift({
    id: randomUUID(),
    admin_user_id: admin.id,
    admin_email: admin.email,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details || null,
    created_at: new Date().toISOString(),
  });
  if (db.audit_logs.length > 500) {
    db.audit_logs.length = 500;
  }
  saveLocalDb();
}

async function recordAudit(
  admin: UserProfile,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
) {
  const sb = getSupabaseAdmin();
  if (sb) {
    await sb.from('audit_logs').insert({
      admin_user_id: admin.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details || null,
    });
    return;
  }
  recordLocalAudit(admin, action, entityType, entityId, details);
}

async function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const user = await resolveAuthUser(req.headers.authorization);
    if (user) req.user = user;
  } catch {
    // Unauthenticated request continues as guest
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!ADMIN_ROLES.includes(req.user.role)) {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }
  next();
}

function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'SUPER_ADMIN privileges required for role assignment' });
    return;
  }
  next();
}

export function createApiRouter() {
  const router = express.Router();

  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.use(generalLimiter);
  router.use(attachUser);

  // === Public Health & Config Capabilities ===
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      supabaseConfigured: isSupabaseConfigured(),
      youtubeConfigured: isYouTubeApiConfigured(),
    });
  });

  // === Public Channels, Countries, Categories ===
  router.get('/channels', async (req, res) => {
    try {
      const result = await listChannels({
        country: typeof req.query.country === 'string' ? req.query.country : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        language: typeof req.query.language === 'string' ? req.query.language : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        verifiedOnly: req.query.verifiedOnly === 'true',
        featuredOnly: req.query.featuredOnly === 'true',
        sportsSubcategory:
          typeof req.query.sportsSubcategory === 'string' ? req.query.sportsSubcategory : undefined,
        sort:
          req.query.sort === 'alpha' || req.query.sort === 'popular' || req.query.sort === 'recent'
            ? req.query.sort
            : 'recent',
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 24,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed loading channels' });
    }
  });

  router.get('/channels/country/:countryCode', async (req, res) => {
    try {
      const result = await listChannels({
        country: req.params.countryCode,
        verifiedOnly: req.query.verifiedOnly === 'true',
        sort: req.query.sort === 'alpha' ? 'alpha' : 'recent',
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed loading country channels' });
    }
  });

  router.get('/channels/category/:category', async (req, res) => {
    try {
      const result = await listChannels({
        category: req.params.category,
        verifiedOnly: req.query.verifiedOnly === 'true',
        sort: req.query.sort === 'alpha' ? 'alpha' : 'recent',
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed loading category channels' });
    }
  });

  router.get('/channels/:id', async (req, res) => {
    try {
      const channel = await getChannelByIdOrSlug(req.params.id, false);
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }
      const relatedRes = await listChannels({
        category: channel.category,
        limit: 8,
      });
      const related = relatedRes.channels.filter((c) => c.id !== channel.id).slice(0, 6);
      const epg = channel.epg_channel_id
        ? await getEpgForChannel(channel.epg_channel_id)
        : { epg_channel_id: null, current: null, next: null, upcoming: [] };

      res.json({ channel, related, epg });
    } catch (err) {
      res.status(500).json({ error: 'Failed loading channel details' });
    }
  });

  router.post('/channels/:id/view', async (req, res) => {
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        const ch = await getChannelByIdOrSlug(req.params.id, false);
        if (ch) {
          await sb.from('channels').update({ view_count: (ch.view_count || 0) + 1 }).eq('id', ch.id);
        }
        res.json({ ok: true });
        return;
      }
      const db = loadLocalDb();
      const channel = db.channels.find(
        (c) => (c.id === req.params.id || c.slug === req.params.id) && c.is_enabled,
      );
      if (channel) {
        channel.view_count = (channel.view_count || 0) + 1;
        saveLocalDb();
      }
      res.json({ ok: true });
    } catch {
      res.json({ ok: false });
    }
  });

  router.get('/countries', async (_req, res) => {
    try {
      const countries = await listCountriesWithChannels();
      res.json({ countries });
    } catch {
      res.status(500).json({ error: 'Failed loading countries' });
    }
  });

  router.get('/categories', async (_req, res) => {
    try {
      const categories = await listCategories();
      res.json({ categories });
    } catch {
      res.status(500).json({ error: 'Failed loading categories' });
    }
  });

  // === EPG Routes ===
  router.get('/epg', async (_req, res) => {
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        const { data } = await sb
          .from('epg_programs')
          .select('*')
          .order('start_time', { ascending: true })
          .limit(300);
        res.json({ programs: data || [] });
        return;
      }
      const db = loadLocalDb();
      res.json({ programs: db.epg_programs });
    } catch {
      res.status(500).json({ error: 'Failed loading EPG schedule' });
    }
  });

  router.get('/epg/:channelId', async (req, res) => {
    try {
      const channel = await getChannelByIdOrSlug(req.params.channelId, false);
      const epgId = channel?.epg_channel_id || req.params.channelId;
      const epg = await getEpgForChannel(epgId);
      res.json(epg);
    } catch {
      res.status(500).json({ error: 'Failed loading channel EPG' });
    }
  });

  // === Sports Center Route ===
  router.get('/sports/live', async (req, res) => {
    try {
      const subcategory =
        typeof req.query.subcategory === 'string' ? req.query.subcategory : undefined;
      const [sportsChannels, ytLive] = await Promise.all([
        listChannels({
          category: 'Sports',
          sportsSubcategory: subcategory,
          limit: 50,
        }),
        searchYouTubeLiveBroadcasts({
          query: subcategory && subcategory !== 'All' ? `${subcategory} live official` : 'live sports official broadcast',
          maxResults: 8,
        }).catch((err) => ({
          configured: isYouTubeApiConfigured(),
          cached: false,
          items: [],
          message: err instanceof Error ? err.message : 'YouTube discovery unavailable',
        })),
      ]);

      res.json({
        channels: sportsChannels.channels,
        youtubeLive: ytLive,
      });
    } catch {
      res.status(500).json({ error: 'Failed loading sports center' });
    }
  });

  // === Broken Stream Reports ===
  router.post('/reports', authLimiter, async (req: AuthedRequest, res) => {
    const schema = z.object({
      channel_id: z.string().trim().min(1),
      issue_type: z.enum([
        'Stream offline / unavailable',
        'Playback error / buffering',
        'Embed blocked by provider',
        'Geo-restricted in my region',
        'Incorrect channel metadata',
        'Other',
      ]),
      description: z.string().trim().min(4).max(1000),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid report payload', details: parsed.error.flatten() });
      return;
    }

    try {
      const channel = await getChannelByIdOrSlug(parsed.data.channel_id, true);
      if (!channel) {
        res.status(404).json({ error: 'Referenced channel does not exist' });
        return;
      }

      const sb = getSupabaseAdmin();
      if (sb) {
        const { data, error } = await sb
          .from('stream_reports')
          .insert({
            channel_id: channel.id,
            user_id: req.user?.id || null,
            issue_type: parsed.data.issue_type,
            description: parsed.data.description,
            status: 'open',
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        res.status(201).json({ report: data });
        return;
      }

      const db = loadLocalDb();
      const report = {
        id: randomUUID(),
        channel_id: channel.id,
        channel_name: channel.name,
        user_id: req.user?.id || null,
        issue_type: parsed.data.issue_type,
        description: parsed.data.description,
        status: 'open' as const,
        created_at: new Date().toISOString(),
      };
      db.stream_reports.unshift(report);
      saveLocalDb();
      res.status(201).json({ report });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed submitting report' });
    }
  });

  // === Auth & User Profile Endpoints ===
  router.post('/auth/register', authLimiter, async (req, res) => {
    if (isSupabaseConfigured()) {
      res.status(400).json({
        error: 'Supabase Auth is active. Please register via the Supabase client SDK.',
      });
      return;
    }
    const schema = z.object({
      email: z.string().trim().email(),
      password: z.string().min(8).max(128),
      display_name: z.string().trim().min(2).max(60),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid email, display name, and 8+ character password required.' });
      return;
    }

    const db = loadLocalDb();
    const emailLower = parsed.data.email.toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === emailLower)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    // Security rule: public registration ALWAYS assigns 'USER' role (never admin)
    const newUser = {
      id: randomUUID(),
      email: emailLower,
      password_hash: bcrypt.hashSync(parsed.data.password, 10),
      display_name: parsed.data.display_name,
      preferred_language: 'English',
      preferred_country: null,
      role: 'USER' as AppRole,
      created_at: new Date().toISOString(),
    };
    db.users.push(newUser);
    saveLocalDb();

    const token = signLocalToken({ sub: newUser.id, email: newUser.email, role: newUser.role });
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        display_name: newUser.display_name,
        preferred_language: newUser.preferred_language,
        preferred_country: newUser.preferred_country,
        role: newUser.role,
        created_at: newUser.created_at,
      },
    });
  });

  router.post('/auth/login', authLimiter, async (req, res) => {
    if (isSupabaseConfigured()) {
      res.status(400).json({
        error: 'Supabase Auth is active. Please sign in via the Supabase client SDK.',
      });
      return;
    }
    const schema = z.object({
      email: z.string().trim().email(),
      password: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const db = loadLocalDb();
    const user = db.users.find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (!user || !bcrypt.compareSync(parsed.data.password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signLocalToken({ sub: user.id, email: user.email, role: user.role });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        preferred_language: user.preferred_language,
        preferred_country: user.preferred_country,
        role: user.role,
        created_at: user.created_at,
      },
    });
  });

  router.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  router.put('/auth/profile', requireAuth, async (req: AuthedRequest, res) => {
    const schema = z.object({
      display_name: z.string().trim().min(2).max(60),
      preferred_language: z.string().trim().max(40).optional(),
      preferred_country: z.string().trim().max(10).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid profile update payload' });
      return;
    }

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('profiles').upsert({
        user_id: req.user!.id,
        display_name: parsed.data.display_name,
        preferred_language: parsed.data.preferred_language || 'English',
        preferred_country: parsed.data.preferred_country || null,
      });
      res.json({ ok: true });
      return;
    }

    const db = loadLocalDb();
    const user = db.users.find((u) => u.id === req.user!.id);
    if (user) {
      user.display_name = parsed.data.display_name;
      if (parsed.data.preferred_language) user.preferred_language = parsed.data.preferred_language;
      if (parsed.data.preferred_country !== undefined) {
        user.preferred_country = parsed.data.preferred_country;
      }
      saveLocalDb();
    }
    res.json({ ok: true });
  });

  // === Favorites & Watch History (Per-user isolation) ===
  router.get('/user/favorites', requireAuth, async (req: AuthedRequest, res) => {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('favorites')
        .select('channel_id, channels(*)')
        .eq('user_id', req.user!.id);
      const channels = (data || []).map((row: Record<string, unknown>) => row.channels).filter(Boolean);
      res.json({ channels });
      return;
    }
    const db = loadLocalDb();
    const favIds = new Set(
      db.favorites.filter((f) => f.user_id === req.user!.id).map((f) => f.channel_id),
    );
    const channels = db.channels.filter((c) => favIds.has(c.id) && c.is_enabled);
    res.json({ channels });
  });

  router.post('/user/favorites', requireAuth, async (req: AuthedRequest, res) => {
    const channelId = typeof req.body?.channel_id === 'string' ? req.body.channel_id : '';
    if (!channelId) {
      res.status(400).json({ error: 'channel_id is required' });
      return;
    }
    const channel = await getChannelByIdOrSlug(channelId, false);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('favorites').upsert(
        { user_id: req.user!.id, channel_id: channel.id },
        { onConflict: 'user_id,channel_id' },
      );
      res.status(201).json({ ok: true });
      return;
    }

    const db = loadLocalDb();
    const exists = db.favorites.some(
      (f) => f.user_id === req.user!.id && f.channel_id === channel.id,
    );
    if (!exists) {
      db.favorites.unshift({
        id: randomUUID(),
        user_id: req.user!.id,
        channel_id: channel.id,
        created_at: new Date().toISOString(),
      });
      saveLocalDb();
    }
    res.status(201).json({ ok: true });
  });

  router.delete('/user/favorites/:channelId', requireAuth, async (req: AuthedRequest, res) => {
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb
        .from('favorites')
        .delete()
        .eq('user_id', req.user!.id)
        .eq('channel_id', req.params.channelId);
      res.json({ ok: true });
      return;
    }
    const db = loadLocalDb();
    db.favorites = db.favorites.filter(
      (f) => !(f.user_id === req.user!.id && f.channel_id === req.params.channelId),
    );
    saveLocalDb();
    res.json({ ok: true });
  });

  router.get('/user/history', requireAuth, async (req: AuthedRequest, res) => {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('watch_history')
        .select('watched_at, channels(*)')
        .eq('user_id', req.user!.id)
        .order('watched_at', { ascending: false })
        .limit(20);
      res.json({ history: data || [] });
      return;
    }
    const db = loadLocalDb();
    const entries = db.watch_history
      .filter((w) => w.user_id === req.user!.id)
      .sort((a, b) => b.watched_at.localeCompare(a.watched_at))
      .slice(0, 20)
      .map((w) => ({
        watched_at: w.watched_at,
        channel: db.channels.find((c) => c.id === w.channel_id) || null,
      }))
      .filter((entry) => entry.channel !== null);
    res.json({ history: entries });
  });

  router.post('/user/history', requireAuth, async (req: AuthedRequest, res) => {
    const channelId = typeof req.body?.channel_id === 'string' ? req.body.channel_id : '';
    if (!channelId) {
      res.status(400).json({ error: 'channel_id is required' });
      return;
    }
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('watch_history').insert({ user_id: req.user!.id, channel_id: channelId });
      res.status(201).json({ ok: true });
      return;
    }
    const db = loadLocalDb();
    db.watch_history = db.watch_history.filter(
      (w) => !(w.user_id === req.user!.id && w.channel_id === channelId),
    );
    db.watch_history.unshift({
      id: randomUUID(),
      user_id: req.user!.id,
      channel_id: channelId,
      watched_at: new Date().toISOString(),
    });
    saveLocalDb();
    res.status(201).json({ ok: true });
  });

  router.delete('/user/history', requireAuth, async (req: AuthedRequest, res) => {
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('watch_history').delete().eq('user_id', req.user!.id);
      res.json({ ok: true });
      return;
    }
    const db = loadLocalDb();
    db.watch_history = db.watch_history.filter((w) => w.user_id !== req.user!.id);
    saveLocalDb();
    res.json({ ok: true });
  });

  // ==========================================
  // PROTECTED ADMIN ROUTES (/api/admin/*)
  // ==========================================

  router.get('/admin/dashboard', requireAdmin, async (_req, res) => {
    try {
      const sb = getSupabaseAdmin();
      if (sb) {
        const [{ data: channels }, { data: reports }, { data: logs }] = await Promise.all([
          sb.from('channels').select('verification_status, country_code, category, is_enabled'),
          sb.from('stream_reports').select('id, status').eq('status', 'open'),
          sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(15),
        ]);
        const list = channels || [];
        return res.json({
          metrics: {
            totalChannels: list.length,
            verifiedChannels: list.filter((c) => c.verification_status === 'verified').length,
            unverifiedChannels: list.filter((c) => c.verification_status !== 'verified').length,
            enabledChannels: list.filter((c) => c.is_enabled).length,
            openReports: (reports || []).length,
            countriesRepresented: new Set(list.map((c) => c.country_code)).size,
            categoriesRepresented: new Set(list.map((c) => c.category)).size,
          },
          recentActivity: logs || [],
        });
      }

      const db = loadLocalDb();
      const channels = db.channels;
      res.json({
        metrics: {
          totalChannels: channels.length,
          verifiedChannels: channels.filter((c) => c.verification_status === 'verified').length,
          unverifiedChannels: channels.filter((c) => c.verification_status !== 'verified').length,
          enabledChannels: channels.filter((c) => c.is_enabled).length,
          openReports: db.stream_reports.filter((r) => r.status === 'open').length,
          countriesRepresented: new Set(channels.map((c) => c.country_code)).size,
          categoriesRepresented: new Set(channels.map((c) => c.category)).size,
        },
        recentActivity: db.audit_logs.slice(0, 15),
      });
    } catch {
      res.status(500).json({ error: 'Failed loading admin dashboard metrics' });
    }
  });

  router.get('/admin/channels', requireAdmin, async (req, res) => {
    try {
      const result = await listChannels({
        country: typeof req.query.country === 'string' ? req.query.country : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        includeDisabled: true,
        sort: 'recent',
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 100,
      });
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Failed loading admin channels' });
    }
  });

  router.post('/admin/channels', requireAdmin, async (req: AuthedRequest, res) => {
    const parsed = channelSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const streamUrl = sanitizeOptionalUrl(parsed.data.stream_url);
      const logoUrl = sanitizeLogoUrl(parsed.data.logo_url || null);
      const officialWebsite = sanitizeOptionalUrl(parsed.data.official_website);
      const sourceUrl = sanitizeOptionalUrl(parsed.data.source_url);

      if (
        (parsed.data.stream_type === 'hls' ||
          parsed.data.stream_type === 'direct' ||
          parsed.data.stream_type === 'external') &&
        !streamUrl
      ) {
        res.status(400).json({ error: 'Stream URL is required for the selected stream type.' });
        return;
      }
      if (
        parsed.data.stream_type === 'youtube' &&
        !parsed.data.youtube_video_id &&
        !parsed.data.youtube_channel_id
      ) {
        res.status(400).json({
          error: 'YouTube Video ID or YouTube Channel ID is required for YouTube embeds.',
        });
        return;
      }

      const now = new Date().toISOString();
      const baseSlug = slugify(`${parsed.data.name}-${parsed.data.country_code}`);

      const sb = getSupabaseAdmin();
      if (sb) {
        const { data, error } = await sb
          .from('channels')
          .insert({
            ...parsed.data,
            slug: `${baseSlug}-${Date.now().toString(36)}`,
            stream_url: streamUrl,
            logo_url: logoUrl,
            official_website: officialWebsite,
            source_url: sourceUrl,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        await recordAudit(req.user!, 'CHANNEL_CREATED', 'channel', data.id, { name: data.name });
        res.status(201).json({ channel: data });
        return;
      }

      const db = loadLocalDb();
      const uniqueSlug = db.channels.some((c) => c.slug === baseSlug)
        ? `${baseSlug}-${Date.now().toString(36)}`
        : baseSlug;

      const created: Channel = {
        id: randomUUID(),
        name: parsed.data.name,
        slug: uniqueSlug,
        logo_url: logoUrl,
        country_code: parsed.data.country_code,
        country_name: parsed.data.country_name,
        language: parsed.data.language,
        category: parsed.data.category,
        sports_subcategory: parsed.data.sports_subcategory || null,
        stream_type: parsed.data.stream_type,
        stream_url: streamUrl,
        youtube_video_id: parsed.data.youtube_video_id || null,
        youtube_channel_id: parsed.data.youtube_channel_id || null,
        official_website: officialWebsite,
        source_url: sourceUrl,
        source_attribution: parsed.data.source_attribution || null,
        epg_channel_id: parsed.data.epg_channel_id || null,
        verification_status: parsed.data.verification_status,
        is_enabled: parsed.data.is_enabled,
        is_featured: parsed.data.is_featured || false,
        view_count: 0,
        last_checked_at: null,
        created_at: now,
        updated_at: now,
      };
      db.channels.unshift(created);
      saveLocalDb();
      await recordAudit(req.user!, 'CHANNEL_CREATED', 'channel', created.id, { name: created.name });
      res.status(201).json({ channel: created });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed creating channel' });
    }
  });

  router.put('/admin/channels/:id', requireAdmin, async (req: AuthedRequest, res) => {
    const parsed = channelSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    try {
      const updates: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.stream_url !== undefined) {
        updates.stream_url = sanitizeOptionalUrl(parsed.data.stream_url);
      }
      if (parsed.data.logo_url !== undefined) {
        updates.logo_url = sanitizeLogoUrl(parsed.data.logo_url || null);
      }
      if (parsed.data.official_website !== undefined) {
        updates.official_website = sanitizeOptionalUrl(parsed.data.official_website);
      }
      if (parsed.data.source_url !== undefined) {
        updates.source_url = sanitizeOptionalUrl(parsed.data.source_url);
      }
      updates.updated_at = new Date().toISOString();

      const sb = getSupabaseAdmin();
      if (sb) {
        const { data, error } = await sb
          .from('channels')
          .update(updates)
          .eq('id', req.params.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        await recordAudit(req.user!, 'CHANNEL_UPDATED', 'channel', req.params.id, {
          fields: Object.keys(parsed.data),
        });
        res.json({ channel: data });
        return;
      }

      const db = loadLocalDb();
      const idx = db.channels.findIndex((c) => c.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }
      db.channels[idx] = { ...db.channels[idx], ...(updates as Partial<Channel>) };
      saveLocalDb();
      await recordAudit(req.user!, 'CHANNEL_UPDATED', 'channel', req.params.id, {
        name: db.channels[idx].name,
        fields: Object.keys(parsed.data),
      });
      res.json({ channel: db.channels[idx] });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed updating channel' });
    }
  });

  router.delete('/admin/channels/:id', requireAdmin, async (req: AuthedRequest, res) => {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { error } = await sb.from('channels').delete().eq('id', req.params.id);
      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
      await recordAudit(req.user!, 'CHANNEL_DELETED', 'channel', req.params.id);
      res.json({ ok: true });
      return;
    }

    const db = loadLocalDb();
    const existing = db.channels.find((c) => c.id === req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    db.channels = db.channels.filter((c) => c.id !== req.params.id);
    saveLocalDb();
    await recordAudit(req.user!, 'CHANNEL_DELETED', 'channel', req.params.id, { name: existing.name });
    res.json({ ok: true });
  });

  router.post('/admin/channels/:id/health-check', requireAdmin, async (req: AuthedRequest, res) => {
    const channel = await getChannelByIdOrSlug(req.params.id, true);
    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const outcome = await checkStreamHealth(
      channel.stream_type,
      channel.stream_url,
      channel.youtube_video_id,
      channel.youtube_channel_id,
    );
    const now = new Date().toISOString();

    const sb = getSupabaseAdmin();
    if (sb) {
      await Promise.all([
        sb.from('stream_health_checks').insert({
          channel_id: channel.id,
          status: outcome.status,
          checked_at: now,
          response_details: outcome.details,
        }),
        sb.from('channels').update({ last_checked_at: now }).eq('id', channel.id),
      ]);
      await recordAudit(req.user!, 'HEALTH_CHECK_RUN', 'channel', channel.id, { status: outcome.status });
      res.json({ status: outcome.status, details: outcome.details, checked_at: now });
      return;
    }

    const db = loadLocalDb();
    const target = db.channels.find((c) => c.id === channel.id);
    if (target) target.last_checked_at = now;
    db.stream_health_checks.unshift({
      id: randomUUID(),
      channel_id: channel.id,
      status: outcome.status,
      checked_at: now,
      response_details: outcome.details,
    });
    saveLocalDb();
    await recordAudit(req.user!, 'HEALTH_CHECK_RUN', 'channel', channel.id, { status: outcome.status });
    res.json({ status: outcome.status, details: outcome.details, checked_at: now });
  });

  router.get('/admin/channels/:id/health-checks', requireAdmin, async (req, res) => {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('stream_health_checks')
        .select('*')
        .eq('channel_id', req.params.id)
        .order('checked_at', { ascending: false })
        .limit(20);
      res.json({ checks: data || [] });
      return;
    }
    const db = loadLocalDb();
    const checks = db.stream_health_checks
      .filter((h) => h.channel_id === req.params.id)
      .slice(0, 20);
    res.json({ checks });
  });

  // === M3U Playlist Importer ===
  router.post('/admin/channels/import/preview', requireAdmin, async (req, res) => {
    const schema = z.object({
      sourceUrl: z.string().trim().optional(),
      rawContent: z.string().optional(),
      sourceAttribution: z.string().trim().max(160).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid import preview request' });
      return;
    }

    try {
      let m3uText = parsed.data.rawContent || '';
      if (!m3uText && parsed.data.sourceUrl) {
        if (!isValidPublicHttpUrl(parsed.data.sourceUrl)) {
          res.status(400).json({ error: 'Disallowed or invalid M3U source URL' });
          return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const response = await fetch(parsed.data.sourceUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) {
          res.status(502).json({ error: `Failed fetching playlist (HTTP ${response.status})` });
          return;
        }
        m3uText = await response.text();
      }

      if (!m3uText.trim()) {
        res.status(400).json({ error: 'Provide either a valid M3U URL or raw M3U text.' });
        return;
      }

      const entries = parseM3UPlaylist(
        m3uText,
        parsed.data.sourceAttribution || parsed.data.sourceUrl || 'M3U Playlist Import',
        parsed.data.limit || 100,
      );
      res.json({ count: entries.length, entries });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed parsing M3U playlist' });
    }
  });

  router.post('/admin/channels/import', requireAdmin, async (req: AuthedRequest, res) => {
    const entrySchema = z.object({
      name: z.string().trim().min(1).max(120),
      logo_url: z.string().nullable().optional(),
      country_code: z.string().trim().min(2).max(10),
      country_name: z.string().trim().min(2).max(80),
      language: z.string().trim().min(1).max(60),
      category: z.string().trim().min(1).max(60),
      stream_url: z.string().trim(),
      stream_type: z.enum(['hls', 'youtube', 'direct', 'external', 'unconfigured']),
      epg_channel_id: z.string().nullable().optional(),
      source_attribution: z.string().trim().max(240),
    });

    const bodySchema = z.object({
      entries: z.array(entrySchema).min(1).max(200),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid import entries payload' });
      return;
    }

    const now = new Date().toISOString();
    let importedCount = 0;

    const sb = getSupabaseAdmin();
    if (sb) {
      const rows = parsed.data.entries
        .filter((e) => isValidPublicHttpUrl(e.stream_url))
        .map((e) => ({
          name: e.name,
          slug: `${slugify(e.name)}-${Math.random().toString(36).slice(2, 7)}`,
          logo_url: e.logo_url && isValidPublicHttpUrl(e.logo_url) ? e.logo_url : null,
          country_code: e.country_code.toUpperCase(),
          country_name: e.country_name,
          language: e.language,
          category: e.category,
          stream_type: e.stream_type,
          stream_url: e.stream_url,
          source_attribution: e.source_attribution,
          epg_channel_id: e.epg_channel_id || null,
          verification_status: 'unverified',
          is_enabled: false,
        }));
      if (rows.length > 0) {
        const { error } = await sb.from('channels').insert(rows);
        if (error) {
          res.status(500).json({ error: error.message });
          return;
        }
        importedCount = rows.length;
      }
      await recordAudit(req.user!, 'M3U_IMPORT_BATCH', 'channel', 'batch', { importedCount });
      res.status(201).json({ importedCount });
      return;
    }

    const db = loadLocalDb();
    const existingUrls = new Set(db.channels.map((c) => c.stream_url).filter(Boolean));
    for (const entry of parsed.data.entries) {
      if (!isValidPublicHttpUrl(entry.stream_url) || existingUrls.has(entry.stream_url)) {
        continue;
      }
      existingUrls.add(entry.stream_url);
      db.channels.unshift({
        id: randomUUID(),
        name: entry.name,
        slug: `${slugify(entry.name)}-${Math.random().toString(36).slice(2, 7)}`,
        logo_url: entry.logo_url && isValidPublicHttpUrl(entry.logo_url) ? entry.logo_url : null,
        country_code: entry.country_code.toUpperCase(),
        country_name: entry.country_name,
        language: entry.language,
        category: entry.category,
        sports_subcategory: null,
        stream_type: entry.stream_type,
        stream_url: entry.stream_url,
        youtube_video_id: null,
        official_website: null,
        source_url: null,
        source_attribution: entry.source_attribution,
        epg_channel_id: entry.epg_channel_id || null,
        verification_status: 'unverified',
        is_enabled: false,
        is_featured: false,
        view_count: 0,
        last_checked_at: null,
        created_at: now,
        updated_at: now,
      });
      importedCount += 1;
    }
    saveLocalDb();
    await recordAudit(req.user!, 'M3U_IMPORT_BATCH', 'channel', 'batch', { importedCount });
    res.status(201).json({ importedCount });
  });

  // === Admin YouTube Live Search ===
  router.post('/admin/youtube/search', requireAdmin, async (req, res) => {
    const schema = z.object({
      query: z.string().trim().min(2).max(100),
      regionCode: z.string().trim().max(2).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }
    try {
      const result = await searchYouTubeLiveBroadcasts({
        query: parsed.data.query,
        regionCode: parsed.data.regionCode,
        maxResults: 12,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'YouTube search failed' });
    }
  });

  // === Admin EPG XMLTV Sync ===
  router.post('/admin/epg/sync', requireAdmin, async (req: AuthedRequest, res) => {
    const schema = z.object({
      sourceUrl: z.string().trim().optional(),
      rawXml: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid EPG sync request' });
      return;
    }

    try {
      let xmlText = parsed.data.rawXml || '';
      if (!xmlText && parsed.data.sourceUrl) {
        if (!isValidPublicHttpUrl(parsed.data.sourceUrl)) {
          res.status(400).json({ error: 'Disallowed or invalid EPG XMLTV URL' });
          return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(parsed.data.sourceUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) {
          res.status(502).json({ error: `Failed fetching XMLTV guide (HTTP ${response.status})` });
          return;
        }
        xmlText = await response.text();
      }

      if (!xmlText.trim()) {
        res.status(400).json({ error: 'Provide either an XMLTV URL or raw XML content.' });
        return;
      }

      const programs = parseXmltvContent(xmlText, parsed.data.sourceUrl);
      const sb = getSupabaseAdmin();
      if (sb) {
        if (programs.length > 0) {
          const channelIds = Array.from(new Set(programs.map((p) => p.epg_channel_id)));
          await sb.from('epg_programs').delete().in('epg_channel_id', channelIds);
          await sb.from('epg_programs').insert(programs);
        }
        await recordAudit(req.user!, 'EPG_SYNCED', 'epg', 'xmltv', { count: programs.length });
        res.json({ importedCount: programs.length });
        return;
      }

      const db = loadLocalDb();
      const importedChannelIds = new Set(programs.map((p) => p.epg_channel_id));
      db.epg_programs = db.epg_programs
        .filter((p) => !importedChannelIds.has(p.epg_channel_id))
        .concat(programs);
      saveLocalDb();
      await recordAudit(req.user!, 'EPG_SYNCED', 'epg', 'xmltv', { count: programs.length });
      res.json({ importedCount: programs.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed parsing XMLTV guide' });
    }
  });

  // === Admin Reports Management ===
  router.get('/admin/reports', requireAdmin, async (_req, res) => {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('stream_reports')
        .select('*, channels(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      res.json({ reports: data || [] });
      return;
    }
    const db = loadLocalDb();
    res.json({ reports: db.stream_reports });
  });

  router.put('/admin/reports/:id', requireAdmin, async (req: AuthedRequest, res) => {
    const status = req.body?.status;
    if (!['open', 'investigating', 'resolved', 'dismissed'].includes(status)) {
      res.status(400).json({ error: 'Invalid report status' });
      return;
    }
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('stream_reports').update({ status }).eq('id', req.params.id);
      await recordAudit(req.user!, 'REPORT_STATUS_UPDATED', 'stream_report', req.params.id, { status });
      res.json({ ok: true });
      return;
    }
    const db = loadLocalDb();
    const report = db.stream_reports.find((r) => r.id === req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    report.status = status;
    saveLocalDb();
    await recordAudit(req.user!, 'REPORT_STATUS_UPDATED', 'stream_report', req.params.id, { status });
    res.json({ ok: true });
  });

  // === Admin Users & RBAC (Role assignment strictly SUPER_ADMIN only) ===
  router.get('/admin/users', requireAdmin, async (_req, res) => {
    const sb = getSupabaseAdmin();
    if (sb) {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        sb.from('profiles').select('*'),
        sb.from('user_roles').select('*'),
      ]);
      const roleMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
      const users = (profiles || []).map((p) => ({
        id: p.user_id,
        email: p.display_name,
        display_name: p.display_name,
        role: roleMap.get(p.user_id) || 'USER',
        created_at: p.created_at,
      }));
      res.json({ users });
      return;
    }
    const db = loadLocalDb();
    res.json({
      users: db.users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        role: u.role,
        created_at: u.created_at,
      })),
    });
  });

  router.put('/admin/users/:id/role', requireSuperAdmin, async (req: AuthedRequest, res) => {
    const role = req.body?.role as AppRole;
    if (![...ADMIN_ROLES, 'USER'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('user_roles').upsert({ user_id: req.params.id, role }, { onConflict: 'user_id' });
      await recordAudit(req.user!, 'ROLE_ASSIGNED', 'user', req.params.id, { role });
      res.json({ ok: true });
      return;
    }

    const db = loadLocalDb();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    user.role = role;
    saveLocalDb();
    await recordAudit(req.user!, 'ROLE_ASSIGNED', 'user', req.params.id, { role, targetEmail: user.email });
    res.json({ ok: true });
  });

  router.get('/admin/audit-logs', requireAdmin, async (_req, res) => {
    const sb = getSupabaseAdmin();
    if (sb) {
      const { data } = await sb
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      res.json({ logs: data || [] });
      return;
    }
    const db = loadLocalDb();
    res.json({ logs: db.audit_logs.slice(0, 100) });
  });

  return router;
}
