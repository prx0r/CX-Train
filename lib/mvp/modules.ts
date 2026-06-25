export type ModuleStatus = 'active' | 'partial' | 'planned' | 'not_built';

export interface MvpModule {
  id: string;
  label: string;
  status: ModuleStatus;
  description: string;
  icon: string;
}

export const MVP_MODULES: MvpModule[] = [
  {
    id: 'assess',
    label: 'Assess',
    status: 'active',
    description: 'Candidate support-call simulations and evaluation.',
    icon: '📋',
  },
  {
    id: 'standards',
    label: 'Standards',
    status: 'active',
    description: 'Manager-defined MSP standards for ticket fields, call requirements, and tone preferences.',
    icon: '⚙',
  },
  {
    id: 'analysis',
    label: 'Analysis',
    status: 'active',
    description: 'AI-driven analysis pipeline with caching, input hashing, and versioned prompts.',
    icon: '🔬',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    status: 'active',
    description: 'Manager review and feedback on analysis results.',
    icon: '💬',
  },
  {
    id: 'assist',
    label: 'Assist',
    status: 'planned',
    description: 'Tech-facing ticket/customer response assistant.',
    icon: '💡',
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    status: 'planned',
    description: 'Capture resolved interactions into reusable procedures and KB articles.',
    icon: '📘',
  },
  {
    id: 'clients',
    label: 'Clients',
    status: 'planned',
    description: 'Client profiles, environment details, and issue history.',
    icon: '🏢',
  },
  {
    id: 'people',
    label: 'People',
    status: 'planned',
    description: 'Scorecards, readiness levels, and growth tracking for each technician.',
    icon: '👤',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    status: 'planned',
    description: 'Cross-candidate trends, module usage, and performance metrics.',
    icon: '📊',
  },
  {
    id: 'settings',
    label: 'Settings',
    status: 'not_built',
    description: 'Org configuration, user management, and integration settings.',
    icon: '🔧',
  },
];

export function getModule(id: string): MvpModule | undefined {
  return MVP_MODULES.find(m => m.id === id);
}

export function getActiveModules(): MvpModule[] {
  return MVP_MODULES.filter(m => m.status === 'active');
}

export function getModuleStatusSummary(): Record<ModuleStatus, number> {
  return {
    active: MVP_MODULES.filter(m => m.status === 'active').length,
    partial: MVP_MODULES.filter(m => m.status === 'partial').length,
    planned: MVP_MODULES.filter(m => m.status === 'planned').length,
    not_built: MVP_MODULES.filter(m => m.status === 'not_built').length,
  };
}
