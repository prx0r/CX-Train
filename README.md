# Connexion Training Hub

Internal MSP technician training platform. Custom GPTs (call simulator, triage trainer, etc.) POST session results into this backend. Admins view per-tech statistics, edit GPT prompts, manage pathways, and review ticket screenshots. Trainees see their own progress.

## Stack

- **Frontend + API**: Next.js 14 (App Router)
- **Auth**: Clerk (SSO-ready)
- **Database**: Supabase (Postgres)
- **Styling**: Tailwind CSS
- **Charts**: Recharts

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- **Clerk**: Create app at [clerk.com](https://clerk.com), add keys and webhook
- **Supabase**: Create project at [supabase.com](https://supabase.com), add URL and keys

### 3. Database

1. Run `supabase/schema.sql` in Supabase SQL Editor
2. Run `supabase/seed.sql` to add the call_sim bot and pathways
3. In Supabase Dashboard → Storage, create bucket `ticket-screenshots` (private)

### 4. Clerk webhook

Add webhook endpoint: `https://your-app.vercel.app/api/webhooks/clerk`

Events: `user.created`, `user.updated`

### 5. First admin user

After signing up with Clerk, set your user to admin in Supabase:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

### 6. GPT Actions

Paste the OpenAPI schema from `blueprint.md` into your Custom GPT Actions. Set authentication to API Key, header `x-api-key`, value = `bots.api_key` from the database (from seed or `SELECT api_key FROM bots WHERE id = 'call_sim'`).

## Development

```bash
npm run dev
```

## Deployment

Deploy to Vercel. Set environment variables in the Vercel dashboard.

## Routes

- `/` — Landing
- `/sign-in`, `/sign-up` — Auth
- `/dashboard` — Redirects to admin or trainee
- `/dashboard/admin` — Admin overview
- `/dashboard/admin/trainees` — All trainees
- `/dashboard/admin/trainees/[id]` — Trainee deep dive + checkpoint heatmap
- `/dashboard/admin/bots` — Manage bots
- `/dashboard/admin/bots/[id]` — Edit system prompt, personalities, pathways
- `/dashboard/admin/sessions` — All sessions
- `/dashboard/admin/sessions/[id]` — Session detail
- `/dashboard/trainee` — My progress
- `/dashboard/trainee/history` — My session history
- `/dashboard/trainee/sessions/[id]` — My session detail
