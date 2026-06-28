'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PromptChip {
  label: string;
  prompt: string;
}

type CallumMode = 'overview' | 'assessments' | 'standards' | 'taxonomy' | 'system' | 'settings' | 'general';

function getCallumMode(pathname: string): { mode: CallumMode; label: string; prompts: PromptChip[] } {
  if (pathname.startsWith('/mvp/assessments/') && pathname.split('/').length > 3) {
    return {
      mode: 'assessments',
      label: 'Reviewing an assessment',
      prompts: [
        { label: 'Explain score', prompt: 'Why did they score this way? Break down the strengths and weaknesses.' },
        { label: 'Suggest training', prompt: 'What training would help them improve?' },
        { label: 'Compare to standard', prompt: 'How does this compare to the expected standard?' },
        { label: 'Next steps', prompt: 'What should I focus on with this candidate?' },
      ],
    };
  }
  if (pathname.startsWith('/mvp/assessments')) {
    return {
      mode: 'assessments',
      label: 'Assessment list',
      prompts: [
        { label: 'Find at-risk', prompt: 'Which candidates need the most attention?' },
        { label: 'Recent results', prompt: 'Show me the latest assessment results.' },
        { label: 'Create assessment', prompt: 'Help me create a new assessment for a candidate.' },
      ],
    };
  }
  if (pathname.startsWith('/mvp/standards')) {
    return {
      mode: 'standards',
      label: 'Standards configuration',
      prompts: [
        { label: 'Current standards', prompt: 'What are the current assessment standards?' },
        { label: 'Suggested changes', prompt: 'What standards should I update based on recent results?' },
        { label: 'Compare teams', prompt: 'How do our standards compare to industry benchmarks?' },
      ],
    };
  }
  if (pathname.startsWith('/mvp/taxonomy')) {
    return {
      mode: 'taxonomy',
      label: 'Taxonomy management',
      prompts: [
        { label: 'Taxonomy gaps', prompt: 'Are there gaps in our ticket taxonomy?' },
        { label: 'Improve classification', prompt: 'How can I improve ticket classification?' },
      ],
    };
  }
  if (pathname.startsWith('/mvp/system')) {
    return {
      mode: 'system',
      label: 'System overview',
      prompts: [
        { label: 'System status', prompt: 'What is the current system status?' },
        { label: 'Module info', prompt: 'Tell me about the platform modules.' },
      ],
    };
  }
  return {
    mode: 'general',
    label: 'Dashboard',
    prompts: [
      { label: 'Platform overview', prompt: 'What can I do on this platform?' },
      { label: 'Recent activity', prompt: 'What happened recently?' },
      { label: 'Help me start', prompt: 'I\'m new here — walk me through the platform.' },
    ],
  };
}

export default function CallumChatBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const match = pathname.match(/\/mvp\/assessments\/([^/]+)/);
      const pageContext = match ? {
        schemaVersion: 'callum-page-context-v1',
        route: pathname, pageType: 'assessment_review' as const,
        entity: { type: 'assessment' as const, id: match[1] },
      } : null;

      const res = await fetch('/api/mvp/callum/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, pageContext }),
      });
      const data = await res.json();
      const reply = data.message || data.error || 'No response';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach Callum.' }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, pathname]);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px 10px 14px',
            borderRadius: 100, border: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(135deg, #1a1a1e 0%, #18181b 100%)',
            color: '#e4e4e7', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
            backdropFilter: 'blur(12px)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Ask Callum</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }} />
        </button>
      )}

      {open && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 420, maxHeight: 600,
          display: 'flex', flexDirection: 'column',
          background: '#18181b', borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
          animation: 'callumSlideUp 0.2s ease-out',
        }}>
          <style>{`
            @keyframes callumSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes callumPulse { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }
            .callum-scroll::-webkit-scrollbar { width: 4px; }
            .callum-scroll::-webkit-scrollbar-track { background: transparent; }
            .callum-scroll::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg, #004b8d, #0066b3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 700, color: '#fff',
              }}>C</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e4e4e7', lineHeight: 1.3 }}>Callum</div>
                <div style={{ fontSize: 11, color: '#52525b', lineHeight: 1.3 }}>
                  {modeLabel} · <span style={{ color: '#22c55e' }}>online</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} style={{ background: 'none', border: 'none', color: '#52525b', fontSize: 18, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1 }} title="Clear">🗑</button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#52525b', fontSize: 18, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>✕</button>
            </div>
          </div>

          {/* Messages */}
          <div className="callum-scroll" style={{
            flex: 1, overflow: 'auto', padding: '12px 16px 8px',
            display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px 24px' }}>
                <div style={{ fontSize: 13, color: '#52525b', lineHeight: 1.6, marginBottom: 20 }}>
                  Ask me anything about assessments, candidates, or the platform.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {prompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => send(p.prompt)}
                      style={{
                        padding: '10px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                        color: '#a1a1aa', fontSize: 12.5, lineHeight: 1.5, transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      {p.label}
                      <span style={{ display: 'block', fontSize: 11, color: '#52525b', marginTop: 2 }}>{p.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                maxWidth: '88%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6,
                background: m.role === 'user' ? '#004b8d' : 'rgba(255,255,255,0.04)',
                color: m.role === 'user' ? '#fff' : '#e4e4e7',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                borderBottomRightRadius: m.role === 'user' ? 4 : 12,
                borderBottomLeftRadius: m.role === 'user' ? 12 : 4,
                whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-start', padding: '12px 16px', borderRadius: 12,
                borderBottomLeftRadius: 4, background: 'rgba(255,255,255,0.04)', fontSize: 13,
              }}>
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <span style={{ animation: 'callumPulse 1.2s infinite', animationDelay: '0s' }}>●</span>
                  <span style={{ animation: 'callumPulse 1.2s infinite', animationDelay: '0.3s' }}>●</span>
                  <span style={{ animation: 'callumPulse 1.2s infinite', animationDelay: '0.6s' }}>●</span>
                </span>
              </div>
            )}
            <div ref={msgsEndRef} />
          </div>

          {/* Prompt chips (shown after messages exist) */}
          {messages.length > 0 && (
            <div style={{ padding: '4px 16px 0', display: 'flex', gap: 6, overflow: 'auto', flexShrink: 0 }}>
              {prompts.slice(0, 3).map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p.prompt)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, whiteSpace: 'nowrap', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#71717a', fontSize: 11, transition: 'background 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '10px 16px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Callum anything..."
              rows={1}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)', color: '#e4e4e7', fontSize: 13, fontFamily: 'system-ui',
                outline: 'none', resize: 'none', lineHeight: 1.5, minHeight: 20, maxHeight: 120,
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: input.trim() && !loading ? '#004b8d' : 'rgba(255,255,255,0.06)',
                border: 'none', color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'default',
                transition: 'background 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9Z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
