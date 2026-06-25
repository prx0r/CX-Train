import ItsmSidebar from './itsm/ItsmSidebar';

export default function ManagerShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: '#f0f2f5' }}>
      <ItsmSidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6" style={{ color: '#333' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
