export default function ManagerShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#0d0d0f', minHeight: '100vh' }}>
      <main className="max-w-6xl mx-auto p-4 md:p-6" style={{ color: '#e4e4e7' }}>
        {children}
      </main>
    </div>
  );
}
