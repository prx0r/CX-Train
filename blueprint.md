Connexion Training Hub — Full Build Blueprint
Context for the implementing LLM
You are building a web application called Connexion Training Hub. It is an internal MSP technician training platform. Multiple Custom GPTs on ChatGPT (call simulator, triage trainer, etc.) POST session results into a central backend. An admin dashboard lets the manager view granular per-tech statistics, edit GPT system prompts, manage training pathways, and review ticket screenshots submitted by trainees. Trainees see only their own progress.
The first GPT being integrated is a call simulation engine. The system prompt for this GPT will be provided separately. Your job is to build everything around it.

Stack
LayerTechnologyWhyFrontend + API routesNext.js 14 (App Router)Single codebase, API routes co-located, Vercel nativeAuthClerkRoles out of the box, SSO-ready, SOC 2, no custom auth logicDatabaseSupabase (Postgres)Row-level security, file storage for screenshots, real-time if neededDeploymentVercelAlready connected, free tier sufficientStylingTailwind CSSUtility-first, fast to buildChartsRechartsLightweight, React-native
No ORMs. Use Supabase JS client directly. Keep it simple.

Supabase Schema
Run this SQL in the Supabase SQL editor exactly as written.
sql-- USERS (synced from Clerk via webhook on user.created)
create table users (
  id uuid primary key default gen_random_uuid(),
  clerk_id text unique not null,
  name text not null,
  email text not null,
  role text not null default 'trainee', -- 'trainee' | 'admin'
  created_at timestamptz default now()
);

-- GPT BOTS (one row per Custom GPT)
create table bots (
  id text primary key, -- e.g. 'call_sim', 'triage_trainer'
  name text not null,  -- display name e.g. 'Call Simulator'
  description text,
  system_prompt text,  -- admin editable from dashboard
  api_key text not null, -- secret key this bot uses to authenticate POST /api/session
  active boolean default true,
  created_at timestamptz default now()
);

-- PERSONALITIES (caller personas for the call sim bot)
create table personalities (
  id uuid primary key default gen_random_uuid(),
  bot_id text references bots(id),
  name text not null,          -- e.g. 'Karen from Haslams'
  archetype text not null,     -- 'uncertain' | 'direct' | 'executive' | 'resistant'
  intensity int check (intensity between 1 and 3),
  description text,            -- admin-written flavour text
  avatar_emoji text default '👤',
  stats jsonb default '{"total_calls": 0, "avg_score": 0, "critical_fail_rate": 0}',
  active boolean default true,
  created_at timestamptz default now()
);

-- PATHWAYS (ordered training stages per bot)
create table pathways (
  id uuid primary key default gen_random_uuid(),
  bot_id text references bots(id),
  stage int not null,          -- 1-10
  name text not null,
  description text,
  difficulty text,             -- 'easy' | 'medium' | 'hard'
  priority_override text,      -- null | 'P1' | 'P2' | 'P3' | 'P4'
  pass_threshold int default 75, -- percentage
  is_boss_battle boolean default false,
  requires_ticket_screenshot boolean default false,
  unlock_condition jsonb,      -- e.g. {"min_stage": 8, "all_passed": true}
  created_at timestamptz default now(),
  unique(bot_id, stage)
);

-- SESSIONS (one row per completed call simulation)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  bot_id text references bots(id),
  pathway_stage int,
  personality_id uuid references personalities(id),

  -- scores
  score int,                   -- 0-100
  passed boolean,
  pathway_pass boolean,

  -- checkpoint granularity
  checkpoints jsonb not null default '{}',
  -- shape: { "hostname_gathered": true, "impact_gathered": false, "name_verified": true, ... }

  -- critical failures
  hostname_gathered boolean,
  impact_gathered boolean,
  priority_correct boolean,

  -- call metadata
  priority_assigned text,
  priority_correct_value text,
  issue_family text,
  caller_name text,
  caller_company text,
  caller_role text,
  scope_gathered boolean,
  intensity int,

  -- ticket assessment (pathways 9-10 or boss battle)
  ticket_screenshot_url text,  -- Supabase storage URL
  ticket_assessed boolean default false,
  ticket_score jsonb,
  -- shape: { summary_quality: 'good'|'needs_work', hostname_populated: bool, priority_correct: bool, description_score: int, overall_pass: bool }

  -- feedback
  feedback_text text,          -- full feedback report from GPT as markdown
  stronger_phrasing text[],    -- array of suggested phrasing improvements

  -- meta
  duration_seconds int,
  created_at timestamptz default now()
);

