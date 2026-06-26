'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WindowProvider, useWindowManager } from '@/lib/win11/windowState';
import Desktop from '@/components/win11/Desktop';
import Taskbar from '@/components/win11/Taskbar';
import OutlookWindow from '@/components/win11/tools/OutlookWindow';
import BrowserWindow from '@/components/win11/tools/BrowserWindow';
import CommandPromptWindow from '@/components/win11/tools/CommandPromptWindow';
import CustomerChatWindow from '@/components/win11/tools/CustomerChatWindow';
import TicketWindow from '@/components/win11/tools/TicketWindow';
import { VoiceRecorderButton, type VoiceTranscriptResult } from '@/components/mvp/voice/VoiceRecorderButton';
import { useCustomerAudio } from '@/components/mvp/voice/CustomerAudioPlayer';

interface Message { role: string; content: string; }
interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

const C = {
  sidebar: '#1b2f53', sidebarHover: '#243b64', sidebarActive: '#2a4475',
  topbar: '#f8f9fa', bg: '#f0f2f5', card: '#ffffff', border: '#d8dde3',
  text: '#2c3e50', textMuted: '#7f8c8d', primary: '#1a73e8',
  success: '#27ae60', danger: '#e74c3c', warning: '#f39c12',
  callBanner: '#1a73e8', darkBg: '#0f172a',
};

