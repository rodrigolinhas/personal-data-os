import React from 'react';
import { useHealthQuery } from '../api/health';
import { Activity, CheckCircle2, AlertCircle, Moon } from 'lucide-react';
import { SleepForm } from '../features/sleep/SleepForm';
import { SleepHistory } from '../features/sleep/SleepHistory';

export const App: React.FC = () => {
  const { data: health, isLoading: healthLoading, isError: healthError } = useHealthQuery();

  const isOnline = health?.status === 'ok';

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-400 shadow-lg shadow-indigo-500/20">
              <Activity className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">Personal Data OS</h1>
              <p className="font-mono text-xs text-slate-500">self-hosted telemetry</p>
            </div>
          </div>

          {/* Compact API health indicator */}
          <div
            aria-label={`API status: ${healthLoading ? 'checking' : isOnline ? 'online' : 'offline'}`}
            className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5"
          >
            {healthLoading ? (
              <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            ) : isOnline ? (
              <div className="relative flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <div className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400/30" />
              </div>
            ) : (
              <div className="h-2 w-2 rounded-full bg-rose-500" />
            )}
            <span className="font-mono text-xs text-slate-400">
              {healthLoading
                ? 'Checking…'
                : isOnline
                  ? 'API Online'
                  : healthError
                    ? 'API Offline'
                    : 'API Offline'}
            </span>
            {isOnline ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-400" aria-hidden="true" />
            ) : (
              !healthLoading && <AlertCircle className="h-3 w-3 text-rose-400" aria-hidden="true" />
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                        */}
      {/* ------------------------------------------------------------------ */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Section heading */}
        <section aria-labelledby="sleep-section-heading" className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20">
              <Moon className="h-5 w-5 text-indigo-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="sleep-section-heading" className="text-xl font-bold text-white">
                Sleep Tracking
              </h2>
              <p className="text-sm text-slate-400">Record and browse your sleep data</p>
            </div>
          </div>
        </section>

        {/* Sleep workspace: form + history */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          {/* Form panel */}
          <aside>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
              <h3 className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-200">
                Add Sleep Record
              </h3>
              <SleepForm />
            </div>
          </aside>

          {/* History panel */}
          <section aria-labelledby="sleep-history-heading">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
              <h3
                id="sleep-history-heading"
                className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-200"
              >
                Sleep History
              </h3>
              <SleepHistory />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;
