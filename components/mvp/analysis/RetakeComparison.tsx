'use client';

import { useEffect, useState } from 'react';

interface CompScore {
  competency_id: string;
  competency_name: string;
  category: string;
  normalized_score: number;
  raw_score: number;
  max_score: number;
}

interface AttemptSummary {
  id: string;
  created_at: string;
  competencyScores: CompScore[];
}

export function RetakeComparison({ attemptId, userId }: { attemptId: string; userId?: string | null }) {
  const [previous, setPrevious] = useState<AttemptSummary | null>(null);
  const [current, setCurrent] = useState<AttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      /* Fetch current attempt's competency scores */
      const currRes = await fetch(`/api/candidate/competency-scores?attemptId=${attemptId}`);
      if (!currRes.ok) { setLoading(false); return; }
      const currData = await currRes.json();
      const currentScores: CompScore[] = currData.scores || [];

      /* Fetch all user attempts to find the previous one */
      if (userId && currentScores.length > 0) {
        const attemptsRes = await fetch(`/api/candidate/attempts?userId=${userId}&limit=20`);
        if (attemptsRes.ok) {
          const attemptsData = await attemptsRes.json();
          const attempts: Array<{ id: string; created_at: string }> = attemptsData.attempts || [];
          const idx = attempts.findIndex(a => a.id === attemptId);
          if (idx >= 0 && idx < attempts.length - 1) {
            const prevAttempt = attempts[idx + 1];
            const prevRes = await fetch(`/api/candidate/competency-scores?attemptId=${prevAttempt.id}`);
            if (prevRes.ok) {
              const prevData = await prevRes.json();
              setPrevious({
                id: prevAttempt.id,
                created_at: prevAttempt.created_at,
                competencyScores: prevData.scores || [],
              });
            }
          }
        }
      }

      setCurrent({
        id: attemptId,
        created_at: '',
        competencyScores: currentScores,
      });
      setLoading(false);
    }
    load();
  }, [attemptId, userId]);

  if (loading) return <div className="text-xs text-gray-500 mt-4">Loading retake comparison...</div>;
  if (!current || current.competencyScores.length === 0) return null;
  if (!previous) return null;

  /* Build a diff map */
  const prevMap = new Map(previous.competencyScores.map(s => [s.competency_id, s]));
  const categories = [...new Set(current.competencyScores.map(s => s.category))];

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
        Improvement vs Previous Attempt
      </div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 12 }}>
        Previous: {new Date(previous.created_at).toLocaleDateString()} — Current
      </div>
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            {cat.replace(/_/g, ' ')}
          </div>
          {current.competencyScores.filter(s => s.category === cat).map(s => {
            const prev = prevMap.get(s.competency_id);
            const prevScore = prev?.normalized_score ?? 0;
            const diff = s.normalized_score - prevScore;
            const diffColor = diff > 5 ? '#22c55e' : diff < -5 ? '#ef4444' : '#64748b';
            const diffIcon = diff > 5 ? '▲' : diff < -5 ? '▼' : '—';
            return (
              <div key={s.competency_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: '#94a3b8' }}>{s.competency_name}</span>
                <span style={{ color: diffColor }}>
                  {prevScore}% → {s.normalized_score}% <span style={{ fontSize: 9 }}>{diffIcon} {diff > 0 ? '+' : ''}{diff}</span>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
