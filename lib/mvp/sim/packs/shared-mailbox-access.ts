import { SimPack, SimPackScoringCriterion, SimState } from '../types';

export const SHARED_MAILBOX_PACK_ID = 'pack-shared-mailbox-v1';

const getInitialState = (): SimState => ({
  phase: 'not_started',
  call: { startedAt: null, endedAt: null, customerMood: 'neutral', factsRevealed: [] },
  remote: { connected: false, deviceName: 'DESKTOP-MKT-03', currentApp: 'none' },
  toolStates: {},
  evidence: { askedImpact: false, askedScope: false, confirmedUser: false, confirmedDevice: false, checkedObviousCause: false, verifiedFix: false },
  flags: { guessedWithoutEvidence: false, performedRiskyAction: false, ignoredUserEmotion: false },
  discovered: [],
});

const criteriaList: SimPackScoringCriterion[] = [
  { id: 'confirmed_user', label: 'Confirmed caller identity', category: 'call_control', weight: 8, mandatory: true, check: 'tag_present', target: 'communication.user_confirmation', positive: true, description: 'Candidate confirmed the person making the access request', gradingGuide: 'Look for "can I confirm who I am speaking with?"' },
  { id: 'identified_mailbox', label: 'Identified which shared mailbox', category: 'diagnosis', weight: 10, mandatory: false, check: 'tag_present', target: 'diagnostic.application_state_checked', positive: true, description: 'Candidate identified the specific mailbox needed', gradingGuide: 'Look for "which mailbox do you need access to?"' },
  { id: 'asked_authorization', label: 'Checked access authorization', category: 'professionalism', weight: 15, mandatory: true, check: 'tag_present', target: 'communication.empathy', positive: true, description: 'Candidate verified the request is properly authorized (manager approval, business need)', gradingGuide: 'Look for "has your manager approved this?" or "do you have authorization?"' },
  { id: 'asked_existing_access', label: 'Checked if user already has access', category: 'diagnosis', weight: 8, mandatory: false, check: 'tag_present', target: 'diagnostic.scope_isolation', positive: true, description: 'Candidate checked if the user already has access to the mailbox', gradingGuide: 'Look for "do you already have access?" or "have you checked if you can see it?"' },
  { id: 'asked_impact', label: 'Asked business need', category: 'call_control', weight: 8, mandatory: false, check: 'tag_present', target: 'communication.impact_question', positive: true, description: 'Candidate asked why access is needed', gradingGuide: 'Look for "what do you need access for?" or "what is the business reason?"' },
  { id: 'set_expectations', label: 'Set expectations on timeline', category: 'call_control', weight: 8, mandatory: false, check: 'tag_present', target: 'communication.empathy', positive: true, description: 'Candidate set expectations on when access will be granted', gradingGuide: 'Look for "I will action this within..." or "you should receive confirmation"' },
  { id: 'avoided_unauthorized_grant', label: 'Did not grant access without authorization', category: 'professionalism', weight: 15, mandatory: true, check: 'state_value', target: 'flags.guessedWithoutEvidence', positive: true, value: false, description: 'Candidate did not grant mailbox access before verifying authorization', gradingGuide: 'Must verify authorization before making any changes' },
  { id: 'permission_level_correct', label: 'Asked about permission level needed', category: 'diagnosis', weight: 8, mandatory: false, check: 'tag_present', target: 'diagnostic.application_state_checked', positive: true, description: 'Candidate asked whether Full Access or Read-Only is needed', gradingGuide: 'Look for "full access or read-only?" or "what level of permissions?"' },
  { id: 'ticket_details', label: 'Ticket has all required details', category: 'ticket_quality', weight: 8, mandatory: false, check: 'tag_present', target: 'ticket.root_cause_present', positive: true, description: 'Ticket includes user, mailbox, authorization status, permission level', gradingGuide: 'Required: user, mailbox name, permission level, authorization status, business reason' },
  { id: 'ticket_impact', label: 'Business need in ticket', category: 'ticket_quality', weight: 5, mandatory: false, check: 'tag_present', target: 'ticket.impact_noted', positive: true, description: 'Business reason documented in ticket', gradingGuide: 'Ticket explains why access is needed' },
  { id: 'ticket_next_step', label: 'Next steps in ticket', category: 'ticket_quality', weight: 5, mandatory: false, check: 'tag_present', target: 'ticket.next_step_set', positive: true, description: 'Ticket includes expected completion timeline', gradingGuide: 'Ticket has timeline or follow-up action' },
];

