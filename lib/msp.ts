import { getDb } from './mvp/db';
import { loadTaxonomy, searchTaxonomyItems, generateScenarioFromTaxonomy } from './taxonomy';
import crypto from 'crypto';

export type MSPRole = 't1' | 't2' | 'manager';

export interface MSPOrganisation {
  id: string;
  name: string;
  slug: string;
  settings_json: string;
  created_at: string;
}

export interface MSPTechnician {
  id: string;
  user_id: string;
  msp_id: string;
  role: MSPRole;
  display_name: string;
  job_title?: string;
  active: number;
}

export interface MSPInvite {
  id: string;
  msp_id: string;
  token: string;
  role: MSPRole;
  created_by: string;
  expires_at?: string;
  uses: number;
  max_uses: number;
  active: number;
}

/* ─── Organisations ──────────────────────────────────── */

export function createOrganisation(name: string, slug: string): MSPOrganisation {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  db.prepare(`
    INSERT INTO msp_organisations (id, name, slug, settings_json)
    VALUES (?, ?, ?, '{}')
  `).run(id, name, slug);
  return { id, name, slug, settings_json: '{}', created_at: new Date().toISOString() };
}

export function getOrganisation(mspId: string): MSPOrganisation | null {
  const db = getDb();
  return db.prepare('SELECT * FROM msp_organisations WHERE id = ?').get(mspId) as MSPOrganisation | null;
}

export function getOrganisationBySlug(slug: string): MSPOrganisation | null {
  const db = getDb();
  return db.prepare('SELECT * FROM msp_organisations WHERE slug = ?').get(slug) as MSPOrganisation | null;
}

/* ─── Technicians ────────────────────────────────────── */

export function addTechnician(userId: string, mspId: string, role: MSPRole, displayName: string, jobTitle?: string): MSPTechnician {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  db.prepare(`
    INSERT INTO msp_technicians (id, user_id, msp_id, role, display_name, job_title)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, mspId, role, displayName, jobTitle || null);
  return { id, user_id: userId, msp_id: mspId, role, display_name: displayName, job_title: jobTitle, active: 1 };
}

export function getTechnician(userId: string, mspId: string): MSPTechnician | null {
  const db = getDb();
  return db.prepare('SELECT * FROM msp_technicians WHERE user_id = ? AND msp_id = ?').get(userId, mspId) as MSPTechnician | null;
}

export function getTechnicianById(id: string): MSPTechnician | null {
  const db = getDb();
  return db.prepare('SELECT * FROM msp_technicians WHERE id = ?').get(id) as MSPTechnician | null;
}

export function listTechnicians(mspId: string): MSPTechnician[] {
  const db = getDb();
  return db.prepare('SELECT * FROM msp_technicians WHERE msp_id = ? AND active = 1 ORDER BY role, display_name').all(mspId) as MSPTechnician[];
}

export function updateTechnicianRole(id: string, role: MSPRole): void {
  const db = getDb();
  db.prepare('UPDATE msp_technicians SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(role, id);
}

/* ─── Invites ─────────────────────────────────────────── */

export function createInvite(mspId: string, role: MSPRole, createdBy: string, maxUses = 1): MSPInvite {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare(`
    INSERT INTO msp_invites (id, msp_id, token, role, created_by, max_uses)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, mspId, token, role, createdBy, maxUses);
  return { id, msp_id: mspId, token, role, created_by: createdBy, uses: 0, max_uses: maxUses, active: 1 };
}

export function redeemInvite(token: string): { mspId: string; role: MSPRole } | null {
  const db = getDb();
  const invite = db.prepare(`
    SELECT * FROM msp_invites WHERE token = ? AND active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))
  `).get(token) as MSPInvite | undefined;
  if (!invite || invite.uses >= invite.max_uses) return null;

  db.prepare('UPDATE msp_invites SET uses = uses + 1 WHERE id = ?').run(invite.id);
  return { mspId: invite.msp_id, role: invite.role as MSPRole };
}

export function getInviteByToken(token: string): MSPInvite | null {
  const db = getDb();
  return db.prepare('SELECT * FROM msp_invites WHERE token = ?').get(token) as MSPInvite | null;
}

/* ─── Taxonomy Access ─────────────────────────────────── */

