# Ideas Master — Organised by Product

Every idea from every `.md` file in the repo, classified under one of the three products. If it doesn't fit, it goes under **Other**.

---

# Product 1: Candidate Platform

Hiring/practice assessments for external candidates. Manager sends link → candidate takes simulated call → submits ticket → gets scored.

## Assessment Engine
- [ ] Assignment type selector (hiring_exam, training_drill, training_shift) — partially done
- [ ] Training Shift mode (multi-ticket queue, time pressure, end-of-shift summary) — not built
- [ ] Training queue mode: scheduled/random AI calls across the day, difficulty escalation
- [ ] Live shadow mode: trainee handles real tickets with Callum observing/coaching
- [ ] Multi-player assessments (one assessment, three sessions with different difficulty profiles)
- [ ] Assessment batching / bulk invite via CSV import
- [ ] Retake/replay support (clone assessment for retry, new token, never modifies existing)
- [ ] Soft delete for assessments
- [ ] Challenge/boss battle calls (hard P1 scenario with random personality)
- [ ] Level progression: Level 1 (Call Handling), Level 2 (First-Call Resolution), Level 3 (Escalation Judgement), Level 4 (Queue Pressure)
- [ ] Difficulty levels (manager-selectable per assessment)
- [ ] Randomised ticket frequency for training shift
- [ ] Timer/SLA display in sidebar during call
- [ ] Anti-cheat: candidate cannot see hidden truth, pack snapshot frozen at creation

## Scoring & Analysis
- [ ] 3-category scoring: Professionalism 1-10, Qualification 1-10, SLA Judgement 1-10
- [ ] Two-layer scoring: Callum Rating (immutable) + Callum For You (manager-adjusted)
- [ ] Manager Overlay: category weight multipliers, critical overrides, disabled criteria, custom criteria, threshold adjustments
- [ ] Slider-based scoring (0-10 per criterion with anchor descriptions at 0, 5, 10)
- [ ] Multi-framework scoring: 5 categories with weighted frameworks per category
- [ ] Manager-configurable framework weights and category weights
- [ ] Taxonomy-aware criterion resolution (maps taxonomy playbook steps to rubric criteria)
- [ ] Evidence traceability (deterministic_source field explains why criterion passed/failed)
- [ ] Standards Alignment Framework (ITIL 4, OWASP, ISO 27001, ISO 20000-1, HDI, GDPR)
- [ ] Standards Coverage Report per assessment
- [ ] Certification readiness prediction from assessment patterns

## Candidate Experience
- [ ] Unified shell component across all 3 assignment types
- [ ] Voice-first, text-free interaction (no chat bubbles, no text input)
- [ ] Persistent ticket panel on left side during call
- [ ] Remote tools as bounded sandbox (tab-based: Outlook, Browser, CMD)
- [ ] Collapsible transcript toggle for review
- [ ] Auto-play only after user-initiated action (answering call)
- [ ] Ticket queue as landing page for training shift
- [ ] Incoming call banner with caller info and Answer Call button
- [ ] Mic button to speak, customer replies play via TTS automatically
- [ ] Status bar: "Customer is thinking...", "Listening...", "Connecting..."
- [ ] Candidate can edit transcript before sending (dev mode only)
- [ ] Remove Win11 desktop + window manager from candidate flow
- [ ] Voice interruption/barge-in support

## Learning & Feedback
- [ ] Learning walkthrough showing ideal diagnostic path vs actual (per-step comparison)
- [ ] Post-call feedback report with categories (Call, Diag, Fix, Ticket, Prof, Safety)
- [ ] "What you did right" + "What you missed" + "Red flags triggered" sections
- [ ] Retake button on results page
- [ ] Curveball injection at configured frequency
- [ ] AI-assisted service desk pack (trainee uses AI, scored on AI-use judgment)
- [ ] Focus drills: personalised scenarios generated from past weak spots
- [ ] Remedial training auto-assignment on failure

## Data & Evidence
- [ ] Assessment evidence record (transcript, ticket note, action timeline, rubric version, score)
- [ ] Manager override with comment
- [ ] Compliance evidence output per assessment (audit-ready)
- [ ] Candidate profile with assessment history (future Skills Passport)
- [ ] Shareable assessment evidence (candidate controls what companies can see)

---

# Product 2: Manager Dashboard

Managers create assessments, manage MSP orgs, set standards, review Callum usage, approve proposals.

