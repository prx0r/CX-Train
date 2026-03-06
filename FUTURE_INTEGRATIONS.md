# Future Ideas – Connexion Training Hub

Brainstorm for ConnectWise + IT Glue integrations. **Principle: no sensitive data leaves ConnectWise.** All integrations should use aggregated/anonymised data, IDs only, or stay read-only inside your perimeter.

---

## 1. Ticket type distribution (ConnectWise)

**Goal:** Show what kind of tickets each tech has answered over their lifetime—without exposing ticket content.

| Approach | What we get | What we don't get |
|----------|-------------|-------------------|
| **CW API (aggregate)** | Counts per ticket type/category per tech, e.g. `{ "password_reset": 120, "printer": 45, "email": 30 }` | No ticket IDs, no descriptions, no client data |
| **Lifetime view** | "You've handled 847 tickets: 40% password resets, 25% printer, 15% email..." | No individual ticket content |

**Use case:** Trainees see their own mix; admins see who handles what. Informs targeted training and drill assignment.

**Security:** Only category names and counts. No PII, no ticket bodies.

---

## 2. Incentivise knowledge creation & documentation

**Goal:** Reward techs for creating and improving documentation in IT Glue.

| Feature | Description |
|---------|-------------|
| **Doc creation badge** | Track when a tech creates/edits IT Glue articles (via API: author_id, doc_id, action) |
| **Completion drill** | "Complete 3 assigned KB articles this week" — Connexion tracks completion |
| **Leaderboard** | Most docs created/updated this month (anonymised counts only) |
| **Gamification** | Badges for "First doc", "10 docs", "Documentation champion" |

**Security:** Only store doc IDs and author counts. No document content in Connexion.

---

## 3. Daily drill with T1 / T2 / T3 groups

**Goal:** Manager assigns drills to groups; each tier has different drill types.

