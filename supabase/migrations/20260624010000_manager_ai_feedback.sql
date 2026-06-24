alter table manager_reviews add column if not exists ai_feedback_rating int check (ai_feedback_rating between 1 and 5);
alter table manager_reviews add column if not exists ai_feedback_comment text;
alter table manager_reviews add column if not exists reviewed_ai_at timestamptz;
alter table manager_reviews add column if not exists ai_readiness text check (ai_readiness in ('ready_low_risk_calls', 'ready_with_supervision', 'not_ready'));
