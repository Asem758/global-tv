import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Heart, Play, Radio, Tv } from 'lucide-react';
import type { Channel } from '../types/tv.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

export const COUNTRY_FLAGS: Record<string, string> = {
  BD: '🇧🇩',
  IN: '🇮🇳',
  US: '🇺🇸',
  GB: '🇬🇧',
  CA: '🇨🇦',
  AU: '🇦🇺',
  PK: '🇵🇰',
  LK: '🇱🇰',
  NP: '🇳🇵',
  AE: '🇦🇪',
  SA: '🇸🇦',
  DE: '🇩🇪',
  FR: '🇫🇷',
  QA: '🇶🇦',
  INT: '🌐',
};

export function isChannelPlayable(channel: Channel): boolean {
  return (
    channel.verification_status === 'verified' &&
    channel.stream_type !== 'unconfigured' &&
    Boolean(channel.stream_url || channel.youtube_video_id || channel.youtube_channel_id)
  );
}

export function ChannelLogo({
  channel,
  size = 'md',
}: {
  channel: Pick<Channel, 'name' | 'logo_url' | 'country_code'>;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === 'sm'
      ? 'w-10 h-10 text-xs rounded-lg p-1'
      : size === 'lg'
        ? 'w-16 h-16 text-lg rounded-xl p-1.5'
        : size === 'xl'
          ? 'w-20 h-20 text-xl rounded-2xl p-2'
          : 'w-14 h-14 text-sm rounded-xl p-1.5';

  const initials = channel.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  if (channel.logo_url && !imgFailed) {
    return (
      <div
        className={`${dims} shrink-0 bg-white dark:bg-white/95 border border-slate-200/90 dark:border-white/15 shadow-xs overflow-hidden flex items-center justify-center transition-transform duration-150 group-hover:scale-[1.03]`}
      >
        <img
          src={channel.logo_url}
          alt={`${channel.name} logo`}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain select-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dims} shrink-0 bg-slate-100 dark:bg-[#151F35] border border-slate-200 dark:border-slate-700/80 flex items-center justify-center font-display font-bold tracking-tight text-slate-700 dark:text-slate-200`}
      aria-hidden="true"
    >
      {initials || <Tv className="w-5 h-5" />}
    </div>
  );
}

export function ChannelCard({ channel }: { channel: Channel }) {
  const { isFavorite, toggleFavorite } = useAuth();
  const fav = isFavorite(channel.id);
  const playable = isChannelPlayable(channel);

  return (
    <article className="group relative flex flex-col justify-between rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200/90 dark:border-slate-800/80 p-4 shadow-xs transition-all duration-150 hover:border-rose-500/40 dark:hover:border-rose-500/40 hover:bg-slate-50/40 dark:hover:bg-[#10192D]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/watch/${channel.slug}`}
            className="flex items-center gap-3.5 min-w-0 focus-visible:outline-none"
          >
            <ChannelLogo channel={channel} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {playable ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-500" />
                    LIVE
                  </span>
                ) : (
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Official Portal
                  </span>
                )}
              </div>
              <h3 className="mt-0.5 font-display font-semibold text-base text-slate-900 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors truncate">
                {channel.name}
              </h3>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => toggleFavorite(channel)}
            aria-label={fav ? `Remove ${channel.name} from favorites` : `Save ${channel.name} to favorites`}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <Heart className={`w-4 h-4 ${fav ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* Clean unboxed metadata with typographic separators */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          <span aria-hidden="true">{COUNTRY_FLAGS[channel.country_code] || '📺'}</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">{channel.country_name}</span>
          <span aria-hidden="true">·</span>
          <span>{channel.category}</span>
          {channel.sports_subcategory && (
            <>
              <span aria-hidden="true">·</span>
              <span>{channel.sports_subcategory}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{channel.language}</span>
        </div>

        {channel.source_attribution && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400/80 line-clamp-1">
            {channel.source_attribution}
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
        <Link
          to={`/watch/${channel.slug}`}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
            playable
              ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-xs shadow-rose-600/20'
              : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          {playable ? <Play className="w-3.5 h-3.5 fill-current" /> : <Radio className="w-3.5 h-3.5" />}
          {playable ? 'Watch Live' : 'Channel Info'}
        </Link>

        {channel.official_website && (
          <a
            href={channel.official_website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap shrink-0"
          >
            Official Site
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </article>
  );
}
