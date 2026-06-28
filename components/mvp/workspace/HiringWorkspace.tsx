'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import CallBar from '@/components/mvp/simulator/CallBar';
import { VoiceRecorderButton } from '@/components/mvp/voice/VoiceRecorderButton';
import { useCustomerAudio } from '@/components/mvp/voice/CustomerAudioPlayer';
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

const container: React.CSSProperties = {
  height: '100vh', display: 'flex', flexDirection: 'column',
  background: '#111', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif', fontSize: 14,
};

const tips = [
  { title: 'Be professional', body: 'Greet the customer, confirm their name, stay calm.' },
  { title: 'Ask questions', body: 'When did it start? What have you tried? What is the impact?' },
  { title: 'Troubleshoot', body: 'Check simple causes first. Think step by step.' },
  { title: 'Document', body: 'Write clear notes as you go — you will submit them after the call.' },
];

const coachingMsgs = [
  { role: 'assistant', content: "You're about to handle a support call. Click 'Start Call' when ready." },
  { role: 'assistant', content: 'Speak to the customer using the mic button (hold to talk). Draft your support note in the textarea as they speak.' },
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

  const { speak, setOnPlaying, setOnTtsEnd } = useCustomerAudio(token);
  setOnPlaying(() => {});
  setOnTtsEnd(() => {});

  const callAnsweredRef = useRef(false);

  const answerCall = useCallback(async () => {
    if (callAnsweredRef.current) return;
    callAnsweredRef.current = true;
    setCallStatus('active');
    const firstMsg = messages.find(m => m.role === 'caller');
    if (firstMsg) {
      setMessages(prev => [...prev, { role: 'system', content: '🔔 Call connected. Customer is speaking.' }]);
      speak(firstMsg.content, 'frustrated', 3).catch(() => {});
    }
  }, [messages, speak]);

  const endCall = useCallback(async () => {
    callAnsweredRef.current = false;
    setCallStatus('ended');
    setPhase('note');
  }, []);

  const handleVoiceTranscript = useCallback(async (result: { text: string }) => {
    if (!result.text?.trim()) return;
    const text = result.text.trim();
    setMessages(prev => [...prev, { role: 'candidate', content: text }]);
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, input_source: 'voice' }),
      });
      const d = await res.json();
      if (d.reply) {
        setMessages(prev => [...prev, { role: 'caller', content: d.reply }]);
        speak(d.reply, 'frustrated', 3).catch(() => {});
      }
    } catch {}
  }, [token, speak]);

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

  if (submitted && analysisResults) {
    return (
      <div style={container}>
        <div style={{ padding: '24px 24px 0', fontSize: 18, fontWeight: 700 }}>Assessment Complete</div>
        <AssessmentResults analysis={analysisResults} />
      </div>
    );
  }

  return (
    <div style={container}>
      {/* Top bar */}
      <div style={{ padding: '12px 20px', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/callcallum-logo.png" alt="" style={{ width: 22, height: 22, borderRadius: 4 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{phase === 'briefing' ? 'Assessment Briefing' : phase === 'call' ? 'Live Call' : 'Support Note'}</div>
          <div style={{ fontSize: 11, color: '#9f9f9f' }}>{customerName} · {customerIssue}</div>
        </div>
        {phase === 'briefing' && (
          <button onClick={() => { setPhase('call'); setCallStatus('incoming'); }}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#004b8d', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Start Call →
          </button>
        )}
      </div>

      {/* Briefing */}
      {phase === 'briefing' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 24, maxWidth: 600, margin: '0 auto' }}>
          {coachingMsgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg,#004b8d,#0066b3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', flexShrink: 0, fontWeight: 700 }}>C</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.7, color: '#e8e8e8' }}>{m.content}</div>
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            {tips.map((tip, i) => (
              <div key={i} style={{ padding: '12px 14px', borderRadius: 6, background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>{tip.title}</div>
                <div style={{ fontSize: 12, color: '#a1a1aa' }}>{tip.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call phase */}
      {phase === 'call' && (
        <>
          <CallBar status={callStatus} callerName={customerName} onStartCall={answerCall} onEndCall={endCall}
            micButton={
              <VoiceRecorderButton token={token} onTranscript={handleVoiceTranscript}
                disabled={callStatus !== 'active'} clickToToggle={false} />
            } />

          {/* Note drafting area — visible DURING the call */}
          <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, color: '#6f6f6f', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Notes — draft the support ticket as the customer speaks</div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Summarise the issue, troubleshooting steps, and resolution..."
              style={{
                flex: 1, padding: 12, borderRadius: 6, border: '1px solid #2a2a2a',
                background: '#0d0d0d', color: '#e8e8e8', fontSize: 13, fontFamily: 'monospace',
                resize: 'none', outline: 'none', lineHeight: 1.6, width: '100%', boxSizing: 'border-box',
              }} />
          </div>
        </>
      )}

      {/* Note phase (after call ends) */}
      {phase === 'note' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Finalise Your Support Note</div>
          <div style={{ fontSize: 12, color: '#9f9f9f', marginBottom: 16 }}>Review and edit your notes, then submit for review.</div>
          <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
            placeholder="Summarise the issue, troubleshooting steps, and resolution..."
            rows={8}
            style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #333', background: '#0d0d0d', color: '#e8e8e8', fontSize: 13, fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button onClick={() => setPhase('call')} style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid #333', background: 'transparent', color: '#e8e8e8', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>← Back to Call</button>
            <button onClick={handleSubmitTicket} disabled={!noteText.trim() || analysing}
              style={{ padding: '10px 24px', borderRadius: 6, border: 'none', background: !noteText.trim() || analysing ? '#333' : '#004b8d', color: '#fff', fontSize: 14, fontWeight: 700, cursor: !noteText.trim() || analysing ? 'default' : 'pointer' }}>
              {analysing ? 'Analysing...' : 'Submit for Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
