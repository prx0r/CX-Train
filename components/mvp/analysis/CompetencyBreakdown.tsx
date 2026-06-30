'use client';

import { useEffect, useState } from 'react';

interface CompetencyScore {
  competency_id: string;
  competency_name: string;
  category: string;
  raw_score: number;
  normalized_score: number;
  max_score: number;
  evidence_count: number;
  missed_count: number;
}

export function CompetencyBreakdown({ attemptId }: { attemptId: string }) {
  const [scores, setScores] = useState<CompetencyScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/candidate/competency-scores?attemptId=${attemptId}`)
      .then(r => r.json())
      .then(data => {
        setScores(data.scores || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [attemptId]);

  if (loading) {
    return <div className="text-xs text-gray-500">Loading competency breakdown...</div>;
  }

  if (scores.length === 0) {
    return null;
  }

  function barColor(score: number) {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function textColor(score: number) {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  }

  const categories = [...new Set(scores.map(s => s.category))];

  return (
    <div>
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            {cat.replace(/_/g, ' ')}
          </div>
          {scores.filter(s => s.category === cat).map(s => (
            <div key={s.competency_id} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                <span style={{ color: '#cbd5e1' }}>{s.competency_name}</span>
                <span className={textColor(s.normalized_score)} style={{ fontFamily: 'monospace' }}>
                  {s.normalized_score}
                  <span style={{ color: '#64748b', fontSize: 10 }}>/{s.max_score}</span>
                </span>
              </div>
              <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                <div className={barColor(s.normalized_score)} style={{ height: '100%', width: `${Math.min(100, s.normalized_score)}%`, borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