-- TRAINEE PROGRESS (one row per user per bot, updated after each session)
create table trainee_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  bot_id text references bots(id),
  current_stage int default 1,
  highest_stage_passed int default 0,
  total_sessions int default 0,
  total_passes int default 0,
  avg_score numeric(5,2) default 0,
  boss_battle_unlocked boolean default false,
  boss_battle_passed boolean default false,
  boss_battle_attempts int default 0,
  cleared_for_live boolean default false, -- set by admin only
  updated_at timestamptz default now(),
  unique(user_id, bot_id)
);

-- ROW LEVEL SECURITY
alter table users enable row level security;
alter table sessions enable row level security;
alter table trainee_progress enable row level security;
alter table bots enable row level security;
alter table personalities enable row level security;
alter table pathways enable row level security;

-- Policies: trainees see only their own data
create policy "trainee_own_sessions" on sessions
  for select using (
    user_id = (select id from users where clerk_id = auth.uid()::text)
    or exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin')
  );

create policy "trainee_own_progress" on trainee_progress
  for select using (
    user_id = (select id from users where clerk_id = auth.uid()::text)
    or exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin')
  );

-- Admins can read/write everything
create policy "admin_all_bots" on bots
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "admin_all_personalities" on personalities
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

create policy "admin_all_pathways" on pathways
  for all using (exists (select 1 from users where clerk_id = auth.uid()::text and role = 'admin'));

Environment Variables
env# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=        # for syncing users to Supabase

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-side only, never expose to client

NEXT_PUBLIC_APP_URL=         # e.g. https://connexion-hub.vercel.app
```

---

## File Structure
```
/app
  /api
    /session          POST  - receive GPT session result
    /progress/[name]  GET   - return trainee progress for GPT session start
    /upload           POST  - receive ticket screenshot from GPT
    /webhooks/clerk   POST  - sync new users to Supabase
  /(auth)
    /sign-in
    /sign-up
  /(dashboard)
    /layout.tsx           - auth guard, role check
    /page.tsx             - redirect: admin→/admin, trainee→/trainee
    /admin
      /page.tsx           - admin overview
      /trainees/page.tsx  - all trainees table
      /trainees/[id]/page.tsx  - individual trainee deep dive
      /bots/page.tsx      - manage bots
      /bots/[id]/page.tsx - edit bot: system prompt, personalities, pathways
      /sessions/page.tsx  - all sessions feed with filters
      /sessions/[id]/page.tsx - single session detail + ticket screenshot
    /trainee
      /page.tsx           - my progress dashboard
      /history/page.tsx   - my session history
/components
  /admin
    TraineesTable.tsx
    SessionFeed.tsx
    BotEditor.tsx
    PersonalityCard.tsx
    PathwayEditor.tsx
    TicketReview.tsx
    StatCard.tsx
    CheckpointHeatmap.tsx
  /trainee
    PathwayProgress.tsx
    SessionCard.tsx
    BossBattleBanner.tsx
    LiveClearanceBadge.tsx
  /shared
    ScoreBadge.tsx
    CheckpointList.tsx
    FeedbackPanel.tsx
/lib
  supabase.ts        - client + server clients
  auth.ts            - Clerk helpers, role checking
  scoring.ts         - score calculation logic (mirrors GPT scoring)
  types.ts           - all TypeScript types matching DB schema

API Routes — Full Specification
POST /api/session
Called by the Custom GPT Action at the end of every session. This is the most important endpoint.
Authentication: API key in header x-api-key. Validate against bots.api_key for the given bot_id. Return 401 if missing or wrong.
Request body (JSON sent by GPT):
json{
  "bot_id": "call_sim",
  "tech_name": "Jordan",
  "pathway_stage": 3,
  "personality_id": "uuid-or-null",
  "score": 82,
  "passed": true,
  "hostname_gathered": true,
  "impact_gathered": true,
  "priority_assigned": "P2",
  "priority_correct": "P2",
  "priority_correct_bool": true,
  "issue_family": "Identity & Access",
  "caller_name": "Sarah",
  "caller_company": "Haslams Chartered Surveyors",
  "caller_role": "Finance",
  "scope_gathered": true,
  "intensity": 2,
  "duration_seconds": 420,
  "checkpoints": {
    "name_verified": true,
    "company_confirmed": true,
    "hostname_gathered": true,
    "location_confirmed": true,
    "issue_defined": true,
    "last_working_asked": false,
    "recent_changes_asked": true,
    "exact_error_asked": false,
    "reboot_asked": true,
    "scope_determined": true,
    "impact_determined": true,
    "priority_assigned": true,
    "ticket_expectation_set": true,
    "timeframe_given": true,
    "callback_window_given": true
  },
  "ticket_assessed": false,
  "ticket_score": null,
  "feedback_text": "Full markdown feedback report here...",
  "stronger_phrasing": [
    "Instead of 'what seems to be the issue', try 'can you describe exactly what happens when you try to log in'",
    "When setting callback: 'I'll have someone call you back within 30 minutes — is this number best?'"
  ]
}
Server logic:

