'use client';

export interface TicketData {
  id: string;
  title: string;
  requesterName: string;
  company: string;
  department: string;
  severity: string;
  status: string;
  description: string;
  impact?: string;
  urgency?: string;
}

export default function TicketSidePanel({ ticket, notes, onNotesChange, children }: {
  ticket: TicketData;
  notes?: string;
  onNotesChange?: (v: string) => void;
  children?: React.ReactNode;
}) {
  const severityColors: Record<string, string> = {
    low: '#6f6f6f', medium: '#7a4f00', high: '#9f3a00', critical: '#842029',
  };

  return (
    <div style={{
      width: 320, background: '#fff', borderRight: '1px solid #b8b8b8',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Ticket header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #cfcfcf', background: '#f4f4f4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>
            {ticket.id}
          </span>
          <span style={{
            padding: '1px 6px', borderRadius: 2, fontSize: 10, fontWeight: 700,
            background: severityColors[ticket.severity] || '#6f6f6f',
            color: '#fff',
          }}>
            {ticket.severity.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, color: '#525252', marginLeft: 'auto' }}>
            {ticket.status}
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 6, lineHeight: 1.3 }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 12, color: '#525252', lineHeight: 1.5 }}>
          <div><strong style={{ color: '#111' }}>{ticket.requesterName}</strong> · {ticket.company}</div>
          <div style={{ color: '#6f6f6f' }}>{ticket.department}</div>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #cfcfcf', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 4 }}>
          Description
        </div>
        <div style={{ fontSize: 12, color: '#222', lineHeight: 1.5 }}>
          {ticket.description}
        </div>
        {ticket.impact && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#7a4f00' }}>
            Impact: {ticket.impact}
          </div>
        )}
        {ticket.urgency && (
          <div style={{ fontSize: 12, color: '#842029' }}>
            Urgency: {ticket.urgency}
          </div>
        )}
      </div>

      {/* Notes area */}
      {onNotesChange !== undefined && (
        <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 4 }}>
            Notes / Ticket Draft
          </div>
          <textarea
            value={notes || ''}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Write your ticket notes here..."
            style={{
              flex: 1, width: '100%', padding: 8, border: '1px solid #b8b8b8', borderRadius: 3,
              fontSize: 12, background: '#fff', color: '#111', resize: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      {/* Bottom actions */}
      {children && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid #cfcfcf' }}>
          {children}
        </div>
      )}
    </div>
  );
}
