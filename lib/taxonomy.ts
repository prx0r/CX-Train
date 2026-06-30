import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const TAXONOMY_PATH = path.join(process.cwd(), 'taxonomy', 'taxonomy.json');
const CHANGES_LOG_PATH = path.join(process.cwd(), 'taxonomy', 'changes.log.jsonl');

export type TaxonomyItem = {
  id: string;
  category: string;         // Board name (e.g. "Tier 1 Service Board")
  type: string;             // Incident or Request
  subType: string;          // e.g. "Desktop/Laptop", "Email Issue"
  item: string;             // The item name: "Performance", "Login Problem"
  definition_scope: string;
  playbook_steps: string;
  keywords: string[];
  helpdesk_tier: string;
  escalation_guidance: string;
  last_updated: string;
  version: number;
};

export type TaxonomyFile = {
  version: string;
  last_updated: string;
  total_items: number;
  schema: Record<string, unknown>;
  items: TaxonomyItem[];
};

export type TaxonomyChange = {
  id: string;
  change_type: 'add' | 'update' | 'delete';
  proposed_by: string;
  reason: string;
  item?: TaxonomyItem;
  target_id?: string;
  status?: string;
  approved_by?: string;
  before_json?: string | null;
  after_json?: string | null;
  created_at: string;
  applied_at?: string;
};

export async function loadTaxonomy(): Promise<TaxonomyFile> {
  const raw = await fs.readFile(TAXONOMY_PATH, 'utf8');
  return JSON.parse(raw) as TaxonomyFile;
}

export async function saveTaxonomy(taxonomy: TaxonomyFile): Promise<void> {
  await fs.writeFile(TAXONOMY_PATH, JSON.stringify(taxonomy, null, 2), 'utf8');
}

export function hashTaxonomy(taxonomy: TaxonomyFile): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(taxonomy));
  return hash.digest('hex');
}

/* Synonym groups for query expansion — maps common terms to taxonomy items */
const SYNONYM_GROUPS: Record<string, string[]> = {
  'account lockout': ['login problem', 'cannot sign in', 'locked account', 'password reset', 'mfa issue', 'authentication failed', 'identity access', 'user access'],
  'login': ['sign in', 'authentication', 'credential', 'password', 'account access'],
  'password': ['credential', 'login', 'account access', 'authentication'],
  'internet': ['connectivity', 'network', 'wifi', 'browsing', 'web access'],
  'printer': ['print', 'scan', 'printing', 'scanner'],
  'email': ['outlook', 'mailbox', 'mail', 'webmail'],
  'vpn': ['remote access', 'connectivity', 'tunnel', 'offsite access'],
};

export function searchTaxonomyItems(taxonomy: TaxonomyFile, query: string, limit = 5): TaxonomyItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  /* Build expanded queries: original + synonyms */
  const queries = [q];
  for (const [key, synonyms] of Object.entries(SYNONYM_GROUPS)) {
    if (q.includes(key)) {
      queries.push(...synonyms);
    }
  }
  /* Also add individual words from the query */
  const words = q.split(/\s+/).filter(w => w.length > 3);
  queries.push(...words);

  const seenIds = new Set<string>();
  const results: TaxonomyItem[] = [];

  for (const subQuery of [...new Set(queries)]) {
    if (subQuery.length < 3) continue;

    const scored = taxonomy.items
      .filter(item => !seenIds.has(item.id))
      .map((item) => {
        const hay = [
          item.id, item.category, item.type, item.subType, item.item,
          item.definition_scope,
          ...(item.keywords || []),
          item.helpdesk_tier, item.escalation_guidance,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        let score = 0;
        if (item.id.toLowerCase() === subQuery) score += 10;
        if (item.item.toLowerCase() === subQuery) score += 8;
        if (item.subType.toLowerCase().includes(subQuery)) score += 4;
        if (item.item.toLowerCase().includes(subQuery)) score += 5;
        if (item.type.toLowerCase().includes(subQuery)) score += 3;
        if (hay.includes(subQuery)) score += 2;
        if ((item.keywords || []).some(k => k.toLowerCase().includes(subQuery))) score += 4;
        /* Boost if definition_scope mentions the query (redirect detection) */
        if (item.definition_scope?.toLowerCase().includes(subQuery)) score += 2;
        return { item, score };
      })
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);

    for (const s of scored) {
      if (!seenIds.has(s.item.id)) {
        seenIds.add(s.item.id);
        results.push(s.item);
      }
    }
  }

  /* Redirect pass: if any result's definition mentions "use X" or "belongs under X", include that item */
  const redirectTargets: string[] = [];
  for (const item of results) {
    const scope = (item.definition_scope || '') + ' ' + (item.playbook_steps || '');
    const redirectMatch = scope.match(/(?:classify|use|belongs? under|see)\s+([A-Z][a-zA-Z\s]+?)(?:\.|,|;|$)/i);
    if (redirectMatch) {
      const target = redirectMatch[1].toLowerCase().trim();
      redirectTargets.push(target);
    }
  }
  for (const target of redirectTargets) {
    const found = taxonomy.items.find(i =>
      !seenIds.has(i.id) && (i.item.toLowerCase().includes(target) || i.subType.toLowerCase().includes(target))
    );
    if (found) {
      seenIds.add(found.id);
      results.push(found);
    }
  }

  return results.slice(0, limit);
}

