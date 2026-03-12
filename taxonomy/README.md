# Helpdesk Taxonomy

Source of truth is now stored in Supabase (`taxonomy_items` + `taxonomy_changes`).

## Files
- `taxonomy.json` is a seed/template reference only.
- `gptinstructions.md` is the system prompt for the taxonomy GPT.

## How to update
- Use the taxonomy GPT with Actions:
  - `POST /taxonomy/propose-change`
  - `POST /taxonomy/apply-change`
- Or edit via Supabase SQL or dashboard.

## Notes
- Every change is logged in `taxonomy_changes` with who/why and timestamps.
- The API returns exact items; the GPT must not answer from memory.
