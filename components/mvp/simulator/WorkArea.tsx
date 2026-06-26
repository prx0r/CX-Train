'use client';

import React from 'react';

type Phase = 'not_started' | 'call_active' | 'remote_active' | 'ticketing' | 'submitted';

export default function WorkArea({ phase, children }: {
  phase: Phase;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: '#0f172a', position: 'relative', overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

export function StartCallView({ onStartCall }: { onStartCall: () => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 12, color: '#525252', padding: 40,
      background: '#f7f7f7',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 4, border: '1px solid #c8c8c8',
        background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 700, color: '#111',
      }}>
        CTI
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
        Work the requester contact
      </div>
      <div style={{ fontSize: 13, color: '#525252', maxWidth: 430, textAlign: 'center', lineHeight: 1.5 }}>
        Review the ticket, claim ownership, then start the customer call from the service desk toolbar.
      </div>
      <button onClick={onStartCall} style={{
        padding: '9px 28px', background: '#111', color: '#fff', border: '1px solid #111',
        borderRadius: 3, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8,
      }}>
        Start Call
      </button>
    </div>
  );
}

export function ActiveCallView({ statusText }: { statusText: string }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, color: '#525252', padding: 40,
      background: '#f7f7f7',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>
        {statusText}
      </div>
      <div style={{ fontSize: 13, maxWidth: 430, textAlign: 'center', lineHeight: 1.5, color: '#525252' }}>
        Capture facts in the work notes while you ask questions and validate the issue.
      </div>
    </div>
  );
}

export function TicketComposerView({ ticketText, onTicketChange, onSubmit, disabled }: {
  ticketText: string;
  onTicketChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 8, background: '#f7f7f7' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Closure Notes</div>
      <div style={{ fontSize: 12, color: '#525252' }}>
        Summarize the issue, steps taken, root cause, and next steps.
      </div>
      <textarea
        value={ticketText}
        onChange={e => onTicketChange(e.target.value)}
        placeholder="Ticket summary&#10;&#10;Requester:&#10;Issue:&#10;Impact:&#10;Troubleshooting performed:&#10;Resolution or handoff:&#10;Customer confirmation:&#10;Status:"
        style={{
          flex: 1, width: '100%', padding: 12, border: '1px solid #b8b8b8', borderRadius: 3,
          fontSize: 13, background: '#fff', color: '#111', resize: 'none',
          fontFamily: 'monospace', lineHeight: 1.6,
        }}
      />
      <button onClick={onSubmit} disabled={disabled || !ticketText.trim()} style={{
        alignSelf: 'flex-end', padding: '8px 24px', background: '#111', color: '#fff',
        border: '1px solid #111', borderRadius: 3, fontSize: 13, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
        opacity: disabled || !ticketText.trim() ? 0.5 : 1,
      }}>
        Submit Ticket
      </button>
    </div>
  );
}
