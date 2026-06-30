'use client';

import { useEffect, useState } from 'react';

interface TaxItem {
  id: string; category: string; type: string; subType: string; item: string;
  definition_scope: string; playbook_steps: string; keywords: string[];
  helpdesk_tier: string; escalation_guidance: string;
}

export default function MSPTaxonomy() {
  const [items, setItems] = useState<TaxItem[]>([]);
  const [filtered, setFiltered] = useState<TaxItem[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TaxItem | null>(null);
  const [role, setRole] = useState('t1');
  const [subTypeFilter, setSubTypeFilter] = useState('');

  useEffect(() => {
    fetch('/api/msp/me')
      .then(r => r.json())
      .then(d => { setRole(d.msp?.role || 't1'); });
    fetch('/api/taxonomy/all')
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setFiltered(d.items || []); });
  }, []);

  useEffect(() => {
    let f = items;
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(i => [i.id, i.item, i.subType, i.type, ...(i.keywords||[])].join(' ').toLowerCase().includes(q));
    }
    if (subTypeFilter) f = f.filter(i => i.subType === subTypeFilter);
    setFiltered(f);
  }, [search, subTypeFilter, items]);

  const subTypes = [...new Set(items.map(i => i.subType))].sort();
  /* T1 sees all; T2+ sees all; manager sees all currently */

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Taxonomy Copilot</h1>
      <p style={{ color: '#64748b', marginBottom: 16 }}>Search the Connexion taxonomy. Answers from source of truth only — no invented categories or playbook steps.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '6px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13 }} />
        <select value={subTypeFilter} onChange={e => setSubTypeFilter(e.target.value)}
          style={{ padding: '6px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13 }}>
          <option value="">All sub-types</option>
          {subTypes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{filtered.length} items</div>
          {filtered.slice(0, 50).map(item => (
            <div key={item.id} onClick={() => setSelected(item)}
              style={{ padding: '6px 10px', background: selected?.id === item.id ? '#1e293b' : 'transparent', borderRadius: 4, cursor: 'pointer', borderBottom: '1px solid #1e293b' }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{item.subType} → {item.item}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{item.type} · {item.helpdesk_tier || '?'}</div>
            </div>
          ))}
        </div>

        <div>
          {selected ? (
            <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Classification</div>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>{selected.category} / {selected.type} / {selected.subType} / {selected.item}</div>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 8 }}>ID: {selected.id} · Tier: {selected.helpdesk_tier || '?'}</div>

              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Definition</div>
              <pre style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap', marginBottom: 8, maxHeight: 120, overflow: 'auto' }}>{(selected.definition_scope || '—').slice(0, 400)}</pre>

              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Playbook</div>
              <pre style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap', marginBottom: 8, maxHeight: 150, overflow: 'auto' }}>{(selected.playbook_steps || '—').slice(0, 500)}</pre>

              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Escalation</div>
              <pre style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{(selected.escalation_guidance || '—').slice(0, 300)}</pre>
            </div>
          ) : (
            <div style={{ color: '#64748b', padding: 16, textAlign: 'center' }}>Select an item</div>
          )}
        </div>
      </div>
    </div>
  );
}
