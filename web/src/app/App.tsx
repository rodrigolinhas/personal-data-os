import React, { useState } from 'react';
import { useHealthQuery } from '../api/health';
import { Activity, Moon, Plus } from 'lucide-react';
import { SleepForm, SleepFormMode } from '../features/sleep/SleepForm';
import { SleepHistory } from '../features/sleep/SleepHistory';
import { SleepStats } from '../features/sleep/SleepStats';
import { SleepRecord } from '../api/sleep';
import { Dialog } from '../components/Dialog';

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export const App: React.FC = () => {
  const { data: health, isLoading: healthLoading } = useHealthQuery();
  const isOnline = health?.status === 'ok';

  // Dialog state for add/edit sleep record.
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SleepRecord | null>(null);

  const sleepFormMode: SleepFormMode = editingRecord
    ? { type: 'edit', record: editingRecord }
    : { type: 'create' };

  const handleAddClick = () => {
    setEditingRecord(null);
    setFormOpen(true);
  };

  const handleEditClick = (record: SleepRecord) => {
    setEditingRecord(record);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setEditingRecord(null);
    setFormOpen(false);
  };

  const handleFormSuccess = () => {
    setEditingRecord(null);
    setFormOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      <a
        href="#sleep"
        className="sr-only z-[60] rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Skip to content
      </a>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap sm:px-6">
          {/* Branding */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15">
              <Activity className="h-4 w-4 text-indigo-400" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              Personal Data OS
            </span>
          </div>

          {/* Module navigation */}
          <nav
            aria-label="Main navigation"
            className="order-last flex w-full items-center sm:order-none sm:ml-auto sm:w-auto"
          >
            <a
              href="#sleep"
              aria-current="page"
              className="flex items-center gap-1.5 rounded-md bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              Sleep
            </a>
          </nav>

          {/* API health — demoted to subtle indicator */}
          <div
            aria-label={`API status: ${healthLoading ? 'checking' : isOnline ? 'online' : 'offline'}`}
            className="ml-auto flex items-center gap-1.5 sm:ml-0"
          >
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                healthLoading
                  ? 'animate-pulse bg-amber-400 motion-reduce:animate-none'
                  : isOnline
                    ? 'bg-emerald-400'
                    : 'bg-rose-500'
              }`}
            />
            <span className="text-xs text-slate-400">
              {healthLoading ? 'Checking…' : isOnline ? 'API Online' : 'API Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main id="sleep" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-8 sm:px-6">
        {/* Page header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-balance text-2xl font-bold tracking-tight text-white">Sleep</h1>
            <p className="mt-1 text-sm text-slate-400">Track and understand your sleep patterns.</p>
          </div>
          <button
            type="button"
            onClick={handleAddClick}
            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16] sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add sleep
          </button>
        </div>

        {/* Sleep Statistics */}
        <SleepStats />

        {/* Sleep History */}
        <section aria-labelledby="sleep-history-heading">
          <h2 id="sleep-history-heading" className="mb-4 text-sm font-semibold text-slate-400">
            History
          </h2>
          <SleepHistory editingId={editingRecord?.id ?? null} onEdit={handleEditClick} />
        </section>
      </main>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={formOpen}
        onClose={handleFormClose}
        title={editingRecord ? 'Edit Sleep Record' : 'Add Sleep Record'}
      >
        <SleepForm
          mode={sleepFormMode}
          onEditCancel={handleFormClose}
          onEditSuccess={handleFormSuccess}
          onCreateSuccess={handleFormSuccess}
        />
      </Dialog>
    </div>
  );
};

export default App;
