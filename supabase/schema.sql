-- Connexion Training Hub - Supabase Schema
-- Run this in the Supabase SQL editor

-- USERS (synced from Clerk via webhook on user.created)
create table users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  name text not null,
  email text not null,
  role text not null default 'trainee',
  is_stub boolean default false,
  created_at timestamptz default now()
);

-- GPT BOTS (one row per Custom GPT)
create table bots (
  id text primary key,
  name text not null,
  description text,
  system_prompt text,
  api_key text not null,
  prompt_version_history jsonb default '[]',
  active boolean default true,
  bot_type text default 'other',
  created_at timestamptz default now()
);

-- PERSONALITIES (caller personas for the call sim bot)
create table personalities (
  id uuid primary key default gen_random_uuid(),
  bot_id text references bots(id),
  name text not null,
  archetype text not null,
  intensity int check (intensity between 1 and 3),
  description text,
  avatar_emoji text default 'ðŸ‘¤',
  stats jsonb default '{"total_calls": 0, "avg_score": 0, "critical_fail_rate": 0}',
  active boolean default true,
  created_at timestamptz default now()
);

-- PATHWAYS (ordered training stages per bot)
create table pathways (
  id uuid primary key default gen_random_uuid(),
  bot_id text references bots(id),
  stage int not null,
  name text not null,
  description text,
  difficulty text,
  priority_override text,
  pass_threshold int default 75,
  is_boss_battle boolean default false,
  requires_ticket_screenshot boolean default false,
  unlock_condition jsonb,
  created_at timestamptz default now(),
  unique(bot_id, stage)
);

-- SESSIONS (one row per completed call simulation)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  bot_id text references bots(id),
  pathway_stage int,
  personality_id uuid references personalities(id),
  score int,\n  score_points int,\n  score_breakdown jsonb,\n  rubric_evidence jsonb,\n
  passed boolean,
  pathway_pass boolean,
  checkpoints jsonb not null default '{}',
  hostname_gathered boolean,
  impact_gathered boolean,
  priority_correct boolean,\n  severity_level text,\n  impact_level text,
  priority_assigned text,
  priority_correct_value text,
  issue_family text,
  caller_name text,
  caller_company text,
  caller_role text,
  scope_gathered boolean,
  intensity int,
  ticket_screenshot_url text,
  ticket_assessed boolean default false,
  ticket_score jsonb,
  feedback_text text,
  stronger_phrasing text[],
  duration_seconds int,
  created_at timestamptz default now()
);

-- TRAINEE PROGRESS (one row per user per bot)
create table trainee_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  bot_id text references bots(id),
  current_stage int default 1,
  highest_stage_passed int default 0,
  total_sessions int default 0,
  total_passes int default 0,
  avg_score numeric(5,2) default 0,
  score_sum int default 0,
  boss_battle_unlocked boolean default false,
  boss_battle_passed boolean default false,
  boss_battle_attempts int default 0,
  cleared_for_live boolean default false,
  level int default 1,
  level_points int default 0,
  updated_at timestamptz default now(),
  unique(user_id, bot_id)
);

-- BOT DOCUMENTS (text files for use in prompts)
create table bot_documents (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null references bots(id) on delete cascade,
  filename text not null,
  content text not null,
  content_type text default 'text/plain',
  created_at timestamptz default now()
);

create index bot_documents_bot_id_idx on bot_documents(bot_id);
create index sessions_user_id_idx on sessions(user_id);
create index sessions_bot_id_idx on sessions(bot_id);
create index sessions_created_at_idx on sessions(created_at);
create index trainee_progress_user_id_idx on trainee_progress(user_id);

-- ROW LEVEL SECURITY
alter table users enable row level security;
alter table sessions enable row level security;
alter table trainee_progress enable row level security;
alter table bots enable row level security;
alter table personalities enable row level security;
alter table pathways enable row level security;

-- Policies: trainees see only their own data
create policy "trainee_own_sessions" on sessions
  for select using (
    user_id = (select id from users where clerk_id = auth.uid()::text)
    or exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin')
  );

create policy "trainee_own_progress" on trainee_progress
  for select using (
    user_id = (select id from users where clerk_id = auth.uid()::text)
    or exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin')
  );

-- Admins can read/write everything
create policy "admin_all_bots" on bots
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "admin_all_personalities" on personalities
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "admin_all_pathways" on pathways
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

-- Allow service role full access (for API routes using service key)
create policy "service_role_users" on users for all using (auth.role() = 'service_role');
create policy "service_role_sessions" on sessions for all using (auth.role() = 'service_role');
create policy "service_role_progress" on trainee_progress for all using (auth.role() = 'service_role');
create policy "service_role_bots" on bots for all using (auth.role() = 'service_role');
create policy "service_role_personalities" on personalities for all using (auth.role() = 'service_role');
create policy "service_role_pathways" on pathways for all using (auth.role() = 'service_role');

alter table bot_documents enable row level security;
create policy "admin_all_bot_documents" on bot_documents
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));
create policy "service_role_bot_documents" on bot_documents
  for all using (auth.role() = 'service_role');


-- TAXONOMY ITEMS (source of truth)
create table taxonomy_items (
  id text primary key,
  category text not null,
  subcategory text not null,
  title text not null,
  description text not null,
  triage_questions text[] default '{}',
  triage_steps text[] default '{}',
  resolution_steps text[] default '{}',
  escalation_policy text,
  severity_guidance text,
  impact_guidance text,
  first_call_resolution boolean default false,
  owner text,
  examples text[] default '{}',
  last_reviewed date,
  search_tsv tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(category, '') || ' ' || coalesce(subcategory, '') || ' ' || coalesce(title, '') || ' ' || coalesce(description, '')
    )
  ) stored,
  updated_at timestamptz default now()
);

create table taxonomy_changes (
  id uuid primary key default gen_random_uuid(),
  change_type text not null,
  proposed_by text not null,
  reason text not null,
  item jsonb,
  target_id text,
  status text default 'proposed',
  created_at timestamptz default now(),
  applied_at timestamptz
);

create index taxonomy_items_category_idx on taxonomy_items(category);
create index taxonomy_items_subcategory_idx on taxonomy_items(subcategory);
create index taxonomy_items_title_idx on taxonomy_items(title);
create index taxonomy_items_search_tsv_idx on taxonomy_items using gin (search_tsv);

alter table taxonomy_items enable row level security;
alter table taxonomy_changes enable row level security;

create policy "admin_all_taxonomy_items" on taxonomy_items
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "admin_all_taxonomy_changes" on taxonomy_changes
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "service_role_taxonomy_items" on taxonomy_items for all using (auth.role() = 'service_role');
create policy "service_role_taxonomy_changes" on taxonomy_changes for all using (auth.role() = 'service_role');

-- Migration notes for existing databases:
-- update trainee_progress set score_sum = round(avg_score * total_sessions) where score_sum is null or score_sum = 0;

