'use client';

import { useState, useEffect } from 'react';
import { PersonalityCard } from './PersonalityCard';
import { PathwayEditor } from './PathwayEditor';

interface PromptVersion {
  prompt: string;
  saved_at: string;
}

interface BotDocument {
  id: string;
  filename: string;
  content_type: string;
  created_at: string;
}

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
  const [promptVersionHistory, setPromptVersionHistory] = useState<PromptVersion[]>(
    (bot.prompt_version_history as PromptVersion[]) ?? []
  );
  const [documents, setDocuments] = useState<BotDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [versionExpanded, setVersionExpanded] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null);

  useEffect(() => {
    if (activeTab === 'prompt') {
      fetch(`/api/admin/bots/${bot.id}/documents`)
        .then((r) => r.json())
        .then((data) => setDocuments(Array.isArray(data) ? data : []))
        .catch(() => setDocuments([]));
    }
  }, [activeTab, bot.id]);

  const savePrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bots/${bot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: systemPrompt }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSystemPrompt(updated.system_prompt);
        setPromptVersionHistory((updated.prompt_version_history as PromptVersion[]) ?? []);
      }
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = (v: PromptVersion) => {
    setSystemPrompt(v.prompt || '');
    setViewingVersion(null);
  };

  const uploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const res = await fetch(`/api/admin/bots/${bot.id}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const doc = await res.json();
        setDocuments((prev) => [doc, ...prev]);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const deleteDocument = async (docId: string) => {
    const res = await fetch(`/api/admin/bots/${bot.id}/documents?doc_id=${docId}`, {
      method: 'DELETE',
    });
    if (res.ok) return setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const versions = promptVersionHistory.slice().reverse();

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
        <div className="space-y-6">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-200">
            Saving here updates the database. The Custom GPT fetches the latest prompt via the
            getPrompt action when it runs—no manual paste needed.
          </div>

          <div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full h-96 p-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 font-mono text-sm resize-none"
              placeholder="System prompt..."
            />
            <div className="flex items-center gap-4 mt-4">
              <button
                onClick={savePrompt}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>

              {versions.length > 0 && (
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => setVersionExpanded(!versionExpanded)}
                    className="text-slate-400 hover:text-slate-200 text-sm"
                  >
                    {versionExpanded ? 'Hide' : 'Show'} previous versions ({versions.length})
                  </button>
                  {versionExpanded && (
                    <div className="mt-2 space-y-2">
                      {versions.map((v, i) => (
                        <div
                          key={v.saved_at}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700"
                        >
                          <span className="text-slate-400 text-sm">
                            {new Date(v.saved_at).toLocaleString()}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setViewingVersion(v)}
                              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => restoreVersion(v)}
                              className="text-xs px-2 py-1 rounded bg-blue-600/50 hover:bg-blue-600 text-blue-200"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Documents</h3>
            <p className="text-slate-500 text-xs mb-3">
              Upload .txt, .md, .csv, or .json files. The GPT will receive them as reference context when it fetches the prompt.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {documents.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600"
                >
                  <span className="text-slate-300 text-sm">{d.filename}</span>
                  <button
                    type="button"
                    onClick={() => deleteDocument(d.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                    aria-label="Delete"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm cursor-pointer">
              <input
                type="file"
                accept=".txt,.md,.csv,.json"
                onChange={uploadDocument}
                disabled={uploading}
                className="sr-only"
              />
              {uploading ? 'Uploading...' : 'Upload document'}
            </label>
          </div>
        </div>
      )}

      {viewingVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setViewingVersion(null)}
        >
          <div
            className="max-w-3xl w-full max-h-[80vh] overflow-auto rounded-xl bg-slate-800 border border-slate-600 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400 text-sm">
                {new Date(viewingVersion.saved_at).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => setViewingVersion(null)}
                className="text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-slate-200 font-mono text-sm">
              {viewingVersion.prompt || '(empty)'}
            </pre>
            <button
              type="button"
              onClick={() => restoreVersion(viewingVersion)}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm"
            >
              Restore this version
            </button>
          </div>
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
