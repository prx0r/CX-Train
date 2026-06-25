export type AssessmentMode = 'chat_call' | 'dashboard_sim' | 'voice_dashboard_sim';

export type SimPhase =
  | 'not_started'
  | 'call_active'
  | 'remote_active'
  | 'ticketing'
  | 'submitted';

export type SimToolId =
  | 'customer_chat'
  | 'ticket'
  | 'outlook'
  | 'browser'
  | 'cmd'
  | 'control_panel'
  | 'connectwise'
  | 'notes';

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

export type CustomerTemperament = 'calm' | 'stressed' | 'angry' | 'confused';
export type CustomerMood = 'neutral' | 'frustrated' | 'reassured';

/* ── Customer definition ────────────────────────────── */

export interface SimCustomer {
  name: string;
  company: string;
  role: string;
  temperament: CustomerTemperament;
  openingLine: string;
}

/* ── SimState — structured, nested ──────────────────── */

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

  outlook?: {
    workOffline: boolean;
    outboxCount: number;
    sentTestEmail: boolean;
    profileCorrupt: boolean;
  };

  network?: {
    internetReachable: boolean;
    dnsWorks: boolean;
    exchangeReachable: boolean;
  };

  connectwise?: {
    ticketId: string | null;
    priority: string | null;
    status: string | null;
    notes: string[];
    kbArticlesViewed: string[];
    assetsViewed: string[];
  };

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
}

/* ── Red flag definition ────────────────────────────── */

export interface SimRedFlag {
  id: string;
  severity: 'minor' | 'major' | 'critical';
  message: string;
}

/* ── Action definition ──────────────────────────────── */

export interface SimAction {
  id: string;
  tool: SimToolId;
  label: string;
  allowedPhases: SimPhase[];
  requiresState?: Record<string, unknown>;
  effects?: Record<string, unknown>;
  observation: string;
  revealsFacts?: string[];
  evidenceTags?: string[];
  redFlag?: SimRedFlag;
  scoreImpact?: {
    positive?: string[];
    negative?: string[];
  };
}

/* ── Rubric entry ───────────────────────────────────── */

export interface SimRubricEntry {
  weight: number;
  label?: string;
}

export interface SimRubric {
  [key: string]: SimRubricEntry;
}

/* ── Ideal ticket spec ──────────────────────────────── */

export interface SimIdealTicket {
  summary: string;
  requiredFields: string[];
  mustMention: string[];
  mustNotInvent: string[];
}

/* ── Scenario pack — the core abstraction ───────────── */

export interface SimPack {
  id: string;
  version: string;
  title: string;
  mode: 'dashboard_sim';
  taxonomyItemId?: string;

  customer: SimCustomer;

  initialState: SimState;

  hiddenTruth: {
    rootCause: string;
    correctFix: string;
    idealDiagnosticPath: string[];
    factsOnlyRevealAfter: Record<string, string[]>;
  };

  tools: SimToolId[];

  actions: SimAction[];

  rubric: SimRubric;

  redFlags: SimRedFlag[];

  idealTicket: SimIdealTicket;
}

/* ── Event log entry ────────────────────────────────── */

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

/* ── ActionResult returned to state machine caller ──── */

export interface SimActionResult {
  action_id: string;
  label: string;
  result_text: string;
  state_before: Record<string, unknown>;
  state_after: Record<string, unknown>;
  phaseTransition: boolean;
  revealedFacts: string[];
  evidenceTags: string[];
  redFlag: SimRedFlag | null;
}

/* ── Visible (safe) state — never leaks hiddenTruth etc ── */

export interface VisibleSimState {
  phase: SimPhase;
  safe_state: Record<string, unknown>;
}

export interface VisibleAction {
  id: string;
  tool: SimToolId;
  label: string;
}

/* ── Timeline entry for debug / manager view ────────── */

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

/* ── Scoring result ─────────────────────────────────── */

export interface SimScoringResult {
  actionCriteria: Record<string, 'pass' | 'partial' | 'fail'>;
  redFlags: string[];
  scoreDelta: number;
  timelineSummary: string[];
  technicalPath: string[];
}
