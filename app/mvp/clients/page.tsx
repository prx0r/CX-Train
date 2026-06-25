import ManagerShell from '@/components/mvp/ManagerShell';

export default function ClientsPage() {
  return (
    <ManagerShell>
      <h1 className="text-2xl font-bold mb-2">Clients</h1>
      <p className="text-sm text-gray-400 mb-6">Client profiles, configurations, and environment notes for your MSP accounts.</p>

      <div className="bg-gray-900 border border-gray-800 rounded p-8 text-center">
        <p className="text-gray-500 text-lg mb-2">🏢 Not built yet</p>
        <p className="text-gray-600 text-sm max-w-md mx-auto">
          This section will store client-specific context such as common issues,
          contact info, environment details, and technician assignment history.
        </p>
        <p className="text-gray-700 text-xs mt-4">Coming in a future milestone</p>
      </div>
    </ManagerShell>
  );
}
