/**
 * Mock AI provider for offline testing and development.
 * Returns deterministic responses without calling any external API.
 */

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MockAiTaskOptions {
  messages: Message[];
  responseFormat?: 'json_object' | 'text';
  temperature?: number;
  maxTokens?: number;
}

interface MockAiTaskResult {
  success: boolean;
  content: string;
  model: string;
  error?: string;
  durationMs: number;
  retryable?: boolean;
}

function isEvidenceExtractionPrompt(system: string): boolean {
  return system.includes('evidence extraction') || system.includes('extract observable evidence');
}

function isNarrativeFeedbackPrompt(system: string): boolean {
  return system.includes('feedback writer') || system.includes('score and rating have already been calculated');
}

function isCallerPrompt(system: string): boolean {
  return system.includes('Sarah Thompson') || system.includes('caller persona') || system.includes('MSP first-line support call');
}

function mockEvidenceExtraction(userPrompt: string): string {
  const transcriptLower = userPrompt.toLowerCase();
  const hasIdentity = transcriptLower.includes('name') || transcriptLower.includes('sarah');
  const hasCompany = transcriptLower.includes('company') || transcriptLower.includes('alder') || transcriptLower.includes('mercer');
  const hasIssue = transcriptLower.includes('issue') || transcriptLower.includes('problem') || transcriptLower.includes('outlook') || transcriptLower.includes('password') || transcriptLower.includes('printer');
  const hasWhenStarted = transcriptLower.includes('when') || transcriptLower.includes('start') || transcriptLower.includes('begin');
  const hasImpact = transcriptLower.includes('impact') || transcriptLower.includes('block') || transcriptLower.includes('affect');
  const hasUrgency = transcriptLower.includes('urgent') || transcriptLower.includes('deadline') || transcriptLower.includes('soon');
  const hasScope = transcriptLower.includes('only you') || transcriptLower.includes('one user') || transcriptLower.includes('multiple') || transcriptLower.includes('everyone');
  const hasTechDiscovery = transcriptLower.includes('webmail') || transcriptLower.includes('other app') || transcriptLower.includes('browser');
  const hasError = transcriptLower.includes('error') || transcriptLower.includes('message') || transcriptLower.includes('says');
  const hasRecentChanges = transcriptLower.includes('recent') || transcriptLower.includes('change') || transcriptLower.includes('update');
  const hasNextSteps = transcriptLower.includes('next') || transcriptLower.includes('will') || transcriptLower.includes('check');
  const hasTone = !transcriptLower.includes('stupid') && !transcriptLower.includes('just fix');

  const ticket = userPrompt.includes('TICKET:') ? userPrompt.split('TICKET:')[1]?.split('\n')[0]?.trim() || '' : '';
  const ticketHasUser = ticket.toLowerCase().includes('user') || ticket.toLowerCase().includes('sarah') || ticket.toLowerCase().includes('james') || ticket.toLowerCase().includes('emily');
  const ticketHasCompany = ticket.toLowerCase().includes('company') || ticket.toLowerCase().includes('alder') || ticket.toLowerCase().includes('mercer') || ticket.toLowerCase().includes('westside');
  const ticketHasIssue = ticket.toLowerCase().includes('issue') || ticket.toLowerCase().includes('outlook') || ticket.toLowerCase().includes('password') || ticket.toLowerCase().includes('printer');
  const ticketHasImpact = ticket.toLowerCase().includes('impact') || ticket.toLowerCase().includes('cannot') || ticket.toLowerCase().includes('deadline');
  const ticketHasUrgency = ticket.toLowerCase().includes('urgent') || ticket.toLowerCase().includes('deadline') || ticket.toLowerCase().includes('30 min');
  const ticketHasChecks = ticket.toLowerCase().includes('check') || ticket.toLowerCase().includes('webmail') || ticket.toLowerCase().includes('restart');
  const ticketHasNext = ticket.toLowerCase().includes('next') || ticket.toLowerCase().includes('escalate');

  const criteria: Record<string, any> = {};
  const keys = ['identity_check', 'company_check', 'issue_clarification', 'started_when', 'impact', 'urgency', 'scope', 'technical_discovery', 'error_or_status_capture', 'recent_changes', 'next_steps', 'customer_tone', 'ticket_user_company', 'ticket_issue_summary', 'ticket_impact', 'ticket_urgency', 'ticket_checks_attempted', 'ticket_next_step', 'escalation_judgement', 'safety'];

  const statusMap: Record<string, boolean> = {
    identity_check: hasIdentity,
    company_check: hasCompany,
    issue_clarification: hasIssue,
    started_when: hasWhenStarted,
    impact: hasImpact,
    urgency: hasUrgency,
    scope: hasScope,
    technical_discovery: hasTechDiscovery,
    error_or_status_capture: hasError,
    recent_changes: hasRecentChanges,
    next_steps: hasNextSteps,
    customer_tone: hasTone,
    ticket_user_company: ticketHasUser,
    ticket_issue_summary: ticketHasIssue,
    ticket_impact: ticketHasImpact,
    ticket_urgency: ticketHasUrgency,
    ticket_checks_attempted: ticketHasChecks,
    ticket_next_step: ticketHasNext,
    escalation_judgement: hasIssue,
    safety: !transcriptLower.includes('just reboot') || transcriptLower.includes('safe'),
  };

  for (const key of keys) {
    criteria[key] = {
      status: statusMap[key] ? 'pass' : (key.startsWith('ticket_') && !ticket ? 'not_observed' : 'fail'),
      severity: statusMap[key] ? 'low' : 'medium',
      evidence: statusMap[key] ? [`Candidate addressed ${key.replace(/_/g, ' ')}`] : [`Candidate did not address ${key.replace(/_/g, ' ')}`],
      notes: statusMap[key] ? 'Adequate' : 'Missing',
    };
  }

  const redFlags: any[] = [];
  if (transcriptLower.includes('just reboot everything') || transcriptLower.includes('buy a new computer')) {
    redFlags.push({ type: 'unsafe_advice', severity: 'high', evidence: 'Candidate gave overly broad or unsafe advice' });
  }
  if (transcriptLower.includes('try this fix') && !transcriptLower.includes('checked')) {
    redFlags.push({ type: 'invented_fix_without_evidence', severity: 'medium', evidence: 'Candidate suggested a fix without verifying' });
  }
  if (!hasUrgency) {
    redFlags.push({ type: 'critical_urgency_missed', severity: 'high', evidence: 'Candidate did not ask about urgency' });
  }

  const missingFields: string[] = [];
  if (!ticketHasUser) missingFields.push('user');
  if (!ticketHasCompany) missingFields.push('company');
  if (!ticketHasImpact) missingFields.push('impact');
  if (!ticketHasUrgency) missingFields.push('urgency');

  return JSON.stringify({
    criteria,
    missed_questions: [],
    red_flags: redFlags,
    ticket_assessment: {
      status: missingFields.length === 0 ? 'pass' : missingFields.length <= 2 ? 'partial' : 'fail',
      missing_fields: missingFields,
      evidence: ticket || 'No ticket submitted',
    },
  });
}

