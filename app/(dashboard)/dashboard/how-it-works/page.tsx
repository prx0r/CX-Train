import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HowItWorksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
        How it works
      </h1>
      <p className="text-zinc-500 text-sm mb-10">
        Architecture and integration guide
      </p>

      <div className="space-y-10">
        <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-white mb-4">Custom GPTs → This app</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-4">
            Each training bot (Call Simulator, A+ Practice, Network+) is a Custom GPT or app that uses{' '}
            <strong className="text-zinc-300">ChatGPT Actions</strong> to send custom requests to this
            dashboard. When a trainee completes a session, the GPT calls our API with session results.
          </p>
          <ul className="list-disc list-inside text-zinc-400 text-sm space-y-2">
            <li>
              <strong className="text-zinc-300">getTraineeProgress</strong> — Called at session start.
              Returns current stage, scores, and weaknesses.
            </li>
            <li>
              <strong className="text-zinc-300">submitSession</strong> — Called after &quot;end call&quot;.
              Sends score, checkpoints, feedback, and optional ticket screenshot.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-white mb-4">Edit prompts from the admin app</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-4">
            Bot system prompts and instructions are stored in <strong className="text-zinc-300">Supabase</strong>.
            When you edit a bot&apos;s prompt in the admin Bots section, it updates the source of truth. Custom GPTs
            can be configured to fetch the latest prompt from our API, or you can copy-paste updates into
            the GPT configuration.
          </p>
          <p className="text-zinc-400 text-sm leading-relaxed">
            All data—trainees, sessions, progress, bots, pathways—is stored in Supabase and linked to each
            user. Trainees see only their own stats; admins see everything.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-white mb-4">Linking a Custom GPT</h2>
          <ol className="list-decimal list-inside text-zinc-400 text-sm space-y-3">
            <li>
              In your Custom GPT, go to <strong className="text-zinc-300">Configure → Actions</strong>.
            </li>
            <li>
              Paste the full OpenAPI schema from <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">gpt-actions-openapi.yaml</code>.
            </li>
            <li>
              Set authentication to <strong className="text-zinc-300">API Key</strong>, header{' '}
              <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">x-api-key</code>, with the bot&apos;s API key from the database.
            </li>
            <li>
              The schema points to <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">https://training-jade-ten.vercel.app/api</code>.
            </li>
          </ol>
        </section>

        <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-white mb-4">Data flow</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Trainee opens GPT → GPT calls <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">GET /progress/{'{name}'}</code> →
            Runs simulation → Trainee says &quot;end call&quot; → GPT calls{' '}
            <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs">POST /session</code> →
            Data saved to Supabase → Dashboard updates in real time.
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link
          href="/dashboard"
          className="text-sky-400 hover:text-sky-300 text-sm font-medium"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
