/**
 * Connexion SLA Classifier
 *
 * Determines severity, impact, and priority based on the Connexion SLA matrix.
 * This is the core business-specific scoring module that James requested.
 *
 * Input: scope (affected users), business state, workaround, customer claim
 * Output: severity, impact, priority, SLA targets, reasoning
 */

export type UserScope = 'single' | 'group' | 'company';
export type BusinessState = 'irritation' | 'degraded' | 'stopped';
export type WorkaroundStatus = 'yes' | 'no' | 'unknown';
export type Severity = 'low' | 'medium' | 'high';
export type Impact = 'low' | 'medium' | 'high';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface SLAInput {
  affected_users: UserScope;
  business_state: BusinessState;
  workaround: WorkaroundStatus;
  customer_claimed_priority?: string;
  is_security_incident?: boolean;
  is_outage?: boolean;
}

export interface SLAOutput {
  severity: Severity;
  impact: Impact;
  priority: Priority;
  response_target: string;
  resolution_target: string;
  reasoning: string[];
}

const SLA_TARGETS: Record<Priority, { response: string; resolution: string }> = {
  P1: { response: '30 minutes', resolution: '4 hours' },
  P2: { response: '1 hour', resolution: '8 hours' },
  P3: { response: '4 hours', resolution: '24 hours' },
  P4: { response: '8 hours', resolution: '30 days' },
  P5: { response: '8 hours', resolution: '60 days' },
};

function determineSeverity(input: SLAInput): Severity {
  if (input.affected_users === 'company') return 'high';
  if (input.affected_users === 'group') return 'medium';
  if (input.business_state === 'stopped') return 'high';
  if (input.business_state === 'degraded') return 'medium';
  return 'low';
}

function determineImpact(input: SLAInput): Impact {
  if (input.business_state === 'stopped' && input.workaround !== 'yes') return 'high';
  if (input.business_state === 'stopped') return 'medium';
  if (input.business_state === 'degraded' && input.workaround !== 'yes') return 'medium';
  if (input.business_state === 'degraded') return 'low';
  if (input.workaround !== 'yes') return 'medium';
  return 'low';
}

function priorityMatrix(impact: Impact, severity: Severity): Priority {
  const matrix: Record<Impact, Record<Severity, Priority>> = {
    high:  { high: 'P1', medium: 'P1', low: 'P2' },
    medium: { high: 'P1', medium: 'P2', low: 'P3' },
    low:   { high: 'P2', medium: 'P3', low: 'P5' },
  };
  return matrix[impact][severity];
}

/**
 * Classify an issue according to the Connexion SLA matrix.
 */
export function classifySLA(input: SLAInput): SLAOutput {
  const reasoning: string[] = [];

  /* Security incidents and outages always escalate */
  if (input.is_security_incident) {
    const out: SLAOutput = {
      severity: 'high',
      impact: 'high',
      priority: 'P1',
      response_target: SLA_TARGETS.P1.response,
      resolution_target: SLA_TARGETS.P1.resolution,
      reasoning: [
        'Security incident — treated as P1 regardless of scope.',
        'Initiate containment per TSOP002.',
        'Escalate to Tier 3 immediately.',
      ],
    };
    return out;
  }

  if (input.is_outage) {
    const out: SLAOutput = {
      severity: 'high',
      impact: 'high',
      priority: 'P1',
      response_target: SLA_TARGETS.P1.response,
      resolution_target: SLA_TARGETS.P1.resolution,
      reasoning: [
        'Confirmed outage — treated as P1.',
        'All hands on declared outage.',
      ],
    };
    return out;
  }

  const severity = determineSeverity(input);
  const impact = determineImpact(input);
  const priority = priorityMatrix(impact, severity);
  const targets = SLA_TARGETS[priority];

  reasoning.push(`Affected users: ${input.affected_users} → severity ${severity}`);
  reasoning.push(`Business state: ${input.business_state}, workaround: ${input.workaround} → impact ${impact}`);
  reasoning.push(`Priority matrix: impact ${impact} + severity ${severity} → ${priority}`);
  reasoning.push(`SLA target: ${targets.response} response, ${targets.resolution} resolution`);

  return {
    severity,
    impact,
    priority,
    response_target: targets.response,
    resolution_target: targets.resolution,
    reasoning,
  };
}

/**
 * Score a candidate's SLA judgement against the correct classification.
 * Returns a score 0-10 and detailed feedback.
 */
export function scoreSLAJudgement(correct: SLAOutput, candidate: {
  affected_scope?: string;
  business_impact?: string;
  workaround?: string;
  assigned_priority?: string;
  explanation?: string;
}): { score: number; maxScore: number; feedback: string[] } {
  const feedback: string[] = [];
  let score = 0;
  const maxScore = 10;

  /* Check if candidate assessed scope */
  if (candidate.affected_scope) {
    score += 2;
    feedback.push('✓ Assessed affected scope');
  } else {
    feedback.push('✗ Did not assess affected scope (single user, group, or company?)');
  }

  /* Check if candidate assessed business impact */
  if (candidate.business_impact) {
    score += 2;
    feedback.push('✓ Assessed business impact');
  } else {
    /* Allow valid inference — James's fix */
    if (candidate.explanation?.toLowerCase().includes('infer') ||
        candidate.explanation?.toLowerCase().includes('implied')) {
      score += 1;
      feedback.push('~ Impact inferred from context (valid)');
    } else {
      feedback.push('✗ Did not assess business impact');
    }
  }

  /* Check if candidate asked about workaround */
  if (candidate.workaround) {
    score += 2;
    feedback.push('✓ Checked for workaround');
  } else {
    feedback.push('✗ Did not check for workaround');
  }

  /* Check priority assignment */
  if (candidate.assigned_priority === correct.priority) {
    score += 4;
    feedback.push(`✓ Correct priority: ${correct.priority}`);
  } else if (candidate.assigned_priority) {
    const pNum = parseInt(correct.priority[1]);
    const cNum = parseInt(candidate.assigned_priority[1]);
    if (Math.abs(pNum - cNum) === 1) {
      score += 2;
      feedback.push(`~ Assigned ${candidate.assigned_priority} (one off from correct ${correct.priority})`);
    } else {
      feedback.push(`✗ Assigned ${candidate.assigned_priority} (correct was ${correct.priority})`);
    }
  } else {
    feedback.push('✗ Did not assign priority');
  }

  return { score, maxScore, feedback };
}
