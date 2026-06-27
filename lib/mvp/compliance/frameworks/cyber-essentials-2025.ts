import { FrameworkDefinition } from '../evaluator';

export const CYBER_ESSENTIALS_2025: FrameworkDefinition = {
  id: 'cyber_essentials_2025',
  name: 'Cyber Essentials 2025',
  version: '2025',
  type: 'compliance_standard',
  category: 'security',
  passThreshold: 80,
  weight: 0.3,
  description: 'UK government-backed cyber security certification. Five technical controls: firewalls, secure configuration, access control, malware protection, patch management.',
  standardsAlignments: ['NCSC Cyber Essentials', 'ISO 27001 A.5.15'],
  criteria: [
    {
      id: 'ce_access_control', label: 'User access control verified', weight: 10, critical: true, category: 'access_control',
      checkType: 'ai_criteria', checkTarget: 'identity_check', passIf: 'pass',
      evidenceDescription: 'Candidate verified caller identity — maps to identity_check criterion',
    },
    {
      id: 'ce_unauthorized_access', label: 'No unauthorized access granted', weight: 10, critical: true, category: 'access_control',
      checkType: 'action_not_performed', checkTarget: 'red_flag_triggered', passIf: 'pass',
      evidenceDescription: 'Candidate did not perform any red-flagged unauthorized actions',
    },
    {
      id: 'ce_patch_awareness', label: 'Patch / update awareness', weight: 10, critical: true, category: 'security',
      checkType: 'ai_criteria', checkTarget: 'recent_changes', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked about recent changes — maps to recent_changes criterion',
    },
    {
      id: 'ce_secure_config', label: 'Secure configuration awareness', weight: 10, critical: false, category: 'security',
      checkType: 'transcript_keyword', checkTarget: 'firewall|network security|secure config|admin account|default password|could compromise',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate mentioned or asked about security configuration',
    },
    {
      id: 'ce_malware_awareness', label: 'Malware protection awareness', weight: 5, critical: false, category: 'security',
      checkType: 'transcript_keyword', checkTarget: 'antivirus|malware|virus|endpoint protection|anti-virus',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate mentioned malware/antivirus in investigation',
    },
    {
      id: 'ce_documentation', label: 'Security-relevant findings documented', weight: 5, critical: false, category: 'documentation',
      checkType: 'ticket_field', checkTarget: 'secure', passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate documented security-relevant observations in ticket',
    },
    {
      id: 'ce_supply_chain', label: 'Considered external factors', weight: 5, critical: false, category: 'security',
      checkType: 'transcript_keyword', checkTarget: 'third party|vendor|external|isp|microsoft|azure|office 365',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Candidate asked about external services or vendors involved',
    },
  ],
};
