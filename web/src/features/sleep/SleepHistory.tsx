import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Moon, Pencil, Trash2, Loader2 } from 'lucide-react';
import { SleepRecord, useSleepQuery, useDeleteSleepMutation } from '../../api/sleep';
import { ApiError } from '../../api/client';
import { formatDuration } from './formatDuration';
import { formatDisplayDate, formatTimeRange } from './formatDate';
import { SleepPagination } from './SleepPagination';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SleepHistoryProps {
  editingId?: number | null;
  onEdit: (record: SleepRecord) => void;
}

const LIMIT = 20;

// ---------------------------------------------------------------------------
// SleepHistory
// ---------------------------------------------------------------------------

export const SleepHistory: React.FC<SleepHistoryProps> = ({ editingId = null, onEdit }) => {
  const [offset, setOffset] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    data: records,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useSleepQuery({ limit: LIMIT, offset });

  const deleteMutation = useDeleteSleepMutation();

  // ── Pagination handlers ──────────────────────────────────────────────
  const handlePrevious = () => setOffset((prev) => Math.max(0, prev - LIMIT));
  const handleNext = () => setOffset((prev) => prev + LIMIT);

  // ── Delete flow ──────────────────────────────────────────────────────
  const handleDeleteClick = (id: number) => {
    setDeleteError(null);
    setDeletingId(id);
  };

  const handleCancelDelete = () => {
    setDeletingId(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = (record: SleepRecord) => {
    setDeleteError(null);
    deleteMutation.mutate(record.id, {
      onSuccess: () => {
        setDeletingId(null);
        setDeleteError(null);
        if (records && records.length === 1 && offset > 0) {
          setOffset((prev) => Math.max(0, prev - LIMIT));
        }
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 404) {
          setDeleteError('This sleep record no longer exists.');
          setDeletingId(null);
          void refetch();
          return;
        }
        setDeleteError(
          err instanceof Error ? err.message : 'Could not delete record. Please try again.'
        );
      },
    });
  };

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        aria-label="Loading sleep history"
        aria-busy="true"
        className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400"
      >
        <RefreshCw
          className="h-5 w-5 animate-spin text-indigo-400 motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span className="text-sm">Loading sleep history…</span>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
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
        <p className="mb-3 text-xs text-rose-400/80">{message}</p>
        <button
          id="sleep-history-retry"
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:border-rose-400/50 hover:text-rose-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────
  if (!records || records.length === 0) {
    if (offset === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-slate-400">
          <Moon className="h-8 w-8 text-slate-700" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-400">No sleep records yet.</p>
          <p className="text-xs text-slate-400">
            Add your first sleep record using the button above.
          </p>
        </div>
      );
    }
    return (
      <div className="py-6 text-center text-sm text-slate-400">
        <p className="mb-3">No records on this page.</p>
        <button
          type="button"
          onClick={handlePrevious}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
        >
          ← Go back
        </button>
      </div>
    );
  }

  // ── Records table ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {isFetching && !isLoading && (
        <div
          aria-label="Refreshing sleep history"
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

      {deleteError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300"
        >
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{deleteError}</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800/60">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-800/60 text-left">
              <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-400">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-400">
                Sleep
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-400">
                Duration
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-400">
                Quality
              </th>
              <th scope="col" className="px-4 py-3 text-xs font-medium text-slate-400">
                Notes
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => {
              const isBeingEdited = record.id === editingId;
              const isConfirmingDelete = record.id === deletingId;
              const isDeleting = isConfirmingDelete && deleteMutation.isPending;
              const displayDate = formatDisplayDate(record.date);

              return (
                <tr
                  key={record.id}
                  className={`border-b border-slate-800/40 transition-colors ${
                    idx === records.length - 1 ? 'border-b-0' : ''
                  } ${
                    isBeingEdited
                      ? 'bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/20'
                      : 'hover:bg-slate-800/20'
                  }`}
                >
                  {/* Date */}
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-200">
                    {displayDate}
                  </td>

                  {/* Sleep time range */}
                  <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-400">
                    {formatTimeRange(record.bedtime, record.wake_time)}
                  </td>

                  {/* Duration */}
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium tabular-nums text-white">
                    {formatDuration(record.duration_minutes)}
                  </td>

                  {/* Quality */}
                  <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-300">
                    {record.quality} / 10
                  </td>

                  {/* Notes */}
                  <td className="max-w-[200px] px-4 py-3 text-xs text-slate-400">
                    {record.notes ? (
                      <span className="line-clamp-2 break-words">{record.notes}</span>
                    ) : (
                      <span className="text-slate-700" aria-label="No notes">
                        —
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    {isConfirmingDelete ? (
                      <div className="flex min-w-[200px] flex-col gap-2">
                        <p className="text-xs text-slate-300">
                          Delete record for <span className="font-semibold">{displayDate}</span>?
                        </p>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={handleCancelDelete}
                            disabled={isDeleting}
                            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 transition-colors hover:border-slate-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(record)}
                            disabled={isDeleting}
                            aria-label={`Confirm delete sleep record for ${displayDate}`}
                            className="flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-300 transition-colors hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-rose-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <>
                                <Loader2
                                  className="h-3 w-3 animate-spin motion-reduce:animate-none"
                                  aria-hidden="true"
                                />
                                Deleting…
                              </>
                            ) : (
                              'Confirm delete'
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(record)}
                          aria-label={`Edit sleep record for ${displayDate}`}
                          className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(record.id)}
                          aria-label={`Delete sleep record for ${displayDate}`}
                          className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-500/10 hover:text-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
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
