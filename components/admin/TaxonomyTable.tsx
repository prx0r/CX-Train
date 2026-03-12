import Link from 'next/link';
import { TaxonomyItem } from '@/lib/taxonomy-db';

interface TaxonomyTableProps {
  items: TaxonomyItem[];
}

export function TaxonomyTable({ items }: TaxonomyTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800/60">
      <table className="w-full">
        <thead className="bg-zinc-900/50">
          <tr>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Category</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Subcategory</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Title</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Owner</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">FCR</th>
            <th className="text-left p-4 text-zinc-500 text-xs font-medium uppercase tracking-wider">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-zinc-800/60 hover:bg-zinc-900/30">
              <td className="p-4 text-zinc-200">{item.category}</td>
              <td className="p-4 text-zinc-400">{item.subcategory}</td>
              <td className="p-4">
                <Link
                  href={`/dashboard/admin/taxonomy/${item.id}`}
                  className="font-medium text-sky-400 hover:text-sky-300"
                >
                  {item.title}
                </Link>
              </td>
              <td className="p-4 text-zinc-400">{item.owner ?? '-'}</td>
              <td className="p-4 text-zinc-400">{item.first_call_resolution ? 'Yes' : 'No'}</td>
              <td className="p-4 text-zinc-500 text-sm">
                {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
