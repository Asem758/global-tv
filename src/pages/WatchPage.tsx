import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Flag,
  Heart,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/supabase.ts';
import type { Channel, EpgNowNext } from '../types/tv.ts';
import { LivePlayer } from '../components/LivePlayer.tsx';
import { ChannelCard, ChannelLogo, COUNTRY_FLAGS, isChannelPlayable } from '../components/ChannelCard.tsx';
import { ReportModal } from '../components/ReportModal.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';

interface ChannelDetailResponse {
  channel: Channel;
  related: Channel[];
  epg: EpgNowNext;
}

function formatLocalTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function WatchPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isFavorite, toggleFavorite } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['channel-detail', slug],
    queryFn: () => apiFetch<ChannelDetailResponse>(`/api/channels/${encodeURIComponent(slug || '')}`),
    enabled: Boolean(slug),
  });

  const channel = data?.channel;

  useEffect(() => {
    if (!channel) return;
    document.title = `${channel.name} — Global TV Hub`;
    apiFetch(`/api/channels/${channel.id}/view`, { method: 'POST' }).catch(() => undefined);
    if (user) {
      apiFetch('/api/user/history', {
        method: 'POST',
        body: JSON.stringify({ channel_id: channel.id }),
      }).catch(() => undefined);
    }
    return () => {
      document.title = 'Global TV Hub — International Live TV & Broadcast Directory';
    };
  }, [channel?.id, user]);

  if (isLoading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="aspect-video w-full rounded-2xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
        <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Channel Not Found
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This channel may have been disabled by an administrator or removed from the directory.
        </p>
        <Link
          to="/live"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </Link>
      </div>
    );
  }

  const fav = isFavorite(channel.id);
  const playable = isChannelPlayable(channel);
  const epg = data?.epg;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-10">
      <div className="flex items-center justify-between">
        <Link
          to="/live"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Video Column */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10">
            <LivePlayer channel={channel} onReportClick={() => setReportOpen(true)} />
          </div>

          {/* Channel Metadata Bar */}
          <div className="rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <ChannelLogo channel={channel} size="lg" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {playable ? (
                      <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified Live Broadcast
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        Official Broadcaster Portal · No Open Public Stream
                      </span>
                    )}
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {COUNTRY_FLAGS[channel.country_code] || ''} {channel.country_name}
                    </span>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="text-slate-600 dark:text-slate-400">{channel.category}</span>
                    {channel.sports_subcategory && (
                      <>
                        <span aria-hidden="true" className="text-slate-400">·</span>
                        <span className="text-slate-600 dark:text-slate-400">{channel.sports_subcategory}</span>
                      </>
                    )}
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="text-slate-600 dark:text-slate-400">{channel.language}</span>
                  </div>
                  <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">
                    {channel.name}
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleFavorite(channel)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    fav
                      ? 'bg-rose-600/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
                      : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
                  {fav ? 'Saved in Favorites' : 'Add to Favorites'}
                </button>

                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Flag className="w-4 h-4" />
                  Report Problem
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">Source Attribution:</span>{' '}
                  {channel.source_attribution || 'Official broadcaster discovery listing'}
                </div>
              </div>
              {channel.official_website && (
                <div className="sm:text-right">
                  <a
                    href={channel.official_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Official Broadcaster Website
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* EPG Program Guide Sidebar */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-rose-500" />
                Program Schedule (EPG)
              </h2>
              <Link to="/guide" className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline">
                Full Guide
              </Link>
            </div>

            {!epg?.current && !epg?.next ? (
              <div className="py-6 text-center space-y-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Program information unavailable
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No XMLTV schedule feed is currently mapped to this channel.
                </p>
              </div>
            ) : (
              <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                {epg.current && (
                  <div className="rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-500/20 p-3.5 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 tabular-nums">
                      On Now · {formatLocalTime(epg.current.start_time)} – {formatLocalTime(epg.current.end_time)}
                    </span>
                    <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                      {epg.current.title}
                    </h3>
                    {epg.current.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {epg.current.description}
                      </p>
                    )}
                  </div>
                )}

                {epg.next && (
                  <div className="pt-2 space-y-1 px-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 tabular-nums">
                      Up Next · {formatLocalTime(epg.next.start_time)} – {formatLocalTime(epg.next.end_time)}
                    </span>
                    <h3 className="font-display font-medium text-sm text-slate-800 dark:text-slate-200">
                      {epg.next.title}
                    </h3>
                    {epg.next.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {epg.next.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Related Channels */}
      {data?.related && data.related.length > 0 && (
        <section className="space-y-5">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            More in {channel.category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.related.map((rel) => (
              <ChannelCard key={rel.id} channel={rel} />
            ))}
          </div>
        </section>
      )}

      {reportOpen && <ReportModal channel={channel} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
