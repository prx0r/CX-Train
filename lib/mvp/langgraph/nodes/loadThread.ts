import type { GraphState } from '../state';
import { getOrCreateCallumThread } from '../../callum/memory';

export function loadThreadNode(state: GraphState): Partial<GraphState> {
  const thread = getOrCreateCallumThread({
    threadId: state.threadId || null,
    managerProfileId: state.managerProfileId,
    pageContext: state.pageContext,
  });

  return { thread, threadId: thread.id };
}