Validate x-api-key against bots table
Look up user by tech_name in users table (case-insensitive). If not found, create a stub user with role trainee
Insert row into sessions
Upsert trainee_progress: increment total_sessions, recalculate avg_score, update current_stage if this session passed and stage is current, update boss_battle_unlocked if stages 1–8 all passed
Return { success: true, progress: { current_stage, avg_score, boss_battle_unlocked, cleared_for_live } }


GET /api/progress/[name]
Called by the GPT Action at the start of every session so the GPT knows which pathway to run and can personalise its opening.
Authentication: Same x-api-key header.
Query params: ?bot_id=call_sim
Response:
json{
  "found": true,
  "tech_name": "Jordan",
  "current_stage": 4,
  "highest_stage_passed": 3,
  "total_sessions": 12,
  "total_passes": 9,
  "avg_score": 78.4,
  "boss_battle_unlocked": false,
  "boss_battle_passed": false,
  "boss_battle_attempts": 0,
  "cleared_for_live": false,
  "recent_weaknesses": ["last_working_asked", "exact_error_asked"],
  "personality_stats": [
    { "name": "Karen", "archetype": "resistant", "avg_score": 61 },
    { "name": "Marcus", "archetype": "executive", "avg_score": 84 }
  ]
}
recent_weaknesses is derived from the last 5 sessions — any checkpoint with a false rate above 40%. The GPT uses this to bias its caller behaviour toward those weak areas.

POST /api/upload
Called by GPT Action when trainee submits a ticket screenshot.
Auth: Same API key.
Body: multipart/form-data with fields session_id, bot_id, tech_name, file (image).
Logic:

Validate API key
Upload image to Supabase Storage bucket ticket-screenshots with path /{bot_id}/{tech_name}/{session_id}.png
Update sessions row: set ticket_screenshot_url
Return { url: "..." } — GPT then includes this in the session POST


POST /api/webhooks/clerk
Clerk calls this when a user is created or updated.
Logic: On user.created event, insert into users table with clerk_id, name, email, role: 'trainee'. On user.updated, update name/email. Verify Clerk webhook signature using CLERK_WEBHOOK_SECRET.

Dashboard Pages — What to Build
Admin: Overview /admin
Four stat cards at the top:

Total trainees
Sessions this week
Average score across all sessions this week
Trainees cleared for live calls

Below: two columns.
Left — Weakest checkpoints (bar chart): aggregate across all sessions in last 30 days, show the 5 checkpoints with lowest pass rate. This is the most useful thing your MD will look at.
Right — Recent sessions feed: last 10 sessions across all trainees, showing tech name, bot, score, pass/fail, critical failures flagged in red.
Bottom — Per-trainee pathway progress: grid of trainee cards, each showing name, current stage out of 10, boss battle status, cleared-for-live badge.

Admin: Trainee Deep Dive /admin/trainees/[id]
This is the most important admin page. Everything about one tech.
Header: Name, total sessions, avg score, current stage, cleared-for-live toggle (admin sets this manually — this is the gate before live calls).
Checkpoint heatmap: 15 checkpoints as columns, last 10 sessions as rows. Green = passed, red = failed. Instantly shows what they always forget. This is visually the most powerful element — make it prominent.
Score over time: Line chart of score per session, coloured by pass/fail.
Personality breakdown: For each personality they've faced — avg score, number of attempts, critical fail rate. Shows which caller types they struggle with.
Session history table: Every session with expandable row showing full feedback text, stronger phrasing suggestions, ticket screenshot if present.
Boss battle section: Locked/unlocked status, attempts, pass/fail history.

