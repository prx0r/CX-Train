import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TaxonomyEditor } from '@/components/admin/TaxonomyEditor';

export default async function AdminTaxonomyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createServerClient();

  const { data: item } = await supabase
    .from('taxonomy_items')
    .select('*')
    .eq('id', id)
    .single();

  if (!item) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <Link href="/dashboard/admin/taxonomy" className="text-sky-400 hover:text-sky-300 text-sm">
        â† Back to taxonomy
      </Link>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">{item.title}</h1>
        <p className="text-zinc-500 text-sm mt-1">{item.id}</p>
      </div>

      <TaxonomyEditor item={item} />
    </div>
  );
}
