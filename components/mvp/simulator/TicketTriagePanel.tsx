'use client';

import { useState } from 'react';

export interface TicketTriageState {
  claimed: boolean;
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'escalated';
  boardId?: string;
  typeId?: string;
  subcategoryId?: string;
  itemId?: string;
  priorityId?: string;
  summary?: string;
  submittedAt?: string;
}

export interface ManagerTicketTaxonomy {
  boardOptions?: { id: string; label: string; description?: string }[];
  typeOptions: { id: string; label: string; description?: string }[];
  categoryTree: { id: string; label: string; subcategories: { id: string; label: string; items?: { id: string; label: string }[]; escalationGuidance?: string[] }[] }[];
  impactOptions: { id: string; label: string; description?: string }[];
  urgencyOptions: { id: string; label: string; description?: string }[];
  priorityOptions: { id: string; label: string; description?: string }[];
}

export default function TicketTriagePanel({ taxonomy, triageState, onTriageChange, onSubmit, disabled }: {
  taxonomy: ManagerTicketTaxonomy;
  triageState: TicketTriageState;
  onTriageChange: (update: Partial<TicketTriageState>) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const selectedTypeNode = taxonomy.categoryTree.find(c => c.id === triageState.typeId);
  const selectedSubcat = selectedTypeNode?.subcategories.find(s => s.id === triageState.subcategoryId);
  const boardOptions = taxonomy.boardOptions || [];
  const hasAnyValue = triageState.status !== 'open' || triageState.boardId || triageState.typeId || triageState.subcategoryId || triageState.itemId || triageState.priorityId;
  const allFilled = triageState.status !== 'open' && triageState.boardId && triageState.typeId && triageState.subcategoryId && triageState.priorityId;

  const handleSubmit = () => {
    if (allFilled) setCollapsed(true);
    onSubmit();
  };

  return (
    <div style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #cfcfcf' }}>
      <button
        onClick={() => setCollapsed(p => !p)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left' }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: collapsed ? 0 : 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{collapsed ? 'Triage Summary' : 'Triage Ticket'}</span>
          <span style={{ fontSize: 12 }}>{collapsed ? '▼ Edit' : '▲'}</span>
        </div>
      </button>

      {collapsed && allFilled && (
        <div style={{ fontSize: 12, color: '#525252', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
          {triageState.summary && <div><strong>Summary:</strong> {triageState.summary}</div>}
          <div><strong>Status:</strong> {triageState.status.replace('_', ' ')}</div>
          {triageState.boardId && <div><strong>Board:</strong> {boardOptions.find(b => b.id === triageState.boardId)?.label}</div>}
          {triageState.typeId && <div><strong>Type:</strong> {taxonomy.typeOptions.find(t => t.id === triageState.typeId)?.label}</div>}
          {triageState.subcategoryId && <div><strong>Subcategory:</strong> {selectedSubcat?.label || triageState.subcategoryId}</div>}
          {triageState.priorityId && <div><strong>Priority:</strong> {taxonomy.priorityOptions.find(p => p.id === triageState.priorityId)?.label}</div>}
        </div>
      )}

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Summary / Subject line that the candidate writes */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: '#525252', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Summary</label>
            <input
              type="text"
              value={triageState.summary || ''}
              onChange={e => onTriageChange({ summary: e.target.value })}
              placeholder="e.g. Password Reset — account locked after failed attempts"
              disabled={disabled}
              style={{
                width: '100%', padding: '5px 6px', border: '1px solid #b8b8b8', borderRadius: 3,
                fontSize: 12, color: '#111', background: disabled ? '#efefef' : '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <SelectField label="Status" value={triageState.status} onChange={v => onTriageChange({ status: v as any })}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'waiting_customer', label: 'Waiting Customer' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'escalated', label: 'Escalated' },
            ]}
            disabled={disabled}
          />
          {boardOptions.length > 0 && (
            <SelectField label="Board" value={triageState.boardId || ''} onChange={v => onTriageChange({ boardId: v })}
              options={boardOptions.map(b => ({ value: b.id, label: b.label }))}
              placeholder="Select board..." disabled={disabled}
            />
          )}
          <SelectField label="Type" value={triageState.typeId || ''} onChange={v => onTriageChange({ typeId: v, subcategoryId: undefined, itemId: undefined })}
            options={taxonomy.typeOptions.map(t => ({ value: t.id, label: t.label }))}
            placeholder="Select type..." disabled={disabled}
          />
          <SelectField label="Subcategory" value={triageState.subcategoryId || ''} onChange={v => onTriageChange({ subcategoryId: v, itemId: undefined })}
            options={selectedTypeNode ? selectedTypeNode.subcategories.map(s => ({ value: s.id, label: `${s.label}` })) : []}
            placeholder={selectedTypeNode ? 'Select subcategory...' : 'Select a type first...'}
            disabled={disabled || !selectedTypeNode}
          />
          {selectedSubcat && selectedSubcat.items && selectedSubcat.items.length > 0 && (
            <SelectField label="Item / Service" value={triageState.itemId || ''} onChange={v => onTriageChange({ itemId: v })}
              options={selectedSubcat.items.map(i => ({ value: i.id, label: i.label }))}
              placeholder="Select item..." disabled={disabled}
            />
          )}
          <SelectField label="Priority" value={triageState.priorityId || ''} onChange={v => onTriageChange({ priorityId: v })}
            options={taxonomy.priorityOptions.map(p => ({ value: p.id, label: p.label }))}
            placeholder="Select priority..." disabled={disabled}
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || !hasAnyValue}
            style={{
              marginTop: 4, padding: '7px 14px', borderRadius: 3, border: '1px solid #111',
              background: hasAnyValue && !disabled ? '#111' : '#efefef',
              color: hasAnyValue && !disabled ? '#fff' : '#525252',
              fontSize: 12, fontWeight: 700,
              cursor: hasAnyValue && !disabled ? 'pointer' : 'default', width: '100%',
            }}
          >
            Submit Triage
          </button>
        </div>
      )}
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, disabled }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 600, color: '#525252', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%', padding: '5px 6px', border: '1px solid #b8b8b8', borderRadius: 3,
          fontSize: 12, color: '#111', background: disabled ? '#efefef' : '#fff',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
