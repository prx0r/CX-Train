import { getDb } from '../db';
import { makeId } from '../query';
import type { CallumPageContext } from '../contracts/page-context';

export interface CallumThread {
  id: string;
  managerProfileId: string;
  assessmentId?: string | null;
  pageRoute?: string | null;
}

export function getOrCreateCallumThread(params: {
  threadId?: string | null;
  managerProfileId: string;
  pageContext?: CallumPageContext | null;
}): CallumThread {
  const db = getDb();

  if (params.threadId) {
    const existing = db.prepare('SELECT * FROM callum_threads WHERE id = ?').get(params.threadId) as any;
    if (existing) {
      return {
        id: existing.id,
        managerProfileId: existing.manager_profile_id,
        assessmentId: existing.assessment_id,
        pageRoute: existing.page_route,
      };
    }
  }

  const id = makeId();
  const assessmentId = params.pageContext?.entity?.type === 'assessment'
    ? params.pageContext.entity.id || null
    : null;
  const pageRoute = params.pageContext?.route || null;

  db.prepare(`
    INSERT INTO callum_threads (id, manager_profile_id, assessment_id, page_route, title, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    id,
    params.managerProfileId,
    assessmentId,
    pageRoute,
    assessmentId ? `Assessment ${assessmentId}` : 'Callum thread',
  );

  return { id, managerProfileId: params.managerProfileId, assessmentId, pageRoute };
}

export function appendCallumMessage(params: {
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO callum_messages (id, thread_id, role, content, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(
    makeId(),
    params.threadId,
    params.role,
    params.content,
    params.metadata ? JSON.stringify(params.metadata) : null,
  );
  db.prepare('UPDATE callum_threads SET updated_at = datetime(\'now\') WHERE id = ?').run(params.threadId);
}
