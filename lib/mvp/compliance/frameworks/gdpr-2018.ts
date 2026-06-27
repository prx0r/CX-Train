import { FrameworkDefinition } from '../evaluator';

/**
 * UK GDPR / DPA 2018 — Data Protection Principles
 *
 * Source: ICO (ico.org.uk) — free under Open Government Licence
 * Article 5 UK GDPR: 7 principles of data protection
 *
 * Adapted for IT support call assessment. We measure whether the candidate
 * acts in accordance with these principles during support interactions.
 */
export const GDPR_2018: FrameworkDefinition = {
  id: 'gdpr_2018',
  name: 'GDPR / UK DPA 2018',
  version: '2018',
  type: 'compliance_standard',
  category: 'data_protection',
  passThreshold: 70,
  weight: 0.2,
  description: 'UK GDPR / DPA 2018 data protection principles adapted for IT support call handling. Assesses whether the candidate acts in accordance with data minimisation, access control, confidentiality, and breach awareness.',
  standardsAlignments: ['GDPR Art. 5(1)(c) Data Minimisation', 'GDPR Art. 5(1)(f) Integrity & Confidentiality', 'GDPR Art. 33 Breach Notification'],
  criteria: [
    {
      id: 'gdpr_identity_verified',
      label: 'GDPR Article 5(1)(f) — Identity verified before data access. Did the candidate confirm the caller\'s identity before discussing account details, resetting passwords, or disclosing personal data?',
      weight: 10,
      critical: true,
      category: 'access_control',
      checkType: 'ai_criteria',
      checkTarget: 'identity_check',
      passIf: 'pass',
      evidenceDescription: 'UK GDPR Article 5(1)(f) — Integrity and Confidentiality principle: personal data must be processed securely. For service desks, this means confirming the caller\'s identity before disclosing any personal data, discussing account details, or performing account changes. Assessment criteria: (1) verifies identity through appropriate means before disclosing any personal information; (2) does not rely on the caller simply knowing an email address or account number — uses multiple verification factors for sensitive actions; (3) if identity verification fails, does not proceed; (4) documents the verification method used. A good example: "Before I can discuss your account details or perform a password reset, I need to verify your identity. Can you confirm your full name, employee ID, and your date of birth?" A poor example: Proceeding with a password reset based solely on the caller knowing the account email address, with no additional verification.',
    },
    {
      id: 'gdpr_data_minimization',
      label: 'GDPR Article 5(1)(c) — Data minimisation. Did the candidate only ask for and record personal data that was actually necessary to resolve the issue?',
      weight: 10,
      critical: true,
      category: 'data_protection',
      checkType: 'ai_criteria',
      checkTarget: 'gdpr_data_minimization',
      passIf: 'pass',
      evidenceDescription: 'UK GDPR Article 5(1)(c) — Data Minimisation principle: personal data must be adequate, relevant, and limited to what is necessary. For service desks, the candidate must not ask for or record excessive personal information. Only the minimum data required to resolve the specific issue should be requested. Assessment criteria: (1) asks only for information needed for the specific support request — does not ask for unrelated personal details; (2) does not ask for sensitive data (health information, financial details, protected characteristics) unless directly relevant; (3) if the candidate needs to ask for personal data, they explain why it is needed; (4) does not record unnecessary PII in ticket notes. A good example: For a password reset, the candidate asks only for name, employee ID, and company — they do not ask for home address, phone number, or bank details. A poor example: "I need your full name, date of birth, home address, phone number, and national insurance number to process this password reset."',
    },
    {
      id: 'gdpr_no_data_sharing',
      label: 'GDPR Article 5(1)(f) — No unauthorised data sharing. Did the candidate avoid disclosing personal data to someone who is not authorised to receive it?',
      weight: 10,
      critical: true,
      category: 'data_protection',
      checkType: 'ai_criteria',
      checkTarget: 'gdpr_no_data_sharing',
      passIf: 'pass',
      evidenceDescription: 'UK GDPR Article 5(1)(f) — Integrity and Confidentiality: personal data must not be disclosed to unauthorized parties. The candidate must not share passwords, account credentials, or personal data with anyone who has not been verified as authorized. Assessment criteria: (1) does not read out passwords, PINs, or security codes over the phone; (2) does not discuss account details with anyone who has not been verified; (3) if someone else answers the call, does not proceed until the account holder is on the line; (4) uses secure channels (email, portal) for transmitting sensitive information. A good example: "I\'ve sent the password reset link to the email address we have on file for you. Please check your inbox." A poor example: Reading out a temporary password over the phone: "Your new password is Temp@Pass_8915."',
    },
    {
      id: 'gdpr_ticket_contains_pii',
      label: 'GDPR Article 5(1)(c) — PII handled appropriately in ticket. Did the candidate avoid recording unnecessary personal data in the ticket, and ensure that any PII that was recorded is justified?',
      weight: 5,
      critical: false,
      category: 'data_protection',
      checkType: 'ai_criteria',
      checkTarget: 'gdpr_ticket_contains_pii',
      passIf: 'pass_or_partial',
      evidenceDescription: 'UK GDPR Article 5(1)(c) — Data Minimisation applied to ticket documentation. The ticket note should not contain unnecessary personal data. Assessment criteria: (1) the ticket does not contain excessive personal data beyond what is needed for the service record; (2) sensitive data (passwords, PINs, full financial details) is never recorded in ticket notes; (3) if personal data is recorded, it is clearly justified by the service need; (4) ticket notes use minimal identifying information. A good example: "User verified as Sarah Thompson, emp-4421, Apex Consulting. Password reset sent to registered email." A poor example: "Sarah Thompson, DOB 15/03/1989, lives at 42 Maple Drive London E8 3NP, phone 07700 900482, called about password reset."',
    },
    {
      id: 'gdpr_breach_awareness',
      label: 'GDPR Articles 33-34 — Breach notification awareness. Did the candidate recognise a potential data breach and follow appropriate escalation or reporting procedures?',
      weight: 5,
      critical: false,
      category: 'data_protection',
      checkType: 'ai_criteria',
      checkTarget: 'gdpr_breach_awareness',
      passIf: 'pass_or_partial',
      evidenceDescription: 'UK GDPR Articles 33 and 34 — Personal Data Breach Notification. If the candidate encounters a situation that could involve a data breach (unauthorized access, data loss, phishing, suspicious activity), they must recognise it and escalate appropriately. Assessment criteria: (1) recognises indicators of a potential breach — unusual account activity, unauthorized access, data loss; (2) does not treat security incidents as routine support requests; (3) escalates to the appropriate security team or manager; (4) does not discuss breach details with unauthorized parties. A good example: "This sounds like it could be a security issue — I\'m going to transfer you to our security team who handle these situations." A poor example: Treating a reported account compromise as a routine password reset without flagging it as a potential security incident.',
    },
    {
      id: 'gdpr_documentation',
      label: 'GDPR Article 5(2) — Accountability. Did the candidate document the data protection considerations relevant to the call, including verification performed and any data accessed?',
      weight: 5,
      critical: false,
      category: 'documentation',
      checkType: 'ticket_field',
      checkTarget: 'data',
      passIf: 'pass_or_partial',
      evidenceDescription: 'UK GDPR Article 5(2) — Accountability principle: the organisation must demonstrate compliance. For service desk calls, this means the ticket should document what data was accessed, what verification was performed, and what actions were taken. Assessment criteria: (1) the ticket note includes what verification was performed before accessing data; (2) if personal data was accessed or modified, it is documented; (3) any consent given is recorded; (4) the audit trail is sufficient for a data subject access request or internal review. A good example: "Identity verified via name, employee ID, and DOB. Account unlocked and password reset email sent to registered address. No unnecessary data accessed." A poor example: Ticket is blank or contains only "Password reset done" with no record of verification or data access.',
    },
  ],
};
