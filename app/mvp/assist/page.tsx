import ManagerShell from '@/components/mvp/ManagerShell';

export default function AssistPage() {
  return (
    <ManagerShell>
      <h1 className="text-2xl font-bold mb-2">Assist</h1>
      <p className="text-sm text-gray-400 mb-6">AI-powered assistant for ticket writing and customer response guidance.</p>

      <div className="bg-gray-900 border border-gray-800 rounded p-8 text-center">
        <p className="text-gray-500 text-lg mb-2">💬 Not built yet</p>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          This section will provide an AI co-pilot that helps technicians draft tickets,
          review responses for quality, and get real-time suggestions during live calls or chat.
        </p>
        <p className="text-gray-700 text-xs mt-4">Coming in a future milestone</p>
      </div>
    </ManagerShell>
  );
}
