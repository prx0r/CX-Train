import type { GraphState } from '../state';
import { resolveManagerProfile } from '../../callum/manager-profile';

export function loadProfileNode(state: GraphState): Partial<GraphState> {
  const profileId = resolveManagerProfile(state.managerProfileId);
  return { managerProfileId: profileId };
}