function SimContent({ token, initialMessages }: { token: string; initialMessages: Message[] }) {
  const { state, open, isOpen } = useWindowManager();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [ticketText, setTicketText] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [simData, setSimData] = useState<any>(null);
  const [phase, setPhase] = useState('not_started');
  const [callActive, setCallActive] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const actionFeedbackTimer = useRef<ReturnType<typeof setTimeout>>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { speak, setOnPlaying, autoplayBlocked } = useCustomerAudio(token);

  useEffect(() => { setOnPlaying(setTtsPlaying); }, [setOnPlaying]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadSim = useCallback(async () => {
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/sim`);
      const d = await res.json();
      if (d.ok) { setSimData(d.data); setPhase(d.data.phase); }
    } catch {}
  }, [token]);

  useEffect(() => {
    loadSim();
    const interval = setInterval(() => {
      if (!document.hidden) loadSim();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadSim]);

  const isRemoted = phase === 'remote_active';
  const initialMessage = initialMessages.find(m => m.role === 'caller');

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
        const resultText = d.data?.last_result || d.data?.result_text || d.data?.observation || '';
        if (resultText) {
          setActionFeedback({ text: resultText, ok: true });
          clearTimeout(actionFeedbackTimer.current);
          actionFeedbackTimer.current = setTimeout(() => setActionFeedback(null), 4000);
        }
        if (actionId === 'start_call') {
          setCallActive(true);
          if (initialMessage) setTimeout(() => speak(initialMessage.content).catch(() => {}), 500);
        }
        if (actionId === 'remote_connect') {
          open('chat', 'Customer Chat', '💬', 'chat');
        }
        if (actionId === 'end_call') setShowTicketForm(true);
      } else {
        const errMsg = d.error || 'Action not available right now';
        setError(errMsg);
        setActionFeedback({ text: errMsg, ok: false });
        clearTimeout(actionFeedbackTimer.current);
        actionFeedbackTimer.current = setTimeout(() => setActionFeedback(null), 4000);
      }
    } catch {
      const errMsg = 'Failed to perform action';
      setError(errMsg);
      setActionFeedback({ text: errMsg, ok: false });
      clearTimeout(actionFeedbackTimer.current);
      actionFeedbackTimer.current = setTimeout(() => setActionFeedback(null), 4000);
    }
  }

  async function sendMessage(msg: string, source?: string, voice?: VoiceTranscriptResult) {
    if (!msg.trim() || sending) return;
    setSending(true);
    setMessages(p => [...p, { role: 'candidate', content: msg }]);
    const startedAtMs = Date.now();
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          input_source: source || 'text',
          started_at_ms: startedAtMs,
          ended_at_ms: Date.now(),
          duration_ms: voice?.durationMs,
          audio_metadata: voice?.metadata,
        }),
      });
      const d = await res.json();
      if (d.reply) {
        setMessages(p => [...p, { role: 'caller', content: d.reply }]);
        speak(d.reply).catch(() => {});
      } else setError(d.error || 'No response');
    } catch { setError('Failed to send message'); }
    setSending(false);
  }

  async function handleVoiceTranscript(result: VoiceTranscriptResult) {
    await sendMessage(result.text, 'voice', result);
  }
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

  const safeActions = simData?.safe_actions || [];
  const safeState = simData?.visible_state?.safe_state || {};
  const safeOutlook = safeState?.outlook as { workOffline?: boolean; outboxCount?: number; sentTestEmail?: boolean } | undefined;

  if (ticketSubmitted) {
    return (
      <div style={{ height: '100vh', background: C.darkBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 48, maxWidth: 440, textAlign: 'center', border: '1px solid #334155' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#4ade80', margin: '0 0 8px' }}>Assessment Complete</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Your ticket has been submitted. You may close this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      {/* ── Top bar ── */}
      <div style={{ height: 44, background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, zIndex: 1000 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#60a5fa', fontSize: 18 }}>◆</span>
          Connexion Service Desk
        </div>
        <div style={{ flex: 1 }} />
        {callActive && !isRemoted && !showTicketForm && (
          <button onClick={() => handleAction('remote_connect', 'connectwise')}
            style={{ padding: '5px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🖥️ Remote into ALDER-LT-023
          </button>
        )}
        {callActive && !showTicketForm && (
          <button onClick={() => handleAction('end_call', 'customer_chat')}
            style={{ padding: '5px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            📞 End Call
          </button>
        )}
        {autoplayBlocked && (
          <button onClick={() => { const last = [...messages].reverse().find(m => m.role === 'caller'); if (last) speak(last.content).catch(() => {}); }}
            style={{ padding: '3px 10px', background: '#fff3cd', color: '#856404', border: '1px solid #ffc107', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
            🔇 Play audio
          </button>
        )}
        <div style={{ fontSize: 11, color: '#64748b' }}>
          {phase === 'not_started' ? '● Ticket Open' : phase === 'call_active' ? '📞 On call' : isRemoted ? '🖥️ Remote: ALDER-LT-023' : phase === 'ticketing' ? '📝 Closing ticket' : ''}
        </div>
      </div>

      {/* ── Action Feedback Toast ── */}
      {actionFeedback && (
        <div style={{
          position: 'fixed', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 99999,
          padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, maxWidth: 520,
          background: actionFeedback.ok ? '#065f46' : '#7f1d1d',
          color: actionFeedback.ok ? '#a7f3d0' : '#fecaca',
          border: `1px solid ${actionFeedback.ok ? '#059669' : '#dc2626'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          pointerEvents: 'none', textAlign: 'center',
        }}>
          {actionFeedback.text}
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── CENTER: Ticket view (always visible) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

          {/* Ticket header */}
          <div style={{ flexShrink: 0, padding: '16px 20px 12px', borderBottom: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: '#1e3a5f', color: '#60a5fa',
              }}>
                INC-002847
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: '#1e3a5f', color: '#fbbf24',
              }}>
                High
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: callActive ? '#064e3b' : '#1e293b', color: callActive ? '#34d399' : '#64748b',
              }}>
                {callActive ? 'In Progress' : 'Open'}
              </span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
              Outlook cannot send emails
            </div>
            <div style={{ display: 'flex', gap: 6, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
              <span>Requester: <strong style={{ color: '#94a3b8' }}>Sarah Thompson</strong></span>
              <span>·</span>
              <span>Company: <strong style={{ color: '#94a3b8' }}>Connexion Dental</strong></span>
              <span>·</span>
              <span>Department: <strong style={{ color: '#94a3b8' }}>Accounts</strong></span>
            </div>
          </div>

          {/* Conversation thread (visible when call started) */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px' }}>
            {!callActive && phase === 'not_started' && !showTicketForm && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', gap: 16 }}>
                <div style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
                  padding: 20, maxWidth: 480, fontSize: 13, lineHeight: 1.5, color: '#cbd5e1',
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>CUSTOMER DESCRIPTION</div>
                  {initialMessage?.content || 'Customer reported an issue with Outlook.'}
                </div>
                <button onClick={() => handleAction('start_call', 'customer_chat')}
                  style={{
                    padding: '10px 28px', background: '#2563eb', color: '#fff', border: 'none',
                    borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                  📞 Start Call with Sarah
                </button>
              </div>
            )}

            {messages.length > 0 && callActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'candidate' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%', padding: '8px 12px', borderRadius: m.role === 'candidate' ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                      fontSize: 13, lineHeight: 1.5,
                      background: m.role === 'candidate' ? '#2563eb' : '#1e293b',
                      color: m.role === 'candidate' ? '#fff' : '#e2e8f0',
                      border: m.role === 'candidate' ? 'none' : '1px solid #334155',
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 1, opacity: 0.7 }}>
                        {m.role === 'candidate' ? 'You' : 'Sarah (Customer)'}
                      </div>
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
                {sending && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Sarah is typing...</div>}
                {error && <div style={{ fontSize: 11, color: '#f87171' }}>{error}</div>}
              </div>
            )}
          </div>

          {/* Input area — visible during call or ticket form */}
          {!showTicketForm && callActive && (
            <div style={{ flexShrink: 0, padding: '8px 20px 12px', borderTop: '1px solid #1e293b', background: '#0f172a' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { sendMessage(input); setInput(''); } }}
                  placeholder="Type a message to Sarah..."
                  style={{
                    flex: 1, padding: '8px 12px', border: '1px solid #334155', borderRadius: 6, fontSize: 13,
                    outline: 'none', background: '#1e293b', color: '#e2e8f0',
                  }} />
                <button onClick={() => { sendMessage(input); setInput(''); }}
                  disabled={sending || !input.trim()}
                  style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: sending || !input.trim() ? 0.6 : 1 }}>
                  Send
                </button>
              </div>
              <VoiceRecorderButton token={token} onTranscript={handleVoiceTranscript} disabled={!callActive || ttsPlaying} clickToToggle />
            </div>
          )}

          {/* Ticket form (after end call) */}
          {showTicketForm && (
            <div style={{ flexShrink: 0, padding: 12, borderTop: '1px solid #1e293b', background: '#0f172a' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Write Closure Ticket</div>
              <textarea value={ticketText} onChange={e => setTicketText(e.target.value)}
                placeholder="User, company, issue, root cause, steps taken, verification, next steps..."
                style={{ width: '100%', minHeight: 120, padding: 10, border: '1px solid #334155', borderRadius: 6, fontSize: 12, resize: 'vertical', background: '#1e293b', color: '#e2e8f0', fontFamily: 'inherit' }} />
              <button onClick={submitTicket} disabled={!ticketText.trim()}
                style={{ marginTop: 6, padding: '6px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Submit Ticket
              </button>
            </div>
          )}

          {/* ── REMOTE DESKTOP OVERLAY ── */}
          {isRemoted && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: C.darkBg, overflow: 'hidden' }}>
              <Desktop />
              {isOpen('chat') && (
                <CustomerChatWindow
                  messages={messages}
                  onSendMessage={(msg: string) => sendMessage(msg, 'text')}
                  sending={sending}
                  disabled={false}
                  voiceButton={
                    <VoiceRecorderButton token={token} onTranscript={handleVoiceTranscript} disabled={ttsPlaying} clickToToggle />
                  }
                />
              )}
              {isOpen('outlook') && (
                <OutlookWindow
                  safeActions={safeActions}
                  visibleState={safeState}
                  onAction={(id: string, tool: string) => handleAction(id, tool)}
                  disabled={false}
                />
              )}
              {isOpen('browser') && (
                <BrowserWindow
                  safeActions={safeActions}
                  onAction={(id: string, tool: string) => handleAction(id, tool)}
                  disabled={false}
                />
              )}
              {isOpen('cmd') && (
                <CommandPromptWindow
                  safeActions={safeActions}
                  onAction={(id: string, tool: string) => handleAction(id, tool)}
                  disabled={false}
                />
              )}
              {isOpen('ticket') && (
                <TicketWindow
                  ticketText={ticketText}
                  onTicketChange={setTicketText}
                  onSubmit={submitTicket}
                  submitted={ticketSubmitted}
                />
              )}
              <Taskbar />
            </div>
          )}
        </div>

        {/* RIGHT: Actions Panel */}
        {callActive && (
          <div style={{ width: 220, background: '#1e293b', borderLeft: '1px solid #334155', display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 500 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #334155', fontWeight: 600, fontSize: 12, color: '#e2e8f0' }}>
              📋 Actions
            </div>
            <div style={{ overflow: 'auto', flex: 1, padding: 6 }}>
              {['outlook', 'browser', 'cmd', 'connectwise', 'control_panel'].map(tool => {
                const toolActions = safeActions.filter((a: SafeAction) => a.tool === tool);
                if (toolActions.length === 0) return null;
                const icons: Record<string, string> = { outlook: '📧', browser: '🌐', cmd: '💻', connectwise: '🔧', control_panel: '⚙️' };
                const labels: Record<string, string> = { outlook: 'Outlook', browser: 'Browser', cmd: 'Terminal', connectwise: 'ConnectWise', control_panel: 'Control Panel' };
                return (
                  <div key={tool} style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b', padding: '2px 6px' }}>
                      {icons[tool]} {labels[tool]}
                    </div>
                    {toolActions.map((a: SafeAction) => (
                      <button key={a.id} onClick={() => handleAction(a.id, a.tool)} style={{
                        width: '100%', textAlign: 'left', padding: '5px 8px', marginBottom: 1,
                        background: a.redFlag ? '#450a0a' : '#1e293b',
                        border: `1px solid ${a.redFlag ? '#7f1d1d' : '#334155'}`, borderRadius: 3, fontSize: 11,
                        cursor: 'pointer', color: a.redFlag ? '#fca5a5' : '#94a3b8',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {a.redFlag ? '⚠ ' : '▶ '}{a.label}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
            {safeOutlook && (
              <div style={{ padding: '8px 12px', borderTop: '1px solid #334155', fontSize: 11, color: '#64748b' }}>
                <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: 2 }}>ALDER-LT-023</div>
                <div>Status: {safeOutlook?.workOffline === false ? '✅ Online' : '🔴 Work Offline'}</div>
                <div>Outbox: {safeOutlook?.outboxCount ?? '—'} msgs</div>
                {safeOutlook?.sentTestEmail && <div style={{ color: '#34d399' }}>✓ Test email sent</div>}
              </div>
            )}
          </div>
        )}

        {/* LEFT sidebar placeholder — pre-call only */}
        {!callActive && !isRemoted && (
          <div style={{ width: 200, background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 500 }}>
            <div style={{ padding: '12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#475569' }}>Navigation</div>
            {[{ icon: '🎫', label: 'Incidents', active: true }, { icon: '🏠', label: 'Dashboard' }, { icon: '📚', label: 'Knowledge Base' }].map(item => (
              <div key={item.label} style={{
                padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                background: item.active ? '#334155' : 'transparent',
                borderLeft: item.active ? '3px solid #60a5fa' : '3px solid transparent',
                color: item.active ? '#f1f5f9' : '#64748b', cursor: 'default',
              }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ItsmCandidateShell({ token, initialMessages }: { token: string; initialMessages: Message[] }) {
  return (
    <WindowProvider>
      <SimContent token={token} initialMessages={initialMessages} />
    </WindowProvider>
  );
}
