import React from 'react';
import { useHealthQuery } from '../api/health';
import { Activity, Database, Server, Layers, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const { data: health, isLoading, isError, error, refetch, isFetching } = useHealthQuery();

  const isOnline = health?.status === 'ok';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      <main className="w-full max-w-xl space-y-6">
        {/* Header Branding */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Personal Data OS</h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                  v0.1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Engineering Foundation</p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh status"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* System Health Status Card */}
        <section className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
              System Telemetry
            </span>
            <span className="text-xs font-mono text-slate-500">GET /health</span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-3">
              {isLoading ? (
                <div className="w-3.5 h-3.5 rounded-full bg-amber-400 animate-pulse" />
              ) : isOnline ? (
                <div className="relative flex items-center justify-center">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400" />
                  <div className="absolute w-5 h-5 rounded-full bg-emerald-400/30 animate-ping" />
                </div>
              ) : (
                <div className="w-3.5 h-3.5 rounded-full bg-rose-500" />
              )}

              <div>
                <div className="font-semibold text-sm">
                  {isLoading ? (
                    <span className="text-slate-300">Checking API status...</span>
                  ) : isOnline ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      System status: Online <CheckCircle2 className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1.5">
                      System status: Offline <AlertCircle className="w-4 h-4" />
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  {health?.service ? `${health.service} (${health.version})` : 'Awaiting endpoint response'}
                </div>
              </div>
            </div>

            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
              HTTP {isOnline ? '200 OK' : isError ? 'Error' : '...'}
            </span>
          </div>

          {isError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
              {error instanceof Error ? error.message : 'Failed to reach API server at http://localhost:8080'}
            </div>
          )}
        </section>

        {/* Architectural Foundation Overview */}
        <section className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" /> Verified Foundation Stack
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/40 border border-slate-800">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>Go 1.22 + Chi Router</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/40 border border-slate-800">
              <Database className="w-4 h-4 text-sky-400" />
              <span>PostgreSQL + pgxpool</span>
            </div>
          </div>
        </section>

        {/* Roadmap Next Phase */}
        <footer className="text-center text-xs text-slate-500 font-mono pt-2">
          Next Vertical Slice: <span className="text-indigo-400 font-medium">Sleep Tracking Module</span>
        </footer>
      </main>
    </div>
  );
};

export default App;
