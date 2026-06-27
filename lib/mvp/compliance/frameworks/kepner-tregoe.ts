import { FrameworkDefinition } from '../evaluator';

/**
 * Kepner-Tregoe Problem Analysis
 *
 * Source: Kepner-Tregoe Inc. — proprietary, paywalled.
 * The full KT method (Situation Appraisal, Problem Analysis,
 * Decision Analysis, Potential Problem Analysis) is taught through
 * paid training courses. Foundational text: "The New Rational Manager"
 * (Kepner & Tregoe, 1981, still in print).
 *
 * This implementation uses publicly available descriptions of the
 * Problem Analysis phase (IS/IS NOT matrix), which is the most
 * directly applicable to IT support troubleshooting. Decision Analysis
 * and Potential Problem Analysis are less frequently used in single
 * support calls and are not assessed here.
 *
 * This is an assessment MAPPING — not official KT training.
 */
export const KEPNER_TREGOE: FrameworkDefinition = {
  id: 'kepner_tregoe',
  name: 'Kepner-Tregoe Problem Analysis',
  version: '2.0',
  type: 'skills_framework',
  category: 'technical_troubleshooting',
  passThreshold: 70,
  weight: 1.0,
  description: 'Kepner-Tregoe Problem Analysis method (IS/IS NOT matrix) — the structured approach to root cause analysis. Assesses whether the candidate systematically identifies the problem boundary, scope, timing, and extent before testing causes. KT is proprietary; this is an assessment mapping.',
  standardsAlignments: ['Kepner-Tregoe Problem Analysis (assessment mapping)'],
  criteria: [
    {
      id: 'kt_define_problem',
      label: 'Defined the problem clearly — Did the candidate articulate what IS happening versus what IS NOT happening? This establishes the problem boundary.',
      weight: 10,
      critical: false,
      category: 'problem_definition',
      checkType: 'ai_criteria',
      checkTarget: 'kt_define_problem',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Define the Problem (the "IS/IS NOT" starting point): the candidate must clearly articulate what the deviation is — what IS happening (the symptom or failure) versus what IS NOT happening (what should be happening but is not, or what is working correctly). Assessment criteria: (1) identifies the specific deviation from normal — "Email is not sending, but webmail works" is better than "Email is broken"; (2) distinguishes between symptoms and the actual problem; (3) establishes what IS working correctly — this narrows the search for causes; (4) the problem statement is specific, measurable, and actionable. A good example: "Outlook is showing \'Working Offline\' in the status bar, but the network connection is active and webmail works. Email is not sending from the desktop client." A poor example: "Outlook isn\'t working" with no clarification of what "not working" means or what IS working that could help narrow the cause.',
    },
    {
      id: 'kt_establish_scope',
      label: 'Established scope — Did the candidate investigate WHERE the problem occurs and WHERE it does not? This helps isolate the affected system or location.',
      weight: 10,
      critical: false,
      category: 'problem_definition',
      checkType: 'ai_criteria',
      checkTarget: 'scope',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Specify WHERE (the "IS/IS NOT" location dimension): the candidate must determine where the problem occurs and where it does not. This helps isolate whether the issue is specific to one device, one location, or a particular configuration. Assessment criteria: (1) asks if the problem affects one device or multiple devices; (2) asks if the problem occurs in one location or across locations; (3) tests whether the problem replicates on another device or in another environment; (4) uses the scope information to narrow possible causes. A good example: "Is this happening on just your computer, or are other people in the office having the same issue? What about when you use webmail on your phone?" A poor example: Assuming the problem is global without checking scope, or not asking about scope at all.',
    },
    {
      id: 'kt_establish_timing',
      label: 'Established timing — Did the candidate determine WHEN the problem started, whether it is continuous or intermittent, and whether there is a pattern?',
      weight: 10,
      critical: false,
      category: 'problem_definition',
      checkType: 'ai_criteria',
      checkTarget: 'started_when',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Specify WHEN (the "IS/IS NOT" timing dimension): the candidate must establish when the problem first occurred, whether it is continuous or intermittent, and whether there is a noticeable pattern. Assessment criteria: (1) asks when the problem first started — establishes a timeline; (2) asks whether it is constant or comes and goes; (3) if intermittent, asks about pattern or frequency; (4) asks what was happening around the time it started (this links to change analysis). A good example: "When did this start happening? Was it gradual or sudden? Have you noticed any pattern — does it happen at certain times of day?" A poor example: Not asking about timing at all, or accepting "it just started" without exploring when and what changed.',
    },
    {
      id: 'kt_determine_extent',
      label: 'Determined extent — Did the candidate establish how widespread the problem is — how many users affected, how often it occurs, and the severity of the impact?',
      weight: 10,
      critical: false,
      category: 'problem_definition',
      checkType: 'ai_criteria',
      checkTarget: 'impact',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Specify EXTENT (the "IS/IS NOT" magnitude dimension): the candidate must determine how big the problem is — how many users affected, how often it occurs, and the severity of impact. Assessment criteria: (1) asks how many users or systems are affected; (2) asks how severe the impact is — completely blocked vs. minor inconvenience; (3) asks how often the problem occurs (once, repeatedly, constantly); (4) uses the extent information to inform priority and urgency. A good example: "How many people are affected by this? Is it completely blocking your work or is there a workaround? How often does it happen?" A poor example: Not assessing the extent of the problem, or treating a one-user issue the same as a company-wide outage.',
    },
    {
      id: 'kt_identify_changes',
      label: 'Identified recent changes — Did the candidate ask what changed before the problem started? Change analysis is the most reliable way to identify root cause.',
      weight: 10,
      critical: false,
      category: 'root_cause',
      checkType: 'ai_criteria',
      checkTarget: 'recent_changes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Identify Changes: "What changed?" is the most powerful question in root cause analysis. Problems are almost always caused by a change — a configuration change, an update, a hardware change, a process change. Assessment criteria: (1) asks what changed before the problem started — updates, installations, configuration changes, password changes; (2) asks about changes the user might not think to mention — "Has anyone made any changes to your account or computer recently?"; (3) asks about changes in the surrounding environment — network, server, other users; (4) correlates the timing of changes with the timing of the problem. A good example: "Did anything change before this started — any Windows updates, software installations, or settings changes? What about on your account or the network?" A poor example: Not asking about changes, or accepting "nothing changed" without probing.',
    },
    {
      id: 'kt_test_causes',
      label: 'Tested possible causes before acting — Did the candidate test potential causes before implementing a fix, rather than jumping to the most obvious solution?',
      weight: 10,
      critical: false,
      category: 'root_cause',
      checkType: 'ai_criteria',
      checkTarget: 'kt_test_causes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Test Possible Causes: the candidate should generate hypotheses about what could be causing the problem and test them before implementing a fix. Assessment criteria: (1) generates possible causes based on the IS/IS NOT analysis; (2) tests causes in a logical order — most likely first, easiest to check first; (3) does not jump to the most obvious solution without testing; (4) the test is designed to confirm or eliminate the cause, not just go through motions. A good example: "There are a few things that could cause \'Working Offline\' in Outlook. Let me check the simplest one first — whether the Work Offline toggle is enabled. If that\'s not it, I\'ll check the network connection status." A poor example: Jumping straight to "Let me rebuild your Outlook profile" without checking the Work Offline setting first.',
    },
    {
      id: 'kt_confirm_root_cause',
      label: 'Confirmed root cause with evidence — Did the candidate confirm that the fix actually resolves the root cause, and that the documented cause is supported by evidence?',
      weight: 10,
      critical: false,
      category: 'root_cause',
      checkType: 'ai_criteria',
      checkTarget: 'kt_confirm_root_cause',
      passIf: 'pass_or_partial',
      evidenceDescription: 'KT Problem Analysis — Confirm True Cause: the identified root cause must be verified. Assessment criteria: (1) the candidate can explain why they believe the identified cause is the actual root cause; (2) the cause must explain all the facts in the IS column and not contradict the IS NOT column; (3) the fix must actually resolve the problem — verification is part of confirmation; (4) the candidate documents the root cause, not just the fix. A good example: "The root cause was that the Outlook client was stuck in offline mode. I confirmed this by checking the status bar, and the fix — disabling Work Offline — immediately resolved the issue. The user confirmed they can now send and receive emails." A poor example: "I fixed it" with no documented root cause, or claiming a root cause that doesn\'t explain all the symptoms.',
    },
  ],
};
