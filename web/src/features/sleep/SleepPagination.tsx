import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SleepPaginationProps {
  offset: number;
  limit: number;
  returnedCount: number;
  onPrevious: () => void;
  onNext: () => void;
  isLoading: boolean;
}

export const SleepPagination: React.FC<SleepPaginationProps> = ({
  offset,
  limit,
  returnedCount,
  onPrevious,
  onNext,
  isLoading,
}) => {
  const hasPrevious = offset > 0;
  // Next is enabled when the current page returned a full page of results,
  // meaning there are likely more records. If the next page is empty, the
  // user can always navigate back with Previous.
  const hasNext = returnedCount >= limit;
  const currentPage = Math.floor(offset / limit) + 1;

  if (!hasPrevious && !hasNext) {
    return null;
  }

  return (
    <nav
      aria-label="Sleep history pagination"
      className="flex items-center justify-between border-t border-slate-800 pt-4"
    >
      <span className="font-mono text-xs text-slate-500">
        Page {currentPage} · {returnedCount} record{returnedCount !== 1 ? 's' : ''}
      </span>

      <div className="flex items-center gap-2">
        <button
          id="sleep-pagination-previous"
          onClick={onPrevious}
          disabled={!hasPrevious || isLoading}
          aria-label="Previous page"
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Previous
        </button>

        <button
          id="sleep-pagination-next"
          onClick={onNext}
          disabled={!hasNext || isLoading}
          aria-label="Next page"
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};

export default SleepPagination;
