'use client';

import { useState } from 'react';
import { TaxonomyItem } from '@/lib/taxonomy-db';

interface TaxonomyEditorProps {
  item: TaxonomyItem;
}

function listToText(values?: string[]) {
  return (values ?? []).join('\n');
}

function textToList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function TaxonomyEditor({ item }: TaxonomyEditorProps) {
  const [form, setForm] = useState({
    category: item.category,
    subcategory: item.subcategory,
    title: item.title,
    description: item.description,
    triage_questions: listToText(item.triage_questions),
    triage_steps: listToText(item.triage_steps),
    resolution_steps: listToText(item.resolution_steps),
    escalation_policy: item.escalation_policy ?? '',
    severity_guidance: item.severity_guidance ?? '',
    impact_guidance: item.impact_guidance ?? '',
    first_call_resolution: item.first_call_resolution ?? false,
    owner: item.owner ?? '',
    examples: listToText(item.examples),
    last_reviewed: item.last_reviewed ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const update = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    const payload = {
      ...form,
      triage_questions: textToList(form.triage_questions),
      triage_steps: textToList(form.triage_steps),
      resolution_steps: textToList(form.resolution_steps),
      examples: textToList(form.examples),
      last_reviewed: form.last_reviewed || null,
    };

    const res = await fetch(`/api/admin/taxonomy/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setMessage('Saved.');
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || 'Save failed.');
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!confirm('Delete this taxonomy item?')) return;
    const res = await fetch(`/api/admin/taxonomy/${item.id}`, { method: 'DELETE' });
    if (res.ok) {
      window.location.href = '/dashboard/admin/taxonomy';
    } else {
      setMessage('Delete failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-zinc-400">
          Category
          <input
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="text-sm text-zinc-400">
          Subcategory
          <input
            value={form.subcategory}
            onChange={(e) => update('subcategory', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="text-sm text-zinc-400 md:col-span-2">
          Title
          <input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
        </label>
      </div>

      <label className="text-sm text-zinc-400">
        Description
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100 min-h-[120px]"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-zinc-400">
          Triage questions (one per line)
          <textarea
            value={form.triage_questions}
            onChange={(e) => update('triage_questions', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100 min-h-[140px]"
          />
        </label>
        <label className="text-sm text-zinc-400">
          Triage steps (one per line)
          <textarea
            value={form.triage_steps}
            onChange={(e) => update('triage_steps', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100 min-h-[140px]"
          />
        </label>
        <label className="text-sm text-zinc-400">
          Resolution steps (one per line)
          <textarea
            value={form.resolution_steps}
            onChange={(e) => update('resolution_steps', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100 min-h-[140px]"
          />
        </label>
        <label className="text-sm text-zinc-400">
          Examples (one per line)
          <textarea
            value={form.examples}
            onChange={(e) => update('examples', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100 min-h-[140px]"
          />
        </label>
      </div>

      <label className="text-sm text-zinc-400">
        Escalation policy
        <textarea
          value={form.escalation_policy}
          onChange={(e) => update('escalation_policy', e.target.value)}
          className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-zinc-400">
          Severity guidance
          <input
            value={form.severity_guidance}
            onChange={(e) => update('severity_guidance', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="text-sm text-zinc-400">
          Impact guidance
          <input
            value={form.impact_guidance}
            onChange={(e) => update('impact_guidance', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="text-sm text-zinc-400">
          Owner
          <input
            value={form.owner}
            onChange={(e) => update('owner', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="text-sm text-zinc-400">
          Last reviewed (YYYY-MM-DD)
          <input
            value={form.last_reviewed}
            onChange={(e) => update('last_reviewed', e.target.value)}
            className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="text-sm text-zinc-400 flex items-center gap-2 mt-6">
          <input
            type="checkbox"
            checked={form.first_call_resolution}
            onChange={(e) => update('first_call_resolution', e.target.checked)}
            className="h-4 w-4"
          />
          First call resolution
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={remove}
          className="px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-200 text-sm"
        >
          Delete
        </button>
        {message && <span className="text-sm text-zinc-400">{message}</span>}
      </div>
    </div>
  );
}
