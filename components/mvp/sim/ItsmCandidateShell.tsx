'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceRecorderButton } from '@/components/mvp/voice/VoiceRecorderButton';
import { useCustomerAudio } from '@/components/mvp/voice/CustomerAudioPlayer';

interface Message {
  role: string;
  content: string;
}

interface SafeAction {
  id: string;
  tool: string;
  label: string;
  redFlag?: boolean;
}

interface SimData {
  tools: string[];
  safe_actions: SafeAction[];
  visible_state: { phase: string; safe_state: Record<string, unknown> };
  phase: string;
  timeline: { sequence: number; event_type: string; actor: string; formatted_time: string; label: string | null; result_text: string | null; is_red_flag: boolean }[];
}

const COLORS = {
  sidebar: '#1b2f53',
  sidebarHover: '#243b64',
  sidebarActive: '#2a4475',
  topbar: '#f8f9fa',
  bg: '#f0f2f5',
  card: '#ffffff',
  border: '#d8dde3',
  text: '#2c3e50',
  textMuted: '#7f8c8d',
  primary: '#1a73e8',
  success: '#27ae60',
  danger: '#e74c3c',
  warning: '#f39c12',
  callBanner: '#1a73e8',
};

export default function ItsmCandidateShell({ token, initialMessages }: { token: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [ticketText, setTicketText] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [simData, setSimData] = useState<SimData | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [phase, setPhase] = useState('not_started');
  const [incomingCall, setIncomingCall] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { speak, setOnPlaying } = useCustomerAudio(token);

  useEffect(() => { setOnPlaying(setTtsPlaying); }, [setOnPlaying]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadSim = useCallback(async () => {
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/sim`);
      const data = await res.json();
      if (data.ok) {
        setSimData(data.data);
        setPhase(data.data.phase);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    loadSim();
    const interval = setInterval(loadSim, 3000);
    return () => clearInterval(interval);
  }, [loadSim]);

  /* ── Incoming call simulation ── */
  useEffect(() => {
    if (phase === 'not_started' && !incomingCall) {
      const timer = setTimeout(() => setIncomingCall(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, incomingCall]);

  async function handleAction(actionId: string, toolId: string) {
    setError('');
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/sim/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, tool_id: toolId, started_at_ms: Date.now() }),
      });
      const data = await res.json();
      if (data.ok) {
        setSimData(data.data);
        setPhase(data.data.phase);
        if (actionId === 'start_call') {
          setCallActive(true);
          setIncomingCall(false);
        }
      } else setError(data.error || 'Action failed');
    } catch { setError('Failed to perform action'); }
  }

  async function sendMessage(msg: string, inputSource?: string) {
    if (!msg.trim() || sending) return;
    setSending(true);
    setMessages(prev => [...prev, { role: 'candidate', content: msg }]);
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, input_source: inputSource || 'text', started_at_ms: Date.now() }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'caller', content: data.reply }]);
        speak(data.reply).catch(() => {});
      } else setError(data.error || 'No response');
    } catch { setError('Failed to send message'); }
    setSending(false);
  }

  async function handleVoiceTranscript(transcript: string) {
    await sendMessage(transcript, 'voice');
  }

  async function submitTicket() {
    if (!ticketText.trim()) return;
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: ticketText.trim() }),
      });
      const data = await res.json();
      if (data.status === 'completed') setTicketSubmitted(true);
      else setError(data.error || 'Failed to submit ticket');
    } catch { setError('Failed to submit ticket'); }
  }

  const safeActions = simData?.safe_actions || [];
  const safeState = simData?.visible_state?.safe_state || {};
  const safeOutlook = safeState?.outlook as { workOffline?: boolean; outboxCount?: number; sentTestEmail?: boolean } | undefined;

  if (ticketSubmitted) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: COLORS.card, borderRadius: 8, padding: 40, maxWidth: 440, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.success, marginBottom: 8 }}>Ticket Submitted</h2>
          <p style={{ color: COLORS.textMuted, fontSize: 14 }}>Your assessment is complete. You may close this window.</p>
        </div>
      </div>
    );
  }

  const healthBarWidth = safeOutlook?.workOffline === false ? '100%' : '30%';
  const healthBarColor = safeOutlook?.workOffline === false ? COLORS.success : COLORS.warning;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: COLORS.bg, fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      {/* ── Top bar ── */}
      <div style={{ height: 48, background: COLORS.topbar, borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: COLORS.primary }}>◆</span>
          Connexion Service Desk
        </div>
        <div style={{ flex: 1 }} />
        {phase === 'ticketing' && !showTicketForm && (
          <button onClick={() => setShowTicketForm(true)} style={{ padding: '6px 16px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Write Ticket
          </button>
        )}
        {callActive && (phase === 'call_active' || phase === 'remote_active') && (
          <button onClick={() => handleAction('end_call', 'customer_chat')} style={{ padding: '6px 16px', background: COLORS.danger, color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            End Call
          </button>
        )}
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>Status: <b>{phase.replace('_', ' ')}</b></div>
      </div>

      {/* ── Incoming Call Banner ── */}
      {incomingCall && phase === 'not_started' && (
        <div style={{ background: COLORS.callBanner, color: '#fff', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20, animation: 'ping 1s infinite' }}>📞</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Incoming Call — Sarah Thompson, Connexion Dental</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Accounts — Issue with Outlook not sending emails</div>
          </div>
          <button
            onClick={() => handleAction('start_call', 'customer_chat')}
            style={{ padding: '8px 24px', background: '#fff', color: COLORS.callBanner, border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Answer Call
          </button>
          <button
            onClick={() => setIncomingCall(false)}
            style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{ width: 220, background: COLORS.sidebar, color: '#c8d6e5', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#6b8eb5' }}>Navigation</div>
          {[{ icon: '🏠', label: 'Home' }, { icon: '🎫', label: 'Incidents', active: true }, { icon: '🖥️', label: 'Assets' }, { icon: '📚', label: 'Knowledge Base' }, { icon: '📊', label: 'Reports' }].map(item => (
            <div key={item.label} style={{
              padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              background: item.active ? COLORS.sidebarActive : 'transparent',
              borderLeft: item.active ? `3px solid ${COLORS.primary}` : '3px solid transparent',
              color: item.active ? '#fff' : '#8ba4c4',
            }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}

          <div style={{ flex: 1 }} />

          {/* Ticket Details in Sidebar */}
          {callActive && (
            <div style={{ padding: '12px', borderTop: `1px solid ${COLORS.sidebarHover}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#6b8eb5', marginBottom: 8 }}>Current Ticket</div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>INC-002847</div>
              <div style={{ fontSize: 11, color: '#8ba4c4', marginTop: 2 }}>Outlook — Work Offline</div>
              <div style={{ fontSize: 11, color: '#8ba4c4' }}>Connexion Dental</div>
              <div style={{ marginTop: 8, height: 4, background: COLORS.sidebarHover, borderRadius: 2 }}>
                <div style={{ width: healthBarWidth, height: '100%', background: healthBarColor, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 10, color: '#6b8eb5', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>Progress</span>
                <span>{safeOutlook?.workOffline === false ? 'Resolved' : 'In Progress'}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: COLORS.warning }}>
                ⏱ {safeOutlook?.workOffline === false ? 'Resolved' : 'Urgent — client meeting in 30 min'}
              </div>
            </div>
          )}
        </div>

        {/* ── CENTER: Chat + Ticket ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

          {/* Timeline strip */}
          {simData && simData.timeline.length > 0 && (
            <div style={{ display: 'flex', gap: 4, padding: '6px 16px', background: COLORS.card, borderBottom: `1px solid ${COLORS.border}`, overflowX: 'auto', fontSize: 11, color: COLORS.textMuted }}>
              {simData.timeline.slice(-8).map((t, i) => (
                <span key={i} style={{
                  padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                  background: t.is_red_flag ? '#fde8e8' : '#e8f0fe',
                  color: t.is_red_flag ? COLORS.danger : COLORS.primary,
                }}>
                  {t.formatted_time} {t.label}
                </span>
              ))}
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!callActive && phase === 'not_started' && (
              <div style={{ textAlign: 'center', padding: 40, color: COLORS.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📞</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Awaiting Call</div>
                <div style={{ fontSize: 13 }}>An incoming call will appear shortly. Click "Answer Call" to begin the assessment.</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'candidate' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: m.role === 'candidate' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  background: m.role === 'candidate' ? COLORS.primary : COLORS.card,
                  color: m.role === 'candidate' ? '#fff' : COLORS.text,
                  border: m.role === 'candidate' ? 'none' : `1px solid ${COLORS.border}`,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2, opacity: 0.7 }}>
                    {m.role === 'candidate' ? 'You' : 'Sarah Thompson (Customer)'}
                  </div>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
            {sending && <div style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' }}>Sarah is typing...</div>}
            {error && <div style={{ fontSize: 12, color: COLORS.danger }}>{error}</div>}
          </div>

          {/* Input area */}
          {!showTicketForm && callActive && (
            <div style={{ padding: '12px 16px', background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { sendMessage(input); setInput(''); } }}
                  placeholder="Type a message..."
                  style={{
                    flex: 1, padding: '10px 14px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13,
                    outline: 'none', background: COLORS.bg,
                  }}
                />
                <button
                  onClick={() => { sendMessage(input); setInput(''); }}
                  disabled={sending || !input.trim()}
                  style={{
                    padding: '10px 20px', background: COLORS.primary, color: '#fff', border: 'none',
                    borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: sending || !input.trim() ? 0.6 : 1,
                  }}
                >
                  Send
                </button>
              </div>
              <VoiceRecorderButton token={token} onTranscript={handleVoiceTranscript} disabled={!callActive || ttsPlaying} clickToToggle />
            </div>
          )}

          {/* Ticket form */}
          {showTicketForm && (
            <div style={{ padding: 16, background: COLORS.card, borderTop: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Write Closure Ticket</div>
              <textarea
                value={ticketText}
                onChange={e => setTicketText(e.target.value)}
                placeholder="User, company, issue, root cause, steps taken, verification, next steps..."
                style={{
                  width: '100%', minHeight: 140, padding: 12, border: `1px solid ${COLORS.border}`, borderRadius: 6,
                  fontSize: 13, resize: 'vertical', background: COLORS.bg, fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={submitTicket}
                  disabled={!ticketText.trim()}
                  style={{
                    padding: '8px 20px', background: COLORS.success, color: '#fff', border: 'none',
                    borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: !ticketText.trim() ? 0.6 : 1,
                  }}
                >
                  Submit Ticket
                </button>
                <button
                  onClick={() => setShowTicketForm(false)}
                  style={{ padding: '8px 16px', background: COLORS.bg, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                >
                  Back to Call
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Actions Panel ── */}
        <div style={{ width: 260, background: COLORS.card, borderLeft: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600, fontSize: 13, color: COLORS.text }}>
            {callActive ? 'Available Actions' : 'Getting Started'}
          </div>

          {!callActive && phase === 'not_started' && (
            <div style={{ padding: 16, fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6 }}>
              <p>You are about to receive a simulated support call.</p>
              <p style={{ marginTop: 8 }}><b>Instructions:</b></p>
              <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                <li>Answer the call when it comes in</li>
                <li>Ask questions to understand the issue</li>
                <li>Use diagnostic tools to find the cause</li>
                <li>Apply the fix and verify it worked</li>
                <li>Write a closure ticket</li>
              </ul>
              <p style={{ marginTop: 12, fontSize: 11, color: COLORS.warning }}>Do not invent fixes. If unsure, explain what you would check next.</p>
            </div>
          )}

          {callActive && (
            <div style={{ overflow: 'auto', flex: 1, padding: 8 }}>
              {/* Tool groups */}
              {['outlook', 'browser', 'cmd', 'connectwise', 'control_panel', 'customer_chat'].map(tool => {
                const toolActions = safeActions.filter(a => a.tool === tool);
                if (toolActions.length === 0) return null;
                const toolIcons: Record<string, string> = { outlook: '📧', browser: '🌐', cmd: '💻', connectwise: '🔧', control_panel: '⚙️', customer_chat: '💬' };
                const toolLabels: Record<string, string> = { outlook: 'Outlook', browser: 'Browser', cmd: 'Command Prompt', connectwise: 'ConnectWise', control_panel: 'Control Panel', customer_chat: 'Communication' };
                return (
                  <div key={tool} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: COLORS.textMuted, padding: '4px 8px', marginBottom: 2 }}>
                      {toolIcons[tool]} {toolLabels[tool]}
                    </div>
                    {toolActions.map(a => (
                      <button
                        key={a.id}
                        onClick={() => handleAction(a.id, a.tool)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '7px 10px', marginBottom: 2,
                          background: a.redFlag ? '#fff5f5' : '#f8f9fa',
                          border: `1px solid ${a.redFlag ? '#fdd' : COLORS.border}`,
                          borderRadius: 4, fontSize: 12, cursor: 'pointer',
                          color: a.redFlag ? COLORS.danger : COLORS.text,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        {a.redFlag ? '⚠ ' : '▶ '}{a.label}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* Health / Status */}
          {callActive && (
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textMuted }}>
              <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Device: ALDER-LT-023</div>
              <div>Status: {safeOutlook?.workOffline === false ? '✅ Online' : '🔴 Work Offline'}</div>
              <div>Outbox: {safeOutlook?.outboxCount ?? '—'} messages</div>
              {safeOutlook?.sentTestEmail && <div style={{ color: COLORS.success }}>✓ Test email sent</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
