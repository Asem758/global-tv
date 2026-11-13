import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { apiFetch } from '../lib/supabase.ts';
import type { Channel } from '../types/tv.ts';

const ISSUE_TYPES = [
  'Stream offline / unavailable',
  'Playback error / buffering',
  'Embed blocked by provider',
  'Geo-restricted in my region',
  'Incorrect channel metadata',
  'Other',
] as const;

export function ReportModal({
  channel,
  onClose,
}: {
  channel: Channel;
  onClose: () => void;
}) {
  const [issueType, setIssueType] = useState<string>(ISSUE_TYPES[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (description.trim().length < 4) {
      setError('Please provide at least a brief description of the issue.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: channel.id,
          issue_type: issueType,
          description: description.trim(),
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed submitting report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2
            id="report-modal-title"
            className="font-display text-lg font-semibold text-slate-900 dark:text-white"
          >
            Report Stream Issue
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Channel: <span className="font-medium text-slate-800 dark:text-slate-200">{channel.name}</span>
        </p>

        {submitted ? (
          <div className="mt-6 text-center py-4 space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Report submitted to administrators
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Our channel team will run a stream verification check and update this listing.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Issue Type
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Details (or official broadcaster stream URL suggestion)
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened during playback..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#070B14] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
