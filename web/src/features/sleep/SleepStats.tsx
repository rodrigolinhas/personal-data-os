import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useSleepStatsQuery, SleepStatsSummary } from '../../api/sleep';
import { formatAverageDuration, formatAverageQuality, formatRecordCount } from './formatDuration';

// ---------------------------------------------------------------------------
// Card presentation
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
      className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm"
    >
      <div>
        <h4 className="text-sm font-semibold text-slate-200">{title}</h4>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <span className="block text-xs font-medium text-slate-400">Average duration</span>
            <span
              className={`mt-1.5 inline-block rounded-md px-2.5 py-1 font-mono text-sm font-medium ${
                isEmpty ? 'text-slate-500' : 'bg-indigo-500/10 text-indigo-300'
              }`}
            >
              {formatAverageDuration(summary.average_duration_minutes)}
            </span>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-400">Average quality</span>
            <span
              className={`mt-1.5 inline-block rounded-md px-2.5 py-1 font-mono text-sm font-medium ${
                isEmpty ? 'text-slate-500' : 'bg-sky-500/10 text-sky-300'
              }`}
            >
              {formatAverageQuality(summary.average_quality)}
            </span>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-400">Records</span>
            <span className="mt-1.5 inline-block rounded-md bg-slate-800 px-2.5 py-1 font-mono text-sm font-medium text-slate-300">
              {formatRecordCount(summary.record_count)}
            </span>
          </div>
        </div>
      </div>

      {isEmpty && (
        <div className="mt-4 border-t border-slate-800/80 pt-3">
          <p className="text-xs text-slate-500">No sleep data in this period.</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SleepStats: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useSleepStatsQuery();

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <section aria-labelledby="sleep-stats-heading" className="mb-8">
        <h3 id="sleep-stats-heading" className="mb-4 text-sm font-semibold text-slate-200">
          Sleep Statistics
        </h3>
        <div
          aria-label="Loading sleep statistics"
          aria-busy="true"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-slate-400 shadow-xl backdrop-blur-sm"
        >
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" aria-hidden="true" />
          <span className="text-sm">Loading sleep statistics…</span>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  if (isError) {
    const message = error instanceof Error ? error.message : 'Failed to load sleep statistics.';

    return (
      <section aria-labelledby="sleep-stats-heading" className="mb-8">
        <h3 id="sleep-stats-heading" className="mb-4 text-sm font-semibold text-slate-200">
          Sleep Statistics
        </h3>
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-300 shadow-xl backdrop-blur-sm"
        >
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">Could not load sleep statistics</span>
          </div>
          <p className="mb-3 font-mono text-xs text-rose-400/80">{message}</p>
          <button
            id="sleep-stats-retry"
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-400/50 hover:text-rose-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Success state with data
  // -------------------------------------------------------------------------
  if (!data) {
    return null;
  }

  return (
    <section aria-labelledby="sleep-stats-heading" className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 id="sleep-stats-heading" className="text-sm font-semibold text-slate-200">
          Sleep Statistics
        </h3>
        {isFetching && !isLoading && (
          <div
            aria-label="Refreshing sleep statistics"
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs text-slate-500"
          >
            <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
            Refreshing…
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <StatCard title="Last 7 days" summary={data.last_7_days} />
        <StatCard title="Last 30 days" summary={data.last_30_days} />
      </div>
    </section>
  );
};

export default SleepStats;
