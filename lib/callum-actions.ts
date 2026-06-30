/**
 * Callum Action Backend — auditable MSP decision engine.
 *
 * Called from ChatGPT Enterprise Actions. Stores decision metadata only
 * (not raw ticket content by default). Uses taxonomy, SLA matrix, and
 * client profiles as source-of-truth layers.
 */

import { getDb } from './mvp/db';
import { loadTaxonomy, searchTaxonomyItems } from './taxonomy';
import { classifySLA } from './mvp/analysis/slaClassifier';
import { mapAnswerToCompetencies, aggregateCompetencyWeaknesses, COMPETENCY_LABELS } from './callum/competency-map';
import crypto from 'crypto';

/* ─── Sensitivity Scan ─────────────────────────────────── */

const SENSITIVE_PATTERNS = [
  /password[:\s=]\s*\S+/i, /pass[:\s=]\s*\S+/i, /secret[:\s=]\s*\S+/i,
  /API[ _-]?key[:\s=]\s*\S+/i, /token[:\s=]\s*\S+/i, /MFA[:\s=]\s*\d+/i, /MFA\s+code/i,
  /OTP[:\s=]\s*\d+/i, /recovery code[:\s=]\s*\S+/i,
  /private key/i, /connection string/i,
  /Wi[ -]Fi password[:\s=]\s*\S+/i, /VPN password[:\s=]\s*\S+/i,
  /RDP credential/i, /license key[:\s=]\s*\S+/i,
];

export function scanForSensitive(content: string): { hasSensitive: boolean; matchedPatterns: string[] } {
  const matched: string[] = [];
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(content)) {
      matched.push(pattern.source);
    }
  }
  return { hasSensitive: matched.length > 0, matchedPatterns: matched };
}

/* ─── Fact Extraction ──────────────────────────────────── */

export interface ExtractedFacts {
  clientHint: string | null;
  symptoms: string[];
  classificationHint: string | null;
  ownerHint: string | null;
  priorityHint: string | null;
}

export function extractFacts(content: string): ExtractedFacts {
  const lower = content.toLowerCase();
  return {
    clientHint: extractClientHint(lower),
    symptoms: extractSymptoms(lower),
    classificationHint: extractClassificationHint(lower),
    ownerHint: extractOwnerHint(lower),
    priorityHint: extractPriorityHint(lower),
  };
}

function extractClientHint(text: string): string | null {
  /* Try to find "at X", "for X", "client X" */
  const patterns = [/at (\w+(?: \w+)?)(?: |\.|,)/i, /for (\w+(?: \w+)?)(?: |\.|,)/i, /client (\w+(?: \w+)?)/i];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractSymptoms(text: string): string[] {
  const symptoms: string[] = [];
  const patterns = [
    /can'?t (?:log|sign|access|connect|send|receive|print|open)/i,
    /error(?:\s*\d+)?/i, /not working/i, /won'?t (?:start|open|connect)/i,
    /blocked/i, /locked/i, /frozen/i, /crash/i, /slow/i,
    /missing/i, /disappeared/i, /failed/i, /timeout/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) symptoms.push(m[0].toLowerCase());
  }
  return [...new Set(symptoms)];
}

function extractClassificationHint(text: string): string | null {
  /* Match known taxonomy subTypes */
  const hints = [
    /login|sign.in|password|credential/i, /printer|print|scan/i,
    /email|outlook|mailbox/i, /vpn|connectivity|network/i,
    /teams|zoom|meeting/i, /wifi|wireless|internet/i,
    /desktop|laptop|computer|device/i, /phone|mobile/i,
    /security|phish|breach|malware/i, /permission|access denied/i,
    /sharepoint|onedrive|sync/i, /browser|website/i,
  ];
  for (const h of hints) {
    if (h.test(text)) return h.source;
  }
  return null;
}

function extractOwnerHint(text: string): string | null {
  if (/T1|first.line|level\s*1/i.test(text)) return 'T1';
  if (/T2|second.line|level\s*2/i.test(text)) return 'T2';
  if (/T3|third.line|level\s*3/i.test(text)) return 'T3';
  if (/vendor|supplier|manufacturer/i.test(text)) return 'Vendor';
  return null;
}

function extractPriorityHint(text: string): string | null {
  if (/P1|emergency|urgent|critical|down|all users|everyone|company.stop/i.test(text)) return 'P1';
  if (/P2|degraded|multiple|group/i.test(text)) return 'P2';
  if (/P3|minor|workaround|one user|single/i.test(text)) return 'P3';
  return null;
}

