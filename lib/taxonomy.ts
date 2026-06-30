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

export function searchTaxonomyItems(taxonomy: TaxonomyFile, query: string, limit = 5): TaxonomyItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored = taxonomy.items.map((item) => {
    const hay = [
      item.id,
      item.category,
      item.type,
      item.subType,
      item.item,
      item.definition_scope,
      ...(item.keywords || []),
      item.helpdesk_tier,
      item.escalation_guidance,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    let score = 0;
    if (item.id.toLowerCase() === q) score += 5;
    if (item.item.toLowerCase().includes(q)) score += 4;
    if (item.subType.toLowerCase().includes(q)) score += 3;
    if (item.type.toLowerCase().includes(q)) score += 2;
    if (hay.includes(q)) score += 2;
    /* Boost if query matches keywords */
    if ((item.keywords || []).some(k => k.toLowerCase().includes(q))) score += 3;
    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
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
