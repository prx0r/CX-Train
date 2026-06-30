# Future Ideas – Connexion Training Hub

**Principle: no sensitive data leaves ConnectWise or IT Glue.** All integrations use aggregated data, IDs only, or stay read-only inside your perimeter.

---

## 1. Personal Ticket Hub

**One consolidated view** for each tech: all ticket stats in a single place.

| What it shows | Data source |
|---------------|-------------|
| Total tickets closed (7d, 30d, lifetime) | ConnectWise (count only) |
| Breakdown by type/category (password reset, printer, email, etc.) | ConnectWise (aggregate counts) |
| Distribution chart: "40% password resets, 25% printer, 15% email..." | Same aggregate data |

No separate sections—everything in one hub. Informs targeted training and drill assignment. **Security:** Only category names and counts. No ticket IDs, descriptions, or client data.

---

## 2. Drill Setting

**Single drill system** for admins, managers, or automation.

| Who sets it | How |
|-------------|-----|
| **Admin / Manager** | Assign drill to individual or group (T1, T2, T3) |
| **Automated** | Suggested from weaknesses (e.g. weak on hostname → assign hostname KB drill) |

| Group | Example drill types |
|-------|---------------------|
| **T1** | Call sim stage 4, escalation scenarios, complete 2 KB articles |
| **T2** | Call sim stage 6, **documentation drill** (create/improve one IT Glue article) |
| **T3** | Advanced call sim, mentoring drill, documentation quality review |

Templates per group. Recurrence: daily, weekdays, or one-off. Pull ConnectWise stats to inform difficulty (e.g. tech gets lots of printer tickets → assign printer KB drill). **Security:** Stats from CW are aggregate only.

---

## 3. Documentation Incentives

**The key focus.** Incentivise knowledge creation and keep docs up to date.

| Feature | Description |
|---------|-------------|
| **Daily prompt** | "1 documentation update or clear-up per day" — e.g. fix a typo, clarify a step, add a note |
| **Created by tracking** | IT Glue stores author; Connexion displays "Created by [name]" — users get recognised |
| **Recognition** | Badges: "First doc", "10 docs", "Documentation champion" |
| **Drill integration** | T2+ drills include "create or improve one KB article" |

Track via IT Glue API: `author_id`, `doc_id`, `action` (create/edit). Connexion stores only IDs and counts—no document content. **Security:** Doc IDs and author counts only. Content stays in IT Glue.

---

## 4. Gamification (Points, Streaks, Multipliers)

**Points system** with streaks and multipliers. Resets every month.

| Mechanic | Description |
|----------|-------------|
| **Points** | Earn for: drill completion, training sessions, docs created, tickets closed |
| **Streaks** | Consecutive days completing daily drill → streak bonus |
| **Multipliers** | Streak of 5 days = 1.5× points; 10 days = 2× |
| **Monthly reset** | Leaderboard and points reset each month — fresh competition |

Badges (PB, Rising star, Pathway complete, Cleared for live) feed into points. **Security:** Uses aggregate stats only.

---

## 5. Global Leaderboards

**Team-wide rankings** — motivational, visible to everyone.

| Metric | Source |
|--------|--------|
| Training hours (30d) | Connexion |
| Tickets closed | ConnectWise (count only) |
| Drill completion % | Connexion |
| Avg score | Connexion |
| **Points** | Gamification (above) |

Single leaderboard view. Combines with gamification so points drive visibility. **Security:** Aggregate stats only. No individual ticket or client data.

---

## Summary – Safe Integration Patterns

1. **Counts only** – ticket counts, doc completion counts.
2. **IDs only** – article IDs, doc IDs; content stays in CW/IT Glue.
3. **Aggregates only** – category distributions; no individual tickets.
4. **Links out** – Connexion links to IT Glue/CW; user opens in normal session.
5. **No PII** – no client names, ticket bodies, or sensitive fields in Connexion.

---

## Suggested Order of Implementation

1. **Drill setting** – no external deps, immediate value.
2. **Documentation incentives** – IT Glue API for author tracking; daily doc prompt.
3. **Personal ticket hub** – ConnectWise aggregate (counts + categories).
4. **Gamification** – points, streaks, multipliers, monthly reset.
5. **Global leaderboards** – surface all metrics + points.
