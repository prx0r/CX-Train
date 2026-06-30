import Link from 'next/link';

interface AttemptProps {
  id: string;
  candidate_name: string;
  scenario_title: string | null;
  overall_score: number | null;
  readiness_label: string;
  created_at: string;
  has_recording: number;
  pack_title: string | null;
}

interface Profile {
  user_id: string;
  username: string | null;
  display_name: string;
  bio: string;
  is_public: number;
  show_attempts: number;
  show_recordings: number;
  show_transcripts: number;
  show_feedback: number;
  show_ticket_notes: number;
}

async function getPublicProfile(username: string): Promise<{ profile: Profile | null; attempts: AttemptProps[] } | { error: string }> {
  try {
    const { getPublicProfile } = await import('@/lib/candidate/profile');
    return getPublicProfile(username);
  } catch {
    return { error: 'Profile not found' };
  }
}

export default async function PublicProfilePage({ params }: { params: { username: string } }) {
  const result = await getPublicProfile(params.username);

  if ('error' in result) {
    return (
      <div className="min-h-screen bg-[#dcdcdc] flex items-center justify-center">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, color: '#5f6368' }}>404</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#202124', marginBottom: 4 }}>Profile not found</div>
          <div style={{ fontSize: 13, color: '#5f6368' }}>This candidate profile does not exist or is set to private.</div>
          <Link href="/practice" style={{ display: 'inline-block', marginTop: 16, color: '#004b8d', fontSize: 13 }}>Browse practice scenarios</Link>
        </div>
      </div>
    );
  }

  const { profile, attempts } = result;

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#dcdcdc] flex items-center justify-center">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, color: '#5f6368' }}>404</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#202124', marginBottom: 4 }}>Profile not found</div>
          <div style={{ fontSize: 13, color: '#5f6368' }}>This profile is private or does not exist.</div>
        </div>
      </div>
    );
  }

  const avgScore = attempts.filter(a => a.overall_score != null).length > 0
    ? Math.round(attempts.filter(a => a.overall_score != null).reduce((s, a) => s + (a.overall_score || 0), 0) / attempts.filter(a => a.overall_score != null).length)
    : null;

  const s: React.CSSProperties = {
    background: '#fff', border: '1px solid #c8c8c8', borderRadius: 6, padding: 20,
  };

  return (
    <div className="min-h-screen" style={{ background: '#dcdcdc' }}>
      <div style={{
        background: '#111', borderBottom: '1px solid #000',
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 22, height: 22, border: '2px solid #7dd3fc', borderRadius: 4 }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>CallCallum</span>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* Profile header */}
        <div style={{ ...s, marginBottom: 16, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: '#111',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#fff', fontWeight: 700, margin: '0 auto 12px',
          }}>
            {profile.display_name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#202124', margin: '0 0 4px' }}>{profile.display_name}</h1>
          {profile.bio && <p style={{ fontSize: 13, color: '#5f6368', maxWidth: 400, margin: '0 auto' }}>{profile.bio}</p>}
          {avgScore != null && (
            <div style={{
              display: 'inline-block', padding: '4px 14px', borderRadius: 4, fontSize: 13, fontWeight: 700,
              background: avgScore >= 80 ? '#e6f4ea' : avgScore >= 60 ? '#fef7e0' : '#fff4f2',
              color: avgScore >= 80 ? '#0f5132' : avgScore >= 60 ? '#7a4f00' : '#842029',
              marginTop: 8,
            }}>
              Avg Score: {avgScore}/100 · {attempts.length} call{attempts.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Featured attempts */}
        {attempts.length > 0 && (
          <div style={s}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#202124', marginBottom: 12 }}>Featured Calls</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attempts.map(a => (
                <Link key={a.id} href={`/mvp/analysis/${a.id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: 4, textDecoration: 'none', fontSize: 13, color: '#202124',
                  border: '1px solid #e5e5e5', background: '#fafafa',
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.scenario_title || a.pack_title || 'Call'}</div>
                    <div style={{ fontSize: 11, color: '#5f6368', marginTop: 2 }}>{a.created_at?.slice(0, 10)}</div>
                  </div>
                  {a.overall_score != null && (
                    <span style={{
                      padding: '2px 8px', borderRadius: 3, fontSize: 13, fontWeight: 700,
                      background: a.overall_score >= 80 ? '#e6f4ea' : a.overall_score >= 60 ? '#fef7e0' : '#fff4f2',
                      color: a.overall_score >= 80 ? '#0f5132' : a.overall_score >= 60 ? '#7a4f00' : '#842029',
                    }}>
                      {a.overall_score}/100
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Manager CTA */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 12, color: '#5f6368', marginBottom: 8 }}>
            Are you a hiring manager? See how candidates perform on real support calls.
          </p>
          <Link href="/sign-in"
            style={{
              padding: '8px 20px', borderRadius: 4, border: '1px solid #004b8d',
              background: '#004b8d', color: '#fff', fontSize: 13, fontWeight: 600,
              textDecoration: 'none', display: 'inline-block',
            }}
          >
            Create a Challenge
          </Link>
        </div>
      </div>
    </div>
  );
}
