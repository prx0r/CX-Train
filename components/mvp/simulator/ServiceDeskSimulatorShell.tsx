'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import CallBar from './CallBar';
import TicketSidePanel from './TicketSidePanel';
import type { TicketData } from './TicketSidePanel';
import WorkArea from './WorkArea';
import RemoteDesktopPane from './RemoteDesktopPane';
import TicketMetadataPanel from './TicketMetadataPanel';
import TicketTriagePanel from './TicketTriagePanel';
import type { TicketTriageState } from './TicketTriagePanel';
import TicketNotesPanel from './TicketNotesPanel';
import { VoiceRecorderButton, type VoiceTranscriptResult } from '@/components/mvp/voice/VoiceRecorderButton';
import { useCustomerAudio } from '@/components/mvp/voice/CustomerAudioPlayer';
import type { SimulatorCapabilities } from '@/lib/mvp/assignment-types';
import { DEFAULT_TICKET_TAXONOMY } from '@/lib/mvp/taxonomy/defaultTicketTaxonomy';
import type { ManagerTicketTaxonomy } from './TicketTriagePanel';

type Message = { role: string; content: string };
type CallStatus = 'idle' | 'incoming' | 'active' | 'thinking' | 'speaking' | 'recording' | 'ended';
type Phase = 'not_started' | 'call_active' | 'remote_active' | 'ticketing' | 'submitted';
type NoteTab = 'internal' | 'live';
interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

export interface ShellProps {
  token: string;
  assignmentType: string;
  capabilities: SimulatorCapabilities;
  initialMessages: Message[];
  ticket: TicketData;
}

const initialTriageState: TicketTriageState = {
  claimed: false,
  status: 'open',
};

