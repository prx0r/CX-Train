'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import CallumActionCard from './CallumActionCard';

interface CallumPanelProps {
  pageContext: {
    route: string;
    pageType: string;
    entity?: { type: string; id?: string };
    visibleSections?: string[];
    clientSummary?: {
      heading?: string;
      primaryLabel?: string;
      status?: string;
    };
  };
}

interface CallumResponse {
  type: 'answer' | 'proposed_action' | 'navigation';
  threadId: string;
  message: string;
  pendingActionId?: string;
  targetRoute?: string;
  action?: {
    type: string;
    payload: Record<string, unknown>;
  };
  dataGaps?: string[];
  confidence?: string;
}

export default function CallumPanel({ pageContext }: CallumPanelProps) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; response?: CallumResponse }>>([]);

  async function ask(messageOverride?: string) {
    const message = (messageOverride || input).trim();
    if (!message || loading) return;

    setLoading(true);
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    try {
      const res = await fetch('/api/mvp/callum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, message, pageContext }),
      });
      const data = await res.json();
      if (data.threadId) setThreadId(data.threadId);
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || data.error || 'Callum failed to answer.', response: data }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Callum failed to answer.' }]);
    }

    setLoading(false);
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #9f9f9f', borderRadius: 3, marginBottom: 16 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #b8b8b8', background: '#f4f4f4', fontWeight: 700, fontSize: 14, color: '#111' }}>
        Ask Callum
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button onClick={() => ask('Why did they score low?')} style={quickButtonStyle}>Why did they score low?</button>
          <button onClick={() => ask('Assign them something to improve this')} style={quickButtonStyle}>Suggest training</button>
        </div>

        {messages.length > 0 && (
          <div style={{ border: '1px solid #d0d0d0', background: '#fafafa', borderRadius: 3, padding: 10, marginBottom: 10, maxHeight: 260, overflow: 'auto' }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: m.role === 'user' ? '#004b8d' : '#0f5132', marginBottom: 3 }}>
                  {m.role === 'user' ? 'Manager' : 'Callum'}
                </div>
                <div style={{ fontSize: 13, color: '#222', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{m.content}</div>
                {m.response?.dataGaps && m.response.dataGaps.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#7a4f00' }}>
                    Data gaps: {m.response.dataGaps.join('; ')}
                  </div>
                )}
                {m.response?.type === 'proposed_action' && m.response.action && (
                  <CallumActionCard action={m.response.action} pendingActionId={m.response.pendingActionId} />
                )}
                {m.response?.type === 'navigation' && m.response.targetRoute && (
                  <a href={m.response.targetRoute} style={{ display: 'inline-block', marginTop: 6, fontSize: 12, color: '#004b8d', fontWeight: 700 }}>
                    Open {m.response.targetRoute}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about this assessment..."
            style={{ flex: 1, padding: '8px 10px', border: '1px solid #b8b8b8', borderRadius: 3, fontSize: 13, color: '#111', background: '#fff' }}
          />
          <button
            disabled={loading || !input.trim()}
            style={{ padding: '8px 12px', border: '1px solid #004b8d', borderRadius: 3, background: loading || !input.trim() ? '#d6d6d6' : '#004b8d', color: loading || !input.trim() ? '#777' : '#fff', fontSize: 13, fontWeight: 700 }}
          >
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  );
}

const quickButtonStyle: CSSProperties = {
  padding: '6px 9px',
  border: '1px solid #b8b8b8',
  borderRadius: 3,
  background: '#f4f4f4',
  color: '#111',
  fontSize: 12,
  cursor: 'pointer',
};
