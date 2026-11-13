import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  Film,
  Globe2,
  GraduationCap,
  Layers,
  Music,
  Newspaper,
  Play,
  Radio,
  Sparkles,
  Sun,
  Trophy,
  Tv,
  type LucideIcon,
} from 'lucide-react';
import { apiFetch } from '../lib/supabase.ts';
import type { Category, Country, PaginatedChannelsResponse } from '../types/tv.ts';
import { ChannelCard, ChannelLogo, COUNTRY_FLAGS } from '../components/ChannelCard.tsx';
import heroBroadcastImg from '../assets/images/hero_broadcast_studio_1794510259508.jpg';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  sports: Trophy,
  news: Newspaper,
  entertainment: Tv,
  movies: Film,
  music: Music,
  kids: Sparkles,
  education: GraduationCap,
  documentary: Compass,
  lifestyle: Sun,
  religious: Radio,
  general: Layers,
};

export function HomePage() {
  const { data: featuredData, isLoading: loadingFeatured } = useQuery({
    queryKey: ['channels', 'featured'],
    queryFn: () =>
      apiFetch<PaginatedChannelsResponse>('/api/channels?verifiedOnly=true&limit=9'),
  });

  const { data: popularData, isLoading: loadingPopular } = useQuery({
    queryKey: ['channels', 'popular'],
    queryFn: () =>
      apiFetch<PaginatedChannelsResponse>('/api/channels?sort=popular&limit=8'),
  });

  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: () => apiFetch<{ countries: Country[] }>('/api/countries'),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<{ categories: Category[] }>('/api/categories'),
  });

  const allFeatured = featuredData?.channels || [];
  const heroChannel = allFeatured.find((c) => c.is_featured) || allFeatured[0] || null;
  const featuredChannels = allFeatured.slice(0, 6);
  const spotlightStrip = allFeatured.filter((c) => c.id !== heroChannel?.id).slice(0, 4);
  const countries = countriesData?.countries || [];
  const categories = categoriesData?.categories || [];
  const popularChannels = popularData?.channels || [];

  const totalCatalogChannels = countries.reduce((acc, c) => acc + (c.channel_count || 0), 0);
  const totalVerifiedChannels = countries.reduce((acc, c) => acc + (c.verified_count || 0), 0);

  return (
    <div className="space-y-16 pb-10 broadcast-grid-bg">
      {/* Cinematic Broadcast Studio Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800/80 bg-[#050811]">
        <img
          src={heroBroadcastImg}
          alt="International television broadcast control room"
          className="absolute inset-0 w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050811] via-[#050811]/90 to-[#050811]/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050811] via-transparent to-transparent" />

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-400">
              International Live TV &amp; Broadcast Directory
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.08] text-white text-balance">
              Watch verified live television from Bangladesh, India, and worldwide.
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
              Global TV Hub brings together legally accessible public broadcasts, official YouTube Live streams, adaptive HLS feeds, and regional broadcaster directories in one unified player.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              {heroChannel ? (
                <Link
                  to={`/watch/${heroChannel.slug}`}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500 shadow-lg shadow-rose-600/25 transition-colors whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Watch {heroChannel.name} Live
                </Link>
              ) : (
                <Link
                  to="/live"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500 shadow-lg shadow-rose-600/25 transition-colors whitespace-nowrap"
                >
                  <Tv className="w-4 h-4" />
                  Explore Live Directory
                </Link>
              )}
              <Link
                to="/sports"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15 border border-white/10 transition-colors whitespace-nowrap"
              >
                <Trophy className="w-4 h-4 text-rose-400" />
                Sports Center
              </Link>
              <Link
                to="/countries"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white/5 text-slate-200 text-sm font-medium hover:bg-white/10 border border-white/10 transition-colors whitespace-nowrap"
              >
                <Globe2 className="w-4 h-4" />
                Countries
              </Link>
            </div>

            {countries.length > 0 && (
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400 tabular-nums">
                <div>
                  <span className="font-display font-semibold text-base text-white">{totalVerifiedChannels}</span>{' '}
                  verified live streams
                </div>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <div>
                  <span className="font-display font-semibold text-base text-white">{totalCatalogChannels}</span>{' '}
                  broadcaster listings
                </div>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <div>
                  <span className="font-display font-semibold text-base text-white">{countries.length}</span>{' '}
                  countries &amp; regions
                </div>
              </div>
            )}
          </div>

          {heroChannel && (
            <div className="lg:col-span-5 space-y-3">
              <div className="rounded-2xl bg-[#0C1322]/90 backdrop-blur-xl border border-slate-700/70 p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Featured Live Broadcast
                  </span>
                  <span className="text-xs text-slate-400">
                    {COUNTRY_FLAGS[heroChannel.country_code] || ''} {heroChannel.country_name} · {heroChannel.category}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <ChannelLogo channel={heroChannel} size="xl" />
                  <div className="min-w-0">
                    <h2 className="font-display text-2xl font-bold text-white truncate">
                      {heroChannel.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300 line-clamp-2">
                      {heroChannel.source_attribution ||
                        'Authorized public adaptive bitrate live television feed.'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-slate-800/90">
                  <span className="text-xs text-slate-400">
                    Language: <span className="text-slate-200 font-medium">{heroChannel.language}</span>
                  </span>
                  <Link
                    to={`/watch/${heroChannel.slug}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600/15 text-rose-400 hover:bg-rose-600 hover:text-white text-xs font-semibold transition-colors"
                  >
                    Open Player
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {spotlightStrip.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {spotlightStrip.map((ch) => (
                    <Link
                      key={ch.id}
                      to={`/watch/${ch.slug}`}
                      className="group flex items-center gap-2.5 rounded-xl bg-[#0C1322]/85 hover:bg-[#131D33] border border-slate-800/80 hover:border-rose-500/40 p-2.5 transition-colors"
                    >
                      <ChannelLogo channel={ch} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 group-hover:text-rose-400 truncate">
                          {ch.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {ch.country_code} · {ch.category}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Featured Verified Live Channels */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Instant Playback
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Verified Live Streams
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Permitted, tested streams ready for instant in-browser playback with official broadcaster logos.
            </p>
          </div>
          <Link
            to="/live?verifiedOnly=true"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0"
          >
            View all verified
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingFeatured ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-44 rounded-xl bg-slate-200 dark:bg-slate-800/50 animate-pulse"
              />
            ))}
          </div>
        ) : featuredChannels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredChannels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <Radio className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              No verified streams are active right now. Browse the directory or configure an official stream in Admin.
            </p>
          </div>
        )}
      </section>

      {/* Browse by Country */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Regional Directories
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Browse by Country
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Explore broadcaster directories across South Asia, North America, Europe, Oceania, and the Middle East.
            </p>
          </div>
          <Link
            to="/countries"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0"
          >
            All countries
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {countries.map((country) => (
            <Link
              key={country.country_code}
              to={`/countries/${country.country_code}`}
              className="group rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200/90 dark:border-slate-800/80 p-4 shadow-xs hover:border-rose-500/50 dark:hover:border-rose-500/50 hover:bg-slate-50/40 dark:hover:bg-[#10192D] transition-all duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl" aria-hidden="true">
                  {country.flag_emoji || '📺'}
                </span>
                <span className="font-mono text-[11px] font-medium text-slate-400">
                  {country.country_code}
                </span>
              </div>
              <h3 className="mt-3 font-display font-semibold text-sm text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 truncate">
                {country.country_name}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {country.verified_count || 0} live · {country.channel_count} total
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Browse by Category */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Programming Genres
          </p>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Browse by Category
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Jump directly to live news desks, sports networks, movies, education, and cultural channels.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.slug.toLowerCase()] || Tv;
            return (
              <Link
                key={cat.id}
                to={cat.slug === 'sports' ? '/sports' : `/category/${cat.slug}`}
                className="group rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200/90 dark:border-slate-800/80 px-4 py-4 shadow-xs hover:border-rose-500/40 dark:hover:border-rose-500/40 hover:bg-slate-50/40 dark:hover:bg-[#10192D] transition-all duration-150"
              >
                <Icon className="w-5 h-5 text-rose-600 dark:text-rose-400 mb-2.5" />
                <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                  {cat.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {cat.description || 'Explore channels'}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Popular & Active Directory Channels */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Viewer Activity
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Popular &amp; Featured Directory
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Ordered by real recorded playback activity and broadcaster metadata.
            </p>
          </div>
          <Link
            to="/live"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0"
          >
            Browse full directory
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingPopular ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="h-44 rounded-xl bg-slate-200 dark:bg-slate-800/50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {popularChannels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
