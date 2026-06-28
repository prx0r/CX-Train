'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const barOuterStyle: React.CSSProperties = {
  position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
  background: '#18181b', borderTop: '1px solid #27272a',
  boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
  display: 'flex', flexDirection: 'column',
};

const msgScrollerStyle: React.CSSProperties = {
  maxHeight: 240, overflow: 'auto',
  display: 'flex', flexDirection: 'column', gap: 6,
  padding: '8px 16px 0',
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 16px 12px',
};

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #27272a',
  background: '#0f0f0f', color: '#e4e4e7', fontSize: 13, fontFamily: 'system-ui',
  outline: 'none', resize: 'none', lineHeight: 1.5,
};

export default function CallumChatBar() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('callum_messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { localStorage.setItem('callum_messages', JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const path = window.location.pathname;
      const match = path.match(/\/mvp\/assessments\/([^/]+)/);
      const pageContext = match ? {
        schemaVersion: 'callum-page-context-v1',
        route: path, pageType: 'assessment_review' as const,
        entity: { type: 'assessment' as const, id: match[1] },
      } : null;

      const res = await fetch('/api/mvp/callum/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, pageContext }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || data.error || 'No response' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach Callum. Check your connection.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading]);

  return (
    <div style={barOuterStyle}>
      {messages.length > 0 && (
        <div style={msgScrollerStyle}>
          {messages.map((m, i) => (
            <div key={i} style={{
              maxWidth: '80%', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.6,
              background: m.role === 'user' ? '#004b8d' : '#1f1f23',
              color: m.role === 'user' ? '#fff' : '#e4e4e7',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 8, background: '#1f1f23', fontSize: 12.5 }}>
              <span style={{ display: 'inline-flex', gap: 3 }}>
                <span style={{ animation: 'pulse 1.2s infinite', animationDelay: '0s' }}>·</span>
                <span style={{ animation: 'pulse 1.2s infinite', animationDelay: '0.3s' }}>·</span>
                <span style={{ animation: 'pulse 1.2s infinite', animationDelay: '0.6s' }}>·</span>
              </span>
              <style>{`@keyframes pulse { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }`}</style>
            </div>
          )}
          <div ref={msgsEndRef} />
        </div>
      )}

      <div style={inputRowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa' }}>Callum</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
        </div>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask Callum anything about assessments, training, or the platform..."
          rows={1}
          style={inputStyle}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: input.trim() && !loading ? '#004b8d' : '#27272a',
            border: 'none', color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9Z"/>
          </svg>
        </button>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{ background: 'none', border: 'none', color: '#52525b', fontSize: 11, cursor: 'pointer', padding: '4px', flexShrink: 0 }}
            title="Clear chat"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
