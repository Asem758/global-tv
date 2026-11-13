import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Heart, History, Trash2, Tv } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { apiFetch } from '../lib/supabase.ts';
import type { Channel } from '../types/tv.ts';
import { ChannelCard } from '../components/ChannelCard.tsx';

export function FavoritesPage() {
  const { user, favorites } = useAuth();
  const queryClient = useQueryClient();

  const { data: historyData } = useQuery({
    queryKey: ['watch-history', user?.id],
    queryFn: () =>
      apiFetch<{ history: Array<{ watched_at: string; channel: Channel }> }>('/api/user/history'),
    enabled: Boolean(user),
  });

  const handleClearHistory = async () => {
    await apiFetch('/api/user/history', { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: ['watch-history'] });
  };

  const historyItems = historyData?.history || [];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-8 space-y-12">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          <Heart className="w-4 h-4" />
          <span>Personal Library</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
          Saved Favorites &amp; Watch History
        </h1>
        {!user && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your favorites are saved in this browser.{' '}
            <Link to="/auth" className="text-rose-600 dark:text-rose-400 font-semibold hover:underline">
              Sign in or create an account
            </Link>{' '}
            to sync favorites and watch history across devices.
          </p>
        )}
      </div>

      {/* Saved Favorites */}
      <section className="space-y-5">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Favorite Channels ({favorites.length})
        </h2>

        {favorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {favorites.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
            <Tv className="w-9 h-9 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              You haven&apos;t saved any favorite channels yet.
            </p>
            <Link
              to="/live"
              className="inline-block px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
            >
              Browse Channels
            </Link>
          </div>
        )}
      </section>

      {/* Recently Watched */}
      {user && (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              Recently Watched
            </h2>
            {historyItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear History
              </button>
            )}
          </div>

          {historyItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {historyItems.map((entry) => (
                <ChannelCard key={`${entry.channel.id}-${entry.watched_at}`} channel={entry.channel} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Channels you watch while signed in will appear here.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
