'use client';

type NoteTab = 'internal' | 'live';

export default function TicketNotesPanel({ activeTab, onTabChange, internalNotes, liveNotes, draft, onDraftChange, onSubmit }: {
  activeTab: NoteTab;
  onTabChange: (tab: NoteTab) => void;
  internalNotes: string[];
  liveNotes: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const notes = activeTab === 'internal' ? internalNotes : liveNotes;
  const emptyText = activeTab === 'internal' ? 'No internal notes posted yet.' : 'No live notes posted yet.';
  const placeholder = 'Questions to ask, facts to capture, things to check...';
  const buttonLabel = activeTab === 'internal' ? 'Post Internal Note' : 'Post Live Note';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div style={{
      flex: 1, minHeight: 0,
      background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #b8b8b8', flexShrink: 0 }}>
        <button
          onClick={() => onTabChange('internal')}
          style={{
            flex: 1, padding: '7px 10px', border: 'none', borderBottom: activeTab === 'internal' ? '2px solid #111' : '2px solid transparent',
            background: activeTab === 'internal' ? '#fff' : '#f4f4f4',
            fontSize: 11, fontWeight: 700, color: activeTab === 'internal' ? '#111' : '#6f6f6f',
            cursor: 'pointer', textTransform: 'uppercase',
          }}
        >
          Internal Notes
        </button>
        <button
          onClick={() => onTabChange('live')}
          style={{
            flex: 1, padding: '7px 10px', border: 'none', borderBottom: activeTab === 'live' ? '2px solid #111' : '2px solid transparent',
            background: activeTab === 'live' ? '#fff' : '#f4f4f4',
            fontSize: 11, fontWeight: 700, color: activeTab === 'live' ? '#111' : '#6f6f6f',
            cursor: 'pointer', textTransform: 'uppercase',
          }}
        >
          Live Notes
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {notes.length === 0 && (
            <div style={{ fontSize: 12, color: '#6f6f6f', fontStyle: 'italic', padding: '8px 0' }}>{emptyText}</div>
          )}
          {notes.map((note, index) => (
            <div key={`${index}-${note.slice(0, 10)}`} style={{ borderLeft: '3px solid #111', background: '#f7f7f7', padding: '6px 8px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', marginBottom: 2 }}>
                {activeTab === 'internal' ? 'Internal note' : 'Live note'} {index + 1}
              </div>
              <div style={{ fontSize: 12, color: '#111', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{note}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #cfcfcf', padding: '6px 8px', background: '#fff', flexShrink: 0 }}>
          <textarea
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={2}
            style={{
              width: '100%', resize: 'none', border: '1px solid #b8b8b8', borderRadius: 3,
              padding: '6px 8px', fontSize: 12, color: '#111', background: '#fff', lineHeight: 1.4,
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={onSubmit}
            disabled={!draft.trim()}
            style={{
              marginTop: 4, padding: '6px 12px', background: '#111', color: '#fff',
              border: '1px solid #111', borderRadius: 3, fontSize: 11, fontWeight: 700,
              cursor: draft.trim() ? 'pointer' : 'default', opacity: draft.trim() ? 1 : 0.45,
            }}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
