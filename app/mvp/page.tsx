'use client';

import { useState, useEffect } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';

type AssignmentType = 'hiring_exam' | 'training_drill';

interface Assessment {
  id: string; title: string; candidate_name: string; status: string;
  created_at: string; assignment_type: string;
}

interface PackOption { id: string; title: string; }

const ASSIGNMENT_TYPES: { type: AssignmentType; label: string; desc: string; icon: string; color: string }[] = [
  { type: 'hiring_exam', label: 'Hiring Call', desc: 'Quick call + support note. Tests core communication.', icon: '🎯', color: '#60a5fa' },
  { type: 'training_drill', label: 'Training Drill', desc: 'Full sim with triage, tools, and scoring.', icon: '🔧', color: '#a78bfa' },
];

export default function DashboardPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillPacks, setDrillPacks] = useState<PackOption[]>([]);

  /* Creation form state */
  const [selectedType, setSelectedType] = useState<AssignmentType | null>(null);
  const [name, setName] = useState('');
  const [drillPack, setDrillPack] = useState('pack-outlook-sim-v2');
  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [createError, setCreateError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetch('/api/mvp/assessments')
      .then(r => r.json())
      .then(d => { setAssessments(d.assessments || []); setLoading(false); })
      .catch(() => setLoading(false));
    fetch('/api/mvp/packs')
      .then(r => r.json())
      .then(d => setDrillPacks(d.packs || []))
      .catch(() => {});
  }, []);

  const statusCounts = {
    total: assessments.length,
    invited: assessments.filter(a => a.status === 'invited').length,
    completed: assessments.filter(a => a.status === 'completed' || a.status === 'analysed').length,
  };
  const typeCounts = {
    hiring: assessments.filter(a => a.assignment_type === 'hiring_exam').length,
    training: assessments.filter(a => a.assignment_type === 'training_drill').length,
  };

  async function createAssessment() {
    if (!name.trim() || !selectedType) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/mvp/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: name.trim(),
          assignment_type: selectedType,
          assessment_pack_id: selectedType === 'training_drill' ? drillPack : null,
        }),
      });
      const data = await res.json();
      if (data.error) { setCreateError(data.error); return; }
      setInviteUrl(data.invite_url);
      /* Refresh list */
      const list = await fetch('/api/mvp/assessments').then(r => r.json());
      setAssessments(list.assessments || []);
    } catch { setCreateError('Failed to create'); }
    finally { setCreating(false); }
  }

  const card: React.CSSProperties = {
    padding: '16px 20px', borderRadius: 10,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  };
  const label: React.CSSProperties = { fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 };
  const value: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: '#e4e4e7' };

  return (
    <ManagerShell>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e4e4e7', marginBottom: 4 }}>Dashboard</div>
          <div style={{ fontSize: 12, color: '#52525b' }}>
            {loading ? 'Loading...' : `${statusCounts.total} total · ${statusCounts.invited} pending`}
          </div>
        </div>
        <button onClick={() => { setShowCreate(true); setSelectedType(null); setInviteUrl(''); }}
          style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: '#004b8d', color: '#fff', fontSize: 13, fontWeight: 600,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#005da6'}
          onMouseLeave={e => e.currentTarget.style.background = '#004b8d'}
        >+ New Assessment</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={card}><div style={label}>Total</div><div style={value}>{statusCounts.total}</div></div>
        <div style={card}><div style={label}>Pending</div><div style={value}>{statusCounts.invited}</div></div>
        <div style={card}><div style={label}>Completed</div><div style={{ ...value, color: '#22c55e' }}>{statusCounts.completed}</div></div>
        <div style={card}><div style={label}>Hiring</div><div style={{ ...value, color: '#60a5fa' }}>{typeCounts.hiring}</div></div>
        <div style={card}><div style={label}>Training</div><div style={{ ...value, color: '#a78bfa' }}>{typeCounts.training}</div></div>
      </div>

      {/* Create Assessment Panel */}
      {showCreate && (
        <div style={{ ...card, marginBottom: 24, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e7' }}>Create Assessment</span>
            <button onClick={() => { setShowCreate(false); setInviteUrl(''); }}
              style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>

          {!selectedType ? (
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {ASSIGNMENT_TYPES.map(t => (
                <button key={t.type} onClick={() => { setSelectedType(t.type); setInviteUrl(''); }}
                  style={{
                    padding: 16, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.15s',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = t.color; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e7', marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.4 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <button onClick={() => { setSelectedType(null); setInviteUrl(''); }}
                  style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13, padding: 0 }}>← Back</button>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e7' }}>Create {ASSIGNMENT_TYPES.find(t => t.type === selectedType)?.label}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#52525b', marginBottom: 4, display: 'block' }}>CANDIDATE NAME</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Thompson"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)', color: '#e4e4e7', fontSize: 13, outline: 'none',
                      boxSizing: 'border-box',
                    }} />
                </div>

                {selectedType === 'training_drill' && (
                  <div>
                    <label style={{ fontSize: 11, color: '#52525b', marginBottom: 4, display: 'block' }}>DRILL TYPE</label>
                    <select value={drillPack} onChange={e => setDrillPack(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)', color: '#e4e4e7', fontSize: 13, outline: 'none',
                      }}>
                      {drillPacks.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                )}

                <button onClick={createAssessment} disabled={creating || !name.trim()}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: creating || !name.trim() ? 'rgba(255,255,255,0.06)' : '#004b8d',
                    color: '#fff', fontSize: 13, fontWeight: 600, marginTop: 4,
                  }}
                >{creating ? 'Creating...' : `Create ${ASSIGNMENT_TYPES.find(t => t.type === selectedType)?.label || 'Assessment'}`}</button>

                {createError && <div style={{ fontSize: 12, color: '#ef4444' }}>{createError}</div>}

                {inviteUrl && (
                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>✓ Invite Link Ready</div>
                    <a href={inviteUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, color: '#60a5fa', wordBreak: 'break-all' }}>{inviteUrl}</a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Recent assessments */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7', marginBottom: 12 }}>Recent Assessments</div>
          {loading ? (
            <div style={{ fontSize: 12, color: '#52525b' }}>Loading...</div>
          ) : assessments.length === 0 ? (
            <div style={{ fontSize: 12, color: '#52525b', lineHeight: 1.6 }}>
              No assessments yet. Click "+ New Assessment" to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {assessments.slice(0, 8).map(a => (
                <a key={a.id} href={`/mvp/assessments/${a.id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', borderRadius: 6, textDecoration: 'none', transition: 'background 0.15s',
                  color: '#e4e4e7', fontSize: 12.5,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      background: a.assignment_type === 'hiring_exam' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)',
                      color: a.assignment_type === 'hiring_exam' ? '#60a5fa' : '#a78bfa',
                    }}>{a.assignment_type === 'hiring_exam' ? 'HIRING' : 'DRILL'}</span>
                    <span>{a.candidate_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                      color: a.status === 'analysed' ? '#22c55e' : a.status === 'invited' ? '#f59e0b' : '#71717a',
                      background: a.status === 'analysed' ? 'rgba(34,197,94,0.1)' : a.status === 'invited' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                    }}>{a.status}</span>
                    <span style={{ color: '#52525b', fontSize: 11 }}>{a.created_at?.slice(0, 10)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7', marginBottom: 12 }}>Activity</div>
          {assessments.length === 0 ? (
            <div style={{ fontSize: 12, color: '#52525b', lineHeight: 1.6 }}>
              No activity yet. Create an assessment to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {assessments.slice(0, 6).map(a => (
                <a key={a.id} href={`/mvp/assessments/${a.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                  padding: '8px 10px', borderRadius: 6, fontSize: 12.5, transition: 'background 0.15s', color: '#a1a1aa',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.status === 'analysed' ? '#22c55e' : '#f59e0b', flexShrink: 0 }} />
                  <span><strong style={{ color: '#e4e4e7' }}>{a.candidate_name}</strong> — {a.status === 'invited' ? 'Invited' : a.status === 'analysed' ? 'Analysed' : a.status}</span>
                  <span style={{ marginLeft: 'auto', color: '#52525b', fontSize: 11 }}>{a.created_at?.slice(0, 10)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </ManagerShell>
  );
}
