'use client';

import { useState, useRef } from 'react';

const KOKORO_VOICES = [
  { id: 'af_heart', label: 'Heart (US Female, warm)', desc: 'Warm, friendly — default' },
  { id: 'af_bella', label: 'Bella (US Female)', desc: 'Clear, professional' },
  { id: 'af_nicole', label: 'Nicole (US Female)', desc: 'Bright, cheerful' },
  { id: 'af_aoede', label: 'Aoede (US Female)', desc: 'Soft, calm' },
  { id: 'af_kore', label: 'Kore (US Female)', desc: 'Neutral, balanced' },
  { id: 'am_adam', label: 'Adam (US Male)', desc: 'Deep, authoritative' },
  { id: 'am_michael', label: 'Michael (US Male)', desc: 'Warm baritone' },
  { id: 'am_liam', label: 'Liam (US Male)', desc: 'Young, friendly' },
  { id: 'am_onyx', label: 'Onyx (US Male)', desc: 'Deep, resonant' },
  { id: 'bf_emma', label: 'Emma (British Female)', desc: 'Refined UK accent' },
  { id: 'bf_isabella', label: 'Isabella (British Female)', desc: 'Soft UK accent' },
  { id: 'bm_george', label: 'George (British Male)', desc: 'Proper UK accent' },
  { id: 'bm_lewis', label: 'Lewis (British Male)', desc: 'Casual UK accent' },
];

const TEST_PHRASES = [
  { label: 'Greeting', text: "Hello, thanks for calling. How can I help you today? I'm looking forward to resolving your issue." },
  { label: 'Urgent', text: "This is a critical situation. I'm escalating this immediately to our senior engineering team." },
  { label: 'Reassuring', text: "Don't worry, I've seen this before. Let me walk you through it step by step." },
  { label: 'Apologetic', text: "I'm really sorry about the inconvenience. I understand how frustrating this must be." },
  { label: 'Technical', text: "Can you try opening the settings menu and checking the network status under advanced options?" },
  { label: 'Callum intro', text: "Hi, I'm Callum. I can help you manage assessments, review candidates, and suggest training." },
  { label: 'Closing', text: "Is there anything else I can help you with? If not, I'll mark this as resolved." },
  { label: 'Long sentence', text: "I've checked your account and it looks like there's a temporary issue with the mail server. Let me try a few things to get this working for you." },
];

export default function VoiceTestPage() {
  const [selectedVoice, setSelectedVoice] = useState('af_heart');
  const [customText, setCustomText] = useState('');
  const [playing, setPlaying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function play(text: string) {
    if (!text.trim()) return;
    setPlaying(true);
    setLogs(prev => [...prev, `▶ "${text.slice(0, 50)}..."`]);
    try {
      const res = await fetch('/api/mvp/voice-test/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), voice: selectedVoice }),
      });
      if (!res.ok) {
        const errText = await res.text();
        setLogs(prev => [...prev, `  ✗ HTTP ${res.status}: ${errText}`]);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
      setLogs(prev => [...prev, `  ✓ ${(blob.size / 1024).toFixed(1)}KB`]);
    } catch (e: any) {
      setLogs(prev => [...prev, `  ✗ ${e.message}`]);
    } finally {
      setPlaying(false);
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Callum Voice Lab</div>
      <div style={{ fontSize: 12, color: '#52525b', marginBottom: 24 }}>Test Kokoro TTS voices with sample phrases</div>

      {/* Voice selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Voice</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {KOKORO_VOICES.map(v => (
            <button key={v.id} onClick={() => setSelectedVoice(v.id)} style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid',
              fontSize: 12, transition: 'all 0.15s', textAlign: 'left',
              background: selectedVoice === v.id ? 'rgba(0,75,141,0.2)' : 'rgba(255,255,255,0.04)',
              borderColor: selectedVoice === v.id ? 'rgba(0,75,141,0.3)' : 'rgba(255,255,255,0.06)',
              color: selectedVoice === v.id ? '#60a5fa' : '#a1a1aa',
              fontWeight: selectedVoice === v.id ? 600 : 400,
            }}>
              <div>{v.label}</div>
              <div style={{ fontSize: 10, opacity: 0.6 }}>{v.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Test phrases */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Test Phrases</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TEST_PHRASES.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{
                padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
                background: 'rgba(96,165,250,0.15)', color: '#60a5fa',
              }}>{p.label}</span>
              <span style={{ flex: 1, fontSize: 12, color: '#a1a1aa', lineHeight: 1.4 }}>{p.text}</span>
              <button onClick={() => play(p.text)} disabled={playing} style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.04)', color: '#e4e4e7', cursor: 'pointer', fontSize: 12, flexShrink: 0,
              }}>▶ Play</button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom text */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Custom Text</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="Type or paste text to speak..."
            rows={2}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)', color: '#e4e4e7', fontSize: 13, fontFamily: 'system-ui',
              outline: 'none', resize: 'vertical',
            }}
          />
          <button onClick={() => play(customText)} disabled={!customText.trim() || playing} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: customText.trim() && !playing ? '#004b8d' : 'rgba(255,255,255,0.06)',
            color: '#fff', cursor: customText.trim() && !playing ? 'pointer' : 'default', fontSize: 13, fontWeight: 600, alignSelf: 'flex-end',
          }}>▶ Play</button>
        </div>
      </div>

      {/* Log */}
      {logs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Log</div>
          <div style={{
            padding: 10, borderRadius: 8, background: '#0d0d0f', border: '1px solid rgba(255,255,255,0.04)',
            maxHeight: 200, overflow: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#71717a', lineHeight: 1.8,
          }}>
            {logs.map((l, i) => <div key={i}>{l}</div>)}
          </div>
          <button onClick={() => setLogs([])} style={{ marginTop: 4, background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', fontSize: 11 }}>Clear log</button>
        </div>
      )}

      <audio ref={audioRef} controls style={{ display: 'none' }} />
    </div>
  );
}
