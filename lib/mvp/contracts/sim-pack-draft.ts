import { ContractValidationResult, fail, isRecord, ok, stringArray } from './validation';

export const SIM_PACK_DRAFT_SCHEMA_VERSION = 'sim-pack-draft-v1';

export type SimPackDraftMode = 'call_only' | 'ticket_only' | 'call_plus_remote' | 'voicemail_plus_ticket';
export type SimPackDraftSeverity = 'P1' | 'P2' | 'P3' | 'P4';
export type SimPackDraftTemperament = 'calm' | 'stressed' | 'angry' | 'confused';

export interface SimPackDraft {
  schemaVersion: typeof SIM_PACK_DRAFT_SCHEMA_VERSION;
  title: string;
  description: string;
  mode: SimPackDraftMode;
  level: 1 | 2 | 3;
  severity: SimPackDraftSeverity;
  customer: {
    name: string;
    company: string;
    role: string;
    temperament: SimPackDraftTemperament;
    openingLine: string;
    subject?: string;
    gender?: 'male' | 'female';
  };
  hiddenTruth: {
    rootCause: string;
    correctFix: string;
    idealDiagnosticPath: string[];
    factsOnlyRevealAfter: Record<string, string[]>;
  };
  expectedBehaviours: string[];
  requiredTicketFields: string[];
  redFlags: string[];
  taxonomyClassification: string[];
}

const MODES: readonly SimPackDraftMode[] = ['call_only', 'ticket_only', 'call_plus_remote', 'voicemail_plus_ticket'];
const SEVERITIES: readonly SimPackDraftSeverity[] = ['P1', 'P2', 'P3', 'P4'];
const TEMPERAMENTS: readonly SimPackDraftTemperament[] = ['calm', 'stressed', 'angry', 'confused'];

export function validateSimPackDraft(input: unknown): ContractValidationResult<SimPackDraft> {
  if (!isRecord(input)) {
    return fail([{ path: 'draft', message: 'Sim pack draft must be an object' }]);
  }

  const errors = [];
  for (const key of ['title', 'description']) {
    if (typeof input[key] !== 'string' || !input[key]) {
      errors.push({ path: key, message: `${key} is required` });
    }
  }

  if (!MODES.includes(input.mode as SimPackDraftMode)) {
    errors.push({ path: 'mode', message: 'mode is invalid' });
  }
  if (!SEVERITIES.includes(input.severity as SimPackDraftSeverity)) {
    errors.push({ path: 'severity', message: 'severity is invalid' });
  }
  if (![1, 2, 3].includes(input.level as number)) {
    errors.push({ path: 'level', message: 'level must be 1, 2, or 3' });
  }

  const customer = isRecord(input.customer) ? input.customer : {};
  for (const key of ['name', 'company', 'role', 'openingLine']) {
    if (typeof customer[key] !== 'string' || !customer[key]) {
      errors.push({ path: `customer.${key}`, message: `${key} is required` });
    }
  }
  if (!TEMPERAMENTS.includes(customer.temperament as SimPackDraftTemperament)) {
    errors.push({ path: 'customer.temperament', message: 'temperament is invalid' });
  }

  const hiddenTruth = isRecord(input.hiddenTruth) ? input.hiddenTruth : {};
  for (const key of ['rootCause', 'correctFix']) {
    if (typeof hiddenTruth[key] !== 'string' || !hiddenTruth[key]) {
      errors.push({ path: `hiddenTruth.${key}`, message: `${key} is required` });
    }
  }
  if (!Array.isArray(hiddenTruth.idealDiagnosticPath) || hiddenTruth.idealDiagnosticPath.length === 0) {
    errors.push({ path: 'hiddenTruth.idealDiagnosticPath', message: 'idealDiagnosticPath must not be empty' });
  }

  if (errors.length > 0) return fail(errors);

  return ok({
    schemaVersion: SIM_PACK_DRAFT_SCHEMA_VERSION,
    title: input.title as string,
    description: input.description as string,
    mode: input.mode as SimPackDraftMode,
    level: input.level as 1 | 2 | 3,
    severity: input.severity as SimPackDraftSeverity,
    customer: {
      name: customer.name as string,
      company: customer.company as string,
      role: customer.role as string,
      temperament: customer.temperament as SimPackDraftTemperament,
      openingLine: customer.openingLine as string,
      subject: typeof customer.subject === 'string' ? customer.subject : undefined,
      gender: customer.gender === 'male' || customer.gender === 'female' ? customer.gender : undefined,
    },
    hiddenTruth: {
      rootCause: hiddenTruth.rootCause as string,
      correctFix: hiddenTruth.correctFix as string,
      idealDiagnosticPath: stringArray(hiddenTruth.idealDiagnosticPath),
      factsOnlyRevealAfter: isRecord(hiddenTruth.factsOnlyRevealAfter)
        ? Object.fromEntries(Object.entries(hiddenTruth.factsOnlyRevealAfter).map(([k, v]) => [k, stringArray(v)]))
        : {},
    },
    expectedBehaviours: stringArray(input.expectedBehaviours),
    requiredTicketFields: stringArray(input.requiredTicketFields),
    redFlags: stringArray(input.redFlags),
    taxonomyClassification: stringArray(input.taxonomyClassification),
  });
}
