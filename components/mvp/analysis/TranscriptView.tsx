'use client';

interface Message {
  role: string;
  content: string;
  created_at?: string;
}

const ROLE_LABELS: Record<string, string> = {
  caller: 'Customer',
  candidate: 'You',
  system: 'System',
};

const ROLE_COLORS: Record<string, string> = {
  caller: 'bg-blue-900/40 text-blue-100 ml-4',
  candidate: 'bg-green-900/40 text-green-100 mr-4',
  system: 'bg-gray-700/50 text-gray-300 text-center',
};

const ROLE_NAME_COLORS: Record<string, string> = {
  caller: 'text-blue-400',
  candidate: 'text-green-400',
  system: 'text-gray-400',
};

export function TranscriptView({ messages }: { messages: Message[] }) {
  if (!messages || messages.length === 0) {
    return (
      <div className="border border-dashed border-gray-600 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-400">No messages yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
      {messages.map((msg, i) => {
        const role = msg.role;
        const label = ROLE_LABELS[role] || role;
        const color = ROLE_COLORS[role] || 'bg-gray-800 text-gray-200';
        const nameColor = ROLE_NAME_COLORS[role] || 'text-gray-400';
        const align = role === 'candidate' ? 'justify-end' : 'justify-start';

        return (
          <div key={i} className={`flex ${align}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${color}`}>
              <p className={`text-xs font-semibold ${nameColor} mb-0.5`}>{label}</p>
              <p className="text-gray-200">{msg.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
