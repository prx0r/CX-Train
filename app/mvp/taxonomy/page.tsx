'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const displayed = items;

  return (
    <ManagerShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Taxonomy Ground Truth</h1>
          <span className="text-sm text-gray-400">{items.length} items</span>
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
                    <span className="px-2 py-0.5 rounded bg-blue-900 text-blue-200 text-xs font-medium">{selected.type}</span>
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
