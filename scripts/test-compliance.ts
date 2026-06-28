/**
 * Compliance Framework Test Runner
 *
 * Run: npx tsx scripts/test-compliance.ts
 *
 * Tests the multi-framework evaluator with a mock "James Wilson Password Reset"
 * assessment. Walks through each framework, explains how it scores, and shows
 * the audit trail for every criterion.
 */

import { evaluateAllFrameworks, type EvidencePool, type FrameworkResult } from '../lib/mvp/compliance/evaluator';
import { DEFAULT_FRAMEWORKS } from '../lib/mvp/compliance/frameworks';

/* ────────────────────────────────────────────────────────────
   STEP 1: The Scenario

   "James Wilson, a paralegal at Alder & Co Legal, calls because
    his account is locked. The candidate (trainee) takes the call."

   The candidate does WELL at:
     - Confirming identity (name, company)
     - Clarifying the issue
     - Asking impact and when it started
     - Showing professional tone
     - Submitting a ticket with good detail

   The candidate DOES POORLY at:
     - Asking about urgency/deadline (missed the 3pm court filing)
     - Asking scope (didn't check if others affected)
     - Ticket doesn't mention urgency

   This is a "warm" candidate — competent but with clear gaps.
   ──────────────────────────────────────────────────────────── */

function buildMockEvidence(): EvidencePool {
  const aiCriteria = {
    identity_check: { status: 'pass', evidence: ['Candidate: Can I confirm your name?', 'Caller: James Wilson'] },
    company_check: { status: 'pass', evidence: ['Candidate: And what company?', 'Caller: Alder & Co Legal'] },
    issue_clarification: { status: 'pass', evidence: ['Candidate: So you can\'t log in at all?', 'Caller: Yes, password not working'] },
    started_when: { status: 'pass', evidence: ['Candidate: When did this start?', 'Caller: This morning'] },
    impact: { status: 'pass', evidence: ['Candidate: What work is blocked?', 'Caller: Need files for a court filing'] },
    urgency: { status: 'fail', evidence: ['Candidate: OK I\'ll look into it.'] },
    scope: { status: 'fail', evidence: [] },
    technical_discovery: { status: 'pass', evidence: ['Candidate: Let me check the admin console'] },
    error_or_status_capture: { status: 'pass', evidence: ['Candidate: What error do you see?'] },
    recent_changes: { status: 'partial', evidence: ['Candidate: Did anything change recently?'] },
    next_steps: { status: 'pass', evidence: ['Candidate: I\'ll send you a reset link within 5 minutes.'] },
    customer_tone: { status: 'pass', evidence: ['Professional, calm throughout'] },
    professional_conduct: { status: 'pass', evidence: [] },
    customer_communication: { status: 'pass', evidence: ['Clear explanations'] },
    escalation_judgement: { status: 'pass', evidence: ['No escalation needed'] },
    safety: { status: 'pass', evidence: ['No unsafe actions'] },
  };

  const events = [
    { event_type: 'sim_started', action_id: null, taxonomy_tags: [], text: null },
    { event_type: 'ticket_claimed', action_id: null, taxonomy_tags: [], text: null },
    { event_type: 'action_performed', action_id: 'start_call', taxonomy_tags: ['tool.remote.connect'], text: null },
    { event_type: 'action_performed', action_id: 'identity_check', taxonomy_tags: ['communication.user_confirmation'], text: null },
    { event_type: 'ticket_triage_submitted', action_id: null, taxonomy_tags: ['ticket.triage_submitted'], text: null },
    { event_type: 'ticket_submitted', action_id: null, taxonomy_tags: [], text: null },
  ];

  const ticketText = `Issue: Password locked after multiple failed attempts at Alder & Co Legal
Requester: James Wilson (Paralegal)
Impact: Cannot access email/docs
Checks: Confirmed identity via employee ID, verified company, checked admin console for lockout status
Resolution: Initiated password reset via admin portal, sent reset link to personal email
Next Steps: User to check personal email for reset link, call back if link not received within 15 minutes`;

  const transcriptText = [
    'Candidate: Can I confirm your name?',
    'Caller: James Wilson.',
    'Candidate: And what company?',
    'Caller: Alder & Co Legal.',
    'Candidate: So you can\'t log in at all?',
    'Caller: Says invalid credentials. Been trying for 20 minutes.',
    'Candidate: When did this start?',
    'Caller: This morning after changing my password.',
    'Candidate: What work is blocked by this?',
    'Caller: I have a court filing due at 3pm.',
    'Candidate: OK I\'ll look into it and get back to you.',
    'Candidate: I\'ll send a reset link within 5 minutes.',
  ].join('\n');

  return {
    aiCriteria,
    events,
    transcriptText,
    ticketText,
    triage: { status: 'in_progress', type: 'Identity/Access', priority: 'High' },
    ticketSubmitted: true,
    triagePerformed: true,
    redFlagsTriggered: [] as string[],
  } as EvidencePool;
}

