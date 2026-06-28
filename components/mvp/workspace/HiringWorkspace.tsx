'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import CallBar from '@/components/mvp/simulator/CallBar';
import { useCustomerAudio } from '@/components/mvp/voice/CustomerAudioPlayer';
import { useVoiceLoop } from '@/components/mvp/voice/useVoiceLoop';
import AssessmentResults, { type CandidateAnalysisResult } from '@/components/mvp/results/AssessmentResults';

type Message = { role: string; content: string };
type CallStatus = 'idle' | 'incoming' | 'active' | 'thinking' | 'speaking' | 'recording' | 'ended';

export interface HiringWorkspaceProps {
  token: string;
  mode: string;
  initialMessages: Message[];
  initialAnalysis?: CandidateAnalysisResult | null;
  hiringPack?: {
    id: string; title: string;
    customer: { name: string; company: string; openingLine: string; issue: string; role: string; temperament: string };
  };
  ticket: { id: string; title: string; requesterName: string; company: string; description: string };
}

const containerStyle: React.CSSProperties = {
  height: '100vh', display: 'flex', flexDirection: 'column',
  background: '#111', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif', fontSize: 14,
};

const tips = [
  { title: 'Be professional', body: 'Greet the customer, confirm their name, and stay calm even if they are frustrated.' },
  { title: 'Ask questions', body: 'Clarify the issue — when it started, what they\'ve tried, and what the impact is.' },
  { title: 'Troubleshoot', body: 'Walk through logical steps. Check simple causes first before escalating.' },
  { title: 'Document clearly', body: 'Write a clear support note covering what happened, what you checked, and the outcome.' },
];

const coachingMsgs = [
  { role: 'assistant', content: "Hi there! Before the call starts, I'll give you a quick briefing." },
  { role: 'assistant', content: "You're about to handle a support call. The customer has a specific issue they need help with. Your job is to diagnose, communicate clearly, and log what you find." },
  { role: 'assistant', content: "Ready? Click 'Start Call' when you want to begin. Type or speak — both work." },
];

