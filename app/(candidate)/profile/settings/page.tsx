'use client';

import { useEffect, useState } from 'react';
import { authClient, updateUser } from '@/lib/auth-client';

export default function SettingsPage() {
  const { data: session, refetch } = authClient.useSession();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showAttempts, setShowAttempts] = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showTicketNotes, setShowTicketNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.user?.id) return;
    setDisplayName(session.user.name || '');
    setUsername((session.user as any).username || '');
    fetch(`/api/candidate/profile?userId=${session.user.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.profile) {
          setBio(data.profile.bio || '');
          setIsPublic(!!data.profile.is_public);
          setShowAttempts(!!data.profile.show_attempts);
          setShowRecordings(!!data.profile.show_recordings);
          setShowTranscripts(!!data.profile.show_transcripts);
          setShowFeedback(!!data.profile.show_feedback);
          setShowTicketNotes(!!data.profile.show_ticket_notes);
        }
      })
      .catch(() => {});
  }, [session?.user?.id]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await updateUser({ name: displayName });
      if (username && username !== (session?.user as any)?.username) {
        await updateUser({ username });
      }
      const res = await fetch('/api/candidate/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user?.id,
          displayName: displayName || undefined,
          bio,
          isPublic: isPublic ? 1 : 0,
          showAttempts: showAttempts ? 1 : 0,
          showRecordings: showRecordings ? 1 : 0,
          showTranscripts: showTranscripts ? 1 : 0,
          showFeedback: showFeedback ? 1 : 0,
          showTicketNotes: showTicketNotes ? 1 : 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }
      setSaved(true);
      refetch();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const section: React.CSSProperties = {
    background: '#fff', border: '1px solid #c8c8c8', borderRadius: 6, overflow: 'hidden', marginBottom: 16,
  };
  const header: React.CSSProperties = {
    padding: '10px 16px', borderBottom: '1px solid #e5e5e5', background: '#f8f9fa',
    fontSize: 13, fontWeight: 700, color: '#202124',
  };
  const body: React.CSSProperties = { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 };
  const label: React.CSSProperties = { fontSize: 11, color: '#5f6368', fontWeight: 600, marginBottom: 4, display: 'block' };
  const input: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #c8c8c8',
    background: '#fff', color: '#202124', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const toggleRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0',
    borderBottom: '1px solid #f0f0f0', fontSize: 13, color: '#202124',
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#202124', marginBottom: 16 }}>Settings</div>

      <div style={section}>
        <div style={header}>Profile</div>
        <div style={body}>
          <div>
            <label style={label}>DISPLAY NAME</label>
            <input style={input} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label style={label}>USERNAME</label>
            <input style={input} value={username} onChange={e => setUsername(e.target.value)} placeholder="your-username" />
            <div style={{ fontSize: 10, color: '#5f6368', marginTop: 2 }}>
              Public profile: /u/{username || 'your-username'}
            </div>
          </div>
          <div>
            <label style={label}>BIO</label>
            <textarea style={{ ...input, minHeight: 60, resize: 'vertical' }} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell hiring managers about yourself" />
          </div>
        </div>
      </div>

      <div style={section}>
        <div style={header}>Public Profile Visibility</div>
        <div style={body}>
          <div style={toggleRow}>
            <span>Enable public profile</span>
            <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} style={{ width: 16, height: 16 }} />
          </div>
          <div style={toggleRow}>
            <span>Show attempt list</span>
            <input type="checkbox" checked={showAttempts} onChange={e => setShowAttempts(e.target.checked)} style={{ width: 16, height: 16 }} />
          </div>
          <div style={toggleRow}>
            <span>Show call recordings</span>
            <input type="checkbox" checked={showRecordings} onChange={e => setShowRecordings(e.target.checked)} style={{ width: 16, height: 16 }} />
          </div>
          <div style={toggleRow}>
            <span>Show transcripts</span>
            <input type="checkbox" checked={showTranscripts} onChange={e => setShowTranscripts(e.target.checked)} style={{ width: 16, height: 16 }} />
          </div>
          <div style={toggleRow}>
            <span>Show feedback</span>
            <input type="checkbox" checked={showFeedback} onChange={e => setShowFeedback(e.target.checked)} style={{ width: 16, height: 16 }} />
          </div>
          <div style={toggleRow}>
            <span>Show ticket notes</span>
            <input type="checkbox" checked={showTicketNotes} onChange={e => setShowTicketNotes(e.target.checked)} style={{ width: 16, height: 16 }} />
          </div>
        </div>
      </div>

      {error && <div style={{ fontSize: 12, color: '#d93025', marginBottom: 10 }}>{error}</div>}
      {saved && <div style={{ fontSize: 12, color: '#0f5132', marginBottom: 10 }}>Settings saved.</div>}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '8px 24px', borderRadius: 4, border: '1px solid #004b8d', cursor: 'pointer',
          background: saving ? '#e5e5e5' : '#004b8d', color: saving ? '#5f6368' : '#fff',
          fontSize: 13, fontWeight: 600, borderColor: saving ? '#c8c8c8' : '#004b8d',
        }}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