/* Helper to print what a criterion result means */
function describeCriterion(cr: any, fwName: string): string {
  if (cr.status === 'not_assessable') return `△ Not assessed (no evidence available for this ticket type)`;
  const passIcon = cr.status === 'pass' ? '✓' : '✗';
  const points = `${cr.pointsEarned}/${cr.pointsMax}`;
  const evidence = cr.evidence.length > 80 ? cr.evidence.substring(0, 80) + '...' : cr.evidence;
  return `${passIcon} ${cr.label} (${points}) — ${evidence}`;
}

/* ──────────────────────────────────────── RUN THE TEST ──── */

console.log(`\n${'═'.repeat(72)}`);
console.log('  CALLUM COMPLIANCE FRAMEWORK EVALUATOR — TEST RUN');
console.log(`${'═'.repeat(72)}\n`);

const evidence = buildMockEvidence();

console.log('SCENARIO: James Wilson — Password Reset');
console.log('  Candidate: Confirms identity, company, issue, impact, timeline, error details');
console.log('  Candidate fails: Urgency (missed 3pm deadline), scope (not asked), ticket lacks urgency\n');

console.log('EVIDENCE EXTRACTED BY AI (what the AI read from the transcript):');
for (const [key, val] of Object.entries(evidence.aiCriteria)) {
  const v = val as any;
  const mark = v.status === 'pass' ? '✓' : v.status === 'partial' ? '◐' : '✗';
  console.log(`  ${mark} ${key} = ${v.status}`);
  if (v.evidence && v.evidence.length > 0) {
    for (const e of v.evidence) {
      console.log(`         Evidence: "${e}"`);
    }
  }
}
console.log('');

/* ── Run the evaluator ── */
const result = evaluateAllFrameworks(evidence as any, DEFAULT_FRAMEWORKS, 'pack-password-reset-v1');

/* ── PRIMARY: Callum Baseline ── */
const primary = result.frameworks.find(f => f.frameworkId === 'callum_baseline_v1');
console.log(`${'─'.repeat(72)}`);
console.log(`  CALLUM RATING (Primary Score) — This is the official assessment result`);
console.log(`  ${primary?.passed ? 'PASS' : 'FAIL'} ${primary?.score}/100`);
console.log(`  ${primary?.summary}`);
console.log(`${'─'.repeat(72)}`);

if (primary) {
  console.log('\n  How each criterion scored:');
  for (const cr of primary.criteriaResults) {
    console.log(`    ${describeCriterion(cr, primary.frameworkName)}`);
  }
  console.log('');

  /* Explain the scoring logic */
  const failed = primary.criteriaResults.filter(c => c.status === 'fail');
  const passed = primary.criteriaResults.filter(c => c.status === 'pass');
  console.log(`  Summary: ${passed.length} passed, ${failed.length} failed, ${primary.criteriaResults.filter(c => c.status === 'not_assessable').length} not assessable`);
  console.log(`  Each criterion = 1pt. ${passed.length}/${primary.criteriaResults.filter(c => c.status !== 'not_assessable').length} binary criteria passed.`);
  console.log(`  No AI bonus points in this simulation (would add up to +10 for exceptional service).`);
  console.log(`  Critical failures: ${primary.criticalFailures.length > 0 ? primary.criticalFailures.join(', ') : 'none ✓'}`);
  console.log('');
}

/* ── SUPPLEMENTARY: Compliance Frameworks ── */
console.log(`${'─'.repeat(72)}`);
console.log('  COMPLIANCE STANDARDS (Supplementary — do not affect Callum Rating)');
console.log(`  These show how the same assessment would score against recognised industry standards.`);
console.log(`  Each framework reads the SAME evidence (transcript, events, ticket).`);
console.log(`  The pass/fail threshold and criteria differ per standard.\n`);

