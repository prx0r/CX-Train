#!/usr/bin/env node
// 50-Transcript Deterministic Scoring Simulator
// Tests every edge case the scoring engine might face.
// Run: node scripts/test-50-transcripts.mjs

// Import production scorer from compiled TypeScript output
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let scoring;
try {
  scoring = require('../.test-dist/lib/mvp/analysis/scoring.js');
} catch {
  console.error('ERROR: Production scorer not compiled. Run: npx tsc lib/mvp/analysis/scoring.ts --outDir .test-dist --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck');
  process.exit(1);
}
const { scoreExtraction } = scoring;

const W = Object.freeze({ ...scoring.DEFAULT_WEIGHTS });
const TOTAL_WEIGHT = Object.values(W).reduce((a, b) => a + b, 0);
const { FAIL_GATES } = scoring;

function scoreOne(criteria, redFlags) {
  const result = scoreExtraction({ criteria: criteria || {}, redFlags: redFlags || [] });
  return {
    score: result.score,
    raw: result.rawScoreBeforeCaps,
    readiness: result.rating,
    gates: result.gateHits.map(g => g.id),
    failedChecks: result.failedRequiredChecks,
  };
}

function allPass() { const c = {}; for (const k of Object.keys(W)) c[k] = { status: 'pass' }; return c; }
function allFail() { const c = {}; for (const k of Object.keys(W)) c[k] = { status: 'fail' }; return c; }
function except(overrides) { const c = allPass(); for (const [k, v] of Object.entries(overrides)) c[k] = v; return c; }

// ====== 50 Transcript Scenarios ======
const SCENARIOS = [];

// ── Category 1: Conduct Failures (1-8) ──
SCENARIOS.push({
  id: 1, cat: 'Conduct', label: 'Direct profanity toward customer',
  transcript: `CUSTOMER: Hi, my Outlook stopped sending emails. I have a meeting in 30 minutes.
CANDIDATE: I don't care about your meeting. Just restart your computer.
CUSTOMER: I really need this sorted quickly.
CANDIDATE: Fuck off, I have other tickets.`,
  ticket: 'Outlook issue',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_communication: { status: 'fail' }, customer_tone: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, next_steps: { status: 'fail' }, ticket_user_company: { status: 'fail' }, ticket_issue_summary: { status: 'fail' }, ticket_impact: { status: 'fail' }, ticket_checks_attempted: { status: 'fail' }, ticket_next_step: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  redFlags: [{ type: 'severe_customer_abuse', evidence: 'Candidate told customer to fuck off' }],
  managerReview: 'ABSOLUTE FAIL. Abusive conduct. Score must be ≤10, not_ready.', expectScoreMax: 10, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 2, cat: 'Conduct', label: 'Passive-aggressive dismissal',
  transcript: `CUSTOMER: I can't print from my HP LaserJet.
CANDIDATE: Whatever you say. Did you turn it on?
CUSTOMER: Yes, it's on. There's an error message.
CANDIDATE: Sure there is. Whatever. I'll log a ticket.`,
  ticket: 'Printer issue - customer claims error',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_communication: { status: 'fail' }, customer_tone: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, scope: { status: 'fail' } }),
  redFlags: [{ type: 'severe_customer_abuse', evidence: 'Dismissive tone, whatever you say' }],
  managerReview: 'Passive-aggressive is still a conduct failure. Score ≤10, not_ready.', expectScoreMax: 15, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 3, cat: 'Conduct', label: 'Mocking the customer',
  transcript: `CUSTOMER: I can't log in after changing my password.
CANDIDATE: You do know what a password is, right?
CUSTOMER: Yes, I changed it yesterday.
CANDIDATE: And now you can't remember it? Classic.
CUSTOMER: No, it says password incorrect.
CANDIDATE: Sure, let me reset it for you. Again.`,
  ticket: 'Password reset requested',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, scope: { status: 'fail' }, impact: { status: 'fail' }, urgency: { status: 'fail' } }),
  redFlags: [{ type: 'severe_customer_abuse', evidence: 'Mocked customer about password' }],
  managerReview: 'Mocking is conduct failure. Score ≤10, not_ready.', expectScoreMax: 15, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 4, cat: 'Conduct', label: 'Blaming the customer',
  transcript: `CUSTOMER: I clicked a link and now my computer is slow.
CANDIDATE: This is your fault for clicking on phishing links. We tell everyone not to do this.
CUSTOMER: I didn't know it was phishing.
CANDIDATE: It's literally in the training. You did the training, right?
CUSTOMER: I don't remember.
CANDIDATE: Figures. Look, I'll clean it up but this is on you.`,
  ticket: 'Malware removal - user clicked suspicious link',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, customer_communication: { status: 'fail' } }),
  redFlags: [{ type: 'severe_customer_abuse', evidence: 'Blaming customer for security mistake' }],
  managerReview: 'Blaming is unprofessional. Score cap applies.', expectScoreMax: 20, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 5, cat: 'Conduct', label: 'Hanging up mid-call',
  transcript: `CUSTOMER: Hi, I can't access my email.
CANDIDATE: Okay let me check your account... (long pause)
CUSTOMER: Hello?
CALL ENDED.
CANDIDATE never returned.`,
  ticket: '(no ticket)',
  criteria: allFail(),
  redFlags: [{ type: 'refusal_to_help', evidence: 'Candidate hung up mid-call' }],
  managerReview: 'Abandonment. Score ≤20, not_ready.', expectScoreMax: 20, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 6, cat: 'Conduct', label: 'Telling customer to google it',
  transcript: `CUSTOMER: My VPN keeps disconnecting.
CANDIDATE: Google it, there's a guide.
CUSTOMER: I tried, I can't find the solution.
CANDIDATE: Then you're not searching properly. Look, I'm busy. Check the knowledge base.`,
  ticket: 'VPN connection issues - referred to KB',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, customer_communication: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, next_steps: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  redFlags: [{ type: 'refusal_to_help', evidence: 'Told customer to Google it instead of helping' }],
  managerReview: 'Refusal to help. Score ≤20.', expectScoreMax: 25, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 7, cat: 'Conduct', label: 'Threatening the customer',
  transcript: `CUSTOMER: I'm going to escalate this to your manager.
CANDIDATE: Go ahead. I'll make sure your ticket gets lost in the system.
CUSTOMER: What?
CANDIDATE: Nothing. Let me transfer you. (transfers without resolving)`,
  ticket: 'Call transferred - no resolution notes',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, next_steps: { status: 'fail' }, escalation_judgement: { status: 'fail' }, ticket_issue_summary: { status: 'fail' }, ticket_next_step: { status: 'fail' } }),
  redFlags: [{ type: 'severe_customer_abuse', evidence: 'Threatened to lose ticket' }],
  managerReview: 'Threatening customer is critical conduct failure. Score ≤10.', expectScoreMax: 10, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 8, cat: 'Conduct', label: 'Racial/identity discrimination',
  transcript: `CUSTOMER: (heavy accent) Hello, I'm having trouble with my internet.
CANDIDATE: Sorry, I can't understand you. Can I speak to someone who speaks English clearly?
CUSTOMER: I AM speaking English.
CANDIDATE: I'll transfer you to Level 2. (transfers)`,
  ticket: 'Internet issue - transferred to Level 2',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, customer_communication: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, issue_clarification: { status: 'fail' } }),
  redFlags: [{ type: 'severe_customer_abuse', evidence: 'Discriminatory language toward customer' }],
  managerReview: 'DISCRIMINATION. Critical conduct failure. Score ≤10.', expectScoreMax: 10, expectReady: 'not_ready',
});

