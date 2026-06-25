'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WindowProvider, useWindowManager } from '@/lib/win11/windowState';
import Desktop from '@/components/win11/Desktop';
import Taskbar from '@/components/win11/Taskbar';
import OutlookWindow from '@/components/win11/tools/OutlookWindow';
import BrowserWindow from '@/components/win11/tools/BrowserWindow';
import CommandPromptWindow from '@/components/win11/tools/CommandPromptWindow';
import { VoiceRecorderButton } from '@/components/mvp/voice/VoiceRecorderButton';
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
  const { state, open } = useWindowManager();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [ticketText, setTicketText] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [simData, setSimData] = useState<any>(null);
  const [phase, setPhase] = useState('not_started');
  const [incomingCall, setIncomingCall] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [windowsOpened, setWindowsOpened] = useState(false);
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
    open('chat', 'Customer Chat', '💬', 'chat');
    open('ticket', 'Ticket', '🎫', 'ticket');
    const interval = setInterval(loadSim, 3000);
    return () => clearInterval(interval);
  }, [loadSim, open]);

  /* Incoming call */
  useEffect(() => {
    if (phase === 'not_started' && !incomingCall) {
      const t = setTimeout(() => setIncomingCall(true), 1500);
      return () => clearTimeout(t);
    }
  }, [phase, incomingCall]);

  /* Open Win11 windows when remoted in */
  useEffect(() => {
    if (phase === 'remote_active' && !windowsOpened) {
      setWindowsOpened(true);
      open('outlook', 'Microsoft Outlook', '📧', 'outlook');
      open('browser', 'Browser', '🌐', 'browser');
      open('cmd', 'Command Prompt', '💻', 'cmd');
    }
  }, [phase, windowsOpened, open]);

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
        if (actionId === 'start_call') {
          setCallActive(true); setIncomingCall(false);
          /* Speak the customer's opening line after brief delay */
          const openingMsg = messages.find(m => m.role === 'caller');
          if (openingMsg) {
            setTimeout(() => speak(openingMsg.content).catch(() => {}), 500);
          }
        }
        if (actionId === 'end_call') { setShowTicketForm(true); }
      } else setError(d.error || 'Action failed');
    } catch { setError('Failed to perform action'); }
  }

  async function sendMessage(msg: string, source?: string) {
    if (!msg.trim() || sending) return;
    setSending(true);
    setMessages(p => [...p, { role: 'candidate', content: msg }]);
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, input_source: source || 'text', started_at_ms: Date.now() }),
      });
      const d = await res.json();
      if (d.reply) {
        setMessages(p => [...p, { role: 'caller', content: d.reply }]);
        speak(d.reply).catch(() => {});
      } else setError(d.error || 'No response');
    } catch { setError('Failed to send message'); }
    setSending(false);
  }

  async function handleVoiceTranscript(text: string) { await sendMessage(text, 'voice'); }
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
  const simPhase = phase;

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

  const isRemoted = simPhase === 'remote_active';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative' }}>
      {/* ── Top bar ── */}
      <div style={{ height: 44, background: C.topbar, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: C.primary, fontSize: 18 }}>◆</span>
          Connexion Service Desk
        </div>
        <div style={{ flex: 1 }} />
        {!isRemoted && !showTicketForm && callActive && (
          <button onClick={() => handleAction('remote_connect', 'connectwise')}
            style={{ padding: '5px 14px', background: C.primary, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🖥️ Remote into ALDER-LT-023
          </button>
        )}
        {showTicketForm && !ticketSubmitted && (
          <span style={{ fontSize: 12, color: C.warning, fontWeight: 600 }}>✏️ Write your closure ticket</span>
        )}
        {autoplayBlocked && (
          <button onClick={() => { const last = [...messages].reverse().find(m => m.role === 'caller'); if (last) speak(last.content).catch(() => {}); }}
            style={{ padding: '3px 10px', background: '#fff3cd', color: '#856404', border: '1px solid #ffc107', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
            🔇 Click to hear customer
          </button>
        )}
        {callActive && (simPhase === 'call_active' || isRemoted) && (
          <button onClick={() => handleAction('end_call', 'customer_chat')}
            style={{ padding: '5px 14px', background: C.danger, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            📞 End Call
          </button>
        )}
        <div style={{ fontSize: 11, color: C.textMuted }}>
          {simPhase === 'call_active' ? '📞 On call with Sarah Thompson' : isRemoted ? '🖥️ Remote: ALDER-LT-023' : simPhase === 'ticketing' ? '📝 Writing ticket' : '● Ready'}
        </div>
      </div>

      {/* ── Incoming Call Banner ── */}
      {incomingCall && simPhase === 'not_started' && (
        <div style={{ background: C.callBanner, color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>📞</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Incoming Call — Sarah Thompson, Connexion Dental</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Accounts — Outlook not sending emails</div>
          </div>
          <button onClick={() => handleAction('start_call', 'customer_chat')}
            style={{ padding: '6px 20px', background: '#fff', color: C.callBanner, border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Answer Call
          </button>
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width: 200, background: C.sidebar, color: '#c8d6e5', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#6b8eb5' }}>Navigation</div>
          {[{ icon: '🏠', label: 'Home' }, { icon: '🎫', label: 'Incidents', active: true }, { icon: '🖥️', label: 'Assets' }, { icon: '📚', label: 'Knowledge Base' }].map(item => (
            <div key={item.label} style={{
              padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'default',
              background: item.active ? C.sidebarActive : 'transparent',
              borderLeft: item.active ? `3px solid ${C.primary}` : '3px solid transparent',
              color: item.active ? '#fff' : '#8ba4c4',
            }}>
              <span>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          {callActive && (
            <div style={{ padding: '10px', borderTop: `1px solid ${C.sidebarHover}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#6b8eb5', marginBottom: 6 }}>Current Ticket</div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>INC-002847</div>
              <div style={{ fontSize: 10, color: '#8ba4c4', marginTop: 1 }}>Outlook — Work Offline</div>
              <div style={{ fontSize: 10, color: '#8ba4c4' }}>Connexion Dental</div>
              <div style={{ marginTop: 6, height: 3, background: C.sidebarHover, borderRadius: 2 }}>
                <div style={{ width: safeOutlook?.workOffline === false ? '100%' : '30%', height: '100%', background: safeOutlook?.workOffline === false ? C.success : C.warning, borderRadius: 2, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 9, color: '#6b8eb5', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                <span>Progress</span>
                <span>{safeOutlook?.workOffline === false ? 'Resolved' : 'In Progress'}</span>
              </div>
            </div>
          )}
        </div>

        {/* CENTER: Chat + Win11 overlay OR ticket form */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

          {/* Timeline */}
          {simData?.timeline?.length > 0 && (
            <div style={{ display: 'flex', gap: 3, padding: '4px 12px', background: C.card, borderBottom: `1px solid ${C.border}`, overflowX: 'auto', fontSize: 10, color: C.textMuted, flexShrink: 0 }}>
              {simData.timeline.slice(-10).map((t: any, i: number) => (
                <span key={i} style={{
                  padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap',
                  background: t.is_red_flag ? '#fde8e8' : '#e8f0fe',
                  color: t.is_red_flag ? C.danger : C.primary, fontSize: 10,
                }}>
                  {t.formatted_time} {t.label}
                </span>
              ))}
            </div>
          )}

          {/* Messages - hidden behind Win11 when remoted */}
          <div style={{
            flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
            opacity: isRemoted ? 0.15 : 1, transition: 'opacity 0.3s',
            pointerEvents: isRemoted ? 'none' : 'auto',
          }}>
            {!callActive && simPhase === 'not_started' && !incomingCall && (
              <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📞</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Awaiting Call</div>
                <div style={{ fontSize: 12 }}>An incoming call will appear shortly.</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'candidate' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '8px 12px', borderRadius: m.role === 'candidate' ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
                  fontSize: 12, lineHeight: 1.5,
                  background: m.role === 'candidate' ? C.primary : C.card,
                  color: m.role === 'candidate' ? '#fff' : C.text,
                  border: m.role === 'candidate' ? 'none' : `1px solid ${C.border}`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 1, opacity: 0.7 }}>
                    {m.role === 'candidate' ? 'You' : 'Sarah (Customer)'}
                  </div>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Win11 Floating Windows — overlays center panel when remoted */}
          {isRemoted && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 100,
              background: C.darkBg, overflow: 'hidden',
            }}>
              <Desktop />
              <OutlookWindow
                safeActions={safeActions}
                visibleState={safeState}
                onAction={(id: string, tool: string) => handleAction(id, tool)}
                disabled={false}
              />
              <BrowserWindow
                safeActions={safeActions}
                onAction={(id: string, tool: string) => handleAction(id, tool)}
                disabled={false}
              />
              <CommandPromptWindow
                safeActions={safeActions}
                onAction={(id: string, tool: string) => handleAction(id, tool)}
                disabled={false}
              />
              <Taskbar />
            </div>
          )}

          {/* Input */}
          {!showTicketForm && !isRemoted && callActive && (
            <div style={{ padding: '8px 12px', background: C.card, borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { sendMessage(input); setInput(''); } }}
                  placeholder="Type a message..." style={{
                    flex: 1, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, outline: 'none', background: C.bg
                  }} />
                <button onClick={() => { sendMessage(input); setInput(''); }}
                  disabled={sending || !input.trim()}
                  style={{ padding: '8px 16px', background: C.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: sending || !input.trim() ? 0.6 : 1 }}>
                  Send
                </button>
              </div>
              <VoiceRecorderButton token={token} onTranscript={handleVoiceTranscript} disabled={!callActive || ttsPlaying} clickToToggle />
            </div>
          )}

          {/* Ticket form */}
          {showTicketForm && (
            <div style={{ padding: 12, background: C.card, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
              <textarea value={ticketText} onChange={e => setTicketText(e.target.value)}
                placeholder="User, company, issue, root cause, steps taken, verification, next steps..." style={{
                  width: '100%', minHeight: 120, padding: 10, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, resize: 'vertical', background: C.bg, fontFamily: 'inherit'
                }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={submitTicket} disabled={!ticketText.trim()}
                  style={{ padding: '6px 16px', background: C.success, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Submit Ticket
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Actions Panel */}
        <div style={{ width: 240, background: C.card, borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 12, color: C.text }}>
            {callActive ? (isRemoted ? '🖥️ Tools & Actions' : '📋 Actions') : 'Getting Started'}
          </div>
          {!callActive && simPhase === 'not_started' && (
            <div style={{ padding: 14, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}>You are about to receive a simulated IT support call.</p>
              <ul style={{ paddingLeft: 14, margin: '8px 0', fontSize: 11 }}>
                <li>Answer the call when it appears</li>
                <li>Ask questions to diagnose</li>
                <li>Remote in and use tools to find the cause</li>
                <li>Apply the fix and verify</li>
                <li>Write a closure ticket</li>
              </ul>
            </div>
          )}
          {callActive && (
            <div style={{ overflow: 'auto', flex: 1, padding: 6 }}>
              {['outlook', 'browser', 'cmd', 'connectwise', 'control_panel', 'customer_chat'].map(tool => {
                const toolActions = safeActions.filter((a: SafeAction) => a.tool === tool);
                if (toolActions.length === 0) return null;
                const icons: Record<string, string> = { outlook: '📧', browser: '🌐', cmd: '💻', connectwise: '🔧', control_panel: '⚙️', customer_chat: '💬' };
                const labels: Record<string, string> = { outlook: 'Outlook', browser: 'Browser', cmd: 'Terminal', connectwise: 'ConnectWise', control_panel: 'Control Panel', customer_chat: 'Communication' };
                return (
                  <div key={tool} style={{ marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: C.textMuted, padding: '2px 6px' }}>
                      {icons[tool]} {labels[tool]}
                    </div>
                    {toolActions.map((a: SafeAction) => (
                      <button key={a.id} onClick={() => handleAction(a.id, a.tool)} style={{
                        width: '100%', textAlign: 'left', padding: '5px 8px', marginBottom: 1,
                        background: a.redFlag ? '#fff5f5' : '#f8f9fa',
                        border: `1px solid ${a.redFlag ? '#fdd' : C.border}`, borderRadius: 3, fontSize: 11,
                        cursor: 'pointer', color: a.redFlag ? C.danger : C.text,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {a.redFlag ? '⚠ ' : '▶ '}{a.label}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {callActive && (
            <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textMuted }}>
              <div style={{ fontWeight: 600, color: C.text, marginBottom: 2 }}>ALDER-LT-023</div>
              <div>Status: {safeOutlook?.workOffline === false ? '✅ Online' : '🔴 Work Offline'}</div>
              <div>Outbox: {safeOutlook?.outboxCount ?? '—'} msgs</div>
              {safeOutlook?.sentTestEmail && <div style={{ color: C.success }}>✓ Test email sent</div>}
            </div>
          )}
        </div>
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
