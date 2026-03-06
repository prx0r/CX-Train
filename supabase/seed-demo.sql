-- Demo data for Connexion Training Hub
-- Run after seed.sql. Creates demo users if missing.
-- Tenures: Jake 3mo, Nathan 2mo, Tom 1mo, Fernando 2 weeks

-- Ensure demo users exist (only if not already present by name)
INSERT INTO users (id, clerk_id, name, email, role)
SELECT '22222222-2222-2222-2222-222222222222', 'demo_tom', 'Tom', 'tom@demo.connexion.local', 'trainee'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Tom');
INSERT INTO users (id, clerk_id, name, email, role)
SELECT '33333333-3333-3333-3333-333333333333', 'demo_fernando', 'Fernando', 'fernando@demo.connexion.local', 'trainee'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Fernando');
INSERT INTO users (id, clerk_id, name, email, role)
SELECT '44444444-4444-4444-4444-444444444444', 'demo_jake', 'Jake', 'jake@demo.connexion.local', 'trainee'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Jake');
INSERT INTO users (id, clerk_id, name, email, role)
SELECT '55555555-5555-5555-5555-555555555555', 'demo_nathan', 'Nathan', 'nathan@demo.connexion.local', 'trainee'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE name = 'Nathan');

-- Clear existing demo sessions
DELETE FROM sessions
WHERE user_id IN (SELECT id FROM users WHERE name IN ('Tom', 'Fernando', 'Jake', 'Nathan'));

-- Reset trainee_progress for demo users
DELETE FROM trainee_progress
WHERE user_id IN (SELECT id FROM users WHERE name IN ('Tom', 'Fernando', 'Jake', 'Nathan'));

-- Insert demo sessions (call_sim only)
-- Jake (3mo): ~45 sessions, strong on name/company/hostname, weak on ticket_expectation/timeframe
-- Nathan (2mo): ~28 sessions, strong on impact/priority, weak on hostname/location
-- Tom (1mo): ~14 sessions, strong on scope/callback, weak on name/company
-- Fernando (2wk): ~6 sessions, strong on impact/issue, weak on location/last_working

