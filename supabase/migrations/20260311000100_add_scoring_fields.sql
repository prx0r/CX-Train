-- Add deterministic scoring fields and SLA inputs
alter table sessions
  add column if not exists score_points int,
  add column if not exists score_breakdown jsonb,
  add column if not exists rubric_evidence jsonb,
  add column if not exists severity_level text,
  add column if not exists impact_level text;
