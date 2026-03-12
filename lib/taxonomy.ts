import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const TAXONOMY_PATH = path.join(process.cwd(), 'taxonomy', 'taxonomy.json');
const CHANGES_LOG_PATH = path.join(process.cwd(), 'taxonomy', 'changes.log.jsonl');

export type TaxonomyItem = {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  description: string;
  triage_questions?: string[];
  triage_steps?: string[];
  resolution_steps?: string[];
  escalation_policy?: string;
  severity_guidance?: string;
  impact_guidance?: string;
  first_call_resolution?: boolean;
  owner?: string;
  examples?: string[];
  last_reviewed?: string;
};

export type TaxonomyFile = {
  version: string;
  last_updated: string;
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
  created_at: string;
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
      item.subcategory,
      item.title,
      item.description,
      ...(item.examples || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    let score = 0;
    if (item.id.toLowerCase() === q) score += 5;
    if (item.title.toLowerCase().includes(q)) score += 4;
    if (hay.includes(q)) score += 2;
    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.item);
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
  } catch (err) {
    return [];
  }
}
