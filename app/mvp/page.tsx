'use client';

import { useState, useEffect } from 'react';
import ManagerShell from '@/components/mvp/ManagerShell';

type AssignmentType = 'hiring_exam' | 'training_drill' | 'training_shift';

interface Assessment {
  id: string;
  title: string;
  candidate_name: string;
  status: string;
  created_at: string;
  assignment_type: string;
}

export default function DashboardPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/mvp/assessments')
      .then(r => r.json())
      .then(d => { setAssessments(d.assessments || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const statusCounts = {
    total: assessments.length,
    invited: assessments.filter(a => a.status === 'invited').length,
    completed: assessments.filter(a => a.status === 'completed' || a.status === 'analysed').length,
    reviewed: assessments.filter(a => a.status === 'reviewed').length,
  };

  const typeCounts = {
    hiring: assessments.filter(a => a.assignment_type === 'hiring_exam').length,
    training: assessments.filter(a => a.assignment_type === 'training_drill').length,
  };

  const recentActivity = assessments.slice(0, 5).map(a => {
    const time = a.created_at?.slice(0, 10) || 'recent';
    const action = a.status === 'invited' ? 'created' : a.status === 'analysed' ? 'analysed' : 'completed';
    return { id: a.id, candidate: a.candidate_name, action, time, type: a.assignment_type };
  });

  const cardStyle: React.CSSProperties = {
    padding: '16px 20px', borderRadius: 10,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 };
  const valueStyle: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: '#e4e4e7' };

  return (
    <ManagerShell>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e4e4e7', marginBottom: 4 }}>Dashboard</div>
        <div style={{ fontSize: 12, color: '#52525b' }}>
          {loading ? 'Loading...' : `${statusCounts.total} total assessments · ${statusCounts.invited} pending`}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Total</div>
          <div style={valueStyle}>{statusCounts.total}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Pending</div>
          <div style={valueStyle}>{statusCounts.invited}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Completed</div>
          <div style={{ ...valueStyle, color: '#22c55e' }}>{statusCounts.completed}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Hiring</div>
          <div style={{ ...valueStyle, color: '#60a5fa' }}>{typeCounts.hiring}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Training</div>
          <div style={{ ...valueStyle, color: '#a78bfa' }}>{typeCounts.training}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Recent assessments */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7', marginBottom: 12 }}>Recent Assessments</div>
          {loading ? (
            <div style={{ fontSize: 12, color: '#52525b' }}>Loading...</div>
          ) : assessments.length === 0 ? (
            <div style={{ fontSize: 12, color: '#52525b', lineHeight: 1.6 }}>
              No assessments yet. Ask Callum to create one, or use the chat bar below.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

        {/* Callum suggestions / recent activity */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7', marginBottom: 12 }}>Recent Activity</div>
          {recentActivity.length === 0 ? (
            <div style={{ fontSize: 12, color: '#52525b', lineHeight: 1.6 }}>
              No activity yet. Ask Callum to show assessments or suggest next steps.
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Suggestion text="Show me all assessments" />
                <Suggestion text="Create a new hiring assessment" />
                <Suggestion text="Which candidates need attention?" />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentActivity.map((a, i) => (
                <a key={a.id} href={`/mvp/assessments/${a.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                  padding: '8px 10px', borderRadius: 6, fontSize: 12.5, transition: 'background 0.15s',
                  color: '#a1a1aa',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.action === 'analysed' ? '#22c55e' : '#f59e0b', flexShrink: 0 }} />
                  <span><strong style={{ color: '#e4e4e7' }}>{a.candidate}</strong> assessment {a.action}</span>
                  <span style={{ marginLeft: 'auto', color: '#52525b', fontSize: 11 }}>{a.time}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </ManagerShell>
  );
}

function Suggestion({ text }: { text: string }) {
  return (
    <button onClick={() => {
      localStorage.setItem('callum_pending_message', text);
      window.dispatchEvent(new CustomEvent('callum-send'));
    }} style={{
      padding: '8px 12px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.03)', color: '#71717a', fontSize: 12, transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
    >{text}</button>
  );
}
