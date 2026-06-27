/**
 * Pack-Level Compliance Relevance Mapping
 *
 * Each pack defines which compliance framework criteria are RELEVANT to that
 * scenario. Criteria not listed here are marked `not_applicable` and do not
 * affect the score.
 *
 * This solves the "unfair malware fail on a password reset" problem.
 * The pack author explicitly chooses which criteria their scenario exercises.
 */

export interface PackRelevanceMap {
  [packId: string]: {
    [frameworkId: string]: string[];  // criteria IDs that are relevant
  };
}

export const PACK_COMPLIANCE_RELEVANCE: PackRelevanceMap = {

  'pack-outlook-sim-v2': {
    callum_baseline_v1: [
      'submitted_ticket', 'performed_triage', 'safety', 'next_steps',
      'identity_check', 'company_check', 'customer_tone', 'customer_communication',
      'issue_clarification', 'started_when', 'impact', 'urgency', 'scope',
      'error_or_status_capture', 'recent_changes', 'technical_discovery',
      'escalation_judgement',
      'ticket_user_company', 'ticket_issue_summary', 'ticket_impact', 'ticket_urgency',
      'ticket_checks_attempted', 'ticket_next_step',
    ],
    cyber_essentials_2025: [
      'ce_access_control',
      'ce_unauthorized_access',
      'ce_patch_awareness',
    ],
    gdpr_2018: [
      'gdpr_identity_verified',
      'gdpr_data_minimization',
    ],
    iso_27001_2022: [
      'iso_access_control',
      'iso_incident_management',
      'iso_patch_management',
      'iso_escalation',
      'iso_classification',
    ],
  },

  'pack-password-reset-v1': {
    callum_baseline_v1: [
      'submitted_ticket', 'performed_triage', 'safety', 'next_steps',
      'identity_check', 'company_check', 'customer_tone', 'customer_communication',
      'issue_clarification', 'started_when', 'impact', 'urgency', 'scope',
      'error_or_status_capture', 'recent_changes', 'technical_discovery',
      'escalation_judgement',
      'ticket_user_company', 'ticket_issue_summary', 'ticket_impact', 'ticket_urgency',
      'ticket_checks_attempted', 'ticket_next_step',
    ],
    cyber_essentials_2025: [
      'ce_access_control',
      'ce_unauthorized_access',
      'ce_patch_awareness',
      'ce_documentation',
    ],
    gdpr_2018: [
      'gdpr_identity_verified',
      'gdpr_data_minimization',
      'gdpr_no_data_sharing',
      'gdpr_documentation',
    ],
    iso_27001_2022: [
      'iso_access_control',
      'iso_incident_management',
      'iso_patch_management',
      'iso_escalation',
      'iso_classification',
      'iso_records_protection',
    ],
  },

  'pack-new-starter-v1': {
    callum_baseline_v1: [
      'submitted_ticket', 'performed_triage', 'safety', 'next_steps',
      'identity_check', 'company_check',
      'issue_clarification', 'impact',
      'customer_tone', 'customer_communication',
      'escalation_judgement',
      'ticket_user_company', 'ticket_issue_summary', 'ticket_impact',
      'ticket_checks_attempted', 'ticket_next_step',
    ],
    cyber_essentials_2025: [
      'ce_access_control',
      'ce_unauthorized_access',
      'ce_documentation',
    ],
    gdpr_2018: [
      'gdpr_identity_verified',
      'gdpr_data_minimization',
      'gdpr_documentation',
    ],
    iso_27001_2022: [
      'iso_access_control',
      'iso_incident_management',
      'iso_classification',
      'iso_records_protection',
    ],
  },

  'pack-shared-mailbox-v1': {
    callum_baseline_v1: [
      'submitted_ticket', 'performed_triage', 'safety', 'next_steps',
      'identity_check', 'company_check',
      'issue_clarification', 'impact', 'urgency', 'scope',
      'customer_tone', 'customer_communication',
      'escalation_judgement',
      'ticket_user_company', 'ticket_issue_summary', 'ticket_impact',
      'ticket_checks_attempted', 'ticket_next_step',
    ],
    cyber_essentials_2025: [
      'ce_access_control',
      'ce_unauthorized_access',
      'ce_patch_awareness',
    ],
    gdpr_2018: [
      'gdpr_identity_verified',
      'gdpr_data_minimization',
      'gdpr_no_data_sharing',
      'gdpr_documentation',
    ],
    iso_27001_2022: [
      'iso_access_control',
      'iso_incident_management',
      'iso_classification',
      'iso_records_protection',
      'iso_security_awareness',
    ],
  },
};

export function getRelevantCriteria(packId: string | null, frameworkId: string): string[] | null {
  if (!packId) return null;
  const packMap = PACK_COMPLIANCE_RELEVANCE[packId];
  if (!packMap) return null;
  const criteria = packMap[frameworkId];
  // If framework is not listed for this pack, return [] (none relevant) — not null (all relevant)
  return criteria || [];
}
