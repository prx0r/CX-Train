'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';

interface TaxonomyItem {
  id: string;
  source_id: number | null;
  board_name: string;
  type: string;
  sub_type: string;
  item: string;
  definition_scope: string;
  playbook: string;
  keywords: string;
  helpdesk_tier: string;
  escalation_guidance: string;
  created_at: string;
  updated_at: string;
}

export default function TaxonomyPage() {
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TaxonomyItem | null>(null);
  const [byType, setByType] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mvp/taxonomy');
      const data = await res.json();
      setItems(data.results || []);
      setByType(data.byType || {});
    } catch (e) {
      console.error('Failed to load taxonomy', e);
    }
    setLoading(false);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/mvp/taxonomy/search?q=${encodeURIComponent(q)}&limit=200`);
      const data = await res.json();
      setItems(data.results || []);
    } catch (e) {
      console.error('Search failed', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function handleSearch(val: string) {
    setSearch(val);
    if (val.trim().length < 2) {
      loadAll();
    } else {
      doSearch(val);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadStatus(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (replaceAll) formData.append('action', 'replace');

      const res = await fetch('/api/mvp/taxonomy', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.ok) {
        setUploadStatus({ ok: true, message: `Uploaded ${data.total} rows. ${data.inserted} new, ${data.skipped} duplicates skipped.` });
        loadAll();
      } else {
        setUploadStatus({ ok: false, message: data.error || 'Upload failed' });
      }
    } catch (e) {
      setUploadStatus({ ok: false, message: 'Network error during upload' });
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const displayed = items;

  return (
    <ManagerShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Taxonomy Ground Truth</h1>
          <span className="text-sm text-gray-400">{items.length} items</span>
        </div>

        {/* Upload Section */}
        <div style={{ background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 8 }}>Upload Taxonomy XLSX</div>
          <div style={{ fontSize: 11, color: '#525252', marginBottom: 10 }}>
            Upload a Master Triage Classification XLSX file. Expected columns: ID, Board_Name, Type, SubType, Item, definition scope, Playbook, keywords, Helpdesk Tier, Escalation Guidance. Duplicate rows (same ID+Type+SubType+Item) are skipped.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#111', cursor: 'pointer' }}>
              <input type="checkbox" checked={replaceAll} onChange={e => setReplaceAll(e.target.checked)} />
              Replace all existing items before import
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              style={{ fontSize: 12, color: '#111' }}
            />
            {uploading && <span style={{ fontSize: 12, color: '#525252' }}>Uploading...</span>}
          </div>
          {uploadStatus && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 3, fontSize: 12, fontWeight: 600,
              background: uploadStatus.ok ? '#e8f3ec' : '#fff4f2',
              color: uploadStatus.ok ? '#0f5132' : '#842029',
              border: `1px solid ${uploadStatus.ok ? '#8db99b' : '#d99a91'}`,
            }}>
              {uploadStatus.message}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(byType).sort().map(([type, count]) => (
            <button
              key={type}
              onClick={() => handleSearch(type)}
              className="px-3 py-1 bg-gray-800 rounded-full text-xs hover:bg-gray-700"
            >
              {type} ({count})
            </button>
          ))}
        </div>

        <div>
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search taxonomy by type, item, keyword, or description..."
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500"
          />
        </div>

        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-2 max-h-[70vh] overflow-y-auto pr-2">
              {displayed.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected?.id === item.id
                      ? 'border-blue-500 bg-gray-800'
                      : 'border-gray-700 bg-gray-900 hover:bg-gray-800'
                  }`}
                >
                  <div className="text-sm font-medium">{item.item}</div>
                  <div className="text-xs text-gray-400">{item.type} &middot; {item.sub_type}</div>
                </button>
              ))}
            </div>

            <div className="lg:col-span-2">
              {selected ? (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs font-medium">{selected.type}</span>
                    <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-xs">{selected.sub_type}</span>
                    <span className="text-xs text-gray-500">ID: {selected.source_id || selected.id}</span>
                  </div>

                  <h2 className="text-xl font-bold">{selected.item}</h2>

                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Definition / Scope</h3>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{selected.definition_scope}</p>
                  </div>

                  {selected.playbook && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-1">Playbook</h3>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{selected.playbook}</p>
                    </div>
                  )}

                  {selected.keywords && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-1">Keywords</h3>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{selected.keywords}</p>
                    </div>
                  )}

                  {selected.escalation_guidance && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-1">Escalation Guidance</h3>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{selected.escalation_guidance}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center text-gray-500">
                  Select a taxonomy item to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ManagerShell>
  );
}
