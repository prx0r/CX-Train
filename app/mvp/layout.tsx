import CallumChatBar from '@/components/mvp/callum/CallumChatBar';

export default function MvpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CallumChatBar />
    </>
  );
}