/* ─── Ticket Assist Analyse ────────────────────────────── */

export interface TicketAssistInput {
  ticket_chain: string;
  client_name?: string;
  user_question: string;
  mode: 'triage' | 'ownership' | 'response' | 'escalation' | 'sla' | 'general';
}

export interface TicketAssistOutput {
  answer_id: string;
  recommended_action: string;
  classification: {
    category: string; type: string; subtype: string; item: string;
    taxonomy_item_id: string; confidence: 'high' | 'medium' | 'low';
  } | null;
  ownership: {
    recommended_owner: string;
    escalate_to: string | null;
    escalate_when: string[];
  };
  missing_information: string[];
  suggested_client_response: string;
  internal_note: string;
  escalation_note: string;
  sla: {
    priority: string; response_target: string;
    resolution_target: string; reasoning: string;
  } | null;
  sources_used: Array<{
    source_type: string; source_id: string;
    source_version: string; fields: string[];
  }>;
  confidence: 'high' | 'medium' | 'low';
  unsupported_or_inferred_claims: string[];
  metadata_logged: boolean;
}

export async function analyseTicket(input: TicketAssistInput, userId: string, orgId: string): Promise<TicketAssistOutput> {
  const db = getDb();
  const answerId = crypto.randomBytes(16).toString('hex');
  const requestId = crypto.randomBytes(16).toString('hex');

  /* 1. Sensitivity scan */
  const sensitive = scanForSensitive(input.ticket_chain);

  /* 2. Extract facts */
  const facts = extractFacts(input.ticket_chain);

  /* 3. Search taxonomy */
  const taxonomy = await loadTaxonomy();
  const searchQuery = facts.classificationHint || input.ticket_chain.slice(0, 300);
  const matches = searchTaxonomyItems(taxonomy, searchQuery, 3);
  const bestMatch = matches[0] || null;

  /* 4. Look up client profile / protocols */
  const clientName = input.client_name || facts.clientHint;
  let clientRecord: any = null;
  let protocols: any[] = [];
  if (clientName) {
    clientRecord = db.prepare(
      'SELECT * FROM clients WHERE organization_id = ? AND (name LIKE ? OR short_name LIKE ?) LIMIT 1'
    ).get(orgId, `%${clientName}%`, `%${clientName}%`);
    if (clientRecord) {
      protocols = db.prepare(
        'SELECT * FROM client_protocols WHERE client_id = ? AND active = 1 ORDER BY version DESC'
      ).all(clientRecord.id);
    }
  }

  /* 5. SLA classification with strict impact mapping */
  const ticketLower = input.ticket_chain.toLowerCase();
  const hasCompanyWide = /whole company|all users|all sites|company.wide|everyone|entire business/i.test(ticketLower);
  const hasMultiUser = /several users|multiple users|group of users|office|site|team|department/i.test(ticketLower);
  const hasWorkaround = /workaround|alternative|temporary|manual workaround/i.test(ticketLower);
  const hasStoppage = /cannot work|cannot access|blocked from|stopped|down|not working at all/i.test(ticketLower);

  const slaInput = {
    affected_users: hasCompanyWide ? 'company' as const : hasMultiUser ? 'group' as const : 'single' as const,
    business_state: hasStoppage ? 'stopped' as const : hasMultiUser ? 'degraded' as const : 'irritation' as const,
    workaround: hasWorkaround ? 'yes' as const : 'unknown' as const,
  };

  const slaResult = classifySLA(slaInput);

  /* Build reasoning that reflects actual scope, not over-inference */
  const slaReasoning = [
    `Affected users: ${slaInput.affected_users}${slaInput.affected_users === 'company' ? ' (stated explicitly)' : slaInput.affected_users === 'group' ? ' (multi-user/site level)' : ' (single user inferred from text)'}`,
    `Business state: ${slaInput.business_state}, workaround: ${slaInput.workaround}`,
    `Priority: ${slaResult.priority} — ${slaResult.response_target} response, ${slaResult.resolution_target} resolution`,
  ];

  /* 6. Build recommendation */
  const classificationConfidence = bestMatch ? (bestMatch.helpdesk_tier ? 'high' : 'medium') : null;
  const taxonomyItem = bestMatch ? {
    category: bestMatch.category, type: bestMatch.type, subtype: bestMatch.subType,
    item: bestMatch.item, taxonomy_item_id: bestMatch.id, confidence: classificationConfidence,
  } as { category: string; type: string; subtype: string; item: string; taxonomy_item_id: string; confidence: 'high' | 'medium' | 'low' } : null;

  const recommendedOwner = bestMatch?.helpdesk_tier || facts.ownerHint || 'T1';
  const escalateTo = bestMatch?.escalation_guidance?.toLowerCase().includes('escalate') || hasMultiUser ? 'T2' : null;

  const escalateWhen = bestMatch?.escalation_guidance
    ? bestMatch.escalation_guidance.split(/\.\s+/).filter(s => s.toLowerCase().includes('escalat') || s.toLowerCase().includes('route')).map(s => s.trim()).filter(Boolean)
    : hasMultiUser ? ['Multi-user/site level impact — escalate if issue persists'] : ['If issue persists after basic T1 checks'];

  const missingInfo: string[] = [];
  if (bestMatch?.playbook_steps?.toLowerCase().includes('scope')) missingInfo.push('Scope: one user or multiple?');
  if (bestMatch?.playbook_steps?.toLowerCase().includes('error')) missingInfo.push('Exact error message or screenshot');
  if (bestMatch?.playbook_steps?.toLowerCase().includes('impact')) missingInfo.push('Business impact');
  if (bestMatch?.playbook_steps?.toLowerCase().includes('when') || bestMatch?.playbook_steps?.toLowerCase().includes('tim')) missingInfo.push('When issue started');
  if (bestMatch?.playbook_steps?.toLowerCase().includes('device') || bestMatch?.playbook_steps?.toLowerCase().includes('hostname')) missingInfo.push('Device name or hostname');
  if (!hasWorkaround) missingInfo.push('Does a workaround exist?');

  const unsupportedClaims: string[] = [];
  if (!bestMatch) unsupportedClaims.push('No matching taxonomy item found — using general MSP reasoning');
  if (sensitive.hasSensitive) unsupportedClaims.push('Sensitive content detected — verify no credentials were pasted');

  /* Sources — always include at least inference and SLA */
  const sources: TicketAssistOutput['sources_used'] = [];
  if (bestMatch) {
    sources.push({
      source_type: 'taxonomy_item', source_id: bestMatch.id,
      source_version: taxonomy.version, fields: ['definition_scope', 'playbook_steps', 'helpdesk_tier', 'escalation_guidance'],
    });
  }
  if (clientRecord) {
    sources.push({
      source_type: 'client_profile', source_id: clientRecord.id,
      source_version: '1', fields: ['name', 'status'],
    });
  }
  for (const p of protocols) {
    sources.push({
      source_type: 'client_protocol', source_id: p.id,
      source_version: String(p.version), fields: ['rule_text', 't1_guidance', 'escalation_guidance'],
    });
  }
  /* Always include SLA policy source */
  sources.push({
    source_type: 'sla_policy', source_id: 'connexion_sla_v1',
    source_version: 'v1', fields: ['impact', 'severity', 'priority_matrix', 'response_target', 'resolution_target'],
  });
  /* Always include inference/fallback if no other sources */
  if (!bestMatch && !clientRecord && protocols.length === 0) {
    sources.push({
      source_type: 'inference', source_id: 'inference:no_matching_taxonomy_item',
      fields: ['general_msp_reasoning'],
    } as any);
  }

  let action: string;
  if (escalateTo && (input.mode === 'escalation' || hasMultiUser)) {
    action = 'escalate_t2';
  } else if (!bestMatch) {
    action = 'needs_manager_review';
  } else if (recommendedOwner === 'T1') {
    action = 'keep_t1';
  } else {
    action = 'qualify_before_escalating';
  }

  const confidence: 'high' | 'medium' | 'low' = bestMatch ? 'high' : clientRecord ? 'medium' : 'low';

  const output: TicketAssistOutput = {
    answer_id: answerId,
    recommended_action: action,
    classification: taxonomyItem,
    ownership: {
      recommended_owner: recommendedOwner,
      escalate_to: escalateTo,
      escalate_when: escalateWhen,
    },
    missing_information: missingInfo,
    suggested_client_response: buildClientResponse(input, bestMatch, recommendedOwner),
    internal_note: buildInternalNote(input, bestMatch, clientRecord),
    escalation_note: bestMatch?.escalation_guidance || (hasMultiUser ? 'Multi-user impact — consider escalation' : ''),
    sla: {
      priority: slaResult.priority,
      response_target: slaResult.response_target,
      resolution_target: slaResult.resolution_target,
      reasoning: slaReasoning.join('; '),
    },
    sources_used: sources,
    confidence,
    unsupported_or_inferred_claims: unsupportedClaims,
    metadata_logged: true,
  };

  /* Store metadata */
  db.prepare(`
    INSERT INTO ticket_assist_requests (id, organization_id, user_id, mode, client_id, detected_topic, detected_taxonomy_item_id, raw_ticket_stored)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(requestId, orgId, userId, input.mode, clientRecord?.id || null, bestMatch?.item || null, bestMatch?.id || null);

  db.prepare(`
    INSERT INTO ticket_assist_answers (id, request_id, user_id, organization_id, recommended_action, recommended_owner, recommended_priority, classification_json, missing_information_json, suggested_client_response, internal_note, escalation_note, confidence, unsupported_or_inferred_claims_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(answerId, requestId, userId, orgId, action, recommendedOwner, slaResult.priority,
    JSON.stringify(taxonomyItem), JSON.stringify(missingInfo), output.suggested_client_response,
    output.internal_note, output.escalation_note, confidence, JSON.stringify(unsupportedClaims));

  for (const s of sources) {
    db.prepare(`
      INSERT INTO ticket_answer_sources (id, answer_id, source_type, source_id, source_version, field_used)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomBytes(16).toString('hex'), answerId, s.source_type, s.source_id, s.source_version, s.fields.join(', '));
  }

  db.prepare(`
    INSERT INTO action_usage_events (id, organization_id, user_id, action_name, topic, client_id, taxonomy_item_id, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomBytes(16).toString('hex'), orgId, userId, 'ticket-assist/analyse', bestMatch?.item || null, clientRecord?.id || null, bestMatch?.id || null, confidence);

  /* Debug log */
  console.log(JSON.stringify({
    action: 'ticket-assist/analyse',
    request_id: requestId,
    answer_id: answerId,
    auth_valid: true,
    mode: input.mode,
    taxonomy_matches_count: matches.length,
    top_taxonomy_item_ids: matches.map(m => m.id).join(', '),
    client_detected: !!clientRecord,
    client_protocol_matches_count: protocols.length,
    sla_policy_used: true,
    sources_used_count: sources.length,
    confidence,
    metadata_logged: true,
    raw_ticket_stored: false,
    error: null,
  }));

  return output;
}

/* ─── Helper: build responses ──────────────────────────── */

function buildClientResponse(input: TicketAssistInput, bestMatch: any, owner: string): string {
  if (owner !== 'T1') return 'Thank you for contacting us. We\'re reviewing this and will get back to you shortly.';
  const issue = bestMatch?.item || 'the issue you described';
  return `Thank you for the details. I'm looking into ${issue} now. Let me ask a few quick questions to make sure we resolve this as quickly as possible.`;
}

function buildInternalNote(input: TicketAssistInput, bestMatch: any, client: any): string {
  const lines: string[] = [];
  lines.push(`User request: ${input.user_question}`);
  if (bestMatch) lines.push(`Classification: ${bestMatch.category} / ${bestMatch.type} / ${bestMatch.subType} / ${bestMatch.item}`);
  if (client) lines.push(`Client: ${client.name}`);
  lines.push(`Status: Investigating`);
  return lines.join('\n');
}

/* ─── Flag Answer ──────────────────────────────────────── */

export function flagAnswer(answerId: string, userId: string, flagType: string, comment?: string, redactedExcerpt?: string): { flag_id: string; status: string } {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  db.prepare(`
    INSERT INTO ticket_answer_flags (id, answer_id, user_id, flag_type, comment, redacted_excerpt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, answerId, userId, flagType, comment || null, redactedExcerpt || null);
  return { flag_id: id, status: 'open' };
}

/* ─── Proposals ────────────────────────────────────────── */

export type ProposalType = 'taxonomy_change' | 'client_protocol_change' | 'sla_note_change' | 'global_playbook_change';

export function createProposal(
  proposalType: ProposalType, requestedBy: string, reason: string,
  payload: any, organizationId: string, clientName?: string, taxonomyItemId?: string, relatedAnswerId?: string,
): { proposal_id: string; status: string } {
  const db = getDb();
  const id = crypto.randomBytes(16).toString('hex');
  db.prepare(`
    INSERT INTO callum_action_proposals (id, proposal_type, status, requested_by, reason, client_name, taxonomy_item_id, related_answer_id, proposed_change_json, organization_id)
    VALUES (?, ?, 'proposed', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, proposalType, requestedBy, reason, clientName || null, taxonomyItemId || null, relatedAnswerId || null, JSON.stringify(payload), organizationId);
  return { proposal_id: id, status: 'proposed' };
}

/* ─── Dashboard Queries (grouped for existing manager pages) ── */

export function getDashboardStats(orgId: string, days = 7): any {
  const db = getDb();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const totalActions = (db.prepare('SELECT COUNT(*) as c FROM action_usage_events WHERE organization_id = ? AND created_at >= ?').get(orgId, since) as any).c;
  const totalFlags = (db.prepare('SELECT COUNT(*) as c FROM ticket_answer_flags WHERE created_at >= ?').get(since) as any).c;
  const openFlags = (db.prepare("SELECT COUNT(*) as c FROM ticket_answer_flags WHERE status = 'open' AND created_at >= ?").get(since) as any).c;
  const totalProposals = (db.prepare("SELECT COUNT(*) as c FROM callum_action_proposals WHERE created_at >= ?").get(since) as any).c;
  const openProposals = (db.prepare("SELECT COUNT(*) as c FROM callum_action_proposals WHERE status = 'proposed'").get(since) as any).c;
  const lowConfidence = (db.prepare("SELECT COUNT(*) as c FROM ticket_assist_answers WHERE organization_id = ? AND created_at >= ? AND confidence IN ('low','medium')").get(orgId, since) as any).c;

  /* Active users */
  const activeUsers = (db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM action_usage_events WHERE organization_id = ? AND created_at >= ?').get(orgId, since) as any).c;

  /* Recent flags with answer metadata */
  const recentFlags = db.prepare(`
    SELECT f.id as flag_id, f.answer_id, f.flag_type, f.comment, f.status, f.created_at,
           a.recommended_action, a.recommended_owner, a.confidence, a.unsupported_or_inferred_claims_json
    FROM ticket_answer_flags f
    LEFT JOIN ticket_assist_answers a ON a.id = f.answer_id
    WHERE f.created_at >= ?
    ORDER BY f.created_at DESC LIMIT 20
  `).all(since);

  /* Recent proposals */
  const recentProposals = db.prepare(`
    SELECT * FROM callum_action_proposals
    WHERE created_at >= ?
    ORDER BY created_at DESC LIMIT 20
  `).all(since);

  /* Taxonomy gaps — queries where no match found */
  const taxonomyGaps = db.prepare(`
    SELECT detected_topic, COUNT(*) as count FROM ticket_assist_requests
    WHERE organization_id = ? AND created_at >= ? AND detected_taxonomy_item_id IS NULL AND detected_topic IS NOT NULL
    GROUP BY detected_topic ORDER BY count DESC LIMIT 10
  `).all(orgId, since);

  /* Client profile gaps */
  const clientGaps = db.prepare(`
    SELECT client_id, COUNT(*) as count FROM ticket_assist_requests
    WHERE organization_id = ? AND created_at >= ? AND client_id IS NULL
    GROUP BY client_id ORDER BY count DESC LIMIT 10
  `).all(orgId, since);

  /* Ownership breakdown */
  const ownershipBreakdown = db.prepare(`
    SELECT recommended_owner, COUNT(*) as count FROM ticket_assist_answers
    WHERE organization_id = ? AND created_at >= ?
    GROUP BY recommended_owner ORDER BY count DESC
  `).all(orgId, since);

  /* Priority breakdown */
  const priorityBreakdown = db.prepare(`
    SELECT recommended_priority, COUNT(*) as count FROM ticket_assist_answers
    WHERE organization_id = ? AND created_at >= ? AND recommended_priority IS NOT NULL
    GROUP BY recommended_priority ORDER BY count DESC
  `).all(orgId, since);

  /* Top taxonomy items used */
  const topTaxonomyItems = db.prepare(`
    SELECT taxonomy_item_id, COUNT(*) as count FROM action_usage_events
    WHERE organization_id = ? AND created_at >= ? AND taxonomy_item_id IS NOT NULL
    GROUP BY taxonomy_item_id ORDER BY count DESC LIMIT 10
  `).all(orgId, since);

  /* System: last action time */
  const lastAction = db.prepare(
    'SELECT created_at FROM action_usage_events WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(orgId) as { created_at: string } | undefined;

  return {
    usage: {
      total_actions: totalActions,
      active_users: activeUsers,
      total_flags: totalFlags,
      open_flags: openFlags,
      total_proposals: totalProposals,
      open_proposals: openProposals,
      low_confidence: lowConfidence,
    },
    topics: db.prepare(`
      SELECT topic, COUNT(*) as count FROM action_usage_events
      WHERE organization_id = ? AND created_at >= ? AND topic IS NOT NULL
      GROUP BY topic ORDER BY count DESC LIMIT 10
    `).all(orgId, since),
    taxonomy: {
      top_items: topTaxonomyItems,
      gaps: taxonomyGaps,
      proposals: recentProposals.filter((p: any) => p.proposal_type === 'taxonomy_change'),
    },
    clients: {
      top_clients: db.prepare(`
        SELECT client_id, COUNT(*) as count FROM action_usage_events
        WHERE organization_id = ? AND created_at >= ? AND client_id IS NOT NULL
        GROUP BY client_id ORDER BY count DESC LIMIT 10
      `).all(orgId, since),
      gaps: clientGaps,
      protocol_proposals: recentProposals.filter((p: any) => p.proposal_type === 'client_protocol_change'),
    },
    standards: {
      sla_usage: priorityBreakdown,
      escalation_uncertainty: db.prepare(`
        SELECT COUNT(*) as c FROM ticket_assist_answers
        WHERE organization_id = ? AND created_at >= ? AND recommended_action IN ('escalate_t2','escalate_t3','manager_review')
      `).get(orgId, since),
      proposals: recentProposals.filter((p: any) => p.proposal_type === 'sla_note_change' || p.proposal_type === 'global_playbook_change'),
    },
    flags: recentFlags,
    proposals: recentProposals,
    /* Competency-based training recommendations */
    training_recommendations: (() => {
      /* Fetch recent answer metadata for competency mapping */
      const recentAnswers = db.prepare(`
        SELECT missing_information_json, unsupported_or_inferred_claims_json,
               recommended_action, confidence
        FROM ticket_assist_answers
        WHERE organization_id = ? AND created_at >= ?
        ORDER BY created_at DESC LIMIT 50
      `).all(orgId, since) as Array<{
        missing_information_json: string | null;
        unsupported_or_inferred_claims_json: string | null;
        recommended_action: string | null;
        confidence: string | null;
      }>;

      const allSignals = recentAnswers.map(a => mapAnswerToCompetencies({
        missing_information: a.missing_information_json ? JSON.parse(a.missing_information_json) : [],
        unsupported_or_inferred_claims: a.unsupported_or_inferred_claims_json ? JSON.parse(a.unsupported_or_inferred_claims_json) : [],
        recommended_action: a.recommended_action || undefined,
        confidence: a.confidence || undefined,
      }));

      /* Also add signals from flags */
      const recentFlagsForComp = db.prepare(`
        SELECT f.flag_type, a.recommended_action, a.confidence,
               a.missing_information_json, a.unsupported_or_inferred_claims_json
        FROM ticket_answer_flags f
        LEFT JOIN ticket_assist_answers a ON a.id = f.answer_id
        WHERE f.created_at >= ?
        ORDER BY f.created_at DESC LIMIT 20
      `).all(since) as Array<{
        flag_type: string | null;
        recommended_action: string | null;
        confidence: string | null;
        missing_information_json: string | null;
        unsupported_or_inferred_claims_json: string | null;
      }>;

      for (const f of recentFlagsForComp) {
        allSignals.push(mapAnswerToCompetencies({
          flag_type: f.flag_type || undefined,
          recommended_action: f.recommended_action || undefined,
          confidence: f.confidence || undefined,
          missing_information: f.missing_information_json ? JSON.parse(f.missing_information_json) : [],
          unsupported_or_inferred_claims: f.unsupported_or_inferred_claims_json ? JSON.parse(f.unsupported_or_inferred_claims_json) : [],
        }));
      }

      const aggregated = aggregateCompetencyWeaknesses(allSignals);

      return aggregated.slice(0, 8).map(a => {
        const info = COMPETENCY_LABELS[a.competency_id] || { name: a.competency_id, category: '', suggestedPacks: [] };
        return {
          competency_id: a.competency_id,
          competency_name: info.name,
          category: info.category,
          occurrences: a.count,
          reasons: a.reasons,
          severity: a.avg_severity,
          suggested_packs: info.suggestedPacks,
        };
      });
    })(),
    system: {
      last_action_at: lastAction?.created_at || null,
      recent_errors: [],
      action_counts_by_route: db.prepare(`
        SELECT action_name, COUNT(*) as count FROM action_usage_events
        WHERE organization_id = ? AND created_at >= ?
        GROUP BY action_name ORDER BY count DESC
      `).all(orgId, since),
    },
  };
}
