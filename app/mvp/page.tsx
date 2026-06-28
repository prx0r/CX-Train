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
    padding: '14px 18px', borderRadius: 6,
    background: '#fff', border: '1px solid #c8c8c8',
  };
  const label: React.CSSProperties = { fontSize: 11, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 };
  const value: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#202124' };

  return (
    <ManagerShell>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#202124', marginBottom: 2 }}>Service Desk</div>
          <div style={{ fontSize: 12, color: '#5f6368' }}>
            {loading ? 'Loading...' : `${statusCounts.total} total · ${statusCounts.invited} pending`}
          </div>
        </div>
        <button onClick={() => { setShowCreate(true); setSelectedType(null); setInviteUrl(''); }}
          style={{
            padding: '8px 18px', borderRadius: 4, border: '1px solid #004b8d', cursor: 'pointer',
            background: '#004b8d', color: '#fff', fontSize: 13, fontWeight: 600,
          }}
        >+ New Assessment</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={card}><div style={label}>Total</div><div style={value}>{statusCounts.total}</div></div>
        <div style={card}><div style={label}>Pending</div><div style={value}>{statusCounts.invited}</div></div>
        <div style={card}><div style={label}>Completed</div><div style={{ ...value, color: '#0f5132' }}>{statusCounts.completed}</div></div>
        <div style={card}><div style={label}>Hiring</div><div style={{ ...value, color: '#004b8d' }}>{typeCounts.hiring}</div></div>
        <div style={card}><div style={label}>Training</div><div style={{ ...value, color: '#7c3aed' }}>{typeCounts.training}</div></div>
      </div>

      {/* Create Assessment Panel */}
      {showCreate && (
        <div style={{ ...card, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#202124' }}>Create Assessment</span>
            <button onClick={() => { setShowCreate(false); setInviteUrl(''); }}
              style={{ background: 'none', border: 'none', color: '#5f6368', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>

          {!selectedType ? (
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ASSIGNMENT_TYPES.map(t => (
                <button key={t.type} onClick={() => { setSelectedType(t.type); setInviteUrl(''); }}
                  style={{
                    padding: 14, borderRadius: 4, cursor: 'pointer', textAlign: 'left',
                    border: '1px solid #c8c8c8', background: '#f8f9fa',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = t.color; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f8f9fa'; e.currentTarget.style.borderColor = '#c8c8c8'; }}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#202124', marginBottom: 2 }}>{t.label}</div>
                  <div style={{ fontSize: 12, color: '#5f6368' }}>{t.desc}</div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <button onClick={() => { setSelectedType(null); setInviteUrl(''); }}
                  style={{ background: 'none', border: 'none', color: '#004b8d', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 600 }}>← Back</button>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#202124' }}>Create {ASSIGNMENT_TYPES.find(t => t.type === selectedType)?.label}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#5f6368', marginBottom: 4, display: 'block', fontWeight: 600 }}>CANDIDATE NAME</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Thompson"
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #c8c8c8',
                      background: '#fff', color: '#202124', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                    }} />
                </div>

                {selectedType === 'training_drill' && (
                  <div>
                    <label style={{ fontSize: 11, color: '#5f6368', marginBottom: 4, display: 'block', fontWeight: 600 }}>DRILL TYPE</label>
                    <select value={drillPack} onChange={e => setDrillPack(e.target.value)}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #c8c8c8',
                        background: '#fff', color: '#202124', fontSize: 13, outline: 'none',
                      }}>
                      {drillPacks.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                )}

                <button onClick={createAssessment} disabled={creating || !name.trim()}
                  style={{
                    padding: '8px 18px', borderRadius: 4, border: '1px solid #004b8d', cursor: 'pointer',
                    background: creating || !name.trim() ? '#e5e5e5' : '#004b8d',
                    color: creating || !name.trim() ? '#5f6368' : '#fff', fontSize: 13, fontWeight: 600, marginTop: 4,
                    borderColor: creating || !name.trim() ? '#c8c8c8' : '#004b8d',
                  }}
                >{creating ? 'Creating...' : `Create ${ASSIGNMENT_TYPES.find(t => t.type === selectedType)?.label || 'Assessment'}`}</button>

                {createError && <div style={{ fontSize: 12, color: '#d93025' }}>{createError}</div>}

                {inviteUrl && (
                  <div style={{ padding: 10, borderRadius: 4, background: '#e6f4ea', border: '1px solid #0f5132' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#0f5132', marginBottom: 4 }}>✓ Invite Link Created</div>
                    <a href={inviteUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, color: '#004b8d', wordBreak: 'break-all' }}>{inviteUrl}</a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Recent assessments */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#202124', marginBottom: 10 }}>Assessments</div>
          {loading ? (
            <div style={{ fontSize: 12, color: '#5f6368' }}>Loading...</div>
          ) : assessments.length === 0 ? (
            <div style={{ fontSize: 12, color: '#5f6368', lineHeight: 1.6 }}>
              No assessments yet. Click "+ New Assessment" to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {assessments.slice(0, 8).map(a => (
                <a key={a.id} href={`/mvp/assessments/${a.id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 8px', borderRadius: 4, textDecoration: 'none', fontSize: 12.5,
                  color: '#202124',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 5px', borderRadius: 2, fontSize: 10, fontWeight: 700,
                      background: a.assignment_type === 'hiring_exam' ? '#e8f0fe' : '#f3e8ff',
                      color: a.assignment_type === 'hiring_exam' ? '#004b8d' : '#7c3aed',
                    }}>{a.assignment_type === 'hiring_exam' ? 'HIRING' : 'DRILL'}</span>
                    <span style={{ fontWeight: 500 }}>{a.candidate_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 5px', borderRadius: 2, fontSize: 10, fontWeight: 600,
                      color: a.status === 'analysed' ? '#0f5132' : a.status === 'invited' ? '#ea8600' : '#5f6368',
                      background: a.status === 'analysed' ? '#e6f4ea' : a.status === 'invited' ? '#fef7e0' : '#f1f3f4',
                    }}>{a.status}</span>
                    <span style={{ color: '#5f6368', fontSize: 11 }}>{a.created_at?.slice(0, 10)}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#202124', marginBottom: 10 }}>Recent Activity</div>
          {assessments.length === 0 ? (
            <div style={{ fontSize: 12, color: '#5f6368', lineHeight: 1.6 }}>
              No activity yet. Create an assessment to get started.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {assessments.slice(0, 6).map(a => (
                <a key={a.id} href={`/mvp/assessments/${a.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                  padding: '7px 8px', borderRadius: 4, fontSize: 12.5, color: '#5f6368',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.status === 'analysed' ? '#137333' : '#ea8600', flexShrink: 0 }} />
                  <span><strong style={{ color: '#202124' }}>{a.candidate_name}</strong> — {a.status === 'invited' ? 'Invited' : a.status === 'analysed' ? 'Analysed' : a.status}</span>
                  <span style={{ marginLeft: 'auto', color: '#5f6368', fontSize: 11 }}>{a.created_at?.slice(0, 10)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </ManagerShell>
  );
}
