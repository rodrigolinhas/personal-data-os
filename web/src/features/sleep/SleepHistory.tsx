import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Moon } from 'lucide-react';
import { useSleepQuery } from '../../api/sleep';
import { formatDuration } from './formatDuration';
import { SleepPagination } from './SleepPagination';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LIMIT = 20;

export const SleepHistory: React.FC = () => {
  const [offset, setOffset] = useState(0);

  const {
    data: records,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useSleepQuery({
    limit: LIMIT,
    offset,
  });

  const handlePrevious = () => setOffset((prev) => Math.max(0, prev - LIMIT));
  const handleNext = () => setOffset((prev) => prev + LIMIT);

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div
        aria-label="Loading sleep history"
        aria-busy="true"
        className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400"
      >
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" aria-hidden="true" />
        <span className="text-sm">Loading sleep history…</span>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  if (isError) {
    const message = error instanceof Error ? error.message : 'Failed to load sleep records.';

    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300"
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">Could not load sleep history</span>
        </div>
        <p className="mb-3 font-mono text-xs text-rose-400/80">{message}</p>
        <button
          id="sleep-history-retry"
          onClick={() => void refetch()}
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-400/50 hover:text-rose-200"
        >
          Retry
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------
  if (!records || records.length === 0) {
    // Only show empty state on the first page to avoid confusion when
    // navigating beyond the last page.
    if (offset === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-slate-400">
          <Moon className="h-8 w-8 text-slate-600" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-300">No sleep records yet.</p>
          <p className="text-xs text-slate-500">Add your first sleep record using the form.</p>
        </div>
      );
    }
    // Navigated past last page — go back automatically.
    return (
      <div className="py-6 text-center text-sm text-slate-400">
        <p className="mb-3">No records on this page.</p>
        <button
          onClick={handlePrevious}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
        >
          ← Go back
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Records table
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {isFetching && !isLoading && (
        <div
          aria-label="Refreshing sleep history"
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-slate-500"
        >
          <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
          Refreshing…
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60 text-left">
              <th
                scope="col"
                className="px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Date
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Bedtime
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Wake
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Duration
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Quality
              </th>
              <th
                scope="col"
                className="px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => (
              <tr
                key={record.id}
                className={`border-b border-slate-800/60 transition hover:bg-slate-800/30 ${
                  idx === records.length - 1 ? 'border-b-0' : ''
                }`}
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{record.date}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{record.bedtime}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{record.wake_time}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 font-mono text-xs font-medium text-indigo-300">
                    {formatDuration(record.duration_minutes)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-sky-500/10 px-2 py-0.5 font-mono text-xs font-medium text-sky-300">
                    {record.quality} / 10
                  </span>
                </td>
                <td className="max-w-[200px] px-4 py-3 text-xs text-slate-400">
                  {record.notes ? (
                    <span className="line-clamp-2 break-words">{record.notes}</span>
                  ) : (
                    <span className="text-slate-600" aria-label="No notes">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SleepPagination
        offset={offset}
        limit={LIMIT}
        returnedCount={records.length}
        onPrevious={handlePrevious}
        onNext={handleNext}
        isLoading={isFetching}
      />
    </div>
  );
};

export default SleepHistory;
