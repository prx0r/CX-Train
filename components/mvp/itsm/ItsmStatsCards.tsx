'use client';

const CARD_STYLE = (borderColor: string) => ({
  background: '#fff', borderRadius: 6, padding: '14px 18px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderTop: `3px solid ${borderColor}`,
});

interface StatCard {
  label: string; value: string; color: string; icon: string;
}

export default function ItsmStatsCards({ cards }: { cards: StatCard[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
      {cards.map(c => (
        <div key={c.label} style={CARD_STYLE(c.color)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 22, opacity: 0.5 }}>{c.icon}</div>
          </div>
          <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}
