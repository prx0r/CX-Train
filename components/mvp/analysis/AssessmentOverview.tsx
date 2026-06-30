'use client';

interface NarrativeFeedback {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  most_costly_miss?: string;
  ticket_feedback?: string;
  coaching_focus?: string[];
}

interface DeterministicScore {
  score?: number;
  rating?: string;
  skillBreakdown?: Record<string, { score: number; maxScore: number; percent: number }>;
}

interface CategoryScore {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  percent: number;
}

interface CandidateAnalysisResult {
  overall_score?: number;
  verdict?: string;
  criticalFailure?: string | null;
  summary?: string;
  verdictLine?: string;
  strengths?: string[];
  improvements?: string[];
  narrative?: NarrativeFeedback;
  categoryScores?: CategoryScore[];
  whatCostYouMost?: Array<{ label: string; pointsLost: number; category: string }>;
  bonus?: number;
  coreEarned?: number;
  maxCore?: number;
}

const RATING_COLORS: Record<string, string> = {
  EXCELLENT: 'text-green-400 bg-green-900/30',
  GOOD: 'text-blue-400 bg-blue-900/30',
  FAIR: 'text-yellow-400 bg-yellow-900/30',
  POOR: 'text-orange-400 bg-orange-900/30',
  FAIL: 'text-red-400 bg-red-900/30',
};

const BAR_COLORS: Record<string, string> = {
  PASS: 'bg-green-600',
  FAIL: 'bg-red-600',
};

export function AssessmentOverview({
  result,
  deterministicScore,
  narrative,
}: {
  result?: CandidateAnalysisResult | null;
  deterministicScore?: DeterministicScore | null;
  narrative?: NarrativeFeedback | null;
}) {
  const overallScore = result?.overall_score ?? deterministicScore?.score ?? 0;
  const verdict = result?.verdict ?? (deterministicScore?.rating || '');
  const strengths = result?.strengths ?? narrative?.strengths ?? [];
  const improvements = result?.improvements ?? narrative?.improvements ?? [];
  const coaching = result?.narrative?.coaching_focus ?? narrative?.coaching_focus ?? [];
  const summary = result?.summary ?? narrative?.summary ?? '';
  const ticketFeedback = result?.narrative?.ticket_feedback ?? narrative?.ticket_feedback ?? '';
  const categoryScores = result?.categoryScores;
  const whatCostYouMost = result?.whatCostYouMost;
  const bonus = result?.bonus ?? 0;
  const criticalFailure = result?.criticalFailure;

  const ratingStyle = RATING_COLORS[verdict] || 'text-gray-400 bg-gray-800';

  if (overallScore === 0 && strengths.length === 0) {
    return (
      <div className="border border-dashed border-gray-600 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-400">No assessment results yet</p>
        <p className="text-xs text-gray-500 mt-1">Assessment will appear once the analysis is complete.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Score header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{overallScore}</div>
            <div className="text-xs text-gray-500">/100</div>
          </div>
          <div className={`px-3 py-1 rounded-lg text-sm font-bold ${ratingStyle}`}>
            {verdict}
          </div>
        </div>
        {criticalFailure && (
          <div className="text-xs text-red-400 bg-red-900/20 rounded px-3 py-1.5 max-w-[250px]">
            Critical: {criticalFailure}
          </div>
        )}
      </div>

      {summary && (
        <div className="bg-gray-800/30 rounded-lg p-4 border-l-2 border-blue-500 mb-6">
          <p className="text-sm text-gray-300 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Category scores */}
      {categoryScores && categoryScores.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {categoryScores.filter(c => c.maxScore > 0 && c.id !== 'fundamentals').map(cat => (
            <div key={cat.id} className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-200">{cat.label}</span>
                <span className="text-xs font-mono text-gray-400">{cat.score}/{cat.maxScore}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${cat.percent >= 80 ? 'bg-green-500' : cat.percent >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, cat.percent)}%` }}
                />
              </div>
            </div>
          ))}
          {bonus > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-yellow-400">Exceptional Service Bonus</span>
                <span className="text-xs font-mono text-yellow-400">+{bonus}/10</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-yellow-500 transition-all" style={{ width: `${(bonus / 10) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {strengths.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-green-400 mb-2">What went well</h4>
            <ul className="space-y-1">
              {strengths.map((s, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-green-500 shrink-0">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {improvements.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-orange-400 mb-2">What to improve</h4>
            <ul className="space-y-1">
              {improvements.map((s, i) => (
                <li key={i} className="text-xs text-gray-300 flex gap-2">
                  <span className="text-orange-500 shrink-0">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* What cost you most */}
      {whatCostYouMost && whatCostYouMost.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-red-400 mb-2">What cost you the most points</h4>
          <div className="space-y-1">
            {whatCostYouMost.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                <span className="text-red-400 font-mono">-{item.pointsLost}</span>
                <span>{item.label}</span>
                <span className="text-gray-500 capitalize text-[10px]">({item.category.replace(/_/g, ' ')})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coaching focus */}
      {coaching.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Coaching focus</h4>
          <ul className="space-y-1">
            {coaching.map((f, i) => (
              <li key={i} className="text-xs text-gray-400 flex gap-2">
                <span className="text-gray-500 shrink-0">●</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ticket feedback */}
      {ticketFeedback && (
        <div className="bg-gray-800/30 rounded-lg p-4 border-l-2 border-gray-600">
          <h4 className="text-xs font-semibold text-gray-400 mb-1">Ticket Feedback</h4>
          <p className="text-xs text-gray-300 leading-relaxed">{ticketFeedback}</p>
        </div>
      )}
    </div>
  );
}
