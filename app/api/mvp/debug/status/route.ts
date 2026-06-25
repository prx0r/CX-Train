import { initTables, seedDefaults } from '@/lib/mvp/db';
import { ok } from '@/lib/mvp/api/responses';
import { MVP_MODULES } from '@/lib/mvp/modules';
import { MVP_API_ROUTES } from '@/lib/mvp/api/registry';
import { getDatabaseStatus, getTableCounts, getSeedStatus, getLatestAssessments, getLatestAnalysisRuns, getLatestFeedback, getIntegrityWarnings } from '@/lib/mvp/diagnostics/dbDiagnostics';
import { DEFAULT_ORG_ID, DEFAULT_MANAGER_ID } from '@/lib/mvp/defaultContext';

export async function GET() {
  try {
    initTables();
    seedDefaults();

    const dbStatus = getDatabaseStatus();
    const seedStatus = getSeedStatus();
    const counts = getTableCounts();
    const warnings = getIntegrityWarnings();

    const environment = {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      openRouterModel: process.env.AI_EVALUATOR_MODEL || 'openai/gpt-4o-mini',
      dbPath: dbStatus.path,
      defaultOrgId: DEFAULT_ORG_ID,
      defaultManagerId: DEFAULT_MANAGER_ID,
    };

    return ok({
      modules: MVP_MODULES.map(m => ({
        id: m.id,
        label: m.label,
        status: m.status,
        description: m.description,
      })),
      routes: MVP_API_ROUTES.map(r => ({
        module: r.module,
        method: r.method,
        path: r.path,
        status: r.status,
        description: r.description,
      })),
      database: {
        path: dbStatus.path,
        tables: dbStatus.tables,
        counts,
      },
      seeds: seedStatus,
      environment,
      latest: {
        assessments: getLatestAssessments(5),
        analysisRuns: getLatestAnalysisRuns(5),
        feedback: getLatestFeedback(5),
      },
      warnings,
    });
  } catch (err) {
    const { fail } = await import('@/lib/mvp/api/responses');
    return fail('DB_READ_FAILED', 'Failed to collect system status', { error: String(err) });
  }
}