export function validateTaxonomy(taxonomy: TaxonomyFile): {
  valid: boolean;
  total: number;
  missing_tier: number;
  missing_escalation: number;
  missing_definition: number;
  duplicates: Array<{ path: string; ids: string[] }>;
  warnings: string[];
} {
  const warnings: string[] = [];
  let missingTier = 0;
  let missingEscalation = 0;
  let missingDefinition = 0;

  const pathMap = new Map<string, string[]>();

  for (const item of taxonomy.items) {
    if (!item.helpdesk_tier || item.helpdesk_tier.trim() === '') missingTier++;
    if (!item.escalation_guidance || item.escalation_guidance.trim() === '') missingEscalation++;
    if (!item.definition_scope || item.definition_scope.trim() === '') missingDefinition++;

    const p = `${item.category} / ${item.type} / ${item.subType} / ${item.item}`;
    if (!pathMap.has(p)) pathMap.set(p, []);
    pathMap.get(p)!.push(item.id);
  }

  const duplicates: Array<{ path: string; ids: string[] }> = [];
  for (const [path, ids] of pathMap) {
    if (ids.length > 1) {
      duplicates.push({ path, ids });
      warnings.push(`Duplicate path: "${path}" has ${ids.length} items: ${ids.join(', ')}`);
    }
  }

  return {
    valid: duplicates.length === 0,
    total: taxonomy.items.length,
    missing_tier: missingTier,
    missing_escalation: missingEscalation,
    missing_definition: missingDefinition,
    duplicates,
    warnings,
  };
}

export async function appendChangeLog(change: TaxonomyChange): Promise<void> {
  const line = JSON.stringify(change) + '\n';
  await fs.appendFile(CHANGES_LOG_PATH, line, 'utf8');
}

export async function readChangeLog(): Promise<TaxonomyChange[]> {
  try {
    const raw = await fs.readFile(CHANGES_LOG_PATH, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.map((line) => JSON.parse(line) as TaxonomyChange);
  } catch {
    return [];
  }
}

/**
 * Generate a training scenario from a taxonomy item.
 * Returns the scenario config that can drive a simulation call.
 */
export function generateScenarioFromTaxonomy(item: TaxonomyItem): {
  title: string;
  description: string;
  classification: string;
  expectedActions: string[];
  callerPhrasing: string[];
  tier: string;
  escalationCriteria: string[];
  evidenceRequired: string[];
} {
  const classification = `${item.category} / ${item.type} / ${item.subType} / ${item.item}`;

  /* Extract expected actions from playbook */
  const expectedActions = (item.playbook_steps || '')
    .split(/\d\)|\.\s+/)
    .map(s => s.replace(/^[:\s]+/, '').replace(/[:\s]+$/, '').trim())
    .filter(s => s.length > 10 && !s.startsWith('Escalate'));

  /* Extract caller phrasing from keywords */
  const callerPhrasing = (item.keywords || []).slice(0, 5);

  /* Parse escalation guidance into criteria */
  const escalationText = item.escalation_guidance || '';
  const escalationCriteria = escalationText
    .split(/\.\s+/)
    .filter(s => s.toLowerCase().includes('escalat') || s.toLowerCase().includes('route'))
    .map(s => s.trim())
    .filter(Boolean);

  /* Evidence required from playbook */
  const evidenceRequired: string[] = [];
  const pb = (item.playbook_steps || '').toLowerCase();
  if (pb.includes('error') || pb.includes('screenshot')) evidenceRequired.push('Error message or screenshot');
  if (pb.includes('scope') || pb.includes('user')) evidenceRequired.push('Affected scope (one user or many)');
  if (pb.includes('tim') || pb.includes('when')) evidenceRequired.push('When issue started');
  if (pb.includes('device') || pb.includes('hostname')) evidenceRequired.push('Device name / hostname');
  if (pb.includes('impact')) evidenceRequired.push('Business impact');

  return {
    title: `${item.subType} — ${item.item}`,
    description: (item.definition_scope || '').split(/\r?\n/)[0].slice(0, 200),
    classification,
    expectedActions,
    callerPhrasing,
    tier: item.helpdesk_tier || 'T1',
    escalationCriteria: escalationCriteria.length > 0 ? escalationCriteria : ['Escalate to T2 if issue persists after basic checks'],
    evidenceRequired: evidenceRequired.length > 0 ? evidenceRequired : ['Exact issue description and scope'],
  };
}
