'use client';

import { useState } from 'react';

interface ClearedForLiveToggleProps {
  userId: string;
  botId: string;
  cleared: boolean;
}

export function ClearedForLiveToggle({ userId, botId, cleared }: ClearedForLiveToggleProps) {
  const [isCleared, setIsCleared] = useState(cleared);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/cleared-for-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, botId, cleared: !isCleared }),
      });
      if (res.ok) {
        setIsCleared(!isCleared);
        setShowConfirm(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {showConfirm ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">
            {isCleared ? 'Revoke live clearance?' : 'Grant live clearance?'}
          </span>
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`px-3 py-1 rounded text-sm font-medium ${
              isCleared
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {loading ? '...' : 'Confirm'}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="px-3 py-1 rounded text-sm text-slate-400 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <span
            className={`inline-flex px-4 py-2 rounded-lg font-semibold ${
              isCleared ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-slate-700/50 text-slate-400 border border-slate-600'
            }`}
          >
            {isCleared ? 'Cleared for live' : 'Not cleared'}
          </span>
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            {isCleared ? 'Revoke' : 'Grant'}
          </button>
        </>
      )}
    </div>
  );
}
