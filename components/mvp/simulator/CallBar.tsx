'use client';

type CallStatus = 'idle' | 'incoming' | 'active' | 'thinking' | 'speaking' | 'recording' | 'ended';

export default function CallBar({ status, callerName, onStartCall, onEndCall, micButton }: {
  status: CallStatus;
  callerName: string;
  onStartCall?: () => void;
  onEndCall?: () => void;
  micButton?: React.ReactNode;
}) {
  const statusStyles: Record<CallStatus, { bg: string; text: string; label: string }> = {
    idle: { bg: '#1e293b', text: '#64748b', label: 'No active call' },
    incoming: { bg: '#1e3a5f', text: '#60a5fa', label: `Incoming call from ${callerName}…` },
    active: { bg: '#064e3b', text: '#34d399', label: `On call with ${callerName}` },
    thinking: { bg: '#1e3a5f', text: '#fbbf24', label: `${callerName} is thinking…` },
    speaking: { bg: '#064e3b', text: '#34d399', label: `${callerName} is speaking` },
    recording: { bg: '#7f1d1d', text: '#fca5a5', label: 'Recording…' },
    ended: { bg: '#1e293b', text: '#64748b', label: 'Call ended' },
  };

  const s = statusStyles[status];

  return (
    <div style={{
      height: 52, background: s.bg, borderBottom: '1px solid #334155',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
      flexShrink: 0, zIndex: 100,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: status === 'incoming' || status === 'recording' ? '#ef4444' :
                    status === 'active' || status === 'speaking' ? '#22c55e' :
                    status === 'thinking' ? '#eab308' : '#64748b',
        animation: status === 'recording' || status === 'incoming' ? 'pulse 1.5s infinite' : 'none',
      }} />
      <div style={{ fontSize: 13, color: s.text, fontWeight: 500, flex: 1 }}>{s.label}</div>
      {status === 'incoming' && onStartCall && (
        <button onClick={onStartCall} style={{
          padding: '6px 20px', background: '#22c55e', color: '#fff', border: 'none',
          borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          Answer Call
        </button>
      )}
      {(status === 'active' || status === 'thinking' || status === 'speaking' || status === 'recording') && (
        <>
          {micButton}
          {onEndCall && (
            <button onClick={onEndCall} style={{
              padding: '6px 16px', background: '#dc2626', color: '#fff', border: 'none',
              borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              End Call
            </button>
          )}
        </>
      )}
    </div>
  );
}
