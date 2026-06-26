'use client';

import { useRef, useState, useEffect } from 'react';

export type VoiceTranscriptResult = {
  text: string;
  durationMs: number;
  mimeType: string;
  metadata?: {
    duration_ms: number;
    mime_type: string;
    stt_provider: string;
    stt_model: string;
  };
};

type Props = {
  token: string;
  onTranscript: (result: VoiceTranscriptResult) => Promise<void>;
  disabled?: boolean;
  /** When true, clicks toggle recording on/off instead of hold-to-talk */
  clickToToggle?: boolean;
};

function chooseRecorderMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/ogg',
  ];

  return candidates.find(type => MediaRecorder.isTypeSupported(type));
}

function audioExtension(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

export function VoiceRecorderButton({ token, onTranscript, disabled, clickToToggle }: Props) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function startRecording() {
    try {
      setError('');
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setError('Microphone requires HTTPS');
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Microphone is not available in this browser context');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      chunksRef.current = [];
      startTimeRef.current = Date.now();

      const requestedMimeType = chooseRecorderMimeType();

      const recorder = requestedMimeType
        ? new MediaRecorder(stream, { mimeType: requestedMimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        if (chunksRef.current.length === 0) return;

        const durationMs = Date.now() - startTimeRef.current;
        const mimeType = recorder.mimeType || requestedMimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });

        const formData = new FormData();
        formData.append('audio', blob, `candidate.${audioExtension(mimeType)}`);
        formData.append('duration_ms', String(durationMs));

        try {
          const res = await fetch(`/api/mvp/assessment/${token}/voice/transcribe`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            setError(err.error || 'Transcription failed');
            return;
          }

          const data = await res.json();

          if (data.text?.trim()) {
            await onTranscript({
              text: data.text.trim(),
              durationMs,
              mimeType,
              metadata: data.metadata,
            });
          }
        } catch {
          setError('Failed to send audio');
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Microphone is already in use');
      } else {
        setError('Could not start recording');
      }
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  function handleToggle() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  const active = recording;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onMouseDown={clickToToggle ? undefined : startRecording}
          onMouseUp={clickToToggle ? undefined : stopRecording}
          onTouchStart={clickToToggle ? undefined : startRecording}
          onTouchEnd={clickToToggle ? undefined : stopRecording}
          onClick={clickToToggle ? handleToggle : undefined}
          disabled={disabled}
          className={`
            select-none rounded px-5 py-2.5 text-sm font-medium transition-all
            ${active
              ? 'bg-red-600 text-white ring-2 ring-red-400 animate-pulse'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {active ? (clickToToggle ? 'Stop' : 'Release to send') : (clickToToggle ? 'Click to talk' : 'Hold to talk')}
        </button>
        {recording && (
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            Recording...
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
