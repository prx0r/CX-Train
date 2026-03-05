import ReactMarkdown from 'react-markdown';

interface FeedbackPanelProps {
  feedback: string;
  strongerPhrasing?: string[] | null;
}

export function FeedbackPanel({ feedback, strongerPhrasing }: FeedbackPanelProps) {
  return (
    <div className="space-y-4">
      {feedback && (
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{feedback}</ReactMarkdown>
        </div>
      )}
      {strongerPhrasing && strongerPhrasing.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-400">Stronger phrasing suggestions</h4>
          <ul className="space-y-2">
            {strongerPhrasing.map((p, i) => (
              <li
                key={i}
                className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-200"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
