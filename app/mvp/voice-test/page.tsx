'use client';

import { useState, useRef } from 'react';

const AZURE_VOICES = [
  { id: 'en-GB-SoniaNeural', label: 'Sonia (British, Female)', styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whisper', 'chat', 'customerservice', 'newscast', 'narration'] },
  { id: 'en-GB-RyanNeural', label: 'Ryan (British, Male)', styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whisper', 'chat', 'customerservice', 'newscast', 'narration'] },
  { id: 'en-US-JennyNeural', label: 'Jenny (US, Female)', styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whisper', 'chat', 'customerservice', 'newscast', 'narration'] },
  { id: 'en-US-GuyNeural', label: 'Guy (US, Male)', styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whisper', 'chat', 'customerservice', 'newscast', 'narration'] },
  { id: 'en-AU-NatashaNeural', label: 'Natasha (Australian, Female)', styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whisper', 'chat', 'customerservice', 'newscast', 'narration'] },
  { id: 'en-AU-WilliamNeural', label: 'William (Australian, Male)', styles: ['angry', 'cheerful', 'excited', 'friendly', 'hopeful', 'sad', 'shouting', 'terrified', 'unfriendly', 'whisper', 'chat', 'customerservice', 'newscast', 'narration'] },
];

const EMOTIONS = [
  { id: 'cheerful', label: 'Cheerful', icon: '😊', color: '#f59e0b' },
  { id: 'friendly', label: 'Friendly', icon: '🤝', color: '#22c55e' },
  { id: 'hopeful', label: 'Hopeful', icon: '🌟', color: '#60a5fa' },
  { id: 'excited', label: 'Excited', icon: '🎉', color: '#a78bfa' },
  { id: 'chat', label: 'Chat', icon: '💬', color: '#06b6d4' },
  { id: 'customerservice', label: 'Service', icon: '🎧', color: '#f97316' },
  { id: 'narration', label: 'Narration', icon: '🎙', color: '#8b5cf6' },
  { id: 'newscast', label: 'Newscast', icon: '📰', color: '#6b7280' },
  { id: 'sad', label: 'Sad', icon: '😢', color: '#6366f1' },
  { id: 'angry', label: 'Angry', icon: '😠', color: '#ef4444' },
  { id: 'whisper', label: 'Whisper', icon: '🤫', color: '#a1a1aa' },
  { id: 'shouting', label: 'Shouting', icon: '📢', color: '#dc2626' },
];

const TEST_PHRASES = [
  { label: 'Greeting', text: "Hello, thanks for calling. How can I help you today? I'm looking forward to resolving your issue.", emotion: 'friendly' },
  { label: 'Frustrated', text: "I've been waiting for hours and this still isn't working. I really need this sorted out right now.", emotion: 'angry' },
  { label: 'Reassuring', text: "Don't worry, I've seen this before and it's usually a quick fix. Let me walk you through it step by step.", emotion: 'cheerful' },
  { label: 'Apologetic', text: "I'm really sorry about the inconvenience. I understand how frustrating this must be for you.", emotion: 'sad' },
  { label: 'Urgent', text: "This is a critical issue. I'm going to escalate this to our senior team right away and we'll prioritise it.", emotion: 'excited' },
  { label: 'Technical', text: "Can you try opening the settings menu and checking the network status under advanced options?", emotion: 'chat' },
  { label: 'Closing', text: "Is there anything else I can help you with? If not, I'll mark this as resolved and you'll receive a summary by email.", emotion: 'friendly' },
  { label: 'Callum intro', text: "Hi, I'm Callum. I can help you manage assessments, review candidates, and suggest training. What would you like to do?", emotion: 'cheerful' },
];

export default function VoiceTestPage() {
  const [selectedVoice, setSelectedVoice] = useState(AZURE_VOICES[0].id);
  const [selectedEmotion, setSelectedEmotion] = useState('cheerful');
  const [customText, setCustomText] = useState('');
  const [playing, setPlaying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  async function play(text: string, emotion: string) {
    if (!text.trim()) return;
    setPlaying(true);
    const label = `[${emotion}] "${text.slice(0, 40)}..."`;
    setLogs(prev => [...prev, `▶ ${label}`]);
    try {
      const res = await fetch('/api/mvp/voice-test/tts', {  // we'll create this
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          azure_voice: selectedVoice,
          azure_style: emotion,
          intensity: 3,
        }),
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
      setLogs(prev => [...prev, `  ✓ Played (${(blob.size / 1024).toFixed(1)}KB)`]);
    } catch (e: any) {
      setLogs(prev => [...prev, `  ✗ ${e.message}`]);
    } finally {
      setPlaying(false);
    }
  }

  const currentVoice = AZURE_VOICES.find(v => v.id === selectedVoice);
  const availableStyles = currentVoice?.styles || [];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Callum Voice Lab</div>
      <div style={{ fontSize: 12, color: '#52525b', marginBottom: 24 }}>Test Azure TTS voices, emotions, and sample phrases</div>

      {/* Voice selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Voice</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AZURE_VOICES.map(v => (
            <button key={v.id} onClick={() => setSelectedVoice(v.id)} style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid',
              fontSize: 12, transition: 'all 0.15s',
              background: selectedVoice === v.id ? 'rgba(0,75,141,0.2)' : 'rgba(255,255,255,0.04)',
              borderColor: selectedVoice === v.id ? 'rgba(0,75,141,0.3)' : 'rgba(255,255,255,0.06)',
              color: selectedVoice === v.id ? '#60a5fa' : '#a1a1aa',
              fontWeight: selectedVoice === v.id ? 600 : 400,
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* Emotion grid */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Emotion / Style {!availableStyles.includes(selectedEmotion) && <span style={{ color: '#f59e0b' }}>(not all voices support this style)</span>}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EMOTIONS.map(e => {
            const supported = availableStyles.includes(e.id);
            return (
              <button key={e.id} onClick={() => setSelectedEmotion(e.id)} style={{
                padding: '6px 12px', borderRadius: 8, cursor: supported ? 'pointer' : 'not-allowed',
                border: '1px solid', fontSize: 12, transition: 'all 0.15s', opacity: supported ? 1 : 0.3,
                background: selectedEmotion === e.id ? `${e.color}22` : 'rgba(255,255,255,0.04)',
                borderColor: selectedEmotion === e.id ? e.color : 'rgba(255,255,255,0.06)',
                color: selectedEmotion === e.id ? e.color : '#a1a1aa',
                fontWeight: selectedEmotion === e.id ? 600 : 400,
              }}>
                {e.icon} {e.label}
              </button>
            );
          })}
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
                background: `${EMOTIONS.find(e => e.id === (p.emotion))?.color}22` || 'rgba(255,255,255,0.04)',
                color: EMOTIONS.find(e => e.id === (p.emotion))?.color || '#a1a1aa',
              }}>{p.label}</span>
              <span style={{ flex: 1, fontSize: 12, color: '#a1a1aa', lineHeight: 1.4 }}>{p.text}</span>
              <button onClick={() => play(p.text, p.emotion)} disabled={playing} style={{
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
          <button onClick={() => play(customText, selectedEmotion)} disabled={!customText.trim() || playing} style={{
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
