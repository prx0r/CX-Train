import { FrameworkDefinition } from '../evaluator';

/**
 * NCSC Cyber Essentials — UK Government Cyber Security Scheme
 *
 * Source: NCSC (ncsc.gov.uk/cyberessentials) and IASME (iasme.co.uk)
 * Requirements freely available.
 *
 * Five exact technical controls defined by NCSC. For call scoring, we assess
 * whether the candidate demonstrates awareness and application of these
 * controls during support interactions — not whether the organization has
 * them, but whether the individual acts in accordance with them.
 *
 * The 5 NCSC controls:
 *   1. Firewalls
 *   2. Secure Configuration
 *   3. User Access Control
 *   4. Malware Protection
 *   5. Security Update Management
 */
export const CYBER_ESSENTIALS_2025: FrameworkDefinition = {
  id: 'cyber_essentials_2025',
  name: 'Cyber Essentials 2025',
  version: '2025',
  type: 'compliance_standard',
  category: 'security',
  passThreshold: 70,
  weight: 0.3,
  description: 'NCSC Cyber Essentials — the 5 exact technical controls adapted for individual call assessment. Measures whether the candidate acts in accordance with: Firewalls, Secure Configuration, User Access Control, Malware Protection, and Security Update Management.',
  standardsAlignments: ['NCSC Cyber Essentials (5 controls)', 'IASME Cyber Essentials Requirements'],
  criteria: [
    {
      id: 'ce_firewalls',
      label: 'Firewalls — Did the candidate consider firewall or network security settings as a potential cause, and avoid recommending that firewalls be disabled?',
      weight: 10,
      critical: false,
      category: 'firewall',
      checkType: 'ai_criteria',
      checkTarget: 'ce_firewalls',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Cyber Essentials "Firewalls" control: a firewall must be used to secure internet connections. Adapted for call handling: the candidate should consider whether a firewall, network filter, or security appliance could be blocking connectivity, and must never recommend disabling firewalls as a troubleshooting step. Assessment criteria: (1) considers firewall or network security settings when symptoms suggest a block (connectivity loss, port-specific issues, email not sending); (2) checks whether firewall rules could have changed; (3) does not suggest turning off the firewall or disabling security filters to "test" connectivity; (4) knows how to check firewall status without disabling it. A good example: "Let me check if the Windows firewall might be blocking Outlook. I can verify the rules without disabling it." A poor example: "Just turn off the firewall to see if that helps — you can turn it back on later."',
    },
    {
      id: 'ce_secure_config',
      label: 'Secure Configuration — Did the candidate avoid recommending or making changes that would weaken the security configuration of a device or system?',
      weight: 10,
      critical: false,
      category: 'secure_configuration',
      checkType: 'ai_criteria',
      checkTarget: 'ce_secure_config',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Cyber Essentials "Secure Configuration" control: computers and devices must be configured securely, minimising vulnerabilities. Adapted for call handling: the candidate must not suggest weakening security to fix an issue, and should check configuration as a diagnostic step. Assessment criteria: (1) does not suggest using default passwords or leaving default configurations; (2) does not suggest disabling security features to resolve an issue; (3) checks secure configuration as a diagnostic step when relevant; (4) considers whether configuration drift could be causing the problem. A good example: "Let me check if the firewall settings changed recently — that could explain the connectivity loss." A poor example: "Just disable the firewall, UAC, and antivirus to see if that helps."',
    },
    {
      id: 'ce_access_control',
      label: 'User Access Control — Did the candidate verify identity before granting access, changing settings, or disclosing information?',
      weight: 10,
      critical: true,
      category: 'access_control',
      checkType: 'ai_criteria',
      checkTarget: 'identity_check',
      passIf: 'pass',
      evidenceDescription: 'Cyber Essentials "User Access Control" control: user accounts must be individual, and access must be controlled. Adapted for call handling: the candidate must verify the caller\'s identity before performing account actions, resetting passwords, or disclosing sensitive information. Assessment criteria: (1) asks for identifying information before proceeding — name, employee ID, or other verifiable detail; (2) does not proceed with account changes until identity is confirmed; (3) uses appropriate verification for the sensitivity of the request — password resets require more verification than general enquiries; (4) if identity cannot be confirmed, does not proceed and escalates appropriately. A good example: "Before I can reset your password, I need to verify your identity. Can you confirm your full name and employee ID?" A poor example: Proceeding with a password reset without any identity check.',
    },
    {
      id: 'ce_unauthorized_access',
      label: 'No Unauthorized Access — Did the candidate avoid granting access to someone who should not have it, or bypassing security controls?',
      weight: 10,
      critical: true,
      category: 'access_control',
      checkType: 'action_not_performed',
      checkTarget: 'red_flag_triggered',
      passIf: 'pass',
      evidenceDescription: 'Cyber Essentials "User Access Control" — no unauthorized access granted. The candidate must not perform any action that could grant unauthorized access, bypass security controls, or circumvent authentication. Assessment criteria: (1) does not share passwords, MFA codes, or temporary credentials over unsecured channels; (2) does not create accounts or grant permissions without proper authorization; (3) does not disable or bypass security controls to solve a problem; (4) does not access systems or data they are not authorized to access. A good example: Candidate refuses to read out a temporary password over the phone and instead sends it via the approved secure channel. A poor example: Candidate reads out a temp password or shares MFA codes.',
    },
    {
      id: 'ce_malware_awareness',
      label: 'Malware Protection — Did the candidate consider malware as a possible cause and avoid recommending actions that would weaken malware protection?',
      weight: 10,
      critical: false,
      category: 'malware_protection',
      checkType: 'ai_criteria',
      checkTarget: 'ce_malware_awareness',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Cyber Essentials "Malware Protection" control: anti-malware software must be used and kept up to date. Adapted for call handling: the candidate should consider malware as a potential cause when symptoms suggest it, and must never recommend disabling antivirus or malware protection. Assessment criteria: (1) asks about antivirus or malware protection status when symptoms warrant it (slow performance, pop-ups, unexpected behaviour); (2) does not suggest turning off antivirus to troubleshoot; (3) considers running a scan as a diagnostic step where appropriate; (4) recognises common malware symptoms. A good example: "Have you noticed any pop-ups or unexpected behaviour? It might be worth running a quick antivirus scan." A poor example: "Just disable your antivirus, it slows everything down."',
    },
    {
      id: 'ce_security_update_management',
      label: 'Security Update Management — Did the candidate consider whether missing patches or outdated software could be contributing to the issue?',
      weight: 10,
      critical: false,
      category: 'update_management',
      checkType: 'ai_criteria',
      checkTarget: 'recent_changes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Cyber Essentials "Security Update Management" control: software must be kept up to date with security patches. Adapted for call handling: the candidate should consider whether missing updates could be relevant to the issue. Assessment criteria: (1) asks about recent updates or changes that might have triggered the problem; (2) checks whether the affected system or software is up to date; (3) considers patch status as part of diagnosis where relevant; (4) does not recommend disabling automatic updates as a workaround. A good example: "Did Windows run any updates recently? Sometimes a pending update can cause Outlook to behave unexpectedly." A poor example: "Just disable automatic updates, they always cause problems."',
    },
  ],
};
