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

  function getScore(a: Assessment): number | undefined {
    return (a as any).overall_score ?? undefined;
  }

  const ticketRows = assessments.map(a => ({
    id: a.id,
    number: `INC${a.id.slice(-6).toUpperCase()}`,
    priority: a.status === 'analysed' ? 'high' : a.status === 'invited' ? 'low' : 'medium',
    status: a.status,
    category: getAssignmentLabel(a),
    description: `${a.title} [${getAssignmentLabel(a)}]`,
    assigned: a.candidate_name,
    updated: a.created_at?.slice(0, 10) || '',
    score: getScore(a),
  }));

  return (
    <ManagerShell>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 2 }}>Service Desk</div>
        <div style={{ fontSize: 12, color: '#525252' }}>Board: Help Desk / New and Active Tickets</div>
      </div>

      <ItsmStatsCards cards={[
        { label: 'Total', value: String(statusCounts.total), color: '#111' },
        { label: 'Pending Review', value: String(statusCounts.invited), color: '#7a4f00' },
        { label: 'Completed', value: String(statusCounts.completed), color: '#0f5132' },
        { label: 'Reviewed', value: String(statusCounts.reviewed), color: '#004b8d' },
      ]} />

      {/* Create Assignment Flow */}
      <div style={{ background: '#fff', border: '1px solid #9f9f9f', borderRadius: 3, marginBottom: 16 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #b8b8b8', background: '#f4f4f4', fontWeight: 700, fontSize: 14, color: '#111' }}>
          Create Assignment
        </div>
        <div style={{ padding: 14 }}>
        {!selectedType ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {ASSIGNMENT_CARDS.map(card => (
                <button
                  key={card.type}
                  onClick={() => card.enabled && handleSelectType(card.type)}
                  disabled={!card.enabled}
                  style={{
                    padding: 14, borderRadius: 3, border: card.enabled ? '1px solid #b8b8b8' : '1px dashed #b8b8b8',
                    background: card.enabled ? '#f4f4f4' : '#efefef', cursor: card.enabled ? 'pointer' : 'not-allowed',
                    textAlign: 'left', opacity: card.enabled ? 1 : 0.5, display: 'flex', flexDirection: 'column',
                  }}
                  onMouseEnter={e => { if (card.enabled) e.currentTarget.style.background = '#fff'; }}
                  onMouseLeave={e => { if (card.enabled) e.currentTarget.style.background = '#f4f4f4'; }}
                >
                  <div style={{ fontWeight: 700, fontSize: 14, color: card.enabled ? '#111' : '#6f6f6f', marginBottom: 6 }}>
                    {card.label}
                    {card.comingSoon && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: '#7a4f00', fontWeight: 600, background: '#f6e8b1', padding: '2px 6px', borderRadius: 2, border: '1px solid #c8b66a' }}>Coming soon</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#525252', lineHeight: 1.4 }}>{card.description}</div>
                </button>
              ))}
            </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button
                onClick={handleBack}
                style={{ background: 'none', border: 'none', color: '#004b8d', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 700 }}
              >
                &larr; Back
              </button>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                Create {ASSIGNMENT_CARDS.find(c => c.type === selectedType)?.label}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Candidate name"
                style={{ padding: '7px 10px', border: '1px solid #b8b8b8', borderRadius: 3, fontSize: 13, flex: 1, minWidth: 200, color: '#111', background: '#fff' }}
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email (optional)"
                style={{ padding: '7px 10px', border: '1px solid #b8b8b8', borderRadius: 3, fontSize: 13, flex: 1, minWidth: 200, color: '#111', background: '#fff' }}
              />
            </div>
            {selectedType === 'training_drill' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#525252', display: 'block', marginBottom: 4, fontWeight: 700 }}>Drill type</label>
                <select
                  value={drillPack}
                  onChange={e => setDrillPack(e.target.value)}
                  style={{ padding: '7px 10px', border: '1px solid #b8b8b8', borderRadius: 3, fontSize: 13, background: '#fff', color: '#111' }}
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
                padding: '8px 20px', background: '#111', color: '#fff', border: '1px solid #111',
                borderRadius: 3, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                opacity: creating || !name.trim() ? 0.45 : 1,
              }}
            >
              {creating ? 'Creating...' : `Create ${ASSIGNMENT_CARDS.find(c => c.type === selectedType)?.label || 'Assignment'}`}
            </button>
            {inviteUrl && (
              <div style={{ marginTop: 12, padding: 10, background: '#e8f3ec', border: '1px solid #8db99b', borderRadius: 3 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f5132', marginBottom: 4 }}>Invite Link Created:</div>
                <a href={inviteUrl} style={{ fontSize: 13, color: '#004b8d', wordBreak: 'break-all' }}>{inviteUrl}</a>
              </div>
            )}
            {error && <div style={{ marginTop: 8, fontSize: 12, color: '#842029' }}>{error}</div>}
          </>
        )}
      </div>
      </div>

      <ItsmTicketTable tickets={ticketRows} title="Assessment Queue" />
    </ManagerShell>
  );
}