export function setTaxonomyAccess(mspId: string, role: MSPRole, subType: string, canView: boolean): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO msp_taxonomy_access (msp_id, role, sub_type, can_view)
    VALUES (?, ?, ?, ?)
  `).run(mspId, role, subType, canView ? 1 : 0);
}

export function getVisibleSubTypes(mspId: string, role: MSPRole): string[] {
  const db = getDb();
  /* Default: T1 can see all, T2 can see all, Manager can see all.
     Explicit denials are stored as can_view = 0 */
  const denials = db.prepare(
    'SELECT sub_type FROM msp_taxonomy_access WHERE msp_id = ? AND role = ? AND can_view = 0'
  ).all(mspId, role) as { sub_type: string }[];
  const denied = new Set(denials.map(d => d.sub_type));

  return denied.size > 0
    ? ['All sub-types except: ' + [...denied].join(', ')]
    : ['All'];
}

export function filterTaxonomyByRole(items: any[], mspId: string, role: MSPRole): any[] {
  const db = getDb();
  const denials = db.prepare(
    'SELECT sub_type FROM msp_taxonomy_access WHERE msp_id = ? AND role = ? AND can_view = 0'
  ).all(mspId, role) as { sub_type: string }[];
  const denied = new Set(denials.map(d => d.sub_type));
  if (denied.size === 0) return items;
  return items.filter(i => !denied.has(i.subType));
}

/* ─── MSP Standards ──────────────────────────────────── */

export function getMSPStandards(mspId: string): any {
  const db = getDb();
  return db.prepare('SELECT * FROM msp_standards WHERE msp_id = ?').get(mspId) || null;
}

export function upsertMSPStandards(mspId: string, data: {
  scoring_categories_json?: string;
  sla_overrides_json?: string;
  escalation_rules_json?: string;
  call_requirements?: string;
}): void {
  const db = getDb();
  const existing = getMSPStandards(mspId);
  if (existing) {
    db.prepare(`
      UPDATE msp_standards SET
        scoring_categories_json = COALESCE(?, scoring_categories_json),
        sla_overrides_json = COALESCE(?, sla_overrides_json),
        escalation_rules_json = COALESCE(?, escalation_rules_json),
        call_requirements = COALESCE(?, call_requirements),
        updated_at = datetime('now')
      WHERE msp_id = ?
    `).run(
      data.scoring_categories_json || null,
      data.sla_overrides_json || null,
      data.escalation_rules_json || null,
      data.call_requirements || null,
      mspId
    );
  } else {
    db.prepare(`
      INSERT INTO msp_standards (msp_id, scoring_categories_json, sla_overrides_json, escalation_rules_json, call_requirements)
      VALUES (?, ?, ?, ?, ?)
    `).run(mspId, data.scoring_categories_json || null, data.sla_overrides_json || null, data.escalation_rules_json || null, data.call_requirements || null);
  }
}

/* ─── MSP Docs ────────────────────────────────────────── */

export function createDoc(mspId: string, title: string, content: string, authorId: string, taxonomyItemId?: string, tags?: string[]): any {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  db.prepare(`
    INSERT INTO msp_docs (id, msp_id, taxonomy_item_id, title, content, author_id, tags_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, mspId, taxonomyItemId || null, title, content, authorId, tags ? JSON.stringify(tags) : null);
  return { id, msp_id: mspId, title, content, author_id: authorId };
}

export function listDocs(mspId: string): any[] {
  const db = getDb();
  return db.prepare('SELECT * FROM msp_docs WHERE msp_id = ? ORDER BY updated_at DESC').all(mspId);
}

export function updateDoc(id: string, content: string): void {
  const db = getDb();
  db.prepare("UPDATE msp_docs SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, id);
}

/* ─── Triage — classify a ticket description ──────────── */

export async function triageTicket(description: string): Promise<{
  matches: any[];
  classification?: string;
  playbook?: string;
  escalation?: string;
  tier?: string;
  scenario?: any;
}> {
  const taxonomy = await loadTaxonomy();

  /* Search taxonomy for matching items */
  const matches = searchTaxonomyItems(taxonomy, description, 3);

  if (matches.length === 0) {
    return { matches: [], classification: 'Not found in taxonomy. Try a different description or propose a new item.' };
  }

  const best = matches[0];
  const classification = `${best.category} / ${best.type} / ${best.subType} / ${best.item}`;
  const scenario = generateScenarioFromTaxonomy(best);

  return {
    matches,
    classification,
    playbook: best.playbook_steps?.slice(0, 500),
    escalation: best.escalation_guidance,
    tier: best.helpdesk_tier || 'Not specified',
    scenario,
  };
}

/* ─── Role-based training scenarios ──────────────────── */

export async function getScenariosForRole(role: MSPRole): Promise<{ id: string; title: string; tier: string }[]> {
  const taxonomy = await loadTaxonomy();
  const tierMap: Record<MSPRole, string[]> = {
    t1: ['T1', 'T1/T2'],
    t2: ['T1', 'T1/T2', 'T2'],
    manager: ['T1', 'T1/T2', 'T2', 'T3'],
  };
  const allowedTiers = tierMap[role] || ['T1'];

  return taxonomy.items
    .filter(i => {
      const t = i.helpdesk_tier?.trim() || '';
      return allowedTiers.some(at => t.startsWith(at) || t.includes(at));
    })
    .map(i => ({
      id: i.id,
      title: `${i.subType} — ${i.item}`,
      tier: i.helpdesk_tier || 'T1',
    }));
}
