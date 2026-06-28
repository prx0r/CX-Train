import type { TemplateId, DifficultyLevel } from '../workspace/types';

export interface HiringPack {
  id: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  templateId: TemplateId;
  customer: {
    name: string;
    company: string;
    role: string;
    temperament: string;
    openingLine: string;
    issue: string;
  };
  hiddenFacts: Record<string, unknown>;
}

export const HIRING_PACKS: Record<string, HiringPack> = {
  'hiring-outlook-basic': {
    id: 'hiring-outlook-basic',
    title: 'Outlook Not Sending',
    description: 'Customer cannot send emails from Outlook. Tests basic communication and diagnosis.',
    difficulty: 'basic',
    templateId: 'hiring_basic',
    customer: {
      name: 'Sarah Thompson',
      company: 'Northvale Dental',
      role: 'Practice Manager',
      temperament: 'stressed',
      openingLine: "Hi, I'm having trouble with my Outlook — it's not sending emails. I really need to get this sorted quickly.",
      issue: 'Outlook stuck in offline mode after a password change',
    },
    hiddenFacts: {
      hostname: 'NVDT-LT-045',
      workaround: 'Outlook Web App works fine',
      recentChange: 'IT reset the domain password yesterday',
    },
  },
  'hiring-vpn-triage': {
    id: 'hiring-vpn-triage',
    title: 'VPN Connection Issue',
    description: 'Customer cannot connect to VPN after update. Tests triage and scope isolation.',
    difficulty: 'intermediate',
    templateId: 'hiring_with_triage',
    customer: {
      name: 'James Carter',
      company: 'Alder & Co Solicitors',
      role: 'Solicitor',
      temperament: 'frustrated',
      openingLine: "I can't connect to the VPN since the update last night. I have a client meeting in an hour.",
      issue: 'VPN client version mismatch after Windows update',
    },
    hiddenFacts: {
      vpnClient: 'OpenConnect v3.1',
      osVersion: 'Windows 11 24H2',
      workaround: 'Browser-based portal access works',
      recentChange: 'Windows Update KB5053651 installed automatically',
    },
  },
  'hiring-printer-down': {
    id: 'hiring-printer-down',
    title: 'Printer Not Working',
    description: 'Customer cannot print to a network printer. Tests troubleshooting and remote diagnostics.',
    difficulty: 'advanced',
    templateId: 'hiring_with_remote',
    customer: {
      name: 'Maria Costa',
      company: 'Brighton Community Health',
      role: 'Receptionist',
      temperament: 'anxious',
      openingLine: "The main reception printer has stopped working. Patients are waiting and I need this fixed urgently.",
      issue: 'Printer queue is stalled after a paper jam was cleared incorrectly',
    },
    hiddenFacts: {
      printerModel: 'HP LaserJet Pro M404dn',
      ipAddress: '10.0.15.42',
      errorDisplayed: 'Access Denied — unable to connect',
      workaround: 'USB-connected backup printer in back office works',
      recentChange: 'Paper jam cleared by staff this morning',
    },
  },
  'hiring-email-phishing': {
    id: 'hiring-email-phishing',
    title: 'Suspicious Email Reported',
    description: 'Customer received a suspicious email and reported it. Tests security awareness and escalation judgement.',
    difficulty: 'expert',
    templateId: 'hiring_full',
    customer: {
      name: 'David Chen',
      company: 'Meridian Finance',
      role: 'Financial Analyst',
      temperament: 'worried',
      openingLine: "I got an email that looks like it's from the CEO asking me to transfer funds urgently. I didn't click anything but I'm worried.",
      issue: 'Potential phishing email targeting finance department',
    },
    hiddenFacts: {
      senderDisplay: 'CEO Sarah Mitchell <sarah.mitchell@meridian-finance.com>',
      actualSender: 's.mitchell@meridian-f1nance.com (typo-squatted domain)',
      emailSubject: 'Urgent: Vendor Payment Required Today',
      targetSystems: 'Company finance system (Xero)',
      otherStaffReceived: 'Three other analysts in finance also reported it',
    },
  },
};

export function getHiringPack(packId: string): HiringPack | null {
  return HIRING_PACKS[packId] || null;
}

export function listHiringPacks(): HiringPack[] {
  return Object.values(HIRING_PACKS);
}

export function defaultHiringPack(): HiringPack {
  return HIRING_PACKS['hiring-outlook-basic'];
}

export function hiringPacksByDifficulty(difficulty: DifficultyLevel): HiringPack[] {
  return Object.values(HIRING_PACKS).filter(p => p.difficulty === difficulty);
}
