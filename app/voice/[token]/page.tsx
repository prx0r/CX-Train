import VoiceRoomClient from './VoiceRoomClient';

export default function VoicePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="min-h-screen bg-white">
      <VoiceRoomClient paramsPromise={params} />
    </div>
  );
}
