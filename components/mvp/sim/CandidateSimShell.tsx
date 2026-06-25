'use client';

import { useState, useEffect, useCallback } from 'react';
import { WindowProvider, useWindowManager } from '@/lib/win11/windowState';
import Desktop from '@/components/win11/Desktop';
import Taskbar from '@/components/win11/Taskbar';
import OutlookWindow from '@/components/win11/tools/OutlookWindow';
import BrowserWindow from '@/components/win11/tools/BrowserWindow';
import CommandPromptWindow from '@/components/win11/tools/CommandPromptWindow';
import CustomerChatWindow from '@/components/win11/tools/CustomerChatWindow';
import TicketWindow from '@/components/win11/tools/TicketWindow';
import SimTimeline from './SimTimeline';

interface Message {
  role: string;
  content: string;
}

interface TimelineEntry {
  action_id: string | null;
  label: string | null;
  result_text: string | null;
  formatted_time: string;
  is_red_flag: boolean;
}

interface SafeAction {
  id: string;
  tool: string;
  label: string;
}

interface SimData {
  tools: string[];
  safe_actions: SafeAction[];
  visible_state: Record<string, unknown>;
  timeline: TimelineEntry[];
}

function SimShellContent({ token, initialMessages }: { token: string; initialMessages: Message[] }) {
  const { state, open } = useWindowManager();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const [ticketText, setTicketText] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [simData, setSimData] = useState<SimData | null>(null);

  const loadSim = useCallback(async () => {
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/sim`);
      const data = await res.json();
      if (data.ok) setSimData(data.data);
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    loadSim();
    // Auto-open Outlook and Chat on load
    open('outlook', 'Microsoft Outlook', '📧', 'outlook');
    open('chat', 'Customer Chat', '💬', 'chat');
    open('ticket', 'Ticket', '🎫', 'ticket');
    const interval = setInterval(loadSim, 3000);
    return () => clearInterval(interval);
  }, [loadSim, open]);

  async function sendMessage(msg: string) {
    setSending(true);
    setMessages(prev => [...prev, { role: 'candidate', content: msg }]);

    const startedAt = Date.now();
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, started_at_ms: startedAt, ended_at_ms: Date.now() }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'caller', content: data.reply }]);
      } else {
        setError(data.error || 'No response');
      }
    } catch { setError('Failed to send message'); }
    setSending(false);
  }

  async function handleAction(actionId: string, toolId: string) {
    setError('');
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/sim/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, tool_id: toolId, timestamp_ms: Date.now() }),
      });
      const data = await res.json();
      if (data.ok) setSimData(data.data);
      else setError(data.error || 'Action failed');
    } catch { setError('Failed to perform action'); }
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

  if (ticketSubmitted) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 max-w-md text-center shadow-2xl">
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-xl font-bold text-green-400 mb-2">Assessment Complete</h2>
          <p className="text-gray-400">Your ticket has been submitted. You can close this page.</p>
        </div>
      </div>
    );
  }

  const safeActions = simData?.safe_actions || [];
  const visibleState = simData?.visible_state || {};

  return (
    <div className="win-sim-shell" style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0f172a' }}>
      {/* Windows */}
      <Desktop />
      <OutlookWindow safeActions={safeActions} visibleState={visibleState} onAction={handleAction} disabled={ticketSubmitted} />
      <BrowserWindow safeActions={safeActions} onAction={handleAction} disabled={ticketSubmitted} />
      <CommandPromptWindow safeActions={safeActions} onAction={handleAction} disabled={ticketSubmitted} />
      <CustomerChatWindow messages={messages} onSendMessage={sendMessage} sending={sending} disabled={ticketSubmitted} />
      <TicketWindow ticketText={ticketText} onTicketChange={setTicketText} onSubmit={submitTicket} submitted={ticketSubmitted} />

      {/* Taskbar */}
      <Taskbar />

      {/* Floating error toast */}
      {error && (
        <div style={{
          position: 'fixed', bottom: 60, right: 16,
          background: '#b91c1c', color: '#fecaca',
          padding: '8px 16px', borderRadius: 8, fontSize: 12,
          zIndex: 10000, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 8, color: '#fca5a5', border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
}

export default function CandidateSimShell(props: { token: string; assessmentTitle: string; scenarioTitle: string; packTitle?: string; initialMessages: Message[] }) {
  return (
    <WindowProvider>
      <SimShellContent token={props.token} initialMessages={props.initialMessages} />
    </WindowProvider>
  );
}
