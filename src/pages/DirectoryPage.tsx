import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Filter, Search, Tv } from 'lucide-react';
import { apiFetch } from '../lib/supabase.ts';
import type { Category, Country, PaginatedChannelsResponse } from '../types/tv.ts';
import { ChannelCard } from '../components/ChannelCard.tsx';
import worldNewsImg from '../assets/images/world_news_desk_1794510260663.jpg';
import cinemaImg from '../assets/images/cinema_screening_room_1794510260829.jpg';

const LANGUAGES = ['All', 'English', 'Bengali', 'Hindi', 'Urdu', 'Arabic', 'Spanish', 'Sinhala', 'Nepali'];

export function DirectoryPage() {
  const { countryCode, slug } = useParams<{ countryCode?: string; slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [country, setCountry] = useState(countryCode?.toUpperCase() || searchParams.get('country') || '');
  const [category, setCategory] = useState(slug || searchParams.get('category') || '');
  const [language, setLanguage] = useState(searchParams.get('language') || '');
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get('verifiedOnly') === 'true');
  const [sort, setSort] = useState<'recent' | 'alpha' | 'popular'>(
    (searchParams.get('sort') as 'recent' | 'alpha' | 'popular') || 'recent',
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (countryCode) setCountry(countryCode.toUpperCase());
    else if (!searchParams.get('country')) setCountry('');
  }, [countryCode, searchParams]);

  useEffect(() => {
    if (slug) setCategory(slug);
    else if (!searchParams.get('category')) setCategory('');
  }, [slug, searchParams]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    setSearch(q);
    setDebouncedSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: () => apiFetch<{ countries: Country[] }>('/api/countries'),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiFetch<{ categories: Category[] }>('/api/categories'),
  });

  const queryParams = new URLSearchParams();
  if (country) queryParams.set('country', country);
  if (category) queryParams.set('category', category);
  if (language && language !== 'All') queryParams.set('language', language);
  if (debouncedSearch.trim()) queryParams.set('search', debouncedSearch.trim());
  if (verifiedOnly) queryParams.set('verifiedOnly', 'true');
  queryParams.set('sort', sort);
  queryParams.set('page', String(page));
  queryParams.set('limit', '24');

  const { data, isLoading } = useQuery({
    queryKey: ['directory-channels', queryParams.toString()],
    queryFn: () => apiFetch<PaginatedChannelsResponse>(`/api/channels?${queryParams.toString()}`),
  });

  const countries = countriesData?.countries || [];
  const categories = categoriesData?.categories || [];
  const channels = data?.channels || [];

  const matchedCountry = countries.find((c) => c.country_code === country);
  const matchedCategory = categories.find(
    (c) => c.slug.toLowerCase() === category.toLowerCase() || c.name.toLowerCase() === category.toLowerCase(),
  );

  const pageTitle = matchedCountry
    ? `${matchedCountry.flag_emoji} ${matchedCountry.country_name} Channels`
    : matchedCategory
      ? `${matchedCategory.name} Channels`
      : 'Live TV & Broadcast Directory';

  const bannerImg =
    category.toLowerCase() === 'news'
      ? worldNewsImg
      : category.toLowerCase() === 'movies'
        ? cinemaImg
        : null;

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCountry('');
    setCategory('');
    setLanguage('');
    setVerifiedOnly(false);
    setSort('recent');
    setPage(1);
    setSearchParams({});
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {bannerImg ? (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-[#050811] shadow-lg">
          <img
            src={bannerImg}
            alt={pageTitle}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050811] via-[#050811]/85 to-transparent" />
          <div className="relative p-8 sm:p-10">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">{pageTitle}</h1>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl">
              {matchedCategory?.description ||
                'Explore verified live streams and official broadcaster directory entries.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            International Channel Index
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            {pageTitle}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Filter channels by country, category, language, or playable verification status.
          </p>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-xl bg-white/95 dark:bg-[#0C1322]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 p-4 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channel name, country, language..."
              aria-label="Filter channels by keyword"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by country"
            className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">All Countries</option>
            {countries.map((c) => (
              <option key={c.country_code} value={c.country_code}>
                {c.flag_emoji} {c.country_name}
              </option>
            ))}
          </select>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by language"
            className="px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang === 'All' ? '' : lang}>
                {lang === 'All' ? 'All Languages' : lang}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => {
                  setVerifiedOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              Show verified playable streams only
            </label>

            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as 'recent' | 'alpha' | 'popular')}
                aria-label="Sort channels"
                className="bg-transparent text-slate-700 dark:text-slate-300 font-medium focus:outline-none"
              >
                <option value="recent" className="bg-white dark:bg-[#0C1322]">Sort: Verified &amp; Recent</option>
                <option value="alpha" className="bg-white dark:bg-[#0C1322]">Sort: Alphabetical (A–Z)</option>
                <option value="popular" className="bg-white dark:bg-[#0C1322]">Sort: Most Watched</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>{data?.total ?? 0} matching channels</span>
            {(country || category || language || debouncedSearch || verifiedOnly) && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-rose-600 dark:text-rose-400 font-semibold hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-slate-200 dark:bg-slate-800/50 animate-pulse"
            />
          ))}
        </div>
      ) : channels.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {channels.map((ch) => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums px-2">
                Page {page} of {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <Tv className="w-10 h-10 text-slate-400 mx-auto" />
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            No matching channels found
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Try clearing your filters or unchecking &ldquo;verified playable streams only&rdquo; to view broadcaster discovery entries.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
