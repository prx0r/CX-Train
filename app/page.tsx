import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <header className="border-b border-zinc-800/80 px-4 py-4 flex items-center justify-between">
        <Link href="/" className="inline-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, border: '2px solid #7dd3fc', borderRadius: 4 }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>CallCallum</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="text-zinc-400 hover:text-white text-sm transition-colors">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-4xl font-semibold text-white tracking-tight max-w-2xl">
          Practise and prove first-line IT support calls
        </h1>
        <p className="text-zinc-500 mt-4 max-w-md text-sm leading-relaxed">
          Realistic AI-powered support call simulations with instant feedback.
          Build a shareable profile to show hiring managers what you can do.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            href="/practice"
            className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold rounded-lg text-sm transition-colors"
          >
            Start Practising
          </Link>
          <Link
            href="/sign-in?redirectTo=/mvp"
            className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded-lg text-sm transition-colors"
          >
            Manager Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
