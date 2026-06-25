import { createHash } from 'crypto';

export const ANALYSIS_SCHEMA_VERSION = 'base-callum-deterministic-v1';

export function buildAnalysisInputHash(params: {
  transcriptText: string;
  ticketText: string;
  criteriaVersionId: string | null;
  scenarioId: string | null;
  assessmentPackId: string | null;
  promptVersion: string;
  rubricVersion: string;
  model: string;
  managerStandardsContent?: string;
  schemaVersion?: string;
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
    params.managerStandardsContent || '',
    params.schemaVersion || ANALYSIS_SCHEMA_VERSION,
  ].join('|||');

  return createHash('sha256').update(input).digest('hex');
}
