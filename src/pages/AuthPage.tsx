import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { apiFetch, isClientSupabaseConfigured } from '../lib/supabase.ts';

const ADMIN_ROLE_SET = new Set(['SUPER_ADMIN', 'ADMIN', 'CHANNEL_MANAGER', 'CONTENT_EDITOR']);

export function AuthPage() {
  const { user, loginWithPassword, registerWithPassword, loginWithGoogle, logout, refreshUser } =
    useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Profile editor state
  const [editName, setEditName] = useState(user?.display_name || '');
  const [editLang, setEditLang] = useState(user?.preferred_language || 'English');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        const loggedUser = await loginWithPassword(email.trim(), password);
        if (ADMIN_ROLE_SET.has(loggedUser.role)) {
          navigate('/admin');
        }
      } else {
        await registerWithPassword(email.trim(), password, displayName.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          display_name: editName.trim() || user?.display_name,
          preferred_language: editLang,
        }),
      });
      await refreshUser();
      setProfileMsg('Profile preferences updated.');
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Failed saving profile.');
    }
  };

  if (user) {
    const isAdmin = ADMIN_ROLE_SET.has(user.role);
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-rose-600/15 text-rose-500 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {user.display_name}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {user.email} · Role: {user.role}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>

          {isAdmin && (
            <div className="rounded-lg bg-rose-600/10 border border-rose-500/30 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm text-rose-600 dark:text-rose-400 font-medium">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <span>Authorized Administrator Access ({user.role})</span>
              </div>
              <Link
                to="/admin"
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
              >
                Open Admin Console
              </Link>
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-4">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Viewer Preferences
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editName || user.display_name}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Preferred Broadcast Language
                </label>
                <select
                  value={editLang}
                  onChange={(e) => setEditLang(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="English">English</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Urdu">Urdu</option>
                  <option value="Arabic">Arabic</option>
                </select>
              </div>
            </div>
            {profileMsg && <p className="text-xs text-emerald-500 font-medium">{profileMsg}</p>}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
            >
              Save Preferences
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        <div className="space-y-3">
          <img
            src="/brand-logo.png"
            alt="Global TV Hub"
            width={2172}
            height={717}
            className="h-12 w-auto object-contain select-none"
          />
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {mode === 'login' ? 'Sign In to Global TV Hub' : 'Create Viewer Account'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Save favorite channels and sync watch history across devices.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 p-1 rounded-lg bg-slate-100 dark:bg-[#070B14]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-white dark:bg-[#0D1322] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === 'register'
                ? 'bg-white dark:bg-[#0D1322] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="viewer@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500 disabled:opacity-60"
          >
            {busy ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {isClientSupabaseConfigured && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => loginWithGoogle().catch((err) => setError(err.message))}
              className="w-full py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Continue with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
