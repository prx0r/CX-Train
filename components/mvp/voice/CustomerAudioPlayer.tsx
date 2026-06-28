'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

let audioContext: AudioContext | null = null;

/** Unlock AudioContext on first user gesture (required by browsers) */
function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export function useCustomerAudio(token: string) {
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const onPlayingRef = useRef<((playing: boolean) => void) | null>(null);
  const onTtsEndRef = useRef<((endedAtMs: number) => void) | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    return () => {
      currentAudioRef.current?.pause();
      if (currentAudioRef.current?.src) URL.revokeObjectURL(currentAudioRef.current.src);
    };
  }, []);

  const speak = useCallback(async (text: string, mood?: string) => {
    /* Stop any current playback */
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      if (currentAudioRef.current.src) URL.revokeObjectURL(currentAudioRef.current.src);
      currentAudioRef.current = null;
    }

    try {
      const body: Record<string, any> = { text };
      if (mood) body.mood = mood;
      const res = await fetch(`/api/mvp/assessment/${token}/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.warn('[TTS] HTTP', res.status);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      currentAudioRef.current = audio;
      onPlayingRef.current?.(true);
      setAutoplayBlocked(false);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        onPlayingRef.current?.(false);
        onTtsEndRef.current?.(Date.now());
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (currentAudioRef.current === audio) currentAudioRef.current = null;
        onPlayingRef.current?.(false);
        onTtsEndRef.current?.(Date.now());
      };

      /* Try to play — handle autoplay blocking */
      try {
        /* Unlock audio context first (required by Chrome/Safari) */
        ensureAudioContext();
        await audio.play();
      } catch (playErr: any) {
        if (playErr.name === 'NotAllowedError' || playErr.message?.includes('play()')) {
          console.warn('[TTS] Autoplay blocked — user must interact first');
          setAutoplayBlocked(true);
          /* The audio is still loaded; user can click to play */
        } else {
          console.warn('[TTS] Play error:', playErr.message);
        }
        onPlayingRef.current?.(false);
      }
    } catch (err: any) {
      console.warn('[TTS] Fetch error:', err.message);
      onPlayingRef.current?.(false);
    }
  }, [token]);

  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      if (currentAudioRef.current.src) URL.revokeObjectURL(currentAudioRef.current.src);
      currentAudioRef.current = null;
      onPlayingRef.current?.(false);
    }
  }, []);

  return {
    speak,
    stop,
    autoplayBlocked,
    setOnPlaying: (cb: (playing: boolean) => void) => { onPlayingRef.current = cb; },
    setOnTtsEnd: (cb: (endedAtMs: number) => void) => { onTtsEndRef.current = cb; },
  };
}
