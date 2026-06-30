# Fortom — Where the Project Is Now

## How We Got Here

The project started as "LeetCode for MSPs" — a hiring/practice platform where candidates take simulated support calls, get scored, and managers review results. That still exists as the **Candidate Dashboard** (Product 1).

The old vision docs (`vision.md`, `vision2.md`) imagined a six-layer platform: Standards Repository → Procedure Packs → Training Sim → QA Review → AI Policy Middleware → Automation Readiness. Plus Skills Passport, Hiring Pipeline, Marketplace, Compliance Training, Focus Drills. Plus a LangGraph agent, voice pipeline, compliance frameworks, and manager calibration with LoRA adapters.

That was too much. The repo had 5 overlapping systems, dead code from old approaches, and no clear product identity.

**The shift happened when James (Connexion CEO) gave his actual requirements:**

1. A training tool that drills technicians on call handling, SLA judgement, first-call resolution
2. A taxonomy source-of-truth tool that lets techs query "what do I do with this ticket?" and safely update it

Not a gamified marketplace. Not leaderboards. Not XP/badges. Not a fake RMM clone.

---

## Current Architecture: Four Products, One Brain

```
Callum Action Backend (Product 0)
  ← ChatGPT Enterprise calls via Bearer auth
  ← Taxonomy (162 items, source of truth)
  ← SLA classifier (Connexion priority matrix)
  ← Client profiles + protocols
  → Returns structured recommendations with cited sources
  → Stores metadata only (no raw ticket content)

    ↓ feeds into

Manager Dashboard (Product 2)     Technician Dashboard (Product 3)     Candidate Dashboard (Product 1)
  /mvp/assist  — Callum cockpit      /msp/triage  — classify tickets      /mvp/assessment/[token]
  /mvp/clients — client profiles     /msp/taxonomy — browse taxonomy      /mvp/analysis/[id]
  /mvp/standards — SLA rules         /msp/training — role-specific drills
  /mvp/taxonomy — taxonomy browser   /msp/docs — operational notes
  /mvp/system — backend health       /msp/admin — org management
  /msp/admin — invites, techs
```

---

## What Actually Ships

### Product 0: Callum Action Backend (NEW — current priority)

The core insight from James: Connexion technicians are already using ChatGPT Enterprise with custom prompts. Callum should not replace that — it should sit behind it as the **auditable MSP decision engine**.

Technicians keep using ChatGPT Enterprise. The Custom GPT calls Callum Actions via Bearer-authenticated endpoints. Callum returns structured recommendations cited against taxonomy, SLA policy, and client protocols. Only metadata is stored — no raw ticket chains.

**Built:**
- `POST /api/actions/ticket-assist/analyse` — classify, ownership, missing info, response, escalation, SLA, sources
- `GET /api/actions/taxonomy/search` — search 162-item taxonomy
- `POST /api/actions/answers/{id}/flag` — flag wrong answers for manager review
- `POST /api/actions/proposals` — create taxonomy/client-protocol change proposals (never applied by GPT)
- `GET/POST /api/actions/client-profiles` — per-MSP client records
- `GET/POST /api/actions/client-protocols` — per-client protocol rules
- `GET /api/actions/health` — auth health check
- `GET /api/callum/dashboard?days=7` — grouped stats for all manager pages
- `POST /api/actions/seed` — Electracom test client + contractor protocol

**Key design decisions:**
- Bearer API key auth (not session cookies) — GPT Actions send `Authorization: Bearer <key>`
- Sensitivity scan blocks passwords, tokens, MFA codes before processing
- Strict impact mapping: `group (multi-user/site level)` not `company-wide` unless explicitly stated
- Sources always returned: `sla_policy: connexion_sla_v1` + `inference` fallback + taxonomy/client sources when matched
- Taxonomy search with synonym expansion and redirect detection
- Metadata-only storage by default — raw ticket content never persisted
- Proposal workflow: GPT creates → manager approves/applies in dashboard

### Product 1: Candidate Dashboard (existing — preserved)

Standalone hiring/practice flow. Manager sends invite link → candidate takes simulated call → submits ticket → gets scored.

- `lib/mvp/analysis/scoring.ts` — deterministic scoring engine
- `lib/mvp/analysis/runBaseCallumAnalysis.ts` — AI analysis pipeline
- `lib/mvp/analysis/normalize-scores.ts` — post-analysis competency normalization
- `lib/mvp/analysis/slaClassifier.ts` — Connexion SLA matrix
- 14 competencies, competency mapping test, bridge table for many-to-many criterion mappings
- 280 tests, all passing

### Product 2: Manager Dashboard (existing — integrated with Callum)

Managers create assessments, manage MSP orgs, set standards, and review Callum usage.

