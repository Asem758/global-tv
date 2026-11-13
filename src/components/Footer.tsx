import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="mt-20 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#050811]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-4">
            <Link
              to="/"
              aria-label="Global TV Hub — Home"
              className="inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <img
                src="/brand-logo.png"
                alt="Global TV Hub"
                width={2172}
                height={717}
                className="h-12 sm:h-14 w-auto object-contain select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.22)] dark:drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
              />
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              An international television discovery directory and live streaming platform dedicated exclusively to legally accessible, official, and authorized public broadcasts worldwide.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Explore
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><Link to="/live" className="hover:text-rose-600 dark:hover:text-white transition-colors">Live TV Directory</Link></li>
              <li><Link to="/countries" className="hover:text-rose-600 dark:hover:text-white transition-colors">Browse by Country</Link></li>
              <li><Link to="/sports" className="hover:text-rose-600 dark:hover:text-white transition-colors">Sports Center</Link></li>
              <li><Link to="/guide" className="hover:text-rose-600 dark:hover:text-white transition-colors">TV Guide (EPG)</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Platform &amp; Policy
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li><Link to="/about" className="hover:text-rose-600 dark:hover:text-white transition-colors">About &amp; Rights Policy</Link></li>
              <li><Link to="/favorites" className="hover:text-rose-600 dark:hover:text-white transition-colors">Saved Favorites</Link></li>
              <li><Link to="/auth" className="hover:text-rose-600 dark:hover:text-white transition-colors">Viewer Account</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p className="tabular-nums">&copy; {new Date().getFullYear()} Global TV Hub. All broadcaster trademarks remain the property of their respective owners.</p>
          <p>Authorized &amp; public-access streams only. No DRM circumvention or unauthorized feeds.</p>
        </div>
      </div>
    </footer>
  );
}
