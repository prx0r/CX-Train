import CallumChatBar from '@/components/mvp/callum/CallumChatBar';
import NavPills from '@/components/mvp/NavPills';

export default function MvpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <NavPills />
      {children}
      <CallumChatBar />
    </div>
  );
}