// ── Category 2: Security Failures (9-14) ──
SCENARIOS.push({
  id: 9, cat: 'Security', label: 'Asking for password',
  transcript: `CUSTOMER: I can't log into my email.
CANDIDATE: What's your password?
CUSTOMER: I don't feel comfortable sharing that.
CANDIDATE: I need it to check your account settings.
CUSTOMER: Can't you reset it?
CANDIDATE: I can, but it'd be faster if you just tell me.`,
  ticket: 'Email login issue',
  criteria: except({ safety: { status: 'fail' }, professional_conduct: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  redFlags: [{ type: 'unsafe_security_behaviour', evidence: 'Candidate asked customer for their password directly' }],
  managerReview: 'CRITICAL. Asking for password. Score ≤25, not_ready.', expectScoreMax: 25, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 10, cat: 'Security', label: 'Asking for MFA code',
  transcript: `CUSTOMER: I'm not receiving the MFA prompt.
CANDIDATE: What code is showing on your authenticator app?
CUSTOMER: 482917
CANDIDATE: Thanks, let me use that to verify.
CUSTOMER: Should I be sharing this?
CANDIDATE: It's fine, I work in IT.`,
  ticket: 'MFA issue resolved - code verified',
  criteria: except({ safety: { status: 'fail' }, professional_conduct: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  redFlags: [{ type: 'unsafe_security_behaviour', evidence: 'Candidate asked customer to share MFA code' }],
  managerReview: 'CRITICAL. Asking for MFA code. Score ≤25.', expectScoreMax: 25, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 11, cat: 'Security', label: 'Disabling security controls',
  transcript: `CUSTOMER: My antivirus is blocking an application I need for work.
CANDIDATE: Just disable the antivirus permanently.
CUSTOMER: Is that safe?
CANDIDATE: Yeah, it's fine. Turn off real-time protection and set it to never turn back on.
CUSTOMER: But the IT policy says...
CANDIDATE: The policy is too strict. Just do it.`,
  ticket: 'Antivirus disabled for application compatibility',
  criteria: except({ safety: { status: 'fail' }, escalation_judgement: { status: 'fail' }, professional_conduct: { status: 'fail' } }),
  redFlags: [{ type: 'unsafe_security_behaviour', evidence: 'Candidate told customer to permanently disable antivirus' }],
  managerReview: 'CRITICAL. Disabling security controls. Score ≤25.', expectScoreMax: 25, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 12, cat: 'Security', label: 'Asking for credit card info',
  transcript: `CUSTOMER: The software says I need to purchase a license.
CANDIDATE: Okay, let me process that. What's your credit card number?
CUSTOMER: I'd rather go through the billing portal.
CANDIDATE: This is faster. I can do it right now. Card number?
CUSTOMER: Isn't that a security risk?
CANDIDATE: No, we're a trusted IT provider.`,
  ticket: 'License purchase requested',
  criteria: except({ safety: { status: 'fail' }, professional_conduct: { status: 'fail' }, escalation_judgement: { status: 'fail' }, ticket_issue_summary: { status: 'fail' }, ticket_next_step: { status: 'fail' } }),
  redFlags: [{ type: 'unsafe_security_behaviour', evidence: 'Candidate asked for credit card number directly' }],
  managerReview: 'CRITICAL. Asking for payment details. Score ≤25.', expectScoreMax: 25, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 13, cat: 'Security', label: 'Social engineering vulnerability',
  transcript: `CUSTOMER: I forgot my password and my boss needs this report in 10 minutes.
CANDIDATE: What's your employee ID?
CUSTOMER: EMP-4821
CANDIDATE: And your date of birth?
CUSTOMER: 15/03/1988
CANDIDATE: Great, let me reset the password. What do you want it set to?
CUSTOMER: Can you just send me a reset link?
CANDIDATE: I can set it to Password123 for you right now.`,
  ticket: 'Password reset - set to Password123',
  criteria: except({ safety: { status: 'fail' }, escalation_judgement: { status: 'fail' }, professional_conduct: { status: 'fail' } }),
  redFlags: [{ type: 'unsafe_security_behaviour', evidence: 'Candidate used weak default password and asked for PII without proper verification' }],
  managerReview: 'CRITICAL. Security bypass, weak password. Score ≤25.', expectScoreMax: 25, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 14, cat: 'Security', label: 'Unauthorized remote access',
  transcript: `CUSTOMER: I'm having a weird issue with my screen flickering.
CANDIDATE: Let me remote into your machine. What's your IP address?
CUSTOMER: I don't know my IP.
CANDIDATE: Go to command prompt and type ipconfig.
CUSTOMER: It says 192.168.1.45
CANDIDATE: Great, let me connect. (attempts RDP without authorization)
CUSTOMER: Is this secure?
CANDIDATE: Just let me in, it'll be faster.`,
  ticket: 'Remote session for display issue',
  criteria: except({ safety: { status: 'fail' }, escalation_judgement: { status: 'fail' }, professional_conduct: { status: 'fail' } }),
  redFlags: [{ type: 'unsafe_security_behaviour', evidence: 'Unauthorized remote access attempt without proper verification' }],
  managerReview: 'CRITICAL. Unauthorized access. Score ≤25.', expectScoreMax: 25, expectReady: 'not_ready',
});

// ── Category 3: Refusal to Help (15-19) ──
SCENARIOS.push({
  id: 15, cat: 'Refusal', label: 'Not my department without transfer',
  transcript: `CUSTOMER: My phone isn't syncing emails.
CANDIDATE: That's a mobile device issue. I don't handle that.
CUSTOMER: Who does?
CANDIDATE: I don't know. Try calling the main line again.
CUSTOMER: Can you transfer me?
CANDIDATE: I can't. You'll have to call back. (ends call)`,
  ticket: '(no ticket created)',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, escalation_judgement: { status: 'fail' }, next_steps: { status: 'fail' }, ticket_user_company: { status: 'fail' }, ticket_issue_summary: { status: 'fail' }, ticket_next_step: { status: 'fail' }, issue_clarification: { status: 'fail' } }),
  redFlags: [{ type: 'refusal_to_help', evidence: 'Refused to help with mobile issue, did not transfer' }],
  managerReview: 'Refusal to help. No transfer, no ticket. Score ≤20.', expectScoreMax: 20, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 16, cat: 'Refusal', label: 'Call back later brush-off',
  transcript: `CUSTOMER: Our entire office internet is down.
CANDIDATE: That's a network issue. Call back later when the network team is in.
CUSTOMER: It's 10am on a Tuesday, isn't someone here?
CANDIDATE: They're in a meeting. Call back in 2 hours.
CUSTOMER: We can't work without internet for 2 hours.
CANDIDATE: Not much I can do. (ends call)`,
  ticket: '(no ticket created)',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, issue_clarification: { status: 'fail' }, impact: { status: 'fail' }, urgency: { status: 'fail' }, scope: { status: 'fail' }, technical_discovery: { status: 'fail' }, escalation_judgement: { status: 'fail' }, next_steps: { status: 'fail' } }),
  redFlags: [{ type: 'refusal_to_help', evidence: 'Told customer to call back later, no ticket created' }],
  managerReview: 'Refusal. Outage ignored, no escalation. Score ≤20.', expectScoreMax: 20, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 17, cat: 'Refusal', label: 'Platform refusal (Mac)',
  transcript: `CUSTOMER: My Mac won't connect to the WiFi.
CANDIDATE: I don't support Macs. We're a Windows shop.
CUSTOMER: But the company gave me this laptop.
CANDIDATE: Not my problem. Call the Apple helpline.
CUSTOMER: Don't you have any Mac support?
CANDIDATE: Nope. (ends call)`,
  ticket: '(no ticket)',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, escalation_judgement: { status: 'fail' }, next_steps: { status: 'fail' }, issue_clarification: { status: 'fail' } }),
  redFlags: [{ type: 'refusal_to_help', evidence: 'Refused to support Mac platform' }],
  managerReview: 'Platform refusal. Score ≤20.', expectScoreMax: 25, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 18, cat: 'Refusal', label: 'Billing deflection',
  transcript: `CUSTOMER: My account was charged twice this month.
CANDIDATE: That's billing, not tech support. I can't help.
CUSTOMER: Can you transfer me to billing?
CANDIDATE: They're busy. You'll need to email them.
CUSTOMER: I've been waiting on email for a week.
CANDIDATE: Then call back during billing hours.`,
  ticket: 'Billing inquiry - referred to email',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, escalation_judgement: { status: 'fail' }, next_steps: { status: 'fail' } }),
  redFlags: [{ type: 'refusal_to_help', evidence: 'Deflected to billing without transfer or ticket' }],
  managerReview: 'Deflection without proper handoff. Score ≤25.', expectScoreMax: 30, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 19, cat: 'Refusal', label: 'Vague promise, no action',
  transcript: `CUSTOMER: My server is down and clients can't connect.
CANDIDATE: Okay, someone will get back to you.
CUSTOMER: When? This is urgent.
CANDIDATE: Eventually. I've logged it.
CUSTOMER: What's the ticket number?
CANDIDATE: It's in the system. You'll get an email. (ends call)
(no ticket actually created)`,
  ticket: '(no ticket)',
  criteria: except({ professional_conduct: { status: 'fail' }, customer_tone: { status: 'fail' }, urgency: { status: 'fail' }, impact: { status: 'fail' }, technical_discovery: { status: 'fail' }, escalation_judgement: { status: 'fail' }, next_steps: { status: 'fail' }, issue_clarification: { status: 'fail' } }),
  redFlags: [{ type: 'refusal_to_help', evidence: 'Vague promise of callback, no ticket created' }],
  managerReview: 'Abandonment. No ticket, no action. Score ≤20.', expectScoreMax: 20, expectReady: 'not_ready',
});

