# External Datasets — Import Boundary

This directory is reserved for downloaded external dataset files.

## Rules

- Do not commit large raw dataset files to this repository.
- Only small, licence-safe files may be stored here.
- All datasets must have documented, permissive licences (see `../../docs/DATASET_EVALUATION.md`).
- Import scripts live in `../../scripts/datasets/`.
- Derived lightweight data lives in `../derived/`.

## Current Datasets

| Dataset | Licence | Status | Location |
|---|---|---|---|
| Help Desk Tickets (Mendeley v2) | CC BY 4.0 | Documented, not downloaded | N/A |
| IT Helpdesk Chatbot (Kaggle) | Unknown | Licence check required | N/A |

## How to Import

To download and profile a dataset:

1. Verify licence (docs/DATASET_EVALUATION.md)
2. Download using the script in scripts/datasets/
3. Run the profiler to generate derived data
4. Never commit raw downloads
