-- CallCallum evaluation layer
-- Adds transcript storage, turn-level data, AI evidence, labels, taxonomy, and evaluator metadata.

create table if not exists assessment_call_transcripts (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references sessions(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete restrict,
  scenario_id uuid not null references scenarios(id) on delete restrict,
  raw_transcript text not null,
  source text not null check (source in ('web_voice', 'custom_gpt', 'manual_upload')),
  transcript_version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists assessment_call_turns (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references assessment_call_transcripts(id) on delete cascade,
  turn_index int not null,
  speaker text not null check (speaker in ('candidate', 'client', 'caller')),
  text text not null,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists assessment_call_evaluations (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references assessment_call_transcripts(id) on delete cascade,
  evaluator_model text not null,
  evaluator_prompt_version text not null,
  rubric_version text not null,
  raw_ai_output_json jsonb not null,
  validated boolean not null default false,
  validation_errors text[] default '{}',
  final_call_score int check (final_call_score between 0 and 100),
  final_ticket_score int check (final_ticket_score between 0 and 100),
  final_readiness_score int check (final_readiness_score between 0 and 100),
  readiness_label text,
  created_at timestamptz not null default now()
);

create table if not exists assessment_evidence (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references assessment_call_evaluations(id) on delete cascade,
  assessment_session_id uuid not null references sessions(id) on delete cascade,
  checkpoint_key text not null,
  status text not null check (status in ('observed', 'partially_observed', 'missed', 'not_applicable')),
  evidence_quote text,
  turn_index int,
  reason text,
  confidence numeric(3,2) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table if not exists assessment_labels (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references sessions(id) on delete cascade,
  transcript_id uuid references assessment_call_transcripts(id) on delete cascade,
  label_type text not null check (label_type in ('skill', 'risk', 'scenario', 'data_quality', 'outcome')),
  label_key text not null,
  confidence numeric(3,2) check (confidence between 0 and 1),
  source text not null check (source in ('ai', 'system', 'manager', 'candidate')),
  evidence_quote text,
  severity text check (severity in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create table if not exists label_taxonomy (
  id uuid primary key default gen_random_uuid(),
  label_key text unique not null,
  label_type text not null check (label_type in ('skill', 'risk', 'scenario', 'data_quality', 'outcome')),
  description text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Add rubric column to scenarios for weighted checkpoints
alter table scenarios add column if not exists rubric jsonb not null default '[]';

-- Set explicit rubric for the six First Calls scenarios
update scenarios set rubric = (
  case title
    when 'Password/login issue' then '[
      {"key":"confirm_user","label":"Confirmed user identity","weight":10},
      {"key":"confirm_company","label":"Confirmed company","weight":10},
      {"key":"capture_device_or_hostname","label":"Captured device/hostname","weight":10},
      {"key":"ask_when_started","label":"Asked when issue started","weight":10},
      {"key":"ask_scope_one_or_many","label":"Checked scope (one or many)","weight":15},
      {"key":"ask_business_impact","label":"Assessed business impact","weight":15},
      {"key":"ask_deadline","label":"Asked about deadline","weight":5},
      {"key":"ask_error_message","label":"Asked for error message","weight":10},
      {"key":"ask_recent_changes","label":"Asked about recent changes","weight":10},
      {"key":"set_next_steps","label":"Set next step expectations","weight":5}
    ]'::jsonb
    when 'Outlook not sending' then '[
      {"key":"confirm_user","label":"Confirmed user identity","weight":10},
      {"key":"confirm_company","label":"Confirmed company","weight":10},
      {"key":"capture_device_or_hostname","label":"Captured device/hostname","weight":10},
      {"key":"ask_when_started","label":"Asked when issue started","weight":10},
      {"key":"ask_scope_one_or_many","label":"Checked scope (one or many)","weight":15},
      {"key":"ask_business_impact","label":"Assessed business impact","weight":15},
      {"key":"ask_deadline","label":"Asked about deadline","weight":5},
      {"key":"ask_error_message","label":"Asked for error message","weight":10},
      {"key":"ask_recent_changes","label":"Asked about recent changes","weight":10},
      {"key":"ask_workaround","label":"Asked about workaround","weight":5},
      {"key":"set_next_steps","label":"Set next step expectations","weight":5}
    ]'::jsonb
    when 'Printer not printing' then '[
      {"key":"confirm_user","label":"Confirmed user identity","weight":10},
      {"key":"confirm_company","label":"Confirmed company","weight":5},
      {"key":"capture_device_or_hostname","label":"Captured device/hostname","weight":10},
      {"key":"ask_when_started","label":"Asked when issue started","weight":10},
      {"key":"ask_scope_one_or_many","label":"Checked scope (one or many)","weight":15},
      {"key":"ask_business_impact","label":"Assessed business impact","weight":15},
      {"key":"ask_deadline","label":"Asked about deadline","weight":10},
      {"key":"ask_error_message","label":"Asked for error message","weight":10},
      {"key":"ask_recent_changes","label":"Asked about recent changes","weight":10},
      {"key":"ask_workaround","label":"Asked about workaround","weight":5},
      {"key":"set_next_steps","label":"Set next step expectations","weight":5}
    ]'::jsonb
    else '[]'::jsonb
  end
) where title in ('Password/login issue', 'Outlook not sending', 'Printer not printing');

-- Seed label taxonomy
insert into label_taxonomy (label_key, label_type, description) values
  -- Scenario labels
  ('email', 'scenario', 'Call involves an email issue'),
  ('outlook', 'scenario', 'Call involves Microsoft Outlook'),
  ('printer', 'scenario', 'Call involves a printer issue'),
  ('vpn', 'scenario', 'Call involves VPN connectivity'),
  ('password_reset', 'scenario', 'Call involves password reset'),
  ('teams', 'scenario', 'Call involves Microsoft Teams'),
  ('network', 'scenario', 'Call involves network connectivity'),
  ('slow_device', 'scenario', 'Call involves slow device performance'),
  ('single_user_issue', 'scenario', 'Issue affects a single user'),
  ('multi_user_issue', 'scenario', 'Issue affects multiple users'),
  ('low_urgency', 'scenario', 'Low urgency call'),
  ('medium_urgency', 'scenario', 'Medium urgency call'),
  ('high_urgency', 'scenario', 'High urgency call'),
  ('first_line', 'scenario', 'First-line support call'),
  ('escalation_required', 'scenario', 'Call required escalation'),
  -- Skill labels
  ('professional_opening', 'skill', 'Candidate opened the call professionally'),
  ('confirmed_identity', 'skill', 'Candidate confirmed user identity'),
  ('confirmed_company', 'skill', 'Candidate confirmed company name'),
  ('clarified_symptoms', 'skill', 'Candidate clarified symptoms'),
  ('asked_error_message', 'skill', 'Candidate asked for error message'),
  ('checked_scope', 'skill', 'Candidate checked if issue affects one or many'),
  ('checked_impact', 'skill', 'Candidate assessed business impact'),
  ('used_plain_english', 'skill', 'Candidate used plain English'),
  ('set_expectations', 'skill', 'Candidate set next step expectations'),
  ('summarised_issue', 'skill', 'Candidate summarised the issue'),
  ('closed_call_cleanly', 'skill', 'Candidate closed the call cleanly'),
  -- Risk labels
  ('missed_identity_check', 'risk', 'Candidate missed identity verification'),
  ('missed_company_check', 'risk', 'Candidate missed company verification'),
  ('missed_scope_check', 'risk', 'Candidate missed scope check'),
  ('missed_impact_check', 'risk', 'Candidate missed impact assessment'),
  ('jumped_to_solution', 'risk', 'Candidate jumped to solution without investigation'),
  ('over_escalated', 'risk', 'Candidate escalated unnecessarily'),
  ('under_escalated', 'risk', 'Candidate failed to escalate when needed'),
  ('gave_wrong_advice', 'risk', 'Candidate gave incorrect advice'),
  ('poor_client_control', 'risk', 'Candidate lost control of the call'),
  ('unclear_next_steps', 'risk', 'Candidate left next steps unclear'),
  ('weak_ticket', 'risk', 'Candidate ticket was weak or incomplete'),
  ('no_priority', 'risk', 'Ticket has no priority assignment'),
  ('no_affected_user', 'risk', 'Ticket missing affected user details'),
  ('no_business_impact', 'risk', 'Ticket missing business impact'),
  -- Data-quality labels
  ('manager_reviewed', 'data_quality', 'Manager has reviewed this assessment'),
  ('manager_overridden', 'data_quality', 'Manager overrode the AI recommendation'),
  ('gold_standard_example', 'data_quality', 'High-quality example suitable for training'),
  ('noisy_transcript', 'data_quality', 'Transcript has noise or quality issues'),
  ('incomplete_call', 'data_quality', 'Call was not completed'),
  ('usable_for_training', 'data_quality', 'Suitable for future training data'),
  ('do_not_train', 'data_quality', 'Do not use this transcript for training'),
  -- Outcome labels
  ('ready', 'outcome', 'Candidate is ready for first-line calls'),
  ('ready_with_supervision', 'outcome', 'Candidate needs supervision on live calls'),
  ('not_ready', 'outcome', 'Candidate is not ready for first-line calls'),
  ('manager_passed', 'outcome', 'Manager passed the candidate'),
  ('manager_failed', 'outcome', 'Manager failed the candidate'),
  ('needs_ticket_training', 'outcome', 'Candidate needs ticket-writing training'),
  ('needs_call_structure_training', 'outcome', 'Candidate needs call structure training'),
  ('needs_technical_training', 'outcome', 'Candidate needs technical training')
on conflict (label_key) do nothing;

create index if not exists assessment_call_transcripts_session_idx on assessment_call_transcripts(assessment_session_id);
create index if not exists assessment_call_turns_transcript_idx on assessment_call_turns(transcript_id);
create index if not exists assessment_call_evaluations_transcript_idx on assessment_call_evaluations(transcript_id);
create index if not exists assessment_evidence_evaluation_idx on assessment_evidence(evaluation_id);
create index if not exists assessment_evidence_session_idx on assessment_evidence(assessment_session_id);
create index if not exists assessment_labels_session_idx on assessment_labels(assessment_session_id);
create index if not exists assessment_labels_type_key_idx on assessment_labels(label_type, label_key);
create index if not exists assessment_labels_source_idx on assessment_labels(source);
create index if not exists label_taxonomy_type_idx on label_taxonomy(label_type);

alter table assessment_call_transcripts enable row level security;
alter table assessment_call_turns enable row level security;
alter table assessment_call_evaluations enable row level security;
alter table assessment_evidence enable row level security;
alter table assessment_labels enable row level security;
alter table label_taxonomy enable row level security;

create policy "manager_read_transcripts" on assessment_call_transcripts for select using (
  exists (
    select 1 from sessions s
    join assessment_packs ap on ap.id = s.assessment_pack_id
    join users u on u.tenant_id = ap.tenant_id
    where s.id = assessment_call_transcripts.assessment_session_id
    and u.clerk_id = auth.uid()::text and u.role = 'admin'
  )
);
create policy "service_role_transcripts" on assessment_call_transcripts for all using (auth.role() = 'service_role');

create policy "manager_read_turns" on assessment_call_turns for select using (
  exists (select 1 from assessment_call_transcripts act join assessment_call_evaluations ace on ace.transcript_id = act.id where act.id = assessment_call_turns.transcript_id)
);
create policy "service_role_turns" on assessment_call_turns for all using (auth.role() = 'service_role');

create policy "manager_read_evaluations" on assessment_call_evaluations for select using (
  exists (select 1 from assessment_call_transcripts act join sessions s on s.id = act.assessment_session_id join assessment_packs ap on ap.id = s.assessment_pack_id join users u on u.tenant_id = ap.tenant_id where act.id = assessment_call_evaluations.transcript_id and u.clerk_id = auth.uid()::text and u.role = 'admin')
);
create policy "service_role_evaluations" on assessment_call_evaluations for all using (auth.role() = 'service_role');

create policy "manager_read_evidence" on assessment_evidence for select using (
  exists (select 1 from sessions s join assessment_packs ap on ap.id = s.assessment_pack_id join users u on u.tenant_id = ap.tenant_id where s.id = assessment_evidence.assessment_session_id and u.clerk_id = auth.uid()::text and u.role = 'admin')
);
create policy "service_role_evidence" on assessment_evidence for all using (auth.role() = 'service_role');

create policy "manager_read_labels" on assessment_labels for select using (true);
create policy "service_role_labels" on assessment_labels for all using (auth.role() = 'service_role');

create policy "authenticated_read_taxonomy" on label_taxonomy for select using (auth.uid() is not null);
create policy "service_role_taxonomy" on label_taxonomy for all using (auth.role() = 'service_role');
