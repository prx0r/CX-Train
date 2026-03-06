-- Bot documents: upload text/markdown files for use in prompts
create table bot_documents (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null references bots(id) on delete cascade,
  filename text not null,
  content text not null,
  content_type text default 'text/plain',
  created_at timestamptz default now()
);

create index bot_documents_bot_id_idx on bot_documents(bot_id);

alter table bot_documents enable row level security;

create policy "admin_all_bot_documents" on bot_documents
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "service_role_bot_documents" on bot_documents
  for all using (auth.role() = 'service_role');
