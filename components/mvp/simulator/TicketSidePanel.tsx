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
    low: '#64748b', medium: '#eab308', high: '#ef4444', critical: '#dc2626',
  };

  return (
    <div style={{
      width: 280, background: '#1e293b', borderRight: '1px solid #334155',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Ticket header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>
            {ticket.id}
          </span>
          <span style={{
            padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: severityColors[ticket.severity] || '#64748b',
            color: '#fff',
          }}>
            {ticket.severity.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
            {ticket.status}
          </span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 6, lineHeight: 1.3 }}>
          {ticket.title}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
          <div><strong style={{ color: '#cbd5e1' }}>{ticket.requesterName}</strong> · {ticket.company}</div>
          <div style={{ color: '#64748b' }}>{ticket.department}</div>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #334155', flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>
          Description
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
          {ticket.description}
        </div>
        {ticket.impact && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#fbbf24' }}>
            Impact: {ticket.impact}
          </div>
        )}
        {ticket.urgency && (
          <div style={{ fontSize: 12, color: '#f87171' }}>
            Urgency: {ticket.urgency}
          </div>
        )}
      </div>

      {/* Notes area */}
      {onNotesChange !== undefined && (
        <div style={{ flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>
            Notes / Ticket Draft
          </div>
          <textarea
            value={notes || ''}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Write your ticket notes here..."
            style={{
              flex: 1, width: '100%', padding: 8, border: '1px solid #334155', borderRadius: 4,
              fontSize: 12, background: '#0f172a', color: '#e2e8f0', resize: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      {/* Bottom actions */}
      {children && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid #334155' }}>
          {children}
        </div>
      )}
    </div>
  );
}
