import ManagerShell from '@/components/mvp/ManagerShell';

export default function StandardsPage() {
  return (
    <ManagerShell>
      <h1 className="text-2xl font-bold mb-2">Standards</h1>
      <p className="text-sm text-gray-400 mb-6">Define the MSP-specific criteria and rubrics your technicians are measured against.</p>

      <div className="bg-gray-900 border border-gray-800 rounded p-8 text-center">
        <p className="text-gray-500 text-lg mb-2">📋 Not built yet</p>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          This is where managers will define scoring checkpoints, critical failures, readiness thresholds,
          and custom evaluation criteria for each role level.
        </p>
        <p className="text-gray-700 text-xs mt-4">Coming in Milestone 2: Manager Standards v0</p>
      </div>
    </ManagerShell>
  );
}
