import { readFileSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = join(process.cwd(), 'tests', 'fixtures', 'analysis-engine');
const TRANSCRIPTS = [
  { file: 'gold-mfa-unsafe', label: 'Gold Standard — Excellent MFA Handling', desc: 'Candidate handles MFA issue perfectly, prevents lockout, states they will never ask for password' },
  { file: 'tricky-perfect-but-abusive', label: 'Perfect Tech — Abusive Conduct', desc: 'Technically perfect troubleshooting but swears at customer' },
  { file: 'tricky-pii-over-phone', label: 'Polite but Unsafe — PII Leak', desc: 'Polite and helpful but asks for unnecessary PII, reads out password over phone' },
  { file: 'tricky-passive-aggressive', label: 'Subtle Conduct — Passive Aggressive', desc: 'Technically correct but condescending tone, sighs, dismissive language' },
  { file: 'tricky-ambiguous-pii', label: 'Borderline — Ambiguous PII', desc: 'Asks DOB for verification, handles password via email, obfuscates email address' },
];

export default function ResultsList() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 4 }}>Results Template — Design A</h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
        Clean card-based layout with summary, expandable rubric criteria, and coaching next steps.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {TRANSCRIPTS.map(t => (
          <a key={t.file} href={`/mvp/results/design-a?t=${t.file}`}
            style={{ display: 'block', padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 8, textDecoration: 'none', color: 'inherit', background: '#fff' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>{t.label}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{t.desc}</div>
          </a>
        ))}
      </div>
      <div style={{ marginTop: 24, fontSize: 11, color: '#9ca3af' }}>
        <a href="/mvp/results" style={{ color: '#2563eb' }}>← Back to results hub</a>
      </div>
    </div>
  );
}
