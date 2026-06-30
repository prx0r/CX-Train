'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

interface Attempt {
  id: string;
  scenario_title: string | null;
  overall_score: number | null;
  readiness_label: string;
  status: string;
  attempt_mode: string;
  assignment_type: string;
  created_at: string;
  completed_at: string | null;
  has_recording: number;
  pack_title: string | null;
}

export default function AttemptsPage() {
  const { data: session } = authClient.useSession();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch(`/api/candidate/attempts?userId=${session.user.id}&limit=100`)
      .then(r => r.json())
      .then(data => {
        setAttempts(data.attempts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.user?.id]);

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #c8c8c8', borderRadius: 6, overflow: 'hidden',
  };
  const header: React.CSSProperties = {
    padding: '10px 16px', borderBottom: '1px solid #e5e5e5', background: '#f8f9fa',
    fontSize: 13, fontWeight: 700, color: '#202124',
  };
  const body: React.CSSProperties = { padding: '14px 16px' };

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#202124', marginBottom: 16 }}>All Attempts</div>

      <div style={card}>
        <div style={header}>
          {loading ? 'Loading...' : `${attempts.length} attempt${attempts.length !== 1 ? 's' : ''}`}
        </div>
        <div style={body}>
          {loading ? (
            <div style={{ fontSize: 12, color: '#5f6368' }}>Loading...</div>
          ) : attempts.length === 0 ? (
            <div style={{ fontSize: 12, color: '#5f6368', lineHeight: 1.6 }}>
              No attempts yet. <Link href="/practice" style={{ color: '#004b8d' }}>Start a practice call</Link>.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {attempts.map(a => (
                <Link key={a.id} href={`/mvp/analysis/${a.id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px', borderRadius: 4, textDecoration: 'none', fontSize: 12.5, color: '#202124',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f1f3f4'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 5px', borderRadius: 2, fontSize: 10, fontWeight: 700,
                      background: a.attempt_mode === 'practice' ? '#e8f0fe' : a.assignment_type === 'hiring_exam' ? '#fef7e0' : '#f3e8ff',
                      color: a.attempt_mode === 'practice' ? '#004b8d' : a.assignment_type === 'hiring_exam' ? '#ea8600' : '#7c3aed',
                    }}>
                      {a.attempt_mode === 'practice' ? 'PRACTICE' : a.assignment_type === 'hiring_exam' ? 'HIRING' : 'DRILL'}
                    </span>
                    <span style={{ fontWeight: 500 }}>{a.scenario_title || a.pack_title || 'Call'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {a.overall_score != null && (
                      <span style={{
                        padding: '2px 6px', borderRadius: 2, fontSize: 11, fontWeight: 700,
                        background: a.overall_score >= 80 ? '#e6f4ea' : a.overall_score >= 60 ? '#fef7e0' : '#fff4f2',
                        color: a.overall_score >= 80 ? '#0f5132' : a.overall_score >= 60 ? '#7a4f00' : '#842029',
                      }}>{a.overall_score}</span>
                    )}
                    <span style={{
                      padding: '2px 5px', borderRadius: 2, fontSize: 10, fontWeight: 600,
                      color: a.status === 'analysed' ? '#0f5132' : a.status === 'completed' ? '#004b8d' : '#5f6368',
                      background: a.status === 'analysed' ? '#e6f4ea' : a.status === 'completed' ? '#e8f0fe' : '#f1f3f4',
                    }}>{a.status}</span>
                    <span style={{ color: '#5f6368', fontSize: 11 }}>{a.created_at?.slice(0, 10)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
