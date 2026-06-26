'use client';

import { useState, useEffect } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';

interface Standards {
  id: string;
  required_ticket_fields: string[];
  call_requirements: string;
  escalation_requirements: string;
  tone_preferences: Record<string, boolean>;
  good_ticket_example: string;
  bad_ticket_example: string;
  good_customer_update_example: string;
  good_internal_note_example: string;
  good_escalation_note_example: string;
}

const emptyStandards: Standards = {
  id: '',
  required_ticket_fields: [],
  call_requirements: '',
  escalation_requirements: '',
  tone_preferences: {},
  good_ticket_example: '',
  bad_ticket_example: '',
  good_customer_update_example: '',
  good_internal_note_example: '',
  good_escalation_note_example: '',
};

const ticketFieldOptions = [
  'user', 'company', 'device_or_application', 'issue_summary',
  'impact', 'urgency', 'checks_attempted', 'next_step',
  'error_message', 'recent_changes', 'escalation_reason',
];

const toneOptions = [
  'professional', 'empathetic', 'patient', 'no_blame', 'no_jargon_overload',
];

export default function StandardsPage() {
  const [standards, setStandards] = useState<Standards>(emptyStandards);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/mvp/standards')
      .then(r => r.json())
      .then(data => {
        if (data.standards) {
          setStandards({
            id: data.standards.id,
            required_ticket_fields: JSON.parse(data.standards.required_ticket_fields_json || '[]'),
            call_requirements: data.standards.call_requirements || '',
            escalation_requirements: data.standards.escalation_requirements || '',
            tone_preferences: JSON.parse(data.standards.tone_preferences_json || '{}'),
            good_ticket_example: data.standards.good_ticket_example || '',
            bad_ticket_example: data.standards.bad_ticket_example || '',
            good_customer_update_example: data.standards.good_customer_update_example || '',
            good_internal_note_example: data.standards.good_internal_note_example || '',
            good_escalation_note_example: data.standards.good_escalation_note_example || '',
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function toggleField(field: string) {
    setStandards(prev => ({
      ...prev,
      required_ticket_fields: prev.required_ticket_fields.includes(field)
        ? prev.required_ticket_fields.filter(f => f !== field)
        : [...prev.required_ticket_fields, field],
    }));
  }

  function toggleTone(tone: string) {
    setStandards(prev => ({
      ...prev,
      tone_preferences: { ...prev.tone_preferences, [tone]: !prev.tone_preferences[tone] },
    }));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch('/api/mvp/standards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(standards),
      });
      const data = await res.json();
      if (data.saved) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Failed to save standards');
    }
    setSaving(false);
  }

  if (loading) return <ManagerShell><p className="text-gray-500">Loading...</p></ManagerShell>;

  return (
    <ManagerShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manager Standards</h1>
          <p className="text-sm text-gray-400">Define how your MSP expects service desk work to be handled.</p>
        </div>
        <button
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Standards'}
        </button>
      </div>

      {saved && <div className="bg-green-900/30 border border-green-700 rounded p-3 text-sm text-green-300 mb-4">Standards saved.</div>}
      {error && <div className="bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-300 mb-4">{error}</div>}

      {/* Required ticket fields */}
      <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Required Ticket Fields</h2>
        <p className="text-xs text-gray-500 mb-3">Fields that must be present in every ticket submitted by a technician.</p>
        <div className="flex flex-wrap gap-2">
          {ticketFieldOptions.map(field => (
            <button
              key={field}
              onClick={() => toggleField(field)}
              className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                standards.required_ticket_fields.includes(field)
                  ? 'bg-cyan-600/30 border-cyan-600 text-cyan-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {field.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tone preferences */}
      <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Tone Preferences</h2>
        <p className="text-xs text-gray-500 mb-3">Expected communication standards for customer-facing interactions.</p>
        <div className="flex flex-wrap gap-2">
          {toneOptions.map(tone => (
            <button
              key={tone}
              onClick={() => toggleTone(tone)}
              className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                standards.tone_preferences[tone]
                  ? 'bg-green-600/30 border-green-600 text-green-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {tone.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Call requirements */}
      <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Call Requirements</h2>
        <p className="text-xs text-gray-500 mb-3">Expected call flow and behaviours during a support interaction.</p>
        <textarea
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full min-h-[80px]"
          value={standards.call_requirements}
          onChange={e => setStandards(prev => ({ ...prev, call_requirements: e.target.value }))}
          placeholder="Describe the expected call flow..."
        />
      </div>

      {/* Escalation requirements */}
      <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Escalation Requirements</h2>
        <p className="text-xs text-gray-500 mb-3">When and how a technician should escalate.</p>
        <textarea
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full min-h-[80px]"
          value={standards.escalation_requirements}
          onChange={e => setStandards(prev => ({ ...prev, escalation_requirements: e.target.value }))}
          placeholder="Describe escalation criteria..."
        />
      </div>

      {/* Examples in two-column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded p-4">
          <h2 className="text-sm font-semibold text-green-400 mb-2">Good Ticket Example</h2>
          <textarea
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full min-h-[100px]"
            value={standards.good_ticket_example}
            onChange={e => setStandards(prev => ({ ...prev, good_ticket_example: e.target.value }))}
          />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded p-4">
          <h2 className="text-sm font-semibold text-red-400 mb-2">Bad Ticket Example</h2>
          <textarea
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full min-h-[100px]"
            value={standards.bad_ticket_example}
            onChange={e => setStandards(prev => ({ ...prev, bad_ticket_example: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900 border border-gray-800 rounded p-4">
          <h2 className="text-sm font-semibold text-cyan-400 mb-2">Good Customer Update</h2>
          <textarea
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full min-h-[100px]"
            value={standards.good_customer_update_example}
            onChange={e => setStandards(prev => ({ ...prev, good_customer_update_example: e.target.value }))}
          />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded p-4">
          <h2 className="text-sm font-semibold text-purple-400 mb-2">Good Internal Note</h2>
          <textarea
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full min-h-[100px]"
            value={standards.good_internal_note_example}
            onChange={e => setStandards(prev => ({ ...prev, good_internal_note_example: e.target.value }))}
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded p-4 mb-4">
        <h2 className="text-sm font-semibold text-yellow-400 mb-2">Good Escalation Note</h2>
        <textarea
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-full min-h-[100px]"
          value={standards.good_escalation_note_example}
          onChange={e => setStandards(prev => ({ ...prev, good_escalation_note_example: e.target.value }))}
        />
      </div>
    </ManagerShell>
  );
}
