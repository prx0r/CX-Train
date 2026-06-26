'use client';

interface StatCard {
  label: string;
  value: string;
  color: string;
}

export default function ItsmStatsCards({ cards }: { cards: StatCard[] }) {
  return (
    <div style={{
      display: 'flex', gap: 0, marginBottom: 16,
      border: '1px solid #9f9f9f', borderRadius: 3, overflow: 'hidden', background: '#fff',
    }}>
      {cards.map((c, i) => (
        <div
          key={c.label}
          style={{
            flex: 1, padding: '10px 16px',
            borderRight: i < cards.length - 1 ? '1px solid #e5e5e5' : 'none',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: c.color, lineHeight: 1.2 }}>{c.value}</div>
          <div style={{ fontSize: 11, color: '#6f6f6f', textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}
