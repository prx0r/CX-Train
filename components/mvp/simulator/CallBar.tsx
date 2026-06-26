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
    idle: { bg: '#ffffff', text: '#525252', label: 'No active call' },
    incoming: { bg: '#ffffff', text: '#111111', label: `Incoming call from ${callerName}` },
    active: { bg: '#ffffff', text: '#0f5132', label: `Connected to ${callerName}` },
    thinking: { bg: '#ffffff', text: '#7a4f00', label: `${callerName} is responding` },
    speaking: { bg: '#ffffff', text: '#0f5132', label: `${callerName} is speaking` },
    recording: { bg: '#ffffff', text: '#842029', label: 'Recording' },
    ended: { bg: '#ffffff', text: '#525252', label: 'Call ended' },
  };

  const s = statusStyles[status];

  return (
    <div style={{
      height: 42, background: s.bg, borderBottom: '1px solid #b8b8b8',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
      flexShrink: 0, zIndex: 100,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: status === 'incoming' || status === 'recording' ? '#ef4444' :
                    status === 'active' || status === 'speaking' ? '#22c55e' :
                    status === 'thinking' ? '#b7791f' : '#808080',
        animation: status === 'recording' || status === 'incoming' ? 'pulse 1.5s infinite' : 'none',
      }} />
      <div style={{ fontSize: 13, color: s.text, fontWeight: 500, flex: 1 }}>{s.label}</div>
      {status === 'incoming' && onStartCall && (
        <button onClick={onStartCall} style={{
          padding: '6px 20px', background: '#111', color: '#fff', border: '1px solid #111',
          borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer',
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
              borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              End Call
            </button>
          )}
        </>
      )}
    </div>
  );
}