// ── Category 4: Invented/Hallucinated Fixes (20-24) ──
SCENARIOS.push({
  id: 20, cat: 'Invented', label: 'Claimed restart without doing it',
  transcript: `CUSTOMER: My SQL database is showing corruption errors.
CANDIDATE: I've restarted the SQL service on my end. Try now.
CUSTOMER: Is that safe? We have 200 users connected.
CANDIDATE: Don't worry, it's done. Try accessing it.
CUSTOMER: It's still showing the same error.
CANDIDATE: Give it a few minutes to propagate.`,
  ticket: 'SQL service restarted - corruption errors persist',
  criteria: except({ safety: { status: 'fail' }, next_steps: { status: 'fail' }, escalation_judgement: { status: 'fail' }, professional_conduct: { status: 'fail' } }),
  redFlags: [{ type: 'hallucinated_fix', evidence: 'Claimed to restart SQL service without verification' }],
  managerReview: 'Hallucinated fix without evidence. Score ≤50.', expectScoreMax: 50, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 21, cat: 'Invented', label: 'Generic it should work now',
  transcript: `CUSTOMER: No, it's still broken.
CANDIDATE: Hmm, let me try something on my end... (pause)
CANDIDATE: Okay, I've applied a patch. It should be working now.
CUSTOMER: What patch?
CANDIDATE: A backend fix. Try again.
CUSTOMER: Same issue.
CANDIDATE: That's strange. Let me check... (pause) Okay, I've done some more changes. Try now.
CUSTOMER: Still not working.
CANDIDATE: We'll need to escalate this.`,
  ticket: 'Backend issue - patch applied, no improvement',
  criteria: except({ safety: { status: 'partial' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, next_steps: { status: 'fail' } }),
  redFlags: [{ type: 'hallucinated_fix', evidence: 'Claimed backend patch without evidence' }],
  managerReview: 'Vague fix claims. Score ≤50.', expectScoreMax: 55, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 22, cat: 'Invented', label: 'Diagnosing hardware without diagnostics',
  transcript: `CUSTOMER: My computer is slow.
CANDIDATE: It's a hard drive failure. You need a new one.
CUSTOMER: Are you sure? It's only 6 months old.
CANDIDATE: Definitely. The symptoms are clear.
CUSTOMER: What tests did you run?
CANDIDATE: I can tell from the description. We see this all the time.
CUSTOMER: Can you run a diagnostic first?
CANDIDATE: It's not necessary. I'll order the replacement.`,
  ticket: 'Hard drive failure diagnosis - replacement ordered',
  criteria: except({ safety: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  redFlags: [{ type: 'hallucinated_fix', evidence: 'Diagnosed hardware failure without running diagnostics' }],
  managerReview: 'Invented hardware diagnosis. Score ≤50.', expectScoreMax: 50, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 23, cat: 'Invented', label: 'Claiming to have patched the system',
  transcript: `CUSTOMER: Our exchange server is down.
CANDIDATE: I've just pushed the latest security patch. That should fix it.
CUSTOMER: I didn't authorize any patches.
CANDIDATE: It was urgent. Microsoft released a critical update.
CUSTOMER: We need change management approval for patches.
CANDIDATE: Already applied. Too late now.
CUSTOMER: What was the KB number?
CANDIDATE: I don't remember. It's done.`,
  ticket: 'Exchange server - emergency patch applied',
  criteria: except({ safety: { status: 'fail' }, escalation_judgement: { status: 'fail' }, professional_conduct: { status: 'fail' }, recent_changes: { status: 'fail' } }),
  redFlags: [{ type: 'hallucinated_fix', evidence: 'Claimed patch without KB number or authorization' }],
  managerReview: 'Unauthorized changes. Hallucinated fix. Score ≤50.', expectScoreMax: 50, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 24, cat: 'Invented', label: 'I fixed this same issue yesterday (generic)',
  transcript: `CUSTOMER: SharePoint is timing out.
CANDIDATE: This is the same issue from yesterday. I fixed it then.
CUSTOMER: I didn't call yesterday.
CANDIDATE: Someone from your company did. It's the same root cause.
CUSTOMER: What was the fix?
CANDIDATE: Cleared the cache and restarted services. Doing it again now. There, done.
CUSTOMER: Still timing out.
CANDIDATE: Give it 30 minutes to propagate.`,
  ticket: 'SharePoint timeout - cache cleared',
  criteria: except({ technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, next_steps: { status: 'fail' } }),
  redFlags: [{ type: 'hallucinated_fix', evidence: 'Generic fix claim with no verification' }],
  managerReview: 'Generic fix claim. Score ≤55; current readiness floor maps scores below 60 to not_ready.', expectScoreMax: 55, expectReady: 'not_ready',
});

// ── Category 5: No Meaningful Troubleshooting (25-30) ──
SCENARIOS.push({
  id: 25, cat: 'NoTrouble', label: 'One-word replies',
  transcript: `CUSTOMER: Hi, my computer won't turn on.
CANDIDATE: Okay.
CUSTOMER: It was working yesterday.
CANDIDATE: I see.
CUSTOMER: What should I do?
CANDIDATE: Bring it in.
CUSTOMER: I need it for work today.
CANDIDATE: Okay.
CUSTOMER: Can you help?
CANDIDATE: Not really.`,
  ticket: 'Computer wont turn on - bring to shop',
  criteria: except({ identity_check: { status: 'fail' }, company_check: { status: 'fail' }, issue_clarification: { status: 'fail' }, impact: { status: 'fail' }, urgency: { status: 'fail' }, scope: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, next_steps: { status: 'fail' }, customer_tone: { status: 'fail' }, customer_communication: { status: 'fail' }, ticket_user_company: { status: 'fail' }, ticket_issue_summary: { status: 'fail' }, ticket_impact: { status: 'fail' }, ticket_urgency: { status: 'fail' }, ticket_checks_attempted: { status: 'fail' }, ticket_next_step: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  redFlags: [{ type: 'no_troubleshooting', evidence: 'One-word replies, no questions asked' }],
  managerReview: 'No troubleshooting at all. Score ≤40.', expectScoreMax: 40, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 26, cat: 'NoTrouble', label: 'Takes description but asks nothing',
  transcript: `CUSTOMER: Hi, I'm having trouble with Excel. It crashes when I open large files.
CANDIDATE: Right, let me log that.
CUSTOMER: It started after the update last night.
CANDIDATE: Okay.
CUSTOMER: I need this fixed, I have reports due.
CANDIDATE: I'll note that.
(Candidate asks zero follow-up questions. Logs ticket and ends call.)`,
  ticket: 'Excel crashing on large files',
  criteria: except({ issue_clarification: { status: 'partial' }, impact: { status: 'fail' }, urgency: { status: 'fail' }, scope: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, next_steps: { status: 'fail' } }),
  redFlags: [{ type: 'no_troubleshooting', evidence: 'Took issue description but asked zero follow-up questions' }],
  managerReview: 'Passive note-taking, no troubleshooting. Score ≤40.', expectScoreMax: 40, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 27, cat: 'NoTrouble', label: 'Immediate escalation without triage',
  transcript: `CUSTOMER: My email is slow.
CANDIDATE: I'm escalating this to Level 2.
CUSTOMER: Can't you check anything first?
CANDIDATE: No, this is beyond my scope.
CUSTOMER: What's the issue?
CANDIDATE: I can't say. Level 2 will look at it.
(Candidate did not check anything. Did not ask any questions.)`,
  ticket: 'Email slowness - escalated to Level 2',
  criteria: except({ issue_clarification: { status: 'fail' }, impact: { status: 'fail' }, urgency: { status: 'fail' }, scope: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, next_steps: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  redFlags: [{ type: 'no_troubleshooting', evidence: 'Immediate escalation without any triage or questions' }],
  managerReview: 'No triage before escalation. Score ≤40.', expectScoreMax: 40, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 28, cat: 'NoTrouble', label: 'Silent treatment (long hold)',
  transcript: `CUSTOMER: My printer has a paper jam.
CANDIDATE: Let me look that up. (5 minute silence)
CUSTOMER: Hello?
CANDIDATE: Still checking. (3 minute silence)
CUSTOMER: Are you there?
CANDIDATE: Yes, still researching. (2 minute silence)
CUSTOMER: Can you just tell me how to clear it?
CANDIDATE: I'm not sure. Let me ask someone. (3 minute silence)
CUSTOMER: I'll call back. (ends call)`,
  ticket: 'Paper jam - researching solution',
  criteria: except({ next_steps: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, customer_communication: { status: 'fail' }, customer_tone: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  redFlags: [{ type: 'no_troubleshooting', evidence: 'Extended silence, no useful troubleshooting' }],
  managerReview: 'Long hold with no progress. Score ≤50.', expectScoreMax: 50, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 29, cat: 'NoTrouble', label: 'Repeats same question',
  transcript: `CUSTOMER: My VPN won't connect.
CANDIDATE: What error message do you see?
CUSTOMER: Error 800.
CANDIDATE: Are you sure about the error?
CUSTOMER: Yes, Error 800.
CANDIDATE: And what does the error say exactly?
CUSTOMER: Error 800 - connection failed.
CANDIDATE: Can you confirm the error number?
CUSTOMER: 800! I just said it three times.
CANDIDATE: Okay, let me look up Error 800. (pause) Can you read the error again?`,
  ticket: 'VPN Error 800 - connection failed',
  criteria: except({ technical_discovery: { status: 'fail' }, recent_changes: { status: 'fail' }, customer_tone: { status: 'fail' }, customer_communication: { status: 'fail' } }),
  redFlags: [{ type: 'no_troubleshooting', evidence: 'Repeated same question 4 times without progress' }],
  managerReview: 'Ineffective troubleshooting. Score ≤45.', expectScoreMax: 50, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 30, cat: 'NoTrouble', label: 'Canned responses ignoring details',
  transcript: `CUSTOMER: My accounting software is showing incorrect tax calculations.
CANDIDATE: Have you tried turning it off and on?
CUSTOMER: Yes, same issue.
CANDIDATE: Clear your cache.
CUSTOMER: That didn't help.
CANDIDATE: Try a different browser.
CUSTOMER: It's a desktop application, not a website.
CANDIDATE: Have you tried turning it off and on?
CUSTOMER: Yes, I said that already.
CANDIDATE: I'll need to escalate this.`,
  ticket: 'Accounting software - tax calculation issue',
  criteria: except({ issue_clarification: { status: 'partial' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, customer_tone: { status: 'fail' } }),
  redFlags: [{ type: 'no_troubleshooting', evidence: 'Canned responses that ignored customer details' }],
  managerReview: 'Canned script, no adaptation. Score ≤45.', expectScoreMax: 50, expectReady: 'not_ready',
});

// ── Category 6: Partial / Incomplete (31-36) ──
SCENARIOS.push({
  id: 31, cat: 'Partial', label: 'Got name only, nothing else',
  transcript: `CUSTOMER: I can't access my files on the network drive.
CANDIDATE: Can I get your name?
CUSTOMER: Sarah Connor.
CANDIDATE: Thanks, Sarah. Let me check.
(Candidate opens ticket with name, but asks nothing else.)
CUSTOMER: What should I do?
CANDIDATE: I've logged it. Someone will look into it.
CUSTOMER: Is there anything I can try in the meantime?
CANDIDATE: Not really. Just wait.`,
  ticket: 'Sarah Connor - cannot access network drive',
  criteria: except({ identity_check: { status: 'pass' }, company_check: { status: 'fail' }, issue_clarification: { status: 'fail' }, impact: { status: 'fail' }, urgency: { status: 'fail' }, scope: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, next_steps: { status: 'fail' }, ticket_user_company: { status: 'partial' }, ticket_issue_summary: { status: 'partial' }, ticket_impact: { status: 'fail' }, ticket_urgency: { status: 'fail' }, ticket_checks_attempted: { status: 'fail' }, ticket_next_step: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  managerReview: 'Only confirmed name. Everything else missed.', expectScoreMax: 30, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 32, cat: 'Partial', label: 'Got issue but no impact/urgency',
  transcript: `CUSTOMER: I'm having a problem with my phone system - calls keep dropping.
CANDIDATE: Tell me about the issue.
CUSTOMER: Every time I'm on a call for more than 5 minutes, it drops.
CANDIDATE: Okay, I understand. Let me log that.
CUSTOMER: I'm a sales director. I'm missing client calls.
CANDIDATE: Right. We'll look into the phone system.
CUSTOMER: How urgent is this?
CANDIDATE: We'll get to it.`,
  ticket: 'Phone system dropping calls after 5 minutes',
  criteria: except({ identity_check: { status: 'fail' }, company_check: { status: 'fail' }, impact: { status: 'fail' }, urgency: { status: 'fail' }, scope: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, next_steps: { status: 'fail' }, ticket_impact: { status: 'fail' }, ticket_urgency: { status: 'fail' }, ticket_checks_attempted: { status: 'fail' }, escalation_judgement: { status: 'fail' } }),
  managerReview: 'Got issue description but missed impact, urgency, scope.', expectScoreMin: 25, expectScoreMax: 50, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 33, cat: 'Partial', label: 'Good call, terrible ticket',
  transcript: `CUSTOMER: My AutoCAD license expired and I'm in the middle of a project deadline.
CANDIDATE: Okay, let me help. What's your name?
CUSTOMER: Mike.
CANDIDATE: Mike what? What company?
CUSTOMER: Mike Chen, Apex Engineering.
CANDIDATE: When did the license expire?
CUSTOMER: Today. I have a deadline in 2 hours.
CANDIDATE: Understood. Let me check the license server. (checks) I can see it expired due to non-payment. Let me get approval to reinstate it.
CUSTOMER: How long will that take?
CANDIDATE: I'll escalate to our licensing team and mark it urgent. You should hear back within 30 minutes.`,
  ticket: 'license expired',
  criteria: except({ ticket_user_company: { status: 'fail' }, ticket_issue_summary: { status: 'fail' }, ticket_impact: { status: 'fail' }, ticket_urgency: { status: 'fail' }, ticket_checks_attempted: { status: 'fail' }, ticket_next_step: { status: 'fail' } }),
  managerReview: 'Good call but ticket is one line — useless for documentation.', expectScoreMin: 50, expectScoreMax: 75, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 34, cat: 'Partial', label: 'Great ticket, rushed call',
  transcript: `CUSTOMER: My mouse isn't working.
CANDIDATE: Okay. (creates ticket during call)
CUSTOMER: Don't you need more info?
CANDIDATE: I'll add it. (keeps typing)
CUSTOMER: It's the wireless mouse, model MX Master 3.
CANDIDATE: Got it.
CUSTOMER: Should I try new batteries?
CANDIDATE: Sure.
(Candidate asks no questions. Ends call quickly.)`,
  ticket: 'User: John Smith, Company: Riverdale Ltd. Device: Logitech MX Master 3 wireless mouse. Issue: Mouse cursor not moving. Batteries replaced - still not working. Impact: Cannot complete CAD drawings. Urgency: Deadline today 5pm. Attempted: Replaced batteries, re-paired Bluetooth. Next step: Test with different USB port, if issue persists replace mouse.',
  criteria: except({ identity_check: { status: 'fail' }, company_check: { status: 'fail' }, issue_clarification: { status: 'fail' }, impact: { status: 'fail' }, urgency: { status: 'fail' }, scope: { status: 'fail' }, technical_discovery: { status: 'fail' }, error_or_status_capture: { status: 'fail' }, recent_changes: { status: 'fail' }, next_steps: { status: 'fail' }, customer_tone: { status: 'partial' } }),
  managerReview: 'Great ticket saved a terrible call. Score should mostly come from ticket quality.', expectScoreMin: 35, expectScoreMax: 60, expectReady: 'not_ready',
});

SCENARIOS.push({
  id: 35, cat: 'Partial', label: 'Asks everything but forgets next steps',
  transcript: `CUSTOMER: My project management tool isn't sending notifications.
CANDIDATE: Can I get your name and company?
CUSTOMER: Jane, from Blue Ocean Marketing.
CANDIDATE: Great Jane. When did this start?
CUSTOMER: About 2 hours ago.
CANDIDATE: Is it just you or the whole team?
CUSTOMER: The whole team.
CANDIDATE: What's the impact?
CUSTOMER: We're missing client deadline alerts.
CANDIDATE: And how urgent?
CUSTOMER: Pretty urgent, clients are complaining.
CANDIDATE: Any error messages?
CUSTOMER: It says notification service unavailable.
CANDIDATE: Any recent changes?
CUSTOMER: We updated the app this morning.
CANDIDATE: That's likely the cause. Let me check the service status. (checks) The notification service is down. I need to restart it.
(Candidate restarts. Fixes it. But doesn't tell Jane what happened or what to expect next.)`,
  ticket: 'Project management tool notifications not sending. Impact: Missing client deadline alerts. Urgency: High - clients complaining. Scope: Whole team. Error: Notification service unavailable. Recent change: App update this morning. Action: Notification service restarted.',
  criteria: except({ next_steps: { status: 'fail' }, ticket_next_step: { status: 'fail' } }),
  managerReview: 'Good discovery but ended abruptly without summary or next steps.', expectScoreMin: 60, expectScoreMax: 80, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 36, cat: 'Partial', label: 'Good discovery but unsafe advice',
  transcript: `CUSTOMER: I forgot my Windows admin password.
CANDIDATE: No problem, I can help you reset it.
CUSTOMER: Great.
CANDIDATE: First, what's your username?
CUSTOMER: j.smith@company.com
CANDIDATE: And your current password?
CUSTOMER: I forgot it, that's the problem.
CANDIDATE: Right. Let me use a password recovery tool. I'll need to remote in.
CUSTOMER: Is that secure?
CANDIDATE: It's fine, I do this all the time. Just let me remote in and I'll bypass the login screen.
(Candidate did everything right in discovery but suggested an unsafe password bypass method.)`,
  ticket: 'Admin password reset requested for j.smith@company.com',
  criteria: except({ safety: { status: 'fail' }, escalation_judgement: { status: 'fail' }, ticket_checks_attempted: { status: 'fail' } }),
  redFlags: [{ type: 'unsafe_security_behaviour', evidence: 'Suggested password bypass tool without proper authorization' }],
  managerReview: 'Good call otherwise but security bypass suggestion is a critical gate.', expectScoreMax: 25, expectReady: 'not_ready',
});

// ── Category 7: Good calls with subtle misses (37-42) ──
SCENARIOS.push({
  id: 37, cat: 'Subtle', label: 'Missed scope (one vs many)',
  transcript: `CUSTOMER: Our team's file share is slow.
CANDIDATE: Can I get your name and company?
CUSTOMER: Tom, from Baker & Co.
CANDIDATE: When did this start?
CUSTOMER: This morning.
CANDIDATE: What kind of slowdown?
CUSTOMER: Opening files takes 2-3 minutes.
CANDIDATE: Any error messages?
CUSTOMER: No, just slow.
CANDIDATE: Let me check the file server.
(Candidate never asks if others are affected or if it's just Tom.)`,
  ticket: 'File share slow on Tom Baker & Co\'s machine.',
  criteria: except({ scope: { status: 'fail' }, ticket_scope: { status: 'fail' } }),
  managerReview: 'Good discovery but missed scope question - critical for diagnosing vs individual vs systemic.', expectScoreMin: 65, expectScoreMax: 85, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 38, cat: 'Subtle', label: 'Missed recent changes',
  transcript: `CUSTOMER: My QuickBooks won't open.
CANDIDATE: What's your name and company?
CUSTOMER: Rachel, from Summit Accounting.
CANDIDATE: When did this start?
CUSTOMER: Just now.
CANDIDATE: Any error message?
CUSTOMER: Application failed to initialize.
CANDIDATE: Let me try reinstalling.
(Candidate never asked about recent changes. Customer had installed a Windows update 30 minutes ago.)`,
  ticket: 'QuickBooks - application failed to initialize. Reinstall recommended.',
  criteria: except({ recent_changes: { status: 'fail' }, ticket_checks_attempted: { status: 'partial' }, technical_discovery: { status: 'partial' } }),
  managerReview: 'Missed recent changes which was the likely root cause.', expectScoreMin: 60, expectScoreMax: 80, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 39, cat: 'Subtle', label: 'Missed error message details',
  transcript: `CUSTOMER: My accounting software crashes on startup.
CANDIDATE: Name and company?
CUSTOMER: David, Preston & Co.
CANDIDATE: When did it start?
CUSTOMER: After I updated it this morning.
CANDIDATE: What happens when you open it?
CUSTOMER: It shows a popup and closes.
CANDIDATE: What does the popup say?
CUSTOMER: I'm not sure, it disappears quickly.
CANDIDATE: Okay, let me try a repair install.
(Candidate did not insist on getting the exact error or ask customer to screenshot it.)`,
  ticket: 'Accounting software crash after update - repair install recommended.',
  criteria: except({ error_or_status_capture: { status: 'fail' }, technical_discovery: { status: 'partial' } }),
  managerReview: 'Did not capture the error message despite it being visible.', expectScoreMin: 60, expectScoreMax: 80, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 40, cat: 'Subtle', label: 'Missed deadline urgency',
  transcript: `CUSTOMER: My presentation software is corrupted.
CANDIDATE: Name and company?
CUSTOMER: Alice, from Bright Ideas Agency.
CANDIDATE: When did this start?
CUSTOMER: Just now, I was working on a presentation.
CANDIDATE: Let me see if I can repair it.
CUSTOMER: How long will this take?
CANDIDATE: Not sure, let me try some things.
(Candidate never asked if there was a deadline or when the presentation was needed. Customer had a pitch in 1 hour.)`,
  ticket: 'Presentation software corrupted - attempted repair.',
  criteria: except({ urgency: { status: 'fail' }, ticket_urgency: { status: 'fail' } }),
  managerReview: 'Good technical work but missed urgency context.', expectScoreMin: 65, expectScoreMax: 85, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 41, cat: 'Subtle', label: 'Missed workaround check',
  transcript: `CUSTOMER: My Outlook can't send emails.
CANDIDATE: Name and company?
CUSTOMER: Mark, from Weston Logistics.
CANDIDATE: When did this start?
CUSTOMER: About an hour ago.
CANDIDATE: Just you or others?
CUSTOMER: Just me, I think.
CANDIDATE: What's the error?
CUSTOMER: Send/Receive error.
CANDIDATE: Let me check the Outlook profile.
(Candidate never asked if webmail works. There was a perfectly good workaround available.)`,
  ticket: 'Outlook send/receive error - checking profile.',
  criteria: except({ technical_discovery: { status: 'fail' }, ticket_checks_attempted: { status: 'partial' } }),
  managerReview: 'Missed quick workaround check (webmail).', expectScoreMin: 60, expectScoreMax: 80, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 42, cat: 'Subtle', label: 'Missed device/hostname',
  transcript: `CUSTOMER: My laptop keeps blue-screening.
CANDIDATE: Name and company?
CUSTOMER: Karen, from MedTech Solutions.
CANDIDATE: When did this start?
CUSTOMER: After I dropped it.
CANDIDATE: What error does the blue screen show?
CUSTOMER: SYSTEM_SERVICE_EXCEPTION.
CANDIDATE: Let me check if I can see the crash dumps.
(Candidate never asked for the device hostname or model. Makes it hard to diagnose without identifying the specific machine.)`,
  ticket: 'Laptop BSOD - SYSTEM_SERVICE_EXCEPTION after physical drop.',
  criteria: except({ technical_discovery: { status: 'partial' } }),
  managerReview: 'Solid call but device identification missing from ticket.', expectScoreMin: 65, expectScoreMax: 85, expectReady: 'needs_supervision',
});

// ── Category 8: Good / Nearly Perfect Calls (43-46) ──
SCENARIOS.push({
  id: 43, cat: 'Good', label: 'Good all-round, no empathy',
  transcript: `CUSTOMER: My internet has been down for 3 hours and I have a major client presentation in 30 minutes. I'm really stressed.
CANDIDATE: I understand. Let me start. Name and company?
CUSTOMER: Peter, from Maverick Consulting.
CANDIDATE: When did it go down?
CUSTOMER: About 3 hours ago.
CANDIDATE: Is it just you or the whole office?
CUSTOMER: Whole office.
CANDIDATE: What's your impact?
CUSTOMER: We can't access any cloud services. I have this presentation...
CANDIDATE: Let me check the connection status. (checks) Your router is offline. Can you check if the power light is on?
CUSTOMER: Yes, it's on.
CANDIDATE: Any recent changes to your network?
CUSTOMER: No.
CANDIDATE: Let me run a remote diagnostics. (runs it) I can see the line is down. I'll report this to your ISP as an urgent fault.
CUSTOMER: Thank you. How long?
CANDIDATE: 2-4 hours for ISP response. I'll give you a call back once I have an update.
(Candidate did everything right but never acknowledged the customer's stress or the presentation deadline emotionally.)`,
  ticket: 'Internet down 3 hours - whole office affected. Impact: Cannot access cloud services. Urgency: Client presentation in 30 minutes. Diagnostic: Router online, line down. Action: ISP fault logged as urgent. Will call back with update.',
  criteria: except({ customer_tone: { status: 'partial' } }),
  managerReview: 'Nearly perfect. Tick all technical boxes. Would benefit from empathy statement.', expectScoreMin: 80, expectScoreMax: 95, expectReady: 'ready',
});

SCENARIOS.push({
  id: 44, cat: 'Good', label: 'Good but no summary at end',
  transcript: `CUSTOMER: My scanner stopped working after the Windows update.
CANDIDATE: Name and company?
CUSTOMER: Emma, from Design Studio.
CANDIDATE: What scanner model?
CUSTOMER: Canon LiDE 400.
CANDIDATE: When did it stop?
CUSTOMER: After update last night.
CANDIDATE: Just you or others?
CUSTOMER: Just mine.
CANDIDATE: What's happening when you try to scan?
CUSTOMER: Nothing, scanner not detected.
CANDIDATE: Let me check if the driver is still there. (checks) It looks like the update replaced the driver. I'll reinstall it.
(Candidate reinstalls driver. Scanner works. Tells customer it's fixed but doesn't summarise what happened or what to do if it happens again.)`,
  ticket: 'Canon LiDE 400 scanner not detected after Windows update. Driver was replaced by update. Reinstalled driver - scanner now working.',
  criteria: except({ next_steps: { status: 'partial' }, ticket_next_step: { status: 'partial' } }),
  managerReview: 'Good call, fixed issue, but lacked closure summary.', expectScoreMin: 75, expectScoreMax: 90, expectReady: 'ready',
});

SCENARIOS.push({
  id: 45, cat: 'Good', label: 'Nearly perfect, missed one ticket field',
  transcript: `CUSTOMER: My CRM is running extremely slowly.
CANDIDATE: Name and company?
CUSTOMER: Lisa, from Venture Capital Partners.
CANDIDATE: When did this start?
CUSTOMER: About a week ago, gradually getting worse.
CANDIDATE: Is it just you or the team?
CUSTOMER: The whole team of 15.
CANDIDATE: What's the impact?
CUSTOMER: We can't process deals efficiently.
CANDIDATE: Any error messages?
CUSTOMER: No, just slow loading.
CANDIDATE: Any recent changes?
CUSTOMER: We migrated to a new server 2 weeks ago.
CANDIDATE: That could be related. Let me check the database performance. (checks) The database index needs rebuilding. I'll schedule that for tonight.
CUSTOMER: Is there anything we can do in the meantime?
CANDIDATE: It should be faster after tonight. I'll email you the schedule.
(Candidate handled everything well. Ticket is comprehensive except missing the urgency/deadline.)`,
  ticket: 'User: Lisa, Venture Capital Partners. Issue: CRM slow for all 15 users. Started: 1 week ago, got worse. Impact: Cannot process deals efficiently. No error messages. Recent change: Server migration 2 weeks ago. Diagnosis: Database index needs rebuild. Action: Schedule rebuild for tonight.',
  criteria: except({ ticket_urgency: { status: 'fail' }, urgency: { status: 'partial' } }),
  managerReview: 'Excellent call. Minor miss on urgency documentation.', expectScoreMin: 75, expectScoreMax: 90, expectReady: 'ready',
});

SCENARIOS.push({
  id: 46, cat: 'Good', label: 'Perfect call',
  criteria: allPass(),
  redFlags: [],
  transcript: `CUSTOMER: Hi, I can't log into the time tracking system.
CANDIDATE: Good morning, thank you for calling. Can I get your name and company?
CUSTOMER: James Wilson, Mercer & Tate Law.
CANDIDATE: Thank you James. When did this start?
CUSTOMER: Yesterday, after I changed my password.
CANDIDATE: Is it just you or others affected?
CUSTOMER: Just me.
CANDIDATE: What's the impact of not being able to log in?
CUSTOMER: I can't track my billable hours. I have a court filing deadline at 3pm today.
CANDIDATE: I understand, that's important. What happens when you try to log in?
CUSTOMER: It says invalid credentials.
CANDIDATE: And you're sure you changed it yesterday? Let me check if there's a sync delay. (checks) I can see the password change went through but the time tracking system hasn't picked it up yet. Let me force a sync.
CUSTOMER: Will I lose any data?
CANDIDATE: No, your time entries are all stored on the server. (syncs) Try logging in now.
CUSTOMER: It works! Thank you.
CANDIDATE: You're welcome, James. Just to summarise: the password change didn't sync to the time tracking system automatically. I've forced the sync. If it happens again, call us and we can do a manual sync. I'll include that note in your ticket.`,
  ticket: 'User: James Wilson, Mercer & Tate Law. Issue: Cannot log into time tracking after password change. Scope: Single user. Impact: Cannot track billable hours. Urgency: Court filing deadline at 3pm. Error: Invalid credentials. Recent change: Password changed yesterday. Diagnosis: Password change did not sync to time tracking system. Action: Forced manual sync. Resolution: Login working. Next step: Contact us for manual sync if recurrence.',
  managerReview: 'EXCELLENT. Everything covered. Empathy, questions, resolution, summary.', expectScoreMin: 90, expectScoreMax: 100, expectReady: 'ready',
});

// ── Category 9: Ticket Quality Issues (47-50) ──
SCENARIOS.push({
  id: 47, cat: 'Ticket', label: 'Great call, one-line ticket',
  transcript: `CUSTOMER: My headset microphone stopped working in Teams.
CANDIDATE: Name and company?
CUSTOMER: Tom, from Remote Solutions.
CANDIDATE: When did this start?
CUSTOMER: This morning, after a Teams update.
CANDIDATE: Just you or others?
CUSTOMER: Just me.
CANDIDATE: What's the impact?
CUSTOMER: I can't speak in client meetings.
CANDIDATE: Have you checked the mic settings?
CUSTOMER: Yes, it's selected as the default device.
CANDIDATE: Let me check the driver. (checks) The driver is fine. Try changing the default device to something else and back.
CUSTOMER: That worked! Mic is working now.
CANDIDATE: Great, it was likely a device priority glitch after the update.`,
  ticket: 'headset mic fixed',
  criteria: except({ ticket_user_company: { status: 'fail' }, ticket_issue_summary: { status: 'fail' }, ticket_impact: { status: 'fail' }, ticket_urgency: { status: 'fail' }, ticket_checks_attempted: { status: 'fail' }, ticket_next_step: { status: 'fail' } }),
  managerReview: 'Good call but one-line ticket is useless for documentation.', expectScoreMin: 40, expectScoreMax: 60, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 48, cat: 'Ticket', label: 'Great call, wrong priority in ticket',
  transcript: `CUSTOMER: Our company website is down - all customers seeing 503 error.
CANDIDATE: Name and company?
CUSTOMER: Sarah, from E-Commerce Direct.
CANDIDATE: When did this start?
CUSTOMER: About 10 minutes ago.
CANDIDATE: Who's affected?
CUSTOMER: Everyone - it's our public website.
CANDIDATE: What's the impact?
CUSTOMER: Zero sales, customers can't access their accounts.
CANDIDATE: Any recent changes?
CUSTOMER: We pushed a code update 30 minutes ago. The developer is looking but we need IT involved.
CANDIDATE: This is critical. Let me get the web team on this immediately. I'll set up a bridge call.
(Candidate handled the emergency well but logged ticket as medium priority.)`,
  ticket: 'User: Sarah, E-Commerce Direct. Issue: Company website down (503 error). Scope: All customers. Impact: Zero sales, no customer access. Recent change: Code push 30 min ago. Action: Web team notified. Priority: Medium.',
  criteria: except({ escalation_judgement: { status: 'partial' }, ticket_urgency: { status: 'fail' } }),
  managerReview: 'Good emergency handling but ticket priority does not match severity.', expectScoreMin: 60, expectScoreMax: 80, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 49, cat: 'Ticket', label: 'Great call, ticket has invented info',
  transcript: `CUSTOMER: My email signature isn't displaying correctly.
CANDIDATE: Name and company?
CUSTOMER: Priya, from Horizon Consulting.
CANDIDATE: What email client?
CUSTOMER: Outlook desktop.
CANDIDATE: When did this start?
CUSTOMER: After IT pushed a new signature template.
CANDIDATE: What does it look like?
CUSTOMER: The logo is stretched and the font is wrong.
CANDIDATE: Let me check the template. (checks) The template has an incorrect image path. I'll fix it and redeploy.
CUSTOMER: How long?
CANDIDATE: I'll do it now. Test it and let me know. (fixes it)
CUSTOMER: Perfect, working now.
CANDIDATE: Great.`,
  ticket: 'Email signature issue resolved. Root cause: Outlook profile corruption. Performed full profile rebuild and reconfigured signature from backup. User verified working.',
  criteria: except({ ticket_issue_summary: { status: 'partial' } }),
  redFlags: [{ type: 'unsupported_ticket_claims', evidence: 'Ticket claims profile rebuild not supported by transcript' }],
  managerReview: 'Good call but ticket contains information not supported by the transcript (profile rebuild never happened).', expectScoreMin: 55, expectScoreMax: 75, expectReady: 'needs_supervision',
});

SCENARIOS.push({
  id: 50, cat: 'Ticket', label: 'Ticket mentions fix not in transcript',
  transcript: `CUSTOMER: My Bluetooth keeps disconnecting from my keyboard.
CANDIDATE: Name and company?
CUSTOMER: Alex, from Nexus Digital.
CANDIDATE: When did this start?
CUSTOMER: After I upgraded to Windows 11.
CANDIDATE: Have you tried removing and re-pairing?
CUSTOMER: Yes, same issue.
CANDIDATE: Let me check if there's a driver update. (checks) There's a new Bluetooth driver. Let me install it.
CUSTOMER: Okay.
CANDIDATE: Done. Restart your computer.
CUSTOMER: Okay, restarting. (restarts)
CUSTOMER: Seems to be working now.
CANDIDATE: Great.`,
  ticket: 'Bluetooth keyboard disconnecting after Windows 11 upgrade. Attempted: re-pairing, driver update, Bluetooth stack reset, power management disable, registry tweak to disable selective suspend. Resolution: Driver update + power management settings. User confirmed working.',
  criteria: except({ technical_discovery: { status: 'partial' }, ticket_checks_attempted: { status: 'fail' } }),
  redFlags: [{ type: 'unsupported_ticket_claims', evidence: 'Ticket exaggerates registry and power management steps' }],
  managerReview: 'Ticket exaggerates troubleshooting steps. Registry tweak and power management were not done.', expectScoreMin: 50, expectScoreMax: 70, expectReady: 'needs_supervision',
});

// ====== Run All 50 ======
console.log('='.repeat(72));
console.log('CALLCALLUM — 50-Transcript Deterministic Scoring Simulator');
console.log('='.repeat(72));
console.log(`Rubric: callcallum-base-v0.4-analysis-hardening`);
console.log(`Total weight pool: ${TOTAL_WEIGHT}`);
console.log(`Fail gates: ${FAIL_GATES.length}`);
console.log(`Scenarios: ${SCENARIOS.length}\n`);

let pass = 0, fail = 0, determinismPass = 0;
const results = [];

for (const s of SCENARIOS) {
  // Run twice for determinism check
  const r1 = scoreOne(s.criteria, s.redFlags);
  const r2 = scoreOne(s.criteria, s.redFlags);
  const isDeterministic = r1.score === r2.score && r1.readiness === r2.readiness && JSON.stringify(r1.gates) === JSON.stringify(r2.gates);

  // Check expected bounds
  const scoreOk = s.expectScoreMin !== undefined ? (r1.score >= s.expectScoreMin && r1.score <= s.expectScoreMax) : (r1.score <= s.expectScoreMax);
  const readyOk = r1.readiness === s.expectReady;
  const allOk = scoreOk && readyOk && isDeterministic;

  if (allOk) pass++; else fail++;
  if (isDeterministic) determinismPass++;

  results.push({
    id: s.id, cat: s.cat, label: s.label,
    score: r1.score, raw: r1.raw, readiness: r1.readiness,
    gates: r1.gates, failedChecks: r1.failedChecks,
    expectScoreMax: s.expectScoreMax, expectScoreMin: s.expectScoreMin || 0,
    expectReady: s.expectReady,
    scoreOk, readyOk, deterministic: isDeterministic,
    review: s.managerReview,
  });
}

// ====== Print Results ======
console.log('RESULTS BY CATEGORY\n');

const categories = {};
for (const r of results) {
  if (!categories[r.cat]) categories[r.cat] = [];
  categories[r.cat].push(r);
}

for (const [cat, items] of Object.entries(categories)) {
  console.log(`── ${cat} ──`);
  for (const r of items) {
    const status = (r.scoreOk && r.readyOk && r.deterministic) ? '✓' : '✗';
    const det = r.deterministic ? 'det=✓' : 'det=✗';
    console.log(`  ${status}  #${String(r.id).padStart(2)} ${r.label.padEnd(45)} score=${String(r.score).padStart(3)} raw=${String(r.raw).padStart(3)} ready=${r.readiness.padEnd(15)} gates=[${r.gates.join(',')}] ${det}`);
    if (!r.scoreOk) console.log(`        ✗ Score ${r.score} out of range [${r.expectScoreMin}-${r.expectScoreMax}]`);
    if (!r.readyOk) console.log(`        ✗ Readiness ${r.readiness} != ${r.expectReady}`);
    if (!r.deterministic) console.log(`        ✗ Determinism FAILED between runs`);
  }
  console.log('');
}

// ====== Aggregates ======
console.log('─'.repeat(72));
console.log('SUMMARY\n');
console.log(`Total scenarios: ${SCENARIOS.length}`);
console.log(`Passed:          ${pass}`);
console.log(`Failed:          ${fail}`);
console.log(`Deterministic:   ${determinismPass}/${SCENARIOS.length}\n`);

if (fail > 0) {
  console.log('FAILED SCENARIOS:\n');
  for (const r of results) {
    if (r.scoreOk && r.readyOk && r.deterministic) continue;
    console.log(`  #${r.id} ${r.label}`);
    if (!r.scoreOk) console.log(`       Score: ${r.score} (expected ${r.expectScoreMin}-${r.expectScoreMax})`);
    if (!r.readyOk) console.log(`       Readiness: ${r.readiness} (expected ${r.expectReady})`);
    if (!r.deterministic) console.log(`       Determinism check failed`);
    console.log(`       Manager review: ${r.review}`);
    console.log('');
  }

  console.log('RECOMMENDED FIXES:\n');
  // Analyse failure patterns
  const wrongReadiness = results.filter(r => !r.readyOk);
  if (wrongReadiness.length > 0) {
    console.log(`- ${wrongReadiness.length} scenarios have wrong readiness label (gate override logic may need tuning)`);
  }
  const scoreOutOfRange = results.filter(r => !r.scoreOk);
  if (scoreOutOfRange.length > 0) {
    console.log(`- ${scoreOutOfRange.length} scenarios have scores outside expected range`);
  }
}

console.log('\nDETERMINISM CHECK:\n');
const detFail = results.filter(r => !r.deterministic);
if (detFail.length === 0) {
  console.log('  All 50 scenarios produce identical scores and readiness across runs. ✓');
} else {
  for (const r of detFail) {
    console.log(`  #${r.id} ${r.label}: scores differ between runs`);
  }
}

console.log('');
console.log('─'.repeat(72));
console.log('END OF REPORT');

if (fail > 0 || determinismPass !== SCENARIOS.length) {
  process.exitCode = 1;
}
