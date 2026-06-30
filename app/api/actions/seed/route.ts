import { NextResponse } from 'next/server';
import { verifyCallumActionAuth, unauthorizedActionResponse } from '@/lib/actions-auth';
import { getDb, initTables } from '@/lib/mvp/db';
import crypto from 'crypto';

/**
 * Seed test data for Callum Actions testing.
 * POST /api/actions/seed
 * Creates: Electracom client + contractor protocol
 */
export async function POST(request: Request) {
  if (!verifyCallumActionAuth(request)) return unauthorizedActionResponse();
  initTables();

  const db = getDb();

  /* Create Electracom client */
  const orgId = 'action-org';
  let clientId: string;

  const existing = db.prepare("SELECT id FROM clients WHERE name LIKE '%Electracom%' LIMIT 1").get() as any;
  if (existing) {
    clientId = existing.id;
  } else {
    clientId = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO clients (id, organization_id, name, short_name, notes) VALUES (?, ?, ?, ?, ?)')
      .run(clientId, orgId, 'Electracom', 'electracom', 'MSP client — contractor onboarding protocol');
  }

  /* Add contractor protocol */
  const existingProtocol = db.prepare(
    "SELECT id FROM client_protocols WHERE client_id = ? AND title LIKE '%Contractor%' LIMIT 1"
  ).get(clientId) as any;

  if (!existingProtocol) {
    const protocolId = crypto.randomBytes(16).toString('hex');
    db.prepare(`
      INSERT INTO client_protocols (id, client_id, title, protocol_type, trigger_keywords_json, rule_text, t1_guidance, escalation_guidance, approved_by, last_reviewed_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
    `).run(
      protocolId,
      clientId,
      'Contractor New Starter Process',
      'new_starter',
      JSON.stringify(['contractor', 'new starter', 'starter', 'onboarding', 'access setup', 'electracom']),
      'Contractor new starters should stay with T1 initially unless manager approval is missing. T1 handles basic access setup, password reset, and MFA enrolment. Escalate to T2 only if manager approval is explicitly required or if the contractor needs elevated permissions.',
      'Verify identity, confirm with POC, set up basic access (password/MFA), confirm login. Do not escalate unless manager approval is missing or elevated permissions are requested.',
      'Escalate to T2 if: manager approval is missing, elevated permissions requested, or contractor needs access to restricted systems.',
      'seed-script',
    );
  }

  return NextResponse.json({
    message: 'Seed data loaded',
    client_id: clientId,
    protocols: [
      { title: 'Contractor New Starter Process', type: 'new_starter', trigger_keywords: ['contractor', 'new starter', 'starter', 'onboarding', 'access setup', 'electracom'] },
    ],
  });
}
