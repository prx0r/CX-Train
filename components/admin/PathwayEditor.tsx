'use client';

interface PathwayEditorProps {
  pathways: {
    id: string;
    stage: number;
    name: string;
    description: string | null;
    difficulty: string | null;
    priority_override: string | null;
    pass_threshold: number;
    is_boss_battle: boolean;
    requires_ticket_screenshot: boolean;
  }[];
  botId: string;
}

export function PathwayEditor({ pathways, botId }: PathwayEditorProps) {
  return (
    <div className="space-y-4">
      {pathways.map((p) => (
        <div
          key={p.id}
          className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-between"
        >
          <div>
            <span className="text-slate-500 font-mono mr-2">Stage {p.stage}</span>
            <span className="font-medium text-slate-100">{p.name}</span>
            {p.difficulty && (
              <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded text-xs">{p.difficulty}</span>
            )}
            {p.is_boss_battle && (
              <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
                Boss
              </span>
            )}
          </div>
          <div className="text-sm text-slate-400">
            Pass threshold: {p.pass_threshold}%
            {p.requires_ticket_screenshot && ' • Screenshot required'}
          </div>
        </div>
      ))}
      {pathways.length === 0 && (
        <p className="text-slate-500">No pathways configured. Run the seed script.</p>
      )}
    </div>
  );
}
