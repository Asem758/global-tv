import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Globe2 } from 'lucide-react';
import { apiFetch } from '../lib/supabase.ts';
import type { Country, PaginatedChannelsResponse } from '../types/tv.ts';
import { ChannelCard } from '../components/ChannelCard.tsx';

export function CountriesPage() {
  const { data: countriesData, isLoading } = useQuery({
    queryKey: ['countries'],
    queryFn: () => apiFetch<{ countries: Country[] }>('/api/countries'),
  });

  const { data: bdChannels } = useQuery({
    queryKey: ['channels', 'country', 'BD'],
    queryFn: () => apiFetch<PaginatedChannelsResponse>('/api/channels/country/BD?limit=8'),
  });

  const { data: inChannels } = useQuery({
    queryKey: ['channels', 'country', 'IN'],
    queryFn: () => apiFetch<PaginatedChannelsResponse>('/api/channels/country/IN?limit=8'),
  });

  const countries = countriesData?.countries || [];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-12">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          <Globe2 className="w-4 h-4" />
          <span>International Broadcaster Index</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
          Countries &amp; Regional Directories
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
          Every country below lists verified active channels in our directory with official logos and direct broadcast links.
        </p>
      </div>

      {/* Country Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {countries.map((country) => (
            <Link
              key={country.country_code}
              to={`/countries/${country.country_code}`}
              className="group flex items-center justify-between gap-4 rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200/90 dark:border-slate-800/80 p-4 shadow-xs hover:border-rose-500/50 dark:hover:border-rose-500/50 hover:bg-slate-50/40 dark:hover:bg-[#10192D] transition-all duration-150"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="text-3xl" aria-hidden="true">
                  {country.flag_emoji || '📺'}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 truncate">
                    {country.country_name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {country.channel_count} listings · {country.verified_count || 0} verified live
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Bangladesh Section */}
      {bdChannels && bdChannels.channels.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                🇧🇩 Bangladesh Channel Directory
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                National and private television broadcasters including Somoy TV, Jamuna TV, Banglavision, NTV, Ekattor TV, Channel 24, and T-Sports.
              </p>
            </div>
            <Link
              to="/countries/BD"
              className="text-sm font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap"
            >
              View all ({bdChannels.total})
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {bdChannels.channels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        </section>
      )}

      {/* India Section */}
      {inChannels && inChannels.channels.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                🇮🇳 India Channel Directory
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Public broadcasters, sports, and news networks including DD Sports, Aaj Tak, India Today, DD News, NDTV, Sony Ten 2, and SonyLIV.
              </p>
            </div>
            <Link
              to="/countries/IN"
              className="text-sm font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap"
            >
              View all ({inChannels.total})
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {inChannels.channels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