## Callum Cockpit (/mvp/assist)
- [ ] Usage cards (total actions, active users, flags, proposals, low confidence) — done
- [ ] Top topics, recent flags, recent proposals — done
- [ ] Competency-linked training recommendations — done
- [ ] Flags review: mark resolved/valid/not-issue, add manager note, convert to proposal
- [ ] Low-confidence answer review
- [ ] Weekly/daily summary reports
- [ ] Weekly email roundup

## Standards (/mvp/standards)
- [ ] Connexion SLA matrix display and editing — done
- [ ] Escalation rules editor — done
- [ ] T1/T2 ownership rules — done
- [ ] Call handling requirements — done
- [ ] Ticket field requirements — done
- [ ] SLA/escalation/procedure proposals from GPT Actions — done
- [ ] Slider-based scoring criteria configuration
- [ ] Framework selection per manager
- [ ] Custom framework builder
- [ ] Full SLA priority matrix editing
- [ ] Manager standards snapshot at assessment creation

## Clients (/mvp/clients)
- [ ] Client list with profiles — done
- [ ] Client protocol proposals from GPT Actions — done
- [ ] Client profile gaps display — done
- [ ] Client protocol type reference — done
- [ ] Apply client protocol proposals (approve → create client + protocol row)
- [ ] Client-specific escalation exceptions
- [ ] Client-specific new starter/leaver rules
- [ ] Client-specific approval contacts
- [ ] Callum usage by client
- [ ] Contact management (POCs, escalation contacts, approvers)

## Taxonomy (/mvp/taxonomy)
- [ ] Taxonomy browser with search and detail panel — done
- [ ] Type filter buttons — done
- [ ] XLSX upload/import — done
- [ ] Taxonomy gaps display (no-match queries from Callum) — done
- [ ] Taxonomy proposals from GPT Actions — done
- [ ] Approve/apply taxonomy proposals
- [ ] Bulk import/export (CSV)
- [ ] Playbook question extraction during analysis
- [ ] Taxonomy change audit (versioning and change tracking)

## Technician Management (/msp/admin)
- [ ] Create MSP org — done
- [ ] Generate invite links — done
- [ ] Manage technicians (list, change role) — done
- [ ] Per-MSP SLA overrides — done
- [ ] Taxonomy visibility by role (which subTypes T1/T2 can see)
- [ ] Technician progress tracking (calls, scores, level, weak areas)
- [ ] Team-level insights ("5/8 trainees missed identity verification")
- [ ] Weakness heatmap by category and checkpoint
- [ ] Session history trend lines
- [ ] Level progression over time

## Proposals & Approvals
- [ ] Taxonomy proposals → approve/reject/apply in /mvp/taxonomy
- [ ] Client protocol proposals → approve/reject/apply in /mvp/clients
- [ ] SLA/escalation proposals → approve/reject/apply in /mvp/standards
- [ ] Combined recent proposals widget in /mvp/assist
- [ ] Change audit log (who requested, who approved, before/after, timestamp)

## Reporting & Analytics
- [ ] Per-technician report: calls completed, avg score, level, weakest area, recent calls
- [ ] Team report: aggregate stats, common weaknesses, training recommendations
- [ ] Manager report generation (individual certificate, team report, evidence pack, client-facing)
- [ ] Dashboard polish (sorting, filtering, export)
- [ ] Peer benchmarking (percentile ranking against peer MSPs)
- [ ] Scoring scope transparency (show mode, active elements, scored criteria)
- [ ] Route/tool usage dashboard

## System (/mvp/system)
- [ ] Backend health status — done
- [ ] Callum action routes table — done
- [ ] Auth configured yes/no (no secret exposed) — done
- [ ] Last action timestamp — done
- [ ] Database table status
- [ ] Debug logs summary
- [ ] OpenAPI schema link
- [ ] Recent action errors

## Manager AI Assistant
- [ ] Chat interface on assessment detail page
- [ ] Chat API endpoint (POST /api/mvp/assessments/[id]/chat)
- [ ] Standards editing from chat (AI suggests, manager applies)
- [ ] Callum as proactive agent (on page load greet, on completion notify, on failures suggest)
- [ ] Chat-native content (rich cards inside chat: score cards, assessment cards, action buttons)
- [ ] Multi-model routing (navigation = no AI, assessment explanation = deepseek, general = cheaper)
- [ ] Page-aware Callum (persistent dock receiving page context)
- [ ] Memory classification: thread memory, manager profile, preferences, operational facts
- [ ] Callum personality settings (assistant_name, tone, humour_level, detail_level)

