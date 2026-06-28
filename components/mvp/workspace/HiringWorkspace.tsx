'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import CallBar from '@/components/mvp/simulator/CallBar';
import { useCustomerAudio } from '@/components/mvp/voice/CustomerAudioPlayer';
import { useVoiceLoop } from '@/components/mvp/voice/useVoiceLoop';
import AssessmentResults, { type CandidateAnalysisResult } from '@/components/mvp/results/AssessmentResults';
import type { CustomerMood } from '@/lib/mvp/voice/tts';

type Message = { role: string; content: string };
type CallStatus = 'idle' | 'incoming' | 'active' | 'thinking' | 'speaking' | 'recording' | 'ended';

export interface HiringWorkspaceProps {
  token: string;
  mode: string;
  initialMessages: Message[];
  initialAnalysis?: CandidateAnalysisResult | null;
  hiringPack?: {
    id: string;
    title: string;
    customer: {
      name: string;
      company: string;
      openingLine: string;
      issue: string;
      role: string;
      temperament: string;
    };
  };
  ticket: {
    id: string;
    title: string;
    requesterName: string;
    company: string;
    description: string;
  };
}

const containerStyle: React.CSSProperties = {
  height: '100vh', display: 'flex', flexDirection: 'column',
  background: '#111', color: '#e8e8e8', fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
};

const msgBubbleStyle = (role: string): React.CSSProperties => ({
  maxWidth: '70%', padding: '10px 14px', borderRadius: 8,
  background: role === 'caller' ? '#2a2a2a' : '#004b8d',
  color: role === 'caller' ? '#e8e8e8' : '#fff',
  alignSelf: role === 'caller' ? 'flex-start' : 'flex-end',
  fontSize: 13, lineHeight: 1.5,
});

