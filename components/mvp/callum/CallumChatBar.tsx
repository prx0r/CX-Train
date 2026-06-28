'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface PromptChip { label: string; prompt: string; }

function getCallumMode(pathname: string): { label: string; prompts: PromptChip[] } {
  if (pathname.startsWith('/mvp/assessments/') && pathname.split('/').length > 3)
    return { label: 'Reviewing assessment', prompts: [
      { label: 'Explain score', prompt: 'Why did they score this way?' },
      { label: 'Suggest training', prompt: 'What training would help them improve?' },
    ]};
  if (pathname.startsWith('/mvp/assessments'))
    return { label: 'Assessments', prompts: [
      { label: 'Show all', prompt: 'Show me all assessments.' },
      { label: 'Find at-risk', prompt: 'Which candidates need attention?' },
    ]};
  if (pathname.startsWith('/mvp/standards'))
    return { label: 'Standards', prompts: [{ label: 'Current standards', prompt: 'What are the current standards?' }]};
  return { label: 'Dashboard', prompts: [
    { label: 'Show assessments', prompt: 'Show me the assessments.' },
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
  useEffect(() => {
    const spacer = document.createElement('div');
    spacer.id = 'callum-spacer'; spacer.style.height = '120px';
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
      if (data.type === 'navigation' && data.targetRoute) {
        window.location.href = data.targetRoute; return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || data.error || 'No response' }]);
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach Callum.' }]); }
    finally { setLoading(false); inputRef.current?.focus(); }
  }, [input, loading, pathname]);

  return (
    <>
      <style>{`@keyframes pulseDot { 0%,60%,100% { opacity:0.3; } 30% { opacity:1; } }`}</style>

      {/* Navigation icons — floating above the chat bar */}
      <div style={{
        position: 'fixed', bottom: 106, left: 0, right: 0, zIndex: 9998,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex', gap: 6, padding: '6px 10px', pointerEvents: 'auto',
          background: 'rgba(24,24,27,0.7)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
          alignItems: 'center',
        }}>
          <NavIcon href="/mvp" icon="≡" label="Dashboard" active={pathname === '/mvp'} />
          <span style={{ width: 1, height: 14, background: '#27272a', flexShrink: 0 }} />
          <NavIcon href="/mvp/assessments" icon="⚠" label="Assessments" active={pathname.startsWith('/mvp/assessments')} />
          <NavIcon href="/mvp/standards" icon="⚙" label="Standards" active={pathname.startsWith('/mvp/standards')} />
          <NavIcon href="/mvp/taxonomy" icon="⊞" label="Taxonomy" active={pathname.startsWith('/mvp/taxonomy')} />
          <NavIcon href="/mvp/system" icon="?" label="System" active={pathname.startsWith('/mvp/system')} />
          <span style={{ width: 1, height: 14, background: '#27272a', flexShrink: 0 }} />
          {prompts.map((p, i) => (
            <button key={i} onClick={() => send(p.prompt)} style={{
              padding: '4px 10px', borderRadius: 100, whiteSpace: 'nowrap', cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              color: '#52525b', fontSize: 11, transition: 'background 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {/* Chat bar — at the bottom */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: 680, pointerEvents: 'auto',
          background: '#18181b', borderTop: '1px solid #27272a',
          borderLeft: '1px solid #27272a', borderRight: '1px solid #27272a',
          borderTopLeftRadius: 12, borderTopRightRadius: 12,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Message preview */}
          {messages.length > 0 && (
            <div style={{ maxHeight: 100, overflow: 'auto', padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {messages.slice(-2).map((m, i) => (
                <div key={i} style={{
                  padding: '6px 10px', borderRadius: 6, fontSize: 12.5, lineHeight: 1.5,
                  background: m.role === 'user' ? '#004b8d' : '#1f1f23',
                  color: m.role === 'user' ? '#fff' : '#e4e4e7',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%', whiteSpace: 'pre-wrap',
                }}>{m.content}</div>
              ))}
              {loading && (
                <div style={{ alignSelf: 'flex-start', padding: '6px 10px', borderRadius: 6, background: '#1f1f23', fontSize: 12 }}>
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

          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
            <img src="/callcallum-logo.png" alt="" style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0 }} />
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Callum..."
              rows={1}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)', color: '#e4e4e7', fontSize: 13.5, fontFamily: 'system-ui',
                outline: 'none', resize: 'none', lineHeight: 1.5, minHeight: 20, maxHeight: 60,
              }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: input.trim() && !loading ? '#004b8d' : 'rgba(255,255,255,0.06)',
              border: 'none', color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'default',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9Z"/></svg>
            </button>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', fontSize: 14, padding: 4, flexShrink: 0 }}>✕</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function NavIcon({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <a href={href} title={label} style={{
      width: 30, height: 30, borderRadius: 8, textDecoration: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
      background: active ? 'rgba(0,75,141,0.2)' : 'transparent',
      border: `1px solid ${active ? 'rgba(0,75,141,0.3)' : 'transparent'}`,
      color: active ? '#60a5fa' : '#52525b',
    }}
    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#a1a1aa'; } }}
    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525b'; } }}
    >{icon}</a>
  );
}

export default function CallumChatBar() {
  const pathname = usePathname();
  if (pathname.startsWith('/mvp/assessment/') || !pathname.startsWith('/mvp')) return null;
  return <ChatBarInner />;
}
