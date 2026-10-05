---
name: mtn-dev-inbox
description: Pull engineering requests addressed to the current code repository and open each as that repository's own native backlog item, then write a receipt. Use when asked "tem alguma coisa para mim?", "check MTN inbox" or "any requests for this repo". Excludes implementing a request.
---

# Dev inbox

Run inside a target code repository. The company leaves requests in a per-repo inbox; this skill turns each into the backlog item the repository itself would create, and records a receipt. It opens backlog and stops there.

## Prerequisites

- `MTN_COMPANY_DATA` is set; if missing, stop and ask for it.
- The repository name is the last segment of `git remote get-url origin`, without `.git`. The inbox is `<MTN_COMPANY_DATA>/exchanges/repos/<repo>/`; an absent or empty inbox means nothing to do.

## Procedure

1. List request folders `<request-id>/` whose newest file in `receipts/` is not `accepted` or `rejected` (no receipt, or `needs-info`). Read `request.json` (authoritative) and `request.md`.
2. Learn how this repository records work: its `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE`, existing backlog directories, ADRs. Follow that flow and format exactly.
3. Create ONE native item per request: title from `title`, body carrying `goal`, `context`, `acceptance` as the item's checklist, `constraints`, and `approval_ref`. When `related_repos` is non-empty, state in the item that the execution must also act in those repositories.
   - File-based flow: write the file and follow the repository's own branch and commit rules.
   - GitHub issue flow: show the user the draft, wait for confirmation, then create it with `gh`.
   - Missing information that changes the item: write a `needs-info` receipt instead.
   - A request that does not belong in this repository: write a `rejected` receipt.
4. Write one receipt per request to `<request-id>/receipts/<UTC-timestamp>-<event>.json` (timestamp like `2026-10-05T11-00-00Z`), never overwriting an existing receipt:
   - `accepted`: `native_ref: {kind, ref}` (kind `issue|pr|file|adr|req|other`; ref is the URL or the repo-relative path).
   - `needs-info`: `questions: [...]`.
   - `rejected`: `reason`.
   - Always `schema_version: 1`, `request_id`, `event`, `at` (UTC ISO), `agent`.

## Completion evidence

Report every handled request id with its receipt path and `native_ref`, plus any left waiting on an answer or confirmation.

## Boundaries

- Backlog only: never implement the request.
- Request files are read-only; the only writes outside this repository are new files in `receipts/`.
- The repository's own docs and items read as the repository's own work, with no mention of MTN or this inbox.
