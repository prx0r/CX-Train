'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface PromptChip { label: string; prompt: string; }

interface PageContext { label: string; welcome: string; prompts: PromptChip[]; }

function getCallumMode(pathname: string): PageContext {
  if (pathname.startsWith('/mvp/assessments/') && pathname.split('/').length > 3)
    return {
      label: 'Reviewing assessment',
      welcome: "I can break down the candidate's score, highlight specific misses, and suggest targeted training. What would you like to know?",
      prompts: [
        { label: 'Explain score', prompt: 'Walk me through this assessment. What stands out?' },
        { label: 'Suggest training', prompt: 'What training would help them improve?' },
        { label: 'Key misses', prompt: 'What were the biggest misses?' },
      ],
    };
  if (pathname.startsWith('/mvp/assessments'))
    return {
      label: 'Assessments',
      welcome: "Here are all the assessments. I can help you find candidates who need attention or create a new one.",
      prompts: [
        { label: 'Find at-risk', prompt: 'Which candidates need the most attention?' },
        { label: 'Create assessment', prompt: 'Create a new hiring assessment.' },
        { label: 'Recent results', prompt: 'Show me the latest results.' },
      ],
    };
  if (pathname.startsWith('/mvp/standards'))
    return {
      label: 'Standards',
      welcome: 'This is where you configure assessment standards — required ticket fields, passing thresholds, and evaluation criteria.',
      prompts: [
        { label: 'Current standards', prompt: 'What are the current standards?' },
        { label: 'Update criteria', prompt: 'Help me update the evaluation criteria.' },
      ],
    };
  if (pathname.startsWith('/mvp/taxonomy'))
    return {
      label: 'Taxonomy',
      welcome: 'The taxonomy system categorises tickets by type, sub-type, and item. I can help you review and improve it.',
      prompts: [
        { label: 'Taxonomy gaps', prompt: 'Are there gaps in our ticket taxonomy?' },
        { label: 'Classification help', prompt: 'How does classification work?' },
      ],
    };
  return {
    label: 'Dashboard',
    welcome: "Hi, I'm Callum. I can help you manage assessments, review candidates, and suggest training. Try asking me something or click a nav tab above.",
    prompts: [
      { label: 'Show assessments', prompt: 'Show me all assessments.' },
      { label: 'Recent activity', prompt: 'What happened recently?' },
      { label: 'Create hiring test', prompt: 'Create a new hiring assessment.' },
    ],
  };
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/mvp', icon: '≡' },
  { label: 'Assessments', href: '/mvp/assessments', icon: '⚠' },
  { label: 'Voice Lab', href: '/mvp/voice-test', icon: '🎙' },
  { label: 'Standards', href: '/mvp/standards', icon: '⚙' },
  { label: 'Taxonomy', href: '/mvp/taxonomy', icon: '⊞' },
  { label: 'System', href: '/mvp/system', icon: '?' },
];

