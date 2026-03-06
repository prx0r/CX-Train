import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const DASHBOARD_LINK = {
  admin: '/dashboard/admin',
  trainee: '/dashboard/trainee',
} as const;
import { readFile } from 'fs/promises';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default async function FutureIdeasPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const content = await readFile(
    path.join(process.cwd(), 'FUTURE_INTEGRATIONS.md'),
    'utf-8'
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Future Ideas</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Roadmap for ConnectWise and IT Glue integrations. No sensitive data leaves your systems.
        </p>
      </div>

      <article className="prose prose-invert prose-sm max-w-none">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-6 md:p-8">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-xl font-semibold text-white mt-0 mb-4">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-medium text-white mt-8 mb-3 first:mt-0">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-medium text-zinc-300 mt-6 mb-2">{children}</h3>
              ),
              p: ({ children }) => <p className="text-zinc-400 text-sm leading-relaxed mb-4">{children}</p>,
              ul: ({ children }) => (
                <ul className="list-disc list-inside text-zinc-400 text-sm space-y-2 mb-4">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside text-zinc-400 text-sm space-y-2 mb-4">{children}</ol>
              ),
              li: ({ children }) => <li className="text-zinc-400">{children}</li>,
              strong: ({ children }) => <strong className="text-zinc-300 font-medium">{children}</strong>,
              table: ({ children }) => (
                <div className="overflow-x-auto my-6 rounded-lg border border-zinc-700">
                  <table className="w-full text-sm border-collapse">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-zinc-800">{children}</thead>
              ),
              tbody: ({ children }) => <tbody>{children}</tbody>,
              tr: ({ children }) => (
                <tr className="border-b border-zinc-700/80 last:border-b-0">{children}</tr>
              ),
              th: ({ children }) => (
                <th className="px-4 py-3 text-left text-zinc-300 font-semibold border-b-2 border-zinc-600">{children}</th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3 text-zinc-400 align-top">{children}</td>
              ),
              code: ({ children }) => (
                <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-xs text-sky-300">{children}</code>
              ),
              hr: () => <hr className="border-zinc-700 my-8" />,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </article>

      <div className="mt-10">
        <Link
          href={(user.role ?? 'trainee') === 'admin' ? DASHBOARD_LINK.admin : DASHBOARD_LINK.trainee}
          className="text-sky-400 hover:text-sky-300 text-sm font-medium"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
