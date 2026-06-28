import { SimPack, SimPackScoringCriterion, SimState } from '../types';

export const NEW_STARTER_PACK_ID = 'pack-new-starter-v1';

const getInitialState = (): SimState => ({
  phase: 'not_started',
  call: { startedAt: null, endedAt: null, customerMood: 'neutral', factsRevealed: [] },
  remote: { connected: false, deviceName: 'DESKTOP-NEW-01', currentApp: 'none' },
  toolStates: {},
  evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
  flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
  discovered: [],
});

const criteriaList: SimPackScoringCriterion[] = [
  { id: 'confirmed_requester', label: 'Confirmed who made the request', category: 'call_control', weight: 8, mandatory: true, check: 'tag_present', target: 'communication.user_confirmation', positive: true, description: 'Candidate confirmed who is requesting the new starter setup', gradingGuide: 'Look for "who requested the new starter?" or "who authorized this?"' },
  { id: 'identified_starter', label: 'Identified the new starter details', category: 'diagnosis', weight: 10, mandatory: true, check: 'tag_present', target: 'diagnostic.application_state_checked', positive: true, description: 'Candidate confirmed the new starter name and role', gradingGuide: 'Look for name, department, role, start date' },
  { id: 'confirmed_authorization', label: 'Checked authorization/approval', category: 'professionalism', weight: 15, mandatory: true, check: 'tag_present', target: 'communication.empathy', positive: true, description: 'Candidate confirmed the request is properly authorized', gradingGuide: 'Look for "has this been approved by their manager?" or "do you have authorization?"' },
  { id: 'classified_correctly', label: 'Classified the request correctly', category: 'diagnosis', weight: 10, mandatory: false, check: 'tag_present', target: 'diagnostic.scope_isolation', positive: true, description: 'Candidate identified the correct type of access needed', gradingGuide: 'Look for distinguishing between new user creation, license assignment, or access grant' },
  { id: 'asked_urgency', label: 'Asked about urgency/start date', category: 'call_control', weight: 8, mandatory: false, check: 'tag_present', target: 'communication.impact_question', positive: true, description: 'Candidate asked when the new starter needs access', gradingGuide: 'Look for "when do they start?" or "how urgent is this?"' },
  { id: 'asked_scope', label: 'Asked what systems are needed', category: 'diagnosis', weight: 10, mandatory: false, check: 'tag_present', target: 'communication.scope_question', positive: true, description: 'Candidate asked which systems/applications the new starter needs', gradingGuide: 'Look for "what systems will they need?" or "do they need email, CRM, both?"' },
  { id: 'set_expectations', label: 'Set timeline expectations', category: 'call_control', weight: 8, mandatory: false, check: 'tag_present', target: 'communication.empathy', positive: true, description: 'Candidate set clear expectations on provisioning timeline', gradingGuide: 'Look for "I will action this within X hours" or "you should hear back by"' },
  { id: 'avoided_premature_access', label: 'Avoided granting access without authorization', category: 'professionalism', weight: 12, mandatory: true, check: 'state_value', target: 'flags.guessedWithoutEvidence', positive: true, value: false, description: 'Candidate did not grant access before verifying authorization', gradingGuide: 'Must confirm authorization before provisioning. Never assume.' },
  { id: 'ticket_has_details', label: 'Ticket has all required details', category: 'ticket_quality', weight: 8, mandatory: false, check: 'tag_present', target: 'ticket.root_cause_present', positive: true, description: 'Ticket includes starter details, systems needed, authorization status', gradingGuide: 'Required: starter name, role, start date, systems needed, authorization status' },
  { id: 'ticket_next_step', label: 'Ticket has next steps', category: 'ticket_quality', weight: 5, mandatory: false, check: 'tag_present', target: 'ticket.next_step_set', positive: true, description: 'Ticket includes expected timeline and actions', gradingGuide: 'Ticket explains next steps for provisioning' },
  { id: 'ticket_urgency', label: 'Urgency noted in ticket', category: 'ticket_quality', weight: 5, mandatory: false, check: 'tag_present', target: 'ticket.urgency_noted', positive: true, description: 'Ticket notes the start date or urgency level', gradingGuide: 'Urgency matches the start date requirement' },
];

