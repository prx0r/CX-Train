'use client';

import { useState, useEffect } from 'react';

export default function SystemTray() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', color: '#d0d0d0', fontSize: 12 }}>
      <span style={{ fontSize: 14, opacity: 0.7 }}>🔊</span>
      <span style={{ fontSize: 14, opacity: 0.7 }}>🔌</span>
      <span style={{ fontSize: 14, opacity: 0.7 }}>📶</span>
      <span style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: 12, lineHeight: 1 }}>{time}</span>
      <span style={{ fontSize: 10, opacity: 0.5, lineHeight: 1 }}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
    </div>
  );
}
