export { CALLUM_BASELINE_V1 } from './callum-baseline';
export { CYBER_ESSENTIALS_2025 } from './cyber-essentials-2025';
export { GDPR_2018 } from './gdpr-2018';
export { ISO_27001_2022 } from './iso-27001-2022';
export { KEPNER_TREGOE } from './kepner-tregoe';
export { SERVQUAL } from './servqual';
export { SBAR_COMMUNICATION } from './sbar-communication';
export { LEAP_HEAT_RUBRIC } from './leap-heat-rubric';
export { ITIL_INCIDENT_MGMT } from './itil-incident-mgmt';
export { ITIL_SERVICE_DESK } from './itil-service-desk';

import { FrameworkDefinition } from '../evaluator';
import { CALLUM_BASELINE_V1 } from './callum-baseline';
import { CYBER_ESSENTIALS_2025 } from './cyber-essentials-2025';
import { GDPR_2018 } from './gdpr-2018';
import { ISO_27001_2022 } from './iso-27001-2022';
import { KEPNER_TREGOE } from './kepner-tregoe';
import { SERVQUAL } from './servqual';
import { SBAR_COMMUNICATION } from './sbar-communication';
import { LEAP_HEAT_RUBRIC } from './leap-heat-rubric';
import { ITIL_INCIDENT_MGMT } from './itil-incident-mgmt';
import { ITIL_SERVICE_DESK } from './itil-service-desk';

export const DEFAULT_FRAMEWORKS: FrameworkDefinition[] = [
  CALLUM_BASELINE_V1,
  CYBER_ESSENTIALS_2025,
  GDPR_2018,
  ISO_27001_2022,
  KEPNER_TREGOE,
  SERVQUAL,
  SBAR_COMMUNICATION,
  LEAP_HEAT_RUBRIC,
  ITIL_INCIDENT_MGMT,
  ITIL_SERVICE_DESK,
];

export function getFrameworksById(ids: string[]): FrameworkDefinition[] {
  const all = DEFAULT_FRAMEWORKS;
  return all.filter(fw => ids.includes(fw.id));
}
