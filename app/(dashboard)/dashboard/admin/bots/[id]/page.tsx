import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { BotEditor } from '@/components/admin/BotEditor';

export default async function AdminBotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createServerClient();

  const { data: bot } = await supabase.from('bots').select('*').eq('id', id).single();
  if (!bot) notFound();

  const { data: personalities } = await supabase
    .from('personalities')
    .select('*')
    .eq('bot_id', id)
    .order('name');

  const { data: pathways } = await supabase
    .from('pathways')
    .select('*')
    .eq('bot_id', id)
    .order('stage');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-8">{bot.name}</h1>
      <BotEditor
        bot={bot}
        personalities={personalities ?? []}
        pathways={pathways ?? []}
      />
    </div>
  );
}
