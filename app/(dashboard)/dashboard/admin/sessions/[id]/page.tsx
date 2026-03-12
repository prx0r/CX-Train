import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { CheckpointList } from '@/components/shared/CheckpointList';
import { FeedbackPanel } from '@/components/shared/FeedbackPanel';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import Image from 'next/image';
import Link from 'next/link';

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createServerClient();

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *,
      users (name),
      personalities (name, archetype, avatar_emoji)
    `)
    .eq('id', id)
    .single();

  if (!session) notFound();

  const user = session.users as { name: string } | null;
  const personality = session.personalities as { name: string; archetype: string; avatar_emoji: string } | null;
  let ticketUrl: string | null = null;
  if (session.ticket_screenshot_url) {
    const { data } = await supabase.storage
      .from('ticket-screenshots')
      .createSignedUrl(session.ticket_screenshot_url, 60 * 10);
    ticketUrl = data?.signedUrl ?? null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/dashboard/admin/sessions" className="text-blue-400 hover:text-blue-300 text-sm mb-6 inline-block">
        ← Back to sessions
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Session — {user?.name ?? 'Unknown'}
          </h1>
          <p className="text-slate-500">
            Stage {session.pathway_stage} • {new Date(session.created_at).toLocaleString()}
          </p>
        </div>
        <ScoreBadge score={session.score ?? 0} passed={session.passed ?? false} size="lg" />
      </div>

      <div className="space-y-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Call summary</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Caller</dt>
              <dd className="text-slate-100">{session.caller_name ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Company</dt>
              <dd className="text-slate-100">{session.caller_company ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd className="text-slate-100">{session.caller_role ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Issue family</dt>
              <dd className="text-slate-100">{session.issue_family ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Severity / Impact</dt>
              <dd className="text-slate-100">
                {session.severity_level ?? '-'} / {session.impact_level ?? '-'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Priority assigned</dt>
              <dd className="text-slate-100">{session.priority_assigned ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Priority expected</dt>
              <dd className="text-slate-100">{session.priority_correct_value ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Priority correct</dt>
              <dd className="text-slate-100">
                {session.priority_correct == null ? '-' : session.priority_correct ? 'Yes' : 'No'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Duration</dt>
              <dd className="text-slate-100">
                {session.duration_seconds ? `${Math.floor(session.duration_seconds / 60)}m` : '-'}
              </dd>
            </div>
            {personality && (
              <div>
                <dt className="text-slate-500">Personality</dt>
                <dd className="text-slate-100">
                  {personality.avatar_emoji} {personality.name} ({personality.archetype})
                </dd>
              </div>
            )}
          </dl>
          {(session.hostname_gathered === false || session.impact_gathered === false) && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              Critical failures: {!session.hostname_gathered && 'Hostname not gathered. '}
              {!session.impact_gathered && 'Impact not gathered.'}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Checkpoints</h2>
          <CheckpointList checkpoints={(session.checkpoints as Record<string, boolean>) || {}} showWeights />
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Rubric breakdown</h2>
          {session.score_breakdown ? (
            <pre className="text-sm text-slate-300 overflow-auto">
              {JSON.stringify(session.score_breakdown, null, 2)}
            </pre>
          ) : (
            <p className="text-slate-500 text-sm">No rubric data recorded.</p>
          )}
        </div>

        {ticketUrl && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Ticket screenshot</h2>
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden">
              <Image
                src={ticketUrl}
                alt="Ticket screenshot"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            {session.ticket_score && (
              <div className="mt-4 p-4 bg-slate-800 rounded-lg">
                <h3 className="text-sm font-medium text-slate-400 mb-2">Ticket assessment</h3>
                <pre className="text-sm text-slate-300 overflow-auto">
                  {JSON.stringify(session.ticket_score, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Feedback</h2>
          <FeedbackPanel
            feedback={session.feedback_text || ''}
            strongerPhrasing={session.stronger_phrasing}
          />
        </div>
      </div>
    </div>
  );
}