| Group | Example drills |
|-------|----------------|
| **T1** | Call sim stage 4, 2 escalation scenarios, complete 2 KB articles |
| **T2** | Call sim stage 6, escalation T2→T3, **documentation drill** (create/improve one IT Glue article) |
| **T3** | Advanced call sim, **mentoring drill** (review a T1's ticket), documentation quality review |

**Features:**
- Manager assigns drill to individual or group (T1, T2, T3)
- Each group has different drill templates (T2 gets documentation-focused drills)
- Trainee sees "Today's drill: create or improve one KB article in IT Glue"
- Pull stats from ConnectWise to inform drill difficulty (e.g. if tech gets lots of printer tickets, assign printer KB drill)

**Security:** Stats from CW are aggregate only. No ticket content.

---

## 4. Global leaderboards

**Goal:** Everyone can see team-wide rankings—motivational, not punitive.

| Leaderboard | Metric | Visibility |
|-------------|--------|------------|
| **Training hours** | Total hours in Connexion (last 30d) | All trainees |
| **Tickets closed** | From ConnectWise (count only) | All trainees |
| **Drill completion** | % of daily drills completed | All trainees |
| **Avg score** | Call sim / escalation scores | All trainees |

**Security:** Only aggregate stats. No individual ticket or client data.

---

## 5. Motivational badges

**Goal:** Celebrate achievements with visible badges.

| Badge | Trigger |
|-------|---------|
| **PB (Personal Best)** | Most tickets in a day (from CW count) |
| **Streak** | 5 days in a row completing daily drill |
| **Rising star** | +10% avg score vs last month |
| **Documentation hero** | 5 IT Glue articles created/updated this month |
| **Pathway complete** | Reached stage 10 (boss battle) |
| **Cleared for live** | Admin marked as ready for live calls |

**Security:** Badges use aggregate stats only. No sensitive data.

---

## 6. Personal Hub (per trainee)

**Goal:** Each user sees their own training stats, strengths/weaknesses, and drill in one place.

| Feature | Description | Data source |
|--------|-------------|-------------|
| **My stats** | Sessions, avg score, pathway stage, training hours | Connexion DB (already have) |
| **My weaknesses** | Top 2–3 checkpoints to improve | Connexion (checkpoint pass rates) |
| **My strengths** | What they’re good at | Connexion |
| **Today’s drill** | Short daily task set by admin (e.g. “1 call sim, stage 4”) | Connexion (new `daily_drills` table) |

**Security:** All data stays in Connexion. No ConnectWise data required.

---

## 7. Admin daily drill builder

**Goal:** Admins assign a short daily drill per trainee or group.

| Feature | Description |
|---------|-------------|
| **Drill template** | e.g. “1 call sim stage 5”, “2 escalation scenarios”, “Review ticket screenshot” |
| **Assign to** | Individual trainee or “all trainees” |
| **Recurrence** | Daily, weekdays only, or one-off |
| **Trainee view** | “Today’s drill: complete 1 call sim at stage 6” with link to start |

**Security:** Fully internal. No external APIs.

---

## 8. ConnectWise – ticket count (no content)

**Goal:** Show trainees how many tickets they’ve handled, without exposing ticket content.

| Approach | What we get | What we don’t get |
|----------|-------------|-------------------|
| **CW API (read-only)** | Count of tickets closed by tech in last 7/30 days | No summary, no description, no client data |
| **Webhook / scheduled job** | Push only `{ tech_email, ticket_count, period }` into Connexion | No ticket IDs, no bodies |

**Use case:** “You closed 47 tickets this week” on the hub. Motivational, not operational.

**Security:** Only aggregate counts. No PII, no ticket content.

---

## 9. IT Glue – document completion (no content)

**Goal:** Encourage trainees to complete KB articles without reading document content.

| Approach | What we get | What we don’t get |
|----------|-------------|-------------------|
| **IT Glue API** | List of document IDs assigned to a tech | No document body, no client data |
| **Connexion stores** | `user_id`, `document_id`, `completed_at` | Document title only if needed for display |

**Use case:** “Complete 3 assigned KB articles this week” as a drill. Connexion tracks completion; IT Glue stays source of truth for content.

**Security:** Only IDs and completion status. No document content in Connexion.

---

## 10. ConnectWise – category/type distribution (anonymised)

**Goal:** Show “you mostly handle password resets and printer issues” for training targeting.

| Approach | What we get | What we don’t get |
|----------|-------------|-------------------|
| **Aggregate only** | Counts per category/type per tech, e.g. `{ "password_reset": 12, "printer": 8 }` | No ticket IDs, no clients, no descriptions |
| **Scheduled export** | CSV/JSON with `tech_id`, `category`, `count` | No other fields |

**Use case:** Admin sees “Tom gets lots of printer tickets” → assigns printer-focused call sim or KB drill.

**Security:** Only category names and counts. No ticket content or client data.

---

## 11. IT Glue – article suggestions for weaknesses

**Goal:** Suggest KB articles based on Connexion weaknesses, without exposing article content.

| Approach | What we get | What we don’t get |
|----------|-------------|-------------------|
| **Tag-based** | IT Glue articles tagged e.g. `hostname`, `impact-gathering` | No article body in Connexion |
| **Connexion stores** | Mapping `checkpoint_key → [article_id_1, article_id_2]` | Only IDs; links open in IT Glue |

**Use case:** Trainee weak on “hostname gathered” → Connexion shows “Review: [link to IT Glue article]”. User clicks through to IT Glue in their normal session.

**Security:** Connexion only stores article IDs and checkpoint mapping. Content stays in IT Glue.

---

## 12. Escalation drill from real patterns (anonymised)

**Goal:** Create escalation scenarios from common patterns, without real ticket data.

| Approach | What we get | What we don’t get |
|----------|-------------|-------------------|
| **Aggregate patterns** | “X% of tickets in category Y get escalated” | No ticket details, no clients |
| **Synthetic scenarios** | Admin or script creates scenario text: “User reports printer offline…” | No real incidents |

**Use case:** Escalation bot uses synthetic scenarios based on anonymised escalation rates, not real tickets.

**Security:** No real ticket content. Only aggregate stats to inform scenario design.

---

## 8. “Readiness score” (Connexion-only)

**Goal:** Single score combining training hours, scores, pathway progress, and drill completion.

| Inputs | Weight (example) |
|--------|------------------|
| Training hours (last 30d) | 20% |
| Avg score (last 10 sessions) | 30% |
| Pathway stage reached | 25% |
| Daily drill completion rate | 25% |

**Use case:** “Tom: 72% readiness. Focus: complete daily drills and 2 more stage 6 sessions.”

**Security:** Fully internal. No ConnectWise/IT Glue data.

---

## Summary – safe integration patterns

1. **Counts only** – ticket counts, document completion counts.
2. **IDs only** – article IDs, document IDs; content stays in CW/IT Glue.
3. **Aggregates only** – category distributions, escalation rates; no individual tickets.
4. **Links out** – Connexion links to IT Glue/CW; user opens in normal session.
5. **No PII** – no client names, ticket bodies, or sensitive fields in Connexion.

---

## Suggested order of implementation

1. **Personal hub + daily drills** – no external deps, immediate value.
2. **Readiness score** – uses existing Connexion data.
3. **ConnectWise ticket count** – simple, low-risk first CW integration.
4. **IT Glue document completion** – similar pattern to ticket count.
5. **Category distribution** – needs CW API access and careful scoping.
6. **Article suggestions** – needs tag schema in IT Glue and mapping in Connexion.