export function getNewStarterTriagePack(): SimPack {
  return {
    id: NEW_STARTER_PACK_ID,
    version: '1.0',
    title: 'New Starter Triage',
    description: 'Manager requesting IT setup for a new employee. Tests triage skills — gathering requirements, checking authorization, proper classification.',
    level: 1,
    severity: 'P3',
    category: 'onboarding',
    queueTitle: 'New starter setup — Sarah Mitchell',
    requesterName: 'Helen Zhang',
    company: 'Connexion Dental',
    department: 'HR',
    location: 'Head Office',
    mode: 'call_only',
    taxonomyItemId: 'onboarding.new_starter',

    customer: {
      name: 'Helen',
      company: 'Connexion Dental',
      role: 'HR Manager',
      temperament: 'calm',
      openingLine: 'Hi, I need to arrange IT access for a new starter. Sarah Mitchell starts next Monday in the Accounts team. What do you need from me to get this set up?',
      subject: 'New starter setup — Sarah Mitchell (Accounts, Mon start)',
      gender: 'female',
      azureVoice: {
        neutral: { voiceName: 'en-GB-SoniaNeural', style: 'friendly', styleDegree: 0.5, rate: 'medium', pitch: '+0%' },
        frustrated: { voiceName: 'en-GB-SoniaNeural', style: 'worried', styleDegree: 0.8, rate: '+5%', pitch: '+2%' },
        reassured: { voiceName: 'en-GB-SoniaNeural', style: 'cheerful', styleDegree: 0.6, rate: 'medium', pitch: '+0%' }
      }
  },

    callerBehavior: {
      archetype: 'executive',
      defaultIntensity: 1,
      frustrationTriggers: ['being asked information already provided', 'delays without reason'],
      reassuranceTriggers: ['structured process', 'clear timeline', 'knowing what is needed'],
      curveballProbability: 0.3,
      preferredCurveballs: ['I actually need this for two people', 'She is starting Monday — is that enough notice?'],
      verbosity: 'normal',
      technicalLevel: 'non_technical',
      initialMood: 'neutral',
    },

    initialState: getInitialState(),

    hiddenTruth: {
      rootCause: 'New starter needs IT access provisioning — no existing issue, new setup request',
      correctFix: 'Gather starter details (name, role, department, start date), confirm required systems (email, CRM, file access), verify HR authorization, submit ticket with timeline',
      idealDiagnosticPath: [
        'Confirm requester identity and authorization',
        'Get new starter name, role, department',
        'Ask start date',
        'Ask which systems are needed',
        'Check if manager has approved',
        'Set expectations on setup timeline',
        'Submit ticket with all details',
      ],
      factsOnlyRevealAfter: {
        'asked_which_systems': ['She will need email, access to the shared drive, and the practice management system. I think she also needs the CRM but check with her manager.'],
        'asked_authorization': ['Her manager is David Chen in Accounts. He sent an email request to IT earlier today.'],
        'asked_department': ['She is in Accounts, reporting to David Chen as I mentioned.'],
      },
    },

    tools: ['customer_chat', 'ticket', 'notes'],
    actions: [
      {
        id: 'start_call',
        tool: 'customer_chat',
        label: 'Start call',
        allowedPhases: ['not_started'],
        transitionsTo: 'call_active',
        observation: 'Call connected. HR manager is on the line.',
        scoreImpact: { positive: ['call_control'] },
      },
      {
        id: 'end_call',
        tool: 'customer_chat',
        label: 'End call',
        allowedPhases: ['call_active'],
        transitionsTo: 'ticketing',
        effects: { 'call.endedAt': '$now' as any },
        observation: 'Call ended. Proceed to write your ticket.',
        scoreImpact: { positive: ['call_control'] },
      },
      {
        id: 'confirm_requester',
        tool: 'customer_chat',
        label: 'Confirm who is making the request',
        allowedPhases: ['call_active'],
        observation: 'Helen confirms she is the HR Manager making this request on behalf of Accounts.',
        taxonomyTags: ['communication.user_confirmation'],
        scoreImpact: { positive: ['call_control'] },
      },
      {
        id: 'confirm_starter_details',
        tool: 'customer_chat',
        label: 'Get new starter details',
        allowedPhases: ['call_active'],
        observation: 'Sarah Mitchell, starting Monday in Accounts as a junior accountant. Role is entry-level.',
        revealsFacts: ['New starter identified: Sarah Mitchell'],
        taxonomyTags: ['diagnostic.application_state_checked'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'ask_start_date',
        tool: 'customer_chat',
        label: 'Ask start date',
        allowedPhases: ['call_active'],
        observation: 'She starts next Monday. That gives 5 business days to set everything up.',
        taxonomyTags: ['communication.impact_question'],
        scoreImpact: { positive: ['call_control'] },
      },
      {
        id: 'ask_which_systems',
        tool: 'customer_chat',
        label: 'Ask which systems are needed',
        allowedPhases: ['call_active'],
        observation: 'Customer: "She will need email, shared drive, and the practice management system. Possibly CRM too."',
        revealsFacts: ['Systems identified: email, shared drive, PMS'],
        taxonomyTags: ['communication.scope_question', 'diagnostic.scope_isolation'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'ask_authorization',
        tool: 'customer_chat',
        label: 'Check authorization',
        allowedPhases: ['call_active'],
        observation: 'Her manager David Chen has already sent an email request to IT. Authorization is confirmed.',
        taxonomyTags: ['communication.empathy'],
        scoreImpact: { positive: ['professionalism'] },
      },
      {
        id: 'set_expected_timeline',
        tool: 'customer_chat',
        label: 'Set provisioning timeline',
        allowedPhases: ['call_active'],
        observation: 'Customer is happy with the expected timeline. She will let David Chen know.',
        taxonomyTags: ['communication.empathy'],
        scoreImpact: { positive: ['call_control'] },
      },
      /* ── Red flags ── */
      {
        id: 'grant_access_without_check',
        tool: 'customer_chat',
        label: 'Confirm access will be granted immediately',
        allowedPhases: ['call_active'],
        observation: 'You confirmed access without checking if the request is authorized or if the starter exists in HR records.',
        redFlag: {
          id: 'unsafe_security_behaviour',
          severity: 'major',
          message: 'Granted access without verifying authorization — could be social engineering.',
        },
        effects: { 'flags.guessedWithoutEvidence': true },
        taxonomyTags: ['red_flag.guessed_root_cause_without_evidence'],
        scoreImpact: { negative: ['professionalism'] },
      },
      {
        id: 'ask_for_blanket_access',
        tool: 'customer_chat',
        label: 'Ask if they need "everything"',
        allowedPhases: ['call_active'],
        observation: 'Granting blanket access without specifying is a security risk.',
        redFlag: {
          id: 'unsafe_security_behaviour',
          severity: 'major',
          message: 'Offered blanket access instead of role-appropriate permissions.',
        },
        taxonomyTags: ['red_flag.destructive_action_without_evidence'],
        scoreImpact: { negative: ['professionalism'] },
      },
    ],

    cmdCommands: [],

    scoringDefaults: {
      categoryWeights: { call_control: 25, diagnosis: 30, resolution: 10, ticket_quality: 20, professionalism: 15 },
      criteria: criteriaList,
      mandatoryCheckpoints: ['confirmed_requester', 'identified_starter', 'confirmed_authorization', 'avoided_premature_access'],
      redFlags: [
        { id: 'unsafe_security_behaviour', severity: 'major', message: 'Granted access without authorization check' },
      ],
      diagnosticChecklist: [
        { id: 'confirmed_requester', label: 'Confirmed who requested', criteria: 'confirmed_requester' },
        { id: 'identified_starter', label: 'Got new starter details', criteria: 'identified_starter' },
        { id: 'confirmed_authorization', label: 'Checked authorization', criteria: 'confirmed_authorization' },
        { id: 'classified_correctly', label: 'Classified request correctly', criteria: 'classified_correctly' },
        { id: 'asked_urgency', label: 'Asked start date', criteria: 'asked_urgency' },
        { id: 'asked_scope', label: 'Asked which systems', criteria: 'asked_scope' },
        { id: 'ticket_has_details', label: 'Ticket has all details', criteria: 'ticket_has_details' },
      ],
      failGates: [
        { id: 'unsafe_security', label: 'Granted access without authorization', severity: 'critical', scoreCap: 25, overrideReadiness: 'not_ready', redFlagType: 'unsafe_security_behaviour' },
      ],
      derivedGates: [],
      thresholds: { ready: 80, needs_supervision: 60 },
      idealTicket: {
        summary: 'New starter setup — Sarah Mitchell (Junior Accountant, Accounts, Connexion Dental) starts Monday',
        requiredFields: ['requester', 'starter_name', 'role', 'department', 'start_date', 'systems_needed', 'authorization_status', 'timeline'],
        mustMention: ['Sarah Mitchell', 'Accounts', 'Connexion Dental', 'email', 'shared drive', 'practice management system'],
        mustNotInvent: ['already exists in system', 'license already assigned', 'bypassed manager approval'],
      },
    },

    rubric: {
      call_control: { weight: 3, label: 'Call control and requirements gathering' },
      diagnosis: { weight: 3, label: 'Information gathering and classification' },
      resolution: { weight: 1, label: 'Resolution planning' },
      ticket_quality: { weight: 2, label: 'Ticket documentation' },
      professionalism: { weight: 2, label: 'Security awareness' },
    },
    redFlags: [
      { id: 'unsafe_security_behaviour', severity: 'major', message: 'Granted access without authorization check' },
    ],
    idealTicket: {
      summary: 'New starter setup — Sarah Mitchell (Junior Accountant, Accounts, Connexion Dental) starts Monday',
      requiredFields: ['requester', 'starter_name', 'role', 'department', 'start_date', 'systems_needed', 'authorization_status', 'timeline'],
      mustMention: ['Sarah Mitchell', 'Accounts', 'Connexion Dental', 'email', 'shared drive', 'practice management system'],
      mustNotInvent: ['already exists in system', 'license already assigned', 'bypassed manager approval'],
    },
    scoringCriteria: criteriaList,
    diagnosticChecklist: [
      { id: 'confirmed_requester', label: 'Confirmed who requested', criteria: 'confirmed_requester' },
      { id: 'identified_starter', label: 'Got new starter details', criteria: 'identified_starter' },
      { id: 'confirmed_authorization', label: 'Checked authorization', criteria: 'confirmed_authorization' },
      { id: 'classified_correctly', label: 'Classified request correctly', criteria: 'classified_correctly' },
      { id: 'asked_urgency', label: 'Asked start date', criteria: 'asked_urgency' },
      { id: 'asked_scope', label: 'Asked which systems', criteria: 'asked_scope' },
      { id: 'ticket_has_details', label: 'Ticket has all details', criteria: 'ticket_has_details' },
    ],
    managerReviewHints: {
      keyCriteria: ['confirmed_requester', 'identified_starter', 'confirmed_authorization', 'classified_correctly'],
      commonMistakes: ['Grants access without checking who authorized it', 'Does not ask which systems are needed', 'Misses the start date urgency'],
      whatGoodLooksLike: 'Requester verified, starter details confirmed, systems scoped, authorization checked, timeline set with HR manager.',
      calibrationNotes: 'Key test: did they ask about authorization or just take the request at face value? New starter triage is about process adherence, not technical skills.',
    },
    taxonomyClassification: ['onboarding.new_starter', 'identity.access_management', 'communication.triage'],
  };
}
