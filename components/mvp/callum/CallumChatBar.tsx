'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface PromptChip { label: string; prompt: string; }
type CallumMode = 'overview' | 'assessments' | 'standards' | 'taxonomy' | 'system' | 'settings' | 'general';

function getCallumMode(pathname: string): { mode: CallumMode; label: string; prompts: PromptChip[] } {
  if (pathname.startsWith('/mvp/assessments/') && pathname.split('/').length > 3)
    return { mode: 'assessments', label: 'Reviewing assessment', prompts: [
      { label: 'Explain score', prompt: 'Why did they score this way?' },
      { label: 'Suggest training', prompt: 'What training would help them improve?' },
    ]};
  if (pathname.startsWith('/mvp/assessments'))
    return { mode: 'assessments', label: 'Assessments', prompts: [
      { label: 'Find at-risk', prompt: 'Which candidates need attention?' },
      { label: 'Recent results', prompt: 'Show me the latest results.' },
    ]};
  if (pathname.startsWith('/mvp/standards'))
    return { mode: 'standards', label: 'Standards', prompts: [
      { label: 'Current standards', prompt: 'What are the current standards?' },
    ]};
  if (pathname.startsWith('/mvp/taxonomy'))
    return { mode: 'taxonomy', label: 'Taxonomy', prompts: [
      { label: 'Taxonomy gaps', prompt: 'Are there gaps in our taxonomy?' },
    ]};
  if (pathname.startsWith('/mvp/system'))
    return { mode: 'system', label: 'System', prompts: [
      { label: 'System status', prompt: 'What is the system status?' },
    ]};
  return { mode: 'general', label: 'Dashboard', prompts: [
    { label: 'Platform overview', prompt: 'What can I do on this platform?' },
    { label: 'Recent activity', prompt: 'What happened recently?' },
  ]};
}

function ChatBarInner() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem('callum_messages') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { label: modeLabel, prompts } = useMemo(() => getCallumMode(pathname), [pathname]);

  useEffect(() => {
    try { localStorage.setItem('callum_messages', JSON.stringify(messages)); } catch {}
  }, [messages]);

  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* Inject spacing so page content isn't hidden behind fixed bar */
  useEffect(() => {
    const spacer = document.createElement('div');
    spacer.id = 'callum-spacer';
    spacer.style.height = '52px';
    document.body.appendChild(spacer);
    return () => { const s = document.getElementById('callum-spacer'); if (s) s.remove(); };
  }, []);

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
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || data.error || 'No response' }]);
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach Callum.' }]); }
    finally { setLoading(false); inputRef.current?.focus(); }
  }, [input, loading, pathname]);

  return (
    <>
      <style>{`
        @keyframes pulseDot { 0%,60%,100% { opacity:0.3; } 30% { opacity:1; } }
        .callum-scroll::-webkit-scrollbar { width: 4px; }
        .callum-scroll::-webkit-scrollbar-track { background: transparent; }
        .callum-scroll::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
      `}</style>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: '#18181b', borderTop: '1px solid #27272a',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.length > 0 && (
          <div className="callum-scroll" style={{
            maxHeight: 100, overflow: 'auto', padding: '4px 16px 0',
            display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            {messages.slice(-2).map((m, i) => (
              <div key={i} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.5,
                background: m.role === 'user' ? '#004b8d' : '#1f1f23',
                color: m.role === 'user' ? '#fff' : '#e4e4e7',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '75%', whiteSpace: 'pre-wrap',
              }}>{m.content}</div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '5px 10px', borderRadius: 6, background: '#1f1f23', fontSize: 12 }}>
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  <span style={{ animation: 'pulseDot 1.2s infinite', animationDelay: '0s' }}>●</span>
                  <span style={{ animation: 'pulseDot 1.2s infinite', animationDelay: '0.3s' }}>●</span>
                  <span style={{ animation: 'pulseDot 1.2s infinite', animationDelay: '0.6s' }}>●</span>
                </span>
              </div>
            )}
            <div ref={msgsEndRef} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px 8px' }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: 'linear-gradient(135deg,#004b8d,#0066b3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>C</div>
          <span style={{ fontSize: 11, color: '#52525b', whiteSpace: 'nowrap', flexShrink: 0 }}>{modeLabel}</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask Callum..."
            rows={1}
            style={{
              flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)', color: '#e4e4e7', fontSize: 13, fontFamily: 'system-ui',
              outline: 'none', resize: 'none', lineHeight: 1.5, minHeight: 20, maxHeight: 60,
            }}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: input.trim() && !loading ? '#004b8d' : 'rgba(255,255,255,0.06)',
            border: 'none', color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'default',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9Z"/></svg>
          </button>
          {prompts.slice(0, 2).map((p, i) => (
            <button key={i} onClick={() => send(p.prompt)} style={{
              padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              color: '#52525b', fontSize: 11, display: 'none',
            } as React.CSSProperties}
            className="md:block hidden"
            >{p.label}</button>
          ))}
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', fontSize: 13, padding: '4px', flexShrink: 0 }}>✕</button>
          )}
        </div>
      </div>
    </>
  );
}

export default function CallumChatBar() {
  const pathname = usePathname();
  /* Must be called before any conditional — React hooks rule */
  if (pathname.startsWith('/mvp/assessment/') || !pathname.startsWith('/mvp')) return null;
  return <ChatBarInner />;
}
