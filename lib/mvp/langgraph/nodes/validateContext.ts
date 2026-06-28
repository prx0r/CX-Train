import type { GraphState } from '../state';
import { validateCallumPageContext } from '../../contracts/page-context';

export function validateContextNode(state: GraphState): Partial<GraphState> {
  if (!state.pageContext) {
    return { pageContext: null };
  }

  const result = validateCallumPageContext(state.pageContext);
  if (!result.valid) {
    return {
      pageContext: null,
      errors: [...state.errors, `Invalid pageContext: ${result.errors.map(e => e.message).join('; ')}`],
    };
  }

  return { pageContext: result.data || null };
}
