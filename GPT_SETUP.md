# Link the First Calls Custom GPT

## What is already built

- Manager creates a candidate and private assessment code.
- Supabase stores tenants, candidates, invites, sessions, transcripts, tickets, evidence, scores, and manager reviews.
- Three fixed scenarios and deterministic scoring already exist.
- Dedicated GPT Actions now validate progress, start scenarios, and submit completed calls without Chutes.

## Configure the GPT

1. Deploy this repository to an HTTPS URL.
2. In `gpt-actions-openapi.yaml`, replace the `servers[0].url` value with `https://YOUR-DOMAIN/api`.
3. Create or edit the Custom GPT.
4. Paste the full contents of `gptinstructions.md` into **Instructions**.
5. Under **Actions**, import the full contents of `gpt-actions-openapi.yaml`.
6. Set Action authentication to **API Key**, custom header `x-api-key`.
7. Use the `call_sim` bot API key from Supabase:

```sql
select api_key from bots where id = 'call_sim';
```

8. Save privately and test with a manager-created assessment code and matching candidate name.

## Required production environment

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

No Chutes credentials are required for the Custom GPT workflow. The Custom GPT performs caller simulation and evidence extraction; the server validates and scores deterministically.

## Important limitation

Test the typed ChatGPT flow first. Voice availability and Action invocation can differ by ChatGPT client/surface. Do not promise voice support until the exact target client successfully completes all three Action calls.

## How manager feedback improves the system

The report now captures a blind manager rating/recommendation before revealing AI analysis, followed by a 1–5 usefulness rating and written AI-feedback comment. This creates paired calibration data:

```text
transcript + ticket + AI evidence/score + manager rating/decision + manager critique
```

Do not automatically train on every comment. First use these rows as an evaluation set: measure agreement, score error, repeated false positives/negatives, and weak checkpoint definitions. Update prompts and deterministic rubric weights only after reviewing patterns. Fine-tuning is a later option once there is a sufficiently large, cleaned, consistently labelled dataset and a separate held-out test set.
