# Architecture Questions

Questions from the MVP smoke-test session.

## Auth

1. **Auth provider** — Clerk or Supabase Auth for the manager side? The schema references `clerk_id` but the code imports Supabase auth. Which direction?

2. **Candidate identity** — Should candidates have any identity (name/email captured when manager creates the assessment) or remain fully anonymous (just the token)?

## Scenarios

3. **Multi-scenario** — Currently 1 scenario is seeded. Do you want managers to pick from multiple scenarios when creating an assessment, or assign randomly?

## AI Models

4. **Analysis model** — Free OpenRouter models are inconsistent. Do you want to pin a paid model (e.g. `openai/gpt-4o`) for analysis, or keep the fallback chain?

## Data Layer

5. **Persistence** — Keep SQLite for now and move to Supabase once the flow is validated? Or switch to Supabase earlier to test RLS and real auth?

## Demo / Development

6. **Demo bypass** — Should we add a proper demo mode (`ENABLE_DEMO=true`) that skips auth entirely so anyone hitting `/mvp` can use the full flow without signing in?
