'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import CallBar from './CallBar';
import TicketSidePanel from './TicketSidePanel';
import type { TicketData } from './TicketSidePanel';
import WorkArea, { TicketComposerView } from './WorkArea';
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
  const [internalNoteDraft, setInternalNoteDraft] = useState('');
  const [internalNotes, setInternalNotes] = useState<string[]>([]);
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
  const [claimed, setClaimed] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
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

  async function recordUiAction(actionId: string, label: string, eventType: 'action_performed' | 'tool_opened' | 'ticket_note_updated' | 'ui_interaction' = 'action_performed', text?: string) {
    try {
      await fetch(`/api/mvp/assessment/${token}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          tool_id: 'service_desk',
          action_id: actionId,
          label,
          text,
          started_at_ms: Date.now(),
        }),
      });
    } catch {}
  }

  async function recordAppEvent(toolId: string, actionId: string, label: string, eventType = 'ui_interaction') {
    try {
      await fetch(`/api/mvp/assessment/${token}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: eventType,
          tool_id: toolId,
          action_id: actionId,
          label,
          started_at_ms: Date.now(),
        }),
      });
    } catch {}
  }

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
          setPhase('call_active');
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

  async function sendMessage(msg: string, voice?: VoiceTranscriptResult) {
    if (!msg.trim() || sending) return;
    setSending(true);
    setMessages(p => [...p, { role: 'candidate', content: msg }]);
    setCallStatus('thinking');
    const endedAtMs = Date.now();
    const startedAtMs = voice?.durationMs ? Math.max(0, endedAtMs - voice.durationMs) : endedAtMs;
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg, input_source: 'voice',
          started_at_ms: startedAtMs, ended_at_ms: endedAtMs,
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
    await sendMessage(result.text, result);
  }

  async function postInternalNote() {
    const note = internalNoteDraft.trim();
    if (!note) return;
    setInternalNotes(p => [...p, note]);
    setInternalNoteDraft('');
    await recordUiAction('add_internal_note', 'Post internal note', 'ticket_note_updated', note);
    showFeedback('Internal note posted', true);
  }

  function answerCall() {
    if (capabilities.remoteDesktop) {
      handleAction('start_call', 'customer_chat');
      return;
    }
    recordUiAction('start_call', 'Answer customer call');
    setCallStatus('active');
    setPhase('call_active');
    const msg = initialMessages.find(m => m.role === 'caller');
    if (msg) setTimeout(() => speak(msg.content).catch(() => {}), 500);
  }

  function endCall() {
    if (capabilities.remoteDesktop) {
      handleAction('end_call', 'customer_chat');
      return;
    }
    recordUiAction('end_call', 'End customer call');
    setCallStatus('ended');
    setPhase('ticketing');
  }

  function openRemoteDesktop() {
    if (!capabilities.remoteDesktop) return;
    handleAction('remote_connect', 'connectwise');
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
      <div style={{ height: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#2f2f2f', borderRadius: 2, padding: 48, maxWidth: 440, textAlign: 'center', border: '1px solid #4a4a4a' }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: '#4ade80' }}>✓</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', margin: '0 0 8px' }}>Assessment Complete</h2>
          <p style={{ color: '#999', fontSize: 14, margin: 0 }}>Your ticket has been submitted. You may close this window.</p>
        </div>
      </div>
    );
  }

  const safeActions = simData?.safe_actions || [];
  const visibleState = simData?.visible_state || {};
  const priorityColor = ticket.severity === 'high' || ticket.severity === 'critical' ? '#842029' : ticket.severity === 'medium' ? '#7a4f00' : '#525252';
  const modeLabel = assignmentType === 'hiring_exam' ? 'Hiring Exam' : assignmentType === 'training_drill' ? 'Training Drill' : 'Assessment';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#dcdcdc', fontFamily: 'Arial, Helvetica, sans-serif', overflow: 'hidden', color: '#111' }}>
      {/* Top bar */}
      <div style={{ height: 46, background: '#111', borderBottom: '1px solid #000', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 12, flexShrink: 0, zIndex: 200 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid #fff' }} />
          Connexion PSA
        </div>
        <span style={{ fontSize: 11, color: '#dcdcdc', background: '#2f2f2f', padding: '3px 8px', borderRadius: 2, border: '1px solid #4a4a4a' }}>
          {modeLabel}
        </span>
        <span style={{ fontSize: 11, color: '#b8b8b8', borderLeft: '1px solid #555', paddingLeft: 12 }}>Service Board: Help Desk</span>
        <div style={{ flex: 1 }} />
        {autoplayBlocked && (
          <button onClick={() => { const last = [...messages].reverse().find(m => m.role === 'caller'); if (last) speak(last.content).catch(() => {}); }}
            style={{ padding: '4px 10px', background: '#f6e8b1', color: '#111', border: '1px solid #c8b66a', borderRadius: 2, fontSize: 11, cursor: 'pointer' }}>
            Play audio
          </button>
        )}
        {error && <span style={{ fontSize: 11, color: '#ffb4ab', maxWidth: 300 }}>{error}</span>}
      </div>

      {/* Action feedback toast */}
      {actionFeedback && (
        <div style={{
          position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
          padding: '8px 20px', borderRadius: 3, fontSize: 13, fontWeight: 700, maxWidth: 520,
          background: actionFeedback.ok ? '#e8f3ec' : '#fff4f2',
          color: actionFeedback.ok ? '#0f5132' : '#842029',
          border: `1px solid ${actionFeedback.ok ? '#8db99b' : '#d99a91'}`,
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)', pointerEvents: 'none', textAlign: 'center',
        }}>
          {actionFeedback.text}
        </div>
      )}

      {/* Call bar */}
      {capabilities.call && (
        <CallBar
          status={callStatus}
          callerName={ticket.requesterName}
          onStartCall={answerCall}
          onEndCall={endCall}
          micButton={capabilities.voice ? (
            <VoiceRecorderButton token={token} onTranscript={handleVoiceTranscript} disabled={callStatus !== 'active' || ttsPlaying || sending} clickToToggle />
          ) : null}
        />
      )}

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── REMOTED: left panel (ticket + notes + transcript), right fills with remote desktop ── */}
        {phase === 'remote_active' && capabilities.remoteDesktop ? (
          <>
            <div style={{ width: 380, background: '#fff', borderRight: '1px solid #b8b8b8', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
              <TicketSidePanel
                ticket={ticket}
              />
              <div style={{ borderTop: '1px solid #cfcfcf' }} />
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', flex: 1 }}>
                <NotesPanel
                  internalNotes={internalNotes}
                  internalDraft={internalNoteDraft}
                  onInternalDraftChange={setInternalNoteDraft}
                  onPostInternal={postInternalNote}
                  liveNotes={ticketText}
                  onLiveNotesChange={setTicketText}
                />
                <TranscriptToggle
                  visible={showTranscript}
                  onToggle={() => setShowTranscript(p => !p)}
                  messages={messages}
                />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
              <RemoteDesktopPane
                actions={safeActions}
                visibleState={visibleState as Record<string, unknown>}
                onAction={handleAction}
                onRecordInteraction={(id, label) => recordAppEvent('remote_desktop', id, label, 'ui_interaction')}
                disabled={false}
              />
            </div>
          </>
        ) : ticketListView ? (
          /* ── TICKET QUEUE (landing page) ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 18, background: '#dcdcdc' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 2 }}>Service Board</div>
                <div style={{ fontSize: 12, color: '#525252' }}>Queue: Help Desk / New and Active Tickets</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', border: '1px solid #9f9f9f', background: '#f4f4f4' }}>
                {['My Queue', 'Open', 'SLA Risk'].map(label => (
                  <button key={label} style={{ padding: '6px 12px', border: 'none', borderRight: label === 'SLA Risk' ? 'none' : '1px solid #c8c8c8', background: label === 'Open' ? '#fff' : 'transparent', color: '#111', fontSize: 12, fontWeight: 700 }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #9f9f9f', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '116px 88px 1fr 150px 120px 105px 90px',
                padding: '8px 12px', borderBottom: '1px solid #b8b8b8', background: '#efefef',
                fontSize: 11, fontWeight: 700, color: '#222', textTransform: 'uppercase',
              }}>
                <span>Ticket</span>
                <span>Priority</span>
                <span>Summary</span>
                <span>Requester</span>
                <span>Status</span>
                <span>Owner</span>
                <span>SLA</span>
              </div>
              <button
                onClick={() => {
                  setTicketListView(false);
                  if (callStatus === 'idle') setCallStatus('incoming');
                  recordUiAction('open_ticket', 'Open ticket workspace', 'tool_opened');
                }}
                style={{
                  width: '100%', display: 'grid', gridTemplateColumns: '116px 88px 1fr 150px 120px 105px 90px',
                  padding: '9px 12px', border: 'none', borderBottom: '1px solid #e5e5e5',
                  background: '#fff', cursor: 'pointer', textAlign: 'left', alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f2f6fb'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#004b8d', fontWeight: 700 }}>
                  {ticket.id}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: priorityColor }}>{ticket.severity.toUpperCase()}</span>
                <div>
                  <div style={{ fontSize: 13, color: '#111', fontWeight: 700, marginBottom: 2 }}>
                    {ticket.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#525252' }}>Board: Help Desk · Type: Service Request</div>
                </div>
                <span style={{ fontSize: 12, color: '#222' }}>{ticket.requesterName}</span>
                <span style={{ fontSize: 12, color: '#222' }}>{claimed ? 'In Progress' : ticket.status}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: claimed ? '#111' : '#6f6f6f' }}>
                  {claimed ? 'Trainee' : 'Unassigned'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: priorityColor }}>Due Today</span>
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#525252' }}>
              Select the ticket to claim it, review the requester context, and begin work.
            </div>
          </div>
        ) : (
          /* ── NOT REMOTED: full-width ticket detail ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f7f7f7' }}>
            <div style={{ padding: '12px 20px 10px', borderBottom: '1px solid #b8b8b8', flexShrink: 0, background: '#fff' }}>
              <button onClick={() => setTicketListView(true)}
                style={{ background: 'none', border: 'none', color: '#004b8d', cursor: 'pointer', fontSize: 12, padding: 0, marginBottom: 8, display: 'block', fontWeight: 700 }}>
                &larr; Back to service board
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>
                  {ticket.id}
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 700,
                  background: ticket.severity === 'high' || ticket.severity === 'critical' ? '#fff4f2' : '#f6e8b1',
                  border: `1px solid ${ticket.severity === 'high' || ticket.severity === 'critical' ? '#d99a91' : '#c8b66a'}`,
                  color: priorityColor,
                }}>
                  {ticket.severity.toUpperCase()}
                </span>
                <span style={{ fontSize: 11, color: '#525252', marginLeft: 'auto' }}>Status: {claimed ? 'In Progress' : ticket.status}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 6 }}>
                {ticket.title}
              </div>
              <div style={{ fontSize: 13, color: '#525252', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span><strong style={{ color: '#111' }}>{ticket.requesterName}</strong></span>
                <span>·</span>
                <span>{ticket.company}</span>
                <span>·</span>
                <span>{ticket.department}</span>
                <span>·</span>
                <span>Owner: {claimed ? 'Trainee' : 'Unassigned'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => {
                    setClaimed(true);
                    recordUiAction('claim_ticket', 'Claim ticket');
                  }}
                  disabled={claimed}
                  style={{
                    padding: '7px 14px', borderRadius: 3, border: '1px solid #111',
                    background: claimed ? '#efefef' : '#111', color: claimed ? '#525252' : '#fff',
                    fontSize: 12, fontWeight: 700, cursor: claimed ? 'default' : 'pointer',
                  }}
                >
                  {claimed ? 'Claimed' : 'Claim Ticket'}
                </button>
                <button
                  onClick={() => {
                    recordUiAction('write_closure', 'Open closure notes', 'tool_opened');
                    setPhase('ticketing');
                  }}
                  style={{ padding: '7px 14px', borderRadius: 3, border: '1px solid #9f9f9f', background: '#fff', color: '#111', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Write Closure
                </button>
                {capabilities.remoteDesktop && (
                  <button
                    onClick={openRemoteDesktop}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 3,
                      border: '1px solid #9f9f9f',
                      background: '#fff',
                      color: '#111',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Open Remote Desktop
                  </button>
                )}
              </div>
            </div>

            {/* Description / customer message */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #cfcfcf', flexShrink: 0, background: '#f7f7f7' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 180px', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 4 }}>Customer Description</div>
                  <div style={{ fontSize: 13, color: '#222', lineHeight: 1.5, background: '#fff', border: '1px solid #cfcfcf', borderRadius: 3, padding: 10 }}>
                {ticket.description}
                  </div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #cfcfcf', borderRadius: 3, padding: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 6 }}>SLA</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: priorityColor }}>Due Today</div>
                  <div style={{ fontSize: 11, color: '#525252', marginTop: 3 }}>Response target active</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #cfcfcf', borderRadius: 3, padding: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 6 }}>Board</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Help Desk</div>
                  <div style={{ fontSize: 11, color: '#525252', marginTop: 3 }}>{modeLabel}</div>
                </div>
              </div>
            </div>

            {/* Work area content (StartCall, ActiveCall, or Ticketing) */}
            <WorkArea phase={phase}>
              {phase !== 'ticketing' && (
                <TicketWorkbench
                  canRemote={capabilities.remoteDesktop}
                  onOpenRemote={openRemoteDesktop}
                  messages={messages}
                  showTranscript={showTranscript}
                  onToggleTranscript={() => setShowTranscript(p => !p)}
                  internalNotes={internalNotes}
                  internalDraft={internalNoteDraft}
                  onInternalDraftChange={setInternalNoteDraft}
                  onPostInternal={postInternalNote}
                  liveNotes={ticketText}
                  onLiveNotesChange={setTicketText}
                />
              )}

              {phase === 'ticketing' && (
                <TicketComposerView ticketText={ticketText} onTicketChange={setTicketText} onSubmit={submitTicket} disabled={ticketSubmitted} />
              )}
            </WorkArea>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketWorkbench({ canRemote, onOpenRemote, messages, showTranscript, onToggleTranscript, internalNotes, internalDraft, onInternalDraftChange, onPostInternal, liveNotes, onLiveNotesChange }: {
  canRemote: boolean;
  onOpenRemote: () => void;
  messages: Message[];
  showTranscript: boolean;
  onToggleTranscript: () => void;
  internalNotes: string[];
  internalDraft: string;
  onInternalDraftChange: (value: string) => void;
  onPostInternal: () => void;
  liveNotes: string;
  onLiveNotesChange: (value: string) => void;
}) {
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, padding: '12px 20px', minHeight: 0, background: '#f7f7f7' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 12 }}>
        {canRemote && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={onOpenRemote} style={{
              padding: '7px 14px', borderRadius: 3, border: '1px solid #111',
              background: '#111', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              Open Remote Desktop
            </button>
          </div>
        )}
        <NotesPanel
          internalNotes={internalNotes}
          internalDraft={internalDraft}
          onInternalDraftChange={onInternalDraftChange}
          onPostInternal={onPostInternal}
          liveNotes={liveNotes}
          onLiveNotesChange={onLiveNotesChange}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <TranscriptToggle
          visible={showTranscript}
          onToggle={onToggleTranscript}
          messages={messages}
        />
      </div>
    </div>
  );
}

function NotesPanel({ internalNotes, internalDraft, onInternalDraftChange, onPostInternal, liveNotes, onLiveNotesChange }: {
  internalNotes: string[];
  internalDraft: string;
  onInternalDraftChange: (value: string) => void;
  onPostInternal: () => void;
  liveNotes: string;
  onLiveNotesChange: (value: string) => void;
}) {
  const [tab, setTab] = useState<'internal' | 'live'>('internal');

  return (
    <div style={{
      flex: 1, minHeight: 0,
      background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #b8b8b8', flexShrink: 0 }}>
        <button
          onClick={() => setTab('internal')}
          style={{
            flex: 1, padding: '8px 10px', border: 'none', borderBottom: tab === 'internal' ? '2px solid #111' : '2px solid transparent',
            background: tab === 'internal' ? '#fff' : '#f4f4f4',
            fontSize: 11, fontWeight: 700, color: tab === 'internal' ? '#111' : '#6f6f6f',
            cursor: 'pointer', textTransform: 'uppercase',
          }}
        >
          Internal Notes
        </button>
        <button
          onClick={() => setTab('live')}
          style={{
            flex: 1, padding: '8px 10px', border: 'none', borderBottom: tab === 'live' ? '2px solid #111' : '2px solid transparent',
            background: tab === 'live' ? '#fff' : '#f4f4f4',
            fontSize: 11, fontWeight: 700, color: tab === 'live' ? '#111' : '#6f6f6f',
            cursor: 'pointer', textTransform: 'uppercase',
          }}
        >
          Live Notes
        </button>
      </div>

      {tab === 'internal' ? (
        <>
          <div style={{ maxHeight: 160, overflow: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            {internalNotes.map((note, index) => (
              <div key={`${index}-${note.slice(0, 10)}`} style={{ borderLeft: '3px solid #111', background: '#f7f7f7', padding: '6px 8px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', marginBottom: 2 }}>
                  Internal note {index + 1}
                </div>
                <div style={{ fontSize: 12, color: '#111', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{note}</div>
              </div>
            ))}
            {internalNotes.length === 0 && (
              <div style={{ fontSize: 12, color: '#6f6f6f', fontStyle: 'italic', padding: '8px 0' }}>No internal notes posted yet.</div>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderTop: '1px solid #cfcfcf', padding: 8, background: '#fff' }}>
            <textarea
              value={internalDraft}
              onChange={e => onInternalDraftChange(e.target.value)}
              placeholder="Questions to ask, facts to capture, things to check..."
              rows={3}
              style={{
                width: '100%', resize: 'none', border: '1px solid #b8b8b8', borderRadius: 3,
                padding: 8, fontSize: 12, color: '#111', background: '#fff', lineHeight: 1.4,
              }}
            />
            <button
              onClick={onPostInternal}
              disabled={!internalDraft.trim()}
              style={{
                marginTop: 6, padding: '7px 12px', background: '#111', color: '#fff',
                border: '1px solid #111', borderRadius: 3, fontSize: 12, fontWeight: 700,
                cursor: internalDraft.trim() ? 'pointer' : 'default', opacity: internalDraft.trim() ? 1 : 0.45,
              }}
            >
              Post Internal Note
            </button>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #cfcfcf', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', background: '#f4f4f4' }}>
            Ticket / Closure Notes
          </div>
          <textarea
            value={liveNotes}
            onChange={e => onLiveNotesChange(e.target.value)}
            placeholder="Summarize the issue, steps taken, root cause, and next steps.&#10;&#10;Requester:&#10;Issue:&#10;Impact:&#10;Troubleshooting performed:&#10;Resolution or handoff:&#10;Customer confirmation:&#10;Status:"
            style={{
              flex: 1, width: '100%', padding: 10, border: 'none', resize: 'none',
              fontSize: 13, color: '#111', background: '#fff', lineHeight: 1.6,
              fontFamily: 'monospace',
            }}
          />
        </div>
      )}
    </div>
  );
}

function TranscriptToggle({ visible, onToggle, messages }: {
  visible: boolean;
  onToggle: () => void;
  messages: Message[];
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #b8b8b8', borderRadius: 3,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          padding: '8px 10px', border: 'none', background: '#f4f4f4',
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', textAlign: 'left',
        }}
      >
        <span>Call Transcript ({messages.length})</span>
        <span style={{ fontSize: 14 }}>{visible ? '▲' : '▼'}</span>
      </button>
      {visible && (
        <div style={{ maxHeight: 200, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {messages.map((message, index) => {
            const isCandidate = message.role === 'candidate';
            return (
              <div key={`${message.role}-${index}`} style={{
                borderLeft: `3px solid ${isCandidate ? '#111' : '#6f6f6f'}`,
                padding: '5px 8px', background: isCandidate ? '#f7f7f7' : '#fff',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#525252', textTransform: 'uppercase', marginBottom: 2 }}>
                  {isCandidate ? 'Technician' : 'Requester'}
                </div>
                <div style={{ fontSize: 12, color: '#111', lineHeight: 1.45 }}>{message.content}</div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div style={{ fontSize: 12, color: '#6f6f6f', fontStyle: 'italic' }}>No call turns recorded yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
