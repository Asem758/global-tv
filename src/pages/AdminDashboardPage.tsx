import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  Flag,
  LayoutDashboard,
  Plus,
  Radio,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Tv,
  Users,
  Youtube,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { apiFetch } from '../lib/supabase.ts';
import type {
  AppRole,
  AuditLog,
  Channel,
  PaginatedChannelsResponse,
  ParsedM3UEntry,
  StreamHealthCheck,
  StreamReport,
  StreamType,
  VerificationStatus,
  YouTubeLiveItem,
} from '../types/tv.ts';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'CHANNEL_MANAGER', 'CONTENT_EDITOR']);

type AdminTab = 'overview' | 'channels' | 'import' | 'integrations' | 'reports' | 'users' | 'audit';

interface DashboardResponse {
  metrics: {
    totalChannels: number;
    verifiedChannels: number;
    unverifiedChannels: number;
    enabledChannels: number;
    openReports: number;
    countriesRepresented: number;
    categoriesRepresented: number;
  };
  recentActivity: AuditLog[];
}

const EMPTY_FORM = {
  name: '',
  logo_url: '',
  country_code: 'BD',
  country_name: 'Bangladesh',
  language: 'Bengali',
  category: 'News',
  sports_subcategory: '',
  stream_type: 'hls' as StreamType,
  stream_url: '',
  youtube_video_id: '',
  youtube_channel_id: '',
  official_website: '',
  source_attribution: '',
  epg_channel_id: '',
  verification_status: 'pending' as VerificationStatus,
  is_enabled: true,
  is_featured: false,
};

