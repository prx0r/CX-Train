'use client';

import { useState } from 'react';

export function NewAssessmentForm() {
  const [result, setResult] = useState<{ assessment_pack_id: string; invite_url: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true); setError('');
    const response = await fetch('/api/assessments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(formData)) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setError(data.error || 'Unable to create assessment');
    setResult(data);
  }
  if (result) {
    const invite = `${window.location.origin}${result.invite_url}`;
    return <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-6 space-y-4"><h2 className="text-lg font-semibold text-white">Assessment link ready</h2><p className="break-all rounded-lg bg-black/30 p-3 text-sm text-sky-200">{invite}</p><div className="flex gap-3"><button onClick={() => navigator.clipboard.writeText(invite)} className="rounded-lg bg-sky-300 px-4 py-2 text-sm font-semibold text-zinc-950">Copy link</button><a href={`/dashboard/admin/assessments/${result.assessment_pack_id}`} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-white">View assessment</a></div></div>;
  }
  return <form action={submit} className="max-w-2xl space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
    <label className="block text-sm text-zinc-300">Candidate name<input required name="candidate_name" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label>
    <label className="block text-sm text-zinc-300">Candidate email<input type="email" name="candidate_email" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label>
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400"><span className="font-medium text-white">First Calls</span> includes three fixed simulations: password/login, Outlook not sending, and printer not printing.</div>
    {error && <p className="text-sm text-red-300">{error}</p>}
    <button disabled={busy} className="rounded-lg bg-sky-300 px-5 py-2.5 font-semibold text-zinc-950 disabled:opacity-50">{busy ? 'Creating…' : 'Create assessment link'}</button>
  </form>;
}
