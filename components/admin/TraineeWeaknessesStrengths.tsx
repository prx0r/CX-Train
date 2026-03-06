'use client';

import Link from 'next/link';

interface TraineeData {
  id: string;
  name: string;
  weaknesses: string[];
  strengths: string[];
}

interface TraineeWeaknessesStrengthsProps {
  trainees: TraineeData[];
}

export function TraineeWeaknessesStrengths({ trainees }: TraineeWeaknessesStrengthsProps) {
  return (
    <div className="space-y-4">
      {trainees.map((t) => (
        <Link
          key={t.id}
          href={`/dashboard/admin/trainees/${t.id}`}
          className="block rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-4 hover:border-zinc-700 transition"
        >
          <p className="font-medium text-white mb-3">{t.name}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-red-400/90 text-xs font-medium uppercase tracking-wider mb-1">
                Weaknesses
              </p>
              {t.weaknesses.length > 0 ? (
                <ul className="text-zinc-400 space-y-0.5">
                  {t.weaknesses.map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-500">—</p>
              )}
            </div>
            <div>
              <p className="text-emerald-400/90 text-xs font-medium uppercase tracking-wider mb-1">
                Strengths
              </p>
              {t.strengths.length > 0 ? (
                <ul className="text-zinc-400 space-y-0.5">
                  {t.strengths.map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-500">—</p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
