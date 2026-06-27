export type AssessmentMode = 'chat_call' | 'dashboard_sim' | 'voice_dashboard_sim';

export type SimPhase =
  | 'not_started'
  | 'call_active'
  | 'remote_active'
  | 'ticketing'
  | 'submitted';

export type TaxonomyTag = string;

export function isValidTaxonomyTag(tag: string): boolean {
  return /^[a-z_]+\.[a-z_]+\.[a-z_]+$/.test(tag);
}

export const REGISTERED_TAXONOMY_TAGS: Record<string, { category: string; subcategory: string; description: string }> = {
  'communication.scope_question': { category: 'communication', subcategory: 'scope_question', description: 'Asked whether one or many users are affected' },
  'communication.impact_question': { category: 'communication', subcategory: 'impact_question', description: 'Asked about business impact' },
  'communication.user_confirmation': { category: 'communication', subcategory: 'user_confirmation', description: 'Confirmed caller identity' },
  'communication.empathy': { category: 'communication', subcategory: 'empathy', description: 'Showed empathy to caller' },
  'diagnostic.application_state_checked': { category: 'diagnostic', subcategory: 'application_state_checked', description: 'Checked application state' },
  'diagnostic.scope_isolation': { category: 'diagnostic', subcategory: 'scope_isolation', description: 'Isolated scope of issue' },
  'diagnostic.connectivity_verified': { category: 'diagnostic', subcategory: 'connectivity_verified', description: 'Verified network connectivity' },
  'diagnostic.kb_used': { category: 'diagnostic', subcategory: 'kb_used', description: 'Used knowledge base' },
  'tool.outlook.open': { category: 'tool', subcategory: 'outlook.open', description: 'Opened Outlook' },
  'tool.outlook.check_status': { category: 'tool', subcategory: 'outlook.check_status', description: 'Checked Outlook connection status' },
  'tool.outlook.check_outbox': { category: 'tool', subcategory: 'outlook.check_outbox', description: 'Checked Outbox' },
  'tool.outlook.disable_work_offline': { category: 'tool', subcategory: 'outlook.disable_work_offline', description: 'Disabled Work Offline' },
  'tool.outlook.send_receive': { category: 'tool', subcategory: 'outlook.send_receive', description: 'Performed Send/Receive' },
  'tool.outlook.send_test_email': { category: 'tool', subcategory: 'outlook.send_test_email', description: 'Sent test email' },
  'tool.browser.open': { category: 'tool', subcategory: 'browser.open', description: 'Opened browser' },
  'tool.browser.check_webmail': { category: 'tool', subcategory: 'browser.check_webmail', description: 'Checked webmail' },
  'tool.cmd.ping': { category: 'tool', subcategory: 'cmd.ping', description: 'Ran ping' },
  'tool.cmd.ipconfig': { category: 'tool', subcategory: 'cmd.ipconfig', description: 'Ran ipconfig' },
  'tool.connectwise.open_ticket': { category: 'tool', subcategory: 'connectwise.open_ticket', description: 'Opened ticket in ConnectWise' },
  'tool.connectwise.set_priority': { category: 'tool', subcategory: 'connectwise.set_priority', description: 'Set ticket priority' },
  'tool.connectwise.add_note': { category: 'tool', subcategory: 'connectwise.add_note', description: 'Added note to ticket' },
  'tool.connectwise.search_kb': { category: 'tool', subcategory: 'connectwise.search_kb', description: 'Searched knowledge base' },
  'tool.connectwise.view_asset': { category: 'tool', subcategory: 'connectwise.view_asset', description: 'Viewed asset details' },
  'tool.remote.connect': { category: 'tool', subcategory: 'remote.connect', description: 'Connected remote session' },
  'fix.correct_root_cause': { category: 'fix', subcategory: 'correct_root_cause', description: 'Fixed the correct root cause' },
  'fix.applied_incorrectly': { category: 'fix', subcategory: 'applied_incorrectly', description: 'Applied fix incorrectly' },
  'verification.user_confirmed': { category: 'verification', subcategory: 'user_confirmed', description: 'User confirmed the fix' },
  'verification.test_email_sent': { category: 'verification', subcategory: 'test_email_sent', description: 'Test email verified the fix' },
  'ticket.root_cause_present': { category: 'ticket', subcategory: 'root_cause_present', description: 'Root cause in ticket' },
  'ticket.impact_noted': { category: 'ticket', subcategory: 'impact_noted', description: 'Impact noted in ticket' },
  'ticket.next_step_set': { category: 'ticket', subcategory: 'next_step_set', description: 'Next step in ticket' },
  'ticket.urgency_noted': { category: 'ticket', subcategory: 'urgency_noted', description: 'Urgency noted in ticket' },
  'red_flag.disruptive_fix_before_basic_checks': { category: 'red_flag', subcategory: 'disruptive_fix_before_basic_checks', description: 'Disruptive fix before basic checks' },
  'red_flag.destructive_action_without_evidence': { category: 'red_flag', subcategory: 'destructive_action_without_evidence', description: 'Destructive action without evidence' },
  'red_flag.escalate_without_basic_checks': { category: 'red_flag', subcategory: 'escalate_without_basic_checks', description: 'Escalated without basic checks' },
  'red_flag.guessed_root_cause_without_evidence': { category: 'red_flag', subcategory: 'guessed_root_cause_without_evidence', description: 'Guessed root cause without evidence' },
};

