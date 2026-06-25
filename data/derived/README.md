# Derived Data — CallCallum Support-Quality Bank

This directory contains lightweight, derived data files generated from external datasets.

## Contents

| File | Source | Purpose |
|---|---|---|
| `dataset-profile.json` | Profiler script | Row counts, columns, missingness, distributions |
| `failure-mode-bank.seed.json` | Mendeley + authored | Failure-mode taxonomy |
| `ticket-quality-examples.seed.json` | Mendeley + authored | Realistic ticket examples |
| `support-utterance-examples.seed.json` | Mendeley + authored | Support message patterns |
| `manager-scored-ticket-examples.seed.json` | Mendeley | Calibration example structures |

## Principles

- No raw personal data / anonymised fields carried through.
- All examples are either synthetic or heavily transformed.
- Manager scores from external datasets are not CallCallum readiness scores.
