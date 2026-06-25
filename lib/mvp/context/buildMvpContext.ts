import { getDb } from '@/lib/mvp/db';
import {
  getAssessment,
  getAssessmentByToken,
  getSessionByAssessment,
  getMessages,
  getTicket,
  getManagerStandards,
  getResult,
  getFeedback,
  getAnalysisRunsByAssessment,
} from '@/lib/mvp/query';
import { DEFAULT_ORG_ID, DEFAULT_MANAGER_ID } from '@/lib/mvp/defaultContext';
import { ERROR_CODES, type ErrorCode } from '@/lib/mvp/api/errors';

export interface MvpContextOptions {
  assessmentId?: string;
  token?: string;
  sessionId?: string;
  managerId?: string;
  orgId?: string;
  include?: {
    assessment?: boolean;
    session?: boolean;
    messages?: boolean;
    ticket?: boolean;
    standards?: boolean;
    analysisRuns?: boolean;
    results?: boolean;
    feedback?: boolean;
  };
}

export interface MvpContext {
  orgId: string;
  managerId: string;
  assessment: Record<string, unknown> | null;
  session: Record<string, unknown> | null;
  messages: Record<string, unknown>[];
  ticket: Record<string, unknown> | null;
  standards: Record<string, unknown> | null;
  analysisRuns: Record<string, unknown>[];
  results: Record<string, unknown>[];
  feedback: Record<string, unknown> | null;
}

export interface MvpContextResult {
  ok: boolean;
  context?: MvpContext;
  partialContext?: Partial<MvpContext>;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  warnings: string[];
}

function hasWarning(arr: string[], msg: string): boolean {
  return arr.some(w => w.startsWith(msg.split(':')[0]));
}

export function buildMvpContext(options: MvpContextOptions): MvpContextResult {
  const warnings: string[] = [];
  const orgId = options.orgId || DEFAULT_ORG_ID;
  const managerId = options.managerId || DEFAULT_MANAGER_ID;

  const ctx: Partial<MvpContext> = {
    orgId,
    managerId,
    assessment: null,
    session: null,
    messages: [],
    ticket: null,
    standards: null,
    analysisRuns: [],
    results: [],
    feedback: null,
  };

  let resolvedAssessmentId = options.assessmentId;

  if (!resolvedAssessmentId && options.token) {
    const assessment = getAssessmentByToken(options.token);
    if (assessment) {
      resolvedAssessmentId = assessment.id;
      if (options.include?.assessment !== false) {
        ctx.assessment = assessment as any;
      }
    } else {
      return {
        ok: false,
        error: { code: ERROR_CODES.TOKEN_NOT_FOUND.code, message: ERROR_CODES.TOKEN_NOT_FOUND.message },
        partialContext: ctx,
        warnings,
      };
    }
  }

  if (resolvedAssessmentId) {
    if (options.include?.assessment !== false && !ctx.assessment) {
      const assessment = getAssessment(resolvedAssessmentId);
      if (!assessment) {
        return {
          ok: false,
          error: { code: ERROR_CODES.ASSESSMENT_NOT_FOUND.code, message: ERROR_CODES.ASSESSMENT_NOT_FOUND.message },
          partialContext: ctx,
          warnings,
        };
      }
      ctx.assessment = assessment as any;
    }

    const assessment = ctx.assessment as any;

    if (options.include?.session !== false) {
      const session = getSessionByAssessment(resolvedAssessmentId);
      if (session) {
        ctx.session = session as any;

        if (options.include?.messages !== false) {
          const msgs = getMessages(session.id);
          ctx.messages = msgs as any;
          if (msgs.length === 0) {
            warnings.push('Session has no messages');
          }
        }

        if (options.include?.ticket !== false) {
          const ticket = getTicket(session.id);
          ctx.ticket = ticket as any;
          if (!ticket) {
            warnings.push('No ticket submitted for this session');
          }
        }
      } else {
        warnings.push('No session found for this assessment');
      }
    }

    if (options.include?.standards !== false) {
      const standards = getManagerStandards(orgId, managerId);
      ctx.standards = standards ? (standards as any) : null;
      if (!standards) {
        warnings.push('No manager standards configured');
      }
    }

    if (options.include?.analysisRuns !== false) {
      const runs = getAnalysisRunsByAssessment(resolvedAssessmentId);
      ctx.analysisRuns = runs as any;
    }

    if (options.include?.results !== false) {
      const result = getResult(resolvedAssessmentId);
      ctx.results = result ? [result as any] : [];
    }

    if (options.include?.feedback !== false) {
      const feedback = getFeedback(resolvedAssessmentId);
      ctx.feedback = feedback as any;
    }
  } else if (options.include?.standards !== false) {
    const standards = getManagerStandards(orgId, managerId);
    ctx.standards = standards ? (standards as any) : null;
    if (!standards) {
      warnings.push('No manager standards configured');
    }
  }

  return {
    ok: true,
    context: ctx as MvpContext,
    warnings,
  };
}
