-- Candidate invite system for account-free assessment flow

create table if not exists candidate_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  manager_id uuid not null references users(id) on delete restrict,
  assessment_pack_id uuid not null references assessment_packs(id) on delete cascade,
  candidate_name text not null,
  candidate_email text,
  token_hash text unique not null,
  status text not null default 'pending'
    check (status in ('pending', 'started', 'completed', 'expired', 'revoked')),
  expires_at timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table sessions add column if not exists candidate_invite_id uuid references candidate_invites(id) on delete set null;

create index if not exists candidate_invites_tenant_idx on candidate_invites(tenant_id);
create index if not exists candidate_invites_pack_idx on candidate_invites(assessment_pack_id);
create index if not exists candidate_invites_hash_idx on candidate_invites(token_hash);
create index if not exists candidate_invites_status_idx on candidate_invites(status);

alter table candidate_invites enable row level security;

create policy "manager_own_candidate_invites" on candidate_invites for all using (
  tenant_id = (select tenant_id from users where clerk_id = auth.uid()::text and role = 'admin')
) with check (
  tenant_id = (select tenant_id from users where clerk_id = auth.uid()::text and role = 'admin')
);

create policy "service_role_candidate_invites" on candidate_invites for all using (auth.role() = 'service_role');

-- Allow unauthenticated token-hash lookup for candidate flow (service-role client)
create policy "anon_candidate_invite_lookup" on candidate_invites for select using (true);
