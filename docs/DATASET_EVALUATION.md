# Dataset Evaluation — CallCallum Support-Quality Databank

## Dataset 1: Help Desk Tickets (Mendeley)

| Field | Value |
|---|---|
| **Source URL** | https://data.mendeley.com/datasets/btm76zndnt/2 |
| **DOI** | 10.17632/btm76zndnt.2 |
| **Contributor** | Mohammad Abdellatif (Princess Sumaya University for Technology) |
| **Version** | 2 |
| **Published** | 30 May 2025 |

### Files Available

| File | Expected Type | Expected Content |
|---|---|---|
| `issues.csv` | CSV | All reported tickets: category, priority, reporter, project, assignee, timestamps, resolution duration per step |
| `issues_change_history.csv` | CSV | Assignee and status change timestamps |
| `issues_snapshots.csv` | CSV | Same as issues.csv but duplicated per assignee cycle |
| `scored_issues_snapshot_sample.xlsx` | XLSX | Stratified representative sample scored by help-desk manager (3 targets, 1–5 scale) |
| `sample_utterances.csv` | CSV | Messages exchanged between reporters and helpdesk for the scored sample |
| `FEATURES.md` | MD | Column descriptions |
| `EXAMPLE.md` | MD | Cross-dataset example walkthrough |
| `process-flow.png` | PNG | Helpdesk resolution step diagram |

### Schema (Expected from FEATURES.md description)

**issues.csv:**
- `issue_id`, `category`, `priority`, `reported_by` (masked), `project`, `assigned_to` (masked), `start_time`, `resolution_time`, per-step durations

**issues_change_history.csv:**
- `issue_id`, `changed_field`, `old_value`, `new_value`, `changed_at`

**issues_snapshots.csv:**
- Same as issues.csv but one row per assignee per ticket

**scored_issues_snapshot_sample.xlsx:**
- Ticket fields plus manager scores (target_1, target_2, target_3, each 1–5)

**sample_utterances.csv:**
- `issue_id`, `message_id`, `sender_role`, `message_text` (anonymised), `timestamp`, `dialog_act_label`

### Licence

| Attribute | Value |
|---|---|
| **Licence** | CC BY 4.0 (Creative Commons Attribution 4.0 International) |
| **Commercial use** | Permitted |
| **Attribution required** | Yes |
| **Derivative works** | Permitted with attribution |
| **Sublicensing** | Permitted with same terms |

### Privacy / Anonymisation

- Certain fields have been anonymised/masked (reported_by, assigned_to) to protect privacy
- sample_utterances.csv contains only curated messages for scored sample
- No raw personal data should be present in original DB
- Provided as curated CSV from PostgreSQL — pre-anonymised

### Risks

- Dataset published for a different research purpose (automated performance appraisal via Dialog Acts)
- Manager scores target unknown constructs — not CallCallum readiness
- Resolution time model differs from MSP first-call context
- Anonymisation may obscure patterns useful for CallCallum
- May contain domain-specific ITIL categories not applicable to MSP environment
- Data from 2016–2023 — language patterns may be dated
- No guarantee of completeness or accuracy for CallCallum's purposes

### Recommended Use

- **Support utterance examples**: Realistic customer-agent message patterns
- **Failure-mode taxonomy**: Common ticket quality weaknesses
- **Manager-scored calibration reference**: Inspiration for calibration structures
- **Fixture inspiration**: Realistic ticket language for synthetic fixtures
- **Benchmark distributions**: Category/priority distributions for derived statistics

### Forbidden Use

- Using manager scores as automatic CallCallum readiness scoring
- Exposing raw ticket content or anonymised identifiers in app
- Claiming external score equals candidate readiness
- Training ML models to replace deterministic scoring
- Using as authoritative assessment truth

---

## Dataset 2: IT Helpdesk Chatbot Dataset (Kaggle)

| Field | Value |
|---|---|
| **Source URL** | https://www.kaggle.com/datasets/bitsofishan/it-helpdesk-chatbot-dataset |
| **Author** | fishan (Kaggle user bitsofishan) |
| **Access Method** | Kaggle download (requires Kaggle account) |

### Status: LICENCE UNVERIFIED

This dataset could not be fully evaluated via public web scrape. The Kaggle page requires authentication or JavaScript rendering to display full metadata, including licence information.

**Action Required Before Use:**
1. Download dataset manually via Kaggle UI or `kagglehub` Python library
2. Inspect `dataset-metadata.json` or licence field on Kaggle page
3. Verify licence permits commercial use (if intended)
4. Document findings here before importing any data

### Available Information (from dataset description snippet)

- Likely contains IT helpdesk conversation data for chatbot training
- Format expected to be CSV or JSON with question-answer pairs
- Size and exact schema unknown

### Tentative Schema (Unconfirmed)

Likely fields based on description:
- `query` / `question` — user request
- `response` / `answer` — helpdesk response
- `intent` / `category` — classification label
- `timestamp` — optional

### Risks

- **Licence unknown** — cannot use until verified
- May contain synthetic or scraped data with unclear provenance
- Quality for CallCallum's structured assessment context is unverified
- Format may be chatbot-specific (single-turn Q&A) rather than multi-turn ticket context

### Recommended Use (Conditional on Licence Verification)

- Additional support utterance examples
- Alternative language patterns for fixture generation
- Cross-reference failure-mode patterns

### Forbidden Use (Until Licence Verified)

- Any use without confirmed licence
- Including in build pipeline
- Committing raw data to repository
- Using as assessment truth

---

## Summary

| Dataset | Licence | Commercial Use | Accessible | Ready for Use |
|---|---|---|---|---|
| Mendeley Help Desk Tickets v2 | CC BY 4.0 | Yes | Via Mendeley download | Yes |
| Kaggle IT Helpdesk Chatbot | Unknown | Unknown | Via Kaggle account | No — licence check required first |
