import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useSleepStatsQuery, SleepStatsSummary } from '../../api/sleep';
import { formatAverageDuration, formatAverageQuality, formatRecordCount } from './formatDuration';

// ---------------------------------------------------------------------------
// StatCard — individual stat window (7-day or 30-day)
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  summary: SleepStatsSummary;
}

const StatCard: React.FC<StatCardProps> = ({ title, summary }) => {
  const isEmpty = summary.record_count === 0;

  return (
    <div
      aria-label={`${title} statistics`}
      className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-5"
    >
      <h3 className="text-sm font-medium text-slate-400">{title}</h3>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
        <div>
          <span className="block text-xs text-slate-400">Avg. duration</span>
          <span
            className={`mt-1 block text-lg font-semibold tabular-nums ${
              isEmpty ? 'text-slate-600' : 'text-white'
            }`}
          >
            {formatAverageDuration(summary.average_duration_minutes)}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-400">Avg. quality</span>
          <span
            className={`mt-1 block text-lg font-semibold tabular-nums ${
              isEmpty ? 'text-slate-600' : 'text-white'
            }`}
          >
            {formatAverageQuality(summary.average_quality)}
          </span>
        </div>

        <div>
          <span className="block text-xs text-slate-400">Records</span>
          <span className="mt-1 block text-lg font-semibold tabular-nums text-slate-300">
            {formatRecordCount(summary.record_count)}
          </span>
        </div>
      </div>

      {isEmpty && (
        <p className="mt-4 border-t border-slate-800/60 pt-3 text-xs text-slate-400">
          No sleep data in this period.
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// SleepStats — root component
// ---------------------------------------------------------------------------

export const SleepStats: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useSleepStatsQuery();

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section aria-labelledby="sleep-stats-heading" className="mb-8">
        <h2 id="sleep-stats-heading" className="mb-4 text-sm font-semibold text-slate-400">
          Sleep Statistics
        </h2>
        <div
          aria-label="Loading sleep statistics"
          aria-busy="true"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 py-10 text-slate-400"
        >
          <RefreshCw
            className="h-5 w-5 animate-spin text-indigo-400 motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="text-sm">Loading sleep statistics…</span>
        </div>
      </section>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (isError) {
    const message = error instanceof Error ? error.message : 'Failed to load sleep statistics.';

    return (
      <section aria-labelledby="sleep-stats-heading" className="mb-8">
        <h2 id="sleep-stats-heading" className="mb-4 text-sm font-semibold text-slate-400">
          Sleep Statistics
        </h2>
        <div
          role="alert"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-300"
        >
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">Could not load sleep statistics</span>
          </div>
          <p className="mb-3 text-xs text-rose-400/80">{message}</p>
          <button
            id="sleep-stats-retry"
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-400/50 hover:text-rose-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  // ── Data ─────────────────────────────────────────────────────────────
  return (
    <section aria-labelledby="sleep-stats-heading" className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="sleep-stats-heading" className="text-sm font-semibold text-slate-400">
          Sleep Statistics
        </h2>
        {isFetching && !isLoading && (
          <div
            aria-label="Refreshing sleep statistics"
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs text-slate-400"
          >
            <RefreshCw
              className="h-3 w-3 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Refreshing…
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard title="Last 7 days" summary={data.last_7_days} />
        <StatCard title="Last 30 days" summary={data.last_30_days} />
      </div>
    </section>
  );
};

export default SleepStats;
