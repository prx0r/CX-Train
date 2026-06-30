'use client';

import { useEffect, useState } from 'react';

interface TaxonomyItem {
  id: string;
  category: string;
  type: string;
  subType: string;
  item: string;
  definition_scope: string;
  playbook_steps: string;
  keywords: string[];
  helpdesk_tier: string;
  escalation_guidance: string;
}

export default function TaxonomyBrowser() {
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [subTypeFilter, setSubTypeFilter] = useState('');
  const [selected, setSelected] = useState<TaxonomyItem | null>(null);

  useEffect(() => {
    fetch('/api/taxonomy/all')
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const types = [...new Set(items.map(i => i.type))].sort();
  const subTypes = [...new Set(items.map(i => i.subType))].sort();

  const filtered = items.filter(i => {
    if (search) {
      const q = search.toLowerCase();
      const hay = [i.id, i.item, i.subType, i.type, i.definition_scope, ...(i.keywords||[])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (typeFilter && i.type !== typeFilter) return false;
    if (subTypeFilter && i.subType !== subTypeFilter) return false;
    return true;
  });

  if (loading) return <div className="p-8 text-gray-400">Loading taxonomy...</div>;

  return (
    <div style={{ padding: 24, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 13 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#f1f5f9' }}>Taxonomy Browser</h1>
      <p style={{ color: '#64748b', marginBottom: 16 }}>{items.length} items · Source of truth</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '6px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13 }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '6px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13 }}>
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={subTypeFilter} onChange={e => setSubTypeFilter(e.target.value)}
          style={{ padding: '6px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13 }}>
          <option value="">All sub-types</option>
          {subTypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>Results ({filtered.length})</div>
          {filtered.map(item => (
            <div key={item.id} onClick={() => setSelected(item)}
              style={{ padding: '8px 12px', background: selected?.id === item.id ? '#1e293b' : 'transparent', borderRadius: 4, cursor: 'pointer', borderBottom: '1px solid #1e293b' }}>
              <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.subType} → {item.item}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{item.type} · {item.helpdesk_tier || 'Tier unset'} · {item.id}</div>
            </div>
          ))}
        </div>

        <div>
          {selected ? (
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Classification</div>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>{selected.category} / {selected.type} / {selected.subType} / {selected.item}</div>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Item ID</div>
              <div style={{ marginBottom: 12, fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{selected.id}</div>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Definition</div>
              <pre style={{ marginBottom: 12, fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{(selected.definition_scope || '—').slice(0, 600)}</pre>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Playbook</div>
              <pre style={{ marginBottom: 12, fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{(selected.playbook_steps || '—').slice(0, 600)}</pre>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Keywords</div>
              <div style={{ marginBottom: 12, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(selected.keywords || []).slice(0, 10).map(k => (
                  <span key={k} style={{ padding: '2px 6px', background: '#0f172a', borderRadius: 3, fontSize: 11, color: '#94a3b8' }}>{k}</span>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Tier</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: selected.helpdesk_tier === 'T1' ? '#22c55e' : '#f59e0b' }}>{selected.helpdesk_tier || 'Unset'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Last Updated</div>
                  <div style={{ fontSize: 13 }}>{selected.last_updated || '—'}</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Escalation</div>
              <pre style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{(selected.escalation_guidance || '—').slice(0, 400)}</pre>
            </div>
          ) : (
            <div style={{ color: '#64748b', padding: 16, textAlign: 'center' }}>Select an item to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