## Manager Calibration
- [ ] Blind calibration flow: manager reads transcript → rates 1-10 → reveals AI score → sees delta
- [ ] Per-criterion slider adjustments stored as training data
- [ ] Calibration dashboard: avg delta, high-variance criteria, consistency score
- [ ] Progressive calibration: random → high-variance → edge case → profile completion
- [ ] Calibration profile export (LoRA adapter + statistics)
- [ ] LoRA fine-tune small model to match manager preferences
- [ ] Manager profile shows own biases and blind spots
- [ ] Agreement tracking, score error, repeated false positives/negatives

## Gamification (Manager-controlled)
- [ ] Points, streaks, multipliers, monthly reset
- [ ] Global leaderboards (training hours, tickets closed, drill completion, avg score, points)
- [ ] Documentation incentives (daily doc prompt, created-by tracking, badges)
- [ ] Classroom/cohort management

---

# Product 3: Technician Dashboard

Internal MSP technician tools. Primary interface: ChatGPT Enterprise Custom GPT. Secondary: /msp/* web pages.

## Callum GPT Actions (Primary Interface)
- [ ] POST /api/actions/ticket-assist/analyse — done
- [ ] GET /api/actions/taxonomy/search — done
- [ ] POST /api/actions/answers/{id}/flag — done
- [ ] POST /api/actions/proposals — done
- [ ] GET/POST /api/actions/client-profiles — done
- [ ] GET/POST /api/actions/client-protocols — done
- [ ] GET /api/actions/health — done
- [ ] Sensitivity/redaction scan — done
- [ ] Strict source-of-truth answers — done
- [ ] Custom GPT instructions — done
- [ ] OpenAPI schema for GPT Actions — done
- [ ] Multiple Custom GPTs (call simulator, triage trainer) posting results to central backend
- [ ] GPT Actions for: validate assessment code, start scenario, submit transcript/ticket/evidence

## Web UI (/msp/*)
- [ ] /msp/triage — classify tickets against taxonomy — done
- [ ] /msp/taxonomy — browse 162 items (role-filtered) — done
- [ ] /msp/training — role-specific scenarios from taxonomy — done
- [ ] /msp/docs — T2+ operational documentation — done
- [ ] /msp/admin — org/settings for managers — done
- [ ] Role-based access (T1 sees T1 items, T2 sees T1+T2, manager sees all) — done

## Training Drills
- [ ] Level 1: call handling scenarios (Outlook, VPN, Printer, Phishing)
- [ ] Level 2: first-call resolution (password reset, account lockout, MFA issue, Outlook workaround, printer default)
- [ ] Role-specific scenario filtering — done
- [ ] Scenario scoring against playbook + SLA matrix
- [ ] Level-based progression with point thresholds
- [ ] Post-call feedback: what was done well, what was missed, escalation correctness
- [ ] Focus drills: adaptive remediation from weak spots
- [ ] Teacher mode (coach observes and intervenes)

## Compliance Training
- [ ] Compliance-as-a-Service for MSPs
- [ ] Compliance Training Profiles (assign packs with due dates)
- [ ] Remedial training auto-assignment on compliance failure
- [ ] Compliance Certification Report per technician
- [ ] Live regulatory intelligence feed (weekly cron for NCSC, ICO, ISO, ENISA updates)
- [ ] Compliance chatbot (Callum Compliance Assistant)
- [ ] Compliance credentials for marketing (shareable badges/URLs)
- [ ] Certification verification URL (/certification/{orgId}/verify)
- [ ] Supported frameworks: Cyber Essentials, ISO 27001, GDPR, SOC 2, NIS2, PCI DSS, HIPAA
- [ ] Compliance training as realistic call simulations (not multiple-choice or videos)
- [ ] Phishing report pack (gather evidence, avoid clicking, classify, escalate)
- [ ] Password reset / identity verification pack
- [ ] Suspicious login / account compromise pack
- [ ] Permissions change pack (authorisation requirements before making changes)
- [ ] Data loss / deletion pack (preserve evidence, escalate appropriately)
- [ ] VIP / high-impact escalation pack
- [ ] AI-assisted triage pack (scored on AI-use judgment)

## Technician Progress
- [ ] Personal progress page: calls completed, scores, current level, weak areas
- [ ] Weakness spotlight with suggested practice
- [ ] Session history with trend lines
- [ ] Cleared-for-live status
- [ ] Boss battle progress
- [ ] Improvement after feedback tracking
- [ ] Most missed taxonomy areas

## Knowledge & Docs
- [ ] Taxonomy browser (role-filtered) — done
- [ ] Operational documentation linked to taxonomy items (T2+ write) — done
- [ ] Ticket classification assistant (what subtype, what questions, what playbook)
- [ ] Escalation decision support
- [ ] How-to guidance for common issues

## Future Technician Features
- [ ] Personal Ticket Hub (consolidated stats from ConnectWise)
- [ ] Queue mode — multiple calls per assessment
- [ ] Real-time WebRTC phone call mode
- [ ] Voice interruption/barge-in
- [ ] Scoring tone of voice (post-MVP)
- [ ] Store audio clips for manager review (with consent)
- [ ] Call history / transcript view

---

# Product 4: CallCallum

Sales enablement and front-desk call auditing for MSPs. A two-landing-page test of the market, sharing the same evaluation engine.

## Prospect Call Prep
- [ ] Input: company name/domain, target vertical, MSP/service offer, optional notes
- [ ] Output: prospect summary, "why they might care", opening line, discovery questions, objections, voicemail, follow-up email
- [ ] Practice call button (simulated prospect conversation)

## Front Desk Call Audit
- [ ] Input: call transcript/audio, business type, desired outcome (booking/quote/appointment/complaint resolution)
- [ ] Output: missed revenue moments, booking/conversion score, better script, coaching drills

---

# Other

Things that don't fit neatly under one product, or are cross-cutting infrastructure.

## Voice Pipeline (built, deprioritised)
- [ ] STT (Whisper via OpenRouter)
- [ ] TTS (Kokoro-82m)
- [ ] Azure TTS with mood (SSML express-as + prosody)
- [ ] Speaker diarization (sherpa-onnx)
- [ ] VAD + silence analysis
- [ ] Full recording upload
- [ ] Auto-recording on TTS end
- [ ] Emotional trajectory data from session_events
- [ ] CosyVoice 2 for natural-sounding AI customer
- [ ] Voice recording → voice model (tone analysis via HuBERT/Wav2Vec2)

## Compliance Frameworks (built, deprioritised)
- [ ] 11 frameworks: Kepner-Tregoe, CompTIA, Callum Baseline, SERVQUAL, SBAR, LEAP/HEAT, ITIL Incident Mgmt, ITIL Service Desk, Cyber Essentials 2025, GDPR 2018, ISO 27001:2022
- [ ] Pack-relevance filtering per framework
- [ ] Evidence grounding validator
- [ ] Multi-framework scoring architecture
- [ ] Standards Coverage Report per assessment

## LangGraph / Callum Agent (built, deprioritised)
- [ ] Zero-dependency StateGraph abstraction
- [ ] 8 graph nodes: validate → load → classify → assess → invoke → produce → persist
- [ ] Heuristic intent classification
- [ ] Premium floating chat panel
- [ ] Page-aware context prompts
- [ ] Callum proposals (create_training_assignment, etc.)
- [ ] Tool-Calling LLM inside LangGraph architecture
- [ ] Tool definition contract with validation schemas

## Sim Packs (built)
- [ ] Outlook Work Offline (call_plus_remote mode)
- [ ] Password Reset / Account Lockout (call_only)
- [ ] New Starter Triage (call_only)
- [ ] Shared Mailbox Access (call_only)
- [ ] 4 hiring packs: outlook-basic, vpn-triage, printer-down, email-phishing
- [ ] Proposed: Printer Spooler pack, VPN DNS pack
- [ ] Future: MFA issue, Wi-Fi scope, slow computer, phishing, malware, data breach, social engineering
- [ ] Pack factory with 10 packs across 3 levels
- [ ] DifficultyProfile system (hiring exam / training drill / training shift variants)
- [ ] Pack-driven scoring (SimPack owns scoringCriteria, diagnosticChecklist)
- [ ] mergeAssessmentConfig() — manager overrides pack defaults

## Taxonomy Foundation (done)
- [ ] 162 items from Master Triage Classification list.xlsx — done
- [ ] JSON source of truth — done
- [ ] Synonyms + redirects in search — done
- [ ] Taxonomy browser — done
- [ ] Taxonomy copilot chat — done
- [ ] Proposal/approve/apply change workflow — done
- [ ] Scenario generator from taxonomy items — done
- [ ] Role-filtered taxonomy visibility

## Simulator Infrastructure (built)
- [ ] 60 regression tests
- [ ] Safe projection with phase-based visibility
- [ ] State machine with phase validation
- [ ] 4 sim packs with 23 actions with taxonomyTags
- [ ] CmdApp with configurable commands from pack config
- [ ] Tab-based remote sandbox (Desktop, Outlook, Edge, Command, Control Panel)
- [ ] Red flag handling (visible to candidate, metadata hidden)
- [ ] Session event logging for all triage actions
- [ ] Triage workflow (claim → set status → select type/category/subcategory → impact/urgency/priority)

## Data Model & Schema
- [ ] Schema consolidation: one CRITERION_DEFINITIONS file replacing 7+ duplicate locations
- [ ] Store layer: one file per domain concept
- [ ] Domain folders: assessment, training, framework, sim-pack, assignments
- [ ] Versioned contracts with runtime validation
- [ ] Capability Registry: read/propose/execute access levels
- [ ] Full schema-backed versioning for everything
- [ ] Multi-tenant auth (org_id/manager_id migration)
- [ ] Unified evidence timeline (voice, chat, tool actions, ticket notes → session_events)
- [ ] CriterionDefinition consolidation (remove 7+ duplicate locations)

## Integrations (Future)
- [ ] ConnectWise integration: ticket counts/categories (aggregate only, no PII)
- [ ] IT Glue integration: documentation tracking (author_id, doc_id, action)
- [ ] PSA integration: read tickets, review notes, suggest improvements
- [ ] PSA pre-filled field awareness (auto-pass fields filled by PSA)
- [ ] Train on live tickets (extract patterns from real ConnectWise data)
- [ ] Read-only integration: pull tickets, review notes → write: auto-populate notes, suggest next steps, flag violations
- [ ] ConnectWise-style ticket management in sidebar
- [ ] White-label for other MSPs (packs, difficulty profiles, manager standards as data)
- [ ] Real call extraction (take real MSP transcript → extractPack)

## Skills Passport / Marketplace (Future)
- [ ] Candidate profile with assessment history
- [ ] Shareable evidence (transcripts, audio, ticket notes — candidate-controlled)
- [ ] Company hiring portal (applicants, assessment status, interviews, notes)
- [ ] Public/opt-in talent pool (candidates mark as looking for work)
- [ ] CallCallum hiring network (companies search opted-in profiles)
- [ ] Hiring pipeline management
- [ ] AI review of calls (summary, risk flags, strengths, evidence quotes)
- [ ] No recruiter fee model (candidates free, MSPs subscribe)

## Local AI / Model Distillation (Future)
- [ ] Fine-tune Qwen 0.5B/1.5B to replace prompt-based AI extraction
- [ ] On-device processing (data never leaves customer system)
- [ ] Edge deployment (Raspberry Pi, browser via WebLLM, hybrid)
- [ ] Action sequence classifier (lightweight, not full LLM)
- [ ] Screen recording analysis via Qwen Vision-Language model
- [ ] Multi-modal fusion (text + action + vision scores combined)
- [ ] Customer simulator (fine-tuned Qwen to play customer role)
- [ ] Self-improving loop: manager feedback triggers automated retraining
- [ ] Data network effect as moat

## Security & Compliance
- [ ] API auth middleware (Clerk session tokens or API keys)
- [ ] Cryptographic invite tokens (replace Math.random)
- [ ] Rate limiting on AI analysis endpoints and assessment creation
- [ ] Token expiry and revocation checks
- [ ] No PII exposed in assessment listings
- [ ] Error messages don't expose internal state
- [ ] Analysis cache invalidation (avoid stale results)
- [ ] Prompt injection defense (treat transcript/ticket as untrusted)
- [ ] CORS and rate limiting for public GPT Action endpoints
- [ ] Data residency (UK hosting, DPA, encryption, data retention)
- [ ] Multi-factor authentication mandatory checks
- [ ] Password policy compliance (12 chars minimum)

## Infrastructure
- [ ] Permanent Coolify/Vercel deployment (replace cloudflared tunnel)
- [ ] HTTPS proxy for Firefox microphone support
- [ ] Cloudflare tunnel for external access (temp)
- [ ] CI pipeline: npm install && build && test
- [ ] Row-level security for trainees vs admins
- [ ] Headless test scripts (test-mvp-flow, test-dashboard-sim, test-sim-hardening)
- [ ] Quick-win fixes: framework pack-relevance, abort timeouts, remove dead code, SQLite transactions, empty catch logging
