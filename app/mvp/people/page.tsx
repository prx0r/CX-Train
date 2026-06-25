import ManagerShell from '@/components/mvp/ManagerShell';

export default function PeoplePage() {
  return (
    <ManagerShell>
      <h1 className="text-2xl font-bold mb-2">People</h1>
      <p className="text-sm text-gray-400 mb-6">Scorecards and progress tracking for every technician and candidate.</p>

      <div className="bg-gray-900 border border-gray-800 rounded p-8 text-center">
        <p className="text-gray-500 text-lg mb-2">👤 Not built yet</p>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          This section will display individual scorecards, readiness levels,
          assessment history, and skill growth over time for each technician or candidate.
        </p>
        <p className="text-gray-700 text-xs mt-4">Coming in a future milestone</p>
      </div>
    </ManagerShell>
  );
}
