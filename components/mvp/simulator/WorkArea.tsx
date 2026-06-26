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
      justifyContent: 'center', gap: 16, color: '#64748b', padding: 40,
    }}>
      <div style={{ fontSize: 48 }}>📞</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
        Ready for the call
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 360, textAlign: 'center', lineHeight: 1.5 }}>
        Review the ticket details on the left, then start the call when you are ready.
      </div>
      <button onClick={onStartCall} style={{
        padding: '10px 32px', background: '#22c55e', color: '#fff', border: 'none',
        borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8,
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
      justifyContent: 'center', gap: 12, color: '#94a3b8', padding: 40,
    }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0' }}>
        {statusText}
      </div>
      <div style={{ fontSize: 13, maxWidth: 400, textAlign: 'center', lineHeight: 1.5, color: '#64748b' }}>
        Use the call bar at the top to speak with the customer. Available actions are on the right panel.
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Write Closure Ticket</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>
        Summarize the issue, steps taken, root cause, and next steps.
      </div>
      <textarea
        value={ticketText}
        onChange={e => onTicketChange(e.target.value)}
        placeholder="INC-002847 — Outlook Work Offline&#10;&#10;User: Sarah Thompson, Connexion Dental&#10;Issue: Outlook stuck in Work Offline mode&#10;Root cause: Work Offline was enabled&#10;Resolution: Disabled Work Offline, cleared Outbox (3 messages), sent test email — confirmed received&#10;Status: Resolved"
        style={{
          flex: 1, width: '100%', padding: 12, border: '1px solid #334155', borderRadius: 6,
          fontSize: 13, background: '#1e293b', color: '#e2e8f0', resize: 'none',
          fontFamily: 'monospace', lineHeight: 1.6,
        }}
      />
      <button onClick={onSubmit} disabled={disabled || !ticketText.trim()} style={{
        alignSelf: 'flex-end', padding: '8px 24px', background: '#059669', color: '#fff',
        border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
        opacity: disabled || !ticketText.trim() ? 0.5 : 1,
      }}>
        Submit Ticket
      </button>
    </div>
  );
}