export type SimToolId =
  | 'customer_chat'
  | 'ticket'
  | 'outlook'
  | 'browser'
  | 'cmd'
  | 'control_panel'
  | 'connectwise'
  | 'notes'
  | 'network'
  | 'vpn'
  | 'printer';

export type SimEventType =
  | 'sim_started'
  | 'tool_opened'
  | 'action_performed'
  | 'observation_returned'
  | 'customer_message'
  | 'candidate_message'
  | 'note_updated'
  | 'ticket_note_updated'
  | 'ticket_field_updated'
  | 'command_submitted'
  | 'kb_article_opened'
  | 'asset_viewed'
  | 'remote_session_started'
  | 'call_ended'
  | 'ticket_submitted'
  | 'analysis_started'
  | 'manager_reviewed'
  | 'sim_completed'
  | 'red_flag_triggered';

export type ScoringCategory = 'call_control' | 'diagnosis' | 'resolution' | 'ticket_quality' | 'professionalism';

export const SCORING_CATEGORIES: ScoringCategory[] = ['call_control', 'diagnosis', 'resolution', 'ticket_quality', 'professionalism'];

export type CustomerTemperament = 'calm' | 'stressed' | 'angry' | 'confused';
export type CustomerMood = 'neutral' | 'frustrated' | 'reassured';

export interface SimCustomer {
  name: string;
  company: string;
  role: string;
  temperament: CustomerTemperament;
  openingLine: string;
}

export type SimErrorCode =
  | 'INVALID_PHASE'
  | 'PRECONDITION_FAILED'
  | 'unknown';

export type SimToolStateKey = 'outlook' | 'network' | 'connectwise' | 'printer' | 'vpn';

export interface SimState {
  phase: SimPhase;

  call: {
    startedAt: number | null;
    endedAt: number | null;
    customerMood: CustomerMood;
    factsRevealed: string[];
  };

  remote: {
    connected: boolean;
    deviceName: string;
    currentApp: 'none' | 'outlook' | 'browser' | 'cmd' | 'control_panel';
  };

  toolStates: Partial<Record<SimToolStateKey, Record<string, unknown>>>;

  evidence: {
    askedImpact: boolean;
    askedScope: boolean;
    confirmedUser: boolean;
    confirmedDevice: boolean;
    checkedObviousCause: boolean;
    verifiedFix: boolean;
  };

  flags: {
    guessedWithoutEvidence: boolean;
    performedRiskyAction: boolean;
    ignoredUserEmotion: boolean;
  };

  discovered: string[];
}

export interface SimRedFlag {
  id: string;
  severity: 'minor' | 'major' | 'critical';
  message: string;
}

export interface SimCallerBehavior {
  archetype: 'uncertain' | 'direct' | 'executive';
  defaultIntensity: 1 | 2 | 3;
  frustrationTriggers: string[];
  reassuranceTriggers: string[];
  curveballProbability: number;
  preferredCurveballs: string[];
  verbosity: 'terse' | 'normal' | 'verbose';
  technicalLevel: 'non_technical' | 'somewhat_technical' | 'technical';
  initialMood: CustomerMood;
}

export interface SimCmdCommand {
  command: string;
  description: string;
  output: string | ((state: SimState) => string);
  triggersAction?: string;
  allowedPhases: SimPhase[];
  requiresState?: Record<string, unknown>;
}

export interface SimAction {
  id: string;
  tool: SimToolId;
  label: string;
  allowedPhases: SimPhase[];
  transitionsTo?: SimPhase;
  requiresState?: Record<string, unknown>;
  effects?: Record<string, unknown>;
  observation: string;
  failureObservation?: string;
  strictPreconditions?: boolean;
  revealsFacts?: string[];
  revealsToolState?: string[];
  taxonomyTags?: TaxonomyTag[];
  redFlag?: SimRedFlag;
  scoreImpact?: {
    positive?: string[];
    negative?: string[];
  };
}

export interface SimRubricEntry {
  weight: number;
  label?: string;
}

export interface SimRubric {
  [key: string]: SimRubricEntry;
}

export interface SimIdealTicket {
  summary: string;
  requiredFields: string[];
  mustMention: string[];
  mustNotInvent: string[];
}

export interface SimPackScoringCriterion {
  id: string;
  label: string;
  category: ScoringCategory;
  weight: number;
  mandatory: boolean;
  check: 'action_performed' | 'tag_present' | 'tag_in_event' | 'state_value' | 'fact_revealed';
  target: string;
  value?: unknown;
  positive: boolean;
  description: string;
  gradingGuide: string;
}

