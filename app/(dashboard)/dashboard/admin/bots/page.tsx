import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import Link from 'next/link';
import type { Bot } from '@/lib/types';

const BOT_TYPE_CONFIG: Record<
  string,
  { label: string; description: string; icon: string; order: number }
> = {
  call: {
    label: 'Call simulation',
    description: 'Voice-based phone call training',
    icon: '📞',
    order: 1,
  },
  qualification: {
    label: 'Qualifications',
    description: 'Practice exams and tutoring',
    icon: '📜',
    order: 4,
  },
  escalation: {
    label: 'Escalation',
    description: 'T1→T2→T3 escalation training',
    icon: '⬆️',
    order: 2,
  },
  ticket: {
    label: 'Ticket simulation',
    description: 'Email-based ticket handling',
    icon: '📧',
    order: 3,
  },
  other: {
    label: 'Other',
    description: 'Additional training modules',
    icon: '🤖',
    order: 99,
  },
};

const BOT_META: Record<
  string,
  { label: string; description: string; color: string }
> = {
  call_sim: {
    label: 'Call Simulator',
    description: 'Voice-optimised call simulation with structured 10-stage pathway',
    color: 'border-sky-500/30 bg-sky-500/5',
  },
  aplus_exam: {
    label: 'A+ Practice Exam',
    description: 'CompTIA A+ certification practice questions',
    color: 'border-emerald-500/30 bg-emerald-500/5',
  },
  aplus_tutor: {
    label: 'A+ Tutor',
    description: 'CompTIA A+ tutoring – ask questions, get explanations',
    color: 'border-emerald-500/30 bg-emerald-500/5',
  },
  general_tutor: {
    label: 'General Tutor',
    description: 'Paste objective PDFs for any certification – get tutored on the content',
    color: 'border-emerald-500/30 bg-emerald-500/5',
  },
  escalation_bot: {
    label: 'Escalation Bot',
    description: 'Teaches T1 when to escalate to T2, T2 when to escalate to T3. Varying difficulty levels.',
    color: 'border-amber-500/30 bg-amber-500/5',
  },
  ticket_sim: {
    label: 'Ticket Simulator',
    description: 'Email-based ticket simulation. Respond as if answering a ticket, set statuses, document steps in internal notes.',
    color: 'border-violet-500/30 bg-violet-500/5',
  },
};

export default async function AdminBotsPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data: bots } = await supabase
    .from('bots')
    .select('*')
    .order('id');

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

  // Group bots by type
  const botsByType = (bots ?? []).reduce(
    (acc, bot) => {
      const type = bot.bot_type ?? 'other';
      if (!acc[type]) acc[type] = [];
      acc[type].push(bot);
      return acc;
    },
    {} as Record<string, Bot[]>
  );

  const mainTypes = ['call', 'ticket', 'escalation'] as const;
  const qualTypes = ['qualification'] as const;
  const otherTypes = ['other'] as const;

  const mainBots = mainTypes.flatMap((t) => botsByType[t] ?? []);
  const qualBots = qualTypes.flatMap((t) => botsByType[t] ?? []);
  const otherBots = otherTypes.flatMap((t) => botsByType[t] ?? []);

  const renderBotCard = (bot: Bot) => {
    const meta = BOT_META[bot.id] ?? {
      label: bot.name,
      description: bot.description || '',
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
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Bots</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Training modules organised by type. Edit prompts in the admin app to update Custom GPTs.
        </p>
      </div>

      {/* First row: Call, Ticket, Escalation */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mainBots.map(renderBotCard)}
        </div>
      </section>

      {/* Second row: Qualifications */}
      {qualBots.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{BOT_TYPE_CONFIG.qualification.icon}</span>
            <div>
              <h2 className="text-lg font-medium text-white">{BOT_TYPE_CONFIG.qualification.label}</h2>
              <p className="text-zinc-500 text-sm">{BOT_TYPE_CONFIG.qualification.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {qualBots.map(renderBotCard)}
          </div>
        </section>
      )}

      {otherBots.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{BOT_TYPE_CONFIG.other.icon}</span>
            <div>
              <h2 className="text-lg font-medium text-white">{BOT_TYPE_CONFIG.other.label}</h2>
              <p className="text-zinc-500 text-sm">{BOT_TYPE_CONFIG.other.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherBots.map(renderBotCard)}
          </div>
        </section>
      )}

      {(!bots || bots.length === 0) && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <p className="text-zinc-500">No bots configured. Run the seed script.</p>
        </div>
      )}
    </div>
  );
}
