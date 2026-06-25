# Taxonomy Ground Truth v0 — CallCallum

## Purpose

The taxonomy ground truth is the authoritative classification reference for all CallCallum scenarios. Every assessment pack and scenario links to a taxonomy item that defines the expected classification, triage questions, playbook steps, and escalation guidance.

## Source

- **Master file**: `taxonomy/Master Triage classification list.xlsx` (163 items)
- **Backup seed**: `taxonomy/taxonomy.json` (2 items — template only)
- **Database table**: `taxonomy_items` (auto-seeded on first init)

## Schema

```sql
CREATE TABLE taxonomy_items (
  id            TEXT PRIMARY KEY,    -- hash-derived stable ID
  source_id     INTEGER,            -- row number from XLSX
  board_name    TEXT,               -- 'Tier 1 Service Board'
  type          TEXT,               -- Incident | Request
  sub_type      TEXT,               -- Desktop/Laptop, Network, Security, ...
  item          TEXT,               -- WiFi, Login Problem, Password Reset, ...
  definition_scope TEXT,            -- what's included/excluded
  playbook      TEXT,               -- triage steps and checks
  keywords      TEXT,               -- search keywords
  helpdesk_tier TEXT,               -- T1/T2 guidance
  escalation_guidance TEXT          -- when and how to escalate
);
```

## How It Works

1. Each assessment pack/scenario can reference a `taxonomy_item_id`
2. During analysis, the candidate's ticket classification is compared against the expected taxonomy item
3. Analysis reports:
   - **predicted classification** — what the candidate classified the issue as
   - **expected classification** — the taxonomy ground truth
   - **classification correct** — yes / no / partial
   - **missed playbook questions** — triage questions from the taxonomy not asked
   - **escalation guidance followed** — yes / no / partial

## Taxonomy Types

| Type | Count |
|------|-------|
| Incident | ~120 |
| Request | ~43 |

## Subtypes (Examples)

Desktop/Laptop, Email Issue, Network, Security, Printer Scanner, Mobile, Server, Remote Desktop, SharePoint, Access Control, User Management, Computer App, Hardware, ...

## Usage Rules

1. Classification ground truth is authored in the taxonomy XLSX, not in code
2. Import via `npm run taxonomy:import` or auto-seeded on app init
3. Analysis compares candidate classification against taxonomy, but does NOT score based on taxonomy alone
4. Taxonomy items are reference — candidate scoring still uses controlled scenario hidden truth + deterministic rubric

## Adding a New Taxonomy Item

1. Add a row to the XLSX
2. Run `npm run taxonomy:import -- --force`
3. Link the new `taxonomy_item_id` to the relevant assessment pack

## Testing

```bash
npm run test:taxonomy     # verify import + search work
npm run test:analysis:gold  # verify taxonomy-linked gold fixtures
```
