import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Moon, Pencil, Trash2, Loader2 } from 'lucide-react';
import { SleepRecord, useSleepQuery, useDeleteSleepMutation } from '../../api/sleep';
import { ApiError } from '../../api/client';
import { formatDuration } from './formatDuration';
import { SleepPagination } from './SleepPagination';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SleepHistoryProps {
  editingId?: number | null;
  onEdit: (record: SleepRecord) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LIMIT = 20;

export const SleepHistory: React.FC<SleepHistoryProps> = ({ editingId = null, onEdit }) => {
  const [offset, setOffset] = useState(0);

  // deletingId: which record has the inline confirmation open
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // deleteError: per-delete inline error message
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const deleteMutation = useDeleteSleepMutation();

  const handlePrevious = () => setOffset((prev) => Math.max(0, prev - LIMIT));
  const handleNext = () => setOffset((prev) => prev + LIMIT);

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
        // Pagination edge: if this was the only record on a non-first page, go back.
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

      {/* Per-delete error banner (404 or network) */}
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
              <th
                scope="col"
                className="px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => {
              const isBeingEdited = record.id === editingId;
              const isConfirmingDelete = record.id === deletingId;
              const isDeleting = isConfirmingDelete && deleteMutation.isPending;

              return (
                <tr
                  key={record.id}
                  className={`border-b border-slate-800/60 transition ${
                    idx === records.length - 1 ? 'border-b-0' : ''
                  } ${isBeingEdited ? 'bg-indigo-500/5 ring-1 ring-inset ring-indigo-500/20' : 'hover:bg-slate-800/30'}`}
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
                  <td className="max-w-[160px] px-4 py-3 text-xs text-slate-400">
                    {record.notes ? (
                      <span className="line-clamp-2 break-words">{record.notes}</span>
                    ) : (
                      <span className="text-slate-600" aria-label="No notes">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isConfirmingDelete ? (
                      /* Inline delete confirmation */
                      <div className="flex min-w-[200px] flex-col gap-2">
                        <p className="text-xs text-slate-300">
                          Delete record for{' '}
                          <span className="font-mono font-semibold">{record.date}</span>?
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={handleCancelDelete}
                            disabled={isDeleting}
                            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(record)}
                            disabled={isDeleting}
                            aria-label={`Confirm delete sleep record for ${record.date}`}
                            className="flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-300 transition hover:border-rose-400/60 hover:bg-rose-500/20 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                Deleting…
                              </>
                            ) : (
                              'Delete record'
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Normal action buttons */
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(record)}
                          aria-label={`Edit sleep record for ${record.date}`}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-700/60 hover:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(record.id)}
                          aria-label={`Delete sleep record for ${record.date}`}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                          Delete
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
