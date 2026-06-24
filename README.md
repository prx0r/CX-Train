# CX-Train - First Calls assessment

MSP technician call-readiness assessment platform. Managers create assessments, candidates complete simulated calls via the native web app, and the system generates evidence-based reports using OpenRouter free models.

**Primary path:** Native web app + OpenRouter free models (no account needed for candidates).

**Legacy paths:** Custom GPT, Chutes AI - documented separately, not used in the OpenRouter MVP.

## Stack

- **Frontend + API**: Next.js 14 (App Router)
- **Database**: Supabase (Postgres)
- **AI**: OpenRouter free models (OpenAI-compatible)
- **Styling**: Tailwind CSS
- **Charts**: Recharts

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

- **Supabase**: Create project at [supabase.com](https://supabase.com), add URL and keys
- **OpenRouter**: Get API key from [openrouter.ai/keys](https://openrouter.ai/keys), set `AI_API_KEY`

### 3. Database

1. Run `supabase/schema.sql` in Supabase SQL Editor
2. Run `supabase/seed.sql` to seed scenarios

### 4. First admin user

After the first user signs up (via Clerk), promote to admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

### 5. Verify OpenRouter connection

```bash
node scripts/test-openrouter.mjs
```

## Development

```bash
npm run dev
```

## Deployment

Deploy to Vercel. Set environment variables in the Vercel dashboard.

## Routes

- `/` - Landing
- `/sign-in`, `/sign-up` - Auth (Clerk)
- `/dashboard/admin/assessments` - Manager assessment list (primary)
- `/assessment/[token]` - Public candidate assessment page
