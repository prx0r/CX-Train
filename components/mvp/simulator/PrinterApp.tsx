'use client';

import { useState } from 'react';

interface Printer {
  name: string; driver: string; status: 'online' | 'offline' | 'error' | 'paused'; queue: number;
}

const PRINTERS: Printer[] = [
  { name: 'HP LaserJet Pro M404dn', driver: 'HP LaserJet Pro M404dn PCL-6', status: 'offline', queue: 3 },
  { name: 'Canon imageRUNNER ADV C5535', driver: 'Canon Generic Plus PCL6', status: 'online', queue: 0 },
  { name: 'Microsoft Print to PDF', driver: 'Microsoft Print To PDF', status: 'online', queue: 0 },
];

export default function PrinterApp({ onRecordInteraction }: {
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
}) {
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const statusColors: Record<string, { bg: string; text: string }> = {
    online: { bg: '#e8f3ec', text: '#0f5132' },
    offline: { bg: '#fff4f2', text: '#842029' },
    error: { bg: '#fff4f2', text: '#842029' },
    paused: { bg: '#f6e8b1', text: '#7a4f00' },
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', color: '#111' }}>
      <div style={{ padding: 12, borderBottom: '1px solid #cfcfcf', background: '#f4f4f4', fontSize: 12, fontWeight: 700 }}>
        Printers &amp; Scanners
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 600 }}>
        {PRINTERS.map(p => {
          const s = statusColors[p.status];
          const selected = selectedPrinter === p.name;
          return (
            <button
              key={p.name}
              onClick={() => {
                setSelectedPrinter(p.name);
                setShowDetails(true);
                onRecordInteraction?.('printer_select', `Selected printer: ${p.name}`);
              }}
              style={{
                padding: 12, border: `2px solid ${selected ? '#111' : '#cfcfcf'}`,
                borderRadius: 3, background: selected ? '#f4f4f4' : '#fff',
                textAlign: 'left', cursor: 'pointer', width: '100%',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{p.name}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: 2, fontSize: 10, fontWeight: 700,
                  background: s.bg, color: s.text, border: '1px solid #cfcfcf',
                  textTransform: 'uppercase',
                }}>
                  {p.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#525252' }}>
                Driver: {p.driver} · Queue: {p.queue} job{p.queue !== 1 ? 's' : ''}
              </div>
            </button>
          );
        })}

        {showDetails && selectedPrinter && (
          <div style={{ marginTop: 8, padding: 14, border: '1px solid #cfcfcf', borderRadius: 3, background: '#f8f8f8' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{selectedPrinter}</div>
            {selectedPrinter.includes('LaserJet') && (
              <div style={{ display: 'grid', gap: 8, fontSize: 12 }}>
                <div style={{ padding: 8, background: '#fff4f2', border: '1px solid #d99a91', borderRadius: 3, fontSize: 12, color: '#842029', fontWeight: 700, marginBottom: 8 }}>
                  Printer is Offline. Check connection, power, and network status.
                </div>
                <div><strong>Status:</strong> <span style={{ color: '#842029' }}>Offline — Check Connection</span></div>
                <div><strong>IP Address:</strong> 10.0.50.22</div>
                <div><strong>Driver:</strong> HP LaserJet Pro M404dn PCL-6</div>
                <div><strong>Location:</strong> Floor 2 — Accounts Department</div>
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Queue (3 jobs):</div>
                  {['Invoice batch report', 'Client statement Mar 2026', 'Remittance advice'].map((job, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e5e5e5', fontSize: 12, color: '#842029' }}>
                      <span>{job}</span>
                      <span>Pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedPrinter.includes('Canon') && (
              <div style={{ fontSize: 12, color: '#0f5132', fontWeight: 600 }}>This printer is online and ready.</div>
            )}
            {selectedPrinter.includes('Print to PDF') && (
              <div style={{ fontSize: 12, color: '#0f5132', fontWeight: 600 }}>Virtual printer for PDF output. Always available.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
