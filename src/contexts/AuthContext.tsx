import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  apiFetch,
  isClientSupabaseConfigured,
  setStoredToken,
  supabase,
} from '../lib/supabase.ts';
import type { Channel, UserProfile } from '../types/tv.ts';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  favorites: Channel[];
  isFavorite: (channelId: string) => boolean;
  toggleFavorite: (channel: Channel) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<UserProfile>;
  registerWithPassword: (email: string, password: string, displayName: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GUEST_FAVS_KEY = 'gtvh_guest_favorites';
const THEME_KEY = 'gtvh_theme';

function loadGuestFavorites(): Channel[] {
  try {
    const raw = localStorage.getItem(GUEST_FAVS_KEY);
    return raw ? (JSON.parse(raw) as Channel[]) : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Channel[]>(loadGuestFavorites);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const loadFavoritesForUser = useCallback(async (authedUser: UserProfile | null) => {
    if (!authedUser) {
      setFavorites(loadGuestFavorites());
      return;
    }
    try {
      const res = await apiFetch<{ channels: Channel[] }>('/api/user/favorites');
      setFavorites(res.channels || []);
    } catch {
      // Keep existing list on transient error
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: UserProfile }>('/api/auth/me');
      setUser(res.user);
      await loadFavoritesForUser(res.user);
    } catch {
      setUser(null);
      await loadFavoritesForUser(null);
    } finally {
      setLoading(false);
    }
  }, [loadFavoritesForUser]);

  useEffect(() => {
    refreshUser();
    if (supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        refreshUser();
      });
      return () => sub.subscription.unsubscribe();
    }
  }, [refreshUser]);

  const loginWithPassword = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      if (isClientSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        const me = await apiFetch<{ user: UserProfile }>('/api/auth/me');
        setUser(me.user);
        await loadFavoritesForUser(me.user);
        return me.user;
      }

      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStoredToken(res.token);
      setUser(res.user);
      await loadFavoritesForUser(res.user);
      return res.user;
    },
    [loadFavoritesForUser],
  );

  const registerWithPassword = useCallback(
    async (email: string, password: string, displayName: string): Promise<UserProfile> => {
      if (isClientSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw new Error(error.message);
        const me = await apiFetch<{ user: UserProfile }>('/api/auth/me');
        setUser(me.user);
        await loadFavoritesForUser(me.user);
        return me.user;
      }

      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      setStoredToken(res.token);
      setUser(res.user);
      await loadFavoritesForUser(res.user);
      return res.user;
    },
    [loadFavoritesForUser],
  );

  const loginWithGoogle = useCallback(async () => {
    if (!isClientSupabaseConfigured || !supabase) {
      throw new Error(
        'Google OAuth requires Supabase Authentication (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY).',
      );
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
  }, []);

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setStoredToken(null);
    setUser(null);
    setFavorites(loadGuestFavorites());
  }, []);

  const isFavorite = useCallback(
    (channelId: string) => favorites.some((c) => c.id === channelId),
    [favorites],
  );

  const toggleFavorite = useCallback(
    async (channel: Channel) => {
      const currentlyFav = favorites.some((c) => c.id === channel.id);
      if (user) {
        if (currentlyFav) {
          setFavorites((prev) => prev.filter((c) => c.id !== channel.id));
          await apiFetch(`/api/user/favorites/${channel.id}`, { method: 'DELETE' });
        } else {
          setFavorites((prev) => [channel, ...prev]);
          await apiFetch('/api/user/favorites', {
            method: 'POST',
            body: JSON.stringify({ channel_id: channel.id }),
          });
        }
        return;
      }

      const next = currentlyFav
        ? favorites.filter((c) => c.id !== channel.id)
        : [channel, ...favorites];
      setFavorites(next);
      try {
        localStorage.setItem(GUEST_FAVS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    },
    [favorites, user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        theme,
        toggleTheme,
        favorites,
        isFavorite,
        toggleFavorite,
        loginWithPassword,
        registerWithPassword,
        loginWithGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
