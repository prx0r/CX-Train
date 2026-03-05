// Types matching DB schema and API contracts

export type UserRole = 'trainee' | 'admin';

export interface User {
  id: string;
  clerk_id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Bot {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  api_key: string;
  prompt_version_history?: Record<string, unknown>[];
  active: boolean;
  created_at: string;
}

export interface Personality {
  id: string;
  bot_id: string;
  name: string;
  archetype: 'uncertain' | 'direct' | 'executive' | 'resistant';
  intensity: 1 | 2 | 3;
  description: string | null;
  avatar_emoji: string;
  stats: PersonalityStats;
  active: boolean;
  created_at: string;
}

export interface PersonalityStats {
  total_calls: number;
  avg_score: number;
  critical_fail_rate: number;
}

export interface Pathway {
  id: string;
  bot_id: string;
  stage: number;
  name: string;
  description: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  priority_override: string | null;
  pass_threshold: number;
  is_boss_battle: boolean;
  requires_ticket_screenshot: boolean;
  unlock_condition: Record<string, unknown> | null;
  created_at: string;
}

export interface Checkpoints {
  name_verified?: boolean;
  company_confirmed?: boolean;
  hostname_gathered?: boolean;
  location_confirmed?: boolean;
  issue_defined?: boolean;
  last_working_asked?: boolean;
  recent_changes_asked?: boolean;
  exact_error_asked?: boolean;
  reboot_asked?: boolean;
  scope_determined?: boolean;
  impact_determined?: boolean;
  priority_assigned?: boolean;
  ticket_expectation_set?: boolean;
  timeframe_given?: boolean;
  callback_window_given?: boolean;
}

export interface TicketScore {
  summary_quality?: 'good' | 'needs_work';
  hostname_populated?: boolean;
  priority_correct?: boolean;
  description_score?: number;
  overall_pass?: boolean;
}

export interface Session {
  id: string;
  user_id: string;
  bot_id: string;
  pathway_stage: number | null;
  personality_id: string | null;
  score: number | null;
  passed: boolean | null;
  pathway_pass: boolean | null;
  checkpoints: Checkpoints;
  hostname_gathered: boolean | null;
  impact_gathered: boolean | null;
  priority_correct: boolean | null;
  priority_assigned: string | null;
  priority_correct_value: string | null;
  issue_family: string | null;
  caller_name: string | null;
  caller_company: string | null;
  caller_role: string | null;
  scope_gathered: boolean | null;
  intensity: number | null;
  ticket_screenshot_url: string | null;
  ticket_assessed: boolean;
  ticket_score: TicketScore | null;
  feedback_text: string | null;
  stronger_phrasing: string[] | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface TraineeProgress {
  id: string;
  user_id: string;
  bot_id: string;
  current_stage: number;
  highest_stage_passed: number;
  total_sessions: number;
  total_passes: number;
  avg_score: number;
  boss_battle_unlocked: boolean;
  boss_battle_passed: boolean;
  boss_battle_attempts: number;
  cleared_for_live: boolean;
  updated_at: string;
}

// API request/response types
export interface SessionPayload {
  bot_id: string;
  tech_name: string;
  pathway_stage: number;
  personality_id?: string | null;
  score: number;
  passed: boolean;
  hostname_gathered: boolean;
  impact_gathered: boolean;
  priority_assigned?: string;
  priority_correct?: string;
  priority_correct_bool?: boolean;
  issue_family?: string;
  caller_name?: string;
  caller_company?: string;
  caller_role?: string;
  scope_gathered?: boolean;
  intensity?: number;
  duration_seconds?: number;
  checkpoints: Checkpoints;
  ticket_assessed?: boolean;
  ticket_score?: TicketScore | null;
  feedback_text?: string;
  stronger_phrasing?: string[];
}

export interface ProgressResponse {
  found: boolean;
  tech_name?: string;
  current_stage?: number;
  highest_stage_passed?: number;
  total_sessions?: number;
  total_passes?: number;
  avg_score?: number;
  boss_battle_unlocked?: boolean;
  boss_battle_passed?: boolean;
  boss_battle_attempts?: number;
  cleared_for_live?: boolean;
  recent_weaknesses?: string[];
  personality_stats?: { name: string; archetype: string; avg_score: number }[];
}

export const CHECKPOINT_KEYS = [
  'name_verified',
  'company_confirmed',
  'hostname_gathered',
  'location_confirmed',
  'issue_defined',
  'last_working_asked',
  'recent_changes_asked',
  'exact_error_asked',
  'reboot_asked',
  'scope_determined',
  'impact_determined',
  'priority_assigned',
  'ticket_expectation_set',
  'timeframe_given',
  'callback_window_given',
] as const;
