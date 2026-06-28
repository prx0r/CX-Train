import CallumChatBar from '@/components/mvp/callum/CallumChatBar';

export default function MvpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {children}
      <CallumChatBar />
    </div>
  );
}
