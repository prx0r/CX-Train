import { FrameworkDefinition } from '../evaluator';

/**
 * NCSC Cyber Essentials — UK Government Cyber Security Scheme
 *
 * Source: NCSC (ncsc.gov.uk/cyberessentials) and IASME (iasme.co.uk)
 * Requirements freely available as PDF downloads. £320+VAT for certification.
 *
 * Five technical controls that organizations must implement. For call scoring,
 * we assess whether the candidate demonstrates awareness and application of
 * these controls during support interactions — not whether the organization
 * has them, but whether the individual acts in accordance with them.
 */
export const CYBER_ESSENTIALS_2025: FrameworkDefinition = {
  id: 'cyber_essentials_2025',
  name: 'Cyber Essentials 2025',
  version: '2025',
  type: 'compliance_standard',
  category: 'security',
  passThreshold: 70,
  weight: 0.3,
  description: 'NCSC Cyber Essentials — five technical controls adapted for individual call assessment. Measures whether the candidate acts in accordance with these controls during support interactions.',
  standardsAlignments: ['NCSC Cyber Essentials', 'IASME Cyber Essentials Requirements'],
  criteria: [
    {
      id: 'ce_access_control',
      label: 'User access control — Did the candidate verify identity before granting access, changing settings, or disclosing information?',
      weight: 10,
      critical: true,
      category: 'access_control',
      checkType: 'ai_criteria',
      checkTarget: 'identity_check',
      passIf: 'pass',
      evidenceDescription: 'Cyber Essentials "User Access Control" requirement — assessment adapted for call handling. The candidate must verify the caller\'s identity before performing any account actions, resetting passwords, or disclosing sensitive information. Assessment criteria: (1) asks for identifying information before proceeding — name, employee ID, or other verifiable detail; (2) does not proceed with account changes until identity is reasonably confirmed; (3) uses appropriate verification methods for the sensitivity of the request — password resets require more verification than general enquiries; (4) if identity cannot be confirmed, the candidate does not proceed and escalates appropriately. This maps to the Cyber Essentials principle of "user accounts must be individual" and "access must be controlled." A good example: "Before I can reset your password, I need to verify your identity. Can you confirm your full name, employee ID, and date of birth?" A poor example: Proceeding with a password reset without any identity check, or asking "Is that you, John?" and taking the caller\'s word for it.',
    },
    {
      id: 'ce_unauthorized_access',
      label: 'No unauthorized access — Did the candidate avoid granting access to someone who should not have it, or performing actions that bypass security controls?',
      weight: 10,
      critical: true,
      category: 'access_control',
      checkType: 'action_not_performed',
      checkTarget: 'red_flag_triggered',
      passIf: 'pass',
      evidenceDescription: 'Cyber Essentials "User Access Control" requirement — no unauthorized access granted. The candidate must not perform any action that could grant unauthorized access, bypass security controls, or circumvent normal authentication. Assessment criteria: (1) does not share passwords, MFA codes, or temporary credentials over unsecured channels; (2) does not create accounts or grant permissions without proper authorization; (3) does not disable or bypass security controls to solve a problem; (4) does not access systems or data they are not authorized to access. This is a critical control — any violation results in automatic failure. A good example: Candidate refuses to read out a temporary password over the phone and instead sends it via the approved secure channel. A poor example: Candidate reads out a temp password, shares MFA codes, or creates an account without going through proper approval.',
    },
    {
      id: 'ce_patch_awareness',
      label: 'Patch management awareness — Did the candidate consider whether missing patches or outdated software could be contributing to the issue?',
      weight: 10,
      critical: false,
      category: 'security',
      checkType: 'ai_criteria',
      checkTarget: 'recent_changes',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Cyber Essentials "Patch Management" requirement — awareness adapted for call handling. The candidate should consider whether missing updates could be relevant to the issue. Assessment criteria: (1) asks about recent updates or changes that might have triggered the problem; (2) checks whether the affected system or software is up to date; (3) considers patch status as part of diagnosis where relevant; (4) does not recommend disabling automatic updates as a workaround. A good example: "Did Windows run any updates recently? Sometimes a pending update can cause Outlook to behave unexpectedly." A poor example: "Just disable automatic updates, they always cause problems."',
    },
    {
      id: 'ce_secure_config',
      label: 'Secure configuration awareness — Did the candidate avoid recommending or making changes that would weaken the security configuration of a device or system?',
      weight: 10,
      critical: false,
      category: 'security',
      checkType: 'transcript_keyword',
      checkTarget: 'firewall|network security|secure config|admin account|default password|could compromise',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Cyber Essentials "Secure Configuration" requirement — the candidate must demonstrate awareness that default passwords must be changed, unnecessary services disabled, and admin privileges controlled. Assessment criteria: (1) does not suggest using default passwords or leaving default configurations unchanged; (2) does not suggest disabling security features (firewall, antivirus, UAC) to fix an issue; (3) suggests checking secure configuration as a diagnostic step when relevant; (4) considers whether configuration drift could be causing the problem. A good example: "Let me check if the firewall settings might have been changed recently — that could explain the connectivity loss." A poor example: "Just turn off the firewall to see if that helps."',
    },
    {
      id: 'ce_malware_awareness',
      label: 'Malware protection awareness — Did the candidate consider malware as a possible cause and avoid recommending actions that would weaken malware protection?',
      weight: 5,
      critical: false,
      category: 'security',
      checkType: 'transcript_keyword',
      checkTarget: 'antivirus|malware|virus|endpoint protection|anti-virus',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Cyber Essentials "Malware Protection" requirement — adapted for call handling. The candidate should consider malware as a potential cause when symptoms suggest it (slow performance, pop-ups, unexpected behaviour) and must never recommend disabling antivirus or malware protection. Assessment criteria: (1) asks about antivirus or malware protection status when symptoms warrant it; (2) does not suggest turning off antivirus to "see if it helps"; (3) considers running a scan as a diagnostic step where appropriate; (4) recognises common malware symptoms. A good example: "Have you noticed any pop-ups or unexpected behaviour aside from the slowness? It might be worth running a quick antivirus scan." A poor example: "Just disable your antivirus, it slows everything down anyway."',
    },
    {
      id: 'ce_documentation',
      label: 'Security-relevant findings documented — Did the candidate document security-relevant observations, such as configuration issues or potential vulnerabilities found?',
      weight: 5,
      critical: false,
      category: 'documentation',
      checkType: 'ticket_field',
      checkTarget: 'secure',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Cyber Essentials supporting practice — security-relevant findings should be documented in the ticket. If the candidate discovers a security configuration issue, potential vulnerability, or suspicious activity, they should record it in the ticket. Assessment criteria: (1) the ticket note includes any security-relevant observations made during the call; (2) if a potential security issue was identified, it is clearly documented; (3) the ticket is not misleading about the security state of the affected system. A good example: "Note: User\'s firewall was found to be disabled. Re-enabled and confirmed protection is active." A poor example: Failing to mention that the firewall was disabled or that an admin account had default credentials. Not applicable if no security findings were made.',
    },
    {
      id: 'ce_supply_chain',
      label: 'Considered external factors — Did the candidate consider whether external services, third-party vendors, or supply chain dependencies could be involved in the issue?',
      weight: 5,
      critical: false,
      category: 'security',
      checkType: 'transcript_keyword',
      checkTarget: 'third party|vendor|external|isp|microsoft|azure|office 365',
      passIf: 'pass_or_partial',
      evidenceDescription: 'Cyber Essentials supplementary — consideration of external dependencies. The candidate should consider whether the issue might involve external services, third-party vendors, or supply chain dependencies that could affect security or availability. Assessment criteria: (1) asks about external services when relevant — "Is your DNS managed externally?", "Do you use a third-party email filter?"; (2) considers whether a broader outage or vendor issue could be the cause; (3) does not assume everything is internal. This is particularly relevant for cloud services, SaaS platforms, and managed infrastructure. A good example: "Let me check if there\'s a known issue with Microsoft 365 right now, since the symptoms suggest a service-side problem rather than a local one." A poor example: Assuming the problem is always the user\'s device without considering cloud service status.',
    },
  ],
};
