'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import CallBar from './CallBar';
import TicketSidePanel from './TicketSidePanel';
import type { TicketData } from './TicketSidePanel';
import WorkArea, { StartCallView, ActiveCallView, TicketComposerView } from './WorkArea';
import RemoteDesktopPane from './RemoteDesktopPane';
import { VoiceRecorderButton, type VoiceTranscriptResult } from '@/components/mvp/voice/VoiceRecorderButton';
import { useCustomerAudio } from '@/components/mvp/voice/CustomerAudioPlayer';
import type { SimulatorCapabilities } from '@/lib/mvp/assignment-types';

type Message = { role: string; content: string };
type CallStatus = 'idle' | 'incoming' | 'active' | 'thinking' | 'speaking' | 'recording' | 'ended';
type Phase = 'not_started' | 'call_active' | 'remote_active' | 'ticketing' | 'submitted';
interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

export interface ShellProps {
  token: string;
  assignmentType: string;
  capabilities: SimulatorCapabilities;
  initialMessages: Message[];
  ticket: TicketData;
}

export default function ServiceDeskSimulatorShell({ token, assignmentType, capabilities, initialMessages, ticket }: ShellProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [ticketText, setTicketText] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [simData, setSimData] = useState<{ safe_actions: SafeAction[]; visible_state: Record<string, unknown>; phase: string; timeline: unknown[] } | null>(null);
  const [phase, setPhase] = useState<Phase>('not_started');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [ticketListView, setTicketListView] = useState(true);
  const actionFeedbackTimer = useRef<ReturnType<typeof setTimeout>>();
  const { speak, setOnPlaying, autoplayBlocked } = useCustomerAudio(token);

  useEffect(() => { setOnPlaying(setTtsPlaying); }, [setOnPlaying]);

  const loadSim = useCallback(async () => {
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/sim`);
      const d = await res.json();
      if (d.ok) {
        setSimData(d.data);
        setPhase(d.data.phase || 'not_started');
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    if (capabilities.remoteDesktop) {
      loadSim();
      const interval = setInterval(() => { if (!document.hidden) loadSim(); }, 10000);
      return () => clearInterval(interval);
    }
  }, [loadSim, capabilities.remoteDesktop]);

  const showFeedback = (text: string, ok: boolean) => {
    setActionFeedback({ text, ok });
    clearTimeout(actionFeedbackTimer.current);
    actionFeedbackTimer.current = setTimeout(() => setActionFeedback(null), 4000);
  };

  async function handleAction(actionId: string, toolId: string) {
    setError('');
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/sim/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, tool_id: toolId, started_at_ms: Date.now() }),
      });
      const d = await res.json();
      if (d.ok) {
        setSimData(d.data);
        setPhase(d.data.phase);
        const resultText = d.data?.event?.result_text || d.data?.result_text || '';
        if (resultText) showFeedback(resultText, true);
        if (actionId === 'start_call') {
          setCallStatus('active');
          const msg = initialMessages.find(m => m.role === 'caller');
          if (msg) setTimeout(() => speak(msg.content).catch(() => {}), 500);
        }
        if (actionId === 'end_call') setPhase('ticketing');
      } else {
        const errMsg = d.error || 'Action not available';
        setError(errMsg);
        showFeedback(errMsg, false);
      }
    } catch {
      const errMsg = 'Failed to perform action';
      setError(errMsg);
      showFeedback(errMsg, false);
    }
  }

  async function sendMessage(msg: string, source?: string, voice?: VoiceTranscriptResult) {
    if (!msg.trim() || sending) return;
    setSending(true);
    setMessages(p => [...p, { role: 'candidate', content: msg }]);
    setCallStatus('thinking');
    const startedAtMs = Date.now();
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg, input_source: source || 'text',
          started_at_ms: startedAtMs, ended_at_ms: Date.now(),
          duration_ms: voice?.durationMs, audio_metadata: voice?.metadata,
        }),
      });
      const d = await res.json();
      if (d.reply) {
        setMessages(p => [...p, { role: 'caller', content: d.reply }]);
        setCallStatus('speaking');
        speak(d.reply).catch(() => {});
      } else setError(d.error || 'No response');
    } catch { setError('Failed to send message'); }
    setSending(false);
  }

  async function handleVoiceTranscript(result: VoiceTranscriptResult) {
    await sendMessage(result.text, 'voice', result);
  }

  const handleTtsEnded = useCallback(() => {
    setCallStatus('active');
  }, []);

  useEffect(() => {
    if (callStatus === 'speaking') {
      const timer = setTimeout(handleTtsEnded, 1000);
      return () => clearTimeout(timer);
    }
  }, [callStatus, handleTtsEnded]);

  async function submitTicket() {
    if (!ticketText.trim()) return;
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/ticket`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: ticketText.trim() }),
      });
      const d = await res.json();
      if (d.status === 'completed') setTicketSubmitted(true);
      else setError(d.error || 'Failed to submit ticket');
    } catch { setError('Failed to submit ticket'); }
  }

  if (ticketSubmitted) {
    return (
      <div style={{ height: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 48, maxWidth: 440, textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', margin: '0 0 8px' }}>Assessment Complete</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Your ticket has been submitted. You may close this window.</p>
        </div>
      </div>
    );
  }

  const safeActions = simData?.safe_actions || [];
  const visibleState = simData?.visible_state || {};

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ height: 44, background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0, zIndex: 200 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#60a5fa', fontSize: 18 }}>◆</span>
          Connexion Service Desk
        </div>
        <span style={{ fontSize: 11, color: '#64748b', background: '#334155', padding: '2px 8px', borderRadius: 4 }}>
          {assignmentType === 'hiring_exam' ? 'Hiring Exam' : assignmentType === 'training_drill' ? 'Training Drill' : 'Assessment'}
        </span>
        <div style={{ flex: 1 }} />
        {autoplayBlocked && (
          <button onClick={() => { const last = [...messages].reverse().find(m => m.role === 'caller'); if (last) speak(last.content).catch(() => {}); }}
            style={{ padding: '3px 10px', background: '#fff3cd', color: '#856404', border: '1px solid #ffc107', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
            🔇 Play audio
          </button>
        )}
        {error && <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>}
      </div>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div style={{
          position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
          padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, maxWidth: 520,
          background: actionFeedback.ok ? '#065f46' : '#7f1d1d',
          color: actionFeedback.ok ? '#a7f3d0' : '#fecaca',
          border: `1px solid ${actionFeedback.ok ? '#059669' : '#dc2626'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', pointerEvents: 'none', textAlign: 'center',
        }}>
          {actionFeedback.text}
        </div>
      )}

      {/* Call bar */}
      {capabilities.call && (
        <CallBar
          status={callStatus}
          callerName={ticket.requesterName}
          onStartCall={capabilities.remoteDesktop ? () => handleAction('start_call', 'customer_chat') : () => {
            setCallStatus('active');
            const msg = initialMessages.find(m => m.role === 'caller');
            if (msg) setTimeout(() => speak(msg.content).catch(() => {}), 500);
          }}
          onEndCall={capabilities.remoteDesktop ? () => handleAction('end_call', 'customer_chat') : () => setPhase('ticketing')}
          micButton={
            <VoiceRecorderButton token={token} onTranscript={handleVoiceTranscript} disabled={callStatus !== 'active' && callStatus !== 'thinking' && callStatus !== 'speaking' || ttsPlaying} clickToToggle />
          }
        />
      )}

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── REMOTED: split layout (ticket left, remote right) ── */}
        {phase === 'remote_active' && capabilities.remoteDesktop ? (
          <>
            <TicketSidePanel
              ticket={ticket}
              notes={ticketText}
              onNotesChange={setTicketText}
            />
            <div style={{ flex: 1, display: 'flex' }}>
              <RemoteDesktopPane
                actions={safeActions}
                visibleState={visibleState as Record<string, unknown>}
                onAction={handleAction}
                disabled={false}
              />
              <div style={{ width: 200, background: '#1e293b', borderLeft: '1px solid #334155', padding: 8, overflow: 'auto' }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#64748b', padding: '4px 6px', marginBottom: 4 }}>
                  Quick Actions
                </div>
                {safeActions.filter(a => a.tool === 'connectwise' || a.tool === 'control_panel' || a.tool === 'customer_chat').map(a => (
                  <button key={a.id} onClick={() => handleAction(a.id, a.tool)} style={{
                    width: '100%', textAlign: 'left', padding: '5px 8px', marginBottom: 2,
                    background: a.redFlag ? '#450a0a' : '#1e293b',
                    border: `1px solid ${a.redFlag ? '#7f1d1d' : '#334155'}`, borderRadius: 3, fontSize: 11,
                    cursor: 'pointer', color: a.redFlag ? '#fca5a5' : '#94a3b8',
                  }}>
                    {a.redFlag ? '⚠ ' : ''}{a.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : ticketListView ? (
          /* ── TICKET QUEUE (landing page) ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>
              Service Desk — Open Tickets
            </div>
            <div style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 8, overflow: 'hidden',
            }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '100px 1fr 120px 100px',
                padding: '10px 16px', borderBottom: '1px solid #334155',
                fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase',
              }}>
                <span>Ticket</span>
                <span>Subject</span>
                <span>Status</span>
                <span>Priority</span>
              </div>
              {/* Ticket row */}
              <button
                onClick={() => setTicketListView(false)}
                style={{
                  width: '100%', display: 'grid', gridTemplateColumns: '100px 1fr 120px 100px',
                  padding: '12px 16px', border: 'none', borderBottom: '1px solid #1e293b',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#334155'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#60a5fa', fontWeight: 600 }}>
                  {ticket.id}
                </span>
                <div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, marginBottom: 2 }}>
                    {ticket.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {ticket.requesterName} · {ticket.company}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{ticket.status}</span>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: ticket.severity === 'high' || ticket.severity === 'critical' ? '#f87171' : '#eab308',
                }}>
                  {ticket.severity.toUpperCase()}
                </span>
              </button>
            </div>
            <div style={{ marginTop: 24, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
              Click a ticket to view details and start working.
            </div>
          </div>
        ) : (
          /* ── NOT REMOTED: full-width ticket detail ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Ticket detail header with back button */}
            <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
              <button onClick={() => setTicketListView(true)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, padding: 0, marginBottom: 8, display: 'block' }}>
                ← Back to ticket list
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'monospace' }}>
                  {ticket.id}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  background: ticket.severity === 'high' || ticket.severity === 'critical' ? '#450a0a' : '#1e3a5f',
                  color: ticket.severity === 'high' || ticket.severity === 'critical' ? '#fca5a5' : '#60a5fa',
                }}>
                  {ticket.severity.toUpperCase()}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>{ticket.status}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 6 }}>
                {ticket.title}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span><strong style={{ color: '#cbd5e1' }}>{ticket.requesterName}</strong></span>
                <span>·</span>
                <span>{ticket.company}</span>
                <span>·</span>
                <span>{ticket.department}</span>
              </div>
            </div>

            {/* Description / customer message */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>Customer Description</div>
              <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, background: '#1e293b', borderRadius: 6, padding: 12 }}>
                {ticket.description}
              </div>
            </div>

            {/* Work area content (StartCall, ActiveCall, or Ticketing) */}
            <WorkArea phase={phase}>
              {phase === 'not_started' && callStatus === 'idle' && (
                <StartCallView onStartCall={capabilities.remoteDesktop ? () => handleAction('start_call', 'customer_chat') : () => {
                  setCallStatus('active');
                  const msg = initialMessages.find(m => m.role === 'caller');
                  if (msg) setTimeout(() => speak(msg.content).catch(() => {}), 500);
                }} />
              )}

              {(phase === 'call_active' || (phase === 'not_started' && callStatus !== 'idle')) && (
                <>
                  {capabilities.remoteDesktop ? (
                    <div style={{ flex: 1, display: 'flex', padding: '0 24px', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <RemoteDesktopPane
                          actions={safeActions}
                          visibleState={visibleState as Record<string, unknown>}
                          onAction={handleAction}
                          disabled={false}
                        />
                      </div>
                      <div style={{ width: 200, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: 8, overflow: 'auto' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#64748b', padding: '4px 6px', marginBottom: 4 }}>
                          Quick Actions
                        </div>
                        {safeActions.filter(a => a.tool === 'connectwise' || a.tool === 'control_panel').map(a => (
                          <button key={a.id} onClick={() => handleAction(a.id, a.tool)} style={{
                            width: '100%', textAlign: 'left', padding: '5px 8px', marginBottom: 2,
                            background: a.redFlag ? '#450a0a' : '#1e293b',
                            border: `1px solid ${a.redFlag ? '#7f1d1d' : '#334155'}`, borderRadius: 3, fontSize: 11,
                            cursor: 'pointer', color: a.redFlag ? '#fca5a5' : '#94a3b8',
                          }}>
                            {a.redFlag ? '⚠ ' : ''}{a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ActiveCallView statusText={`On call with ${ticket.requesterName}`} />
                  )}
                </>
              )}

              {phase === 'ticketing' && (
                <TicketComposerView ticketText={ticketText} onTicketChange={setTicketText} onSubmit={submitTicket} disabled={ticketSubmitted} />
              )}
            </WorkArea>

            {/* Notes / ticket draft area */}
            {phase !== 'ticketing' && phase !== 'submitted' && (
              <div style={{ flexShrink: 0, padding: '12px 24px 16px', borderTop: '1px solid #1e293b', background: '#0f172a' }}>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>
                  Ticket Notes / Draft
                </div>
                <textarea
                  value={ticketText}
                  onChange={e => setTicketText(e.target.value)}
                  placeholder="Write your ticket notes here..."
                  rows={3}
                  style={{
                    width: '100%', padding: 10, border: '1px solid #334155', borderRadius: 6,
                    fontSize: 13, background: '#1e293b', color: '#e2e8f0', resize: 'vertical',
                    fontFamily: 'inherit', lineHeight: 1.5,
                  }}
                />
                {phase === 'call_active' && callStatus !== 'idle' && (
                  <button onClick={() => handleAction('end_call', 'customer_chat')} style={{
                    marginTop: 8, padding: '6px 16px', background: '#dc2626', color: '#fff',
                    border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                    End Call & Submit Ticket
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
