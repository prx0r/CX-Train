'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { startVad, type VadConfig, DEFAULT_VAD_CONFIG } from '@/lib/mvp/voice/vad';
import { createPhraseChunker, createTtsQueue, createLatencyTracker } from '@/lib/mvp/voice/voiceLoop';

export interface VoiceLoopConfig {
  token: string;
  vadConfig?: Partial<VadConfig>;
  onTranscript?: (text: string, partial: boolean) => void;
  onLatency?: (metrics: ReturnType<typeof createLatencyTracker>['computeFinal']) => void;
  onError?: (error: string) => void;
}

/**
 * useVoiceLoop — manages the full low-latency voice pipeline:
 *
 *   Mic → VAD → partial STT (every ~1.5s of speech)
 *             → full STT (end of speech)
 *   STT text → streaming LLM (SSE)
 *   LLM tokens → phrase chunker → early TTS queue → playback
 *   During playback → VAD still active → barge-in on new speech
 */
export function useVoiceLoop(config: VoiceLoopConfig) {
  const { token, onError } = config;
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const vadStopRef = useRef<(() => void) | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const partialChunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStartRef = useRef(0);
  const fullTranscriptRef = useRef('');
  const latencyRef = useRef(createLatencyTracker());
  const llmAbortRef = useRef<AbortController | null>(null);

  /* Phrase chunker + TTS queue */
  const ttsRef = useRef(createTtsQueue(token, undefined, undefined));
  const chunkerRef = useRef<ReturnType<typeof createPhraseChunker> | null>(null);

  /* Send partial audio to STT every ~1.5s during speech */
  const sendPartialAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;
    const blob = new Blob(audioChunksRef.current, { type: recorderRef.current?.mimeType || 'audio/webm' });

    latencyRef.current.mark('sttStart');
    try {
      const form = new FormData();
      form.append('audio', blob, `partial-${Date.now()}.webm`);
      const res = await fetch(`/api/mvp/assessment/${token}/voice/transcribe`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      latencyRef.current.mark('sttEnd');

      if (data.text?.trim()) {
        const partialText = data.text.trim();
        fullTranscriptRef.current = partialText;
        config.onTranscript?.(partialText, true);

        /* If we have meaningful partial text, start LLM early */
        if (partialText.length > 15 && !llmAbortRef.current) {
          startStreamingLlm(partialText, true);
        }
      }
    } catch { /* STT error */ }
  }, [token, config]);

  /* Send full audio to STT at end of speech */
  const sendFullAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;
    const blob = new Blob(audioChunksRef.current, { type: recorderRef.current?.mimeType || 'audio/webm' });

    latencyRef.current.mark('sttStart');
    try {
      const form = new FormData();
      form.append('audio', blob, `full-${Date.now()}.webm`);
      const res = await fetch(`/api/mvp/assessment/${token}/voice/transcribe`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      latencyRef.current.mark('sttEnd');

      if (data.text?.trim()) {
        const fullText = data.text.trim();
        fullTranscriptRef.current = fullText;
        config.onTranscript?.(fullText, false);

        /* Start or refine LLM call with full text */
        startStreamingLlm(fullText, false);
      }
    } catch { /* STT error */ }
  }, [token, config]);

  /* Streaming LLM + phrase chunking + early TTS */
  const startStreamingLlm = useCallback(async (text: string, isPartial: boolean) => {
    /* If we already have a running LLM for partial transcript and this is the full one,
       abort the partial and start fresh with full context */
    if (llmAbortRef.current) {
      if (!isPartial) {
        llmAbortRef.current.abort();
        llmAbortRef.current = null;
      } else {
        return; /* Already have a partial LLM running */
      }
    }

    const abortController = new AbortController();
    llmAbortRef.current = abortController;
    latencyRef.current.mark('llmFirstToken');

    /* Set up chunker and TTS */
    let firstToken = true;
    chunkerRef.current = createPhraseChunker(
      (phrase) => {
        if (firstToken) { latencyRef.current.mark('ttsFirstAudio'); firstToken = false; }
        ttsRef.current.enqueue(phrase);
      },
      () => {},
    );

    try {
      /* Build context: include existing conversation messages for continuity */
      const pageContext = { text, isPartial };
      const res = await fetch(`/api/mvp/assessment/${token}/message/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          input_source: 'voice',
          started_at_ms: speechStartRef.current || Date.now(),
        }),
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) {
        /* Fallback to non-streaming */
        handleNonStreamingFallback(text, isPartial);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const json = JSON.parse(jsonStr);
            if (json.token) {
              if (firstToken) { latencyRef.current.mark('llmFirstToken'); firstToken = false; }
              chunkerRef.current?.addToken(json.token);
            }
            if (json.done) {
              chunkerRef.current?.finish();
            }
          } catch { /* skip */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        handleNonStreamingFallback(text, isPartial);
      }
    } finally {
      if (!abortController.signal.aborted) {
        llmAbortRef.current = null;
      }
    }
  }, [token]);

  const handleNonStreamingFallback = useCallback(async (text: string, isPartial: boolean) => {
    if (isPartial) return; /* Only send full utterances via non-streaming */
    try {
      const res = await fetch(`/api/mvp/assessment/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, input_source: 'voice', started_at_ms: speechStartRef.current || Date.now() }),
      });
      const data = await res.json();
      if (data.reply) {
        latencyRef.current.mark('ttsFirstAudio');
        ttsRef.current.enqueue(data.reply);
      }
    } catch { onError?.('Failed to get response'); }
  }, [token, onError]);

  /* Start listening */
  const startListening = useCallback(async () => {
    try {
      latencyRef.current.reset();
      latencyRef.current.mark('turnStart');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      /* Start MediaRecorder for audio capture */
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      audioChunksRef.current = [];
      fullTranscriptRef.current = '';

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(100); /* Collect chunks every 100ms */

      /* Start VAD */
      setListening(true);
      vadStopRef.current = startVad(
        stream,
        { ...DEFAULT_VAD_CONFIG, ...config.vadConfig },
        (event) => {
          if (event.type === 'speech_start') {
            setSpeaking(true);
            speechStartRef.current = event.timestamp;
            /* Start partial audio timer — send chunks every 1.5s */
            partialChunkTimerRef.current = setInterval(() => {
              sendPartialAudio();
            }, 1500);
          } else if (event.type === 'speech_end') {
            setSpeaking(false);
            /* Clear partial timer */
            if (partialChunkTimerRef.current) {
              clearInterval(partialChunkTimerRef.current);
              partialChunkTimerRef.current = null;
            }
            latencyRef.current.mark('endOfSpeech');
            /* Send full audio for final transcription */
            sendFullAudio();
          }
        },
      );
    } catch (err: any) {
      onError?.(`Mic error: ${err.message}`);
      setListening(false);
    }
  }, [config.vadConfig, sendPartialAudio, sendFullAudio, onError]);

  /* Stop listening */
  const stopListening = useCallback(() => {
    vadStopRef.current?.();
    if (partialChunkTimerRef.current) clearInterval(partialChunkTimerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    ttsRef.current?.cancel();
    llmAbortRef.current?.abort();
    setSpeaking(false);
    setListening(false);
    latencyRef.current.reset();
  }, []);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    listening,
    speaking,
    startListening,
    stopListening,
  };
}
