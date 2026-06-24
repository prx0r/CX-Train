# CallCallum MSP owner demo script

Target length: 8–10 minutes. Use a staging environment with the assessment migration applied and Chutes configured.

## Before the meeting

1. Complete every pre-demo item in `LAUNCH_CHECKLIST.md`.
2. Sign in as a manager and open `/dashboard/admin/assessments`.
3. Keep a second incognito window ready for the candidate link.
4. Use fictional candidate and client data only. Never enter real credentials or confidential client information.
5. Confirm one short candidate assessment can reach the Chutes caller before the meeting.

## Demo narrative

Open with the decision being solved:

> “CallCallum helps an MSP decide whether a candidate or junior technician is ready to take real client calls.”

### 1. Create the assessment

1. Click **New assessment**.
2. Enter `Alex Morgan` and a fictional email.
3. Choose **Hiring**, **Non-technical candidate**, and **3 calls**.
4. Click **Create assessment link**.

Explain that candidates do not need accounts and are identified by a candidate record plus a private, expiring invite token—not by name alone.

### 2. Open the candidate link

1. Copy the generated link.
2. Open it in the incognito window.
3. Point out the instructions: technical perfection is not expected; useful questioning, impact discovery, calm communication, honesty, and safe escalation are assessed.
4. Point out the warning against entering passwords, secrets, or real client-confidential information.

### 3. Demonstrate a simulated call

1. Start the first call.
2. Ask a weak opening question so the caller remains vague.
3. Then ask for the user/company, device or hostname, when the issue began, whether others are affected, business impact, deadline, error message, workaround, and recent changes.
4. Set a clear next step without guaranteeing a fix.
5. End the call.

Explain that hidden scenario facts stay on the server and are only revealed when the candidate asks an appropriate question. The transcript becomes the evidence record.

### 4. Write the ticket

Write a concise MSP ticket containing:

- issue summary;
- affected user/client;
- device or hostname;
- impact and scope;
- checks already completed;
- reasonable priority;
- next action or escalation.

Submit it. Explain that call quality and ticket quality are scored separately, then combined deterministically.

For a short meeting, switch back to a prepared completed assessment after demonstrating one live call. For a full acceptance demo, complete all three calls.

### 5. Show the manager report

1. Open the assessment detail and then **Open report**.
2. Show overall readiness and the recommendation.
3. Open checkpoint evidence and point to exact transcript excerpts.
4. Show the ticket score and candidate ticket.
5. Expand the full transcript.

Use this line:

> “This report is an AI-assisted first pass. It supports manager judgement; it does not decide who to hire.”

### 6. Make the manager decision

1. Enter a manager score.
2. Choose whether the AI assessment is correct.
3. If overriding it, enter a concrete reason.
4. Add manager notes and save the final readiness decision.

Close on the complete workflow: assessment pack, private invite, realistic calls, ticket writing, evidence report, manager decision.

## Do not demo

- Legacy training pathways, levels, boss battles, taxonomy tooling, or future ideas.
- Production demo-cookie access; it is intentionally disabled.
- Real client incidents, passwords, personal data, or confidential MSP records.
- AI scores as automatic hiring decisions or industry benchmarks.

## Known limitations to state plainly

- v1 uses typed simulated calls, not telephony or live voice.
- Candidate links are bearer tokens; share them only with the intended candidate.
- Chutes availability is required for caller responses and transcript evidence extraction.
- There are no PSA integrations, benchmarks, or automated hiring decisions in v1.
