import { FrameworkDefinition } from '../evaluator';

/**
 * NCSC Cyber Essentials — UK Government Cyber Security Scheme
 *
 * Source: NCSC (ncsc.gov.uk/cyberessentials) and IASME (iasme.co.uk)
 *
 * Five exact technical controls. These are ORGANISATIONAL controls —
 * they assess whether the MSP has implemented security measures, not
 * whether an individual technician performs them on a single call.
 *
 * The `observableInCall` flag on each criterion indicates whether the
 * criterion can be meaningfully assessed from a single support call
 * transcript. Controls marked observableInCall: false are stored for
 * completeness of the standard but excluded from per-call scoring.
 */
export const CYBER_ESSENTIALS_2025: FrameworkDefinition = {
  id: 'cyber_essentials_2025',
  name: 'Cyber Essentials 2025',
  version: '2025',
  type: 'compliance_standard',
  category: 'security',
  passThreshold: 70,
  weight: 0.3,
  description: 'NCSC Cyber Essentials — all 5 technical controls as defined by the UK National Cyber Security Centre. Controls are organisational-level. Call-assessable sub-criteria are marked observableInCall.',
  standardsAlignments: ['NCSC Cyber Essentials (5 controls)', 'IASME Cyber Essentials Requirements Version Danzell (2025)'],
  criteria: [
    {
      id: 'ce_firewalls',
      label: 'Firewalls — Does the organisation use a firewall to protect its internet connection?',
      weight: 10,
      critical: false,
      category: 'firewall',
      observableInCall: false,
      checkType: 'ai_criteria',
      checkTarget: 'ce_firewalls',
      passIf: 'pass_or_partial',
      evidenceDescription: 'NCSC Cyber Essentials — Firewalls control. Official requirement: "A firewall must be used to secure the internet connection." The assessment questions ask: "Do you have a firewall in place to protect your internet connection? Is your firewall configured to block unauthorised access? Are firewall rules documented and approved?" This is an organisational control — not assessable from a single call. However, a candidate who recommends disabling firewalls during troubleshooting demonstrates organisational risk awareness.',
    },
    {
      id: 'ce_secure_config',
      label: 'Secure Configuration — Are computers and devices configured securely, minimising vulnerabilities?',
      weight: 10,
      critical: false,
      category: 'secure_configuration',
      observableInCall: false,
      checkType: 'ai_criteria',
      checkTarget: 'ce_secure_config',
      passIf: 'pass_or_partial',
      evidenceDescription: 'NCSC Cyber Essentials — Secure Configuration control. Official requirement: "Set up computers securely to minimise ways that a cyber-criminal can find a way in." Assessment questions ask: "Are default passwords changed? Are unnecessary user accounts removed? Is multi-factor authentication enabled where possible?" This is an organisational control — not directly assessable from a single call.',
    },
    {
      id: 'ce_user_access_control',
      label: 'User Access Control — Does the organisation control who can access its data and services?',
      weight: 10,
      critical: true,
      category: 'access_control',
      observableInCall: false,
      checkType: 'ai_criteria',
      checkTarget: 'identity_check',
      passIf: 'pass',
      evidenceDescription: 'NCSC Cyber Essentials — User Access Control. Official requirement: "Control who can access your data and services and what level of access they have." Assessment questions ask: "Are user accounts individual? Is access reviewed periodically? Are admin accounts controlled?" This is organisational. Call-observable proxy: on a support call, the candidate should verify caller identity before disclosing information or making changes.',
    },
    {
      id: 'ce_malware_protection',
      label: 'Malware Protection — Does the organisation use anti-malware software and keep it up to date?',
      weight: 10,
      critical: false,
      category: 'malware_protection',
      observableInCall: false,
      checkType: 'ai_criteria',
      checkTarget: 'ce_malware_awareness',
      passIf: 'pass_or_partial',
      evidenceDescription: 'NCSC Cyber Essentials — Malware Protection control. Official requirement: "Identify and immobilise viruses or other malicious software before it has a chance to cause harm." Assessment questions ask: "Is anti-malware software installed on all computers? Is it kept up to date? Are scans scheduled?" This is organisational. Call-observable proxy: candidate should consider malware as a possible cause when symptoms warrant it.',
    },
    {
      id: 'ce_security_update_management',
      label: 'Security Update Management — Does the organisation keep software and devices up to date with security patches?',
      weight: 10,
      critical: false,
      category: 'update_management',
      observableInCall: false,
      checkType: 'ai_criteria',
      checkTarget: 'recent_changes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'NCSC Cyber Essentials — Security Update Management. Official requirement: "Prevent cyber criminals using vulnerabilities they find in software as an access point to your systems." Assessment questions ask: "Are security updates applied within 14 days? Is automatic updating enabled? Are unsupported products avoided?" This is organisational. Call-observable proxy: candidate should ask about recent updates when diagnosing issues.',
    },
  ],
};