export function getSharedMailboxAccessPack(): SimPack {
  return {
    id: SHARED_MAILBOX_PACK_ID,
    version: '1.0',
    title: 'Shared Mailbox Access Request',
    description: 'Team member needs access to a shared mailbox. Tests authorization checking, scoping, and proper access request procedures.',
    level: 1,
    severity: 'P4',
    category: 'email',
    queueTitle: 'Shared mailbox access — Sophie from Marketing',
    requesterName: 'Sophie Turner',
    company: 'Alder & Co Legal',
    department: 'Marketing',
    location: 'Floor 2, City Office',
    mode: 'call_only',
    taxonomyItemId: 'email.shared_mailbox',

    customer: {
      name: 'Sophie',
      company: 'Alder & Co Legal',
      role: 'Marketing Coordinator',
      temperament: 'calm',
      openingLine: 'Hi, I need to get access to the Marketing shared mailbox. I\'ve just joined the team and need to start responding to campaign enquiries.',
      subject: 'Shared mailbox access — marketing@alderlegal.com',
      gender: 'female',
      azureVoice: {
        neutral: { voiceName: "en-GB-SoniaNeural", style: "friendly", styleDegree: 0.5, rate: "medium", pitch: "+0%" },
        frustrated: { voiceName: "en-GB-SoniaNeural", style: "worried", styleDegree: 0.8, rate: "+5%", pitch: "+2%" },
        reassured: { voiceName: "en-GB-SoniaNeural", style: "cheerful", styleDegree: 0.6, rate: "medium", pitch: "+0%" }
      }
  },

    callerBehavior: {
      archetype: 'uncertain',
      defaultIntensity: 1,
      frustrationTriggers: ['complicated questions about technical permissions'],
      reassuranceTriggers: ['clear process', 'step-by-step guidance'],
      curveballProbability: 0.2,
      preferredCurveballs: ['I am not sure who my manager is for this', 'I think someone else already has access?'],
      verbosity: 'verbose',
      technicalLevel: 'non_technical',
      initialMood: 'neutral',
    },

    initialState: getInitialState(),

    hiddenTruth: {
      rootCause: 'New team member needs access to existing shared mailbox — no issue, standard access request',
      correctFix: 'Verify identity, confirm manager authorization, identify the mailbox (marketing@), determine permission level (Full Access or Read-Only), process request through proper channels',
      idealDiagnosticPath: [
        'Confirm caller identity and role',
        'Identify which shared mailbox',
        'Check if caller already has access',
        'Confirm manager has authorized',
        'Ask permission level (Full vs Read-Only)',
        'Ask business reason',
        'Set timeline expectations',
        'Submit ticket with all details',
      ],
      factsOnlyRevealAfter: {
        'asked_which_mailbox': ['It is the marketing@alderlegal.com mailbox. I think that is the main one for the team.'],
        'asked_authorization': ['My manager is Priya in Marketing. She said it was fine but I do not think she has submitted a formal request yet.'],
        'asked_permission_level': ['I need to send emails from it and manage responses. So I guess full access? I am not sure what the options are.'],
        'asked_existing_access': ['I cannot see it in my Outlook at all. Tom in the team can access it — he could show me if needed.'],
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
        observation: 'Call connected. Marketing coordinator is on the line.',
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
        id: 'confirm_user',
        tool: 'customer_chat',
        label: 'Confirm caller identity',
        allowedPhases: ['call_active'],
        observation: 'Sophie Turner, Marketing Coordinator at Alder & Co Legal.',
        taxonomyTags: ['communication.user_confirmation'],
        scoreImpact: { positive: ['call_control'] },
      },
      {
        id: 'identify_mailbox',
        tool: 'customer_chat',
        label: 'Identify the shared mailbox',
        allowedPhases: ['call_active'],
        observation: 'The mailbox is marketing@alderlegal.com — the main marketing team mailbox.',
        revealsFacts: ['Mailbox identified: marketing@alderlegal.com'],
        taxonomyTags: ['diagnostic.application_state_checked'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'check_authorization',
        tool: 'customer_chat',
        label: 'Check manager authorization',
        allowedPhases: ['call_active'],
        observation: 'Her manager is Priya in Marketing. Priya said it was fine but has not submitted a formal request yet.',
        taxonomyTags: ['communication.empathy'],
        scoreImpact: { positive: ['professionalism'] },
      },
      {
        id: 'check_existing_access',
        tool: 'customer_chat',
        label: 'Check if already has access',
        allowedPhases: ['call_active'],
        observation: 'Sophie cannot see the mailbox in her Outlook. Tom in Marketing already has access.',
        taxonomyTags: ['diagnostic.scope_isolation'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'ask_permission_level',
        tool: 'customer_chat',
        label: 'Ask permission level needed',
        allowedPhases: ['call_active'],
        observation: 'Sophie needs Full Access to send emails and manage responses from the mailbox.',
        taxonomyTags: ['diagnostic.application_state_checked'],
        scoreImpact: { positive: ['diagnosis'] },
      },
      {
        id: 'ask_business_reason',
        tool: 'customer_chat',
        label: 'Ask business reason',
        allowedPhases: ['call_active'],
        observation: 'Sophie needs to manage campaign enquiries and send marketing emails from the team mailbox.',
        taxonomyTags: ['communication.impact_question'],
        scoreImpact: { positive: ['call_control'] },
      },
      {
        id: 'set_timeline',
        tool: 'customer_chat',
        label: 'Set timeline expectations',
        allowedPhases: ['call_active'],
        observation: 'Sophie is happy with the expected processing time. She will ask Priya to send the formal approval.',
        taxonomyTags: ['communication.empathy'],
        scoreImpact: { positive: ['call_control'] },
      },
      /* ── Red flags ── */
      {
        id: 'grant_without_auth',
        tool: 'customer_chat',
        label: 'Grant access immediately',
        allowedPhases: ['call_active'],
        observation: 'Granting access before formal manager approval is against policy.',
        redFlag: {
          id: 'unsafe_security_behaviour',
          severity: 'major',
          message: 'Granted mailbox access without formal manager authorization.',
        },
        effects: { 'flags.guessedWithoutEvidence': true },
        taxonomyTags: ['red_flag.guessed_root_cause_without_evidence'],
        scoreImpact: { negative: ['professionalism'] },
      },
      {
        id: 'ask_to_share_credentials',
        tool: 'customer_chat',
        label: 'Tell them to share the mailbox password',
        allowedPhases: ['call_active'],
        observation: 'Shared mailboxes should not use shared passwords. Access should be granted via permissions.',
        redFlag: {
          id: 'unsafe_security_behaviour',
          severity: 'critical',
          message: 'Suggested sharing mailbox credentials — severe security risk.',
        },
        effects: { 'flags.performedRiskyAction': true },
        taxonomyTags: ['red_flag.destructive_action_without_evidence'],
        scoreImpact: { negative: ['professionalism'] },
      },
    ],

    cmdCommands: [],

    scoringDefaults: {
      categoryWeights: { call_control: 25, diagnosis: 30, resolution: 10, ticket_quality: 20, professionalism: 15 },
      criteria: criteriaList,
      mandatoryCheckpoints: ['confirmed_user', 'asked_authorization', 'avoided_unauthorized_grant'],
      redFlags: [
        { id: 'unsafe_security_behaviour', severity: 'major', message: 'Granted access without authorization or shared credentials' },
      ],
      diagnosticChecklist: [
        { id: 'confirmed_user', label: 'Confirmed caller identity', criteria: 'confirmed_user' },
        { id: 'identified_mailbox', label: 'Identified shared mailbox', criteria: 'identified_mailbox' },
        { id: 'asked_authorization', label: 'Checked authorization', criteria: 'asked_authorization' },
        { id: 'asked_existing_access', label: 'Checked existing access', criteria: 'asked_existing_access' },
        { id: 'permission_level_correct', label: 'Asked permission level', criteria: 'permission_level_correct' },
        { id: 'ticket_details', label: 'Ticket has all details', criteria: 'ticket_details' },
      ],
      failGates: [
        { id: 'unsafe_security', label: 'Shared mailbox access without authorization', severity: 'critical', scoreCap: 10, overrideReadiness: 'not_ready', redFlagType: 'unsafe_security_behaviour' },
      ],
      derivedGates: [],
      thresholds: { ready: 80, needs_supervision: 60 },
      idealTicket: {
        summary: 'Shared mailbox access request — Sophie Turner (Marketing) needs Full Access to marketing@alderlegal.com',
        requiredFields: ['user', 'department', 'mailbox_name', 'permission_level', 'authorization_status', 'business_reason', 'timeline'],
        mustMention: ['Sophie Turner', 'Marketing', 'marketing@alderlegal.com', 'Full Access', 'campaign enquiries'],
        mustNotInvent: ['password shared', 'access already granted', 'manager not required'],
      },
    },

    rubric: {
      call_control: { weight: 3, label: 'Call control and process' },
      diagnosis: { weight: 3, label: 'Requirements gathering' },
      resolution: { weight: 1, label: 'Resolution planning' },
      ticket_quality: { weight: 2, label: 'Ticket documentation' },
      professionalism: { weight: 2, label: 'Security and authorization' },
    },
    redFlags: [
      { id: 'unsafe_security_behaviour', severity: 'major', message: 'Granted access without authorization or shared credentials' },
    ],
    idealTicket: {
      summary: 'Shared mailbox access request — Sophie Turner (Marketing) needs Full Access to marketing@alderlegal.com',
      requiredFields: ['user', 'department', 'mailbox_name', 'permission_level', 'authorization_status', 'business_reason', 'timeline'],
      mustMention: ['Sophie Turner', 'Marketing', 'marketing@alderlegal.com', 'Full Access', 'campaign enquiries'],
      mustNotInvent: ['password shared', 'access already granted', 'manager not required'],
    },
    scoringCriteria: criteriaList,
    diagnosticChecklist: [
      { id: 'confirmed_user', label: 'Confirmed caller identity', criteria: 'confirmed_user' },
      { id: 'identified_mailbox', label: 'Identified shared mailbox', criteria: 'identified_mailbox' },
      { id: 'asked_authorization', label: 'Checked authorization', criteria: 'asked_authorization' },
      { id: 'asked_existing_access', label: 'Checked existing access', criteria: 'asked_existing_access' },
      { id: 'permission_level_correct', label: 'Asked permission level', criteria: 'permission_level_correct' },
      { id: 'ticket_details', label: 'Ticket has all details', criteria: 'ticket_details' },
    ],
    managerReviewHints: {
      keyCriteria: ['confirmed_user', 'asked_authorization', 'avoided_unauthorized_grant', 'permission_level_correct'],
      commonMistakes: ['Grants access without manager authorization', 'Does not ask Full Access vs Read-Only', 'Tells user to share mailbox password', 'Assumes user already has access without checking'],
      whatGoodLooksLike: 'Identity confirmed, specific mailbox identified, authorization verified with manager, permission level discussed, business reason understood, timeline set.',
      calibrationNotes: 'The key distinction between L1 and L2 thinking: did they ask about Full Access vs Read-Only? That shows they understand least-privilege security principles.',
    },
    taxonomyClassification: ['email.shared_mailbox', 'identity.access_management', 'communication.scope_question'],
  };
}
