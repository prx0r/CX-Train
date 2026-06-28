import { registerCapability, listCapabilities, invokeCapability, getCapability } from './registry';
import { getAssessmentReviewContextCapability } from './assessment';
import { listSimPacksCapability } from './simPack';
import { getManagerStandardsCapability } from './standards';
import { draftTrainingAssignmentCapability } from './training';

let registered = false;

export function ensureDefaultCapabilitiesRegistered(): void {
  if (registered) return;
  registerCapability(getAssessmentReviewContextCapability);
  registerCapability(listSimPacksCapability);
  registerCapability(getManagerStandardsCapability);
  registerCapability(draftTrainingAssignmentCapability);
  registered = true;
}

export {
  getCapability,
  invokeCapability,
  listCapabilities,
};
