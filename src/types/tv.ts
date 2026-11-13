export type AppRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'CHANNEL_MANAGER'
  | 'CONTENT_EDITOR'
  | 'USER';

export type StreamType =
  | 'hls'
  | 'youtube'
  | 'direct'
  | 'external'
  | 'unconfigured';

export type VerificationStatus =
  | 'verified'
  | 'pending'
  | 'unverified'
  | 'unavailable';

export interface Country {
  id: string;
  country_code: string;
  country_name: string;
  flag_emoji: string;
  flag_url?: string | null;
  region?: string | null;
  channel_count?: number;
  verified_count?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sort_order: number;
}

export interface Channel {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  country_code: string;
  country_name: string;
  language: string;
  category: string;
  sports_subcategory?: string | null;
  stream_type: StreamType;
  stream_url?: string | null;
  youtube_video_id?: string | null;
  youtube_channel_id?: string | null;
  official_website?: string | null;
  source_url?: string | null;
  source_attribution?: string | null;
  epg_channel_id?: string | null;
  verification_status: VerificationStatus;
  is_enabled: boolean;
  is_featured?: boolean;
  view_count: number;
  last_checked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpgProgram {
  id: string;
  epg_channel_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  start_time: string;
  end_time: string;
  source_url?: string | null;
}

export interface EpgNowNext {
  epg_channel_id: string | null;
  current: EpgProgram | null;
  next: EpgProgram | null;
  upcoming: EpgProgram[];
}

export interface StreamReport {
  id: string;
  channel_id: string;
  channel_name?: string;
  user_id?: string | null;
  issue_type: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface StreamHealthCheck {
  id: string;
  channel_id: string;
  status: string;
  checked_at: string;
  response_details?: {
    http_status?: number;
    content_type?: string;
    is_hls_manifest?: boolean;
    latency_ms?: number;
    error?: string;
  } | null;
}

export interface AuditLog {
  id: string;
  admin_user_id: string;
  admin_email?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  preferred_language?: string;
  preferred_country?: string | null;
  role: AppRole;
  created_at: string;
}

export interface YouTubeLiveItem {
  videoId: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export interface ParsedM3UEntry {
  name: string;
  logo_url?: string | null;
  country_code: string;
  country_name: string;
  language: string;
  category: string;
  stream_url: string;
  stream_type: StreamType;
  epg_channel_id?: string | null;
  source_attribution: string;
}

export interface PaginatedChannelsResponse {
  channels: Channel[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