Pages now integrated with Callum data:
| Page | What it shows |
|------|---------------|
| `/mvp/assist` | Callum cockpit — usage cards, top topics, flags, proposals, competency-linked training recommendations |
| `/mvp/clients` | Client profile gaps, protocol proposals, protocol reference |
| `/mvp/taxonomy` | Taxonomy browser with search, import, proposals |
| `/mvp/standards` | SLA rules, escalation requirements, ticket field requirements |
| `/mvp/system` | Backend health, Callum action routes, last action timestamp |
| `/msp/admin` | Org creation, invite links, technician management, SLA overrides |

### Product 3: Technician Dashboard (built — secondary surface)

Native `/msp/*` pages for T1/T2 technicians. Primary interface remains ChatGPT Enterprise Custom GPT.

| Page | What it does |
|------|-------------|
| `/msp/triage` | Classify tickets against taxonomy, get playbook/escalation |
| `/msp/taxonomy` | Browse 162 items (role-filtered) |
| `/msp/training` | Role-specific scenarios generated from taxonomy items |
| `/msp/docs` | T2+ operational documentation linked to taxonomy |
| `/msp/admin` | Manager-only org/tech settings |

---

## What's Running Now

The backend is live via cloudflared tunnel to the dev server on port 3100:

- **URL:** `https://[random].trycloudflare.com` (changes on tunnel restart)
- **API Key:** Generated via `openssl rand -hex 32`, set as `CALLUM_ACTIONS_KEY` env var

All endpoints verified working:
- Health → 200 with auth, 401 without
- Taxonomy search → returns item IDs, classification paths, playbooks
- Ticket-assist analyse → returns structured JSON with sources, SLA, confidence
- Flag answer → creates flag for manager review
- Create proposal → `status: proposed`, never applied directly
- Seed → creates Electracom client + contractor protocol
- Dashboard → returns grouped stats for all manager pages

---

## What the Old Vision Got Right vs Wrong

| Old Vision (docs/agent-notes/) | Where We Landed |
|--------------------------------|-----------------|
| Six-layer standards platform | Callum Actions + taxonomy + SLA classifier covers layers 1-3 |
| LangGraph agent | Not needed yet — ChatGPT Enterprise handles the conversation layer |
| Manager calibration with LoRA | Not needed — James wants practical scores now, not model tuning |
| Voice pipeline (STT/TTS) | Built but deprioritised — James wants text-based training |
| Compliance frameworks (ISO, GDPR, etc.) | Built but deprioritised — not what James is asking for |
| Skills Passport / Marketplace | Not building — James wants internal training, not a hiring marketplace |
| Focus Drills / adaptive remediation | Future — once Callum metadata accumulates enough weakness signals |
| Training Shift (multi-ticket queue) | Not building yet |
| "MSP assessment standard" positioning | Correct direction — Callum Actions are the decision engine |
| "Standards repository" as structured data | Partially achieved through taxonomy + client protocols + SLA classifier |

---

## What We Stopped Building

- Public candidate marketplace
- Leaderboards, XP, badges, streaks
- Job posting analysis
- Full LangGraph agent
- Compliance framework expansion
- LoRA manager calibration
- Remote desktop simulator improvements
- Heavy testing/gamification architecture

---

## What's Next

### Immediate (James demo ready):
1. **Permanent deployment** — Coolify or Vercel deployment instead of cloudflared tunnel
2. **Proposal approval UI** — manager approves/applies client_protocol changes from `/mvp/clients`
3. **GPT Action setup** — import OpenAPI schema + Bearer key into ChatGPT Enterprise Custom GPT

### Short-term:
4. Competency-linked training recommendations already built — connect to actual training sim
5. Taxonomy gap enrichment — fill missing `helpdesk_tier` and `escalation_guidance` fields
6. Electracom contractor protocol demo loop — flag → proposal → approve → re-query

### Medium-term:
7. Level 1 scoring with James's 6 categories in training sim
8. Technician progress tracking (calls, scores, level, weak areas)
9. Level 2 first-call-resolution scenarios from taxonomy items

### Not building:
- Voice pipeline improvements
- Compliance framework additions
- Candidate marketplace
- LangGraph agent
- Manager calibration / LoRA
- Training Shift

---

## The Real Product

The grounded product is not "LeetCode for MSPs" or "six-layer standards platform."

It is:

> **Connexion's operational helpdesk playbook, turned into an auditable decision engine and training system.**

Two surfaces, one brain:

1. **Technicians use ChatGPT Enterprise** → Custom GPT calls Callum Actions → returns sourced answers
2. **Managers use the Callum dashboard** → see usage, flags, gaps → approve taxonomy/client-protocol proposals → assign training

The taxonomy (162 items from the Master Triage Classification List) is the foundation layer. Everything — classification, playbook, escalation, training scenarios — derives from it.

That is what James would pay for.
