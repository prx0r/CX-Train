-- CallCallum voice assessment sessions and cost tracking

create table if not exists voice_assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  assessment_session_id uuid not null references sessions(id) on delete cascade,
  invite_token text not null,
  scenario_id uuid not null references scenarios(id) on delete restrict,
  candidate_name text not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'ended', 'ticket_writing', 'completed')),
  current_turn_index int not null default 0,
  stt_seconds numeric(10,2) not null default 0,
  tts_seconds numeric(10,2) not null default 0,
  llm_input_tokens int not null default 0,
  llm_output_tokens int not null default 0,
  evaluation_tokens int not null default 0,
  estimated_cost_usd numeric(10,6) not null default 0,
  stt_provider text,
  tts_provider text,
  client_brain_provider text,
  evaluator_provider text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists voice_assessment_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references voice_assessment_sessions(id) on delete cascade,
  turn_index int not null,
  speaker text not null check (speaker in ('candidate', 'client')),
  text text not null,
  audio_url text,
  audio_duration_ms int,
  stt_model text,
  stt_confidence numeric(3,2),
  tts_model text,
  llm_model text,
  llm_input_tokens int default 0,
  llm_output_tokens int default 0,
  created_at timestamptz not null default now()
);

create index voice_assessment_sessions_assessment_idx on voice_assessment_sessions(assessment_session_id);
create index voice_assessment_turns_session_idx on voice_assessment_turns(session_id);

alter table voice_assessment_sessions enable row level security;
alter table voice_assessment_turns enable row level security;

create policy "manager_read_voice_sessions" on voice_assessment_sessions for select using (
  exists (
    select 1 from sessions s join assessment_packs ap on ap.id = s.assessment_pack_id join users u on u.tenant_id = ap.tenant_id
    where s.id = voice_assessment_sessions.assessment_session_id and u.clerk_id = auth.uid()::text and u.role = 'admin'
  )
);
create policy "service_role_voice_sessions" on voice_assessment_sessions for all using (auth.role() = 'service_role');

create policy "manager_read_voice_turns" on voice_assessment_turns for select using (true);
create policy "service_role_voice_turns" on voice_assessment_turns for all using (auth.role() = 'service_role');

comment on table voice_assessment_sessions is 'Tracks turn-based voice assessment sessions with provider usage and cost';
comment on table voice_assessment_turns is 'Individual turns in a voice assessment, recording STT/TTS/LLM metadata';
