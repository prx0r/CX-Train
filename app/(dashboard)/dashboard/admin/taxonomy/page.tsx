import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { TaxonomyTable } from '@/components/admin/TaxonomyTable';
import { TaxonomyImport } from '@/components/admin/TaxonomyImport';
import { TaxonomyDocuments } from '@/components/admin/TaxonomyDocuments';

const TAXONOMY_BOT_ID = process.env.TAXONOMY_BOT_ID || 'taxonomy';

export default async function AdminTaxonomyPage() {
  await requireAdmin();
  const supabase = createServerClient();

  const { data: items } = await supabase
    .from('taxonomy_items')
    .select('*')
    .order('category')
    .order('title');

  const { data: changes } = await supabase
    .from('taxonomy_changes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(15);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Taxonomy</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Source of truth for classifications, playbooks, and escalation policy.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 mb-8">
        <p className="text-emerald-200/90 text-sm">
          Updates should be proposed via the taxonomy GPT or the admin tools. Every change is logged.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <TaxonomyImport />
        <TaxonomyDocuments botId={TAXONOMY_BOT_ID} />
      </div>

      <div className="mb-10">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Items
        </h2>
        <TaxonomyTable items={items ?? []} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          Recent change requests
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800/60">
          <table className="w-full">
            <thead className="bg-zinc-900/50">
              <tr>
                <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">When</th>
                <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Type</th>
                <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Proposed by</th>
                <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(changes ?? []).map((c) => (
                <tr key={c.id} className="border-t border-zinc-800/60">
                  <td className="p-4 text-zinc-400 text-sm">
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                  <td className="p-4 text-zinc-200 text-sm">{c.change_type}</td>
                  <td className="p-4 text-zinc-400 text-sm">{c.status}</td>
                  <td className="p-4 text-zinc-400 text-sm">{c.proposed_by}</td>
                  <td className="p-4 text-zinc-400 text-sm">{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
