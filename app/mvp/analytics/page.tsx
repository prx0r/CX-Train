import ManagerShell from '@/components/mvp/ManagerShell';

export default function AnalyticsPage() {
  return (
    <ManagerShell>
      <h1 className="text-2xl font-bold mb-2">Analytics</h1>
      <p className="text-sm text-gray-400 mb-6">Aggregate performance data and trends across your team.</p>

      <div className="bg-gray-900 border border-gray-800 rounded p-8 text-center">
        <p className="text-gray-500 text-lg mb-2">📊 Not built yet</p>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          This section will show team-wide metrics, trends over time, scenario performance
          breakdowns, and exportable reports for management reviews.
        </p>
        <p className="text-gray-700 text-xs mt-4">Coming in a future milestone</p>
      </div>
    </ManagerShell>
  );
}
