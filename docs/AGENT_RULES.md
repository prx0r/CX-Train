# Agent Rules — CallCallum

## Golden Rule

Do not build new MVP features into the legacy Supabase/training-hub architecture.

## Hard Constraints

1. **AI scores are not authoritative.** AI extracts evidence only. Code computes the final score.
2. **No hidden facts to candidates.** Candidate-facing APIs must strip `hidden_facts`, `rubric`, `checkpoints`, `red_flags`, `ideal_ticket` from scenario/assessment responses.
3. **No placeholder polish.** Do not spend time making `/mvp/assist`, `/mvp/knowledge`, `/mvp/clients`, `/mvp/people`, `/mvp/analytics` pages look good. They are placeholders.
4. **No voice yet.** The voice module (`lib/voice/`) is frozen. Do not build on it.
5. **No analytics yet.** Aggregate dashboards and cross-candidate analytics come after the core assessment loop is proven.
6. **No Callum For You yet.** Manager-calibrated re-scoring comes after sufficient feedback data exists.
7. **No Supabase in active MVP.** The MVP runs on SQLite. Supabase code is legacy/frozen.
8. **Prioritise:** deterministic scoring > manager calibration > invite lifecycle > reproducibility > everything else.
9. **Version everything.** Every analysis run records prompt version, rubric version, model, provider, and input hash.
10. **Tests prove product behavior, not just route status.** Score differences, field leakage prevention, caching, and deterministic reproducibility must be tested.

## When in Doubt

- Ask: "Does this make the assessment loop more reliable, observable, or manager-trustworthy?"
- If no, defer it.
- If yes, build it in the `/mvp` + SQLite path.
