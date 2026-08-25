import React from 'react';
import { useHealthQuery } from '../api/health';
import {
  Activity,
  Database,
  Server,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const App: React.FC = () => {
  const { data: health, isLoading, isError, error, refetch, isFetching } = useHealthQuery();

  const isOnline = health?.status === 'ok';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#090d16] p-6 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <main className="w-full max-w-xl space-y-6">
        {/* Header Branding */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-400 shadow-lg shadow-indigo-500/20">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Personal Data OS</h1>
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 font-mono text-xs font-medium text-indigo-400">
                  v0.1.0
                </span>
              </div>
              <p className="font-mono text-xs text-slate-400">Engineering Foundation</p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh status"
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition hover:border-slate-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* System Health Status Card */}
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
              System Telemetry
            </span>
            <span className="font-mono text-xs text-slate-500">GET /health</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="flex items-center gap-3">
              {isLoading ? (
                <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-amber-400" />
              ) : isOnline ? (
                <div className="relative flex items-center justify-center">
                  <div className="h-3.5 w-3.5 rounded-full bg-emerald-400" />
                  <div className="absolute h-5 w-5 animate-ping rounded-full bg-emerald-400/30" />
                </div>
              ) : (
                <div className="h-3.5 w-3.5 rounded-full bg-rose-500" />
              )}

              <div>
                <div className="text-sm font-semibold">
                  {isLoading ? (
                    <span className="text-slate-300">Checking API status...</span>
                  ) : isOnline ? (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      System status: Online <CheckCircle2 className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-400">
                      System status: Offline <AlertCircle className="h-4 w-4" />
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-xs text-slate-400">
                  {health?.service
                    ? `${health.service} (${health.version})`
                    : 'Awaiting endpoint response'}
                </div>
              </div>
            </div>

            <span className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 font-mono text-xs text-slate-300">
              HTTP {isOnline ? '200 OK' : isError ? 'Error' : '...'}
            </span>
          </div>

          {isError && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 font-mono text-xs text-rose-300">
              {error instanceof Error
                ? error.message
                : 'Failed to reach API server at http://localhost:8080'}
            </div>
          )}
        </section>

        {/* Architectural Foundation Overview */}
        <section className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Layers className="h-4 w-4 text-indigo-400" /> Verified Foundation Stack
          </h2>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs text-slate-300">
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <Server className="h-4 w-4 text-indigo-400" />
              <span>Go 1.22 + Chi Router</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
              <Database className="h-4 w-4 text-sky-400" />
              <span>PostgreSQL + pgxpool</span>
            </div>
          </div>
        </section>

        {/* Roadmap Next Phase */}
        <footer className="pt-2 text-center font-mono text-xs text-slate-500">
          Next Vertical Slice:{' '}
          <span className="font-medium text-indigo-400">Sleep Tracking Module</span>
        </footer>
      </main>
    </div>
  );
};

export default App;
