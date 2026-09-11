# In-client test procedure (run inside ChatGPT, typed first)

For each GPT (candidate/manager/tech), execute every operation once and
record pass/fail with the client name + version:

1. Candidate: validate bad code (expect refusal) → validate good code →
   3 chat turns → submit ticket → fetch report → confirm verdict matches
   the web report for the same assessment.
2. Manager: create assessment → open invite URL in browser (matches) →
   review → save feedback → get/update standards (echo check) →
   confirm then reject two proposals (one each, never batch).
3. Tech: triage a real ticket → search taxonomy → generate scenario →
   verify every procedure quote exists verbatim in taxonomy.
4. Voice (only after 1–3 green): repeat candidate flow by voice on the
   exact client build; any deviation fails the surface, not the backend.
5. Record all results; client differences are product decisions, not bugs
   to silently absorb.
