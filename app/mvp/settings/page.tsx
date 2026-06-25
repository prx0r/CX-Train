import ManagerShell from '@/components/mvp/ManagerShell';

export default function SettingsPage() {
  return (
    <ManagerShell>
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-sm text-gray-400 mb-6">Manage account, team, and integration preferences.</p>

      <div className="bg-gray-900 border border-gray-800 rounded p-8 text-center">
        <p className="text-gray-500 text-lg mb-2">⚙ Not built yet</p>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          This section will allow managers to configure AI model selection, notification
          preferences, team member management, and integration settings.
        </p>
        <p className="text-gray-700 text-xs mt-4">Coming in a future milestone</p>
      </div>
    </ManagerShell>
  );
}
