import { requireAuth } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { CheckpointList } from '@/components/shared/CheckpointList';
import { FeedbackPanel } from '@/components/shared/FeedbackPanel';
import { ScoreBadge } from '@/components/shared/ScoreBadge';
import Image from 'next/image';
import Link from 'next/link';

export default async function TraineeSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const supabase = createServerClient();

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *,
      personalities (name, archetype, avatar_emoji)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!session) notFound();

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
      <Link href="/dashboard/trainee/history" className="text-blue-400 hover:text-blue-300 text-sm mb-6 inline-block">
        ← Back to history
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Session detail</h1>
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
              <dt className="text-slate-500">Personality</dt>
              <dd className="text-slate-100">
                {personality ? `${personality.avatar_emoji} ${personality.name} (${personality.archetype})` : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Duration</dt>
              <dd className="text-slate-100">
                {session.duration_seconds ? `${Math.floor(session.duration_seconds / 60)}m` : '-'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Checkpoints</h2>
          <CheckpointList checkpoints={(session.checkpoints as Record<string, boolean>) || {}} showWeights />
        </div>

        {ticketUrl && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Your ticket screenshot</h2>
            <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden">
              <Image
                src={ticketUrl}
                alt="Ticket screenshot"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
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
