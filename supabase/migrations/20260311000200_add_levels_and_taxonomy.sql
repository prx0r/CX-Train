-- Add deterministic scoring fields and SLA inputs
alter table sessions
  add column if not exists score_points int,
  add column if not exists score_breakdown jsonb,
  add column if not exists rubric_evidence jsonb,
  add column if not exists severity_level text,
  add column if not exists impact_level text;

-- Add level tracking
alter table trainee_progress
  add column if not exists level int default 1,
  add column if not exists level_points int default 0;

-- Taxonomy source-of-truth tables
create table if not exists taxonomy_items (
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
  updated_at timestamptz default now()
);

create table if not exists taxonomy_changes (
  id uuid primary key default gen_random_uuid(),
  change_type text not null, -- add|update|delete
  proposed_by text not null,
  reason text not null,
  item jsonb,
  target_id text,
  status text default 'proposed', -- proposed|applied|rejected
  created_at timestamptz default now(),
  applied_at timestamptz
);

create index if not exists taxonomy_items_category_idx on taxonomy_items(category);
create index if not exists taxonomy_items_subcategory_idx on taxonomy_items(subcategory);
create index if not exists taxonomy_items_title_idx on taxonomy_items(title);

alter table taxonomy_items enable row level security;
alter table taxonomy_changes enable row level security;

create policy "admin_all_taxonomy_items" on taxonomy_items
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "admin_all_taxonomy_changes" on taxonomy_changes
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "service_role_taxonomy_items" on taxonomy_items for all using (auth.role() = 'service_role');
create policy "service_role_taxonomy_changes" on taxonomy_changes for all using (auth.role() = 'service_role');

-- Seed minimal taxonomy items
insert into taxonomy_items (id, category, subcategory, title, description, triage_questions, triage_steps, resolution_steps, escalation_policy, severity_guidance, impact_guidance, first_call_resolution, owner, examples, last_reviewed)
values
  (
    'identity.password_not_working',
    'Identity & Access',
    'Password',
    'Password not working',
    'User cannot authenticate due to rejected password or repeated prompts.',
    array[
      'Is this affecting only you or multiple users?',
      'When did it last work?',
      'Are you seeing a specific error message?',
      'Have you changed your password recently?',
      'Is this happening on all devices or just one?'
    ],
    array[
      'Confirm user identity and account status.',
      'Check scope and impact per SLA definitions.',
      'Confirm exact error wording and when it started.',
      'Check for recent password changes or policy updates.'
    ],
    array[
      'Initiate password reset workflow.',
      'Confirm successful login after reset.',
      'If MFA is used, verify enrollment is intact.'
    ],
    'Escalate to T2 if reset fails or account appears compromised.',
    'Typically Low or Medium unless widespread impact.',
    'Determine if work is fully blocked or a workaround exists.',
    true,
    'T1',
    array[
      'Password rejected after recent change',
      'Repeated password prompt in Outlook'
    ],
    '2026-03-11'
  ),
  (
    'identity.account_lockout',
    'Identity & Access',
    'Account Lockout',
    'Account lockout',
    'User account locked due to too many failed attempts or policy triggers.',
    array[
      'Is this affecting only you or multiple users?',
      'When did you last successfully sign in?',
      'Do you have any old devices trying to sync?',
      'Are there any recent password changes?'
    ],
    array[
      'Confirm user identity.',
      'Check scope and impact per SLA definitions.',
      'Confirm recent password changes and device sync issues.'
    ],
    array[
      'Unlock account per standard procedure.',
      'Advise user to update password on all devices.',
      'Confirm successful login.'
    ],
    'Escalate to T2 if repeated lockouts occur after unlock.',
    'Typically Low unless multiple users are locked out.',
    'Determine if user is fully blocked from work.',
    true,
    'T1',
    array[
      'Account locked after multiple login attempts',
      'Mobile device repeatedly locking account'
    ],
    '2026-03-11'
  )
ON CONFLICT (id) DO NOTHING;
