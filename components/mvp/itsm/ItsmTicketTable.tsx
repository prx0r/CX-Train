'use client';

const TD_STYLE = { padding: '10px 14px', borderBottom: '1px solid #f0f0f0', fontSize: 13, color: '#333' };
const TH_STYLE = { padding: '10px 14px', textAlign: 'left' as const, color: '#666', fontWeight: 600, fontSize: 12, background: '#f7f8fa', borderBottom: '1px solid #eee' };

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
  critical: { bg: '#d9534f', color: '#fff' },
  high: { bg: '#f0ad4e', color: '#fff' },
  medium: { bg: '#5bc0de', color: '#fff' },
  low: { bg: '#5cb85c', color: '#fff' },
};

export default function ItsmTicketTable({ tickets, title }: { tickets: TicketRow[]; title: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#1b2f53' }}>{title}</span>
        <span style={{ fontSize: 12, color: '#888' }}>{tickets.length} items</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
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
                onMouseEnter={e => (e.currentTarget.style.background = '#fafcff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ ...TD_STYLE, color: '#0070d2', fontWeight: 600 }}>{t.number}</td>
                <td style={TD_STYLE}>
                  <span style={{
                    display: 'inline-block', borderRadius: 3, padding: '2px 7px',
                    fontSize: 11, fontWeight: 600,
                    ...(PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium),
                  }}>
                    {t.priority}
                  </span>
                </td>
                <td style={TD_STYLE}>
                  <span style={{ display: 'inline-block', borderRadius: 3, padding: '2px 7px', fontSize: 11, fontWeight: 600,
                    background: t.status === 'completed' ? '#27ae6022' : t.status === 'analysed' ? '#3498db22' : '#f0ad4e22',
                    color: t.status === 'completed' ? '#27ae60' : t.status === 'analysed' ? '#3498db' : '#f0ad4e',
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
              <tr><td colSpan={7} style={{ ...TD_STYLE, textAlign: 'center', color: '#999' }}>No tickets found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
