'use client';

import { useEffect, useState } from 'react';

export default function MSPAdmin() {
  const [msp, setMsp] = useState<any>(null);
  const [techs, setTechs] = useState<any[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteRole, setInviteRole] = useState('t1');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');

  useEffect(() => {
    fetch('/api/msp/me')
      .then(r => r.json())
      .then(d => {
        setMsp(d.msp);
        if (d.msp) {
          setOrgName(d.msp.name);
          setOrgSlug(d.msp.slug || '');
          loadTechs(d.msp.msp_id);
          loadStandards(d.msp.msp_id);
        }
      });
  }, []);

  async function loadTechs(id: string) {
    const res = await fetch(`/api/msp/technicians?msp_id=${id}`);
    const d = await res.json();
    setTechs(d.technicians || []);
  }

  async function createInvite() {
    const res = await fetch('/api/msp/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msp_id: msp.msp_id, role: inviteRole, max_uses: 10 }),
    });
    const d = await res.json();
    setInviteUrl(d.invite_url);
  }

  async function createOrg() {
    const res = await fetch('/api/msp/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName, slug: orgSlug }),
    });
    const d = await res.json();
    setMsp(d.org);
    setInviteUrl(d.invite_url);
  }

  const [standards, setStandards] = useState<any>(null);
  const [slaOverrides, setSlaOverrides] = useState('');

  async function loadStandards(id: string) {
    const res = await fetch(`/api/msp/standards?msp_id=${id}`);
    const d = await res.json();
    setStandards(d.standards);
    if (d.standards?.sla_overrides_json) setSlaOverrides(JSON.stringify(JSON.parse(d.standards.sla_overrides_json), null, 2));
  }

  async function saveStandards() {
    await fetch('/api/msp/standards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msp_id: msp.msp_id,
        sla_overrides_json: slaOverrides || null,
      }),
    });
  }

  if (!msp) {
    return (
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Create Your MSP</h1>
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, maxWidth: 400 }}>
          <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Organisation name"
            style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13, marginBottom: 8 }} />
          <input value={orgSlug} onChange={e => setOrgSlug(e.target.value)} placeholder="slug (e.g. connexion)"
            style={{ width: '100%', padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13, marginBottom: 8 }} />
          <button onClick={createOrg} style={{ padding: '6px 12px', background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Create</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Admin — {msp.name}</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>Manage technicians, invites, standards, and taxonomy access.</p>

      {/* Invites */}
      <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Invite Technicians</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
            style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13 }}>
            <option value="t1">T1</option>
            <option value="t2">T2</option>
            <option value="manager">Manager</option>
          </select>
          <button onClick={createInvite} style={{ padding: '6px 12px', background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Generate Link</button>
        </div>
        {inviteUrl && (
          <div style={{ background: '#0f172a', padding: 8, borderRadius: 4, fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' }}>
            {inviteUrl}
          </div>
        )}
      </div>

      {/* Technicians */}
      <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Technicians ({techs.length})</h2>
        {techs.map(t => (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #0f172a' }}>
            <span>{t.display_name} ({t.user_email})</span>
            <span style={{ color: t.role === 't1' ? '#22c55e' : t.role === 't2' ? '#f59e0b' : '#3b82f6', fontWeight: 600 }}>{t.role.toUpperCase()}</span>
          </div>
        ))}
      </div>

      {/* Standards */}
      <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>SLA Overrides</h2>
        <textarea value={slaOverrides} onChange={e => setSlaOverrides(e.target.value)}
          placeholder='{"overrides": {}}'
          style={{ width: '100%', minHeight: 100, padding: 8, background: '#0f172a', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace', marginBottom: 8 }} />
        <button onClick={saveStandards} style={{ padding: '6px 12px', background: '#22c55e', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>Save</button>
      </div>
    </div>
  );
}
