'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

interface HiringPack {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  customer: {
    name: string;
    company: string;
    role: string;
    temperament: string;
    openingLine: string;
    issue: string;
  };
}

function getDifficultyColor(d: string) {
  switch (d) {
    case 'basic': return { bg: '#e6f4ea', text: '#0f5132' };
    case 'intermediate': return { bg: '#fef7e0', text: '#7a4f00' };
    case 'advanced': return { bg: '#fff4f2', text: '#842029' };
    case 'expert': return { bg: '#f3e8ff', text: '#7c3aed' };
    default: return { bg: '#f1f3f4', text: '#5f6368' };
  }
}

export default function PracticePage() {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const [packs, setPacks] = useState<HiringPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/mvp/packs')
      .then(r => r.json())
      .then(data => {
        setPacks((data.hiringPacks || data.packs || []).slice(0, 8));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const startPractice = async (packId: string) => {
    if (!session) {
      router.push('/sign-in?redirectTo=/practice');
      return;
    }
    setStarting(packId);
    try {
      const res = await fetch('/api/mvp/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: session.user.name || 'Candidate',
          assignment_type: 'hiring_exam',
          assessment_pack_id: packId,
          candidate_user_id: session.user.id,
          candidate_email: session.user.email,
        }),
      });
      const data = await res.json();
      if (data.invite_url) {
        router.push(data.invite_url);
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      alert('Failed to start practice');
    } finally {
      setStarting(null);
    }
  };

  const s: React.CSSProperties = {
    background: '#fff', border: '1px solid #c8c8c8', borderRadius: 6, overflow: 'hidden',
  };
  const colHeader: React.CSSProperties = {
    padding: '10px 16px', borderBottom: '1px solid #e5e5e5', background: '#f8f9fa',
    fontSize: 13, fontWeight: 700, color: '#202124',
  };

  return (
    <div className="min-h-screen" style={{ background: '#dcdcdc' }}>
      <div style={{
        background: '#111', borderBottom: '1px solid #000',
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 22, height: 22, border: '2px solid #7dd3fc', borderRadius: 4 }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', flex: 1 }}>CallCallum</span>
        {session ? (
          <Link href="/profile" style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}>Dashboard</Link>
        ) : (
          <Link href="/sign-in" style={{ color: '#7dd3fc', fontSize: 13, textDecoration: 'none' }}>Sign in</Link>
        )}
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>Practice Support Calls</h1>
          <p style={{ fontSize: 13, color: '#5f6368', margin: 0 }}>
            Choose a scenario, make the call, get AI feedback. {session ? 'Your attempts are saved to your profile.' : 'Sign in to save your progress.'}
          </p>
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: '#5f6368' }}>Loading scenarios...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {packs.map(p => {
              const dc = getDifficultyColor(p.difficulty);
              return (
                <div key={p.id} style={s}>
                  <div style={colHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{p.title}</span>
                      <span style={{
                        padding: '1px 6px', borderRadius: 2, fontSize: 9, fontWeight: 700,
                        background: dc.bg, color: dc.text, textTransform: 'uppercase',
                      }}>{p.difficulty}</span>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 12, color: '#5f6368', margin: 0, lineHeight: 1.5 }}>{p.description}</p>
                    <div style={{ fontSize: 11, color: '#5f6368', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span><strong>Customer:</strong> {p.customer.name}, {p.customer.role} at {p.customer.company}</span>
                      <span><strong>Issue:</strong> {p.customer.issue}</span>
                      <span><strong>Temperament:</strong> {p.customer.temperament}</span>
                    </div>
                    <button
                      onClick={() => startPractice(p.id)}
                      disabled={starting === p.id}
                      style={{
                        padding: '8px 16px', borderRadius: 4, border: '1px solid #004b8d',
                        background: starting === p.id ? '#e5e5e5' : '#004b8d',
                        color: starting === p.id ? '#5f6368' : '#fff',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4,
                        borderColor: starting === p.id ? '#c8c8c8' : '#004b8d',
                      }}
                    >
                      {starting === p.id ? 'Starting...' : 'Start Call'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