export interface SimPackDiagnosticStep {
  id: string;
  label: string;
  criteria: string;
}

export interface SimPackDefaults {
  categoryWeights: Record<string, number>;
  criteria: SimPackScoringCriterion[];
  mandatoryCheckpoints: string[];
  redFlags: SimRedFlag[];
  diagnosticChecklist: SimPackDiagnosticStep[];
  failGates: SimFailGateMap[];
  derivedGates: SimDerivedGate[];
  thresholds: {
    ready: number;
    needs_supervision: number;
  };
  idealTicket: SimIdealTicket;
}

export interface SimFailGateMap {
  id: string;
  label: string;
  severity: 'minor' | 'major' | 'critical';
  scoreCap: number;
  overrideReadiness?: 'ready' | 'needs_supervision' | 'not_ready';
  redFlagType?: string;
}

export interface SimDerivedGate {
  id: string;
  label: string;
  severity: 'warning' | 'major';
  scoreCap: number;
  condition: (criteria: Record<string, 'pass' | 'partial' | 'fail'>, score: number) => boolean;
}

export interface SimPack {
  id: string;
  version: string;
  title: string;
  description: string;
  level: number;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  category: string;
  queueTitle: string;
  requesterName: string;
  company: string;
  department?: string;
  location?: string;
  mode: 'call_only' | 'ticket_only' | 'call_plus_remote' | 'voicemail_plus_ticket';
  taxonomyItemId?: string;

  customer: SimCustomer;
  callerBehavior: SimCallerBehavior;

  initialState: SimState;

  hiddenTruth: {
    rootCause: string;
    correctFix: string;
    idealDiagnosticPath: string[];
    factsOnlyRevealAfter: Record<string, string[]>;
  };

  tools: SimToolId[];
  actions: SimAction[];
  cmdCommands: SimCmdCommand[];

  /* Primary source for scoring config */
  scoringDefaults: SimPackDefaults;

  /* Backward-compat fields — populate these from scoringDefaults in factory */
  rubric: SimRubric;
  redFlags: SimRedFlag[];
  idealTicket: SimIdealTicket;
  scoringCriteria: SimPackScoringCriterion[];
  diagnosticChecklist: SimPackDiagnosticStep[];

  /* Manager review hints (not scored) */
  managerReviewHints: {
    keyCriteria: string[];
    commonMistakes: string[];
    whatGoodLooksLike: string;
    calibrationNotes: string;
  };

  taxonomyClassification: string[];
}

export interface SimPackEvent {
  id: string;
  session_id: string;
  assessment_id: string;
  assessment_pack_id: string | null;
  sequence: number;
  event_type: SimEventType;
  actor: 'candidate' | 'customer' | 'system' | 'simulator' | 'analysis';
  tool_id: string | null;
  action_id: string | null;
  label: string | null;
  text: string | null;
  result_text: string | null;
  state_before_json: Record<string, unknown> | null;
  state_after_json: Record<string, unknown> | null;
  evidence_tags_json: string[] | null;
  red_flag_json: SimRedFlag | null;
  started_at_ms: number | null;
  ended_at_ms: number | null;
  created_at: string;
}

export interface SimActionResult {
  ok: boolean;
  action_id: string;
  label: string;
  result_text: string;
  state_before: Record<string, unknown>;
  state_after: Record<string, unknown>;
  phaseTransition: boolean;
  revealedFacts: string[];
  taxonomyTags: TaxonomyTag[];
  redFlag: SimRedFlag | null;
  errorCode: SimErrorCode | null;
}

export interface VisibleSimState {
  phase: SimPhase;
  safe_state: Record<string, unknown>;
}

export interface VisibleAction {
  id: string;
  tool: SimToolId;
  label: string;
  redFlag?: boolean;
}

export interface SimTimelineEntry {
  sequence: number;
  event_type: string;
  actor: string;
  formatted_time: string;
  label: string | null;
  result_text: string | null;
  is_red_flag: boolean;
  started_at_ms: number | null;
}

export interface SimCategoryScore {
  score: number;
  maxScore: number;
  earnedWeight: number;
  maxWeight: number;
  criteriaResults: Record<string, 'pass' | 'partial' | 'fail'>;
}

export interface SimCostlyMiss {
  criterionId: string;
  label: string;
  pointsLost: number;
  whyItMatters: string;
}

export interface SimScoringResult {
  overallScore: number;
  categoryScores: Record<ScoringCategory, SimCategoryScore>;
  actionCriteria: Record<string, 'pass' | 'partial' | 'fail'>;
  mandatoryFailures: string[];
  redFlags: string[];
  gateHits: Array<{
    id: string;
    label: string;
    severity: string;
    scoreCap: number;
    rationale: string;
  }>;
  whatCostYouMost: SimCostlyMiss[];
  timelineSummary: string[];
  technicalPath: string[];
}
