import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import Link from 'next/link';

export default async function AdminBotsPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data: bots } = await supabase.from('bots').select('*').order('id');
  const { data: pathways } = await supabase
    .from('pathways')
    .select('bot_id, stage, name, is_boss_battle')
    .order('bot_id')
    .order('stage');

  const pathwaysByBot = (pathways ?? []).reduce(
    (acc, p) => {
      if (!acc[p.bot_id]) acc[p.bot_id] = [];
      acc[p.bot_id].push(p);
      return acc;
    },
    {} as Record<string, { stage: number; name: string; is_boss_battle: boolean }[]>
  );

  const botMeta: Record<
    string,
    { label: string; description: string; icon: string; color: string }
  > = {
    call_sim: {
      label: 'Call Simulator',
      description: 'Voice-optimised call simulation with structured 10-stage pathway',
      icon: '📞',
      color: 'border-sky-500/30 bg-sky-500/5',
    },
    aplus_exam: {
      label: 'A+ Practice Exam',
      description: 'CompTIA A+ certification practice questions',
      icon: '📋',
      color: 'border-emerald-500/30 bg-emerald-500/5',
    },
    networkplus_exam: {
      label: 'Network+ Practice Exam',
      description: 'CompTIA Network+ certification practice',
      icon: '🌐',
      color: 'border-amber-500/30 bg-amber-500/5',
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Bots</h1>
        <p className="text-zinc-500 text-sm mt-1">Training modules and practice exams</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(bots ?? []).map((bot) => {
          const meta = botMeta[bot.id] ?? {
            label: bot.name,
            description: bot.description || '',
            icon: '🤖',
            color: 'border-zinc-700 bg-zinc-900/50',
          };
          const botPathways = pathwaysByBot[bot.id] ?? [];

          return (
            <Link
              key={bot.id}
              href={`/dashboard/admin/bots/${bot.id}`}
              className={`block rounded-2xl border p-6 hover:border-zinc-600 transition ${meta.color}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white">{meta.label}</h3>
                  <p className="text-zinc-500 text-sm mt-1">{meta.description}</p>
                  {botPathways.length > 0 && (
                    <div className="mt-4">
                      <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
                        Structured pathway ({botPathways.length} stages)
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {botPathways.slice(0, 5).map((p) => (
                          <span
                            key={p.stage}
                            className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-400"
                          >
                            {p.stage}
                          </span>
                        ))}
                        {botPathways.length > 5 && (
                          <span className="px-2 py-0.5 text-xs text-zinc-500">
                            +{botPathways.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <span
                    className={`inline-block mt-4 px-2.5 py-1 rounded-md text-xs font-medium ${
                      bot.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
                    }`}
                  >
                    {bot.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {(!bots || bots.length === 0) && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-500">No bots configured. Run the seed script.</p>
        </div>
      )}
    </div>
  );
}
