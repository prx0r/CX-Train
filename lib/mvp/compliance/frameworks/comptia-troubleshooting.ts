import { FrameworkDefinition } from '../evaluator';

/**
 * CompTIA Troubleshooting Methodology — industry standard 6-step process
 *
 * Source: CompTIA A+ (220-1101/220-1102), Network+ (N10-009), Security+ (SY0-701)
 * This is the de-facto standard IT troubleshooting methodology taught across
 * all CompTIA certifications. It is public domain as a methodology (the steps
 * themselves are not copyrightable, only CompTIA's specific exam content).
 *
 * Steps:
 *   1. Identify the problem
 *   2. Establish a theory of probable cause
 *   3. Test the theory to determine the cause
 *   4. Establish a plan of action and implement the solution
 *   5. Verify full system functionality and implement preventive measures
 *   6. Document findings, actions, and outcomes
 *
 * Each step has observable sub-criteria for call assessment.
 */
export const COMPTIA_TROUBLESHOOTING: FrameworkDefinition = {
  id: 'comptia_troubleshooting',
  name: 'CompTIA Troubleshooting Methodology',
  version: '1.0',
  type: 'skills_framework',
  category: 'technical_troubleshooting',
  passThreshold: 70,
  weight: 1.0,
  description: 'CompTIA 6-step troubleshooting methodology — the industry-standard approach taught across A+, Network+, and Security+ certifications. Assesses structured problem-solving from problem identification through documentation.',
  standardsAlignments: [
    'CompTIA A+ 220-1101/220-1102',
    'CompTIA Network+ N10-009',
    'CompTIA Security+ SY0-701',
  ],
  criteria: [
    // ════════════════════════════════════════════════════════════════
    // STEP 1: IDENTIFY THE PROBLEM
    // ════════════════════════════════════════════════════════════════
    {
      id: 'comptia_gather_info',
      label: 'Gathered information from log files, error messages, and user reports. Did the candidate collect data before jumping to a solution?',
      weight: 8,
      critical: false,
      category: 'identify_problem',
      subcategory: '1. Identify the Problem',
      checkType: 'ai_criteria',
      checkTarget: 'error_or_status_capture',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 1 — Identify the Problem: "Gathering information from log files and error messages." Assessment criteria: (1) asks for exact error messages or status indicators; (2) checks log files or diagnostic information where available; (3) records the exact error text rather than paraphrasing. A good example: "What does the error message say exactly? Can you read it to me word for word?" A poor example: Accepting "It says there\'s an error" without getting the specific message.',
    },
    {
      id: 'comptia_question_users',
      label: 'Questioned users to understand the issue. Did the candidate ask the customer to describe the problem in their own words?',
      weight: 8,
      critical: false,
      category: 'identify_problem',
      subcategory: '1. Identify the Problem',
      checkType: 'ai_criteria',
      checkTarget: 'issue_clarification',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 1 — Identify the Problem: "Questioning users." Assessment criteria: (1) asks the customer to describe the problem in their own words; (2) asks follow-up questions to clarify vague descriptions; (3) does not assume they understand the issue without confirmation. A good example: "Tell me exactly what happens when you try to send an email. What were you doing just before it stopped working?" A poor example: "Email is broken? Okay, let me reset your password."',
    },
    {
      id: 'comptia_identify_symptoms',
      label: 'Identified symptoms and determined recent changes. Did the candidate establish what symptoms are occurring and what changed before the problem started?',
      weight: 8,
      critical: false,
      category: 'identify_problem',
      subcategory: '1. Identify the Problem',
      checkType: 'ai_criteria',
      checkTarget: 'recent_changes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 1 — Identify the Problem: "Identifying symptoms. Determining recent changes." Assessment criteria: (1) asks what symptoms the user is experiencing; (2) asks what changed before the problem started — updates, installations, configuration changes; (3) correlates timing of changes with problem onset. A good example: "When did this first happen? Did anything change just before — any updates, new software, or setting changes?" A poor example: Not asking about changes at all.',
    },
    {
      id: 'comptia_duplicate_problem',
      label: 'Attempted to duplicate the problem. Did the candidate try to reproduce the issue or verify the symptoms themselves?',
      weight: 6,
      critical: false,
      category: 'identify_problem',
      subcategory: '1. Identify the Problem',
      checkType: 'ai_criteria',
      checkTarget: 'technical_discovery',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 1 — Identify the Problem: "Duplicating the problem." Assessment criteria: (1) attempts to reproduce the issue where possible; (2) asks the user to demonstrate the problem; (3) verifies the symptoms are still present before starting diagnosis. A good example: "Can you try sending an email now so I can see what happens?" A poor example: Taking the user\'s word for the symptoms without attempting to verify.',
    },
    {
      id: 'comptia_narrow_scope',
      label: 'Narrowed the scope of the problem. Did the candidate determine whether one user or multiple users are affected, and establish the boundaries of the issue?',
      weight: 8,
      critical: false,
      category: 'identify_problem',
      subcategory: '1. Identify the Problem',
      checkType: 'ai_criteria',
      checkTarget: 'scope',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 1 — Identify the Problem: "Narrowing the scope of the problem. Approaching multiple problems one at a time." Assessment criteria: (1) asks if the issue affects one user or multiple; (2) establishes what IS and IS NOT affected — "Does webmail work? Do other computers have the same issue?"; (3) if multiple issues are reported, addresses them one at a time. A good example: "Is this just affecting you, or are other people having the same problem? And does it happen on other devices?" A poor example: Treating a company-wide outage and a single-user issue with the same response.',
    },

    // ════════════════════════════════════════════════════════════════
    // STEP 2: ESTABLISH A THEORY OF PROBABLE CAUSE
    // ════════════════════════════════════════════════════════════════
    {
      id: 'comptia_start_simple',
      label: 'Started simple and worked toward the complex. Did the candidate consider obvious, simple causes before jumping to complex ones?',
      weight: 10,
      critical: false,
      category: 'theory_of_cause',
      subcategory: '2. Establish a Theory of Probable Cause',
      checkType: 'ai_criteria',
      checkTarget: 'comptia_start_simple',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 2 — Establish a Theory of Probable Cause: "Questioning the obvious. Start simple and work toward the complex." Assessment criteria: (1) checks simple causes first — "Is it plugged in? Is it on? Did you restart?"; (2) does not jump to complex or destructive solutions before exhausting simple ones; (3) the simplest possible cause is tested or acknowledged before proceeding. A good example: "Before we do anything complicated, let me check the simplest things first. Can you try restarting Outlook?" A poor example: Jumping straight to "Let me rebuild your Outlook profile" without checking the Work Offline toggle first.',
    },
    {
      id: 'comptia_multiple_approaches',
      label: 'Considered multiple possible causes. Did the candidate generate several hypotheses rather than fixating on a single theory?',
      weight: 8,
      critical: false,
      category: 'theory_of_cause',
      subcategory: '2. Establish a Theory of Probable Cause',
      checkType: 'ai_criteria',
      checkTarget: 'comptia_generate_theories',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 2 — Establish a Theory of Probable Cause: "Considering multiple approaches." Assessment criteria: (1) generates multiple possible causes rather than jumping to one; (2) considers both simple and complex possibilities; (3) uses knowledge bases, vendor docs, or past experience to inform theories. A good example: "There are a few things that could cause this: the Work Offline toggle might be enabled, there could be a network issue, or the profile might be corrupted. Let me start with the most likely." A poor example: Fixating on a single unlikely cause and ignoring other possibilities.',
    },

    // ════════════════════════════════════════════════════════════════
    // STEP 3: TEST THE THEORY TO DETERMINE THE CAUSE
    // ════════════════════════════════════════════════════════════════
    {
      id: 'comptia_test_theory',
      label: 'Tested the theory before implementing a fix. Did the candidate verify their hypothesis before making changes, and adapt if the theory was wrong?',
      weight: 10,
      critical: false,
      category: 'test_theory',
      subcategory: '3. Test the Theory to Determine the Cause',
      checkType: 'ai_criteria',
      checkTarget: 'kt_test_causes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 3 — Test the Theory: "Test the theory to determine the cause. If theory is confirmed, proceed. If not, establish a new theory or escalate." Assessment criteria: (1) tests their hypothesis with a specific, targeted check — not a random fix; (2) interprets the test result correctly — if the theory is wrong, they go back to Step 2 rather than proceeding blindly; (3) adapts based on test results rather than forcing the same fix. A good example: "Let me test my theory — if the Work Offline toggle is enabled, turning it off should fix it immediately. Let me check." A poor example: Trying a fix that doesn\'t address the root cause, and when it fails, trying the same fix again harder.',
    },

    // ════════════════════════════════════════════════════════════════
    // STEP 4: ESTABLISH A PLAN OF ACTION AND IMPLEMENT
    // ════════════════════════════════════════════════════════════════
    {
      id: 'comptia_plan_action',
      label: 'Established a plan of action before implementing. Did the candidate plan their approach, consider potential effects, and prepare a rollback option?',
      weight: 8,
      critical: false,
      category: 'plan_action',
      subcategory: '4. Establish a Plan of Action',
      checkType: 'ai_criteria',
      checkTarget: 'comptia_plan_action',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 4 — Establish a Plan of Action: "Establish a plan of action to resolve the problem and identify potential effects." Assessment criteria: (1) plans the approach before making changes — does not act impulsively; (2) considers potential side effects of the fix; (3) has a rollback plan if the fix doesn\'t work or causes issues. A good example: "Let me plan this out. I\'ll try disabling Work Offline first since it\'s non-destructive. If that doesn\'t work, I\'ll run the Microsoft Support Assistant. Only if both fail will I consider rebuilding the profile, since that means re-entering account details." A poor example: Making changes without considering what could go wrong or how to reverse them.',
    },
    {
      id: 'comptia_implement_solution',
      label: 'Implemented the solution or escalated appropriately. Did the candidate execute the fix, or escalate with proper context when needed?',
      weight: 8,
      critical: false,
      category: 'plan_action',
      subcategory: '4. Establish a Plan of Action',
      checkType: 'ai_criteria',
      checkTarget: 'escalation_judgement',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 4 — Implement the Solution: "Implement the solution or escalate as necessary." Assessment criteria: (1) implements the fix according to the plan; (2) if the issue is beyond their capability, escalates with full context — what was tried, what the symptoms are, what information has been gathered; (3) does not escalate unnecessarily. A good example: "I\'ve tried the basic checks and the issue appears to be server-side. I\'m going to escalate this to the infrastructure team with details of what I\'ve already checked." A poor example: Escalating with "I don\'t know what\'s wrong, can someone look at it?" without any diagnostic context.',
    },

    // ════════════════════════════════════════════════════════════════
    // STEP 5: VERIFY FULL SYSTEM FUNCTIONALITY
    // ════════════════════════════════════════════════════════════════
    {
      id: 'comptia_verify_fix',
      label: 'Verified full system functionality after the fix. Did the candidate confirm the issue is resolved with the user and check for side effects?',
      weight: 10,
      critical: false,
      category: 'verify_functionality',
      subcategory: '5. Verify Full System Functionality',
      checkType: 'ai_criteria',
      checkTarget: 'comptia_verify_fix',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 5 — Verify Functionality: "Verify full system functionality and, if applicable, implement preventive measures." Assessment criteria: (1) asks the user to confirm the issue is resolved — "Can you try it now and let me know if it\'s working?"; (2) checks that the fix didn\'t break anything else; (3) does not assume the fix worked without confirmation. A good example: "The reset email has been sent. Please check your inbox and try logging in. Can you confirm you can access your email now?" A poor example: Applying a fix and closing the ticket without confirming with the user.',
    },
    {
      id: 'comptia_preventive_measures',
      label: 'Implemented preventive measures. Did the candidate suggest ways to prevent the issue from recurring?',
      weight: 6,
      critical: false,
      category: 'verify_functionality',
      subcategory: '5. Verify Full System Functionality',
      checkType: 'ai_criteria',
      checkTarget: 'comptia_preventive_measures',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 5 — Verify Functionality: "Implement preventive measures." Assessment criteria: (1) suggests steps to prevent recurrence — "To stop this happening again, let me set up a monitoring alert"; (2) provides advice to the user on avoiding the issue in future; (3) the suggestion is specific and actionable. A good example: "Now that it\'s fixed, I recommend we set up a recurring check to ensure the Work Offline toggle doesn\'t get accidentally enabled. I\'ll also send you a guide on what to check if this happens again." A poor example: Fixing the issue with no thought to prevention.',
    },

    // ════════════════════════════════════════════════════════════════
    // STEP 6: DOCUMENT FINDINGS
    // ════════════════════════════════════════════════════════════════
    {
      id: 'comptia_document',
      label: 'Documented findings, actions, outcomes, and lessons learned. Did the candidate record the troubleshooting process in the ticket, not just the resolution?',
      weight: 8,
      critical: false,
      category: 'document_findings',
      subcategory: '6. Document Findings',
      checkType: 'ticket_field',
      checkTarget: 'resolution',
      passIf: 'pass_or_partial',
      evidenceDescription: 'CompTIA Step 6 — Document Findings: "Document findings, actions, outcomes, and lessons learned." Assessment criteria: (1) the ticket captures the symptoms and diagnostic steps taken; (2) records the root cause, not just the fix; (3) documents any lessons learned for future reference; (4) the ticket is understandable by another technician. A good example: "Symptom: Outlook stuck in Work Offline mode. Checked: status bar showed Offline, toggled off → immediate resolution. Root cause: Work Offline setting was enabled. Follow-up: advised user on prevention." A poor example: A ticket that says only "Fixed Outlook" with no diagnostic process documented.',
    },
  ],
};
