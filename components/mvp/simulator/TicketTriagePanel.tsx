'use client';

import { useState } from 'react';

export interface TicketTriageState {
  claimed: boolean;
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'escalated';
  typeId?: string;
  categoryId?: string;
  subcategoryId?: string;
  itemId?: string;
  impactId?: string;
  urgencyId?: string;
  priorityId?: string;
  submittedAt?: string;
}

export interface ManagerTicketTaxonomy {
  typeOptions: { id: string; label: string; description?: string }[];
  categoryTree: { id: string; label: string; subcategories: { id: string; label: string; items?: { id: string; label: string }[] }[] }[];
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
  const submitted = !!triageState.submittedAt;
  const selectedCategory = taxonomy.categoryTree.find(c => c.id === triageState.categoryId);
  const selectedSubcategory = selectedCategory?.subcategories.find(s => s.id === triageState.subcategoryId);

  if (submitted) {
    return (
      <div style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #cfcfcf' }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#0f5132', marginBottom: 6 }}>
          Triage Submitted
        </div>
        <div style={{ fontSize: 12, color: '#525252', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div><strong>Status:</strong> {triageState.status}</div>
          <div><strong>Type:</strong> {taxonomy.typeOptions.find(t => t.id === triageState.typeId)?.label || triageState.typeId}</div>
          <div><strong>Category:</strong> {selectedCategory?.label} / {selectedSubcategory?.label}</div>
          {triageState.itemId && <div><strong>Item:</strong> {selectedSubcategory?.items?.find(i => i.id === triageState.itemId)?.label}</div>}
          <div><strong>Impact:</strong> {taxonomy.impactOptions.find(i => i.id === triageState.impactId)?.label}</div>
          <div><strong>Urgency:</strong> {taxonomy.urgencyOptions.find(u => u.id === triageState.urgencyId)?.label}</div>
          <div><strong>Priority:</strong> {taxonomy.priorityOptions.find(p => p.id === triageState.priorityId)?.label}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #cfcfcf' }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#525252', marginBottom: 8 }}>
        Triage Ticket
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Status */}
        <SelectField
          label="Status"
          value={triageState.status}
          onChange={v => onTriageChange({ status: v as any })}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'waiting_customer', label: 'Waiting Customer' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'escalated', label: 'Escalated' },
          ]}
          disabled={disabled}
        />

        {/* Type */}
        <SelectField
          label="Type"
          value={triageState.typeId || ''}
          onChange={v => onTriageChange({ typeId: v })}
          options={taxonomy.typeOptions.map(t => ({ value: t.id, label: t.label }))}
          placeholder="Select type..."
          disabled={disabled}
        />

        {/* Category */}
        <SelectField
          label="Category"
          value={triageState.categoryId || ''}
          onChange={v => {
            onTriageChange({ categoryId: v, subcategoryId: undefined, itemId: undefined });
          }}
          options={taxonomy.categoryTree.map(c => ({ value: c.id, label: c.label }))}
          placeholder="Select category..."
          disabled={disabled}
        />

        {/* Subcategory */}
        {selectedCategory && (
          <SelectField
            label="Subcategory"
            value={triageState.subcategoryId || ''}
            onChange={v => {
              onTriageChange({ subcategoryId: v, itemId: undefined });
            }}
            options={selectedCategory.subcategories.map(s => ({ value: s.id, label: s.label }))}
            placeholder="Select subcategory..."
            disabled={disabled}
          />
        )}

        {/* Item */}
        {selectedSubcategory?.items && selectedSubcategory.items.length > 0 && (
          <SelectField
            label="Item / Service"
            value={triageState.itemId || ''}
            onChange={v => onTriageChange({ itemId: v })}
            options={selectedSubcategory.items.map(i => ({ value: i.id, label: i.label }))}
            placeholder="Select item..."
            disabled={disabled}
          />
        )}

        {/* Impact */}
        <SelectField
          label="Impact"
          value={triageState.impactId || ''}
          onChange={v => onTriageChange({ impactId: v })}
          options={taxonomy.impactOptions.map(i => ({ value: i.id, label: i.label }))}
          placeholder="Select impact..."
          disabled={disabled}
        />

        {/* Urgency */}
        <SelectField
          label="Urgency"
          value={triageState.urgencyId || ''}
          onChange={v => onTriageChange({ urgencyId: v })}
          options={taxonomy.urgencyOptions.map(u => ({ value: u.id, label: u.label }))}
          placeholder="Select urgency..."
          disabled={disabled}
        />

        {/* Priority */}
        <SelectField
          label="Priority"
          value={triageState.priorityId || ''}
          onChange={v => onTriageChange({ priorityId: v })}
          options={taxonomy.priorityOptions.map(p => ({ value: p.id, label: p.label }))}
          placeholder="Select priority..."
          disabled={disabled}
        />

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={disabled || !triageState.typeId || !triageState.categoryId || !triageState.subcategoryId || !triageState.impactId || !triageState.urgencyId || !triageState.priorityId}
          style={{
            marginTop: 4, padding: '7px 14px', borderRadius: 3, border: '1px solid #111',
            background: '#111', color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', width: '100%',
          }}
        >
          Submit Triage
        </button>
      </div>
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