function mockNarrativeFeedback(score: number, rating: string, userPrompt: string): string {
  const hasImprovements = score < 80;
  return JSON.stringify({
    summary: `Candidate scored ${score}/100 (${rating}). The transcript shows typical first-line technician behaviour.`,
    strengths: score >= 70 ? ['Addressed the caller professionally', 'Attempted to gather information'] : [],
    improvements: hasImprovements ? ['Could improve urgency capture', 'Ticket could include more detail'] : [],
    most_costly_miss: hasImprovements ? 'Failed to establish urgency or impact adequately' : '',
    ticket_feedback: 'Ticket was adequate but could include more specific details about impact and next steps.',
    better_phrasing_examples: hasImprovements ? ['"Can you tell me how urgent this is?"', '"What time is your deadline?"'] : [],
    manager_standard_fit: {
      status: score >= 60 ? 'partial' : 'fail',
      notes: hasImprovements ? ['Standards require explicit impact and urgency capture'] : [],
    },
    coaching_focus: hasImprovements ? ['Practice asking about urgency explicitly', 'Improve ticket detail on impact field'] : [],
  });
}

export async function runMockAiTask(
  task: string,
  opts: MockAiTaskOptions
): Promise<MockAiTaskResult> {
  const systemContent = opts.messages.find(m => m.role === 'system')?.content || '';
  const userContent = opts.messages.find(m => m.role === 'user')?.content || '';

  if (task === 'caller' || isCallerPrompt(systemContent)) {
    return {
      success: true,
      content: JSON.stringify({
        reply: 'I see. Can you help me with this? I really need to get it sorted.',
        model_used: 'mock',
        success: true,
      }),
      model: 'mock-caller',
      durationMs: 10,
    };
  }

  if (isEvidenceExtractionPrompt(systemContent)) {
    return {
      success: true,
      content: mockEvidenceExtraction(userContent),
      model: 'mock-evidence',
      durationMs: 20,
    };
  }

  if (isNarrativeFeedbackPrompt(systemContent)) {
    const scoreMatch = userContent.match(/score \((\d+)\)/);
    const ratingMatch = userContent.match(/rating \((\w+)\)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;
    const rating = ratingMatch ? ratingMatch[1] : 'needs_supervision';
    return {
      success: true,
      content: mockNarrativeFeedback(score, rating, userContent),
      model: 'mock-narrative',
      durationMs: 15,
    };
  }

  if (opts.responseFormat === 'json_object') {
    return {
      success: true,
      content: JSON.stringify({
        overall_score: 70,
        readiness_label: 'needs_supervision',
        summary: 'Mock evaluation summary.',
        strengths: ['Mock strength'],
        weaknesses: ['Mock weakness'],
      }),
      model: 'mock-evaluator',
      durationMs: 10,
    };
  }

  return {
    success: true,
    content: 'Mock response.',
    model: 'mock-default',
    durationMs: 5,
  };
}
