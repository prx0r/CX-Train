export type RouteStatus = 'active' | 'planned';

export interface MvpApiRoute {
  module: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  status: RouteStatus;
  description: string;
  expectedInputs?: string[];
  expectedOutputs?: string[];
}

export const MVP_API_ROUTES: MvpApiRoute[] = [
  {
    module: 'assess',
    method: 'POST',
    path: '/api/mvp/assessments',
    status: 'active',
    description: 'Create assessment invite',
    expectedInputs: ['candidateName', 'candidateEmail'],
    expectedOutputs: ['assessmentId', 'inviteUrl', 'token'],
  },
  {
    module: 'assess',
    method: 'GET',
    path: '/api/mvp/assessments',
    status: 'active',
    description: 'List all assessments',
    expectedOutputs: ['assessments[]'],
  },
  {
    module: 'assess',
    method: 'GET',
    path: '/api/mvp/assessment/[token]',
    status: 'active',
    description: 'Get assessment by invite token (candidate-facing)',
    expectedOutputs: ['id', 'title', 'candidateName', 'status', 'messages'],
  },
  {
    module: 'assess',
    method: 'POST',
    path: '/api/mvp/assessment/[token]/message',
    status: 'active',
    description: 'Send candidate message and get AI caller reply',
    expectedInputs: ['message'],
    expectedOutputs: ['reply', 'modelUsed', 'success'],
  },
  {
    module: 'assess',
    method: 'POST',
    path: '/api/mvp/assessment/[token]/ticket',
    status: 'active',
    description: 'Submit candidate ticket',
    expectedInputs: ['ticket'],
    expectedOutputs: ['status', 'message'],
  },
  {
    module: 'assess',
    method: 'GET',
    path: '/api/mvp/assessments/[id]',
    status: 'active',
    description: 'Get assessment detail by ID (manager-facing)',
    expectedOutputs: ['assessment', 'session', 'messages', 'ticket', 'result', 'feedback'],
  },
  {
    module: 'analysis',
    method: 'POST',
    path: '/api/mvp/assessments/[id]/analyse',
    status: 'active',
    description: 'Run AI analysis on completed assessment',
    expectedInputs: [],
    expectedOutputs: ['status', 'overallScore', 'readinessLabel', 'summary'],
  },
  {
    module: 'feedback',
    method: 'POST',
    path: '/api/mvp/assessments/[id]/feedback',
    status: 'active',
    description: 'Submit manager feedback on analysis',
    expectedInputs: ['managerLabel', 'managerScore', 'notes'],
    expectedOutputs: ['status', 'feedbackId'],
  },
  {
    module: 'standards',
    method: 'GET',
    path: '/api/mvp/standards',
    status: 'active',
    description: 'Get current manager standards',
    expectedOutputs: ['standards'],
  },
  {
    module: 'standards',
    method: 'POST',
    path: '/api/mvp/standards',
    status: 'active',
    description: 'Update manager standards',
    expectedInputs: ['requiredTicketFields', 'callRequirements', 'tonePreferences'],
    expectedOutputs: ['standards', 'saved'],
  },
  {
    module: 'system',
    method: 'GET',
    path: '/api/mvp/debug/status',
    status: 'active',
    description: 'Get system-wide status overview (developer/manager)',
    expectedOutputs: ['modules', 'routes', 'database', 'seeds', 'environment', 'latest'],
  },
  {
    module: 'system',
    method: 'GET',
    path: '/api/mvp/debug/assessment/[id]',
    status: 'active',
    description: 'Debug assessment: full backend state and integrity check',
    expectedOutputs: ['assessment', 'session', 'messages', 'ticket', 'integrity'],
  },
  {
    module: 'assist',
    method: 'GET',
    path: '/api/mvp/assist',
    status: 'planned',
    description: 'Assist module — placeholder',
  },
  {
    module: 'assist',
    method: 'POST',
    path: '/api/mvp/assist',
    status: 'planned',
    description: 'Assist module — placeholder',
  },
  {
    module: 'knowledge',
    method: 'GET',
    path: '/api/mvp/knowledge',
    status: 'planned',
    description: 'Knowledge module — placeholder',
  },
  {
    module: 'clients',
    method: 'GET',
    path: '/api/mvp/clients',
    status: 'planned',
    description: 'Clients module — placeholder',
  },
  {
    module: 'people',
    method: 'GET',
    path: '/api/mvp/people',
    status: 'planned',
    description: 'People / Scorecards module — placeholder',
  },
];

export function getActiveRoutes(): MvpApiRoute[] {
  return MVP_API_ROUTES.filter(r => r.status === 'active');
}

export function getRoutesByModule(moduleId: string): MvpApiRoute[] {
  return MVP_API_ROUTES.filter(r => r.module === moduleId);
}

export const LEGACY_RESPONSE_FORMAT_ROUTES = [
  'POST /api/mvp/assessments',
  'GET /api/mvp/assessments',
  'GET /api/mvp/assessment/[token]',
  'POST /api/mvp/assessment/[token]/message',
  'POST /api/mvp/assessment/[token]/ticket',
  'GET /api/mvp/assessments/[id]',
  'POST /api/mvp/assessments/[id]/analyse',
  'POST /api/mvp/assessments/[id]/feedback',
  'GET /api/mvp/standards',
  'POST /api/mvp/standards',
];
