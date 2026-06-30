'use client';

import { useState } from 'react';

interface TaxonomyItem {
  id: string; category: string; type: string; subType: string; item: string;
  definition_scope: string; playbook_steps: string; keywords: string[];
  helpdesk_tier: string; escalation_guidance: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  item?: TaxonomyItem;
}

function formatResponse(item: TaxonomyItem): string {
  const lines: string[] = [];
  lines.push(`**Classification:** ${item.category} / ${item.type} / ${item.subType} / ${item.item}`);
  lines.push(`**Item ID:** ${item.id}`);
  lines.push('');
  lines.push('**Use when:**');
  lines.push((item.definition_scope || '—').split(/\r?\n/).slice(0, 3).join('\n'));
  lines.push('');
  lines.push('**Ask these questions:**');
  const questions = (item.playbook_steps || '')
    .split(/\d\)|\.\s+/)
    .map(s => s.trim())
    .filter(s => s.endsWith('?'));
  if (questions.length > 0) {
    questions.slice(0, 5).forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  } else {
    const steps = (item.playbook_steps || '').split(/\d\)/).map(s => s.trim()).filter(Boolean);
    steps.slice(0, 5).forEach((s, i) => lines.push(`${i + 1}. ${s.slice(0, 120)}`));
  }
  lines.push('');
  lines.push(`**Owner:** ${item.helpdesk_tier || 'Not specified'}`);
  lines.push('');
  lines.push('**Escalate when:**');
  lines.push(item.escalation_guidance || 'Not specified — check with senior.');
  lines.push('');
  lines.push('**Evidence to capture:**');
  const pb = (item.playbook_steps || '').toLowerCase();
  const evidence: string[] = [];
  if (item.playbook_steps) {
    if (pb.includes('error')) evidence.push('Error message or screenshot');
    if (pb.includes('scope')) evidence.push('Affected scope (one user or many)');
    if (pb.includes('device') || pb.includes('hostname') || pb.includes('model')) evidence.push('Device/hostname details');
    if (pb.includes('impact')) evidence.push('Business impact');
  }
  if (evidence.length === 0) {
    const steps = item.playbook_steps?.split(/\d\)/).map(s => s.trim()).filter(Boolean) || [];
    if (steps.length > 1) evidence.push('Follow playbook steps 1–3 and capture results');
    else evidence.push('Document the issue details and steps taken');
  }
  evidence.forEach(e => lines.push(`- ${e}`));
  lines.push('');
  lines.push(`*Source: ${item.id}, fields used: definition_scope, playbook_steps, helpdesk_tier, escalation_guidance*`);
  return lines.join('\n');
}

export default function TaxonomyChat() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Ask me how to classify a ticket, what questions to ask, or when to escalate. I answer only from the taxonomy source of truth.' }
  ]);
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    if (!query.trim() || loading) return;
    const q = query.trim();
    setQuery('');
    setMessages(m => [...m, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/taxonomy/search?q=${encodeURIComponent(q)}&limit=3`);
      const data = await res.json();
      const results: TaxonomyItem[] = data.results || [];

      if (results.length === 0) {
        setMessages(m => [...m, {
          role: 'assistant',
          content: 'Not found in taxonomy. Could you clarify the issue? What type of ticket is this (Desktop/Laptop, Email, Security, etc.)? Or propose a new item.'
        }]);
      } else if (results.length === 1) {
        setMessages(m => [...m, { role: 'assistant', content: formatResponse(results[0]), item: results[0] }]);
      } else {
        let reply = 'I found multiple matching items. Which one best describes your issue?\n\n';
        results.forEach((r, i) => {
          reply += `${i + 1}. **${r.subType} → ${r.item}** (${r.type}, ${r.helpdesk_tier || 'Tier?'})\n   ${(r.definition_scope || '').slice(0, 100)}...\n\n`;
        });
        reply += 'Reply with the number or refine your search.';
        setMessages(m => [...m, { role: 'assistant', content: reply, item: results[0] }]);
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Error searching taxonomy. Please try again.' }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ padding: 24, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 13 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#f1f5f9' }}>Taxonomy Copilot</h1>
      <p style={{ color: '#64748b', marginBottom: 16 }}>Ask classification, playbook, or escalation questions. Answers from taxonomy source of truth only.</p>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, minHeight: 400, marginBottom: 12, overflow: 'auto' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 12, padding: '8px 12px', background: m.role === 'user' ? '#0f172a' : '#1a2332', borderRadius: 6, borderLeft: m.role === 'assistant' ? '3px solid #3b82f6' : '3px solid #64748b' }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>{m.role === 'user' ? 'You' : 'Taxonomy'}</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#e2e8f0', lineHeight: 1.5, fontFamily: 'inherit', margin: 0 }}>{m.content}</pre>
            </div>
          ))}
          {loading && <div style={{ color: '#64748b' }}>Searching taxonomy...</div>}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAsk()}
            placeholder="e.g. What do I do for an account lockout?"
            style={{ flex: 1, padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', fontSize: 13 }} />
          <button onClick={handleAsk} disabled={loading}
            style={{ padding: '8px 16px', background: '#3b82f6', border: 'none', borderRadius: 4, color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
            Ask
          </button>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['account lockout', 'printer not printing', 'VPN not connecting', 'keyboard issue', 'new starter setup'].map(suggestion => (
            <button key={suggestion} onClick={() => { setQuery(suggestion); }}
              style={{ padding: '4px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
