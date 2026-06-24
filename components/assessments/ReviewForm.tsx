'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ReviewForm({ assessmentId, aiScore }: { assessmentId: string; aiScore: number }) {
  const router = useRouter(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true); setError(''); const body = Object.fromEntries(formData); body.agreed_with_ai = body.agreed_with_ai === 'true' ? 'true' : 'false';
    const response = await fetch(`/api/assessments/${assessmentId}/review`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ ...body, agreed_with_ai: body.agreed_with_ai === 'true' }) });
    const data = await response.json(); setBusy(false); if (!response.ok) return setError(data.error || 'Unable to save review'); router.refresh();
  }
  const labels = [['ready_low_risk_calls','Ready'],['ready_with_supervision','Needs supervision'],['not_ready','Not ready']];
  return <form action={submit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-zinc-300">Manager score<input name="manager_score" type="number" min="0" max="100" defaultValue={aiScore} required className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label><label className="text-sm text-zinc-300">Final readiness<select name="final_readiness" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white">{labels.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <label className="block text-sm text-zinc-300">AI assessment<select name="agreed_with_ai" className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"><option value="true">I agree</option><option value="false">I am overriding it</option></select></label>
    <label className="block text-sm text-zinc-300">Override reason<textarea name="override_reason" className="mt-2 min-h-20 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label>
    <label className="block text-sm text-zinc-300">Manager notes<textarea name="manager_notes" className="mt-2 min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" /></label>
    {error && <p className="text-sm text-red-300">{error}</p>}<button disabled={busy} className="rounded-lg bg-sky-300 px-5 py-2.5 font-semibold text-zinc-950 disabled:opacity-50">{busy ? 'Saving…' : 'Save final decision'}</button>
  </form>;
}
