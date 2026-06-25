'use client';

import { useRef, useState, useEffect } from 'react';

type Props = {
  token: string;
  onTranscript: (text: string) => Promise<void>;
  disabled?: boolean;
  /** When true, clicks toggle recording on/off instead of hold-to-talk */
  clickToToggle?: boolean;
};

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

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        if (chunksRef.current.length === 0) return;

        const durationMs = Date.now() - startTimeRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });

        const formData = new FormData();
        formData.append('audio', blob, 'candidate.webm');
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
            await onTranscript(data.text.trim());
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
