'use client';

import { useState, useEffect } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';
import ItsmStatsCards from '@/components/mvp/itsm/ItsmStatsCards';
import ItsmTicketTable from '@/components/mvp/itsm/ItsmTicketTable';

type AssignmentType = 'hiring_exam' | 'training_drill' | 'training_shift';

interface AssignmentCard {
  type: AssignmentType;
  label: string;
  description: string;
  enabled: boolean;
  comingSoon?: boolean;
}

const ASSIGNMENT_CARDS: AssignmentCard[] = [
  {
    type: 'hiring_exam',
    label: 'Hiring Exam',
    description: 'Best for candidates or new starters. One controlled call and ticket.',
    enabled: true,
  },
  {
    type: 'training_drill',
    label: 'Training Drill',
    description: 'Best for practising one ticket type. One simulated ticket/call with optional remote tools.',
    enabled: true,
  },
  {
    type: 'training_shift',
    label: 'Training Shift',
    description: 'Coming soon. Simulated queue across a time block.',
    enabled: false,
    comingSoon: true,
  },
];

const DRILL_OPTIONS = [
  { id: 'pack-outlook-sim-v2', title: 'Outlook Not Sending — Work Offline' },
];

interface Assessment {
  id: string;
  title: string;
  candidate_name: string;
  status: string;
  created_at: string;
  overall_score?: number;
  assessment_mode?: string;
  assignment_type?: string;
}

export default function MvpDashboard() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedType, setSelectedType] = useState<AssignmentType | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [drillPack, setDrillPack] = useState(DRILL_OPTIONS[0].id);
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

  function handleSelectType(type: AssignmentType) {
    if (!ASSIGNMENT_CARDS.find(c => c.type === type)?.enabled) return;
    setSelectedType(type);
    setInviteUrl('');
    setError('');
  }

  function handleBack() {
    setSelectedType(null);
    setShowCreate(false);
    setInviteUrl('');
    setError('');
  }

  async function createAssessment() {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    setInviteUrl('');
    try {
      const body: Record<string, unknown> = {
        candidate_name: name,
        candidate_email: email || null,
        assignmentType: selectedType,
      };
      if (selectedType === 'training_drill') {
        body.assessmentPackId = drillPack;
      }
      const res = await fetch('/api/mvp/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.invite_url) setInviteUrl(data.invite_url);
      else if (data.error?.code) setError(data.error.code + ': ' + data.error.message);
      else setError(data.error || 'Failed to create');
      await loadAssessments();
    } catch { setError('Failed to create assessment'); }
    setCreating(false);
    setName('');
    setEmail('');
  }

  function getAssignmentLabel(a: Assessment): string {
    const at = a.assignment_type || (a.assessment_mode === 'dashboard_sim' ? 'training_drill' : 'hiring_exam');
    const card = ASSIGNMENT_CARDS.find(c => c.type === at);
    return card?.label || at;
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
    status: a.status,
    category: getAssignmentLabel(a),
    description: `${a.title} [${getAssignmentLabel(a)}]`,
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

      {/* Create Assignment Flow */}
      <div style={{ background: '#fff', borderRadius: 6, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        {!selectedType ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1b2f53', marginBottom: 12 }}>Create Assignment</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {ASSIGNMENT_CARDS.map(card => (
                <button
                  key={card.type}
                  onClick={() => card.enabled && handleSelectType(card.type)}
                  disabled={!card.enabled}
                  style={{
                    padding: 16, borderRadius: 6, border: card.enabled ? '1px solid #ddd' : '1px dashed #ccc',
                    background: card.enabled ? '#f9fafb' : '#f5f5f5', cursor: card.enabled ? 'pointer' : 'not-allowed',
                    textAlign: 'left', opacity: card.enabled ? 1 : 0.6, display: 'flex', flexDirection: 'column',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { if (card.enabled) { e.currentTarget.style.borderColor = '#82b814'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(130,184,20,0.15)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = card.enabled ? '#ddd' : '#ccc'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: card.enabled ? '#1b2f53' : '#999', marginBottom: 6 }}>
                    {card.label}
                    {card.comingSoon && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: '#f0ad4e', fontWeight: 600, background: '#fff8e1', padding: '2px 6px', borderRadius: 3 }}>Coming soon</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>{card.description}</div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button
                onClick={handleBack}
                style={{ background: 'none', border: 'none', color: '#0070d2', cursor: 'pointer', fontSize: 13, padding: 0 }}
              >
                &larr; Back
              </button>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1b2f53' }}>
                Create {ASSIGNMENT_CARDS.find(c => c.type === selectedType)?.label}
              </div>
            </div>
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
            {selectedType === 'training_drill' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Drill type</label>
                <select
                  value={drillPack}
                  onChange={e => setDrillPack(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13, background: '#fff' }}
                >
                  {DRILL_OPTIONS.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
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
              {creating ? 'Creating...' : `Create ${ASSIGNMENT_CARDS.find(c => c.type === selectedType)?.label || 'Assignment'}`}
            </button>
            {inviteUrl && (
              <div style={{ marginTop: 12, padding: 12, background: '#f0f7e8', borderRadius: 4, border: '1px solid #d4edda' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#155724', marginBottom: 4 }}>Invite Link Created:</div>
                <a href={inviteUrl} style={{ fontSize: 13, color: '#0070d2', wordBreak: 'break-all' }}>{inviteUrl}</a>
              </div>
            )}
            {error && <div style={{ marginTop: 8, fontSize: 12, color: '#e74c3c' }}>{error}</div>}
          </>
        )}
      </div>

      <ItsmTicketTable tickets={ticketRows} title="Assessment Queue" />
    </ManagerShell>
  );
}
