'use client';

import { useState, useEffect } from 'react';
import VoiceRoom from './VoiceRoom';

export default function VoiceRoomClient({ paramsPromise }: { paramsPromise: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{
    voiceSessionId: string;
    assessmentSessionId: string;
    scenarioTitle: string;
    candidateName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [started, setStarted] = useState(false);

  const apiKey = 'call_sim_demo_key';

  useEffect(() => {
    paramsPromise.then((p) => setToken(p.token));
  }, [paramsPromise]);

  useEffect(() => {
    if (!token) return;
    const stored = sessionStorage.getItem(`voice_token_${token}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.voiceSessionId) {
          setSessionInfo(parsed);
          setStarted(true);
          setLoading(false);
          return;
        }
      } catch {}
    }
    setLoading(false);
  }, [token]);

  const handleStart = async () => {
    if (!name.trim() || !token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ token, candidate_name: name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      const info = {
        voiceSessionId: data.voiceSessionId,
        assessmentSessionId: data.assessmentSessionId,
        scenarioTitle: data.scenarioTitle,
        candidateName: data.candidateName,
      };
      sessionStorage.setItem(`voice_token_${token}`, JSON.stringify(info));
      setSessionInfo(info);
      setStarted(true);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  if (!started) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">CallCallum Voice Assessment</h1>
        <p className="text-sm text-gray-500 mb-6">Enter your full name to begin your assessment.</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full border rounded-lg px-4 py-3 mb-4 text-center text-lg"
        />
        <button
          onClick={handleStart}
          disabled={!name.trim()}
          className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium disabled:opacity-40"
        >
          Start assessment
        </button>
        {error && <p className="mt-3 text-red-600 text-sm">{error}</p>}
      </div>
    );
  }

  if (!sessionInfo) return <div className="p-8 text-center text-red-500">Session error</div>;

  return (
    <VoiceRoom
      voiceSessionId={sessionInfo.voiceSessionId}
      assessmentSessionId={sessionInfo.assessmentSessionId}
      scenarioTitle={sessionInfo.scenarioTitle}
      candidateName={sessionInfo.candidateName}
      apiKey={apiKey}
    />
  );
}
