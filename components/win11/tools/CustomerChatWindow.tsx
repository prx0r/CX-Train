'use client';

import { useState } from 'react';
import WindowFrame from '../WindowFrame';

interface Message {
  role: string; content: string;
}

interface CustomerChatWindowProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  sending: boolean;
  disabled: boolean;
}

export default function CustomerChatWindow({ messages, onSendMessage, sending, disabled }: CustomerChatWindowProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || sending) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <WindowFrame id="chat" name="Customer Chat — Sarah Thompson" icon="💬" defaultWidth={420} defaultHeight={520}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'candidate' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.4,
                background: m.role === 'candidate' ? '#2563eb' : '#333',
                color: m.role === 'candidate' ? '#fff' : '#d0d0d0',
                borderBottomRightRadius: m.role === 'candidate' ? 2 : 8,
                borderBottomLeftRadius: m.role === 'candidate' ? 8 : 2,
              }}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: 10, display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            disabled={disabled || sending}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#333',
              border: '1px solid #555',
              borderRadius: 6,
              color: '#d0d0d0',
              fontSize: 13,
            }}
          />
          <button
            onClick={handleSend}
            disabled={disabled || sending || !input.trim()}
            style={{
              padding: '8px 16px',
              background: sending ? '#555' : '#2563eb',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              cursor: sending ? 'default' : 'pointer',
            }}
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </WindowFrame>
  );
}
