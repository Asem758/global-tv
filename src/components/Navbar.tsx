import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, Moon, Search, Sun, User, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { apiFetch } from '../lib/supabase.ts';
import type { Channel, PaginatedChannelsResponse } from '../types/tv.ts';
import { ChannelLogo, COUNTRY_FLAGS, isChannelPlayable } from './ChannelCard.tsx';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/live', label: 'Live TV' },
  { to: '/countries', label: 'Countries' },
  { to: '/sports', label: 'Sports' },
  { to: '/category/news', label: 'News' },
  { to: '/category/entertainment', label: 'Entertainment' },
  { to: '/category/movies', label: 'Movies' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/guide', label: 'TV Guide' },
  { to: '/about', label: 'About' },
];

export function Navbar() {
  const { user, theme, toggleTheme } = useAuth();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Channel[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<PaginatedChannelsResponse>(
          `/api/channels?search=${encodeURIComponent(trimmed)}&limit=6`,
        );
        setSuggestions(res.channels || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    setMobileOpen(false);
    navigate(searchTerm.trim() ? `/live?search=${encodeURIComponent(searchTerm.trim())}` : '/live');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#070B14]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 sm:h-[70px] flex items-center justify-between gap-4">
        {/* Zone 1: Brand Logo */}
        <Link
          to="/"
          aria-label="Global TV Hub — Home"
          className="inline-flex items-center shrink-0 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-transform duration-150 hover:scale-[1.02]"
        >
          <img
            src="/brand-logo.png"
            alt="Global TV Hub"
            width={2172}
            height={717}
            className="h-9 sm:h-11 w-auto object-contain select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.28)] dark:drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
          />
        </Link>

        {/* Zone 2: Single-line Public Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden xl:flex items-center gap-4 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          {NAV_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors hover:text-slate-900 dark:hover:text-white ${
                  isActive
                    ? 'text-rose-600 dark:text-rose-400 font-semibold border-rose-600 dark:border-rose-500'
                    : 'border-transparent'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Zone 3: Search, Theme Toggle, Account */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div ref={searchBoxRef} className="relative hidden md:block w-52 lg:w-64">
            <form onSubmit={handleSearchSubmit}>
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search channels..."
                aria-label="Search channels"
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg bg-slate-100/90 dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800 shadow-2xl py-1.5 z-50">
                {suggestions.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setShowSuggestions(false);
                      setSearchTerm('');
                      navigate(`/watch/${ch.slug}`);
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center justify-between gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ChannelLogo channel={ch} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {ch.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {COUNTRY_FLAGS[ch.country_code] || ''} {ch.country_name} · {ch.category}
                        </p>
                      </div>
                    </div>
                    {isChannelPlayable(ch) && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 shrink-0">
                        LIVE
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <User className="w-3.5 h-3.5" />
            <span>{user ? user.display_name.split(' ')[0] : 'Sign In'}</span>
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className="xl:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Navigation Drawer */}
      {mobileOpen && (
        <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070B14] px-4 py-4 space-y-4">
          <form onSubmit={handleSearchSubmit} className="relative md:hidden">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search channels by name, country, category..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-[#0C1322] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
            />
          </form>

          <nav className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {NAV_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                    isActive
                      ? 'bg-rose-600/10 text-rose-600 dark:text-rose-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
