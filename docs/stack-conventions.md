---
name: Stack conventions template
---

<!--
This file is AgentFlow SDLC's per-project domain-checklist template (see AGENTS.md/agent-workflow.md),
filled in for Nextstep itself.
-->

# Stack Conventions

## Tech stack (locked)

Node.js >=20, ES modules (`"type": "module"`), no runtime dependencies. `npm` with the committed
`package-lock.json`. `node:test` (built-in) as the test runner — `npm test` runs
`test/*.test.mjs`, no separate framework. No database, no auth layer, no styling: Nextstep is a
local CLI and domain engine (`bin/nextstep.mjs`), not a web application. CI runs `npm test` on Linux, Windows, and macOS, as
configured in `.github/workflows/ci.yml`.

## Sensitive surfaces (for bounded-work classification)

Path containment and symlink/junction-escape checks (`src/config.mjs` `assertContained`,
`src/integration.mjs`), the commit lock/transaction/recovery journal (`src/storage.mjs`), model
validation and referential integrity (`src/model.mjs`), artifact snapshot/versioning
(`src/commands.mjs` artifact functions), and the Windows PATH/registry integration
(`src/integration.mjs`). Changes to any of these require focused review, per `CONTRIBUTING.md`.

## Domain checklist — Analyst

Acceptance criteria name the exact CLI command, its JSON output shape, and its exit code — not a
vague behavioral description. A new command's read/mutation boundary and its advisory-vs-blocking
nature must be stated explicitly (see `AGENTS.md`: "Analysis and drafting are read-only until an
explicit mutation command").

## Domain checklist — Architect

New commands follow the existing three-file wiring pattern: a function in `src/commands.mjs`, a
route/dispatch/help entry in `src/cli.mjs`, and a contract in `src/command-catalog.mjs`. Workflow
profile (bounded/standard/high-assurance) should match blast radius: additive read-only commands
are `bounded`; anything touching `RECORD_TYPES`, the commit lock, or containment logic is at least
`standard`. A new required record collection is a high-cost decision — see `src/model.mjs`'s
`RECORD_TYPES` and the "fails closed without compatibility initialization" test before proposing
one; prefer an optional file outside `RECORD_TYPES` when the data is genuinely optional.

## Domain checklist — Developer

No absolute personal paths, private career data, or non-synthetic fixtures in tracked files (see
`SECURITY.md`, `AGENTS.md`). All durable mutations go through the CLI/domain engine's envelope
(`schemaVersion`, `requestId`, `idempotencyKey`, `payload`) and the `mutate()` helper in
`src/storage.mjs` — never hand-write a record file. Reuse existing helpers (`fail`, `envelope`,
`extraOutputs`) instead of inventing a parallel mechanism.

## Domain checklist — Tester

Tests build synthetic fixtures in a temp directory (see the `fixture()`/`pipelineFixture()`
helpers in `test/cli.test.mjs`) — never point a test at a real vault. Every mutation needs a
dry-run test (`--dry-run` writes nothing) and, where relevant, an idempotency-replay test. No
personal paths, real company names, or real candidate data in test fixtures.

## Domain checklist - Technical writer

`docs/cli.md` is the authoritative human/agent CLI reference; keep its command table and prose in
sync with `src/command-catalog.mjs`. `skills/references/` is the agent-facing equivalent, read by
the `skills/nxt-*` packages. `README.md` is the project's human entry point and should stay
runnable by a stranger on a fresh clone.

## Domain checklist — DevOps

No deployment target — Nextstep runs locally as a CLI. No secrets management surface (no network
interface, no listening service — see `SECURITY.md`). No CI/CD is configured yet; adding a GitHub
Actions workflow (`npm test` on Windows, since the Windows-linker integration tests require it) is
a known follow-up before an Actions status badge would be honest.
