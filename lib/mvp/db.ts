import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dbPath = process.env.MVP_SQLITE_PATH || './data/callcallum.db';
  const resolvedPath = path.resolve(process.cwd(), dbPath);
  const dir = path.dirname(resolvedPath);
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function initTables(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS assessment_criteria_versions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version INTEGER NOT NULL,
      criteria_json TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      candidate_name TEXT NOT NULL,
      candidate_email TEXT,
      invite_token TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      scenario_id TEXT,
      criteria_version_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (criteria_version_id) REFERENCES assessment_criteria_versions(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('caller','candidate','system')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      candidate_ticket_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS assessment_results (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      criteria_version_id TEXT,
      raw_model_json TEXT,
      overall_score INTEGER,
      readiness_label TEXT NOT NULL DEFAULT 'analysis_failed',
      summary TEXT,
      strengths_json TEXT,
      weaknesses_json TEXT,
      checkpoint_json TEXT,
      ticket_score INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS manager_feedback (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      result_id TEXT,
      manager_label TEXT NOT NULL,
      manager_score INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id),
      FOREIGN KEY (result_id) REFERENCES assessment_results(id)
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      industry TEXT,
      difficulty TEXT,
      caller_persona TEXT,
      hidden_facts_json TEXT NOT NULL,
      caller_behaviour_prompt TEXT NOT NULL,
      initial_message TEXT NOT NULL,
      ideal_ticket_hints TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS manager_standards (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT 'org-default',
      manager_id TEXT NOT NULL DEFAULT 'manager-default',
      required_ticket_fields_json TEXT NOT NULL,
      call_requirements TEXT,
      escalation_requirements TEXT,
      tone_preferences_json TEXT,
      good_ticket_example TEXT,
      bad_ticket_example TEXT,
      good_customer_update_example TEXT,
      good_internal_note_example TEXT,
      good_escalation_note_example TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assessment_packs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      scenario_type TEXT NOT NULL,
      role_level TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      version TEXT NOT NULL,
      customer_persona TEXT,
      hidden_facts_json TEXT NOT NULL,
      expected_behaviours_json TEXT NOT NULL,
      required_ticket_fields_json TEXT NOT NULL,
      red_flags_json TEXT NOT NULL,
      rubric_json TEXT NOT NULL,
      caller_behaviour_prompt TEXT NOT NULL DEFAULT '',
      initial_message TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analysis_runs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT 'org-default',
      manager_id TEXT NOT NULL DEFAULT 'manager-default',
      session_id TEXT NOT NULL,
      assessment_id TEXT,
      assessment_pack_id TEXT,
      analysis_type TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      rubric_version TEXT NOT NULL,
      model_provider TEXT NOT NULL,
      model TEXT NOT NULL,
      temperature REAL NOT NULL DEFAULT 0,
      input_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result_id TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (result_id) REFERENCES assessment_results(id)
    );
  `);

  const migrations = [
    `ALTER TABLE analysis_runs ADD COLUMN error_code TEXT`,
    `ALTER TABLE analysis_runs ADD COLUMN error_message TEXT`,
    `ALTER TABLE assessments ADD COLUMN manager_profile_id TEXT`,
    `ALTER TABLE assessments ADD COLUMN standards_snapshot_json TEXT`,
    `ALTER TABLE assessments ADD COLUMN invite_expires_at TEXT`,
    `ALTER TABLE assessments ADD COLUMN invite_revoked INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE manager_standards ADD COLUMN manager_profile_id TEXT`,
    `ALTER TABLE manager_standards ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE manager_standards ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`,

    `ALTER TABLE assessment_packs ADD COLUMN taxonomy_item_id TEXT REFERENCES taxonomy_items(id)`,
    `ALTER TABLE scenarios ADD COLUMN taxonomy_item_id TEXT REFERENCES taxonomy_items(id)`,
    `ALTER TABLE assessment_results ADD COLUMN taxonomy_classification_json TEXT`,
    `ALTER TABLE analysis_runs ADD COLUMN taxonomy_match_json TEXT`,

    `ALTER TABLE assessments ADD COLUMN assessment_pack_id TEXT`,
    `ALTER TABLE assessments ADD COLUMN assessment_mode TEXT NOT NULL DEFAULT 'chat_call'`,
    `ALTER TABLE assessment_packs ADD COLUMN sim_config_json TEXT`,
    `ALTER TABLE assessment_packs ADD COLUMN sim_initial_state_json TEXT`,
    `ALTER TABLE assessment_packs ADD COLUMN sim_success_conditions_json TEXT`,

    `ALTER TABLE session_events ADD COLUMN input_source TEXT NOT NULL DEFAULT 'text'`,
    `ALTER TABLE session_events ADD COLUMN audio_metadata_json TEXT`,

    `ALTER TABLE assessments ADD COLUMN assignment_type TEXT NOT NULL DEFAULT 'hiring_exam'`,

    // v2 scoring system columns
    `ALTER TABLE assessments ADD COLUMN scoring_snapshot_json TEXT`,
    `ALTER TABLE assessments ADD COLUMN mode_config_json TEXT`,
    `ALTER TABLE manager_standards ADD COLUMN scoring_overrides_json TEXT`,
    `ALTER TABLE assessment_results ADD COLUMN category_scores_json TEXT`,
    `ALTER TABLE assessment_results ADD COLUMN mandatory_failures_json TEXT`,
    `ALTER TABLE assessment_results ADD COLUMN gate_hits_json TEXT`,
    `ALTER TABLE assessment_results ADD COLUMN criteria_breakdown_json TEXT`,

    /* v3 — pack snapshot for immutable frozen pack data (2026-06-27) */
    `ALTER TABLE assessments ADD COLUMN pack_snapshot_json TEXT`,

    /* v4 — compliance assessment results */
    `ALTER TABLE assessment_results ADD COLUMN compliance_score INTEGER`,
    `ALTER TABLE assessment_results ADD COLUMN compliance_json TEXT`,

    /* v5 — audio recording analysis */
    `ALTER TABLE assessment_results ADD COLUMN recording_path TEXT`,
    `ALTER TABLE assessment_results ADD COLUMN recording_analysis_json TEXT`,

    /* v6 — candidate profiles and user linking */
    `ALTER TABLE assessments ADD COLUMN candidate_user_id TEXT`,
    `ALTER TABLE assessments ADD COLUMN attempt_mode TEXT NOT NULL DEFAULT 'invited'`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  /* Candidate-facing tables (created here, managed by app; Better Auth creates its own user/session/account tables) */
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidate_profiles (
      user_id TEXT PRIMARY KEY,
      is_public INTEGER NOT NULL DEFAULT 0,
      show_attempts INTEGER NOT NULL DEFAULT 0,
      show_recordings INTEGER NOT NULL DEFAULT 0,
      show_transcripts INTEGER NOT NULL DEFAULT 0,
      show_feedback INTEGER NOT NULL DEFAULT 0,
      show_ticket_notes INTEGER NOT NULL DEFAULT 0,
      bio TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS featured_attempts (
      id TEXT PRIMARY KEY,
      candidate_user_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'public',
      show_audio INTEGER NOT NULL DEFAULT 1,
      show_transcript INTEGER NOT NULL DEFAULT 1,
      show_feedback INTEGER NOT NULL DEFAULT 1,
      show_ticket_note INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (candidate_user_id) REFERENCES candidate_profiles(user_id),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id)
    );

    CREATE INDEX IF NOT EXISTS idx_featured_attempts_user ON featured_attempts(candidate_user_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_candidate_user ON assessments(candidate_user_id);

    /* v7 — skill taxonomy and scoring normalization */
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      parent_skill_id TEXT REFERENCES skills(id),
      description TEXT,
      aliases_json TEXT,
      vendor TEXT,
      tool TEXT,
      difficulty_band TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pack_skills (
      pack_version_id TEXT NOT NULL,
      skill_id TEXT NOT NULL REFERENCES skills(id),
      weight REAL NOT NULL DEFAULT 1.0,
      required_level INTEGER,
      is_primary INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (pack_version_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS attempt_skill_scores (
      attempt_id TEXT NOT NULL REFERENCES assessments(id),
      skill_id TEXT NOT NULL REFERENCES skills(id),
      raw_score REAL NOT NULL,
      normalized_score REAL NOT NULL,
      max_score REAL NOT NULL,
      evidence_count INTEGER NOT NULL DEFAULT 0,
      missed_count INTEGER NOT NULL DEFAULT 0,
      percentile REAL,
      PRIMARY KEY (attempt_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS attempt_criterion_results (
      attempt_id TEXT NOT NULL REFERENCES assessments(id),
      criterion_id TEXT NOT NULL,
      skill_id TEXT REFERENCES skills(id),
      status TEXT NOT NULL,
      score REAL NOT NULL,
      max_score REAL NOT NULL,
      evidence_event_ids_json TEXT,
      evidence_message_ids_json TEXT,
      explanation TEXT,
      PRIMARY KEY (attempt_id, criterion_id)
    );
  `);

  /* Seed initial skills */
  try {
    const existing = db.prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number };
    if (existing.c === 0) {
      const seedSkills = [
        { id: 'outlook-desktop', slug: 'outlook-desktop', name: 'Outlook Desktop', category: 'technical', parent: null, desc: 'Outlook client troubleshooting', vendor: 'microsoft', tool: 'outlook', difficulty: 'beginner' },
        { id: 'exchange-online', slug: 'exchange-online', name: 'Exchange Online', category: 'technical', parent: null, desc: 'Exchange Online / cloud email', vendor: 'microsoft', tool: 'exchange', difficulty: 'intermediate' },
        { id: 'active-directory', slug: 'active-directory', name: 'Active Directory', category: 'technical', parent: null, desc: 'AD user/group/computer management', vendor: 'microsoft', tool: 'ad', difficulty: 'intermediate' },
        { id: 'password-reset', slug: 'password-reset', name: 'Password Reset', category: 'technical', parent: 'active-directory', desc: 'Password reset and account unlock', vendor: 'microsoft', tool: 'ad', difficulty: 'beginner' },
        { id: 'mfa', slug: 'mfa', name: 'MFA / Authentication', category: 'technical', parent: null, desc: 'Multi-factor authentication setup and troubleshooting', vendor: 'microsoft', difficulty: 'intermediate' },
        { id: 'vpn', slug: 'vpn', name: 'VPN Connectivity', category: 'technical', parent: null, desc: 'VPN client and connection troubleshooting', vendor: null, difficulty: 'intermediate' },
        { id: 'printer', slug: 'printer', name: 'Printer Troubleshooting', category: 'technical', parent: null, desc: 'Printer queue, driver, and connectivity issues', vendor: null, difficulty: 'intermediate' },
        { id: 'm365', slug: 'm365', name: 'Microsoft 365', category: 'technical', parent: null, desc: 'M365 suite administration and support', vendor: 'microsoft', tool: 'm365', difficulty: 'intermediate' },
        { id: 'security-awareness', slug: 'security-awareness', name: 'Security Awareness', category: 'technical', parent: null, desc: 'Phishing, suspicious activity, security best practices', vendor: null, difficulty: 'advanced' },
        { id: 'impact-discovery', slug: 'impact-discovery', name: 'Impact Discovery', category: 'process', parent: null, desc: 'Asking about business impact', difficulty: 'beginner' },
        { id: 'scope-discovery', slug: 'scope-discovery', name: 'Scope Discovery', category: 'process', parent: null, desc: 'Asking if one or many are affected', difficulty: 'beginner' },
        { id: 'urgency-triage', slug: 'urgency-triage', name: 'Urgency Triage', category: 'process', parent: null, desc: 'Assessing and documenting urgency', difficulty: 'beginner' },
        { id: 'escalation-judgement', slug: 'escalation-judgement', name: 'Escalation Judgement', category: 'process', parent: null, desc: 'Knowing when to escalate', difficulty: 'advanced' },
        { id: 'ticket-documentation', slug: 'ticket-documentation', name: 'Ticket Documentation', category: 'process', parent: null, desc: 'Writing clear, actionable tickets', difficulty: 'beginner' },
        { id: 'next-steps', slug: 'next-steps', name: 'Next Step Setting', category: 'process', parent: null, desc: 'Setting clear next steps with customer', difficulty: 'beginner' },
        { id: 'fix-verification', slug: 'fix-verification', name: 'Fix Verification', category: 'process', parent: null, desc: 'Verifying the fix worked before closing', difficulty: 'beginner' },
        { id: 'call-control', slug: 'call-control', name: 'Call Control', category: 'communication', parent: null, desc: 'Driving the call efficiently', difficulty: 'beginner' },
        { id: 'empathy', slug: 'empathy', name: 'Empathy', category: 'communication', parent: null, desc: 'Showing understanding and care', difficulty: 'beginner' },
        { id: 'plain-english', slug: 'plain-english', name: 'Plain English', category: 'communication', parent: null, desc: 'Avoiding jargon, explaining clearly', difficulty: 'beginner' },
        { id: 'active-listening', slug: 'active-listening', name: 'Active Listening', category: 'communication', parent: null, desc: 'Confirming understanding, paraphrasing', difficulty: 'beginner' },
        { id: 'de-escalation', slug: 'de-escalation', name: 'De-escalation', category: 'communication', parent: null, desc: 'Handling frustrated or angry callers', difficulty: 'advanced' },
      ];
      const insert = db.prepare('INSERT INTO skills (id, slug, name, category, parent_skill_id, description, vendor, tool, difficulty_band) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const s of seedSkills) {
        try { insert.run(s.id, s.slug, s.name, s.category, s.parent, s.desc, s.vendor ?? null, s.tool ?? null, s.difficulty); } catch {}
      }
    }
  } catch (e) {
    console.warn('[Skills] Seed failed (non-fatal):', e);
  }

  /* Backfill pack_snapshot_json for existing assessments that have assessment_pack_id but no snapshot */
  try {
    const rows = db.prepare(`
      SELECT id, assessment_pack_id FROM assessments
      WHERE assessment_pack_id IS NOT NULL AND pack_snapshot_json IS NULL
    `).all() as Array<{ id: string; assessment_pack_id: string }>;
    if (rows.length > 0) {
      const { getPackById } = require('./sim/packRegistry');
      const { buildPackSnapshot } = require('./sim/snapshot');
      for (const row of rows) {
        try {
          const pack = getPackById(row.assessment_pack_id);
          const snapshot = buildPackSnapshot(pack);
          db.prepare('UPDATE assessments SET pack_snapshot_json = ? WHERE id = ?')
            .run(JSON.stringify(snapshot), row.id);
        } catch (e) {
          console.warn(`[Backfill] Cannot resolve pack "${row.assessment_pack_id}" for assessment ${row.id}: ${e}`);
        }
      }
    }
  } catch {
    /* Backfill is best-effort — skip if modules aren't loaded yet */
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sim_sessions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE,
      assessment_id TEXT NOT NULL,
      assessment_pack_id TEXT,
      current_state_json TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      final_state_json TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id)
    );

    CREATE TABLE IF NOT EXISTS sim_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL,
      assessment_pack_id TEXT,
      sequence_index INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      tool_id TEXT,
      action_id TEXT,
      label TEXT,
      result_text TEXT,
      state_before_json TEXT,
      state_after_json TEXT,
      payload_json TEXT,
      timestamp_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sim_events_session
    ON sim_events(session_id, sequence_index);

    CREATE INDEX IF NOT EXISTS idx_sim_events_assessment
    ON sim_events(assessment_id, sequence_index);

    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      sequence_index INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      text TEXT,
      tool_id TEXT,
      action_id TEXT,
      label TEXT,
      result_text TEXT,
      state_before_json TEXT,
      state_after_json TEXT,
      payload_json TEXT,
      started_at_ms INTEGER,
      ended_at_ms INTEGER,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_session_events_session
    ON session_events(session_id, sequence_index);

    CREATE INDEX IF NOT EXISTS idx_session_events_assessment
    ON session_events(assessment_id, sequence_index);

    CREATE TABLE IF NOT EXISTS taxonomy_items (
      id TEXT PRIMARY KEY,
      source_id INTEGER,
      board_name TEXT NOT NULL DEFAULT 'Tier 1 Service Board',
      type TEXT NOT NULL,
      sub_type TEXT NOT NULL,
      item TEXT NOT NULL,
      definition_scope TEXT NOT NULL DEFAULT '',
      playbook TEXT NOT NULL DEFAULT '',
      keywords TEXT NOT NULL DEFAULT '',
      helpdesk_tier TEXT NOT NULL DEFAULT '',
      escalation_guidance TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_taxonomy_type ON taxonomy_items(type);
    CREATE INDEX IF NOT EXISTS idx_taxonomy_subtype ON taxonomy_items(sub_type);
    CREATE INDEX IF NOT EXISTS idx_taxonomy_item ON taxonomy_items(item);

    CREATE TABLE IF NOT EXISTS manager_profiles (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      company_name TEXT,
      role TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS manager_criterion_feedback (
      id TEXT PRIMARY KEY,
      feedback_id TEXT NOT NULL,
      criterion_id TEXT NOT NULL,
      original_status TEXT NOT NULL,
      manager_status TEXT NOT NULL,
      original_score REAL NOT NULL DEFAULT 0,
      manager_score REAL NOT NULL DEFAULT 0,
      manager_comment TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (feedback_id) REFERENCES manager_feedback(id)
    );

    CREATE TABLE IF NOT EXISTS callum_threads (
      id TEXT PRIMARY KEY,
      manager_profile_id TEXT NOT NULL,
      assessment_id TEXT,
      page_route TEXT,
      title TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS callum_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (thread_id) REFERENCES callum_threads(id)
    );

    CREATE TABLE IF NOT EXISTS callum_proposals (
      id TEXT PRIMARY KEY,
      proposal_type TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'callum',
      manager_profile_id TEXT NOT NULL,
      source_thread_id TEXT,
      source_context_hash TEXT,
      payload_schema_version TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      validation_result_json TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      approved_at TEXT,
      executed_at TEXT,
      resolved_at TEXT,
      FOREIGN KEY (source_thread_id) REFERENCES callum_threads(id)
    );

    CREATE TABLE IF NOT EXISTS manager_callum_profiles (
      id TEXT PRIMARY KEY,
      manager_profile_id TEXT NOT NULL,
      assistant_name TEXT NOT NULL DEFAULT 'Callum',
      tone TEXT NOT NULL DEFAULT 'direct',
      humour_level TEXT NOT NULL DEFAULT 'low',
      detail_level TEXT NOT NULL DEFAULT 'normal',
      feedback_style TEXT NOT NULL DEFAULT 'balanced',
      custom_instructions TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

const DEFAULT_CRITERIA_ID = 'criteria-msp-v1';
const DEFAULT_SCENARIO_ID = 'scenario-outlook-001';
const DEFAULT_STANDARDS_ID = 'standards-default-v1';
const DEFAULT_PACK_ID = 'pack-outlook-v1';
const DEFAULT_MANAGER_PROFILE_ID = 'manager-default-v1';

const PASSWORD_RESET_SCENARIO_ID = 'scenario-password-001';
const PASSWORD_RESET_PACK_ID = 'pack-password-v1';
const PRINTER_SCENARIO_ID = 'scenario-printer-001';
const PRINTER_PACK_ID = 'pack-printer-v1';

const WIFI_SCENARIO_ID = 'scenario-wifi-001';
const WIFI_PACK_ID = 'pack-wifi-v1';
const OUTLOOK_SIM_PACK_ID = 'pack-outlook-sim-v1';
const OUTLOOK_SIM_V2_PACK_ID = 'pack-outlook-sim-v2';

export function getDefaultStandardsId(): string { return DEFAULT_STANDARDS_ID; }
export function getDefaultPackId(): string { return DEFAULT_PACK_ID; }

export function seedDefaults(): void {
  const db = getDb();

  const existingCriteria = db.prepare('SELECT id FROM assessment_criteria_versions WHERE id = ?').get(DEFAULT_CRITERIA_ID);
  if (!existingCriteria) {
    const criteria = {
      id: DEFAULT_CRITERIA_ID,
      name: 'MSP First-Line Call Readiness v1',
      version: 1,
      criteria_json: JSON.stringify({
        checkpoints: [
          { key: 'confirmed_user', label: 'Confirmed who the caller is', critical: true, weight: 10 },
          { key: 'confirmed_company', label: 'Confirmed company name', critical: false, weight: 5 },
          { key: 'captured_device_or_hostname', label: 'Captured device or hostname', critical: false, weight: 8 },
          { key: 'clarified_issue', label: 'Clarified the issue', critical: false, weight: 10 },
          { key: 'asked_scope', label: 'Asked whether one user or multiple', critical: true, weight: 8 },
          { key: 'asked_impact', label: 'Asked about business impact', critical: true, weight: 10 },
          { key: 'asked_deadline_or_urgency', label: 'Asked about deadline or urgency', critical: false, weight: 7 },
          { key: 'asked_error_message', label: 'Asked about error messages', critical: false, weight: 6 },
          { key: 'asked_recent_changes', label: 'Asked about recent changes', critical: false, weight: 7 },
          { key: 'set_next_steps', label: 'Set clear next steps / expectations', critical: false, weight: 8 },
          { key: 'used_clear_language', label: 'Used clear, professional language', critical: false, weight: 5 },
          { key: 'showed_empathy', label: 'Showed empathy and understanding', critical: false, weight: 5 },
          { key: 'invented_fix', label: 'Critical failure: invented a fix', critical: true, weight: -20 },
          { key: 'unsafe_advice', label: 'Critical failure: gave unsafe advice', critical: true, weight: -30 },
        ],
        critical_failures: [
          'did not establish who the caller is',
          'did not ask impact',
          'did not ask whether one user or multiple',
          'invented a fix',
          'gave unsafe advice',
          'wrote an unusable ticket',
          'failed to set a next step',
        ],
        scoring: {
          ready_min: 80,
          needs_supervision_min: 60,
          invented_fix_cap: 'needs_supervision',
          unsafe_advice_cap: 'not_ready',
        },
      }),
      prompt_text: `You are an MSP call readiness evaluator. Assess the candidate's performance in a simulated first-line support call.`,
      active: 1,
    };
    db.prepare(`INSERT INTO assessment_criteria_versions (id, name, version, criteria_json, prompt_text, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      criteria.id, criteria.name, criteria.version, criteria.criteria_json, criteria.prompt_text, criteria.active
    );
  }

  const existingScenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(DEFAULT_SCENARIO_ID);
  if (!existingScenario) {
    const scenario = {
      id: DEFAULT_SCENARIO_ID,
      title: 'Outlook not sending before meeting',
      industry: 'accounting',
      difficulty: 'first_line',
      caller_persona: 'Sarah Thompson, a stressed accountant at Alder & Co Accountants who needs to send documents before a client meeting',
      hidden_facts_json: JSON.stringify({
        issue: 'Outlook desktop will not send email',
        user: 'Sarah Thompson',
        company: 'Alder & Co Accountants',
        device: 'Windows laptop',
        hostname: 'ALDER-LT-023',
        scope: 'single user',
        impact: 'needs to send client documents before a meeting',
        deadline: '30 minutes',
        started: 'this morning',
        error_message: 'Send/Receive error',
        workaround: 'Outlook web works',
        recent_changes: 'password changed yesterday',
      }),
      caller_behaviour_prompt: `You are Sarah Thompson, an accountant at Alder & Co Accountants. You are frustrated because Outlook desktop won't send emails and you have a client meeting in 30 minutes.
- Be vague at first: just say you "can't send email" or "Outlook is broken"
- Do NOT reveal your hostname unless the candidate explicitly asks for it
- Do NOT reveal the 30-minute deadline unless asked about urgency or deadline
- Do NOT mention Outlook web works unless the candidate asks about web/browser/alternate access
- You are frustrated but not abusive. Stay professional but push for urgency.
- If the candidate asks "can you just fix it?", respond with mild frustration
- Be realistic: you know your own name, company, what device you use, etc.
- Keep responses reasonably short (1-3 sentences)
- Stay in character as an accountant who needs to send documents before a meeting`,
      initial_message: 'Hi, I\'m having trouble with my Outlook — it\'s not sending emails. I really need to get this sorted quickly.',
      ideal_ticket_hints: 'User Sarah Thompson at Alder & Co. Outlook desktop Send/Receive error. Password changed yesterday. Single user. Webmail works. Hostname ALDER-LT-023.',
      active: 1,
    };
    db.prepare(`INSERT INTO scenarios (id, title, industry, difficulty, caller_persona, hidden_facts_json, caller_behaviour_prompt, initial_message, ideal_ticket_hints, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
      scenario.id, scenario.title, scenario.industry, scenario.difficulty, scenario.caller_persona,
      scenario.hidden_facts_json, scenario.caller_behaviour_prompt, scenario.initial_message,
      scenario.ideal_ticket_hints, scenario.active
    );
  }

  const existingStandards = db.prepare('SELECT id FROM manager_standards WHERE id = ?').get(DEFAULT_STANDARDS_ID);
  if (!existingStandards) {
    const standards = {
      id: DEFAULT_STANDARDS_ID,
      org_id: 'org-default',
      manager_id: 'manager-default',
      required_ticket_fields_json: JSON.stringify([
        'user',
        'company',
        'device_or_application',
        'issue_summary',
        'impact',
        'urgency',
        'checks_attempted',
        'next_step',
      ]),
      call_requirements: 'Acknowledge the caller. Confirm identity and company. Clarify the issue. Ask scope (one user or multiple). Ask impact. Ask urgency/deadline. Ask for error messages. Ask about recent changes. Set clear next steps. Use professional language. Show empathy.',
      escalation_requirements: 'Escalate if: outage suspected, security incident, multiple users affected, unsafe workaround attempted, caller demands manager.',
      tone_preferences_json: JSON.stringify({
        professional: true,
        empathetic: true,
        patient: true,
        no_blame: true,
        no_jargon_overload: true,
      }),
      good_ticket_example: 'User: Sarah Thompson, Alder & Co Accountants. Device: Windows laptop (ALDER-LT-023). Issue: Outlook desktop cannot send emails. Impact: Cannot send client documents before 2pm meeting. Urgency: High (30min deadline). Checks: Webmail works, password changed yesterday. Next step: Check Outlook profile and send/receive settings.',
      bad_ticket_example: 'Outlook broken. User cannot send. Fix it.',
      good_customer_update_example: 'Hi Sarah, I\'ve confirmed the issue is with your Outlook desktop client. Since webmail works, this is likely a profile or connectivity issue. I\'ll escalate to our senior team with the details — they\'ll check your Outlook profile and send/receive settings. You should hear back within the hour.',
      good_internal_note_example: 'User Sarah Thompson (Alder & Co) — Outlook desktop send error. Webmail works. Password changed yesterday. Hostname ALDER-LT-023. Single user. Presentation deadline 2pm. Escalating for Outlook profile check.',
      good_escalation_note_example: 'Escalating: Outlook send failure, single user (Alder & Co). Webmail works, suspect profile or OST issue. Recent password change. Deadline 2pm — urgent. Hostname ALDER-LT-023.',
    };
    db.prepare(`INSERT INTO manager_standards (id, org_id, manager_id, required_ticket_fields_json, call_requirements, escalation_requirements, tone_preferences_json, good_ticket_example, bad_ticket_example, good_customer_update_example, good_internal_note_example, good_escalation_note_example, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run(
      standards.id, standards.org_id, standards.manager_id, standards.required_ticket_fields_json,
      standards.call_requirements, standards.escalation_requirements, standards.tone_preferences_json,
      standards.good_ticket_example, standards.bad_ticket_example, standards.good_customer_update_example,
      standards.good_internal_note_example, standards.good_escalation_note_example
    );
  }

  const existingProfile = db.prepare('SELECT id FROM manager_profiles WHERE id = ?').get(DEFAULT_MANAGER_PROFILE_ID);
  if (!existingProfile) {
    db.prepare('INSERT INTO manager_profiles (id, display_name, company_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))').run(
      DEFAULT_MANAGER_PROFILE_ID, 'Default Manager', 'Default MSP', 'Service Desk Manager'
    );
  }

  const existingPack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(DEFAULT_PACK_ID);
  if (!existingPack) {
    const pack = {
      id: DEFAULT_PACK_ID,
      title: 'Outlook Not Sending — First-Line Apprentice',
      scenario_type: 'email_client',
      role_level: 'apprentice',
      difficulty: 'first_line',
      version: '1',
      customer_persona: 'Sarah Thompson, a stressed accountant at Alder & Co Accountants who needs to send documents before a client meeting',
      hidden_facts_json: JSON.stringify({
        issue: 'Outlook desktop will not send email',
        user: 'Sarah Thompson',
        company: 'Alder & Co Accountants',
        device: 'Windows laptop',
        hostname: 'ALDER-LT-023',
        scope: 'single user',
        impact: 'needs to send client documents before a meeting',
        deadline: '30 minutes',
        started: 'this morning',
        error_message: 'Send/Receive error',
        workaround: 'Outlook web works',
        recent_changes: 'password changed yesterday',
      }),
      expected_behaviours_json: JSON.stringify([
        'confirm user identity',
        'confirm company/client',
        'clarify exact issue',
        'ask when issue started',
        'ask impact',
        'ask urgency',
        'ask whether webmail works',
        'ask for error/status message',
        'avoid inventing a fix without evidence',
        'explain next step',
        'write ticket with actionable details',
      ]),
      required_ticket_fields_json: JSON.stringify([
        'user',
        'company',
        'device_or_application',
        'issue_summary',
        'impact',
        'urgency',
        'checks_attempted',
        'next_step',
      ]),
      red_flags_json: JSON.stringify([
        'invented_fix',
        'unsafe_advice',
        'rude_or_blameful_tone',
        'no_clear_next_step',
        'critical_urgency_missed',
      ]),
      rubric_json: JSON.stringify({
        identity_check: { weight: 1 },
        issue_clarification: { weight: 2 },
        impact: { weight: 2 },
        urgency: { weight: 2 },
        technical_discovery: { weight: 2 },
        customer_tone: { weight: 1 },
        next_steps: { weight: 2 },
        ticket_quality: { weight: 3 },
        safety: { weight: 3 },
      }),
      caller_behaviour_prompt: `You are Sarah Thompson, an accountant at Alder & Co Accountants. You are frustrated because Outlook desktop won't send emails and you have a client meeting in 30 minutes.
- Be vague at first: just say you "can't send email" or "Outlook is broken"
- Do NOT reveal your hostname unless the candidate explicitly asks for it
- Do NOT reveal the 30-minute deadline unless asked about urgency or deadline
- Do NOT mention Outlook web works unless the candidate asks about web/browser/alternate access
- You are frustrated but not abusive. Stay professional but push for urgency.
- If the candidate asks "can you just fix it?", respond with mild frustration
- Be realistic: you know your own name, company, what device you use, etc.
- Keep responses reasonably short (1-3 sentences)
- Stay in character as an accountant who needs to send documents before a meeting`,
      initial_message: 'Hi, I\'m having trouble with my Outlook — it\'s not sending emails. I really need to get this sorted quickly.',
    };
    db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`).run(
      pack.id, pack.title, pack.scenario_type, pack.role_level, pack.difficulty, pack.version,
      pack.customer_persona, pack.hidden_facts_json, pack.expected_behaviours_json,
      pack.required_ticket_fields_json, pack.red_flags_json, pack.rubric_json,
      pack.caller_behaviour_prompt, pack.initial_message
    );
  }

  // Password Reset scenario + pack
  const existingPasswordScenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(PASSWORD_RESET_SCENARIO_ID);
  if (!existingPasswordScenario) {
    db.prepare(`INSERT INTO scenarios (id, title, industry, difficulty, caller_persona, hidden_facts_json, caller_behaviour_prompt, initial_message, ideal_ticket_hints, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`).run(
      PASSWORD_RESET_SCENARIO_ID, 'Password reset not working after change',
      'legal', 'first_line',
      'James Wilson, a stressed paralegal at Mercer & Tate Law who changed his password yesterday but now cannot log in to any Microsoft 365 apps',
      JSON.stringify({
        issue: 'Password was reset yesterday but now all logins fail',
        user: 'James Wilson',
        company: 'Mercer & Tate Law',
        device: 'Windows desktop (MERCER-PC-117) + iPhone',
        scope: 'single user, all devices',
        impact: 'cannot access email or document management ahead of court filing deadline',
        deadline: 'this afternoon (3pm)',
        started: 'after password reset yesterday',
        workaround: 'IT can set a temporary password if needed',
        mfa_issue: 'MFA prompts appear but password is rejected',
      }),
      `You are James Wilson, a paralegal at Mercer & Tate Law. You changed your Microsoft 365 password yesterday as required by IT policy, but now you cannot log in to anything — Outlook, Teams, even the document management system.
- Start vague: "I changed my password and now nothing works"
- Do NOT mention the court filing deadline unless asked about urgency/impact
- Do NOT reveal you have an iPhone unless asked about scope/devices
- Do NOT mention MFA prompts appear unless asked about error messages
- You are anxious about the deadline but cooperative
- Keep responses 1-3 sentences`,
      'Hi, I changed my password yesterday like the email told me to, and now I can\'t log in to anything. This is really bad timing.',
      'User James Wilson (Mercer & Tate Law). M365 account locked after password reset. All devices affected. MFA prompts appear. Needs access before 3pm filing deadline. Reset password and test MFA.'
    );
  }

  const existingPasswordPack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(PASSWORD_RESET_PACK_ID);
  if (!existingPasswordPack) {
    db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`).run(
      PASSWORD_RESET_PACK_ID, 'Password Reset Not Working — First-Line Apprentice',
      'identity_access', 'apprentice', 'first_line', '1',
      'James Wilson, a stressed paralegal at Mercer & Tate Law who changed his password but now cannot log in to any Microsoft 365 apps',
      JSON.stringify({
        issue: 'Account locked after password reset',
        user: 'James Wilson',
        company: 'Mercer & Tate Law',
        device: 'Windows desktop (MERCER-PC-117)',
        scope: 'single user, all devices (including iPhone)',
        impact: 'cannot access email or document management before 3pm court filing deadline',
        deadline: '3pm today',
        started: 'after password reset yesterday',
        workaround: 'IT can set a temporary password',
        mfa_issue: 'MFA prompts appear but password rejected',
      }),
      JSON.stringify([
        'confirm user identity', 'confirm company', 'clarify exact issue',
        'ask when issue started', 'ask impact', 'ask urgency',
        'ask what error appears', 'ask whether MFA works',
        'ask what apps are affected', 'ask which devices',
        'avoid giving password advice without lockout check',
        'explain next step', 'write ticket with actionable details',
      ]),
      JSON.stringify(['user', 'company', 'device_or_application', 'issue_summary', 'impact', 'urgency', 'checks_attempted', 'next_step']),
      JSON.stringify(['unsafe_advice', 'invented_fix_without_evidence', 'critical_urgency_missed', 'no_clear_next_step']),
      JSON.stringify({
        identity_check: { weight: 1 },
        company_check: { weight: 1 },
        issue_clarification: { weight: 2 },
        started_when: { weight: 1 },
        impact: { weight: 3 },
        urgency: { weight: 3 },
        scope: { weight: 2 },
        technical_discovery: { weight: 2 },
        error_or_status_capture: { weight: 2 },
        recent_changes: { weight: 1 },
        next_steps: { weight: 3 },
        customer_tone: { weight: 1 },
        ticket_user_company: { weight: 1 },
        ticket_issue_summary: { weight: 2 },
        ticket_impact: { weight: 2 },
        ticket_urgency: { weight: 2 },
        ticket_checks_attempted: { weight: 2 },
        ticket_next_step: { weight: 2 },
        escalation_judgement: { weight: 2 },
        safety: { weight: 4 },
      }),
      `You are James Wilson, a paralegal at Mercer & Tate Law. You changed your Microsoft 365 password yesterday as required by IT policy, but now you cannot log in to anything — Outlook, Teams, even the document management system.
- Start vague: "I changed my password and now nothing works"
- Do NOT mention the court filing deadline unless asked about urgency/impact
- Do NOT reveal you have an iPhone unless asked about scope/devices
- Do NOT mention MFA prompts appear unless asked about error messages
- You are anxious about the deadline but cooperative
- Keep responses 1-3 sentences`,
      'Hi, I changed my password yesterday like the email told me to, and now I can\'t log in to anything. This is really bad timing.'
    );
  }

  // Printer scenario + pack
  const existingPrinterScenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(PRINTER_SCENARIO_ID);
  if (!existingPrinterScenario) {
    db.prepare(`INSERT INTO scenarios (id, title, industry, difficulty, caller_persona, hidden_facts_json, caller_behaviour_prompt, initial_message, ideal_ticket_hints, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`).run(
      PRINTER_SCENARIO_ID, 'Printer not printing — HP LaserJet Pro',
      'healthcare', 'first_line',
      'Dr. Emily Chen, a physician at Westside Medical Centre whose HP LaserJet Pro stopped printing mid-morning',
      JSON.stringify({
        issue: 'HP LaserJet Pro M404dn stopped printing mid-job',
        user: 'Dr. Emily Chen',
        company: 'Westside Medical Centre',
        device: 'HP LaserJet Pro M404dn (network printer, IP: 10.0.50.22)',
        scope: 'single printer, multiple users affected',
        impact: 'cannot print patient intake forms, prescriptions, or referral letters',
        deadline: 'needs to print before next patient in 20 minutes',
        started: 'about 2 hours ago',
        error_message: 'printer shows "Offline — Check Connection" on the display',
        workaround: 'USB direct print from one workstation works',
        recent_changes: 'network switch was rebooted last night for maintenance',
      }),
      `You are Dr. Emily Chen, a physician at Westside Medical Centre. The HP LaserJet Pro stopped printing about 2 hours ago. Several staff are affected.
- Start vague: "the printer isn't working, can you help?"
- Do NOT mention the network switch reboot unless asked about recent changes
- Do NOT mention USB workaround or that multiple users are affected unless asked about scope
- Do NOT mention the 20-minute patient deadline unless asked about urgency
- You are busy with patients and need this fixed quickly
- Keep responses 1-3 sentences`,
      'Hi, the printer in our clinic has stopped working. I have patients coming in and I really need to get this sorted.',
      'HP LaserJet Pro M404dn (10.0.50.22) offline after network maintenance last night. Multiple users at Westside Medical Centre affected. USB direct print works. Error: "Offline — Check Connection". Next: check network connectivity and restart printer queue.'
    );
  }

  const existingPrinterPack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(PRINTER_PACK_ID);
  if (!existingPrinterPack) {
    db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`).run(
      PRINTER_PACK_ID, 'Printer Not Printing — First-Line Apprentice',
      'hardware_printer', 'apprentice', 'first_line', '1',
      'Dr. Emily Chen, a physician at Westside Medical Centre whose HP LaserJet Pro stopped printing mid-morning',
      JSON.stringify({
        issue: 'HP LaserJet Pro M404dn stopped printing mid-job',
        user: 'Dr. Emily Chen',
        company: 'Westside Medical Centre',
        device: 'HP LaserJet Pro M404dn (IP: 10.0.50.22)',
        scope: 'single printer, multiple users affected',
        impact: 'cannot print patient intake forms, prescriptions, referral letters',
        deadline: 'next patient in 20 minutes',
        started: 'about 2 hours ago',
        error_message: 'printer display shows "Offline — Check Connection"',
        workaround: 'USB direct print from one workstation works',
        recent_changes: 'network switch rebooted last night',
      }),
      JSON.stringify([
        'confirm user identity', 'confirm clinic', 'clarify exact issue',
        'ask when issue started', 'ask impact', 'ask urgency',
        'ask whether one user or multiple', 'ask what error shows',
        'ask whether other printers/workstations affected',
        'ask about recent network changes',
        'explain next step', 'write ticket with actionable details',
      ]),
      JSON.stringify(['user', 'company', 'device_or_application', 'issue_summary', 'impact', 'urgency', 'checks_attempted', 'next_step']),
      JSON.stringify(['unsafe_advice', 'invented_fix_without_evidence', 'critical_urgency_missed', 'no_clear_next_step']),
      JSON.stringify({
        identity_check: { weight: 1 },
        company_check: { weight: 1 },
        issue_clarification: { weight: 2 },
        started_when: { weight: 1 },
        impact: { weight: 3 },
        urgency: { weight: 3 },
        scope: { weight: 2 },
        technical_discovery: { weight: 2 },
        error_or_status_capture: { weight: 2 },
        recent_changes: { weight: 2 },
        next_steps: { weight: 3 },
        customer_tone: { weight: 1 },
        ticket_user_company: { weight: 1 },
        ticket_issue_summary: { weight: 2 },
        ticket_impact: { weight: 2 },
        ticket_urgency: { weight: 2 },
        ticket_checks_attempted: { weight: 2 },
        ticket_next_step: { weight: 2 },
        escalation_judgement: { weight: 2 },
        safety: { weight: 4 },
      }),
      `You are Dr. Emily Chen, a physician at Westside Medical Centre. The HP LaserJet Pro stopped printing about 2 hours ago. Several staff are affected.
- Start vague: "the printer isn't working, can you help?"
- Do NOT mention the network switch reboot unless asked about recent changes
- Do NOT mention USB workaround or that multiple users are affected unless asked about scope
- Do NOT mention the 20-minute patient deadline unless asked about urgency
- You are busy with patients and need this fixed quickly
- Keep responses 1-3 sentences`,
      'Hi, the printer in our clinic has stopped working. I have patients coming in and I really need to get this sorted.'
    );
  }

  // Seed Outlook dashboard sim pack
  const existingOutlookSimPack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(OUTLOOK_SIM_PACK_ID);
  if (!existingOutlookSimPack) {
    const outlookSimConfig = {
      tools: ['customer_chat', 'ticket', 'outlook', 'browser', 'cmd', 'notes'],
      actions: [
        { id: 'open_outlook', tool: 'outlook', label: 'Open Outlook', result: 'Outlook is open. Outbox shows 3 unsent messages.', state_patch: { outlook_open: true }, visible_state_patch: { outlook_open: true, outbox_count: 3 }, score_tags: ['tool_accessed'] },
        { id: 'check_outlook_status', tool: 'outlook', label: 'Check Outlook status', result: 'Outlook is showing Working Offline.', requires_state: { outlook_open: true }, visible_state_patch: { outlook_status: 'Working Offline' }, score_tags: ['technical_discovery', 'error_or_status_capture'] },
        { id: 'toggle_work_offline', tool: 'outlook', label: 'Turn off Work Offline', result: 'Work Offline is now disabled.', requires_state: { outlook_open: true }, state_patch: { outlook_mode: 'online' }, visible_state_patch: { outlook_status: 'Online' }, score_tags: ['technical_resolution'] },
        { id: 'send_test_email', tool: 'outlook', label: 'Send test email', result: 'The test email sends successfully and the Outbox clears.', requires_state: { outlook_mode: 'online' }, state_patch: { test_email_sent: true, outbox_count: 0, issue_resolved: true }, visible_state_patch: { outbox_count: 0, test_email_sent: true }, score_tags: ['verification', 'first_call_resolution'] },
        { id: 'check_outbox', tool: 'outlook', label: 'Check Outbox', result: 'The Outbox contains 3 unsent messages.', requires_state: { outlook_open: true }, visible_state_patch: { outbox_count: 3 }, score_tags: ['technical_discovery'] },
        { id: 'open_browser', tool: 'browser', label: 'Open browser', result: 'Browser is open.', state_patch: { browser_open: true }, visible_state_patch: { browser_open: true } },
        { id: 'check_webmail', tool: 'browser', label: 'Check webmail', result: 'Webmail opens and can send email successfully.', requires_state: { browser_open: true }, visible_state_patch: { webmail_can_send: true }, score_tags: ['scope_isolation', 'technical_discovery'] },
        { id: 'run_ping', tool: 'cmd', label: 'Run basic connectivity check', result: 'Ping succeeds. Internet connectivity is working.', score_tags: ['scope_isolation'] },
        { id: 'reinstall_outlook', tool: 'outlook', label: 'Reinstall Outlook', result: 'This is excessive before basic checks and would waste time.', red_flag: 'over_fixing_without_evidence' },
        { id: 'delete_mail_profile', tool: 'outlook', label: 'Delete mail profile', result: 'This is a risky/destructive step before basic checks.', red_flag: 'destructive_action_without_evidence' },
        { id: 'escalate_without_basic_checks', tool: 'ticket', label: 'Escalate without basic checks', result: 'Escalation is premature because basic checks have not been completed.', red_flag: 'escalate_without_basic_checks' },
      ],
    };

    const simInitialState = { outlook_open: false, outlook_mode: 'offline', outbox_count: 3, webmail_can_send: true, test_email_sent: false, issue_resolved: false, ticket_note_submitted: false, browser_open: false };
    const simSuccessConditions = { outlook_mode: 'online', outbox_count: 0, test_email_sent: true, ticket_note_submitted: true };

    db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, sim_config_json, sim_initial_state_json, sim_success_conditions_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, datetime('now'), datetime('now'))`).run(
      OUTLOOK_SIM_PACK_ID,
      'Outlook Not Sending — Dashboard Sim v1',
      'email_client', 'apprentice', 'first_line', '1',
      'Sarah Thompson, an accountant at Alder & Co Accountants whose Outlook is stuck in Work Offline mode',
      JSON.stringify({
        issue: 'Outlook desktop stuck in Work Offline mode',
        user: 'Sarah Thompson', company: 'Alder & Co Accountants',
        device: 'Windows laptop (ALDER-LT-023)', scope: 'single user',
        impact: 'needs to send client documents before a meeting',
        deadline: '30 minutes', started: 'this morning',
        error_message: 'Send/Receive error, shows Working Offline',
        workaround: 'Outlook web works',
        recent_changes: 'none reported',
      }),
      JSON.stringify(['clarify impact', 'check internet/webmail', 'open Outlook', 'check status', 'disable Work Offline', 'send test email', 'confirm Outbox cleared', 'write closure note']),
      JSON.stringify(['user', 'company', 'device_or_application', 'issue_summary', 'impact', 'urgency', 'checks_attempted', 'next_step']),
      JSON.stringify(['reinstall_without_checks', 'delete_profile_without_checks', 'escalate_without_basic_checks']),
      JSON.stringify({
        identity_check: { weight: 1 }, company_check: { weight: 1 }, issue_clarification: { weight: 2 },
        started_when: { weight: 1 }, impact: { weight: 3 }, urgency: { weight: 3 }, scope: { weight: 2 },
        technical_discovery: { weight: 2 }, error_or_status_capture: { weight: 2 }, recent_changes: { weight: 1 },
        next_steps: { weight: 3 }, customer_tone: { weight: 1 }, ticket_user_company: { weight: 1 },
        ticket_issue_summary: { weight: 2 }, ticket_impact: { weight: 2 }, ticket_urgency: { weight: 2 },
        ticket_checks_attempted: { weight: 2 }, ticket_next_step: { weight: 2 }, escalation_judgement: { weight: 2 },
        safety: { weight: 4 },
      }),
      `You are Sarah Thompson, an accountant at Alder & Co Accountants. You are frustrated because Outlook desktop won't send emails and you have a client meeting in 30 minutes.
- Be vague at first: just say you "can't send email" or "Outlook is broken"
- Do NOT reveal your hostname unless the candidate explicitly asks for it
- Do NOT reveal the 30-minute deadline unless asked about urgency or deadline
- Do NOT mention Outlook web works unless the candidate asks about web/browser/alternate access
- You are frustrated but not abusive. Stay professional but push for urgency.
- Keep responses reasonably short (1-3 sentences)
- Stay in character as an accountant who needs to send documents before a meeting`,
      'Hi, I\'m having trouble with my Outlook — it\'s not sending emails. I really need to get this sorted quickly.',
      JSON.stringify(outlookSimConfig),
      JSON.stringify(simInitialState),
      JSON.stringify(simSuccessConditions)
    );
    console.log('Seeded Outlook dashboard sim pack v1');
  }

  // Seed Outlook dashboard sim pack v2
  const existingOutlookSimV2Pack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(OUTLOOK_SIM_V2_PACK_ID);
  if (!existingOutlookSimV2Pack) {
    const { getOutlookWorkOfflinePack } = require('./sim/packConfig');
    const pack = getOutlookWorkOfflinePack();
    db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, sim_config_json, sim_initial_state_json, sim_success_conditions_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, datetime('now'), datetime('now'))`).run(
      OUTLOOK_SIM_V2_PACK_ID,
      'Outlook Not Sending — Work Offline v2',
      'email_client', 'apprentice', 'first_line', '2.0',
      `${pack.customer.name} ${pack.customer.role}, ${pack.customer.company}`,
      JSON.stringify(pack.hiddenTruth),
      JSON.stringify(pack.idealTicket.requiredFields),
      JSON.stringify(['user', 'company', 'device', 'issue_summary', 'impact', 'urgency', 'checks_attempted', 'root_cause', 'resolution', 'verification', 'next_step']),
      JSON.stringify(pack.redFlags.map((r: any) => r.id)),
      JSON.stringify(pack.rubric),
      `You are ${pack.customer.name}, ${pack.customer.role} at ${pack.customer.company}. ${pack.customer.openingLine}`,
      pack.customer.openingLine,
      JSON.stringify({ tools: pack.tools, actions: pack.actions.map((a: any) => ({ id: a.id, tool: a.tool, label: a.label, allowedPhases: a.allowedPhases, requiresState: a.requiresState, effects: a.effects, observation: a.observation, taxonomyTags: a.taxonomyTags, scoreImpact: a.scoreImpact })) }),
      JSON.stringify(pack.initialState),
      JSON.stringify({ phase: 'submitted' })
    );
    console.log('Seeded Outlook dashboard sim pack v2');
  }

  // Seed taxonomy from the XLSX-derived JSON if table is empty
  const taxonomyCount = (db.prepare('SELECT COUNT(*) as c FROM taxonomy_items').get() as any).c;
  if (taxonomyCount === 0) {
    seedTaxonomyFromJson(db);
  }

  // Wi-Fi / Connectivity scenario + pack
  const existingWiFiScenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(WIFI_SCENARIO_ID);
  if (!existingWiFiScenario) {
    db.prepare(`INSERT INTO scenarios (id, title, industry, difficulty, caller_persona, hidden_facts_json, caller_behaviour_prompt, initial_message, ideal_ticket_hints, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`).run(
      WIFI_SCENARIO_ID, 'Wi-Fi dropping — remote site',
      'legal', 'first_line',
      'Marcus Chen, a solicitor at Chen & Associates who is working from a remote satellite office. Wi-Fi keeps dropping every 10-15 minutes, disrupting video calls and document access.',
      JSON.stringify({
        issue: 'Wi-Fi drops connection every 10-15 minutes',
        user: 'Marcus Chen',
        company: 'Chen & Associates (Satellite Office — Building B, Floor 3)',
        device: 'Dell Latitude 5540 (DELL-MARCUS-02)',
        scope: 'multiple users in satellite office affected',
        impact: 'cannot maintain video calls with clients, cannot access cloud document system reliably',
        deadline: 'client video call in 45 minutes',
        started: 'this morning, after building maintenance finished',
        error_message: 'Wi-Fi icon shows connected but no internet access; requires disconnect/reconnect',
        workaround: 'wired ethernet in meeting room works',
        recent_changes: 'building maintenance worked on floor 3 electrical/network closet this morning',
      }),
      `You are Marcus Chen, a solicitor at Chen & Associates. You are working from your firm's satellite office on floor 3. The Wi-Fi has been dropping all morning.
- Start vague: "the Wi-Fi keeps cutting out" or "internet keeps disconnecting"
- Do NOT mention the building maintenance unless asked about recent changes
- Do NOT mention that wired ethernet works unless asked about alternatives/scope
- Do NOT mention that other users are affected unless asked about scope
- Do NOT mention the 45-minute client call deadline unless asked about urgency
- You are frustrated because you cannot do your work, but remain professional
- Keep responses 1-3 sentences`,
      'Hi, the Wi-Fi in our office keeps dropping. It is really affecting my work — I keep getting disconnected from everything.',
      'User Marcus Chen at Chen & Associates satellite office (Bldg B, Floor 3). Dell Latitude 5540. Wi-Fi drops every 10-15 min. Multiple users affected. Building maintenance worked on floor 3 network closet this morning. Wired ethernet in meeting room works. Client video call in 45 min.'
    );
  }

  const existingWiFiPack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(WIFI_PACK_ID);
  if (!existingWiFiPack) {
    db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`).run(
      WIFI_PACK_ID, 'Wi-Fi Dropping — First-Line Apprentice',
      'network_connectivity', 'apprentice', 'first_line', '1',
      'Marcus Chen, a solicitor at Chen & Associates whose Wi-Fi keeps dropping at the satellite office',
      JSON.stringify({
        issue: 'Wi-Fi drops connection every 10-15 minutes at satellite office',
        user: 'Marcus Chen',
        company: 'Chen & Associates (Satellite Office — Building B, Floor 3)',
        device: 'Dell Latitude 5540 (DELL-MARCUS-02)',
        scope: 'single reporter but likely multiple users affected',
        impact: 'cannot maintain video calls or access cloud document system',
        deadline: 'client video call in 45 minutes',
        started: 'this morning, after building maintenance',
        workaround: 'wired ethernet in meeting room works',
        error_message: 'connected but no internet access',
        recent_changes: 'building maintenance on floor 3 electrical/network closet',
      }),
      JSON.stringify([
        'confirm user identity', 'confirm firm and location',
        'clarify exact issue', 'ask when issue started',
        'ask impact', 'ask urgency',
        'ask whether one user or multiple affected',
        'ask whether other devices or sites affected',
        'ask what error messages appear',
        'ask about recent changes (building, network, equipment)',
        'ask about alternative connectivity options',
        'avoid blaming the user or their device prematurely',
        'explain next step', 'write ticket with actionable details',
      ]),
      JSON.stringify(['user', 'company', 'location_or_site', 'device_or_application', 'issue_summary', 'impact', 'urgency', 'scope', 'checks_attempted', 'next_step']),
      JSON.stringify(['unsafe_advice', 'invented_fix_without_evidence', 'critical_urgency_missed', 'no_clear_next_step', 'blaming_user_hardware']),
      JSON.stringify({
        identity_check: { weight: 1 },
        company_check: { weight: 1 },
        issue_clarification: { weight: 2 },
        started_when: { weight: 1 },
        impact: { weight: 3 },
        urgency: { weight: 3 },
        scope: { weight: 2 },
        technical_discovery: { weight: 2 },
        error_or_status_capture: { weight: 2 },
        recent_changes: { weight: 3 },
        next_steps: { weight: 3 },
        customer_tone: { weight: 1 },
        ticket_user_company: { weight: 1 },
        ticket_issue_summary: { weight: 2 },
        ticket_impact: { weight: 2 },
        ticket_urgency: { weight: 2 },
        ticket_checks_attempted: { weight: 2 },
        ticket_next_step: { weight: 2 },
        escalation_judgement: { weight: 2 },
        safety: { weight: 4 },
      }),
      `You are Marcus Chen, a solicitor at Chen & Associates. You are working from your firm's satellite office on floor 3. The Wi-Fi has been dropping all morning.
- Start vague: "the Wi-Fi keeps cutting out" or "internet keeps disconnecting"
- Do NOT mention the building maintenance unless asked about recent changes
- Do NOT mention that wired ethernet works unless asked about alternatives/scope
- Do NOT mention that other users are affected unless asked about scope
- Do NOT mention the 45-minute client call deadline unless asked about urgency
- You are frustrated because you cannot do your work, but remain professional
- Keep responses 1-3 sentences`,
      'Hi, the Wi-Fi in our office keeps dropping. It is really affecting my work — I keep getting disconnected from everything.'
    );
  }
}

export function seedTaxonomyFromJson(db: Database.Database): void {
  const jsonPath = process.env.TAXONOMY_JSON_PATH || 'taxonomy/taxonomy.json';
  const xlsxPath = process.env.TAXONOMY_XLSX_PATH || 'taxonomy/Master Triage classification list.xlsx';

  // Prefer XLSX, fall back to JSON
  if (fs.existsSync(xlsxPath)) {
    try {
      const XLSX = require('xlsx');
      const wb = XLSX.readFile(xlsxPath);
      const ws = wb.Sheets['Sheet1'];
      if (!ws) { console.warn('No Sheet1 found in XLSX'); return; }
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const insert = db.prepare(`INSERT OR IGNORE INTO taxonomy_items
        (id, source_id, board_name, type, sub_type, item, definition_scope, playbook, keywords, helpdesk_tier, escalation_guidance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const tx = db.transaction(() => {
        for (const r of rows) {
          const safeId = 'tax-' + crypto.createHash('md5').update(String(r.ID) + r.Type + r.SubType + r.Item).digest('hex').slice(0, 12);
          insert.run(
            safeId,
            r.ID || null,
            r.Board_Name || 'Tier 1 Service Board',
            r.Type || '',
            r.SubType || '',
            r.Item || '',
            r['definition scope'] || '',
            r.Playbook || '',
            r.keywords || '',
            r['Helpdesk Tier'] || '',
            r['Escalation Guidance'] || ''
          );
        }
      });
      tx();
      console.log(`Seeded ${rows.length} taxonomy items from XLSX`);
      return;
    } catch (e) {
      console.warn('XLSX seed failed, falling back to JSON:', e);
    }
  }

  // Fallback to JSON seed
  if (fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const data = JSON.parse(raw);
      const items = data.items || [];
      const insert = db.prepare(`INSERT OR IGNORE INTO taxonomy_items
        (id, type, sub_type, item, definition_scope, playbook, keywords)
        VALUES (?, ?, ?, ?, ?, ?, ?)`);
      const tx = db.transaction(() => {
        for (const r of items) {
          insert.run(
            r.id || 'tax-' + crypto.createHash('md5').update(r.category + r.subcategory + r.title).digest('hex').slice(0, 12),
            r.category || '',
            r.subcategory || '',
            r.title || '',
            r.description || '',
            (r.triage_questions || []).join('\n'),
            (r.triage_steps || []).join('\n')
          );
        }
      });
      tx();
      console.log(`Seeded ${items.length} taxonomy items from JSON`);
    } catch (e) {
      console.warn('JSON seed failed:', e);
    }
  }
}

export function taxonomySearch(q: string, limit = 50): any[] {
  const d = getDb();
  const pattern = `%${q}%`;
  return d.prepare(`
    SELECT * FROM taxonomy_items
    WHERE type LIKE ? OR sub_type LIKE ? OR item LIKE ? OR definition_scope LIKE ? OR keywords LIKE ?
    ORDER BY source_id ASC
    LIMIT ?
  `).all(pattern, pattern, pattern, pattern, pattern, limit);
}

export function taxonomyGetAll(): any[] {
  const d = getDb();
  return d.prepare('SELECT * FROM taxonomy_items ORDER BY source_id ASC').all();
}

export function taxonomyGetById(id: string): any {
  const d = getDb();
  return d.prepare('SELECT * FROM taxonomy_items WHERE id = ?').get(id);
}

export { DEFAULT_CRITERIA_ID, DEFAULT_SCENARIO_ID, DEFAULT_STANDARDS_ID, DEFAULT_PACK_ID };