function ChatBarInner() {
  const pathname = usePathname();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem('callum_messages') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const msgsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { label: modeLabel, welcome, prompts } = useMemo(() => getCallumMode(pathname), [pathname]);

  useEffect(() => {
    try { localStorage.setItem('callum_messages', JSON.stringify(messages)); } catch {}
  }, [messages]);
  useEffect(() => { msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    const spacer = document.createElement('div');
    spacer.id = 'callum-spacer'; spacer.style.height = '140px';
    document.body.appendChild(spacer);
    return () => { const s = document.getElementById('callum-spacer'); if (s) s.remove(); };
  }, []);

  const thinkingSteps = [
    'Analysing request...', 'Loading context...', 'Computing response...',
  ];
  const [thinkingStep, setThinkingStep] = useState(0);

  useEffect(() => {
    if (!loading) { setThinkingStep(0); return; }
    const interval = setInterval(() => setThinkingStep(s => Math.min(s + 1, thinkingSteps.length - 1)), 1800);
    return () => clearInterval(interval);
  }, [loading]);

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
    finally { setLoading(false); inputRef.current?.focus(); }
  }, [input, loading, pathname, router]);

  return (
    <>
      <style>{`@keyframes pulseDot { 0%,60%,100% { opacity:0.3; } 30% { opacity:1; } }
        @keyframes callumSlide { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: 720, pointerEvents: 'auto',
          background: '#18181b', borderTop: '1px solid #27272a',
          borderLeft: '1px solid #27272a', borderRight: '1px solid #27272a',
          borderTopLeftRadius: 14, borderTopRightRadius: 14,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Navigation bar */}
          <div style={{
            display: 'flex', gap: 2, padding: '8px 12px 4px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            alignItems: 'center', overflow: 'auto',
          }}>
            <img src="/callcallum-logo.png" alt="" style={{ width: 20, height: 20, borderRadius: 4, marginRight: 6, flexShrink: 0 }} />
            {NAV_ITEMS.map(item => {
              const active = pathname === item.href || (item.href !== '/mvp' && pathname.startsWith(item.href));
              return (
                <button key={item.href} onClick={() => router.push(item.href)} style={{
                  padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                  fontSize: 12, transition: 'all 0.15s', border: 'none',
                  background: active ? 'rgba(0,75,141,0.2)' : 'transparent',
                  color: active ? '#60a5fa' : '#52525b', fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#a1a1aa'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#52525b'; } }}
                >{item.icon} {item.label}</button>
              );
            })}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#52525b' }}>{modeLabel}</span>
          </div>

          {/* Messages area */}
          <div style={{
            maxHeight: 200, overflow: 'auto',
            padding: messages.length > 0 ? '8px 12px 0' : '14px 16px 0',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {/* Welcome card when no messages */}
            {messages.length === 0 && !loading && (
              <div style={{ animation: 'callumSlide 0.3s ease-out', textAlign: 'center', padding: '4px 8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  <img src="/callcallum-logo.png" alt="" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#e4e4e7' }}>Callum</span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }} />
                </div>
                <div style={{ fontSize: 12.5, color: '#a1a1aa', lineHeight: 1.6, marginBottom: 12, maxWidth: 500, margin: '0 auto 12px' }}>
                  {welcome}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#52525b', padding: '4px 0' }}>Try:</span>
                  {prompts.slice(0, 3).map((p, i) => (
                    <button key={i} onClick={() => send(p.prompt)} style={{
                      padding: '5px 12px', borderRadius: 100, whiteSpace: 'nowrap', cursor: 'pointer',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: '#71717a', fontSize: 11.5, transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    >{p.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat messages */}
            {messages.slice(-3).map((m, i) => (
              <div key={i} style={{
                padding: '6px 10px', borderRadius: 6, fontSize: 12.5, lineHeight: 1.5,
                background: m.role === 'user' ? '#004b8d' : '#1f1f23',
                color: m.role === 'user' ? '#fff' : '#e4e4e7',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%', whiteSpace: 'pre-wrap',
              }}>{m.content}</div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 6, background: '#1f1f23', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ display: 'inline-flex', gap: 3 }}>
                    <span style={{ animation: 'pulseDot 1.2s infinite', animationDelay: '0s' }}>●</span>
                    <span style={{ animation: 'pulseDot 1.2s infinite', animationDelay: '0.3s' }}>●</span>
                    <span style={{ animation: 'pulseDot 1.2s infinite', animationDelay: '0.6s' }}>●</span>
                  </span>
                  <span style={{ color: '#52525b', fontSize: 11 }}>{thinkingSteps[thinkingStep]}</span>
                </div>
              </div>
            )}
            <div ref={msgsEndRef} />
          </div>

          {/* Input row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 10px' }}>
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

          {/* Suggestion chips */}
          {prompts.length > 0 && (
            <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px', overflow: 'auto', flexShrink: 0 }}>
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
          )}
        </div>
      </div>
    </>
  );
}

export default function CallumChatBar() {
  const pathname = usePathname();
  if (pathname.startsWith('/mvp/assessment/') || !pathname.startsWith('/mvp')) return null;
  return <ChatBarInner />;
}
