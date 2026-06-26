'use client';

const TD_STYLE = { padding: '8px 12px', borderBottom: '1px solid #e5e5e5', fontSize: 12, color: '#222' };
const TH_STYLE = { padding: '8px 12px', textAlign: 'left' as const, color: '#111', fontWeight: 700, fontSize: 11, background: '#efefef', borderBottom: '1px solid #b8b8b8', textTransform: 'uppercase' as const };
const TR_HOVER = '#f2f6fb';

interface TicketRow {
  id: string;
  number: string;
  priority: string;
  status: string;
  category: string;
  description: string;
  assigned: string;
  updated: string;
  score?: number;
}

const PRIORITY_BADGES: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#842029', color: '#fff' },
  high: { bg: '#9f3a00', color: '#fff' },
  medium: { bg: '#7a4f00', color: '#fff' },
  low: { bg: '#6f6f6f', color: '#fff' },
};

export default function ItsmTicketTable({ tickets, title }: { tickets: TicketRow[]; title: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 3, border: '1px solid #9f9f9f', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #b8b8b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f4f4f4' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{title}</span>
        <span style={{ fontSize: 12, color: '#525252' }}>{tickets.length} items</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={TH_STYLE}>Number</th>
              <th style={TH_STYLE}>Priority</th>
              <th style={TH_STYLE}>Status</th>
              <th style={TH_STYLE}>Category</th>
              <th style={TH_STYLE}>Description</th>
              <th style={TH_STYLE}>Assigned</th>
              <th style={TH_STYLE}>Score</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id} style={{ cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = TR_HOVER)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ ...TD_STYLE, color: '#004b8d', fontWeight: 700, fontFamily: 'monospace' }}>{t.number}</td>
                <td style={TD_STYLE}>
                  <span style={{
                    display: 'inline-block', borderRadius: 2, padding: '2px 7px',
                    fontSize: 11, fontWeight: 700,
                    ...(PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium),
                  }}>
                    {t.priority}
                  </span>
                </td>
                <td style={TD_STYLE}>
                  <span style={{ display: 'inline-block', borderRadius: 2, padding: '2px 7px', fontSize: 11, fontWeight: 700,
                    background: t.status === 'completed' ? '#e8f3ec' : t.status === 'analysed' ? '#eef3f8' : '#f6e8b1',
                    color: t.status === 'completed' ? '#0f5132' : t.status === 'analysed' ? '#004b8d' : '#7a4f00',
                    border: '1px solid #cfcfcf',
                  }}>
                    {t.status}
                  </span>
                </td>
                <td style={TD_STYLE}>{t.category}</td>
                <td style={{ ...TD_STYLE, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                <td style={TD_STYLE}>{t.assigned}</td>
                <td style={{ ...TD_STYLE, fontWeight: 600 }}>{t.score != null ? `${t.score}/100` : '—'}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={7} style={{ ...TD_STYLE, textAlign: 'center', color: '#6f6f6f' }}>No tickets found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
