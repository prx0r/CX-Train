'use client';

import { useEffect, useRef } from 'react';

type CallStatus = 'idle' | 'incoming' | 'active' | 'thinking' | 'speaking' | 'recording' | 'ended';

function playTeamsRingtone(audioCtx: AudioContext) {
  const now = audioCtx.currentTime;
  const notes = [523, 466]; // C5, Bb4 — classic two-tone ring
  const noteLen = 0.15;
  const gap = 0.1;
  const repeatEvery = 3.5;
  const patternLen = notes.length * (noteLen + gap);

  for (let r = 0; r < 4; r++) {
    const start = now + r * repeatEvery;
    notes.forEach((freq, i) => {
      const t = start + i * (noteLen + gap);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteLen);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + noteLen + 0.01);
    });
  }
}

export default function CallBar({ status, callerName, onStartCall, onEndCall, micButton }: {
  status: CallStatus;
  callerName: string;
  onStartCall?: () => void;
  onEndCall?: () => void;
  micButton?: React.ReactNode;
}) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (status === 'incoming') {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      playTeamsRingtone(audioCtxRef.current);
    }
  }, [status]);

  const statusStyles: Record<CallStatus, { bg: string; text: string; label: string }> = {
    idle: { bg: '#ffffff', text: '#525252', label: 'No active call' },
    incoming: { bg: '#ffffff', text: '#111111', label: `Incoming call from ${callerName}` },
    active: { bg: '#ffffff', text: '#0f5132', label: `Connected to ${callerName}` },
    thinking: { bg: '#ffffff', text: '#7a4f00', label: `${callerName} is responding` },
    speaking: { bg: '#ffffff', text: '#0f5132', label: `${callerName} is speaking` },
    recording: { bg: '#ffffff', text: '#842029', label: 'Recording' },
    ended: { bg: '#ffffff', text: '#525252', label: 'Call ended' },
  };

  const s = statusStyles[status];

  return (
    <div style={{
      height: 48, background: s.bg, borderBottom: '1px solid #b8b8b8',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10,
      flexShrink: 0, zIndex: 100,
    }}>
      <img src="/callcallum-logo.png" alt=""
        style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px #d4d4d4', flexShrink: 0 }} />
      <div style={{ fontSize: 13, color: s.text, fontWeight: 500, flex: 1 }}>{s.label}</div>
      {status === 'incoming' && onStartCall && (
        <button onClick={onStartCall} style={{
          padding: '6px 20px', background: '#111', color: '#fff', border: '1px solid #111',
          borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>
          Answer Call
        </button>
      )}
      {(status === 'active' || status === 'thinking' || status === 'speaking' || status === 'recording') && (
        <>
          {micButton}
          {onEndCall && (
            <button onClick={onEndCall} style={{
              padding: '6px 16px', background: '#dc2626', color: '#fff', border: 'none',
              borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              End Call
            </button>
          )}
        </>
      )}
    </div>
  );
}
