'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface Turn {
  speaker: 'candidate' | 'client';
  text: string;
  turnIndex: number;
  audioUrl?: string;
}

interface VoiceRoomProps {
  voiceSessionId: string;
  assessmentSessionId: string;
  scenarioTitle: string;
  candidateName: string;
  apiKey: string;
}

export default function VoiceRoom({ voiceSessionId, assessmentSessionId, scenarioTitle, candidateName, apiKey }: VoiceRoomProps) {
  const [phase, setPhase] = useState<'call' | 'ticket' | 'complete'>('call');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketText, setTicketText] = useState('');
  const [result, setResult] = useState<{ readinessLabel: string; readinessScore: number } | null>(null);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    turnEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', 'x-api-key': apiKey }), [apiKey]);

  const handleStartRecording = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsProcessing(true);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          await sendTurn(base64);
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError(`Microphone access denied: ${err instanceof Error ? err.message : 'unknown error'}. Use text input instead.`);
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const sendTurn = useCallback(async (audioBase64?: string, text?: string) => {
    setIsProcessing(true);
    setError('');
    try {
      const body: Record<string, unknown> = {};
      if (audioBase64) { body.audio = audioBase64; body.contentType = 'audio/webm'; }
      if (text) body.text = text;

      const res = await fetch(`/api/voice/session/${voiceSessionId}/turn`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setIsProcessing(false); return; }

      setTurns((prev) => [
        ...prev,
        { speaker: 'candidate', text: data.candidateText, turnIndex: data.turnIndex },
      ]);

      if (data.clientAudio) {
        setTurns((prev) => [
          ...prev,
          { speaker: 'client', text: data.clientText, turnIndex: data.turnIndex, audioUrl: data.clientAudio },
        ]);
        // Auto-play client audio
        if (audioRef.current) {
          audioRef.current.src = data.clientAudio;
          audioRef.current.play().catch(() => {});
        }
      }

      if (data.clientText) {
        setTurns((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.speaker === 'client' && last.text === data.clientText) return prev;
          return [...prev, { speaker: 'client' as const, text: data.clientText, turnIndex: data.turnIndex }];
        });
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
    setIsProcessing(false);
  }, [voiceSessionId, headers]);

  const handleTextSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem('text') as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await sendTurn(undefined, text);
  }, [sendTurn]);

  const handleEndCall = useCallback(async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/voice/session/${voiceSessionId}/end`, {
        method: 'POST', headers,
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        setIsProcessing(false);
        return;
      }
      setPhase('ticket');
    } catch (err) {
      setError(`Error ending call: ${err instanceof Error ? err.message : 'unknown'}`);
    }
    setIsProcessing(false);
  }, [voiceSessionId, headers]);

  const handleTicketSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (ticketText.length < 30) { setError('Ticket must be at least 30 characters'); return; }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/voice/session/${voiceSessionId}/ticket`, {
        method: 'POST', headers, body: JSON.stringify({ ticket: ticketText }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setIsProcessing(false); return; }
      setResult({ readinessLabel: data.readinessLabel, readinessScore: data.readinessScore });
      setPhase('complete');
    } catch (err) {
      setError(`Error submitting ticket: ${err instanceof Error ? err.message : 'unknown'}`);
    }
    setIsProcessing(false);
  }, [voiceSessionId, headers, ticketText]);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-1">{scenarioTitle}</h1>
      <p className="text-sm text-gray-500 mb-4">Candidate: {candidateName}</p>
      <audio ref={audioRef} className="hidden" />

      {phase === 'call' && (
        <>
          <div className="border rounded-lg p-3 mb-4 h-80 overflow-y-auto bg-gray-50">
            {turns.length === 0 && <p className="text-gray-400 text-sm">Press and hold Talk to start the call.</p>}
            {turns.map((turn, i) => (
              <div key={i} className={`mb-2 ${turn.speaker === 'candidate' ? 'text-right' : 'text-left'}`}>
                <span className={`inline-block px-3 py-1.5 rounded-lg text-sm max-w-xs ${turn.speaker === 'candidate' ? 'bg-blue-100' : 'bg-white border'}`}>
                  <strong>{turn.speaker === 'candidate' ? 'You' : 'Client'}:</strong> {turn.text}
                </span>
              </div>
            ))}
            <div ref={turnEndRef} />
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onMouseDown={handleStartRecording}
              onMouseUp={handleStopRecording}
              onTouchStart={handleStartRecording}
              onTouchEnd={handleStopRecording}
              disabled={isProcessing}
              className={`flex-1 py-3 rounded-lg font-medium text-white ${isRecording ? 'bg-red-500 animate-pulse' : isProcessing ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              {isRecording ? '🔴 Recording... Release to send' : isProcessing ? 'Processing...' : '🎤 Talk'}
            </button>
            <button
              onClick={handleEndCall}
              disabled={turns.length < 4 || isProcessing}
              className="px-4 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-40"
            >
              End call
            </button>
          </div>

          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              name="text"
              placeholder="Or type your response..."
              disabled={isProcessing}
              className="flex-1 border rounded-lg px-3 py-2 text-sm disabled:opacity-40"
            />
            <button type="submit" disabled={isProcessing} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm disabled:opacity-40">
              Send
            </button>
          </form>
        </>
      )}

      {phase === 'ticket' && (
        <div>
          <h2 className="font-semibold mb-2">Write your ticket</h2>
          <p className="text-sm text-gray-500 mb-3">Write the ticket you would leave for the next technician.</p>
          <form onSubmit={handleTicketSubmit}>
            <textarea
              value={ticketText}
              onChange={(e) => setTicketText(e.target.value)}
              className="w-full border rounded-lg p-3 h-40 text-sm"
              placeholder="Issue summary, affected user/device, impact, scope, troubleshooting steps, priority, next action..."
              disabled={isProcessing}
            />
            <div className="flex gap-2 mt-2">
              <button type="submit" disabled={ticketText.length < 30 || isProcessing} className="px-6 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-40">
                {isProcessing ? 'Processing...' : 'Submit ticket'}
              </button>
              <span className="text-xs text-gray-400 self-center">{ticketText.length}/30 min</span>
            </div>
          </form>
        </div>
      )}

      {phase === 'complete' && result && (
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-2">Call completed</h2>
          <div className="text-lg mb-4">
            Readiness: <strong>{result.readinessLabel.replace(/_/g, ' ')}</strong>
            <span className="ml-3">Score: <strong>{result.readinessScore}/100</strong></span>
          </div>
          <p className="text-sm text-gray-500">Your manager will review the transcript, ticket, and evidence.</p>
        </div>
      )}

      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}
