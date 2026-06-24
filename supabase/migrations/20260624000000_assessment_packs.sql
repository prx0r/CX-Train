-- CallCallum assessment-pack workflow
-- Keeps legacy training sessions valid while introducing tenant-isolated assessments.

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table users add column if not exists tenant_id uuid references tenants(id);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  email text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists assessment_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete restrict,
  created_by uuid not null references users(id) on delete restrict,
  mode text not null check (mode in ('hiring', 'onboarding', 'probation', 'retraining')),
  title text not null,
  difficulty text not null default 'junior' check (difficulty in ('candidate', 'junior', 'live_call_ready')),
  scenario_count int not null default 3 check (scenario_count in (3, 5, 10)),
  status text not null default 'draft' check (status in ('draft', 'invited', 'in_progress', 'completed', 'reviewed')),
  pass_threshold int not null default 75 check (pass_threshold between 0 and 100),
  final_recommendation text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists assessment_invites (
  id uuid primary key default gen_random_uuid(),
  assessment_pack_id uuid not null references assessment_packs(id) on delete cascade,
  token text unique not null,
  candidate_email text,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists scenarios (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  issue_family text not null,
  difficulty text not null,
  mode text not null default 'both',
  caller_persona text,
  intensity int check (intensity between 1 and 3),
  hidden_facts jsonb not null default '{}',
  required_checkpoints jsonb not null default '{}',
  ideal_ticket jsonb not null default '{}',
  common_mistakes jsonb not null default '[]',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (title, difficulty)
);

alter table sessions add column if not exists tenant_id uuid references tenants(id);
alter table sessions add column if not exists assessment_pack_id uuid references assessment_packs(id) on delete cascade;
alter table sessions add column if not exists scenario_id uuid references scenarios(id);
alter table sessions add column if not exists transcript_json jsonb not null default '[]';
alter table sessions add column if not exists transcript_text text;
alter table sessions add column if not exists conversation_transcript text;
alter table sessions add column if not exists candidate_ticket_text text;
alter table sessions add column if not exists readiness_score int check (readiness_score between 0 and 100);
alter table sessions add column if not exists readiness_label text;

create table if not exists manager_reviews (
  id uuid primary key default gen_random_uuid(),
  assessment_pack_id uuid not null references assessment_packs(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  manager_id uuid not null references users(id) on delete restrict,
  ai_score int check (ai_score between 0 and 100),
  manager_score int check (manager_score between 0 and 100),
  agreed_with_ai boolean,
  override_reason text,
  manager_notes text,
  final_readiness text check (final_readiness in ('strong_hire', 'possible_hire', 'risky_hire', 'not_recommended', 'ready_low_risk_calls', 'ready_with_supervision', 'not_ready', 'triage_only')),
  created_at timestamptz not null default now()
);

create index if not exists users_tenant_id_idx on users(tenant_id);
create index if not exists candidates_tenant_id_idx on candidates(tenant_id);
create index if not exists assessment_packs_tenant_id_idx on assessment_packs(tenant_id);
create index if not exists assessment_packs_candidate_id_idx on assessment_packs(candidate_id);
create index if not exists assessment_invites_pack_id_idx on assessment_invites(assessment_pack_id);
create index if not exists assessment_invites_token_idx on assessment_invites(token);
create index if not exists sessions_assessment_pack_id_idx on sessions(assessment_pack_id);
create index if not exists sessions_tenant_id_idx on sessions(tenant_id);
create unique index if not exists sessions_pack_scenario_unique_idx on sessions(assessment_pack_id, scenario_id) where assessment_pack_id is not null;
create index if not exists manager_reviews_pack_id_idx on manager_reviews(assessment_pack_id);

-- Existing session RLS remains valid for legacy trainee sessions. Assessment sessions
-- are manager-readable only when their tenant matches the authenticated manager.
create policy "manager_tenant_assessment_sessions" on sessions for select using (
  tenant_id is not null and tenant_id = (
    select tenant_id from users where clerk_id = auth.uid()::text and role = 'admin'
  )
);

alter table tenants enable row level security;
alter table candidates enable row level security;
alter table assessment_packs enable row level security;
alter table assessment_invites enable row level security;
alter table scenarios enable row level security;
alter table manager_reviews enable row level security;

create policy "manager_own_tenant" on tenants for select using (
  id = (select tenant_id from users where clerk_id = auth.uid()::text and role = 'admin')
);
create policy "manager_own_candidates" on candidates for all using (
  tenant_id = (select tenant_id from users where clerk_id = auth.uid()::text and role = 'admin')
) with check (
  tenant_id = (select tenant_id from users where clerk_id = auth.uid()::text and role = 'admin')
);
create policy "manager_own_assessments" on assessment_packs for all using (
  tenant_id = (select tenant_id from users where clerk_id = auth.uid()::text and role = 'admin')
) with check (
  tenant_id = (select tenant_id from users where clerk_id = auth.uid()::text and role = 'admin')
);
create policy "manager_own_invites" on assessment_invites for all using (
  exists (
    select 1 from assessment_packs ap join users u on u.tenant_id = ap.tenant_id
    where ap.id = assessment_invites.assessment_pack_id and u.clerk_id = auth.uid()::text and u.role = 'admin'
  )
);
create policy "authenticated_scenarios" on scenarios for select using (auth.uid() is not null);
create policy "manager_own_reviews" on manager_reviews for all using (
  exists (
    select 1 from assessment_packs ap join users u on u.tenant_id = ap.tenant_id
    where ap.id = manager_reviews.assessment_pack_id and u.clerk_id = auth.uid()::text and u.role = 'admin'
  )
);

create policy "service_role_tenants" on tenants for all using (auth.role() = 'service_role');
create policy "service_role_candidates" on candidates for all using (auth.role() = 'service_role');
create policy "service_role_assessments" on assessment_packs for all using (auth.role() = 'service_role');
create policy "service_role_invites" on assessment_invites for all using (auth.role() = 'service_role');
create policy "service_role_scenarios" on scenarios for all using (auth.role() = 'service_role');
create policy "service_role_reviews" on manager_reviews for all using (auth.role() = 'service_role');

insert into scenarios (title, issue_family, difficulty, caller_persona, intensity, hidden_facts, required_checkpoints, ideal_ticket, common_mistakes)
values
('Password/login issue', 'identity_access', 'candidate', 'Busy accounts assistant who changed their password yesterday', 2,
 '{"device":"Windows laptop","scope":"single user","business_impact":"cannot access payroll system","started":"this morning","error_message":"password incorrect","recent_changes":"password changed yesterday","workaround":"webmail is available"}',
 '{"confirm_user":true,"confirm_company":true,"capture_device_or_hostname":true,"ask_when_started":true,"ask_scope_one_or_many":true,"ask_business_impact":true,"ask_deadline":true,"ask_error_message":true,"ask_recent_changes":true,"set_next_steps":true}',
 '{"summary":"User cannot sign in after password change","must_include":["user","device","impact","error","password change","next step"]}',
 '["asking for the password","resetting without identity checks","missing business impact"]'),
('Outlook not sending', 'email', 'candidate', 'Frustrated sales manager with a client deadline', 2,
 '{"device":"Windows laptop","scope":"single user","business_impact":"client proposal due in 30 minutes","started":"this morning","error_message":"send/receive error","recent_changes":"password changed yesterday","workaround":"Outlook web works"}',
 '{"confirm_user":true,"confirm_company":true,"capture_device_or_hostname":true,"ask_when_started":true,"ask_scope_one_or_many":true,"ask_business_impact":true,"ask_deadline":true,"ask_error_message":true,"ask_recent_changes":true,"ask_workaround":true,"set_next_steps":true}',
 '{"summary":"Outlook desktop cannot send; web workaround works","must_include":["user","device","impact","scope","error","workaround","next step"]}',
 '["assuming a mail outage","ignoring the working web client","promising an immediate fix"]'),
('Printer not printing', 'printing', 'candidate', 'Office coordinator preparing meeting packs', 1,
 '{"device":"shared reception printer","scope":"three nearby users","business_impact":"meeting packs needed in one hour","started":"20 minutes ago","error_message":"printer offline","recent_changes":"paper tray refilled","workaround":"upstairs printer available"}',
 '{"confirm_user":true,"confirm_company":true,"capture_device_or_hostname":true,"ask_when_started":true,"ask_scope_one_or_many":true,"ask_business_impact":true,"ask_deadline":true,"ask_error_message":true,"ask_recent_changes":true,"ask_workaround":true,"set_next_steps":true}',
 '{"summary":"Shared reception printer shows offline","must_include":["printer","affected users","deadline","error","workaround","next step"]}',
 '["reinstalling drivers immediately","missing shared impact","not recording printer identity"]'),
('Internet is down', 'connectivity', 'junior', 'Remote director who describes every network issue as internet down', 3,
 '{"device":"company laptop on home Wi-Fi","scope":"single user","business_impact":"video call failing","started":"ten minutes ago","error_message":"no internet","recent_changes":"moved to garden office","workaround":"phone hotspot works"}',
 '{"confirm_user":true,"confirm_company":true,"capture_device_or_hostname":true,"ask_when_started":true,"ask_scope_one_or_many":true,"ask_business_impact":true,"ask_deadline":true,"ask_error_message":true,"ask_recent_changes":true,"ask_workaround":true,"set_next_steps":true}',
 '{"summary":"Single remote user loses connectivity on home Wi-Fi","must_include":["user","device","location","scope","impact","hotspot workaround","next step"]}',
 '["declaring a company outage","changing network settings unsafely","ignoring location"]'),
('Teams audio/video issue', 'collaboration', 'candidate', 'New starter joining their first client meeting', 2,
 '{"device":"Windows laptop","scope":"single user","business_impact":"client meeting starts in 15 minutes","started":"first use today","error_message":"microphone not detected","recent_changes":"USB headset connected","workaround":"dial in by phone"}',
 '{"confirm_user":true,"confirm_company":true,"capture_device_or_hostname":true,"ask_when_started":true,"ask_scope_one_or_many":true,"ask_business_impact":true,"ask_deadline":true,"ask_error_message":true,"ask_recent_changes":true,"ask_workaround":true,"set_next_steps":true}',
 '{"summary":"Teams does not detect USB headset microphone","must_include":["user","device","meeting deadline","error","headset","workaround","next step"]}',
 '["testing without protecting meeting deadline","using jargon","missing workaround"]'),
('VPN not connecting', 'remote_access', 'junior', 'Consultant trying to access a client file remotely', 2,
 '{"device":"managed Windows laptop","scope":"single user","business_impact":"cannot access shared drive","started":"after lunch","error_message":"authentication failed","recent_changes":"phone replaced","workaround":"none","deadline":"end-of-day client deliverable"}',
 '{"confirm_user":true,"confirm_company":true,"capture_device_or_hostname":true,"ask_when_started":true,"ask_scope_one_or_many":true,"ask_business_impact":true,"ask_deadline":true,"ask_error_message":true,"ask_recent_changes":true,"ask_workaround":true,"set_next_steps":true}',
 '{"summary":"VPN authentication fails after phone replacement","must_include":["user","device","impact","error","phone change","deadline","escalation"]}',
 '["requesting MFA codes","reinstalling VPN immediately","missing phone change"]'),
('Slow laptop', 'performance', 'candidate', 'Patient user whose laptop has gradually slowed', 1,
 '{"device":"four-year-old Windows laptop","hostname":"LT-204","scope":"single user","business_impact":"routine work delayed","started":"worsening over two weeks","error_message":"none","recent_changes":"large Windows update","workaround":"none"}',
 '{"confirm_user":true,"confirm_company":true,"capture_device_or_hostname":true,"ask_when_started":true,"ask_scope_one_or_many":true,"ask_business_impact":true,"ask_error_message":true,"ask_recent_changes":true,"set_next_steps":true}',
 '{"summary":"LT-204 has degraded performance over two weeks","must_include":["user","hostname","timeline","impact","update","checks","next step"]}',
 '["promising replacement hardware","calling it urgent without impact","missing timeline"]'),
('Shared mailbox/calendar issue', 'microsoft_365', 'junior', 'Executive assistant missing a shared calendar', 2,
 '{"device":"Windows laptop","scope":"user only; colleagues still have access","business_impact":"cannot manage director appointments","started":"today","error_message":"folder cannot be expanded","recent_changes":"licence changed last week","workaround":"colleague can update calendar"}',
 '{"confirm_user":true,"confirm_company":true,"capture_device_or_hostname":true,"ask_when_started":true,"ask_scope_one_or_many":true,"ask_business_impact":true,"ask_deadline":true,"ask_error_message":true,"ask_recent_changes":true,"ask_workaround":true,"set_next_steps":true}',
 '{"summary":"One user lost shared calendar access after licence change","must_include":["user","shared resource","scope","impact","error","licence change","workaround","next step"]}',
 '["assuming tenant-wide failure","changing permissions without approval","missing resource name"]'),
('New starter access request', 'service_request', 'candidate', 'Team leader chasing access for a starter arriving tomorrow', 2,
 '{"device":"new laptop not yet assigned","scope":"one new starter","business_impact":"starter onboarding tomorrow at 09:00","started":"request submitted today","required_access":"email, Teams, finance share","approval":"finance share needs data-owner approval","workaround":"none"}',
 '{"confirm_user":true,"confirm_company":true,"confirm_affected_user":true,"ask_business_impact":true,"ask_deadline":true,"ask_required_access":true,"check_approval":true,"set_next_steps":true}',
 '{"summary":"Access required for new starter before 09:00 tomorrow","must_include":["requester","starter","start date","systems","approval","next step"]}',
 '["granting access without approval","missing starter identity","promising completion"]'),
('Possible wider outage', 'major_incident', 'live_call_ready', 'Stressed operations manager reporting several failures', 3,
 '{"device":"multiple office desktops","scope":"at least twelve users across two departments","business_impact":"order processing stopped","started":"five minutes ago","error_message":"network path unavailable","recent_changes":"unknown","workaround":"none","related_reports":"phones also intermittent"}',
 '{"confirm_user":true,"confirm_company":true,"ask_when_started":true,"ask_scope_one_or_many":true,"ask_business_impact":true,"ask_deadline":true,"ask_error_message":true,"ask_recent_changes":true,"ask_workaround":true,"identify_possible_outage":true,"set_next_steps":true}',
 '{"summary":"Possible site-wide outage blocking order processing","must_include":["reporter","locations","affected users","business service","start time","symptoms","major incident escalation"]}',
 '["troubleshooting one PC for too long","failing to escalate","declaring cause without evidence"]')
on conflict (title, difficulty) do nothing;