export default function ServiceDeskSimulatorShell({ token, assignmentType, capabilities, initialMessages, ticket }: ShellProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [internalNotes, setInternalNotes] = useState<string[]>([]);
  const [liveNotes, setLiveNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [activeNoteTab, setActiveNoteTab] = useState<NoteTab>('internal');
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
  const [triageState, setTriageState] = useState<TicketTriageState>(initialTriageState);
  const actionFeedbackTimer = useRef<ReturnType<typeof setTimeout>>();
  const { speak, setOnPlaying, autoplayBlocked } = useCustomerAudio(token);
  const [taxonomy, setTaxonomy] = useState<ManagerTicketTaxonomy>(DEFAULT_TICKET_TAXONOMY);

  const triageSubmitted = !!triageState.submittedAt;

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

  /* Load ticket taxonomy from uploaded Master Triage Classification, fall back to defaults */
  useEffect(() => {
    fetch('/api/mvp/taxonomy/ticket-taxonomy')
      .then(r => r.json())
      .then(data => {
        if (data.typeOptions && data.typeOptions.length > 0) {
          setTaxonomy(data as ManagerTicketTaxonomy);
        }
      })
      .catch(() => {});
  }, []);

  const showFeedback = (text: string, ok: boolean) => {
    setActionFeedback({ text, ok });
    clearTimeout(actionFeedbackTimer.current);
    actionFeedbackTimer.current = setTimeout(() => setActionFeedback(null), 4000);
  };

  async function recordUiAction(actionId: string, label: string, eventType: string = 'action_performed', text?: string, extra?: Record<string, unknown>) {
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
          ...extra,
          started_at_ms: Date.now(),
        }),
      });
    } catch {}
  }

  async function recordTriageEvent(eventType: string, field: string, oldVal: unknown, newVal: unknown) {
    await recordUiAction(field, `Set ${field} to ${newVal}`, eventType, undefined, {
      field, old_value: oldVal, new_value: newVal,
      taxonomy_tags: [`ticket.${field}_set`],
    });
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
        if (actionId === 'end_call') {
          setPhase('ticketing');
        }
        if (actionId === 'remote_disconnect') {
          setTicketListView(false);
        }
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

  async function postActiveNote() {
    const text = noteDraft.trim();
    if (!text) return;
    if (activeNoteTab === 'internal') {
      setInternalNotes(p => [...p, text]);
      await recordUiAction('add_internal_note', 'Post internal note', 'internal_note_posted', text);
    } else {
      setLiveNotes(p => [...p, text]);
      await recordUiAction('add_live_note', 'Post live note', 'live_note_posted', text);
    }
    setNoteDraft('');
    showFeedback(activeNoteTab === 'internal' ? 'Internal note posted' : 'Live note posted', true);
  }

  function answerCall() {
    if (capabilities.remoteDesktop) {
      handleAction('start_call', 'customer_chat');
      return;
    }
    recordUiAction('start_call', 'Answer customer call', 'tool_opened');
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
    recordUiAction('end_call', 'End customer call', 'tool_opened');
    setCallStatus('ended');
    setPhase('ticketing');
  }

  function openRemoteDesktop() {
    if (!capabilities.remoteDesktop) return;
    handleAction('remote_connect', 'connectwise');
  }

  function disconnectRemoteDesktop() {
    if (!capabilities.remoteDesktop) return;
    handleAction('remote_disconnect', 'connectwise');
  }

  function handleClaim() {
    if (claimed) return;
    setClaimed(true);
    setTriageState(s => ({ ...s, claimed: true }));
    recordUiAction('claim_ticket', 'Claim ticket', 'ticket_claimed');
    showFeedback('Ticket claimed', true);
  }

  function handleTriageChange(update: Partial<TicketTriageState>) {
    const oldState = triageState;
    const newState = { ...triageState, ...update };
    setTriageState(newState);

    if (update.status !== undefined && update.status !== oldState.status) {
      recordTriageEvent('ticket_status_updated', 'status', oldState.status, update.status);
    }
    if (update.typeId !== undefined && update.typeId !== oldState.typeId) {
      recordTriageEvent('ticket_type_set', 'type', oldState.typeId, update.typeId);
    }
    if (update.categoryId !== undefined && update.categoryId !== oldState.categoryId) {
      recordTriageEvent('ticket_category_set', 'category', oldState.categoryId, update.categoryId);
    }
    if (update.subcategoryId !== undefined && update.subcategoryId !== oldState.subcategoryId) {
      recordTriageEvent('ticket_subcategory_set', 'subcategory', oldState.subcategoryId, update.subcategoryId);
    }
    if (update.itemId !== undefined && update.itemId !== oldState.itemId) {
      recordTriageEvent('ticket_item_set', 'item', oldState.itemId, update.itemId);
    }
    if (update.impactId !== undefined && update.impactId !== oldState.impactId) {
      recordTriageEvent('ticket_impact_set', 'impact', oldState.impactId, update.impactId);
    }
    if (update.urgencyId !== undefined && update.urgencyId !== oldState.urgencyId) {
      recordTriageEvent('ticket_urgency_set', 'urgency', oldState.urgencyId, update.urgencyId);
    }
    if (update.priorityId !== undefined && update.priorityId !== oldState.priorityId) {
      recordTriageEvent('ticket_priority_set', 'priority', oldState.priorityId, update.priorityId);
    }
  }

  async function handleTriageSubmit() {
    setTriageState(s => ({ ...s, submittedAt: new Date().toISOString() }));
    await recordUiAction('submit_triage', 'Submit ticket triage', 'ticket_triage_submitted', undefined, {
      triage: triageState,
      taxonomy_tags: ['ticket.triage_submitted', 'ticket.classification_completed', 'ticket.priority_set', 'ticket.urgency_set'],
    });
    showFeedback('Triage submitted', true);
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
        {ticketListView ? (
          /* ── TICKET QUEUE ── */
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
                  if (callStatus === 'idle' && phase === 'not_started') setCallStatus('incoming');
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
          /* ── TICKET DETAIL (two-column layout) ── */
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left column: metadata + triage */}
            <div style={{ width: 320, background: '#fff', borderRight: '1px solid #b8b8b8', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <button onClick={() => setTicketListView(true)}
                  style={{ background: 'none', border: 'none', color: '#004b8d', cursor: 'pointer', fontSize: 11, padding: '8px 14px', display: 'block', fontWeight: 700, textAlign: 'left' }}>
                  &larr; Back to service board
                </button>
                <TicketMetadataPanel ticket={ticket} claimed={claimed} phase={phase} />

                {/* Action buttons */}
                <div style={{ padding: '8px 14px', borderBottom: '1px solid #cfcfcf', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={handleClaim}
                    disabled={claimed}
                    style={{
                      padding: '6px 12px', borderRadius: 3, border: '1px solid #111',
                      background: claimed ? '#efefef' : '#111', color: claimed ? '#525252' : '#fff',
                      fontSize: 11, fontWeight: 700, cursor: claimed ? 'default' : 'pointer',
                    }}
                  >
                    {claimed ? 'Claimed' : 'Claim Ticket'}
                  </button>
                  {!triageSubmitted && capabilities.remoteDesktop && (
                    <button
                      onClick={openRemoteDesktop}
                      style={{
                        padding: '6px 12px', borderRadius: 3, border: '1px solid #9f9f9f',
                        background: '#fff', color: '#111', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Open Remote Desktop
                    </button>
                  )}
                  {phase === 'ticketing' && (
                    <button
                      onClick={submitTicket}
                      disabled={!ticketText.trim() || ticketSubmitted}
                      style={{
                        padding: '6px 12px', borderRadius: 3, border: '1px solid #111',
                        background: ticketText.trim() && !ticketSubmitted ? '#111' : '#efefef',
                        color: ticketText.trim() && !ticketSubmitted ? '#fff' : '#525252',
                        fontSize: 11, fontWeight: 700,
                        cursor: ticketText.trim() && !ticketSubmitted ? 'pointer' : 'default',
                      }}
                    >
                      {ticketSubmitted ? 'Submitted' : 'Submit Ticket'}
                    </button>
                  )}
                </div>

                <TicketTriagePanel
                  taxonomy={taxonomy}
                  triageState={triageState}
                  onTriageChange={handleTriageChange}
                  onSubmit={handleTriageSubmit}
                  disabled={triageSubmitted}
                />

                {/* Notes panel in left column when remote is active */}
                {phase === 'remote_active' && capabilities.remoteDesktop && (
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 200 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={disconnectRemoteDesktop} style={{
                        flex: 1, padding: '5px 10px', borderRadius: 3, border: '1px solid #9f9f9f',
                        background: '#fff', color: '#111', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      }}>
                        Disconnect Remote Desktop
                      </button>
                    </div>
                    <TicketNotesPanel
                      activeTab={activeNoteTab}
                      onTabChange={setActiveNoteTab}
                      internalNotes={internalNotes}
                      liveNotes={liveNotes}
                      draft={noteDraft}
                      onDraftChange={setNoteDraft}
                      onSubmit={postActiveNote}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right column: work area (description + notes + remote desktop) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {phase === 'remote_active' && capabilities.remoteDesktop ? (
                <div style={{ flex: 1, display: 'flex' }}>
                  <RemoteDesktopPane
                    actions={safeActions}
                    visibleState={visibleState as Record<string, unknown>}
                    onAction={handleAction}
                    onRecordInteraction={(id, label) => recordAppEvent('remote_desktop', id, label, 'ui_interaction')}
                    disabled={false}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f7f7f7' }}>
                  {/* Customer description */}
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid #cfcfcf', flexShrink: 0, background: '#fff' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 4 }}>Customer Description</div>
                    <div style={{ fontSize: 13, color: '#222', lineHeight: 1.5 }}>{ticket.description}</div>
                  </div>

                  {/* Notes + transcript */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px', minHeight: 0, overflow: 'hidden', background: '#f7f7f7' }}>
                    <TicketNotesPanel
                      activeTab={activeNoteTab}
                      onTabChange={setActiveNoteTab}
                      internalNotes={internalNotes}
                      liveNotes={liveNotes}
                      draft={noteDraft}
                      onDraftChange={setNoteDraft}
                      onSubmit={postActiveNote}
                    />
                    <div style={{ flexShrink: 0 }}>
                      <CallTranscriptPanel
                        visible={showTranscript}
                        onToggle={() => setShowTranscript(p => !p)}
                        messages={messages}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CallTranscriptPanel({ visible, onToggle, messages }: {
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
