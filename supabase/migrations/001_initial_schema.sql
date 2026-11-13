-- Global TV Hub: Supabase PostgreSQL Initial Schema & RLS Policies
-- Execute this migration in your Supabase SQL Editor or via Supabase CLI.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Role enum for strict RBAC
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CHANNEL_MANAGER', 'CONTENT_EDITOR', 'USER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE stream_type_enum AS ENUM ('hls', 'youtube', 'direct', 'external', 'unconfigured');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE verification_status_enum AS ENUM ('verified', 'pending', 'unverified', 'unavailable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Countries
CREATE TABLE IF NOT EXISTS public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(10) NOT NULL UNIQUE,
  country_name TEXT NOT NULL,
  flag_emoji TEXT NOT NULL DEFAULT '',
  flag_url TEXT,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Channels
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  country_code VARCHAR(10) NOT NULL,
  country_name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'English',
  category TEXT NOT NULL DEFAULT 'General',
  stream_type stream_type_enum NOT NULL DEFAULT 'unconfigured',
  stream_url TEXT,
  youtube_video_id TEXT,
  youtube_channel_id TEXT,
  official_website TEXT,
  source_url TEXT,
  source_attribution TEXT,
  epg_channel_id TEXT,
  verification_status verification_status_enum NOT NULL DEFAULT 'pending',
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  view_count BIGINT NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_country ON public.channels(country_code);
CREATE INDEX IF NOT EXISTS idx_channels_category ON public.channels(category);
CREATE INDEX IF NOT EXISTS idx_channels_language ON public.channels(language);
CREATE INDEX IF NOT EXISTS idx_channels_enabled_verified ON public.channels(is_enabled, verification_status);
CREATE INDEX IF NOT EXISTS idx_channels_epg ON public.channels(epg_channel_id);

-- 4. Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'English',
  preferred_country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);

-- 7. Watch History
CREATE TABLE IF NOT EXISTS public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_time ON public.watch_history(user_id, watched_at DESC);

-- 8. Stream Reports
CREATE TABLE IF NOT EXISTS public.stream_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.stream_reports(status, created_at DESC);

-- 9. Stream Health Checks
CREATE TABLE IF NOT EXISTS public.stream_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_details JSONB
);

CREATE INDEX IF NOT EXISTS idx_health_checks_channel ON public.stream_health_checks(channel_id, checked_at DESC);

-- 10. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON public.audit_logs(created_at DESC);

-- 11. EPG Programs Cache
CREATE TABLE IF NOT EXISTS public.epg_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epg_channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_epg_channel_window ON public.epg_programs(epg_channel_id, start_time, end_time);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS channels_updated_at ON public.channels;
CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.has_admin_role(check_uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_uid
      AND role IN ('SUPER_ADMIN', 'ADMIN', 'CHANNEL_MANAGER', 'CONTENT_EDITOR')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin(check_uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_uid
      AND role = 'SUPER_ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable Row Level Security on all tables
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epg_programs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Countries & Categories: Public read, admin write
CREATE POLICY "Countries readable by everyone" ON public.countries FOR SELECT USING (true);
CREATE POLICY "Admins manage countries" ON public.countries FOR ALL USING (public.has_admin_role(auth.uid()));

CREATE POLICY "Categories readable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.has_admin_role(auth.uid()));

-- Channels: Public reads enabled channels; admins can read/write all channels
CREATE POLICY "Public reads enabled channels" ON public.channels
  FOR SELECT USING (is_enabled = true OR public.has_admin_role(auth.uid()));

CREATE POLICY "Admins manage channels" ON public.channels
  FOR ALL USING (public.has_admin_role(auth.uid()))
  WITH CHECK (public.has_admin_role(auth.uid()));

-- Profiles: Users manage their own profile; admins can read
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.has_admin_role(auth.uid()));

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User Roles: Users can read their own role; ONLY SUPER_ADMIN can assign/change roles (prevents self-promotion)
CREATE POLICY "Users read own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Only SUPER_ADMIN manages roles" ON public.user_roles
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Favorites: Strictly per-user
CREATE POLICY "Users manage own favorites" ON public.favorites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Watch History: Strictly per-user
CREATE POLICY "Users manage own watch history" ON public.watch_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Stream Reports: Anyone authenticated can insert; users see own reports; admins manage all
CREATE POLICY "Users create reports" ON public.stream_reports
  FOR INSERT WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users read own or admin reads all reports" ON public.stream_reports
  FOR SELECT USING (auth.uid() = user_id OR public.has_admin_role(auth.uid()));

CREATE POLICY "Admins update reports" ON public.stream_reports
  FOR UPDATE USING (public.has_admin_role(auth.uid()));

-- Health checks & Audit logs: Admin read/write only
CREATE POLICY "Admins read health checks" ON public.stream_health_checks
  FOR SELECT USING (public.has_admin_role(auth.uid()));

CREATE POLICY "Admins write health checks" ON public.stream_health_checks
  FOR INSERT WITH CHECK (public.has_admin_role(auth.uid()));

CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_admin_role(auth.uid()));

CREATE POLICY "Admins insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (public.has_admin_role(auth.uid()));

-- EPG Programs: Public read, admin write
CREATE POLICY "Public reads EPG programs" ON public.epg_programs FOR SELECT USING (true);
CREATE POLICY "Admins manage EPG programs" ON public.epg_programs FOR ALL USING (public.has_admin_role(auth.uid()));
