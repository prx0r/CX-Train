# Working Setup Guide

This guide gets both projects running with deterministic scoring and a verifiable taxonomy GPT.

## 1) Supabase migrations
Run these SQL files in Supabase SQL editor:

1. `supabase/migrations/20260311000100_add_scoring_fields.sql`
2. `supabase/migrations/20260311000200_add_levels_and_taxonomy.sql`

## 2) Environment variables
Ensure `.env.local` includes:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `TAXONOMY_BOT_ID` (default `taxonomy`)
- `ENABLE_DEMO` (optional, set to `true` to enable demo admin)

## 3) Start the app

```bash
npm install
npm run dev
```

## 4) Project 1: Call GPT

### Actions schema
Paste `gpt-actions-openapi.yaml` into the GPT Actions config.

### Prompt
Use `gptinstructions.md` in the admin bot editor.

### Validation
The session endpoint will reject calls without:
- `rubric_evidence`
- `severity_level`
- `impact_level`

### What to check
- Admin session detail shows rubric breakdown and priority correctness.
- Trainee view shows level + points.

## 5) Project 2: Taxonomy GPT

### Actions schema
Same `gpt-actions-openapi.yaml` (taxonomy endpoints included).

### Prompt
Use `taxonomy/gptinstructions.md`.

### Admin UI
Open `/dashboard/admin/taxonomy` to view and edit items.

### Upload taxonomy
Use the "Import taxonomy" box to upload Excel/CSV. This replaces existing rows and logs an import.

### Source docs
Use "Source docs" to upload playbooks/escalation docs; they are served to the GPT via `/prompt/{bot_id}`.

### Update workflow
- GPT proposes changes via `/taxonomy/propose-change`.
- Admin applies via `/taxonomy/apply-change` (or admin UI).

## 6) Test checklist

- Submit a call session and confirm deterministic scoring in DB.
- Query taxonomy via GPT and verify returned id + fields.
- Propose and apply a taxonomy change and verify audit row in `taxonomy_changes`.
- Upload taxonomy and confirm items refreshed.