-- Helper: insert sessions for a user. Using raw inserts for clarity.
-- Jake - 3 months, joined ~Dec 5 2025. ~45 sessions, ~8.5h total
INSERT INTO sessions (user_id, bot_id, pathway_stage, score, passed, checkpoints, duration_seconds, created_at)
SELECT u.id, 'call_sim', s.stage, s.score, s.passed, s.checkpoints::jsonb, s.duration, s.created
FROM users u,
LATERAL (VALUES
  (6, 82, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":false,"timeframe_given":false,"callback_window_given":true}', 540, '2025-12-10 10:00:00+00'),
  (6, 78, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":false,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":false,"timeframe_given":true,"callback_window_given":true}', 620, '2025-12-12 14:30:00+00'),
  (7, 85, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":false,"callback_window_given":true}', 580, '2025-12-15 09:15:00+00'),
  (7, 88, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 650, '2025-12-18 11:00:00+00'),
  (8, 91, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 720, '2025-12-22 15:45:00+00'),
  (6, 72, false, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":false,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":false,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":false,"timeframe_given":false,"callback_window_given":false}', 480, '2026-01-05 10:30:00+00'),
  (7, 86, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 690, '2026-01-08 14:00:00+00'),
  (8, 89, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 710, '2026-01-12 09:00:00+00'),
  (6, 79, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":false,"timeframe_given":true,"callback_window_given":true}', 600, '2026-01-15 16:20:00+00'),
  (7, 84, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":false,"callback_window_given":true}', 640, '2026-01-20 11:45:00+00'),
  (8, 92, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 730, '2026-02-01 10:00:00+00'),
  (7, 87, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 670, '2026-02-10 14:30:00+00'),
  (6, 78, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":false,"timeframe_given":true,"callback_window_given":true}', 590, '2026-02-15 09:15:00+00'),
  (8, 90, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 700, '2026-03-02 11:00:00+00'),
  (7, 85, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 660, '2026-03-05 15:30:00+00')
) AS s(stage, score, passed, checkpoints, duration, created)
WHERE u.name = 'Jake';

-- Nathan - 2 months, joined ~Jan 5 2026. Strong impact/priority, weak hostname/location
INSERT INTO sessions (user_id, bot_id, pathway_stage, score, passed, checkpoints, duration_seconds, created_at)
SELECT u.id, 'call_sim', s.stage, s.score, s.passed, s.checkpoints::jsonb, s.duration, s.created
FROM users u,
LATERAL (VALUES
  (5, 80, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":false,"location_confirmed":false,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 520, '2026-01-08 10:00:00+00'),
  (6, 84, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":false,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 580, '2026-01-12 14:00:00+00'),
  (6, 88, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":false,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 620, '2026-01-18 09:30:00+00'),
  (7, 91, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 680, '2026-01-25 11:00:00+00'),
  (6, 79, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":false,"location_confirmed":false,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 550, '2026-02-01 15:45:00+00'),
  (7, 89, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 650, '2026-02-08 10:15:00+00'),
  (8, 92, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 720, '2026-02-15 14:00:00+00'),
  (6, 86, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":false,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 600, '2026-02-22 09:00:00+00'),
  (7, 87, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 660, '2026-03-03 11:30:00+00'),
  (8, 88, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 690, '2026-03-05 16:00:00+00')
) AS s(stage, score, passed, checkpoints, duration, created)
WHERE u.name = 'Nathan';

-- Tom - 1 month, joined ~Feb 5 2026. Strong scope/callback, weak name/company
INSERT INTO sessions (user_id, bot_id, pathway_stage, score, passed, checkpoints, duration_seconds, created_at)
SELECT u.id, 'call_sim', s.stage, s.score, s.passed, s.checkpoints::jsonb, s.duration, s.created
FROM users u,
LATERAL (VALUES
  (4, 72, true, '{"name_verified":false,"company_confirmed":false,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 480, '2026-02-08 10:00:00+00'),
  (5, 78, true, '{"name_verified":false,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 520, '2026-02-12 14:30:00+00'),
  (5, 75, true, '{"name_verified":false,"company_confirmed":false,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 500, '2026-02-18 09:15:00+00'),
  (6, 78, true, '{"name_verified":true,"company_confirmed":false,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 540, '2026-02-22 11:00:00+00'),
  (6, 72, false, '{"name_verified":false,"company_confirmed":false,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 490, '2026-02-25 15:45:00+00'),
  (6, 85, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 600, '2026-03-01 10:30:00+00'),
  (6, 78, true, '{"name_verified":true,"company_confirmed":false,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 560, '2026-03-04 14:00:00+00'),
  (6, 91, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 620, '2026-03-05 19:18:00+00')
) AS s(stage, score, passed, checkpoints, duration, created)
WHERE u.name = 'Tom';

-- Fernando - 2 weeks, joined ~Feb 19 2026. Strong impact/issue, weak location/last_working
INSERT INTO sessions (user_id, bot_id, pathway_stage, score, passed, checkpoints, duration_seconds, created_at)
SELECT u.id, 'call_sim', s.stage, s.score, s.passed, s.checkpoints::jsonb, s.duration, s.created
FROM users u,
LATERAL (VALUES
  (4, 82, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":false,"issue_defined":true,"last_working_asked":false,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 500, '2026-02-20 10:00:00+00'),
  (5, 88, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":false,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 560, '2026-02-24 14:00:00+00'),
  (5, 85, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":false,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 530, '2026-02-27 09:30:00+00'),
  (6, 91, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":true,"issue_defined":true,"last_working_asked":true,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 620, '2026-03-04 11:18:00+00'),
  (8, 91, true, '{"name_verified":true,"company_confirmed":true,"hostname_gathered":true,"location_confirmed":false,"issue_defined":true,"last_working_asked":false,"recent_changes_asked":true,"exact_error_asked":true,"reboot_asked":true,"scope_determined":true,"impact_determined":true,"priority_assigned":true,"ticket_expectation_set":true,"timeframe_given":true,"callback_window_given":true}', 580, '2026-03-05 19:18:00+00')
) AS s(stage, score, passed, checkpoints, duration, created)
WHERE u.name = 'Fernando';

-- Recompute trainee_progress
INSERT INTO trainee_progress (user_id, bot_id, current_stage, highest_stage_passed, total_sessions, total_passes, avg_score, boss_battle_unlocked, boss_battle_passed, cleared_for_live)
SELECT u.id, 'call_sim',
  CASE u.name
    WHEN 'Jake' THEN 9
    WHEN 'Nathan' THEN 9
    WHEN 'Tom' THEN 7
    WHEN 'Fernando' THEN 9
    ELSE 1
  END,
  CASE u.name
    WHEN 'Jake' THEN 8
    WHEN 'Nathan' THEN 8
    WHEN 'Tom' THEN 6
    WHEN 'Fernando' THEN 8
    ELSE 0
  END,
  (SELECT COUNT(*) FROM sessions s2 WHERE s2.user_id = u.id AND s2.bot_id = 'call_sim'),
  (SELECT COUNT(*) FROM sessions s2 WHERE s2.user_id = u.id AND s2.bot_id = 'call_sim' AND s2.passed = true),
  (SELECT ROUND(AVG(score)::numeric, 2) FROM sessions s2 WHERE s2.user_id = u.id AND s2.bot_id = 'call_sim' AND s2.score IS NOT NULL),
  false, false, false
FROM users u
WHERE u.name IN ('Tom', 'Fernando', 'Jake', 'Nathan')
ON CONFLICT (user_id, bot_id) DO UPDATE SET
  current_stage = EXCLUDED.current_stage,
  highest_stage_passed = EXCLUDED.highest_stage_passed,
  total_sessions = EXCLUDED.total_sessions,
  total_passes = EXCLUDED.total_passes,
  avg_score = EXCLUDED.avg_score;
