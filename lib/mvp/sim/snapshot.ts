import { SimPack, SimState, SimAction, SimCallerBehavior } from './types';
import type { SimulatorCapabilities } from '@/lib/mvp/assignment-types';

export interface PackSnapshot {
  pack_id: string;
  pack_version: string;
  pack_title: string;

  customer: {
    name: string;
    company: string;
    role: string;
    temperament: string;
    opening_line: string;
    subject: string;
    gender: string;
    azureVoice?: Record<string, { voiceName: string; style?: string; styleDegree?: number; rate?: string; pitch?: string }>;
  };

  hidden_truth: {
    root_cause: string;
    correct_fix: string;
    ideal_diagnostic_path: string[];
    facts_only_reveal_after: Record<string, string[]>;
  };

  initial_state: SimState;

  caller_behavior: SimCallerBehavior;

  capabilities: SimulatorCapabilities;

  actions: SimAction[];

  severity: string;
  level: number;
  queue_title: string;
  taxonomy_classification: string[];

  frozen_at: string;
}

export interface SnapshotValidationError {
  field: string;
  message: string;
}

export function packModeToCapabilities(mode: string): SimulatorCapabilities {
  const remoteDesktop = mode === 'call_plus_remote';
  return {
    call: true,
    voice: true,
    textFallback: true,
    ticketPanel: true,
    remoteDesktop,
    tools: remoteDesktop ? ['outlook', 'browser', 'cmd'] : [],
    ticketComposer: true,
  };
}

export function validatePackStructure(pack: SimPack): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!pack.customer?.name) errors.push('customer.name is empty');
  if (!pack.customer?.company) errors.push('customer.company is empty');
  if (!pack.customer?.openingLine) errors.push('customer.openingLine is empty');
  if (!pack.hiddenTruth?.rootCause) errors.push('hiddenTruth.rootCause is empty');
  if (!pack.hiddenTruth?.correctFix) errors.push('hiddenTruth.correctFix is empty');
  if (!pack.initialState) errors.push('initialState is missing');
  if (!pack.initialState.phase) errors.push('initialState.phase is missing');
  if (!Array.isArray(pack.actions) || pack.actions.length === 0) errors.push('actions is empty/missing');
  if (!['call_only', 'ticket_only', 'call_plus_remote', 'voicemail_plus_ticket'].includes(pack.mode))
    errors.push(`invalid mode: "${pack.mode}"`);
  if (!pack.scoringDefaults?.criteria?.length) errors.push('scoringDefaults.criteria is empty');
  if (!pack.scoringDefaults?.thresholds?.ready) errors.push('scoringDefaults.thresholds.ready is missing');
  if (!pack.callerBehavior?.archetype) errors.push('callerBehavior.archetype is missing');
  for (const c of pack.scoringDefaults?.criteria || []) {
    if (!c.id) errors.push('criterion missing id');
    if (!['action_performed', 'tag_present', 'tag_in_event', 'state_value', 'fact_revealed'].includes(c.check))
      errors.push(`criterion "${c.id}": invalid check "${c.check}"`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateSnapshot(snapshot: unknown): { valid: boolean; errors: SnapshotValidationError[] } {
  const errors: SnapshotValidationError[] = [];
  const s = snapshot as Record<string, unknown>;

  if (!s || typeof s !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'Snapshot is not an object' }] };
  }

  if (!s.pack_id) errors.push({ field: 'pack_id', message: 'Missing pack_id' });
  if (!s.pack_version) errors.push({ field: 'pack_version', message: 'Missing pack_version' });
  if (!s.pack_title) errors.push({ field: 'pack_title', message: 'Missing pack_title' });

  const cust = s.customer as Record<string, unknown> | undefined;
  if (!cust || !cust.name) errors.push({ field: 'customer.name', message: 'Missing customer.name' });
  if (!cust || !cust.opening_line) errors.push({ field: 'customer.opening_line', message: 'Missing customer.opening_line' });

  const ht = s.hidden_truth as Record<string, unknown> | undefined;
  if (!ht || !ht.root_cause) errors.push({ field: 'hidden_truth.root_cause', message: 'Missing root_cause' });

  if (!s.initial_state) errors.push({ field: 'initial_state', message: 'Missing initial_state' });

  const caps = s.capabilities as Record<string, unknown> | undefined;
  if (!caps || typeof caps.remoteDesktop !== 'boolean')
    errors.push({ field: 'capabilities.remoteDesktop', message: 'Missing or invalid remoteDesktop' });

  if (!Array.isArray(s.actions) || (s.actions as unknown[]).length === 0)
    errors.push({ field: 'actions', message: 'Actions missing or empty' });

  if (!s.frozen_at) errors.push({ field: 'frozen_at', message: 'Missing frozen_at' });

  return { valid: errors.length === 0, errors };
}

export function buildPackSnapshot(pack: SimPack): PackSnapshot {
  return {
    pack_id: pack.id,
    pack_version: pack.version,
    pack_title: pack.title,
    customer: {
      name: pack.customer.name,
      company: pack.customer.company,
      role: pack.customer.role,
      temperament: pack.customer.temperament,
      opening_line: pack.customer.openingLine,
      subject: pack.customer.subject || '',
      gender: pack.customer.gender || 'female',
      azureVoice: pack.customer.azureVoice || undefined,
    },
    hidden_truth: {
      root_cause: pack.hiddenTruth.rootCause,
      correct_fix: pack.hiddenTruth.correctFix,
      ideal_diagnostic_path: [...pack.hiddenTruth.idealDiagnosticPath],
      facts_only_reveal_after: { ...pack.hiddenTruth.factsOnlyRevealAfter },
    },
    initial_state: JSON.parse(JSON.stringify(pack.initialState)),
    caller_behavior: { ...pack.callerBehavior },
    capabilities: packModeToCapabilities(pack.mode),
    actions: pack.actions.map(a => ({ ...a })),
    severity: pack.severity,
    level: pack.level,
    queue_title: pack.queueTitle,
    taxonomy_classification: [...pack.taxonomyClassification],
    frozen_at: new Date().toISOString(),
  };
}