export default function HiringWorkspace({ token, initialMessages, initialAnalysis, hiringPack, ticket }: HiringWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [phase, setPhase] = useState<'briefing' | 'call' | 'note' | 'done'>('briefing');
  const [noteText, setNoteText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<CandidateAnalysisResult | null>(initialAnalysis || null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [sending, setSending] = useState(false);
  const coachingIndexRef = useRef(0);

  const { speak, setOnPlaying, setOnTtsEnd } = useCustomerAudio(token);
  setOnPlaying(setTtsPlaying);
  setOnTtsEnd(() => {});

  const { listening: vadListening, startListening, stopListening } = useVoiceLoop({
    token,
    onTranscript: useCallback((text: string, isPartial: boolean) => {
      if (!isPartial) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'candidate' && last.content.length > 0) return prev;
          return [...prev, { role: 'candidate', content: text }];
        });
      }
    }, []),
    onError: useCallback((err: string) => setError(err), []),
  });

  /* Start voice loop when call goes active */
  useEffect(() => {
    if (phase === 'call' && callStatus === 'active' && !vadListening) startListening();
    if (phase === 'note' && vadListening) stopListening();
  }, [phase, callStatus, vadListening, startListening, stopListening]);

  const answerCall = useCallback(async () => {
    setCallStatus('active');
    setMessages(prev => [...prev, { role: 'system', content: '🔔 Call connected. Customer is speaking...' }]);
    const res = await fetch(`/api/mvp/assessment/${token}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'system', content: '__answer_call__' }),
    });
    const d = await res.json();
    if (d.reply) {
      setMessages(prev => [...prev, { role: 'caller', content: d.reply }]);
      speak(d.reply, 'frustrated', 3).catch(() => {});
    }
  }, [token, speak]);

  const endCall = useCallback(async () => {
    stopListening();
    setCallStatus('ended');
    setPhase('note');
    setMessages(prev => [...prev, { role: 'system', content: '📞 Call ended. Write your support note below.' }]);
  }, [stopListening]);

  const handleTextSubmit = useCallback(async () => {
    const input = document.querySelector('[data-candidate-input]') as HTMLTextAreaElement;
    const text = input?.value?.trim();
    if (!text || sending) return;
    input.value = '';
    setMessages(prev => [...prev, { role: 'candidate', content: text }]);
    setSending(true);
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'candidate', content: text }),
      });
      const d = await res.json();
      if (d.reply) {
        setMessages(prev => [...prev, { role: 'caller', content: d.reply }]);
        speak(d.reply, 'frustrated', 3).catch(() => {});
      }
    } finally { setSending(false); }
  }, [token, speak, sending]);

  const handleSubmitTicket = useCallback(async () => {
    if (!noteText.trim() || analysing) return;
    setAnalysing(true);
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/ticket`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'hiring_exam', ticket: noteText.trim(), internalNotes: '', liveNotes: noteText.trim() }),
      });
      const d = await res.json();
      if (d.candidate_analysis) setAnalysisResults(d.candidate_analysis);
      setSubmitted(true);
    } finally { setAnalysing(false); }
  }, [token, noteText, analysing]);

  const customerName = hiringPack?.customer?.name || ticket.requesterName || 'Customer';
  const customerCompany = hiringPack?.customer?.company || ticket.company || '';
  const customerIssue = hiringPack?.customer?.issue || ticket.title || 'Support request';
  const temperament = hiringPack?.customer?.temperament || 'frustrated';

  if (submitted && analysisResults) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: '24px 24px 0', fontSize: 18, fontWeight: 700 }}>Assessment Complete</div>
        <AssessmentResults analysis={analysisResults} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Top bar */}
      <div style={{ padding: '14px 24px', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/callcallum-logo.png" alt="" style={{ width: 24, height: 24, borderRadius: 4 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{phase === 'briefing' ? 'Call Briefing' : phase === 'call' ? 'Live Call' : 'Support Note'}</div>
          <div style={{ fontSize: 11, color: '#9f9f9f' }}>{customerName} · {customerIssue}</div>
        </div>
        {phase === 'briefing' && (
          <button onClick={() => { setPhase('call'); setCallStatus('incoming'); setMessages(prev => [...prev, { role: 'system', content: '📞 Incoming call... Click "Answer Call" to connect.' }]); }}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#004b8d', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Start Call
          </button>
        )}
      </div>

      {/* Briefing phase — Callum coaching */}
      {phase === 'briefing' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto' }}>
          {coachingMsgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg,#004b8d,#0066b3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', flexShrink: 0, fontWeight: 700 }}>C</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.7, color: '#e8e8e8' }}>{m.content}</div>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#9f9f9f', marginBottom: 10, fontWeight: 600 }}>TIPS FOR THIS CALL</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {tips.map((tip, i) => (
                <div key={i} style={{ padding: '12px 14px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>{tip.title}</div>
                  <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.5 }}>{tip.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Call phase */}
      {phase === 'call' && (
        <>
          <div style={{ padding: '8px 24px', background: '#0d0d0d' }}>
            <CallBar status={callStatus} callerName={customerName} onStartCall={answerCall} onEndCall={endCall} />
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.slice(-6).map((m, i) => (
              m.role === 'system' ? (
                <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#6f6f6f', padding: '6px 0' }}>{m.content}</div>
              ) : (
                <div key={i} style={{
                  maxWidth: '72%', padding: '9px 13px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
                  background: m.role === 'caller' ? '#2a2a2a' : '#004b8d',
                  color: '#e8e8e8', alignSelf: m.role === 'caller' ? 'flex-start' : 'flex-end',
                  whiteSpace: 'pre-wrap',
                }}>{m.content}</div>
              )
            ))}
            {analysing && <div style={{ textAlign: 'center', fontSize: 12, color: '#6f6f6f' }}>Analysing...</div>}
            <div style={{ height: 80 }} />
          </div>

          {callStatus === 'active' && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '10px 24px 14px', background: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}>
              <textarea data-candidate-input placeholder="Type your response..." rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); } }}
                style={{ width: '100%', padding: '9px 13px', borderRadius: 6, border: '1px solid #333', background: '#0d0d0d', color: '#e8e8e8', fontSize: 13, fontFamily: 'system-ui', resize: 'none', outline: 'none', boxSizing: 'border-box', minHeight: 20 }}
              />
            </div>
          )}
        </>
      )}

      {/* Note phase */}
      {phase === 'note' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 32, maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Write Your Support Note</div>
          <div style={{ fontSize: 12, color: '#9f9f9f', marginBottom: 16 }}>What happened? What did you check? What was the outcome?</div>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Summarise the issue, troubleshooting steps, and resolution..."
            rows={6}
            style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #333', background: '#0d0d0d', color: '#e8e8e8', fontSize: 13, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <button onClick={handleSubmitTicket} disabled={!noteText.trim() || analysing}
            style={{ marginTop: 12, padding: '10px 24px', borderRadius: 6, border: 'none', background: !noteText.trim() || analysing ? '#333' : '#004b8d', color: '#fff', fontSize: 14, fontWeight: 700, cursor: !noteText.trim() || analysing ? 'default' : 'pointer', alignSelf: 'flex-end' }}>
            {analysing ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      )}
    </div>
  );
}
