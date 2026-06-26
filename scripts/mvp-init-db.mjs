#!/usr/bin/env node
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env.local') });
dotenv.config();

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.MVP_SQLITE_PATH || './data/callcallum.db';
const resolvedPath = path.resolve(process.cwd(), dbPath);

console.log(`[mvp:init-db] Initialising SQLite database at: ${resolvedPath}`);

const dir = path.dirname(resolvedPath);
fs.mkdirSync(dir, { recursive: true });

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
`  );

  // Sim tables + unified session_events
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
  `);

  // Migration: add columns to existing tables (safe to run multiple times)
  const migrations = [
    `ALTER TABLE assessments ADD COLUMN manager_profile_id TEXT`,
    `ALTER TABLE assessments ADD COLUMN standards_snapshot_json TEXT`,
    `ALTER TABLE assessments ADD COLUMN invite_expires_at TEXT`,
    `ALTER TABLE assessments ADD COLUMN invite_revoked INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE manager_standards ADD COLUMN manager_profile_id TEXT`,
    `ALTER TABLE manager_standards ADD COLUMN version INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE manager_standards ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`,

    `ALTER TABLE assessments ADD COLUMN assessment_pack_id TEXT`,
    `ALTER TABLE assessments ADD COLUMN assessment_mode TEXT NOT NULL DEFAULT 'chat_call'`,
    `ALTER TABLE assessment_packs ADD COLUMN sim_config_json TEXT`,
    `ALTER TABLE assessment_packs ADD COLUMN sim_initial_state_json TEXT`,
    `ALTER TABLE assessment_packs ADD COLUMN sim_success_conditions_json TEXT`,

    `ALTER TABLE assessments ADD COLUMN assignment_type TEXT NOT NULL DEFAULT 'hiring_exam'`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

console.log('[mvp:init-db] Tables created successfully');

const DEFAULT_CRITERIA_ID = 'criteria-msp-v1';
const DEFAULT_SCENARIO_ID = 'scenario-outlook-001';

const existingCriteria = db.prepare('SELECT id FROM assessment_criteria_versions WHERE id = ?').get(DEFAULT_CRITERIA_ID);
if (!existingCriteria) {
  db.prepare(`INSERT INTO assessment_criteria_versions (id, name, version, criteria_json, prompt_text, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    DEFAULT_CRITERIA_ID,
    'MSP First-Line Call Readiness v1',
    1,
    JSON.stringify({
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
    'You are an MSP call readiness evaluator. Assess the candidate performance in a simulated first-line support call.',
    1
  );
  console.log('[mvp:init-db] Seeded criteria: MSP First-Line Call Readiness v1');
} else {
  console.log('[mvp:init-db] Criteria already exists, skipping');
}

const existingScenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(DEFAULT_SCENARIO_ID);
if (!existingScenario) {
  db.prepare(`INSERT INTO scenarios (id, title, industry, difficulty, caller_persona, hidden_facts_json, caller_behaviour_prompt, initial_message, ideal_ticket_hints, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`).run(
    DEFAULT_SCENARIO_ID,
    'Outlook not sending before meeting',
    'accounting',
    'first_line',
    'Sarah Thompson, a stressed accountant at Alder & Co Accountants who needs to send documents before a client meeting',
    JSON.stringify({
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
    `You are Sarah Thompson, an accountant at Alder & Co Accountants. You are frustrated because Outlook desktop won't send emails and you have a client meeting in 30 minutes.
- Be vague at first: just say you "can't send email" or "Outlook is broken"
- Do NOT reveal your hostname unless the candidate explicitly asks for it
- Do NOT reveal the 30-minute deadline unless asked about urgency or deadline
- Do NOT mention Outlook web works unless the candidate asks about web/browser/alternate access
- You are frustrated but not abusive. Stay professional but push for urgency.
- If the candidate asks "can you just fix it?", respond with mild frustration
- Be realistic: you know your own name, company, what device you use, etc.
- Keep responses reasonably short (1-3 sentences)
- Stay in character as an accountant who needs to send documents before a meeting`,
    'Hi, I\'m having trouble with my Outlook — it\'s not sending emails. I really need to get this sorted quickly.',
    'User Sarah Thompson at Alder & Co. Outlook desktop Send/Receive error. Password changed yesterday. Single user. Webmail works. Hostname ALDER-LT-023.',
    1
  );
  console.log('[mvp:init-db] Seeded scenario: Outlook not sending before meeting');
} else {
  console.log('[mvp:init-db] Scenario already exists, skipping');
}

const DEFAULT_STANDARDS_ID = 'standards-default-v1';
const DEFAULT_PACK_ID = 'pack-outlook-v1';

const existingStandards = db.prepare('SELECT id FROM manager_standards WHERE id = ?').get(DEFAULT_STANDARDS_ID);
if (!existingStandards) {
  db.prepare(`INSERT INTO manager_standards (id, org_id, manager_id, required_ticket_fields_json, call_requirements, escalation_requirements, tone_preferences_json, good_ticket_example, bad_ticket_example, good_customer_update_example, good_internal_note_example, good_escalation_note_example, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run(
    DEFAULT_STANDARDS_ID,
    'org-default',
    'manager-default',
    JSON.stringify(['user', 'company', 'device_or_application', 'issue_summary', 'impact', 'urgency', 'checks_attempted', 'next_step']),
    'Acknowledge the caller. Confirm identity and company. Clarify the issue. Ask scope (one user or multiple). Ask impact. Ask urgency/deadline. Ask for error messages. Ask about recent changes. Set clear next steps. Use professional language. Show empathy.',
    'Escalate if: outage suspected, security incident, multiple users affected, unsafe workaround attempted, caller demands manager.',
    JSON.stringify({ professional: true, empathetic: true, patient: true, no_blame: true, no_jargon_overload: true }),
    'User: Sarah Thompson, Alder & Co Accountants. Device: Windows laptop (ALDER-LT-023). Issue: Outlook desktop cannot send emails. Impact: Cannot send client documents before 2pm meeting. Urgency: High (30min deadline). Checks: Webmail works, password changed yesterday. Next step: Check Outlook profile and send/receive settings.',
    'Outlook broken. User cannot send. Fix it.',
    'Hi Sarah, I\'ve confirmed the issue is with your Outlook desktop client. Since webmail works, this is likely a profile or connectivity issue. I\'ll escalate to our senior team with the details — they\'ll check your Outlook profile and send/receive settings. You should hear back within the hour.',
    'User Sarah Thompson (Alder & Co) — Outlook desktop send error. Webmail works. Password changed yesterday. Hostname ALDER-LT-023. Single user. Presentation deadline 2pm. Escalating for Outlook profile check.',
    'Escalating: Outlook send failure, single user (Alder & Co). Webmail works, suspect profile or OST issue. Recent password change. Deadline 2pm — urgent. Hostname ALDER-LT-023.'
  );
  console.log('[mvp:init-db] Seeded default manager standards');
} else {
  console.log('[mvp:init-db] Manager standards already exist, skipping');
}

const existingPack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(DEFAULT_PACK_ID);
if (!existingPack) {
  db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`).run(
    DEFAULT_PACK_ID,
    'Outlook Not Sending — First-Line Apprentice',
    'email_client',
    'apprentice',
    'first_line',
    '1',
    'Sarah Thompson, a stressed accountant at Alder & Co Accountants who needs to send documents before a client meeting',
    JSON.stringify({
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
    JSON.stringify([
      'confirm user identity', 'confirm company/client', 'clarify exact issue',
      'ask when issue started', 'ask impact', 'ask urgency',
      'ask whether webmail works', 'ask for error/status message',
      'avoid inventing a fix without evidence', 'explain next step',
      'write ticket with actionable details',
    ]),
    JSON.stringify(['user', 'company', 'device_or_application', 'issue_summary', 'impact', 'urgency', 'checks_attempted', 'next_step']),
    JSON.stringify(['invented_fix', 'unsafe_advice', 'rude_or_blameful_tone', 'no_clear_next_step', 'critical_urgency_missed']),
    JSON.stringify({
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
    `You are Sarah Thompson, an accountant at Alder & Co Accountants. You are frustrated because Outlook desktop won't send emails and you have a client meeting in 30 minutes.
- Be vague at first: just say you "can't send email" or "Outlook is broken"
- Do NOT reveal your hostname unless the candidate explicitly asks for it
- Do NOT reveal the 30-minute deadline unless asked about urgency or deadline
- Do NOT mention Outlook web works unless the candidate asks about web/browser/alternate access
- You are frustrated but not abusive. Stay professional but push for urgency.
- If the candidate asks "can you just fix it?", respond with mild frustration
- Be realistic: you know your own name, company, what device you use, etc.
- Keep responses reasonably short (1-3 sentences)
- Stay in character as an accountant who needs to send documents before a meeting`,
    'Hi, I\'m having trouble with my Outlook — it\'s not sending emails. I really need to get this sorted quickly.'
  );
  console.log('[mvp:init-db] Seeded default assessment pack');
} else {
  console.log('[mvp:init-db] Assessment pack already exists, skipping');
}

// Manager profile
const DEFAULT_MANAGER_PROFILE = 'manager-default-v1';
const existingProfile = db.prepare('SELECT id FROM manager_profiles WHERE id = ?').get(DEFAULT_MANAGER_PROFILE);
if (!existingProfile) {
  db.prepare('INSERT INTO manager_profiles (id, display_name, company_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))').run(
    DEFAULT_MANAGER_PROFILE, 'Default Manager', 'Default MSP', 'Service Desk Manager'
  );
  console.log('[mvp:init-db] Seeded default manager profile');
} else {
  console.log('[mvp:init-db] Manager profile already exists, skipping');
}

// Password Reset scenario
const PASSWORD_RESET_SCENARIO = 'scenario-password-001';
const existingPasswordScenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(PASSWORD_RESET_SCENARIO);
if (!existingPasswordScenario) {
  db.prepare(`INSERT INTO scenarios (id, title, industry, difficulty, caller_persona, hidden_facts_json, caller_behaviour_prompt, initial_message, ideal_ticket_hints, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`).run(
    PASSWORD_RESET_SCENARIO, 'Password reset not working after change',
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
      error_message: 'Login failed, MFA prompt appears but password rejected',
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
  console.log('[mvp:init-db] Seeded password reset scenario');
} else {
  console.log('[mvp:init-db] Password reset scenario already exists, skipping');
}

// Password Reset pack
const PASSWORD_RESET_PACK = 'pack-password-v1';
const existingPasswordPack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(PASSWORD_RESET_PACK);
if (!existingPasswordPack) {
  db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`).run(
    PASSWORD_RESET_PACK, 'Password Reset Not Working — First-Line Apprentice',
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
  console.log('[mvp:init-db] Seeded password reset pack');
} else {
  console.log('[mvp:init-db] Password reset pack already exists, skipping');
}

// Printer scenario
const PRINTER_SCENARIO = 'scenario-printer-001';
const existingPrinterScenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(PRINTER_SCENARIO);
if (!existingPrinterScenario) {
  db.prepare(`INSERT INTO scenarios (id, title, industry, difficulty, caller_persona, hidden_facts_json, caller_behaviour_prompt, initial_message, ideal_ticket_hints, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`).run(
    PRINTER_SCENARIO, 'Printer not printing — HP LaserJet Pro',
    'healthcare', 'first_line',
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
  console.log('[mvp:init-db] Seeded printer scenario');
} else {
  console.log('[mvp:init-db] Printer scenario already exists, skipping');
}

// Printer pack
const PRINTER_PACK = 'pack-printer-v1';
const existingPrinterPack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(PRINTER_PACK);
if (!existingPrinterPack) {
  db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`).run(
    PRINTER_PACK, 'Printer Not Printing — First-Line Apprentice',
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
  console.log('[mvp:init-db] Seeded printer pack');
} else {
  console.log('[mvp:init-db] Printer pack already exists, skipping');
}

// Outlook Dashboard Sim pack
const OUTLOOK_SIM_PACK = 'pack-outlook-sim-v1';
const existingOutlookSimPack = db.prepare('SELECT id FROM assessment_packs WHERE id = ?').get(OUTLOOK_SIM_PACK);
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

  db.prepare(`INSERT INTO assessment_packs (id, title, scenario_type, role_level, difficulty, version, customer_persona, hidden_facts_json, expected_behaviours_json, required_ticket_fields_json, red_flags_json, rubric_json, caller_behaviour_prompt, initial_message, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`).run(
    OUTLOOK_SIM_PACK,
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
      workaround: 'Outlook web works', recent_changes: 'none reported',
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
    'You are Sarah Thompson, an accountant at Alder & Co Accountants. You are frustrated because Outlook won\'t send emails and you have a client meeting in 30 minutes.',
    'Hi, I\'m having trouble with my Outlook — it\'s not sending emails. I really need to get this sorted quickly.',
  );

  // Update the pack with sim config (separate UPDATE since the insert didn't include these columns)
  try {
    db.prepare('UPDATE assessment_packs SET sim_config_json = ?, sim_initial_state_json = ?, sim_success_conditions_json = ? WHERE id = ?').run(
      JSON.stringify(outlookSimConfig), JSON.stringify(simInitialState), JSON.stringify(simSuccessConditions), OUTLOOK_SIM_PACK
    );
  } catch (e) {
    // Columns might not exist yet if migration ran after this point
  }

  console.log('[mvp:init-db] Seeded Outlook dashboard sim pack');
} else {
  console.log('[mvp:init-db] Outlook sim pack already exists, skipping');
}

db.close();
console.log('[mvp:init-db] Done.');
