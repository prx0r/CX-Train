'use client';

import { useState, useEffect } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';
import ItsmStatsCards from '@/components/mvp/itsm/ItsmStatsCards';
import ItsmTicketTable from '@/components/mvp/itsm/ItsmTicketTable';

interface Assessment {
  id: string;
  title: string;
  candidate_name: string;
  status: string;
  created_at: string;
  overall_score?: number;
  assessment_mode?: string;
}

const PACKS = [
  { id: 'pack-outlook-sim-v2', title: 'Outlook Not Sending — Work Offline v2' },
];

export default function MvpDashboard() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'chat_call' | 'dashboard_sim'>('dashboard_sim');
  const [packId, setPackId] = useState(PACKS[0].id);
  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState('');

  async function loadAssessments() {
    try {
      const res = await fetch('/api/mvp/assessments');
      const data = await res.json();
      setAssessments(data.assessments || []);
    } catch { console.error('Failed to load assessments'); }
  }

  useEffect(() => { loadAssessments(); }, []);

  async function createAssessment() {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    setInviteUrl('');
    try {
      const res = await fetch('/api/mvp/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: name,
          candidate_email: email || null,
          assessment_mode: mode,
          assessment_pack_id: mode === 'dashboard_sim' ? packId : null,
        }),
      });
      const data = await res.json();
      if (data.invite_url) setInviteUrl(data.invite_url);
      else setError(data.error || 'Failed to create');
      await loadAssessments();
    } catch { setError('Failed to create assessment'); }
    setCreating(false);
    setName('');
    setEmail('');
  }

  const statusCounts = {
    total: assessments.length,
    invited: assessments.filter(a => a.status === 'invited').length,
    completed: assessments.filter(a => a.status === 'completed' || a.status === 'analysed').length,
    reviewed: assessments.filter(a => a.status === 'reviewed').length,
  };

  const ticketRows = assessments.map(a => ({
    id: a.id,
    number: `INC${a.id.slice(-6).toUpperCase()}`,
    priority: a.status === 'analysed' ? 'high' : a.status === 'invited' ? 'low' : 'medium',
    status: a.status + (a.assessment_mode === 'dashboard_sim' ? ' 🖥️' : ''),
    category: a.assessment_mode === 'dashboard_sim' ? 'Dashboard Sim' : 'Chat Call',
    description: a.title,
    assigned: a.candidate_name,
    updated: a.created_at?.slice(0, 10) || '',
    score: (a as any).overall_score ?? undefined,
  }));

  return (
    <ManagerShell>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1b2f53', marginBottom: 4 }}>Service Desk Dashboard</div>
        <div style={{ fontSize: 13, color: '#666' }}>Welcome back, Manager</div>
      </div>

      <ItsmStatsCards cards={[
        { label: 'Total Assessments', value: String(statusCounts.total), color: '#1b2f53', icon: '🎫' },
        { label: 'Pending Review', value: String(statusCounts.invited), color: '#f0ad4e', icon: '⏳' },
        { label: 'Completed', value: String(statusCounts.completed), color: '#27ae60', icon: '✓' },
        { label: 'Reviewed', value: String(statusCounts.reviewed), color: '#3498db', icon: '📋' },
      ]} />

      {/* Create Assessment */}
      <div style={{ background: '#fff', borderRadius: 6, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1b2f53', marginBottom: 12 }}>Create New Assessment</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Candidate name"
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13, flex: 1, minWidth: 200 }}
          />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email (optional)"
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13, flex: 1, minWidth: 200 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as any)}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13, background: '#fff' }}
          >
            <option value="chat_call">Chat Call (text only)</option>
            <option value="dashboard_sim">Dashboard Sim (Win11 + Voice)</option>
          </select>
          {mode === 'dashboard_sim' && (
            <select
              value={packId}
              onChange={e => setPackId(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13, background: '#fff' }}
            >
              {PACKS.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          )}
          <button
            onClick={createAssessment}
            disabled={creating || !name.trim()}
            style={{
              padding: '8px 20px', background: '#82b814', color: '#fff', border: 'none',
              borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: creating || !name.trim() ? 0.6 : 1,
            }}
          >
            {creating ? 'Creating...' : '+ New Assessment'}
          </button>
        </div>
        {inviteUrl && (
          <div style={{ marginTop: 12, padding: 12, background: '#f0f7e8', borderRadius: 4, border: '1px solid #d4edda' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#155724', marginBottom: 4 }}>Invite Link Created:</div>
            <a href={inviteUrl} style={{ fontSize: 13, color: '#0070d2', wordBreak: 'break-all' }}>{inviteUrl}</a>
          </div>
        )}
        {error && <div style={{ marginTop: 8, fontSize: 12, color: '#e74c3c' }}>{error}</div>}
      </div>

      <ItsmTicketTable tickets={ticketRows} title="Assessment Queue" />
    </ManagerShell>
  );
}
