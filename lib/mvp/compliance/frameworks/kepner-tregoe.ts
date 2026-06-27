import { FrameworkDefinition } from '../evaluator';

export const KEPNER_TREGOE: FrameworkDefinition = {
  id: 'kepner_tregoe',
  name: 'Kepner-Tregoe Problem Analysis',
  version: '1.0',
  type: 'skills_framework',
  category: 'technical_troubleshooting',
  passThreshold: 70,
  weight: 1.0,
  description: 'Kepner-Tregoe rational problem analysis method. Assesses structured diagnostic thinking: define the problem, specify scope, establish timing, identify changes, test causes, confirm root cause.',
  standardsAlignments: ['Kepner-Tregoe Problem Analysis', 'ITIL 4 Problem Management'],
  criteria: [
    {
      id: 'kt_define_problem', label: 'Defined the problem clearly', weight: 10, critical: false, category: 'problem_definition',
      checkType: 'ai_criteria', checkTarget: 'kt_define_problem', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate articulated what IS happening vs what IS NOT happening',
    },
    {
      id: 'kt_establish_scope', label: 'Established scope of the issue', weight: 10, critical: false, category: 'problem_definition',
      checkType: 'ai_criteria', checkTarget: 'scope', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked WHERE the issue occurs and WHERE it does not',
    },
    {
      id: 'kt_establish_timing', label: 'Established when the issue started', weight: 10, critical: false, category: 'problem_definition',
      checkType: 'ai_criteria', checkTarget: 'started_when', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked WHEN the issue began and WHEN it does NOT occur',
    },
    {
      id: 'kt_determine_extent', label: 'Determined how many affected', weight: 10, critical: false, category: 'problem_definition',
      checkType: 'ai_criteria', checkTarget: 'scope', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked how many users are affected (one vs many)',
    },
    {
      id: 'kt_identify_changes', label: 'Identified recent changes', weight: 10, critical: false, category: 'root_cause',
      checkType: 'ai_criteria', checkTarget: 'recent_changes', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked what changed before the problem started',
    },
    {
      id: 'kt_test_causes', label: 'Tested possible causes before acting', weight: 10, critical: false, category: 'root_cause',
      checkType: 'ai_criteria', checkTarget: 'kt_test_causes', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate tested potential causes before implementing a fix, did not jump to conclusions',
    },
    {
      id: 'kt_confirm_root_cause', label: 'Confirmed root cause with evidence', weight: 10, critical: false, category: 'root_cause',
      checkType: 'ai_criteria', checkTarget: 'kt_confirm_root_cause', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate confirmed the fix addresses the actual root cause, not just symptoms',
    },
  ],
};
