import { ContractValidationResult, fail, isRecord, ok, optionalString } from './validation';

export const CALLUM_PAGE_CONTEXT_SCHEMA_VERSION = 'callum-page-context-v1';

export type CallumPageType =
  | 'dashboard'
  | 'assessment_list'
  | 'assessment_review'
  | 'standards'
  | 'packs'
  | 'system'
  | 'settings'
  | 'unknown';

export type CallumPageEntityType =
  | 'assessment'
  | 'pack'
  | 'standard'
  | 'candidate'
  | 'none';

export interface CallumPageContext {
  schemaVersion: typeof CALLUM_PAGE_CONTEXT_SCHEMA_VERSION;
  route: string;
  pageType: CallumPageType;
  entity?: {
    type: CallumPageEntityType;
    id?: string;
  };
  visibleSections?: string[];
  selectedText?: string | null;
  clientSummary?: {
    heading?: string;
    primaryLabel?: string;
    status?: string;
  };
}

const PAGE_TYPES: readonly CallumPageType[] = [
  'dashboard',
  'assessment_list',
  'assessment_review',
  'standards',
  'packs',
  'system',
  'settings',
  'unknown',
];

const ENTITY_TYPES: readonly CallumPageEntityType[] = [
  'assessment',
  'pack',
  'standard',
  'candidate',
  'none',
];

export function validateCallumPageContext(input: unknown): ContractValidationResult<CallumPageContext> {
  if (!isRecord(input)) {
    return fail([{ path: 'pageContext', message: 'Page context must be an object' }]);
  }

  const errors = [];
  const route = optionalString(input.route);
  if (!route) {
    errors.push({ path: 'route', message: 'route is required' });
  }

  const pageType = PAGE_TYPES.includes(input.pageType as CallumPageType)
    ? input.pageType as CallumPageType
    : 'unknown';

  let entity: CallumPageContext['entity'];
  if (isRecord(input.entity)) {
    const type = ENTITY_TYPES.includes(input.entity.type as CallumPageEntityType)
      ? input.entity.type as CallumPageEntityType
      : 'none';
    entity = {
      type,
      id: optionalString(input.entity.id),
    };
  } else if (typeof input.assessmentId === 'string') {
    entity = { type: 'assessment', id: input.assessmentId };
  }

  const visibleSections = Array.isArray(input.visibleSections)
    ? input.visibleSections.filter((v): v is string => typeof v === 'string')
    : undefined;

  const clientSummary = isRecord(input.clientSummary) ? {
    heading: optionalString(input.clientSummary.heading),
    primaryLabel: optionalString(input.clientSummary.primaryLabel),
    status: optionalString(input.clientSummary.status),
  } : undefined;

  if (errors.length > 0) return fail(errors);

  return ok({
    schemaVersion: CALLUM_PAGE_CONTEXT_SCHEMA_VERSION,
    route: route!,
    pageType,
    entity,
    visibleSections,
    selectedText: typeof input.selectedText === 'string' ? input.selectedText : null,
    clientSummary,
  });
}
