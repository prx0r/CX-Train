-- Migration: Feedback Analysis System and Level Tracking
-- Date: 2026-03-22

-- Feedback Analysis Table (stores AI-generated analysis of training sessions)
create table feedback_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  bot_id text references bots(id) on delete cascade,
  analysis_type text not null, -- 'individual', 'aggregate', 'prompt_review'
  patterns text[] default '{}',
  weaknesses text[] default '{}',
  recommendations text[] default '{}',
  suggested_prompt_changes text[] default '{}',
  confidence_score numeric(3,2) default 0.0, -- 0.0 to 1.0
  created_at timestamptz default now(),
  reviewed boolean default false,
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  approved boolean default false,
  admin_notes text
);

-- Level History Table (tracks level progression)
create table level_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  bot_id text references bots(id) on delete cascade,
  previous_level int not null,
  new_level int not null,
  promoted_by uuid references users(id),
  promoted_at timestamptz default now(),
  reason text, -- 'automatic', 'manual', 'assessment'
  notes text
);

-- AI Monitor Logs (tracks automated monitoring and insights)
create table ai_monitor_logs (
  id uuid primary key default gen_random_uuid(),
  bot_id text references bots(id) on delete cascade,
  monitor_type text not null, -- 'pattern_detection', 'prompt_review', 'aggregate_analysis'
  status text not null, -- 'running', 'completed', 'failed'
  sessions_analyzed int default 0,
  insights jsonb default '{}',
  suggested_actions text[] default '{}',
  alert_level text default 'info', -- 'info', 'warning', 'critical'
  created_at timestamptz default now(),
  completed_at timestamptz,
  error_message text
);

-- User Profile Enhancements (if not already present)
-- Add display_name and training_code support
alter table users add column if not exists display_name text;
alter table users add column if not exists training_code text unique;
alter table users add column if not exists preferred_name text;

-- Session enhancements for better tracking
alter table sessions add column if not exists tech_name_raw text;
alter table sessions add column if not exists analysis_id uuid references feedback_analysis(id);

-- Create indexes for performance
create index feedback_analysis_user_id_idx on feedback_analysis(user_id);
create index feedback_analysis_bot_id_idx on feedback_analysis(bot_id);
create index feedback_analysis_created_at_idx on feedback_analysis(created_at desc);
create index feedback_analysis_reviewed_idx on feedback_analysis(reviewed) where reviewed = false;

create index level_history_user_id_idx on level_history(user_id);
create index level_history_bot_id_idx on level_history(bot_id);
create index level_history_promoted_at_idx on level_history(promoted_at desc);

create index ai_monitor_logs_bot_id_idx on ai_monitor_logs(bot_id);
create index ai_monitor_logs_created_at_idx on ai_monitor_logs(created_at desc);
create index ai_monitor_logs_alert_level_idx on ai_monitor_logs(alert_level);

-- Row Level Security Policies
alter table feedback_analysis enable row level security;
alter table level_history enable row level security;
alter table ai_monitor_logs enable row level security;

-- Trainees can see their own analysis
-- Note: Users with trainee role will only see their own data due to the subquery
-- The policy handles both direct user access and admin access
create policy "trainee_own_feedback_analysis" on feedback_analysis
  for select using (
    user_id = (select id from users where clerk_id = auth.uid()::text)
    or exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin')
  );

create policy "trainee_own_level_history" on level_history
  for select using (
    user_id = (select id from users where clerk_id = auth.uid()::text)
    or exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin')
  );

-- Admins can manage all analysis
create policy "admin_all_feedback_analysis" on feedback_analysis
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "admin_all_level_history" on level_history
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "admin_all_ai_monitor_logs" on ai_monitor_logs
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

-- Service role access for API routes
create policy "service_role_feedback_analysis" on feedback_analysis
  for all using (auth.role() = 'service_role');

create policy "service_role_level_history" on level_history
  for all using (auth.role() = 'service_role');

create policy "service_role_ai_monitor_logs" on ai_monitor_logs
  for all using (auth.role() = 'service_role');

-- Function to get recent analysis for a user
create or replace function get_user_recent_analysis(
  p_user_id uuid,
  p_bot_id text,
  p_limit int default 1
)
returns setof feedback_analysis
language sql
stable
as $$
  select * from feedback_analysis
  where user_id = p_user_id
    and bot_id = p_bot_id
  order by created_at desc
  limit p_limit;
$$;

-- Function to check if user can level up
create or replace function can_user_level_up(
  p_user_id uuid,
  p_bot_id text
)
returns table (
  can_level boolean,
  current_level int,
  target_level int,
  points_earned int,
  points_required int,
  requirements_met text[],
  requirements_pending text[]
)
language plpgsql
stable
as $$
declare
  v_current_level int;
  v_total_sessions int;
  v_avg_score numeric;
  v_level_points int;
begin
  -- Get current progress
  select 
    coalesce(tp.level, 1),
    coalesce(tp.total_sessions, 0),
    coalesce(tp.avg_score, 0),
    coalesce(tp.level_points, 0)
  into v_current_level, v_total_sessions, v_avg_score, v_level_points
  from trainee_progress tp
  where tp.user_id = p_user_id and tp.bot_id = p_bot_id;

  -- Level 2 requirements (40 points, 5 sessions, 75 avg score)
  if v_current_level = 1 then
    return query select
      (v_level_points >= 40 and v_total_sessions >= 5 and v_avg_score >= 75)::boolean,
      v_current_level,
      2,
      v_level_points,
      40,
      array[
        case when v_level_points >= 40 then 'Points: ' || v_level_points || '/40' end,
        case when v_total_sessions >= 5 then 'Sessions: ' || v_total_sessions || '/5' end,
        case when v_avg_score >= 75 then 'Avg Score: ' || round(v_avg_score::numeric, 1) || '/75' end
      ] filter (where true),
      array[
        case when v_level_points < 40 then 'Points: ' || v_level_points || '/40' end,
        case when v_total_sessions < 5 then 'Sessions: ' || v_total_sessions || '/5' end,
        case when v_avg_score < 75 then 'Avg Score: ' || round(v_avg_score::numeric, 1) || '/75' end
      ] filter (where true);
  end if;

  -- Level 3 requirements (80 points, 15 sessions, 85 avg score)
  if v_current_level = 2 then
    return query select
      (v_level_points >= 80 and v_total_sessions >= 15 and v_avg_score >= 85)::boolean,
      v_current_level,
      3,
      v_level_points,
      80,
      array[
        case when v_level_points >= 80 then 'Points: ' || v_level_points || '/80' end,
        case when v_total_sessions >= 15 then 'Sessions: ' || v_total_sessions || '/15' end,
        case when v_avg_score >= 85 then 'Avg Score: ' || round(v_avg_score::numeric, 1) || '/85' end
      ] filter (where true),
      array[
        case when v_level_points < 80 then 'Points: ' || v_level_points || '/80' end,
        case when v_total_sessions < 15 then 'Sessions: ' || v_total_sessions || '/15' end,
        case when v_avg_score < 85 then 'Avg Score: ' || round(v_avg_score::numeric, 1) || '/85' end
      ] filter (where true);
  end if;

  -- Max level reached
  return query select
    false,
    v_current_level,
    v_current_level,
    v_level_points,
    0,
    array['Maximum level achieved']::text[],
    array[]::text[];
end;
$$;

-- Comment on new tables
comment on table feedback_analysis is 'Stores AI-generated analysis of trainee performance and patterns';
comment on table level_history is 'Tracks level progression history for trainees';
comment on table ai_monitor_logs is 'Logs automated AI monitoring runs and detected patterns';
