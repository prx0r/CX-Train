import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import Link from 'next/link';

export default async function AdminBotsPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data: bots } = await supabase.from('bots').select('*').order('id');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-8">Bots</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(bots ?? []).map((bot) => (
          <Link
            key={bot.id}
            href={`/dashboard/admin/bots/${bot.id}`}
            className="block p-6 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-slate-600 transition"
          >
            <h3 className="font-semibold text-slate-100">{bot.name}</h3>
            <p className="text-slate-500 text-sm mt-1">{bot.description || bot.id}</p>
            <span
              className={`inline-block mt-3 px-2 py-1 rounded text-xs ${
                bot.active ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'
              }`}
            >
              {bot.active ? 'Active' : 'Inactive'}
            </span>
          </Link>
        ))}
      </div>
      {(!bots || bots.length === 0) && (
        <p className="text-slate-500">No bots configured. Run the seed script to add call_sim.</p>
      )}
    </div>
  );
}