Admin: Bot Editor /admin/bots/[id]
Three tabs:
Tab 1 — System Prompt: Large textarea with the full GPT system prompt. Save button. Version history (store last 5 versions in a jsonb column on bots). Warning banner: "Saving here updates the database only. You must also paste the updated prompt into the Custom GPT configure screen in ChatGPT." (Until you build the automation to push it via API — that's a later enhancement.)
Tab 2 — Personalities: Grid of personality cards. Each card shows: avatar emoji, name, archetype badge, intensity (1/2/3 stars), description, stats (total calls, avg score, critical fail rate). Admin can create new personalities, edit existing, toggle active/inactive. These personality IDs are what get sent in session payloads so stats accumulate per personality.
Tab 3 — Pathways: Ordered list of 10 stages. Each stage is editable inline: name, description, difficulty, priority override, pass threshold, boss battle toggle, ticket screenshot required toggle. Drag to reorder (use @dnd-kit/core).

Admin: Session Detail /admin/sessions/[id]
Full single session view.

Call summary block (all metadata)
Score with breakdown by checkpoint weight
Checkpoint list: each checkpoint with pass/fail, weight, contribution to score
Critical failure warnings if hostname or impact were missed
Ticket screenshot (if present) — full size, with ticket assessment scorecard alongside
Full feedback text rendered as markdown
Stronger phrasing suggestions as styled callout blocks
Personality that was used with its stats context


Admin: All Sessions /admin/sessions
Filterable table. Filters: bot, trainee, date range, pass/fail, stage, personality, critical failures only. Sortable columns. Click row → session detail.

Trainee: My Progress /trainee
Pathway progress bar (stages 1–10, current stage highlighted, completed stages checked, locked stages greyed out).
Boss battle section: locked with padlock until stages 1–8 passed. Unlocked state shows dramatic banner. Passed state shows cleared badge.
Cleared for live call: big green badge when admin has toggled it. Until then shows "Complete all pathways and pass the boss battle to unlock live call clearance."
Recent sessions: last 5 cards with score, pass/fail, which personality.
Weakness spotlight: "You've missed 'last working time asked' in 4 of your last 5 calls. Focus on this next session." Derived from checkpoint data.

GPT Actions Schema
Paste this into the Custom GPT Actions config screen (image 2 in your screenshots). Set authentication to API Key, header name x-api-key, value is whatever you set in bots.api_key for call_sim.
yamlopenapi: 3.0.0
info:
  title: Connexion Training Hub API
  version: 1.0.0
  description: Session reporting and progress retrieval for Connexion training GPTs

servers:
  - url: https://your-app.vercel.app/api

paths:
  /progress/{name}:
    get:
      operationId: getTraineeProgress
      summary: Get trainee progress at session start
      description: Call this at the very start of each session before generating the call. Returns current pathway stage, weaknesses to target, and personality stats.
      parameters:
        - name: name
          in: path
          required: true
          schema:
            type: string
        - name: bot_id
          in: query
          required: true
          schema:
            type: string
            default: call_sim
      responses:
        '200':
          description: Trainee progress data

  /session:
    post:
      operationId: submitSession
      summary: Submit completed session results
      description: Call this immediately after the user says 'end call' and before outputting the feedback report. Submit all session data. The response will include updated progress to include in the feedback.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - bot_id
                - tech_name
                - pathway_stage
                - score
                - passed
                - hostname_gathered
                - impact_gathered
                - checkpoints
              properties:
                bot_id:
                  type: string
                tech_name:
                  type: string
                pathway_stage:
                  type: integer
                personality_id:
                  type: string
                score:
                  type: integer
                passed:
                  type: boolean
                hostname_gathered:
                  type: boolean
                impact_gathered:
                  type: boolean
                priority_assigned:
                  type: string
                priority_correct:
                  type: string
                priority_correct_bool:
                  type: boolean
                issue_family:
                  type: string
                caller_name:
                  type: string
                caller_company:
                  type: string
                caller_role:
                  type: string
                scope_gathered:
                  type: boolean
                intensity:
                  type: integer
                duration_seconds:
                  type: integer
                checkpoints:
                  type: object
                  properties:
                    name_verified: { type: boolean }
                    company_confirmed: { type: boolean }
                    hostname_gathered: { type: boolean }
                    location_confirmed: { type: boolean }
                    issue_defined: { type: boolean }
                    last_working_asked: { type: boolean }
                    recent_changes_asked: { type: boolean }
                    exact_error_asked: { type: boolean }
                    reboot_asked: { type: boolean }
                    scope_determined: { type: boolean }
                    impact_determined: { type: boolean }
                    priority_assigned: { type: boolean }
                    ticket_expectation_set: { type: boolean }
                    timeframe_given: { type: boolean }
                    callback_window_given: { type: boolean }
                ticket_assessed:
                  type: boolean
                ticket_score:
                  type: object
                feedback_text:
                  type: string
                stronger_phrasing:
                  type: array
                  items:
                    type: string
      responses:
        '200':
          description: Session recorded, returns updated progress
```

---

## GPT System Prompt Additions

Add these two instruction blocks to the existing call simulator system prompt. They must come at the top, before everything else.
```
SESSION INITIALISATION (run before every call)
At the very start, before entering IDLE mode, call getTraineeProgress with the tech's name and bot_id: call_sim. If the tech's name is not known, ask: "What's your name?" then call getTraineeProgress.

Use the response to:
- Set the correct pathway stage automatically (do not ask the tech which stage they are on)
- If recent_weaknesses contains entries, bias the call toward those checkpoints being harder to extract
- If boss_battle_unlocked is true and they say "boss battle", run a hard P1 call with a random personality at intensity 3
- If cleared_for_live is true, tell them: "You're cleared for live calls. Well done."

SESSION SUBMISSION (run immediately when user says 'end call')
Before outputting any feedback, call submitSession with all session data. Use the response to append to the feedback report:

PROGRESS UPDATE
Current stage: [current_stage] / 10
Sessions this stage: [sessions on this stage]
Average score: [avg_score]%
Boss battle: [locked/unlocked/passed]
Live call clearance: [cleared/not yet]

If the response shows boss_battle_unlocked just became true, add a prominent banner:
"🔓 BOSS BATTLE UNLOCKED — You've completed all 10 stages. Type 'boss battle' to begin your final challenge."

Personality System — Instructions for Admin
When your MD adds personalities in the dashboard, each one gets a UUID. That UUID must be seeded into the GPT's knowledge base so the GPT can reference it when submitting sessions. The cleanest way to do this is to have the admin export a personalities.json file from the dashboard and upload it as a knowledge file to the Custom GPT. Format:
json[
  {
    "id": "uuid-here",
    "name": "Karen",
    "archetype": "resistant",
    "intensity": 3,
    "description": "Finance director at a solicitors firm. Had a bad experience with IT last year. Polite but subtly undermining. References previous failures.",
    "avatar_emoji": "😤"
  }
]
The GPT is instructed: "When starting a call, select a personality from the uploaded personalities list. Include the personality's id in the session submission payload."
This means personality stats in the dashboard are real — you can see that techs average 61% against Karen and 84% against Marcus, and the MD can use that to target training.

Modular Bot Addition — How to Add a New GPT Later

Insert a row into bots table with a new id (e.g. triage_trainer), generate a new api_key
Add pathway rows for the new bot into pathways
Add personalities for the new bot into personalities
Create the new Custom GPT on ChatGPT, paste the same OpenAPI schema into Actions (just change bot_id default to triage_trainer)
Zero changes to the API routes — bot_id in every payload means all existing logic handles it
Dashboard automatically shows the new bot in all filters and views because every query is filtered by bot_id not hardcoded


Build Order
Day 1 — Backend
Supabase schema, env vars, three API routes (session, progress, upload), Clerk webhook sync, validate everything with Postman before touching frontend.
Day 2 — Auth + shell
Clerk setup, sign-in/sign-up pages, dashboard layout with role-based routing, trainee vs admin redirect.
Day 3 — Admin core
Overview page, trainees table, trainee deep dive with checkpoint heatmap (this is the hero feature — build it well).
Day 4 — Bot editor
System prompt editor with version history, personality CRUD, pathway editor with drag-to-reorder.
Day 5 — Session detail + trainee view
Session detail page with ticket screenshot, trainee progress page with pathway progress bar and boss battle section.
Day 6 — Wire up GPT
Configure GPT Actions with the OpenAPI schema, test end-to-end with a real call session, verify data appears in dashboard.
Day 7 — Polish
Checkpoint heatmap visual, score charts, weakness spotlight on trainee page, cleared-for-live toggle and badge.

Critical Implementation Notes
The checkpoint heatmap is the centrepiece. 15 checkpoints × last N sessions. Green/red grid. This shows at a glance what a tech always forgets. Make it visually prominent — it's the thing your MD will open the dashboard to look at every morning.
Cleared for live is admin-only. It is a manual toggle. The system unlocks the boss battle automatically, but cleared-for-live requires a human decision. Make this visually distinct — a big switch with a confirmation modal. This is the gate before someone talks to a real client.
Screenshot storage: Supabase Storage, private bucket, signed URLs on the server only. Never expose a public URL for ticket screenshots — they may contain client data.
Tech name matching is fuzzy: Techs type their name into ChatGPT voice mode. "Jordan", "jordan", "Jordan Smith" — all need to match the same user. Use case-insensitive ilike on first name, and if multiple matches exist return the closest. Log unmatched names so admin can resolve them.
Version the system prompt. Store last 5 in a jsonb array on bots. The admin can revert. They will need to revert at some point.
The recent_weaknesses field returned from GET /progress is the secret weapon. The GPT uses it to make calls harder in exactly the areas the tech is weak. This is what makes the system feel intelligent rather than random.