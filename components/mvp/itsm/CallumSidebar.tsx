'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

function CallumSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname.startsWith('/mvp/assessment/') || !pathname.startsWith('/mvp')) return null;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem('callum_messages') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem('callum_messages', JSON.stringify(messages)); } catch {}
  }, [messages]);
  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const match = pathname.match(/\/mvp\/assessments\/([^/]+)/);
      const pageContext = match ? {
        schemaVersion: 'callum-page-context-v1', route: pathname,
        pageType: 'assessment_review' as const, entity: { type: 'assessment' as const, id: match[1] },
      } : null;
      const res = await fetch('/api/mvp/callum/v2', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, pageContext }),
      });
      const data = await res.json();
      if (data.type === 'navigation' && data.targetRoute) {
        router.push(data.targetRoute); return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || data.error || 'No response' }]);
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach Callum.' }]); }
    finally { setLoading(false); }
  }, [input, loading, pathname, router]);

  return (
    <div style={{
      borderTop: '1px solid #2f2f2f', padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
    }}>
      {/* Messages preview */}
      {messages.length > 0 && (
        <div style={{ maxHeight: 80, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 2 }}>
          {messages.slice(-2).map((m, i) => (
            <div key={i} style={{
              padding: '3px 6px', borderRadius: 3, fontSize: 10.5, lineHeight: 1.4,
              background: m.role === 'user' ? '#004b8d' : '#2f2f2f',
              color: '#ccc', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%', whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{m.content}</div>
          ))}
          {loading && <div style={{ padding: '3px 6px', fontSize: 10, color: '#999' }}>Thinking...</div>}
          <div ref={msgsEndRef} />
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          placeholder="Ask Callum..."
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 3, border: '1px solid #4a4a4a',
            background: '#000', color: '#ccc', fontSize: 11, outline: 'none', minWidth: 0,
          }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} style={{
          padding: '5px 8px', borderRadius: 3, border: '1px solid #004b8d',
          background: input.trim() && !loading ? '#004b8d' : '#2f2f2f',
          color: '#fff', fontSize: 11, cursor: input.trim() && !loading ? 'pointer' : 'default',
          flexShrink: 0, lineHeight: 1,
        }}>↵</button>
      </div>
    </div>
  );
}

export default CallumSidebar;
