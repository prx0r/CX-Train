import { getDb } from '@/lib/mvp/db';
import { getAllAssessments, getAnalysisRunsByAssessment as getRuns, getFeedback } from '@/lib/mvp/query';
import type { AssessmentRow, AssessmentResultRow, ManagerFeedbackRow } from '@/lib/mvp/query';

export interface TableCounts {
  assessments: number;
  sessions: number;
  messages: number;
  tickets: number;
  assessment_results: number;
  manager_feedback: number;
  manager_standards: number;
  assessment_packs: number;
  analysis_runs: number;
  scenarios: number;
}

export interface DatabaseStatus {
  path: string;
  tables: string[];
  counts: TableCounts;
}

export interface SeedStatus {
  managerStandards: boolean;
  assessmentPacks: boolean;
  criteria: boolean;
  scenario: boolean;
}

export interface IntegrityWarning {
  type: string;
  message: string;
  assessmentId?: string;
}

export interface LatestItem {
  id: string;
  title?: string;
  candidate_name?: string;
  status: string;
  created_at: string;
}

export function getDatabasePath(): string {
  return process.env.MVP_SQLITE_PATH || './data/callcallum.db';
}

export function getDatabaseStatus(): DatabaseStatus {
  const db = getDb();
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all() as { name: string }[];

  return {
    path: getDatabasePath(),
    tables: tables.map(t => t.name),
    counts: getTableCounts(),
  };
}

export function getTableCounts(): TableCounts {
  const db = getDb();
  return {
    assessments: (db.prepare('SELECT COUNT(*) as c FROM assessments').get() as any).c,
    sessions: (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any).c,
    messages: (db.prepare('SELECT COUNT(*) as c FROM messages').get() as any).c,
    tickets: (db.prepare('SELECT COUNT(*) as c FROM tickets').get() as any).c,
    assessment_results: (db.prepare('SELECT COUNT(*) as c FROM assessment_results').get() as any).c,
    manager_feedback: (db.prepare('SELECT COUNT(*) as c FROM manager_feedback').get() as any).c,
    manager_standards: (db.prepare('SELECT COUNT(*) as c FROM manager_standards').get() as any).c,
    assessment_packs: (db.prepare('SELECT COUNT(*) as c FROM assessment_packs').get() as any).c,
    analysis_runs: (db.prepare('SELECT COUNT(*) as c FROM analysis_runs').get() as any).c,
    scenarios: (db.prepare('SELECT COUNT(*) as c FROM scenarios').get() as any).c,
  };
}

export function getSeedStatus(): SeedStatus {
  const db = getDb();
  const standards = db.prepare('SELECT COUNT(*) as c FROM manager_standards').get() as any;
  const packs = db.prepare('SELECT COUNT(*) as c FROM assessment_packs').get() as any;
  const criteria = db.prepare('SELECT COUNT(*) as c FROM assessment_criteria_versions').get() as any;
  const scenario = db.prepare('SELECT COUNT(*) as c FROM scenarios').get() as any;
  return {
    managerStandards: standards.c > 0,
    assessmentPacks: packs.c > 0,
    criteria: criteria.c > 0,
    scenario: scenario.c > 0,
  };
}

export function getLatestAssessments(limit = 5): LatestItem[] {
  const db = getDb();
  return db.prepare(
    'SELECT id, title, candidate_name, status, created_at FROM assessments ORDER BY created_at DESC LIMIT ?'
  ).all(limit) as LatestItem[];
}

export function getLatestAnalysisRuns(limit = 5): any[] {
  const db = getDb();
  return db.prepare(
    'SELECT id, assessment_id, analysis_type, status, result_id, error_code, error_message, substr(input_hash,1,16) as hash_prefix, created_at FROM analysis_runs ORDER BY created_at DESC LIMIT ?'
  ).all(limit);
}

export function getLatestFeedback(limit = 5): any[] {
  const db = getDb();
  return db.prepare(
    'SELECT id, assessment_id, manager_label, manager_score, created_at FROM manager_feedback ORDER BY created_at DESC LIMIT ?'
  ).all(limit);
}

export function getIntegrityWarnings(): IntegrityWarning[] {
  const db = getDb();
  const warnings: IntegrityWarning[] = [];

  const orphanMessages = db.prepare(
    'SELECT COUNT(*) as c FROM messages m LEFT JOIN sessions s ON m.session_id = s.id WHERE s.id IS NULL'
  ).get() as any;
  if (orphanMessages.c > 0) {
    warnings.push({ type: 'orphan_messages', message: `${orphanMessages.c} messages with no parent session` });
  }

  const orphanTickets = db.prepare(
    'SELECT COUNT(*) as c FROM tickets t LEFT JOIN sessions s ON t.session_id = s.id WHERE s.id IS NULL'
  ).get() as any;
  if (orphanTickets.c > 0) {
    warnings.push({ type: 'orphan_tickets', message: `${orphanTickets.c} tickets with no parent session` });
  }

  const orphanFeedback = db.prepare(
    'SELECT COUNT(*) as c FROM manager_feedback f LEFT JOIN assessments a ON f.assessment_id = a.id WHERE a.id IS NULL'
  ).get() as any;
  if (orphanFeedback.c > 0) {
    warnings.push({ type: 'orphan_feedback', message: `${orphanFeedback.c} feedback records with no parent assessment` });
  }

  const failedRuns = db.prepare(
    "SELECT COUNT(*) as c FROM analysis_runs WHERE status = 'failed'"
  ).get() as any;
  if (failedRuns.c > 0) {
    warnings.push({ type: 'failed_analysis_runs', message: `${failedRuns.c} analysis runs failed` });
  }

  return warnings;
}
