'use client';

import { useRef, useCallback, useEffect } from 'react';

type Props = {
  token: string;
  /** When true, incoming customer messages will be spoken */
  enabled: boolean;
  /** Set externally when TTS playback starts/stops so VoiceRecorder can gate */
  onPlayingChange?: (playing: boolean) => void;
};

/**
 * Plays customer reply text as audio via TTS route.
 * Exposes a speak() method that can be called from parent.
 */
export function useCustomerAudio(token: string) {
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const onPlayingRef = useRef<((playing: boolean) => void) | null>(null);

  useEffect(() => {
    return () => {
      currentAudioRef.current?.pause();
      URL.revokeObjectURL(currentAudioRef.current?.src || '');
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    /* Stop any current playback */
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      URL.revokeObjectURL(currentAudioRef.current.src);
      currentAudioRef.current = null;
    }

    try {
      const res = await fetch(`/api/mvp/assessment/${token}/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      currentAudioRef.current = audio;
      onPlayingRef.current?.(true);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        onPlayingRef.current?.(false);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        onPlayingRef.current?.(false);
      };

      await audio.play();
    } catch {
      onPlayingRef.current?.(false);
    }
  }, [token]);

  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      URL.revokeObjectURL(currentAudioRef.current.src);
      currentAudioRef.current = null;
      onPlayingRef.current?.(false);
    }
  }, []);

  return { speak, stop, setOnPlaying: (cb: (playing: boolean) => void) => { onPlayingRef.current = cb; } };
}

export function CustomerAudioPlayer({ token, enabled, onPlayingChange }: Props) {
  const { speak, stop, setOnPlaying } = useCustomerAudio(token);

  useEffect(() => {
    if (onPlayingChange) setOnPlaying(onPlayingChange);
  }, [onPlayingChange, setOnPlaying]);

  return null; /* Immutable — logic is in the hook */
}
