'use client';

import WindowFrame from '../WindowFrame';

interface TicketWindowProps {
  ticketText: string;
  onTicketChange: (text: string) => void;
  onSubmit: () => void;
  submitted: boolean;
}

export default function TicketWindow({ ticketText, onTicketChange, onSubmit, submitted }: TicketWindowProps) {
  return (
    <WindowFrame id="ticket" name="Ticket — New Incident" icon="🎫" defaultWidth={520} defaultHeight={440}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ fontSize: 12, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Create Ticket
        </div>
        {submitted ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#4ade80', fontSize: 14, fontWeight: 500,
          }}>
            ✓ Ticket submitted successfully
          </div>
        ) : (
          <>
            <textarea
              value={ticketText}
              onChange={e => onTicketChange(e.target.value)}
              placeholder="Describe the issue, user, company, device, steps taken, and next steps..."
              style={{
                flex: 1,
                padding: 12,
                background: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#d0d0d0',
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'none',
              }}
            />
            <button
              onClick={onSubmit}
              disabled={!ticketText.trim()}
              style={{
                padding: '10px 20px',
                background: ticketText.trim() ? '#16a34a' : '#444',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: ticketText.trim() ? 'pointer' : 'default',
              }}
            >
              Submit Ticket & Complete
            </button>
          </>
        )}
      </div>
    </WindowFrame>
  );
}
