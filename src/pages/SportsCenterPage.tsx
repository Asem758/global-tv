import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ExternalLink, Globe2, Info, Play, Radio, Trophy } from 'lucide-react';
import { apiFetch } from '../lib/supabase.ts';
import type { Channel, YouTubeLiveItem } from '../types/tv.ts';
import { ChannelCard, ChannelLogo, isChannelPlayable } from '../components/ChannelCard.tsx';
import sportsStadiumImg from '../assets/images/sports_stadium_live_1794510259994.jpg';

const SPORTS_TABS = ['All', 'Cricket', 'Football', 'Tennis', 'Basketball', 'Motorsport', 'Other'] as const;

type SportTag = (typeof SPORTS_TABS)[number];

interface RegionalBroadcaster {
  name: string;
  sports: string;
  subcategories: SportTag[];
  accessType: 'Free Live Stream' | 'Official Subscription / Broadcaster Portal';
  watchSlug?: string;
  officialUrl: string;
}

interface RegionalSportsGroup {
  region: string;
  flag: string;
  countryCode?: string;
  broadcasters: RegionalBroadcaster[];
}

const POPULAR_SPORTS_BY_REGION: RegionalSportsGroup[] = [
  {
    region: 'Bangladesh',
    flag: '🇧🇩',
    countryCode: 'BD',
    broadcasters: [
      {
        name: 'T-Sports',
        sports: 'Bangladesh Cricket, BPL, International Football & Domestic Leagues',
        subcategories: ['Cricket', 'Football'],
        accessType: 'Official Subscription / Broadcaster Portal',
        watchSlug: 't-sports-bd',
        officialUrl: 'https://www.tsports.com/',
      },
    ],
  },
  {
    region: 'India',
    flag: '🇮🇳',
    countryCode: 'IN',
    broadcasters: [
      {
        name: 'DD Sports',
        sports: 'Cricket, Hockey, Athletics, National Games',
        subcategories: ['Cricket', 'Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'dd-sports',
        officialUrl: 'https://prasarbharati.gov.in/',
      },
      {
        name: 'Sony Ten 2',
        sports: 'UEFA Champions League, Bundesliga, International Cricket, WWE & UFC',
        subcategories: ['Football', 'Cricket', 'Tennis', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        watchSlug: 'sony-ten-2-in',
        officialUrl: 'https://www.sonyliv.com/',
      },
      {
        name: 'SonyLIV',
        sports: 'UEFA Champions League, Cricket, Grand Slam Tennis, UFC & Olympic Events',
        subcategories: ['Football', 'Cricket', 'Tennis', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        watchSlug: 'sonyliv-in',
        officialUrl: 'https://www.sonyliv.com/',
      },
      {
        name: 'Star Sports (1 / 2 / Select / HD)',
        sports: 'ICC Cricket, IPL, India Home Series, Premier League, Pro Kabaddi',
        subcategories: ['Cricket', 'Football', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.hotstar.com/in/sports',
      },
      {
        name: 'Sports18 / JioCinema',
        sports: 'Cricket, Indian Super League, Serie A, Ligue 1, MotoGP',
        subcategories: ['Cricket', 'Football', 'Motorsport'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.jiocinema.com/sports',
      },
    ],
  },
  {
    region: 'United Kingdom',
    flag: '🇬🇧',
    countryCode: 'GB',
    broadcasters: [
      {
        name: 'FIFA+ UK',
        sports: 'International Football, Qualifiers & World Cup Archives',
        subcategories: ['Football'],
        accessType: 'Free Live Stream',
        watchSlug: 'fifa-plus-uk',
        officialUrl: 'https://www.plus.fifa.com/',
      },
      {
        name: 'FIFA+ Women',
        sports: "Women's Football Leagues & FIFA Championships",
        subcategories: ['Football'],
        accessType: 'Free Live Stream',
        watchSlug: 'fifa-plus-women-uk',
        officialUrl: 'https://www.plus.fifa.com/',
      },
      {
        name: 'talkSPORT TV',
        sports: 'Premier League Studio, Live Football & Cricket Talk',
        subcategories: ['Football', 'Cricket'],
        accessType: 'Free Live Stream',
        watchSlug: 'talksport-uk',
        officialUrl: 'https://talksport.com/',
      },
      {
        name: 'Sky Sports (Main Event, Premier League, Cricket, F1)',
        sports: 'Premier League, EFL, England Cricket, Formula 1, Golf',
        subcategories: ['Football', 'Cricket', 'Motorsport', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.skysports.com/',
      },
      {
        name: 'TNT Sports (1–4)',
        sports: 'UEFA Champions League, Premier League, Rugby, MotoGP, Boxing',
        subcategories: ['Football', 'Motorsport', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.tntsports.co.uk/',
      },
      {
        name: 'BBC Sport & ITV Sport',
        sports: 'Wimbledon, FA Cup, Six Nations, Athletics, Tour de France',
        subcategories: ['Football', 'Tennis', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.bbc.co.uk/sport',
      },
    ],
  },
  {
    region: 'Australia',
    flag: '🇦🇺',
    countryCode: 'AU',
    broadcasters: [
      {
        name: 'Cricket Gold',
        sports: 'Classic Australian Test, ODI & Big Bash Cricket Matches',
        subcategories: ['Cricket'],
        accessType: 'Free Live Stream',
        watchSlug: 'cricket-gold-au',
        officialUrl: 'https://www.cricket.com.au/',
      },
      {
        name: 'Fox Sports News Australia',
        sports: '24/7 Cricket, AFL, NRL, Football & Motorsport News Desk',
        subcategories: ['Cricket', 'Football', 'Motorsport', 'Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'fox-sports-news-au',
        officialUrl: 'https://www.foxsports.com.au/',
      },
      {
        name: 'Fox Cricket & Fox Sports (501–507)',
        sports: 'Australian Cricket, BBL, AFL, NRL, Formula 1, Supercars',
        subcategories: ['Cricket', 'Football', 'Motorsport', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.foxsports.com.au/',
      },
      {
        name: 'Kayo Sports',
        sports: 'Live Cricket, AFL, NRL, Football, Formula 1, NBA',
        subcategories: ['Cricket', 'Football', 'Basketball', 'Motorsport'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://kayosports.com.au/',
      },
      {
        name: 'Nine Wide World of Sports & 7sport',
        sports: 'Test Cricket, Ashes, Australian Open Tennis, AFL, NRL',
        subcategories: ['Cricket', 'Tennis', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://wwos.nine.com.au/',
      },
    ],
  },
  {
    region: 'United States',
    flag: '🇺🇸',
    countryCode: 'US',
    broadcasters: [
      {
        name: 'Fox Sports',
        sports: 'NFL, MLB, FIFA World Cup, CONCACAF, College Sports & Live Studio',
        subcategories: ['Football', 'Basketball', 'Motorsport', 'Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'fox-sports-us',
        officialUrl: 'https://www.foxsports.com/',
      },
      {
        name: 'NBC Sports NOW',
        sports: 'Premier League Studio, Golf, Olympics & Motorsport',
        subcategories: ['Football', 'Motorsport', 'Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'nbc-sports-now-us',
        officialUrl: 'https://www.nbcsports.com/',
      },
      {
        name: 'FIFA+ (US)',
        sports: 'Live International Football & FIFA Club Competitions',
        subcategories: ['Football'],
        accessType: 'Free Live Stream',
        watchSlug: 'fifa-plus-us',
        officialUrl: 'https://www.plus.fifa.com/',
      },
      {
        name: 'ACC Digital Network',
        sports: 'NCAA College Basketball, Football & Olympic Sports',
        subcategories: ['Basketball', 'Football', 'Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'acc-digital-network',
        officialUrl: 'https://theacc.com/',
      },
      {
        name: 'FTF Sports',
        sports: 'Basketball, Combat Sports & Action Sports Leagues',
        subcategories: ['Basketball', 'Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'ftf-sports-us',
        officialUrl: 'https://www.ftfsports.com/',
      },
      {
        name: 'ESPN & ESPN+',
        sports: 'NBA, NFL, MLB, LaLiga, Bundesliga, UFC, Wimbledon',
        subcategories: ['Basketball', 'Football', 'Tennis', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.espn.com/watch/',
      },
      {
        name: 'Willow Cricket',
        sports: 'International Cricket, IPL, PSL, BBL & ICC Events (North America)',
        subcategories: ['Cricket'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.willow.tv/',
      },
    ],
  },
  {
    region: 'Canada',
    flag: '🇨🇦',
    countryCode: 'CA',
    broadcasters: [
      {
        name: 'TSN The Ocho',
        sports: 'Multi-Sport Championships & Specialty Competitions',
        subcategories: ['Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'tsn-the-ocho-ca',
        officialUrl: 'https://www.tsn.ca/',
      },
      {
        name: 'TSN (TSN1–TSN5)',
        sports: 'NHL, NBA, CFL, NFL, Formula 1, ATP & WTA Tennis',
        subcategories: ['Basketball', 'Tennis', 'Motorsport', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.tsn.ca/live',
      },
      {
        name: 'Sportsnet (SN / SN1 / World)',
        sports: 'NHL, MLB, NBA, Premier League, Rugby & Curling',
        subcategories: ['Basketball', 'Football', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.sportsnet.ca/',
      },
      {
        name: 'CBC Sports & OneSoccer',
        sports: 'Olympics, Athletics, Canadian Premier League & CONCACAF Football',
        subcategories: ['Football', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.cbc.ca/sports',
      },
    ],
  },
  {
    region: 'International & Global',
    flag: '🌐',
    countryCode: 'INT',
    broadcasters: [
      {
        name: 'DAZN',
        sports: "Combat Sports, Boxing, Women's Football & Global Live Events",
        subcategories: ['Football', 'Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'dazn-intl',
        officialUrl: 'https://www.dazn.com/',
      },
      {
        name: 'beIN SPORTS XTRA en Espanol',
        sports: 'Live Football, Ligue 1, Turkish Super Lig & Match Highlights',
        subcategories: ['Football'],
        accessType: 'Free Live Stream',
        watchSlug: 'bein-sports-xtra-espanol',
        officialUrl: 'https://www.beinsportsxtra.com/',
      },
      {
        name: 'Tennis Channel',
        sports: 'ATP & WTA Tennis Tours, Grand Slam Analysis & Classics',
        subcategories: ['Tennis'],
        accessType: 'Free Live Stream',
        watchSlug: 'tennis-channel-intl',
        officialUrl: 'https://www.tennischannel.com/',
      },
      {
        name: 'Red Bull TV',
        sports: 'Rally, Drift, MotoGP Features, MTB & Action Motorsport',
        subcategories: ['Motorsport', 'Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'red-bull-tv-intl',
        officialUrl: 'https://www.redbull.com/tv',
      },
      {
        name: 'Eurovision Sport',
        sports: 'World Athletics, Aquatics, Cycling, Skiing & Biathlon',
        subcategories: ['Other'],
        accessType: 'Free Live Stream',
        watchSlug: 'eurovision-sport-intl',
        officialUrl: 'https://eurovisionsport.com/',
      },
      {
        name: 'beIN SPORTS Global, Eurosport & ICC.tv',
        sports: 'UEFA Champions League, Formula 1, Grand Slams & World Cricket',
        subcategories: ['Football', 'Cricket', 'Tennis', 'Motorsport', 'Other'],
        accessType: 'Official Subscription / Broadcaster Portal',
        officialUrl: 'https://www.beinsports.com/',
      },
    ],
  },
];

interface SportsResponse {
  channels: Channel[];
  youtubeLive: {
    configured: boolean;
    cached: boolean;
    items: YouTubeLiveItem[];
    message?: string;
  };
}

export function SportsCenterPage() {
  const [selectedSport, setSelectedSport] = useState<SportTag>('All');
  const [activeYouTubeId, setActiveYouTubeId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sports-live', selectedSport],
    queryFn: () =>
      apiFetch<SportsResponse>(
        `/api/sports/live${selectedSport !== 'All' ? `?subcategory=${encodeURIComponent(selectedSport)}` : ''}`,
      ),
  });

  const sportsChannels = data?.channels || [];
  const channelBySlug = new Map(sportsChannels.map((c) => [c.slug, c]));
  const liveSportsChannels = sportsChannels.filter(isChannelPlayable);
  const discoverySportsChannels = sportsChannels.filter((ch) => !isChannelPlayable(ch));
  const ytLive = data?.youtubeLive;

  const filteredRegions = POPULAR_SPORTS_BY_REGION.map((group) => ({
    ...group,
    broadcasters:
      selectedSport === 'All'
        ? group.broadcasters
        : group.broadcasters.filter((b) => b.subcategories.includes(selectedSport)),
  })).filter((group) => group.broadcasters.length > 0);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-12">
      {/* Sports Center Hero */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#050811] shadow-lg">
        <img
          src={sportsStadiumImg}
          alt="International sports stadium under night floodlights"
          className="absolute inset-0 w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050811] via-[#050811]/90 to-[#050811]/40" />
        <div className="relative p-8 sm:p-10 space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-400">
            <Trophy className="w-4 h-4" />
            <span>Global TV Hub Sports Center</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white text-balance">
            Live Sports Channels &amp; Regional Broadcasters
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl">
            Watch verified free-to-air and FAST live sports feeds covering Football, Cricket, Tennis, Basketball, and Motorsport across India, the UK, Australia, the USA, Canada, and worldwide.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2">
            {SPORTS_TABS.map((sport) => (
              <button
                key={sport}
                type="button"
                onClick={() => setSelectedSport(sport)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  selectedSport === sport
                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-600/30'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                {sport}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inline Official YouTube Player Modal/Drawer if selected */}
      {activeYouTubeId && (
        <section className="rounded-xl bg-[#0C1322] border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
              Official YouTube Live Embed
            </span>
            <button
              type="button"
              onClick={() => setActiveYouTubeId(null)}
              className="text-xs font-medium text-slate-300 hover:text-white"
            >
              Close Player
            </button>
          </div>
          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${encodeURIComponent(activeYouTubeId)}?autoplay=1&rel=0`}
              title="Official YouTube Live Sports Broadcast"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </section>
      )}

      {/* Live Playable Sports Channels */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              Live Sports Streams ({liveSportsChannels.length})
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Verified, CORS-enabled live sports channels ready for instant in-browser playback ({selectedSport}).
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-slate-200 dark:bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : liveSportsChannels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {liveSportsChannels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No live free-to-air sports streams currently match &ldquo;{selectedSport}&rdquo;. See official regional broadcasters below.
          </div>
        )}
      </section>

      {/* Subscription & Official Portal Broadcasters in Catalog */}
      {discoverySportsChannels.length > 0 && (
        <section className="space-y-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              Official Subscription &amp; Broadcaster Listings ({discoverySportsChannels.length})
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Pay-TV and subscription-only networks registered in the directory with links to their official streaming portals.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {discoverySportsChannels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        </section>
      )}

      {/* Popular Sports Networks by Region */}
      <section className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            <Globe2 className="w-4 h-4" />
            <span>Global Broadcaster Guide</span>
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
            Popular Sports Networks by Region ({selectedSport})
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Major football, cricket, tennis, basketball, and motorsport broadcasters across India, UK, Australia, USA, Canada, and worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRegions.map((group) => (
            <div
              key={group.region}
              className="rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <span aria-hidden="true">{group.flag}</span>
                  <span>{group.region}</span>
                </h3>
                {group.countryCode && (
                  <Link
                    to={`/countries/${group.countryCode}`}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Country Directory
                  </Link>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {group.broadcasters.map((net) => {
                  const catalogMatch = net.watchSlug ? channelBySlug.get(net.watchSlug) : undefined;
                  const isLive = net.accessType === 'Free Live Stream';

                  return (
                    <div
                      key={`${group.region}-${net.name}`}
                      className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {catalogMatch && <ChannelLogo channel={catalogMatch} size="sm" />}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
                              {net.name}
                            </span>
                            <span aria-hidden="true" className="text-slate-400">
                              ·
                            </span>
                            <span
                              className={`text-[11px] font-semibold uppercase tracking-wider ${
                                isLive
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isLive ? 'Live Stream Available' : 'Official Subscription Portal'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{net.sports}</p>
                        </div>
                      </div>

                      {net.watchSlug && isLive ? (
                        <Link
                          to={`/watch/${net.watchSlug}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500 whitespace-nowrap shrink-0"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Watch Live
                        </Link>
                      ) : (
                        <a
                          href={net.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium whitespace-nowrap shrink-0"
                        >
                          Official Portal
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Official Live Sports Broadcasts (YouTube Data API v3) */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Official Live Sports Broadcasts
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Powered by the official YouTube Data API v3 (`eventType=live`).
          </p>
        </div>

        {!ytLive?.configured ? (
          <div className="rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800 p-6 flex items-start gap-4">
            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-slate-900 dark:text-white">
                YouTube Live API Discovery Not Configured
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Set <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">YOUTUBE_API_KEY</code> in your server environment variables to automatically discover embeddable official live sports broadcasts. Global TV Hub never fabricates live match fixtures or scores.
              </p>
            </div>
          </div>
        ) : ytLive.items.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800 p-6 text-sm text-slate-600 dark:text-slate-400">
            No embeddable live sports broadcasts matched &ldquo;{selectedSport}&rdquo; at this moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ytLive.items.map((item) => (
              <div
                key={item.videoId}
                className="rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-video bg-slate-900 overflow-hidden">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Radio className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      YouTube Live
                    </span>
                    <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-white line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.channelTitle}
                    </p>
                  </div>
                </div>
                <div className="px-4 pb-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveYouTubeId(item.videoId)}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
                  >
                    Watch Embed
                  </button>
                  <a
                    href={`https://www.youtube.com/watch?v=${item.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  >
                    YouTube
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
