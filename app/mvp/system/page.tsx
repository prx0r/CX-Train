'use client';

import { useState, useEffect } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-950/30 border-green-800/50',
  partial: 'text-yellow-400 bg-yellow-950/30 border-yellow-800/50',
  planned: 'text-blue-400 bg-blue-950/30 border-blue-800/50',
  not_built: 'text-gray-500 bg-gray-900 border-gray-800',
};

export default function SystemPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/mvp/debug/status')
      .then(r => r.json())
      .then(d => { setStatus(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, []);

  if (loading) return <ManagerShell><div className="text-gray-400 p-8">Loading system status...</div></ManagerShell>;
  if (error) return <ManagerShell><div className="text-red-400 p-8">Error: {error}</div></ManagerShell>;
  if (!status?.ok) return <ManagerShell><div className="text-red-400 p-8">Failed to load system status</div></ManagerShell>;

  const { data } = status;

  return (
    <ManagerShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">System</h1>
        <p className="text-sm text-gray-500">Developer/manager status overview</p>
      </div>

      {/* Module Status */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Module Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {data.modules?.map((m: any) => (
            <div key={m.id} className={`rounded border p-3 ${STATUS_COLORS[m.status] || STATUS_COLORS.not_built}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{m.label}</span>
                <span className="text-xs uppercase tracking-wide">{m.status}</span>
              </div>
              <p className="text-xs mt-1 opacity-80">{m.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Route Inventory */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">API Routes</h2>
        <div className="bg-gray-900 border border-gray-800 rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="text-left p-3">Module</th>
                <th className="text-left p-3">Method</th>
                <th className="text-left p-3">Path</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {data.routes?.map((r: any, i: number) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50">
                  <td className="p-3 text-gray-300">{r.module}</td>
                  <td className="p-3">
                    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${r.method === 'GET' ? 'bg-green-900/50 text-green-300' : 'bg-blue-900/50 text-blue-300'}`}>
                      {r.method}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-300">{r.path}</td>
                  <td className="p-3">
                    <span className={`text-xs ${r.status === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400 text-xs">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Database Status */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Database</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded p-4">
            <p className="text-xs text-gray-500 mb-2">Path: <span className="font-mono text-gray-300">{data.database?.path}</span></p>
            <p className="text-xs text-gray-500 mb-2">Tables: <span className="text-gray-300">{data.database?.tables?.join(', ')}</span></p>
            <div className="mt-3">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Row Counts</h3>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {Object.entries(data.database?.counts || {}).map(([table, count]) => (
                  <div key={table} className="flex justify-between border-b border-gray-800 py-1">
                    <span className="text-gray-500">{table}</span>
                    <span className="text-gray-200 font-mono">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Seed Status</h3>
            {data.seeds && Object.entries(data.seeds).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-xs py-1">
                <span className={`w-2 h-2 rounded-full ${val ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-400">{key}</span>
                <span className="text-gray-500">{val ? 'seeded' : 'missing'}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Environment */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Environment</h2>
        <div className="bg-gray-900 border border-gray-800 rounded p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-gray-500 text-xs">Node Env</span>
              <p className="font-mono text-xs text-gray-300">{data.environment?.nodeEnv}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">OpenRouter Key</span>
              <p className={`font-mono text-xs ${data.environment?.hasOpenRouterKey ? 'text-green-400' : 'text-red-400'}`}>
                {data.environment?.hasOpenRouterKey ? 'Configured' : 'Missing'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">AI Model</span>
              <p className="font-mono text-xs text-gray-300">{data.environment?.openRouterModel}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Default Org</span>
              <p className="font-mono text-xs text-gray-300">{data.environment?.defaultOrgId}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Default Manager</span>
              <p className="font-mono text-xs text-gray-300">{data.environment?.defaultManagerId}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Activity */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Latest Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Assessments</h3>
            {data.latest?.assessments?.length === 0 && <p className="text-xs text-gray-500">None</p>}
            {data.latest?.assessments?.map((a: any) => (
              <div key={a.id} className="text-xs mb-2 border-b border-gray-800 pb-1">
                <a href={`/mvp/assessments/${a.id}`} className="text-blue-400 hover:underline">{a.candidate_name || a.id}</a>
                <span className={`ml-2 ${a.status === 'analysed' ? 'text-green-400' : 'text-yellow-400'}`}>{a.status}</span>
              </div>
            ))}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Analysis Runs</h3>
            {data.latest?.analysisRuns?.length === 0 && <p className="text-xs text-gray-500">None</p>}
            {data.latest?.analysisRuns?.map((r: any) => (
              <div key={r.id} className="text-xs mb-2 border-b border-gray-800 pb-1">
                <span className="text-gray-400">{r.analysis_type}</span>
                <span className={`ml-2 ${r.status === 'complete' ? 'text-green-400' : r.status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`}>{r.status}</span>
                {r.error_code && <span className="ml-1 text-red-400">({r.error_code})</span>}
                <div className="text-gray-600">{r.hash_prefix}…</div>
              </div>
            ))}
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Feedback</h3>
            {data.latest?.feedback?.length === 0 && <p className="text-xs text-gray-500">None</p>}
            {data.latest?.feedback?.map((f: any) => (
              <div key={f.id} className="text-xs mb-2 border-b border-gray-800 pb-1">
                <span className="text-gray-400">{f.manager_label}</span>
                {f.manager_score != null && <span className="ml-1 text-gray-300">({f.manager_score})</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Warnings */}
      {data.warnings?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-orange-400 mb-3">Warnings</h2>
          <div className="bg-orange-950/20 border border-orange-800/40 rounded p-4">
            {data.warnings.map((w: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm mb-1">
                <span className="text-orange-400 mt-0.5">⚠</span>
                <span className="text-orange-300">{w.type}: {w.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </ManagerShell>
  );
}
