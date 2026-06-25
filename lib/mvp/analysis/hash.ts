import { createHash } from 'crypto';

export function buildAnalysisInputHash(params: {
  transcriptText: string;
  ticketText: string;
  criteriaVersionId: string | null;
  scenarioId: string | null;
  assessmentPackId: string | null;
  promptVersion: string;
  rubricVersion: string;
  model: string;
}): string {
  const input = [
    params.transcriptText,
    params.ticketText,
    params.criteriaVersionId || '',
    params.scenarioId || '',
    params.assessmentPackId || '',
    params.promptVersion,
    params.rubricVersion,
    params.model,
  ].join('|||');

  return createHash('sha256').update(input).digest('hex');
}
