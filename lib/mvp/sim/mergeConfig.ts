import { SimPack, SimPackScoringCriterion, SCORING_CATEGORIES } from './types';
import type { ScoringConfig } from './scoring';

export interface ManagerScoringOverrides {
  global?: {
    categoryWeights?: Record<string, number>;
    mandatoryCheckpoints?: string[];
    thresholds?: { ready?: number; needs_supervision?: number; };
  };
  perPack?: Record<string, {
    criteriaOverrides?: Array<{
      id: string;
      action: 'override' | 'remove' | 'add_weight';
      weight?: number;
      mandatory?: boolean;
      label?: string;
      category?: string;
      delta?: number;
    }>;
    customCriteria?: Array<{
      id: string;
      label: string;
      description: string;
      category: string;
      weight: number;
      mandatory: boolean;
      check: 'action_performed' | 'tag_present' | 'tag_in_event' | 'state_value' | 'fact_revealed';
      target: string;
      value?: unknown;
      positive: boolean;
    }>;
    customRedFlags?: Array<{
      id: string;
      severity: 'minor' | 'major' | 'critical';
      message: string;
      checkType: string;
      checkTarget: string;
      scoreCap?: number;
    }>;
    categoryWeights?: Record<string, number>;
    mandatoryCheckpoints?: string[];
    thresholds?: { ready?: number; needs_supervision?: number; };
  }>;
}

export function mergeAssessmentConfig(params: {
  pack: SimPack;
  managerStandardsOverrides: string | null;
  packId: string;
}): ScoringConfig {
  const { pack, managerStandardsOverrides, packId } = params;

  const defaults = pack.scoringDefaults;

  /* Start with pack defaults */
  let criteria = defaults.criteria.map(c => ({ ...c }));
  let mandatoryCheckpoints = [...(defaults.mandatoryCheckpoints || [])];
  let categoryWeights = { ...(defaults.categoryWeights || {}) };
  let thresholds = { ...(defaults.thresholds || { ready: 80, needs_supervision: 60 }) };
  let redFlags = [...(defaults.redFlags || [])];

  let overrides: ManagerScoringOverrides | null = null;
  if (managerStandardsOverrides) {
    try {
      overrides = JSON.parse(managerStandardsOverrides);
    } catch {
      /* ignore parse error */
    }
  }

  if (overrides) {
    /* Apply global overrides */
    if (overrides.global?.categoryWeights) {
      categoryWeights = { ...categoryWeights, ...overrides.global.categoryWeights };
    }
    if (overrides.global?.mandatoryCheckpoints) {
      for (const cp of overrides.global.mandatoryCheckpoints) {
        if (!mandatoryCheckpoints.includes(cp)) {
          mandatoryCheckpoints.push(cp);
        }
      }
    }
    if (overrides.global?.thresholds) {
      thresholds = { ...thresholds, ...overrides.global.thresholds };
    }

    /* Apply per-pack overrides */
    const packOverrides = overrides.perPack?.[packId];
    if (packOverrides) {
      if (packOverrides.criteriaOverrides) {
        for (const override of packOverrides.criteriaOverrides) {
          const idx = criteria.findIndex(c => c.id === override.id);
          if (override.action === 'remove' && idx !== -1) {
            criteria.splice(idx, 1);
          } else if (override.action === 'override' && idx !== -1) {
            if (override.weight !== undefined) criteria[idx].weight = override.weight;
            if (override.mandatory !== undefined) criteria[idx].mandatory = override.mandatory;
            if (override.label !== undefined) criteria[idx].label = override.label;
            if (override.category !== undefined) criteria[idx].category = override.category as any;
          } else if (override.action === 'add_weight' && idx !== -1) {
            criteria[idx].weight += (override.delta || 0);
          }
        }
      }

      if (packOverrides.customCriteria) {
        for (const cc of packOverrides.customCriteria) {
          if (!criteria.find(c => c.id === cc.id)) {
            criteria.push(cc as any);
          }
        }
      }

      if (packOverrides.categoryWeights) {
        categoryWeights = { ...categoryWeights, ...packOverrides.categoryWeights };
      }
      if (packOverrides.mandatoryCheckpoints) {
        for (const cp of packOverrides.mandatoryCheckpoints) {
          if (!mandatoryCheckpoints.includes(cp)) {
            mandatoryCheckpoints.push(cp);
          }
        }
      }
      if (packOverrides.thresholds) {
        thresholds = { ...thresholds, ...packOverrides.thresholds };
      }
    }
  }

  /* Ensure category weights are valid — fill defaults from pack rubric if empty */
  if (Object.keys(categoryWeights).length === 0) {
    const rubric = pack.rubric || {};
    for (const [key, entry] of Object.entries(rubric)) {
      categoryWeights[key] = (entry as any).weight || 10;
    }
  }

  return {
    version: pack.version,
    categoryWeights,
    criteria,
    mandatoryCheckpoints,
    redFlags,
    diagnosticChecklist: defaults.diagnosticChecklist || [],
    failGates: defaults.failGates || [],
    derivedGates: defaults.derivedGates || [],
    thresholds,
    idealTicket: defaults.idealTicket || { summary: '', requiredFields: [] },
  };
}

export function buildDefaultScoringDefaultsFromRubric(
  packTitle: string,
  rubric: Record<string, { weight: number; label?: string }>,
  redFlags: { id: string; severity: 'minor' | 'major' | 'critical'; message: string }[],
  idealTicket: { summary: string; requiredFields: string[] },
  existingCriteria?: SimPackScoringCriterion[],
  checkpoints?: { id: string; label: string; criteria: string }[]
): ScoringConfig {
  return {
    categoryWeights: (() => {
      const w: Record<string, number> = {};
      for (const [key, entry] of Object.entries(rubric)) {
        w[key] = entry.weight;
      }
      return w;
    })(),
    criteria: existingCriteria || [],
    mandatoryCheckpoints: [],
    redFlags,
    diagnosticChecklist: checkpoints || [],
    failGates: [
      { id: 'severe_conduct', label: 'Severe customer conduct failure', severity: 'critical', scoreCap: 10, overrideReadiness: 'not_ready', redFlagType: 'severe_customer_abuse' },
      { id: 'unsafe_security', label: 'Unsafe security behaviour', severity: 'critical', scoreCap: 25, overrideReadiness: 'not_ready', redFlagType: 'unsafe_security_behaviour' },
    ],
    derivedGates: [],
    thresholds: { ready: 80, needs_supervision: 60 },
    idealTicket,
  };
}
