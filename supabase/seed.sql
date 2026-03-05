-- Seed data for Connexion Training Hub
-- Run after schema.sql

-- Insert call_sim bot (generate a secure api_key in production)
INSERT INTO bots (id, name, description, system_prompt, api_key, active)
VALUES (
  'call_sim',
  'Call Simulator',
  'Voice-optimised call simulation for MSP technician training',
  'Paste the full system prompt from gptinstructions.md here.',
  'connexion_call_sim_' || substr(md5(random()::text), 1, 24),
  true
)
ON CONFLICT (id) DO NOTHING;

-- Insert default pathways for call_sim
INSERT INTO pathways (bot_id, stage, name, description, difficulty, pass_threshold, is_boss_battle, requires_ticket_screenshot)
VALUES
  ('call_sim', 1, 'Introduction', 'Basic call flow, low intensity', 'easy', 75, false, false),
  ('call_sim', 2, 'Information gathering', 'Focus on hostname, impact', 'easy', 75, false, false),
  ('call_sim', 3, 'Scope and priority', 'P2/P3 scenarios', 'medium', 75, false, false),
  ('call_sim', 4, 'Expectation setting', 'Ticket and timeframe', 'medium', 75, false, false),
  ('call_sim', 5, 'Callback window', 'Callback expectation', 'medium', 75, false, false),
  ('call_sim', 6, 'Higher intensity', 'Intensity 2 callers', 'medium', 75, false, false),
  ('call_sim', 7, 'P1 scenarios', 'Urgent priority', 'hard', 75, false, false),
  ('call_sim', 8, 'Full checklist', 'All checkpoints', 'hard', 75, false, false),
  ('call_sim', 9, 'Ticket screenshot', 'Submit ticket with call', 'hard', 75, false, true),
  ('call_sim', 10, 'Boss battle', 'Final challenge', 'hard', 75, true, true)
ON CONFLICT (bot_id, stage) DO NOTHING;

-- Create storage bucket for ticket screenshots (run in Supabase Dashboard > Storage)
-- CREATE BUCKET ticket-screenshots WITH (public = false);
