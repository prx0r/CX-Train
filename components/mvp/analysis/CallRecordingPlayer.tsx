'use client';

export function CallRecordingPlayer({ token, recordingPath }: { token: string; recordingPath?: string | null }) {
  if (!recordingPath) {
    return (
      <div className="border border-dashed border-gray-600 rounded-lg p-6 text-center">
        <p className="text-sm text-gray-400">No call recording available</p>
        <p className="text-xs text-gray-500 mt-1">Audio recording requires microphone access during the call.</p>
      </div>
    );
  }

  const mp3Url = `/api/mvp/assessment/${token}/recording?format=mp3`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-sm font-medium text-gray-200">Call Recording</span>
      </div>
      <audio controls className="w-full rounded-lg" src={mp3Url}>
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
