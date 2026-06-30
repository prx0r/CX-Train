export function Logo({ size = 28, showLabel }: { size?: number; showLabel?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="1.5" width="25" height="25" rx="5" stroke="currentColor" strokeWidth="1.5" />
        <text
          x="14" y="18.5"
          textAnchor="middle"
          fill="currentColor"
          style={{ fontFamily: "'Saira Condensed', 'Inter', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px' }}
        >
          CC
        </text>
      </svg>
      {showLabel && <span style={{ fontWeight: 700, fontSize: 14, color: 'inherit' }}>CallCallum</span>}
    </div>
  );
}
