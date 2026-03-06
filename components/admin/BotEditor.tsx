'use client';

import { useState } from 'react';
import { PersonalityCard } from './PersonalityCard';
import { PathwayEditor } from './PathwayEditor';

interface BotEditorProps {
  bot: {
    id: string;
    name: string;
    system_prompt: string | null;
    prompt_version_history?: unknown[];
  };
  personalities: {
    id: string;
    name: string;
    archetype: string;
    intensity: number;
    description: string | null;
    avatar_emoji: string;
    stats: { total_calls: number; avg_score: number; critical_fail_rate: number };
    active: boolean;
  }[];
  pathways: {
    id: string;
    stage: number;
    name: string;
    description: string | null;
    difficulty: string | null;
    priority_override: string | null;
    pass_threshold: number;
    is_boss_battle: boolean;
    requires_ticket_screenshot: boolean;
  }[];
}

type Tab = 'prompt' | 'personalities' | 'pathways';

export function BotEditor({ bot, personalities, pathways }: BotEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('prompt');
  const [systemPrompt, setSystemPrompt] = useState(bot.system_prompt || '');
  const [saving, setSaving] = useState(false);

  const savePrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: systemPrompt }),
      });
      if (res.ok) {
        setSystemPrompt((await res.json()).system_prompt);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex gap-4 border-b border-slate-700 mb-6">
        {(['prompt', 'personalities', 'pathways'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-2 font-medium capitalize ${
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'prompt' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-200">
            Saving here updates the database. The Custom GPT fetches the latest prompt via the
            getPrompt action when it runs—no manual paste needed.
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 font-mono text-sm resize-none"
            placeholder="System prompt..."
          />
          <button
            onClick={savePrompt}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {activeTab === 'personalities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personalities.map((p) => (
            <PersonalityCard key={p.id} personality={p} botId={bot.id} />
          ))}
          <div className="p-4 border border-dashed border-slate-600 rounded-xl text-slate-500 text-center">
            Add personality (coming soon)
          </div>
        </div>
      )}

      {activeTab === 'pathways' && (
        <PathwayEditor pathways={pathways} botId={bot.id} />
      )}
    </div>
  );
}
