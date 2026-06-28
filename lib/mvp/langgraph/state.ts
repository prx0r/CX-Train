import type { CallumPageContext } from '../contracts/page-context';
import type { ManagerAssessmentContext } from '../contracts/assessment';
import type { CallumThread } from '../callum/memory';

export type CallumIntent =
  | 'explain_assessment'
  | 'suggest_next_training'
  | 'confirm_proposal'
  | 'reject_proposal'
  | 'navigate'
  | 'general_question';

export interface CapabilityInvocation {
  name: string;
  input: unknown;
  result?: { ok: true; output: unknown } | { ok: false; error: string };
}

export interface GraphResponse {
  type: 'answer' | 'proposed_action' | 'navigation';
  message: string;
  threadId: string;
  pendingActionId?: string;
  targetRoute?: string;
  dataGaps?: string[];
  confidence?: string;
  action?: { type: string; payload: Record<string, unknown> };
}

export interface GraphState {
  /** Incoming request */
  pageContext: CallumPageContext | null;
  message: string;
  threadId?: string;
  managerProfileId: string;

  /** Loaded by nodes */
  thread: CallumThread | null;
  assessmentContext: ManagerAssessmentContext | null;

  /** Classified by intent node */
  intent: CallumIntent | null;
  targetRoute?: string;

  /** Capability result */
  activeCapability: CapabilityInvocation | null;

  /** Built by response node */
  response: GraphResponse | null;

  /** Accumulated errors (never overwritten) */
  errors: string[];
}
