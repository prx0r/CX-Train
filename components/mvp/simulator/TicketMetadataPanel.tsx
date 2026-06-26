'use client';

import type { TicketData } from './TicketSidePanel';

const severityColors: Record<string, string> = {
  low: '#6f6f6f', medium: '#7a4f00', high: '#9f3a00', critical: '#842029',
};

export default function TicketMetadataPanel({ ticket, claimed, phase }: {
  ticket: TicketData;
  claimed: boolean;
  phase: string;
}) {
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #cfcfcf', flexShrink: 0 }}>
      <div style={{ padding: '12px 14px' }}>
        {/* ID + severity row */}
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
        </div>

        {/* Title */}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 8, lineHeight: 1.3 }}>
          {ticket.title}
        </div>

        {/* Requester info */}
        <div style={{ fontSize: 12, color: '#525252', lineHeight: 1.5, marginBottom: 10 }}>
          <div><strong style={{ color: '#111' }}>{ticket.requesterName}</strong> · {ticket.company}</div>
          <div style={{ color: '#6f6f6f' }}>{ticket.department}</div>
        </div>

        {/* Metadata fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
          <MetadataRow label="Status" value={claimed ? 'In Progress' : ticket.status} />
          <MetadataRow label="Owner" value={claimed ? 'Trainee' : 'Unassigned'} />
          <MetadataRow label="Board" value="Help Desk" />
          <MetadataRow label="SLA" value="Due Today" color={severityColors[ticket.severity]} />
        </div>
      </div>
    </div>
  );
}

function MetadataRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #efefef' }}>
      <span style={{ color: '#6f6f6f', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>{label}</span>
      <span style={{ color: color || '#111', fontWeight: 700, fontSize: 12 }}>{value}</span>
    </div>
  );
}