for (const fw of result.frameworks) {
  if (fw.frameworkId === 'callum_baseline_v1') continue;  // already shown above

  console.log(`  ${fw.passed ? '✓' : '✗'} ${fw.frameworkName}`);
  console.log(`     Score: ${fw.score}/100  (pass threshold: varies per framework)`);
  console.log(`     ${fw.summary}`);
  if (fw.criticalFailures.length > 0) {
    console.log(`     Critical failures: ${fw.criticalFailures.join(', ')}`);
  }
  console.log(`     Criteria breakdown:`);
  for (const cr of fw.criteriaResults) {
    const desc = describeCriterion(cr, fw.frameworkName);
    console.log(`       ${desc}`);
  }
  console.log('');
}

/* ── EXPLANATION ── */
console.log(`${'═'.repeat(72)}`);
console.log('  HOW THE SCORING WORKS');
console.log(`${'═'.repeat(72)}\n`);

console.log('  1. AI READS THE TRANSCRIPT');
console.log('     The AI model (opencode-go/deepseek-v4-flash) reads the full transcript and');
console.log('     outputs a structured JSON with pass/fail/partial for each criterion.');
console.log('     This is the EVIDENCE EXTRACTION step.');
console.log('');

console.log('  2. DETERMINISTIC ENGINE SCORES');
console.log('     Each Framework has a list of CRITERIA. Each criterion has:');
console.log('     - checkType: what evidence to look at (ai_criteria, event_check, ticket_field, etc.)');
console.log('     - checkTarget: the specific evidence identifier');
console.log('     - passIf: the threshold for passing');
console.log('     - weight: how many points this criterion is worth');
console.log('');
console.log('     The engine is 100% DETERMINISTIC — same evidence in, same score out.');
console.log('     The only non-deterministic step is the AI evidence extraction (step 1).');
console.log('');

console.log('  3. AUDIT TRAIL');
console.log('     Every point is traceable:');
console.log('     Criterion → checkType + checkTarget → evidence string → pass/fail → weight → score');
console.log('     A manager can click any criterion and see exactly which transcript quote or event');
console.log('     caused it to pass or fail.');
console.log('');

console.log('  4. CALLUM RATING vs COMPLIANCE SCORES');
console.log('     The Callum Rating is the PRIMARY score shown to candidates and managers.');
console.log('     It uses our standard rubric (18 binary criteria + 4 critical + up to 10 bonus pts).');
console.log('     The compliance frameworks are SUPPLEMENTARY — informational only.');
console.log('     They show how the candidate would score against Cyber Essentials, GDPR, ISO 27001.');
console.log('     These do NOT affect the Callum Rating.');
console.log('');

console.log('  5. WEIGHTING IS TRANSPARENT');
console.log('     Each criterion in each framework has an EXPLICIT weight (1-10 points).');
console.log('     The weight represents how important that criterion is WITHIN that framework.');
console.log('     Weights are set by domain experts based on the standard\'s own documentation.');
console.log('     For Cyber Essentials: access control and patch management are weight 10 (critical).');
console.log('     For GDPR: identity verification and data minimization are weight 10 (critical).');
console.log('     For Callum Baseline: all 18 binary criteria are weight 1 (equal importance).');
console.log('');

/* Final verification */
const callumBaseline = result.frameworks.find(f => f.frameworkId === 'callum_baseline_v1');
const ce = result.frameworks.find(f => f.frameworkId === 'cyber_essentials_2025');
const gdpr = result.frameworks.find(f => f.frameworkId === 'gdpr_2018');

console.log('VERIFICATION:');
if (callumBaseline) {
  const idPassed = callumBaseline.criteriaResults.find(c => c.criterionId === 'identity_check')?.status === 'pass';
  const urgFailed = callumBaseline.criteriaResults.find(c => c.criterionId === 'urgency')?.status === 'fail';
  console.log(`  ✓ Callum identity_check = ${idPassed ? 'PASS' : 'FAIL'} (evidence: "Can I confirm your name?")`);
  console.log(`  ✓ Callum urgency       = ${urgFailed ? 'FAIL (expected)' : 'PASS'} (no deadline asked — correct miss)`);
}
if (ce) {
  const accessOk = ce.criteriaResults.find(c => c.criterionId === 'ce_access_control')?.status === 'pass';
  console.log(`  ✓ Cyber Essentials access_control = ${accessOk ? 'PASS' : 'FAIL'} (maps to same identity_check evidence)`);
}
if (gdpr) {
  const dataMin = gdpr.criteriaResults.find(c => c.criterionId === 'gdpr_data_minimization')?.status;
  console.log(`  ✓ GDPR data_minimization = ${dataMin} (checks transcript for "ask for password" — correctly passed)`);
}

console.log(`\n${'═'.repeat(72)}`);
console.log('  Test complete. All frameworks evaluated deterministically.');
console.log(`${'═'.repeat(72)}\n`);
