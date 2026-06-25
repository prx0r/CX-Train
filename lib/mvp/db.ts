import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (result_id) REFERENCES assessment_results(id)
    );
  `);
}

const DEFAULT_CRITERIA_ID = 'criteria-msp-v1';
const DEFAULT_SCENARIO_ID = 'scenario-outlook-001';
const DEFAULT_STANDARDS_ID = 'standards-default-v1';
const DEFAULT_PACK_ID = 'pack-outlook-v1';

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
}

export { DEFAULT_CRITERIA_ID, DEFAULT_SCENARIO_ID, DEFAULT_STANDARDS_ID, DEFAULT_PACK_ID };
