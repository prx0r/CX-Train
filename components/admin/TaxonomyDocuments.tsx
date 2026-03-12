'use client';

import { useEffect, useState } from 'react';

interface BotDocument {
  id: string;
  filename: string;
  content_type: string;
  created_at: string;
}

interface TaxonomyDocumentsProps {
  botId: string;
}

export function TaxonomyDocuments({ botId }: TaxonomyDocumentsProps) {
  const [documents, setDocuments] = useState<BotDocument[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/bots/${botId}/documents`)
      .then((r) => r.json())
      .then((data) => setDocuments(Array.isArray(data) ? data : []))
      .catch(() => setDocuments([]));
  }, [botId]);

  const uploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const res = await fetch(`/api/admin/bots/${botId}/documents`, {
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
    const res = await fetch(`/api/admin/bots/${botId}/documents?doc_id=${docId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-2">Source docs</h3>
      <p className="text-zinc-500 text-xs mb-3">
        Upload playbooks or escalation docs used by the taxonomy GPT.
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {documents.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/70 border border-zinc-700"
          >
            <span className="text-zinc-300 text-sm">{d.filename}</span>
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
      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm cursor-pointer">
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
  );
}
