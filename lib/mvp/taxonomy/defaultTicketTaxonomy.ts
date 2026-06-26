export interface TaxonomyOption {
  id: string;
  label: string;
  description?: string;
  scoringTags?: string[];
}

export interface SubcategoryNode {
  id: string;
  label: string;
  items?: TaxonomyOption[];
}

export interface CategoryNode {
  id: string;
  label: string;
  subcategories: SubcategoryNode[];
}

export interface ManagerTicketTaxonomy {
  boardOptions?: TaxonomyOption[];
  typeOptions: TaxonomyOption[];
  categoryTree: CategoryNode[];
  impactOptions: TaxonomyOption[];
  urgencyOptions: TaxonomyOption[];
  priorityOptions: TaxonomyOption[];
  causeCodes?: TaxonomyOption[];
  resolutionCodes?: TaxonomyOption[];
  escalationPaths?: TaxonomyOption[];
}

export const DEFAULT_TICKET_TAXONOMY: ManagerTicketTaxonomy = {
  boardOptions: [
    { id: 'tier_1', label: 'Tier 1 — Service Desk', description: 'Front-line support, initial triage and resolution', scoringTags: ['ticket.board.tier1'] },
    { id: 'tier_2', label: 'Tier 2 — Technical Support', description: 'Escalated technical issues requiring deeper expertise', scoringTags: ['ticket.board.tier2'] },
    { id: 'tier_3', label: 'Tier 3 — Engineering / Specialist', description: 'Advanced issues, infrastructure, or vendor escalation', scoringTags: ['ticket.board.tier3'] },
  ],
  typeOptions: [
    { id: 'incident', label: 'Incident', description: 'Service interruption or quality reduction', scoringTags: ['ticket.type.incident'] },
    { id: 'service_request', label: 'Service Request', description: 'Standard request for service or access', scoringTags: ['ticket.type.service_request'] },
    { id: 'change_request', label: 'Change Request', description: 'Planned change requiring approval', scoringTags: ['ticket.type.change_request'] },
  ],

  categoryTree: [
    {
      id: 'software', label: 'Software',
      subcategories: [
        {
          id: 'email', label: 'Email / Messaging',
          items: [
            { id: 'outlook', label: 'Microsoft Outlook', scoringTags: ['ticket.category.email.outlook'] },
            { id: 'teams', label: 'Microsoft Teams', scoringTags: ['ticket.category.email.teams'] },
            { id: 'other_email', label: 'Other Email Client', scoringTags: ['ticket.category.email.other'] },
          ],
        },
        {
          id: 'os', label: 'Operating System',
          items: [
            { id: 'windows', label: 'Windows', scoringTags: ['ticket.category.os.windows'] },
            { id: 'mac', label: 'macOS', scoringTags: ['ticket.category.os.mac'] },
          ],
        },
        {
          id: 'business_app', label: 'Business Application',
          items: [
            { id: 'crm', label: 'CRM', scoringTags: ['ticket.category.bizapp.crm'] },
            { id: 'erp', label: 'ERP / Accounting', scoringTags: ['ticket.category.bizapp.erp'] },
          ],
        },
        {
          id: 'other_software', label: 'Other Software',
        },
      ],
    },
    {
      id: 'hardware', label: 'Hardware',
      subcategories: [
        {
          id: 'printer', label: 'Printer / Scanner',
          items: [
            { id: 'network_printer', label: 'Network Printer', scoringTags: ['ticket.category.hardware.printer.network'] },
            { id: 'local_printer', label: 'Local Printer', scoringTags: ['ticket.category.hardware.printer.local'] },
          ],
        },
        {
          id: 'workstation', label: 'Workstation / Laptop',
          items: [
            { id: 'desktop', label: 'Desktop PC', scoringTags: ['ticket.category.hardware.workstation.desktop'] },
            { id: 'laptop', label: 'Laptop', scoringTags: ['ticket.category.hardware.workstation.laptop'] },
          ],
        },
        { id: 'mobile_device', label: 'Mobile Device' },
        { id: 'peripheral', label: 'Peripheral' },
      ],
    },
    {
      id: 'network', label: 'Network',
      subcategories: [
        { id: 'vpn', label: 'VPN / Remote Access' },
        { id: 'wifi', label: 'Wi-Fi / Wireless' },
        { id: 'connectivity', label: 'General Connectivity' },
        { id: 'dns_dhcp', label: 'DNS / DHCP' },
      ],
    },
    {
      id: 'security', label: 'Security',
      subcategories: [
        { id: 'authentication', label: 'Authentication / MFA' },
        { id: 'authorization', label: 'Access / Authorization' },
        { id: 'malware', label: 'Malware / Virus' },
        { id: 'phishing', label: 'Phishing / Suspicious' },
      ],
    },
    {
      id: 'telecom', label: 'Telecom / Voice',
      subcategories: [
        { id: 'phone_system', label: 'Phone System' },
        { id: 'voip', label: 'VoIP' },
        { id: 'mobile_carrier', label: 'Mobile Carrier' },
      ],
    },
  ],

  impactOptions: [
    { id: 'extensive', label: 'Extensive — entire organisation', description: 'Affects all users or critical systems', scoringTags: ['ticket.impact.extensive'] },
    { id: 'large', label: 'Large — multiple departments', description: 'Affects multiple teams or locations', scoringTags: ['ticket.impact.large'] },
    { id: 'medium', label: 'Medium — one team', description: 'Affects one department or team', scoringTags: ['ticket.impact.medium'] },
    { id: 'small', label: 'Small — one user', description: 'Affects one person', scoringTags: ['ticket.impact.small'] },
  ],

  urgencyOptions: [
    { id: 'critical', label: 'Critical — revenue/critical path blocked', description: 'Deadline missed, revenue loss, safety issue', scoringTags: ['ticket.urgency.critical'] },
    { id: 'high', label: 'High — important deadline at risk', description: 'Key deadline approaching, manager escalation likely', scoringTags: ['ticket.urgency.high'] },
    { id: 'medium', label: 'Medium — normal business impact', description: 'Routine but needs timely response', scoringTags: ['ticket.urgency.medium'] },
    { id: 'low', label: 'Low — cosmetic or nice-to-have', description: 'Minor issue, no deadline pressure', scoringTags: ['ticket.urgency.low'] },
  ],

  priorityOptions: [
    { id: 'P1', label: 'P1 — Critical', description: 'Critical system down, revenue impact, active data loss', scoringTags: ['ticket.priority.P1'] },
    { id: 'P2', label: 'P2 — High', description: 'Major issue, deadline at risk, workaround available', scoringTags: ['ticket.priority.P2'] },
    { id: 'P3', label: 'P3 — Medium', description: 'Standard ticket, moderate impact', scoringTags: ['ticket.priority.P3'] },
    { id: 'P4', label: 'P4 — Low', description: 'Minor issue, low urgency', scoringTags: ['ticket.priority.P4'] },
    { id: 'P5', label: 'P5 — Scheduled', description: 'Planned work, no deadline', scoringTags: ['ticket.priority.P5'] },
  ],
};

export function getDefaultTicketTaxonomy(): ManagerTicketTaxonomy {
  return JSON.parse(JSON.stringify(DEFAULT_TICKET_TAXONOMY));
}
