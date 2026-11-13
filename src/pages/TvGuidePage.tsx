import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, Clock, Play } from 'lucide-react';
import { apiFetch } from '../lib/supabase.ts';
import type { EpgProgram, PaginatedChannelsResponse } from '../types/tv.ts';
import { ChannelLogo, COUNTRY_FLAGS, isChannelPlayable } from '../components/ChannelCard.tsx';

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TvGuidePage() {
  const { data: channelsData, isLoading: loadingChannels } = useQuery({
    queryKey: ['guide-channels'],
    queryFn: () => apiFetch<PaginatedChannelsResponse>('/api/channels?limit=75'),
  });

  const { data: epgData, isLoading: loadingEpg } = useQuery({
    queryKey: ['epg-all'],
    queryFn: () => apiFetch<{ programs: EpgProgram[] }>('/api/epg'),
  });

  const channels = channelsData?.channels || [];
  const programs = epgData?.programs || [];
  const now = Date.now();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <CalendarClock className="w-4 h-4" />
            <span>Electronic Program Guide (XMLTV)</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            TV Program Guide
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Schedule times are displayed in your local timezone ({timezone}). Channels without an XMLTV feed display &ldquo;Program information unavailable&rdquo;.
          </p>
        </div>
      </div>

      {loadingChannels || loadingEpg ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => {
            const channelPrograms = channel.epg_channel_id
              ? programs
                  .filter((p) => p.epg_channel_id === channel.epg_channel_id)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
              : [];

            const current = channelPrograms.find(
              (p) => Date.parse(p.start_time) <= now && Date.parse(p.end_time) > now,
            );
            const next = channelPrograms.find((p) => Date.parse(p.start_time) > now);
            const playable = isChannelPlayable(channel);

            return (
              <div
                key={channel.id}
                className="rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200/90 dark:border-slate-800/80 p-4 shadow-xs hover:border-rose-500/40 transition-colors grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
              >
                <div className="lg:col-span-4 flex items-center gap-3.5 min-w-0">
                  <ChannelLogo channel={channel} />
                  <div className="min-w-0">
                    <Link
                      to={`/watch/${channel.slug}`}
                      className="font-display font-semibold text-base text-slate-900 dark:text-white hover:text-rose-600 dark:hover:text-rose-400 truncate block"
                    >
                      {channel.name}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {COUNTRY_FLAGS[channel.country_code] || ''} {channel.country_name} · {channel.category}
                      {playable ? ' · Live Stream Ready' : ''}
                    </p>
                  </div>
                </div>

                {current || next ? (
                  <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {current
                          ? `Now · ${formatTime(current.start_time)} – ${formatTime(current.end_time)}`
                          : 'On Now'}
                      </span>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {current ? current.title : 'No current slot'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 tabular-nums">
                        {next
                          ? `Up Next · ${formatTime(next.start_time)} – ${formatTime(next.end_time)}`
                          : 'Up Next'}
                      </span>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {next ? next.title : 'No upcoming schedule'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="lg:col-span-6 text-sm text-slate-500 dark:text-slate-400">
                    Program information unavailable
                  </div>
                )}

                <div className="lg:col-span-2 flex lg:justify-end">
                  <Link
                    to={`/watch/${channel.slug}`}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      playable
                        ? 'bg-rose-600 text-white hover:bg-rose-500'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {playable && <Play className="w-3 h-3 fill-current" />}
                    {playable ? 'Watch Live' : 'Channel Info'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
