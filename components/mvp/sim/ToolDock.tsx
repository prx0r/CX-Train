'use client';

interface SafeAction {
  id: string;
  tool: string;
  label: string;
}

interface ToolDockProps {
  tools: string[];
  safeActions: SafeAction[];
  onAction: (actionId: string, toolId: string) => void;
  disabled: boolean;
}

const TOOL_META: Record<string, { icon: string; color: string; title: string }> = {
  outlook: { icon: '📧', color: 'bg-blue-700', title: 'Microsoft Outlook' },
  browser: { icon: '🌐', color: 'bg-teal-700', title: 'Web Browser' },
  cmd: { icon: '💻', color: 'bg-gray-800', title: 'Command Prompt' },
  ticket: { icon: '🎫', color: 'bg-amber-700', title: 'Ticket System' },
  customer_chat: { icon: '💬', color: 'bg-indigo-700', title: 'Customer Chat' },
  notes: { icon: '📝', color: 'bg-gray-700', title: 'Notes' },
};

export default function ToolDock({ tools, safeActions, onAction, disabled }: ToolDockProps) {
  const byTool: Record<string, SafeAction[]> = {};
  for (const a of safeActions) {
    if (!byTool[a.tool]) byTool[a.tool] = [];
    byTool[a.tool].push(a);
  }

  const filteredTools = tools.filter(t => t !== 'customer_chat' && t !== 'ticket' && t !== 'notes');

  return (
    <div className="space-y-4 p-3">
      {filteredTools.map(tool => {
        const meta = TOOL_META[tool] || { icon: '🔧', color: 'bg-gray-700', title: tool };
        const actions = byTool[tool] || [];

        if (actions.length === 0) return null;

        return (
          <div
            key={tool}
            className="bg-gray-900 border border-gray-600 rounded-lg overflow-hidden shadow-lg"
            style={{ boxShadow: '3px 3px 10px rgba(0,0,0,0.5)' }}
          >
            {/* Windows-style title bar */}
            <div className={`${meta.color} px-3 py-1.5 flex items-center gap-2 select-none`}>
              <span className="text-sm">{meta.icon}</span>
              <span className="text-xs font-semibold text-white flex-1">{meta.title}</span>
              <div className="flex gap-1">
                <div className="w-3.5 h-3.5 bg-gray-600/50 border border-gray-500 rounded-sm flex items-center justify-center cursor-default">
                  <span className="text-[8px] text-gray-300 font-mono">−</span>
                </div>
                <div className="w-3.5 h-3.5 bg-gray-600/50 border border-gray-500 rounded-sm flex items-center justify-center cursor-default">
                  <span className="text-[8px] text-gray-300 font-mono">□</span>
                </div>
                <div className="w-3.5 h-3.5 bg-red-700/60 border border-red-600 rounded-sm flex items-center justify-center cursor-default">
                  <span className="text-[8px] text-red-200 font-mono">✕</span>
                </div>
              </div>
            </div>
            {/* Tool body */}
            <div className="p-3 bg-gray-900">
              <div className="flex flex-wrap gap-2">
                {actions.map(a => {
                  const isDestructive = a.id.includes('reinstall') || a.id.includes('delete') || a.id.includes('escalate');
                  return (
                    <button
                      key={a.id}
                      onClick={() => onAction(a.id, a.tool)}
                      disabled={disabled}
                      className={`px-3 py-2 text-xs rounded transition-colors font-medium ${
                        isDestructive
                          ? 'bg-red-800 hover:bg-red-700 text-red-100 border border-red-700'
                          : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500'
                      } disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-600`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
