'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';

interface Attempt {
  id: string;
  candidate_name: string;
  scenario_title: string | null;
  overall_score: number | null;
  readiness_label: string;
  created_at: string;
  pack_title: string | null;
}

interface FeaturedItem {
  assessment_id: string;
  visibility: string;
  show_audio: number;
  show_transcript: number;
  show_feedback: number;
  show_ticket_note: number;
  sort_order: number;
  pack_title: string | null;
  overall_score: number | null;
  readiness_label: string;
  created_at: string;
  assessment_created_at: string;
}

export default function FeaturedPage() {
  const { data: session } = authClient.useSession();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [featured, setFeatured] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    Promise.all([
      fetch(`/api/candidate/attempts?userId=${session.user.id}`).then(r => r.json()),
      fetch(`/api/candidate/featured?userId=${session.user.id}`).then(r => r.json()),
    ]).then(([aData, fData]) => {
      setAttempts(aData.attempts || []);
      setFeatured(fData.featured || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session?.user?.id]);

  const toggle = async (assessmentId: string, isFeatured: boolean) => {
    const res = await fetch('/api/candidate/featured', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session?.user?.id, assessmentId, featured: !isFeatured }),
    });
    if (res.ok) {
      const fRes = await fetch(`/api/candidate/featured?userId=${session?.user?.id}`).then(r => r.json());
      setFeatured(fRes.featured || []);
    }
  };

  const updateSettings = async (assessmentId: string, field: string, value: number) => {
    await fetch('/api/candidate/featured', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session?.user?.id, assessmentId, [field]: value }),
    });
    const fRes = await fetch(`/api/candidate/featured?userId=${session?.user?.id}`).then(r => r.json());
    setFeatured(fRes.featured || []);
  };

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #c8c8c8', borderRadius: 6, overflow: 'hidden', marginBottom: 16,
  };
  const header: React.CSSProperties = {
    padding: '10px 16px', borderBottom: '1px solid #e5e5e5', background: '#f8f9fa',
    fontSize: 13, fontWeight: 700, color: '#202124',
  };
  const body: React.CSSProperties = { padding: '14px 16px' };

  const featuredIds = new Set(featured.map(f => f.assessment_id));

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#202124', marginBottom: 4 }}>Featured Calls</div>
      <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 16 }}>
        Choose which calls appear on your public profile. Only featured calls are visible to hiring managers.
      </div>

      <div style={card}>
        <div style={header}>All Attempts</div>
        <div style={body}>
          {loading ? (
            <div style={{ fontSize: 12, color: '#5f6368' }}>Loading...</div>
          ) : attempts.length === 0 ? (
            <div style={{ fontSize: 12, color: '#5f6368' }}>No attempts yet. Complete a practice call first.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {attempts.map(a => {
                const isFeatured = featuredIds.has(a.id);
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px', borderRadius: 4, fontSize: 12.5, color: '#202124',
                    background: isFeatured ? '#f0f7ff' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500 }}>{a.scenario_title || a.pack_title || 'Call'}</span>
                      {a.overall_score != null && (
                        <span style={{
                          padding: '1px 5px', borderRadius: 2, fontSize: 10, fontWeight: 700,
                          background: a.overall_score >= 80 ? '#e6f4ea' : a.overall_score >= 60 ? '#fef7e0' : '#fff4f2',
                          color: a.overall_score >= 80 ? '#0f5132' : a.overall_score >= 60 ? '#7a4f00' : '#842029',
                        }}>{a.overall_score}</span>
                      )}
                      <span style={{ color: '#5f6368', fontSize: 11 }}>{a.created_at?.slice(0, 10)}</span>
                    </div>
                    <button
                      onClick={() => toggle(a.id, isFeatured)}
                      style={{
                        padding: '4px 10px', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: isFeatured ? '1px solid #004b8d' : '1px solid #c8c8c8',
                        background: isFeatured ? '#004b8d' : 'transparent',
                        color: isFeatured ? '#fff' : '#5f6368',
                      }}
                    >
                      {isFeatured ? 'Featured ★' : 'Feature'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {featured.length > 0 && (
        <div style={card}>
          <div style={header}>Featured Call Settings</div>
          <div style={body}>
            <div style={{ fontSize: 12, color: '#5f6368', marginBottom: 10 }}>
              Per-call visibility toggles for your public profile at /u/{'your-username'}.
            </div>
            {featured.map(f => (
              <div key={f.assessment_id} style={{
                padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12,
              }}>
                <div style={{ fontWeight: 600, color: '#202124', marginBottom: 6 }}>
                  {f.pack_title || 'Call'} — Score: {f.overall_score ?? '—'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                  {[
                    { key: 'show_audio', label: 'Audio', value: f.show_audio },
                    { key: 'show_transcript', label: 'Transcript', value: f.show_transcript },
                    { key: 'show_feedback', label: 'Feedback', value: f.show_feedback },
                    { key: 'show_ticket_note', label: 'Ticket Note', value: f.show_ticket_note },
                  ].map(t => (
                    <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!t.value}
                        onChange={e => updateSettings(f.assessment_id, t.key, e.target.checked ? 1 : 0)}
                      />
                      <span style={{ color: '#5f6368' }}>{t.label}</span>
                    </label>
                  ))}
                  <select
                    value={f.visibility}
                    onChange={e => updateSettings(f.assessment_id, 'visibility', e.target.value as any)}
                    style={{
                      padding: '2px 6px', borderRadius: 3, border: '1px solid #c8c8c8', fontSize: 11,
                    }}
                  >
                    <option value="public">Public</option>
                    <option value="share_link">Share link only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
