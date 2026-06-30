'use client';

import { useEffect, useState } from 'react';

export default function MSPDocs() {
  const [docs, setDocs] = useState<any[]>([]);
  const [mspId, setMspId] = useState('');
  const [role, setRole] = useState('t1');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/msp/me')
      .then(r => r.json())
      .then(d => {
        setMspId(d.msp?.msp_id || '');
        setRole(d.msp?.role || 't1');
        if (d.msp?.msp_id) loadDocs(d.msp.msp_id);
      });
  }, []);

  async function loadDocs(id: string) {
    const res = await fetch(`/api/msp/docs?msp_id=${id}`);
    const d = await res.json();
    setDocs(d.docs || []);
  }

  async function createDoc() {
    if (!title || !content) return;
    await fetch('/api/msp/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msp_id: mspId, title, content }),
    });
    setTitle(''); setContent('');
    loadDocs(mspId);
  }

  async function updateDoc(id: string, newContent: string) {
    await fetch('/api/msp/docs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content: newContent }),
    });
    setEditing(null);
    loadDocs(mspId);
  }

  const canWrite = role === 't2' || role === 'manager';

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Documentation</h1>
      <p style={{ color: '#64748b', marginBottom: 16 }}>Operational notes linked to taxonomy items. {canWrite ? 'T2+ can create and edit.' : 'View only.'}</p>

      {canWrite && (
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>New Document</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
            style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13, marginBottom: 8 }} />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write documentation..."
            style={{ width: '100%', minHeight: 100, padding: 8, background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13, fontFamily: 'monospace', marginBottom: 8 }} />
          <button onClick={createDoc} style={{ padding: '6px 12px', background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Save</button>
        </div>
      )}

      <div>
        {docs.map(doc => (
          <div key={doc.id} style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{doc.title}</div>
            {editing === doc.id ? (
              <div>
                <textarea defaultValue={doc.content}
                  style={{ width: '100%', minHeight: 100, padding: 8, background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace', marginBottom: 8 }}
                  onChange={e => doc.content = e.target.value} />
                <button onClick={() => updateDoc(doc.id, doc.content)} style={{ padding: '4px 8px', background: '#22c55e', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', marginRight: 8 }}>Save</button>
                <button onClick={() => setEditing(null)} style={{ padding: '4px 8px', background: '#64748b', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <div>
                <pre style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'pre-wrap', margin: 0 }}>{doc.content}</pre>
                {canWrite && (
                  <button onClick={() => setEditing(doc.id)} style={{ marginTop: 8, padding: '4px 8px', background: '#334155', border: 'none', borderRadius: 4, color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>Edit</button>
                )}
              </div>
            )}
          </div>
        ))}
        {docs.length === 0 && <div style={{ color: '#64748b' }}>No documentation yet.</div>}
      </div>
    </div>
  );
}
