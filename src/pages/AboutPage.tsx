import { Link } from 'react-router-dom';
import { Globe2, Radio, ShieldCheck, Tv } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">
          About Global TV Hub
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white text-balance">
          A transparent, rights-respecting international live TV directory.
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          Global TV Hub is designed to help viewers discover legally accessible public television broadcasts from Bangladesh, India, South Asia, and worldwide—without relying on pirated restreams, stolen credentials, or misleading availability claims.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800/80 p-6 space-y-2.5">
          <ShieldCheck className="w-6 h-6 text-rose-500" />
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Verified Streams Only
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Channels never display a LIVE indicator unless an official HLS stream or embeddable YouTube Live ID has been configured and verified. Unconfigured channels are clearly marked as Broadcaster Discovery Entries with links to their official websites.
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800/80 p-6 space-y-2.5">
          <Radio className="w-6 h-6 text-rose-500" />
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Open Standards &amp; Broadcaster Attribution
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Our playback engine supports adaptive bitrate HLS (`.m3u8`), official YouTube Data API v3 embeds, XMLTV Electronic Program Guides (EPG), and moderated IPTV-org M3U playlist imports with source attribution preserved.
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800/80 p-6 space-y-2.5">
          <Globe2 className="w-6 h-6 text-rose-500" />
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Regional Focus &amp; Global Reach
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Built with dedicated broadcaster catalogs for Bangladesh, India, Pakistan, Sri Lanka, Nepal, UAE, Saudi Arabia, UK, US, Canada, and Australia.
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800/80 p-6 space-y-2.5">
          <Tv className="w-6 h-6 text-rose-500" />
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Broadcaster Submissions &amp; Takedowns
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Broadcasters or rights holders can report broken feeds or request stream updates using the Report Issue workflow on any channel page.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Link
          to="/live"
          className="px-5 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-500"
        >
          Browse Channel Directory
        </Link>
        <Link
          to="/guide"
          className="px-5 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          View TV Guide
        </Link>
      </div>
    </div>
  );
}