export function AdminDashboardPage() {
  const { user, loginWithPassword } = useAuth();
  const queryClient = useQueryClient();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [tab, setTab] = useState<AdminTab>('overview');
  const [channelSearch, setChannelSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Health check modal
  const [healthChannel, setHealthChannel] = useState<Channel | null>(null);
  const [healthChecks, setHealthChecks] = useState<StreamHealthCheck[]>([]);
  const [healthRunning, setHealthRunning] = useState(false);

  // M3U Importer state
  const [m3uUrl, setM3uUrl] = useState('https://iptv-org.github.io/iptv/categories/sports.m3u');
  const [m3uRaw, setM3uRaw] = useState('');
  const [m3uPreview, setM3uPreview] = useState<ParsedM3UEntry[]>([]);
  const [m3uSelected, setM3uSelected] = useState<Set<number>>(new Set());
  const [m3uBusy, setM3uBusy] = useState(false);

  // YouTube & EPG Sync state
  const [ytQuery, setYtQuery] = useState('Bangladesh live news official');
  const [ytResults, setYtResults] = useState<YouTubeLiveItem[]>([]);
  const [ytMsg, setYtMsg] = useState<string | null>(null);
  const [epgUrl, setEpgUrl] = useState('');
  const [epgRaw, setEpgRaw] = useState('');
  const [epgMsg, setEpgMsg] = useState<string | null>(null);

  const isAuthorized = Boolean(user && ADMIN_ROLES.has(user.role));

  const { data: dashData } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiFetch<DashboardResponse>('/api/admin/dashboard'),
    enabled: isAuthorized,
  });

  const { data: channelsData } = useQuery({
    queryKey: ['admin-channels', channelSearch],
    queryFn: () =>
      apiFetch<PaginatedChannelsResponse>(
        `/api/admin/channels?limit=150${channelSearch ? `&search=${encodeURIComponent(channelSearch)}` : ''}`,
      ),
    enabled: isAuthorized,
  });

  const { data: reportsData } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => apiFetch<{ reports: StreamReport[] }>('/api/admin/reports'),
    enabled: isAuthorized && (tab === 'reports' || tab === 'overview'),
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () =>
      apiFetch<{
        users: Array<{ id: string; email: string; display_name: string; role: AppRole; created_at: string }>;
      }>('/api/admin/users'),
    enabled: isAuthorized && tab === 'users',
  });

  const { data: auditData } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => apiFetch<{ logs: AuditLog[] }>('/api/admin/audit-logs'),
    enabled: isAuthorized && tab === 'audit',
  });

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const signedUser = await loginWithPassword(loginEmail.trim(), loginPass);
      if (!ADMIN_ROLES.has(signedUser.role)) {
        setLoginError('Your account does not have administrator privileges.');
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.');
    }
  };

  if (!isAuthorized || !user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Protected Area</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Administrator Console
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {user
              ? `Signed in as ${user.email} (${user.role}). Administrator privileges are required to access this workspace.`
              : 'Sign in with an authorized administrator account to manage channels, stream verification, and reports.'}
          </p>

          {!user && (
            <form onSubmit={handleAdminSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              {loginError && <p className="text-xs text-rose-500 font-medium">{loginError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500"
              >
                Sign In to Admin
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const invalidateAllAdmin = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['admin-channels'] });
    queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
    queryClient.invalidateQueries({ queryKey: ['channels'] });
    queryClient.invalidateQueries({ queryKey: ['directory-channels'] });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEditModal = (ch: Channel) => {
    setEditingId(ch.id);
    setForm({
      name: ch.name,
      logo_url: ch.logo_url || '',
      country_code: ch.country_code,
      country_name: ch.country_name,
      language: ch.language,
      category: ch.category,
      sports_subcategory: ch.sports_subcategory || '',
      stream_type: ch.stream_type,
      stream_url: ch.stream_url || '',
      youtube_video_id: ch.youtube_video_id || '',
      youtube_channel_id: ch.youtube_channel_id || '',
      official_website: ch.official_website || '',
      source_attribution: ch.source_attribution || '',
      epg_channel_id: ch.epg_channel_id || '',
      verification_status: ch.verification_status,
      is_enabled: ch.is_enabled,
      is_featured: Boolean(ch.is_featured),
    });
    setFormError(null);
    setEditorOpen(true);
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      const payload = {
        ...form,
        logo_url: form.logo_url.trim() || null,
        stream_url: form.stream_url.trim() || null,
        youtube_video_id: form.youtube_video_id.trim() || null,
        youtube_channel_id: form.youtube_channel_id.trim() || null,
        official_website: form.official_website.trim() || null,
        source_attribution: form.source_attribution.trim() || null,
        epg_channel_id: form.epg_channel_id.trim() || null,
        sports_subcategory: form.sports_subcategory.trim() || null,
      };
      if (editingId) {
        await apiFetch(`/api/admin/channels/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setStatusNotice(`Updated channel "${form.name}".`);
      } else {
        await apiFetch('/api/admin/channels', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setStatusNotice(`Added channel "${form.name}".`);
      }
      setEditorOpen(false);
      invalidateAllAdmin();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed saving channel.');
    }
  };

  const handleDeleteChannel = async (ch: Channel) => {
    await apiFetch(`/api/admin/channels/${ch.id}`, { method: 'DELETE' });
    setStatusNotice(`Deleted channel "${ch.name}".`);
    invalidateAllAdmin();
  };

  const handleQuickToggle = async (ch: Channel, patch: Partial<Channel>) => {
    await apiFetch(`/api/admin/channels/${ch.id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    invalidateAllAdmin();
  };

  const openHealthCheckModal = async (ch: Channel) => {
    setHealthChannel(ch);
    setHealthRunning(true);
    try {
      await apiFetch(`/api/admin/channels/${ch.id}/health-check`, { method: 'POST' });
      const res = await apiFetch<{ checks: StreamHealthCheck[] }>(
        `/api/admin/channels/${ch.id}/health-checks`,
      );
      setHealthChecks(res.checks || []);
      invalidateAllAdmin();
    } finally {
      setHealthRunning(false);
    }
  };

  const handlePreviewM3U = async () => {
    setM3uBusy(true);
    setStatusNotice(null);
    try {
      const res = await apiFetch<{ count: number; entries: ParsedM3UEntry[] }>(
        '/api/admin/channels/import/preview',
        {
          method: 'POST',
          body: JSON.stringify({
            sourceUrl: m3uRaw.trim() ? undefined : m3uUrl.trim(),
            rawContent: m3uRaw.trim() || undefined,
            limit: 60,
          }),
        },
      );
      setM3uPreview(res.entries || []);
      setM3uSelected(new Set(res.entries.map((_, idx) => idx)));
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'Failed previewing M3U.');
    } finally {
      setM3uBusy(false);
    }
  };

  const handleConfirmM3UImport = async () => {
    const chosen = m3uPreview.filter((_, idx) => m3uSelected.has(idx));
    if (chosen.length === 0) return;
    setM3uBusy(true);
    try {
      const res = await apiFetch<{ importedCount: number }>('/api/admin/channels/import', {
        method: 'POST',
        body: JSON.stringify({ entries: chosen }),
      });
      setStatusNotice(
        `Imported ${res.importedCount} unverified channels into the review queue (disabled until approved).`,
      );
      setM3uPreview([]);
      invalidateAllAdmin();
    } finally {
      setM3uBusy(false);
    }
  };

  const handleYouTubeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setYtMsg(null);
    try {
      const res = await apiFetch<{
        configured: boolean;
        items: YouTubeLiveItem[];
        message?: string;
      }>('/api/admin/youtube/search', {
        method: 'POST',
        body: JSON.stringify({ query: ytQuery }),
      });
      setYtResults(res.items || []);
      if (res.message) setYtMsg(res.message);
    } catch (err) {
      setYtMsg(err instanceof Error ? err.message : 'YouTube search failed.');
    }
  };

  const handleImportYouTubeItem = async (item: YouTubeLiveItem) => {
    await apiFetch('/api/admin/channels', {
      method: 'POST',
      body: JSON.stringify({
        name: item.channelTitle || item.title.slice(0, 60),
        logo_url: item.thumbnailUrl || null,
        country_code: 'INT',
        country_name: 'International',
        language: 'English',
        category: 'News',
        stream_type: 'youtube',
        youtube_video_id: item.videoId,
        source_attribution: `YouTube Official Live (${item.channelTitle})`,
        verification_status: 'verified',
        is_enabled: true,
      }),
    });
    setStatusNotice(`Imported YouTube Live broadcast "${item.channelTitle}".`);
    invalidateAllAdmin();
  };

  const handleEpgSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setEpgMsg(null);
    try {
      const res = await apiFetch<{ importedCount: number }>('/api/admin/epg/sync', {
        method: 'POST',
        body: JSON.stringify({
          sourceUrl: epgRaw.trim() ? undefined : epgUrl.trim(),
          rawXml: epgRaw.trim() || undefined,
        }),
      });
      setEpgMsg(`Synced ${res.importedCount} XMLTV program slots.`);
      queryClient.invalidateQueries({ queryKey: ['epg-all'] });
    } catch (err) {
      setEpgMsg(err instanceof Error ? err.message : 'EPG sync failed.');
    }
  };

  const metrics = dashData?.metrics;
  const channels = channelsData?.channels || [];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-2">
          <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Admin Workspace
            </p>
            <p className="font-display font-semibold text-base text-slate-900 dark:text-white truncate">
              {user.display_name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Role: {user.role}</p>
          </div>

          <nav className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-2 space-y-1">
            {(
              [
                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                { id: 'channels', label: 'Channels & Health', icon: Tv },
                { id: 'import', label: 'M3U Importer', icon: Download },
                { id: 'integrations', label: 'YouTube & EPG', icon: Youtube },
                { id: 'reports', label: 'Stream Reports', icon: Flag },
                { id: 'users', label: 'Users & Roles', icon: Users },
                { id: 'audit', label: 'Audit Logs', icon: ClipboardList },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === item.id
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          {statusNotice && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex items-center justify-between text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span>{statusNotice}</span>
              <button type="button" onClick={() => setStatusNotice(null)} className="underline">
                Dismiss
              </button>
            </div>
          )}

          {/* OVERVIEW TAB */}
          {tab === 'overview' && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Platform Overview
                </h1>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
                >
                  <Plus className="w-4 h-4" />
                  Add Channel
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Total Channels', value: metrics?.totalChannels ?? 0 },
                  { label: 'Verified Live', value: metrics?.verifiedChannels ?? 0 },
                  { label: 'Unverified / Pending', value: metrics?.unverifiedChannels ?? 0 },
                  { label: 'Open Reports', value: metrics?.openReports ?? 0 },
                  { label: 'Countries', value: metrics?.countriesRepresented ?? 0 },
                  { label: 'Categories', value: metrics?.categoriesRepresented ?? 0 },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-4"
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
                    <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Recent Administrative Activity
                </h2>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {(dashData?.recentActivity || []).map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                          {log.action}
                        </span>{' '}
                        <span className="text-slate-500 dark:text-slate-400">
                          on {log.entity_type} ({log.admin_email || log.admin_user_id})
                        </span>
                      </div>
                      <span className="text-slate-400 tabular-nums shrink-0">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CHANNELS TAB */}
          {tab === 'channels' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input
                  type="search"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Filter channels..."
                  className="w-full sm:w-72 px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800"
                />
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
                >
                  <Plus className="w-4 h-4" />
                  Add Channel
                </button>
              </div>

              <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Channel</th>
                      <th className="py-3 px-3 font-semibold">Country</th>
                      <th className="py-3 px-3 font-semibold">Stream Type</th>
                      <th className="py-3 px-3 font-semibold">Verification</th>
                      <th className="py-3 px-3 font-semibold">Enabled</th>
                      <th className="py-3 px-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {channels.map((ch) => (
                      <tr key={ch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{ch.name}</p>
                          <p className="text-slate-500 dark:text-slate-400">{ch.category} · {ch.language}</p>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                          {ch.country_code} · {ch.country_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {ch.stream_type}
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickToggle(ch, {
                                verification_status:
                                  ch.verification_status === 'verified' ? 'unverified' : 'verified',
                              })
                            }
                            className={`font-semibold ${
                              ch.verification_status === 'verified'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {ch.verification_status}
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleQuickToggle(ch, { is_enabled: !ch.is_enabled })}
                            className={`font-semibold ${
                              ch.is_enabled ? 'text-emerald-500' : 'text-slate-400'
                            }`}
                          >
                            {ch.is_enabled ? 'Enabled' : 'Disabled'}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            onClick={() => openHealthCheckModal(ch)}
                            title="Run stream health check"
                            className="p-1.5 rounded-md text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(ch)}
                            title="Edit channel"
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChannel(ch)}
                            title="Delete channel"
                            className="p-1.5 rounded-md text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* M3U IMPORTER TAB */}
          {tab === 'import' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  IPTV-org &amp; M3U Playlist Importer
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Imported streams are normalized, deduplicated, marked <code className="font-mono">unverified</code>, and kept disabled until an administrator verifies authorization and playback.
                </p>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'IPTV-org Sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
                    { label: 'IPTV-org News', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
                    { label: 'IPTV-org Bangladesh', url: 'https://iptv-org.github.io/iptv/countries/bd.m3u' },
                    { label: 'IPTV-org India', url: 'https://iptv-org.github.io/iptv/countries/in.m3u' },
                  ].map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => {
                        setM3uRaw('');
                        setM3uUrl(preset.url);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Playlist URL
                    </label>
                    <input
                      type="url"
                      value={m3uUrl}
                      onChange={(e) => setM3uUrl(e.target.value)}
                      placeholder="https://iptv-org.github.io/iptv/index.m3u"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Or Paste Raw M3U Playlist Text
                    </label>
                    <textarea
                      rows={4}
                      value={m3uRaw}
                      onChange={(e) => setM3uRaw(e.target.value)}
                      placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-country=&quot;BD&quot; group-title=&quot;News&quot;,Sample Channel&#10;https://example.com/stream.m3u8"
                      className="w-full px-3 py-2 font-mono text-xs rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={m3uBusy}
                    onClick={handlePreviewM3U}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 disabled:opacity-60"
                  >
                    {m3uBusy ? 'Parsing Playlist...' : 'Fetch & Preview Entries'}
                  </button>
                </div>
              </div>

              {m3uPreview.length > 0 && (
                <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                      Preview ({m3uSelected.size} / {m3uPreview.length} selected)
                    </h3>
                    <button
                      type="button"
                      disabled={m3uBusy || m3uSelected.size === 0}
                      onClick={handleConfirmM3UImport}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60"
                    >
                      Import Selected to Review Queue
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {m3uPreview.map((entry, idx) => (
                      <label
                        key={`${entry.stream_url}-${idx}`}
                        className="py-2.5 flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={m3uSelected.has(idx)}
                          onChange={(e) => {
                            const next = new Set(m3uSelected);
                            if (e.target.checked) next.add(idx);
                            else next.delete(idx);
                            setM3uSelected(next);
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {entry.name}
                          </p>
                          <p className="text-slate-500 truncate">
                            {entry.country_code} · {entry.category} · {entry.stream_url}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* YOUTUBE & EPG INTEGRATIONS TAB */}
          {tab === 'integrations' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  YouTube Data API v3 Live Discovery
                </h2>
                <form onSubmit={handleYouTubeSearch} className="flex flex-wrap gap-3">
                  <input
                    type="text"
                    value={ytQuery}
                    onChange={(e) => setYtQuery(e.target.value)}
                    placeholder="Search live official broadcasts..."
                    className="flex-1 min-w-[220px] px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
                  >
                    Search Live Streams
                  </button>
                </form>
                {ytMsg && <p className="text-xs text-amber-500 font-medium">{ytMsg}</p>}
                {ytResults.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {ytResults.map((item) => (
                      <div
                        key={item.videoId}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {item.channelTitle}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{item.title}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleImportYouTubeItem(item)}
                          className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold shrink-0"
                        >
                          Add Channel
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  XMLTV EPG Schedule Sync
                </h2>
                <form onSubmit={handleEpgSync} className="space-y-3">
                  <input
                    type="url"
                    value={epgUrl}
                    onChange={(e) => setEpgUrl(e.target.value)}
                    placeholder="XMLTV guide URL (e.g. https://iptv-org.github.io/epg/guides/...)"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                  />
                  <textarea
                    rows={4}
                    value={epgRaw}
                    onChange={(e) => setEpgRaw(e.target.value)}
                    placeholder="Or paste XMLTV <tv><programme ...></programme></tv> payload"
                    className="w-full px-3 py-2 font-mono text-xs rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                  />
                  {epgMsg && <p className="text-xs text-emerald-500 font-medium">{epgMsg}</p>}
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
                  >
                    Sync XMLTV Programs
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* REPORTS TAB */}
          {tab === 'reports' && (
            <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Reported Stream Issues
              </h2>
              {(reportsData?.reports || []).length === 0 ? (
                <p className="text-sm text-slate-500">No broken stream reports submitted yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(reportsData?.reports || []).map((rep) => (
                    <div key={rep.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {rep.channel_name || rep.channel_id} — {rep.issue_type}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{rep.description}</p>
                      </div>
                      <select
                        value={rep.status}
                        onChange={async (e) => {
                          await apiFetch(`/api/admin/reports/${rep.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({ status: e.target.value }),
                          });
                          queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
                          queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
                        }}
                        className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                      >
                        <option value="open">Open</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* USERS & RBAC TAB */}
          {tab === 'users' && (
            <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                  User &amp; Role Management
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Only SUPER_ADMIN accounts can assign or change administrative roles.
                </p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {(usersData?.users || []).map((u) => (
                  <div key={u.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{u.display_name}</p>
                      <p className="text-slate-500">{u.email}</p>
                    </div>
                    <select
                      disabled={user.role !== 'SUPER_ADMIN'}
                      value={u.role}
                      onChange={async (e) => {
                        await apiFetch(`/api/admin/users/${u.id}/role`, {
                          method: 'PUT',
                          body: JSON.stringify({ role: e.target.value }),
                        });
                        queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                        setStatusNotice(`Updated role for ${u.email} to ${e.target.value}.`);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                    >
                      <option value="USER">USER</option>
                      <option value="CONTENT_EDITOR">CONTENT_EDITOR</option>
                      <option value="CHANNEL_MANAGER">CHANNEL_MANAGER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AUDIT LOGS TAB */}
          {tab === 'audit' && (
            <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Administrative Audit Trail
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {(auditData?.logs || []).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {log.action}
                      </span>{' '}
                      <span className="text-slate-500">
                        {log.entity_type} · {log.entity_id} · by {log.admin_email || log.admin_user_id}
                      </span>
                    </div>
                    <span className="text-slate-400 tabular-nums shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Channel Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-8">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {editingId ? 'Edit Channel' : 'Add New Channel'}
            </h2>
            <form onSubmit={handleSaveChannel} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Channel Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Logo URL</label>
                <input
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Country Code *</label>
                <input
                  required
                  value={form.country_code}
                  onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Country Name *</label>
                <input
                  required
                  value={form.country_name}
                  onChange={(e) => setForm({ ...form, country_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                >
                  {[
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
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Language *</label>
                <input
                  required
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Stream Type *</label>
                <select
                  value={form.stream_type}
                  onChange={(e) => setForm({ ...form, stream_type: e.target.value as StreamType })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                >
                  <option value="hls">HLS (.m3u8)</option>
                  <option value="youtube">Official YouTube Embed</option>
                  <option value="direct">Authorized Direct Stream</option>
                  <option value="external">Authorized External Link</option>
                  <option value="unconfigured">Discovery Only (Unconfigured)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Verification Status *</label>
                <select
                  value={form.verification_status}
                  onChange={(e) =>
                    setForm({ ...form, verification_status: e.target.value as VerificationStatus })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                >
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="unverified">Unverified</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Stream URL (.m3u8 / Direct / External)</label>
                <input
                  value={form.stream_url}
                  onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">YouTube Video ID</label>
                <input
                  value={form.youtube_video_id}
                  onChange={(e) => setForm({ ...form, youtube_video_id: e.target.value })}
                  placeholder="e.g. dQw4w9WgXcQ"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">YouTube Channel ID (24/7 Live)</label>
                <input
                  value={form.youtube_channel_id}
                  onChange={(e) => setForm({ ...form, youtube_channel_id: e.target.value })}
                  placeholder="e.g. UCxHoBXkY88Tb8z1Ssj6CWsQ"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">EPG Channel ID</label>
                <input
                  value={form.epg_channel_id}
                  onChange={(e) => setForm({ ...form, epg_channel_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Official Broadcaster Website</label>
                <input
                  value={form.official_website}
                  onChange={(e) => setForm({ ...form, official_website: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Source Attribution</label>
                <input
                  value={form.source_attribution}
                  onChange={(e) => setForm({ ...form, source_attribution: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-6">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_enabled}
                    onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
                  />
                  <span>Enabled in Public Directory</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                  />
                  <span>Featured on Homepage</span>
                </label>
              </div>

              {formError && <p className="sm:col-span-2 text-rose-500 font-medium">{formError}</p>}

              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500"
                >
                  Save Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Health Check Modal */}
      {healthChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-500" />
                Health Check: {healthChannel.name}
              </h3>
              <button
                type="button"
                onClick={() => setHealthChannel(null)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>
            {healthRunning ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Probing stream origin...
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {healthChecks.map((hc) => (
                  <div key={hc.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold inline-flex items-center gap-1.5">
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${
                            hc.status === 'healthy' ? 'text-emerald-500' : 'text-amber-500'
                          }`}
                        />
                        {hc.status.toUpperCase()}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        {new Date(hc.checked_at).toLocaleString()}
                      </span>
                    </div>
                    {hc.response_details && (
                      <p className="text-slate-500 font-mono">
                        HTTP: {hc.response_details.http_status ?? 'N/A'} · Latency:{' '}
                        {hc.response_details.latency_ms ?? 0}ms
                        {hc.response_details.error ? ` · ${hc.response_details.error}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
