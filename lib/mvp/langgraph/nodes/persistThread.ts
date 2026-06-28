import type { GraphState } from '../state';
import { appendCallumMessage } from '../../callum/memory';

export function persistThreadNode(state: GraphState): Partial<GraphState> {
  const threadId = state.thread?.id || state.threadId;
  if (!threadId) {
    return { errors: [...state.errors, 'No thread to persist to'] };
  }

  appendCallumMessage({
    threadId,
    role: 'user',
    content: state.message,
    metadata: state.pageContext ? { pageContext: state.pageContext } : undefined,
  });

  if (state.response) {
    const meta: Record<string, unknown> = { type: state.response.type };
    if (state.response.pendingActionId) meta.pendingActionId = state.response.pendingActionId;
    if (state.response.targetRoute) meta.targetRoute = state.response.targetRoute;

    appendCallumMessage({
      threadId,
      role: 'assistant',
      content: state.response.message,
      metadata: meta,
    });
  }

  return {};
}
