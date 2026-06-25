'use client';

import { useState, useEffect, useCallback } from 'react';
import SimTimeline from './SimTimeline';
import ToolDock from './ToolDock';

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

interface CandidateSimShellProps {
  token: string;
  assessmentTitle: string;
  scenarioTitle: string;
  packTitle?: string;
  initialMessages: Message[];
}

export default function CandidateSimShell({ token, assessmentTitle, packTitle, initialMessages }: CandidateSimShellProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
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
    const interval = setInterval(loadSim, 3000);
    return () => clearInterval(interval);
  }, [loadSim]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);
    setError('');

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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Windows-like taskbar header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-3 select-none" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
        <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
          <span className="text-[10px] text-white font-bold">C</span>
        </div>
        <span className="text-sm font-medium flex-1">{packTitle || assessmentTitle}</span>
        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">Simulator</span>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Customer Chat - Windows mail-style */}
        <div className="lg:w-1/4 flex flex-col border-r border-gray-700 bg-gray-900">
          <div className="bg-indigo-800 px-3 py-1.5 flex items-center gap-2 select-none">
            <span className="text-sm">💬</span>
            <span className="text-xs font-semibold">Customer Chat — Sarah Thompson</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-950">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'candidate'
                    ? 'bg-blue-700 text-white rounded-br-sm'
                    : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-gray-700 bg-gray-900">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-100 placeholder-gray-500"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 rounded text-xs font-medium"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Middle: Tool Windows */}
        <div className="lg:w-2/4 flex flex-col overflow-y-auto bg-gray-950">
          {simData && (
            <ToolDock
              tools={simData.tools}
              safeActions={simData.safe_actions}
              onAction={handleAction}
              disabled={ticketSubmitted}
            />
          )}
          {!simData && (
            <div className="flex items-center justify-center flex-1 text-gray-500 text-sm">
              Loading tools...
            </div>
          )}

          {/* Windows-style visible state panel */}
          {simData?.visible_state && Object.keys(simData.visible_state).length > 0 && (
            <div className="mx-3 mb-3 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-800 px-3 py-1 border-b border-gray-700">
                <span className="text-xs font-semibold text-gray-300">System Status</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2 text-xs">
                {Object.entries(simData.visible_state).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className={`font-mono ${v === true || v === 'Online' ? 'text-green-400' : v === false || v === 'Offline' || v === 'Working Offline' ? 'text-yellow-400' : 'text-gray-200'}`}>
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Timeline + Ticket */}
        <div className="lg:w-1/4 flex flex-col border-l border-gray-700 bg-gray-900">
          <div className="bg-gray-800 px-3 py-1.5 border-b border-gray-700 flex items-center gap-2">
            <span className="text-sm">📋</span>
            <span className="text-xs font-semibold">Action Log</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 bg-gray-950">
            {simData && <SimTimeline timeline={simData.timeline} />}
            {(!simData || simData.timeline.length === 0) && (
              <div className="text-xs text-gray-500 italic">No actions yet. Use the tools in the middle panel.</div>
            )}
          </div>

          <div className="border-t border-gray-700 p-3 bg-gray-900">
            <button
              onClick={submitTicket}
              disabled={!ticketText.trim() || ticketSubmitted}
              className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-700 rounded text-xs font-medium mb-2"
            >
              Submit Ticket
            </button>
            <textarea
              value={ticketText}
              onChange={e => setTicketText(e.target.value)}
              placeholder="Write your support ticket note here..."
              rows={4}
              className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-100 placeholder-gray-500 resize-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-800 text-red-200 px-4 py-2 rounded-lg text-xs shadow-lg z-50">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300">✕</button>
        </div>
      )}
    </div>
  );
}
