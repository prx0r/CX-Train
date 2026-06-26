'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { VoiceRecorderButton, type VoiceTranscriptResult } from '@/components/mvp/voice/VoiceRecorderButton';
import { useCustomerAudio } from '@/components/mvp/voice/CustomerAudioPlayer';

interface Message {
  role: string;
  content: string;
}

export default function CandidatePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [scenarioTitle, setScenarioTitle] = useState('');
  const [status, setStatus] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [ticketText, setTicketText] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [assignmentType, setAssignmentType] = useState<string>('hiring_exam');
  const [assessmentMode, setAssessmentMode] = useState<string>('chat_call');
  const [packTitle, setPackTitle] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { speak, setOnPlaying, autoplayBlocked } = useCustomerAudio(token);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const firstLoadRef = useRef(true);

  useEffect(() => { setOnPlaying(setTtsPlaying); }, [setOnPlaying]);

  useEffect(() => {
    fetch(`/api/mvp/assessment/${token}`)
      .then(r => r.json())
      .then(data => {
        setTitle(data.title || 'Assessment');
        setScenarioTitle(data.scenario_title || '');
        setStatus(data.status);
        setMessages(data.messages || []);
        setAssignmentType(data.assignment_type || 'hiring_exam');
        setAssessmentMode(data.assessment_mode || 'chat_call');
        setPackTitle(data.pack_title || '');
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load assessment');
        setLoading(false);
      });
  }, [token]);

  /* Auto-play initial customer message */
  useEffect(() => {
    if (!loading && messages.length > 0 && firstLoadRef.current) {
      firstLoadRef.current = false;
      const firstCaller = messages.find(m => m.role === 'caller');
      if (firstCaller) {
        setTimeout(() => speak(firstCaller.content).catch(() => {}), 500);
      }
    }
  }, [loading, messages, speak]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(msg?: string, source?: string) {
    const text = (msg || input).trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    setError('');

    setMessages(prev => [...prev, { role: 'candidate', content: text }]);

    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, input_source: source || 'text' }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'caller', content: data.reply }]);
        /* Auto-play customer reply */
        speak(data.reply).catch(() => {});
      } else {
        setError(data.error || 'No response');
      }
    } catch (e) {
      setError('Failed to send message');
    }
    setSending(false);
  }

  async function handleVoiceTranscript(result: VoiceTranscriptResult) {
    await sendMessage(result.text, 'voice');
  }

  async function endCall() {
    try {
      await fetch(`/api/mvp/assessment/${token}/end`, { method: 'POST' });
      setCallEnded(true);
    } catch (e) {
      setError('Failed to end call');
    }
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
      if (data.status === 'completed') {
        setTicketSubmitted(true);
      } else {
        setError(data.error || 'Failed to submit ticket');
      }
    } catch (e) {
      setError('Failed to submit ticket');
    }
  }

  // Defer to ItsmCandidateShell for training_drill mode
  if (assignmentType === 'training_drill' || assessmentMode === 'dashboard_sim') {
    const ItsmShell = React.lazy(() => import('@/components/mvp/sim/ItsmCandidateShell'));
    return (
      <React.Suspense fallback={<div className="p-8 text-center text-gray-500">Loading Service Desk...</div>}>
        <ItsmShell
          token={token}
          initialMessages={messages}
        />
      </React.Suspense>
    );
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (error && !messages.length) return <div className="p-8 text-center text-red-400">{error}</div>;

  const canUseVoice = typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

  return (
    <div className="max-w-3xl mx-auto p-4 flex flex-col min-h-screen">
      <h1 className="text-xl font-bold mb-1">{title}</h1>
      {scenarioTitle && <p className="text-sm text-gray-500 mb-4">Scenario: {scenarioTitle}</p>}

      <div className="text-xs text-gray-600 mb-4 p-3 bg-gray-900 border border-gray-800 rounded">
        <strong>Instructions:</strong> You are not expected to know every technical fix. Focus on asking clear questions, understanding impact, communicating calmly, and capturing useful information. Do not invent fixes. If unsure, explain what you would check or escalate.
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded p-4 mb-4 overflow-y-auto max-h-[50vh]" style={{ minHeight: '300px' }}>
        {messages.map((m, i) => (
          <div key={i} className={`mb-3 ${m.role === 'candidate' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block max-w-[80%] rounded px-3 py-2 text-sm ${
              m.role === 'candidate'
                ? 'bg-blue-600 text-white'
                : m.role === 'caller'
                ? 'bg-gray-700 text-gray-100'
                : 'bg-yellow-900 text-yellow-200'
            }`}>
              <div className="text-xs opacity-70 mb-1">
                {m.role === 'candidate' ? 'You' : m.role === 'caller' ? 'Caller (Sarah)' : 'System'}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        {sending && <p className="text-gray-500 text-xs italic">Caller is typing...</p>}
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {!callEnded && !ticketSubmitted && (
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              placeholder="Type your response..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              disabled={sending}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
              onClick={() => sendMessage()}
              disabled={sending || !input.trim()}
            >
              Send
            </button>
            <button
              className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded text-sm"
              onClick={endCall}
            >
              End Call
            </button>
          </div>
          {autoplayBlocked && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <span>Audio playback blocked by browser.</span>
              <button
                onClick={() => { const last = [...messages].reverse().find(m => m.role === 'caller'); if (last) speak(last.content).catch(() => {}); }}
                className="text-amber-300 underline cursor-pointer bg-transparent border-none"
              >
                Play last message
              </button>
            </div>
          )}
          {canUseVoice ? (
            <VoiceRecorderButton token={token} onTranscript={handleVoiceTranscript} disabled={sending || ttsPlaying} clickToToggle />
          ) : (
            <p className="text-xs text-gray-500">Voice mode requires HTTPS or localhost. Continue with text mode.</p>
          )}
        </div>
      )}

      {!callEnded && !ticketSubmitted && (
        <p className="text-xs text-gray-600 text-center mb-4">
          When you are done with the call, click <strong>End Call</strong> to write your ticket.
        </p>
      )}

      {callEnded && !ticketSubmitted && (
        <div className="bg-gray-900 border border-gray-800 rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Write Your Ticket</h2>
          <p className="text-xs text-gray-500 mb-2">Write a ticket as you would in an MSP PSA system. Include all relevant details.</p>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm min-h-[120px]"
            placeholder="Describe the issue, user, company, device, steps taken, and next steps..."
            value={ticketText}
            onChange={e => setTicketText(e.target.value)}
          />
          <button
            className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={submitTicket}
            disabled={!ticketText.trim()}
          >
            Submit Ticket
          </button>
        </div>
      )}

      {ticketSubmitted && (
        <div className="bg-green-900/30 border border-green-700 rounded p-4 text-center">
          <p className="text-green-400 font-semibold">Assessment complete. Thank you!</p>
          <p className="text-xs text-gray-400 mt-1">Your responses have been recorded.</p>
        </div>
      )}
    </div>
  );
}