export default function HiringWorkspace({
  token, initialMessages, initialAnalysis, hiringPack, ticket,
}: HiringWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [callStatus, setCallStatus] = useState<CallStatus>('incoming');
  const [noteText, setNoteText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<CandidateAnalysisResult | null>(initialAnalysis || null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState('');
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [sending, setSending] = useState(false);
  const ttsEndedAtRef = useRef<number | null>(null);
  const responseStartedAtRef = useRef<number | null>(null);
  const callStartedRef = useRef(false);

  const { speak, setOnPlaying, setOnTtsEnd } = useCustomerAudio(token);
  setOnPlaying(setTtsPlaying);
  setOnTtsEnd((ms: number) => { ttsEndedAtRef.current = ms; responseStartedAtRef.current = null; });

  /* Low-latency voice loop — VAD + partial STT + streaming LLM + early TTS */
  const { listening: vadListening, speaking: vadSpeaking, startListening, stopListening } = useVoiceLoop({
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

  /* Auto-start the call on mount — hiring calls begin immediately */
  useEffect(() => {
    if (callStartedRef.current) return;
    callStartedRef.current = true;

    async function startCall() {
      setCallStatus('active');
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'system', content: '__answer_call__' }),
      });
      const d = await res.json();
      if (d.reply) {
        setMessages(prev => [...prev, { role: 'caller', content: d.reply }]);
        speak(d.reply, 'frustrated', 3).catch(() => {});
      }
    }
    startCall();
  }, [token, speak]);

  /* Auto-play the opening message if it exists */
  useEffect(() => {
    const firstCallerMsg = messages.find(m => m.role === 'caller');
    if (firstCallerMsg && !messages.find(m => m.role === 'candidate')) {
      speak(firstCallerMsg.content, 'frustrated', 3).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Start voice loop when call goes active, stop when ended */
  useEffect(() => {
    if (callStatus === 'active' && !vadListening) {
      startListening();
    }
    if (callStatus === 'ended' && vadListening) {
      stopListening();
    }
  }, [callStatus, vadListening, startListening, stopListening]);

  const handleTextSubmit = useCallback(async () => {
    const text = (document.querySelector('[data-candidate-input]') as HTMLTextAreaElement)?.value;
    if (!text?.trim() || sending) return;
    const userMsg = text.trim();
    (document.querySelector('[data-candidate-input]') as HTMLTextAreaElement).value = '';
    setMessages(prev => [...prev, { role: 'candidate', content: userMsg }]);
    setSending(true);
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'candidate', content: userMsg }),
      });
      const d = await res.json();
      if (d.reply) {
        setMessages(prev => [...prev, { role: 'caller', content: d.reply }]);
        speak(d.reply, 'frustrated', 3).catch(() => {});
      }
    } finally { setSending(false); }
  }, [token, speak, sending]);

  const endCall = useCallback(async () => {
    stopListening();
    setCallStatus('ended');
    setMessages(prev => [...prev, { role: 'system', content: '📞 Call ended. Write your support note below.' }]);
  }, [stopListening]);

  const handleSubmitTicket = useCallback(async () => {
    if (!noteText.trim() || analysing) return;
    setAnalysing(true);
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      {/* Customer info card */}
      <div style={{ padding: '16px 24px', background: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{customerName}</div>
            <div style={{ fontSize: 12, color: '#9f9f9f' }}>{customerCompany} · {temperament}</div>
          </div>
          <div style={{ fontSize: 12, color: '#9f9f9f', textAlign: 'right' }}>
            <div>{customerIssue}</div>
          </div>
        </div>
      </div>

      {/* Call bar */}
      <div style={{ padding: '8px 24px', background: '#0d0d0d' }}>
        <CallBar
          status={callStatus}
          callerName={customerName}
          onStartCall={() => {}}
          onEndCall={endCall}
        />
      </div>

      {/* Conversation */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          m.role === 'system' ? (
            <div key={i} style={{ textAlign: 'center', fontSize: 12, color: '#6f6f6f', padding: '8px 0' }}>
              {m.content}
            </div>
          ) : (
            <div key={i} style={msgBubbleStyle(m.role)}>{m.content}</div>
          )
        ))}
        {analysing && <div style={{ textAlign: 'center', fontSize: 12, color: '#6f6f6f' }}>Analysing your response...</div>}
        <div style={{ height: 120 }} />
      </div>

      {/* Text input during call */}
      {callStatus === 'active' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 24px', background: '#1a1a1a', borderTop: '1px solid #2a2a2a' }}>
          <textarea
            data-candidate-input
            placeholder="Type your response..."
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); } }}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 4, border: '1px solid #333',
              background: '#0d0d0d', color: '#e8e8e8', fontSize: 13, fontFamily: 'system-ui',
              resize: 'none', outline: 'none', minHeight: 20, maxHeight: 120, boxSizing: 'border-box',
            }}
            rows={1}
          />
        </div>
      )}

      {/* Support note after call */}
      {callStatus === 'ended' && !submitted && (
        <div style={{ padding: '12px 24px', background: '#1a1a1a', borderTop: '1px solid #2a2a2a', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#9f9f9f' }}>Support Note — what happened, what you checked, what was the outcome</div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Summarise the issue, troubleshooting steps, and resolution..."
              style={{
                width: '100%', minHeight: 80, padding: 12, borderRadius: 4, border: '1px solid #333',
                background: '#0d0d0d', color: '#e8e8e8', fontSize: 13, fontFamily: 'monospace', resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={handleSubmitTicket}
            disabled={!noteText.trim() || analysing}
            style={{
              padding: '10px 24px', background: '#004b8d', color: '#fff', border: 'none', borderRadius: 4,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              opacity: !noteText.trim() || analysing ? 0.5 : 1, alignSelf: 'flex-end',
            }}
          >
            {analysing ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      )}

      {/* Assessment checklist */}
      {callStatus === 'active' && (
        <div style={{ position: 'fixed', right: 16, top: 100, width: 200, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, padding: 12, fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: '#9f9f9f' }}>Assessment Checklist</div>
          {['Handle professionally', 'Ask questions to understand', 'Troubleshoot the issue', 'Leave a clear note'].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <span style={{ color: '#5a5a5a' }}>☐</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
