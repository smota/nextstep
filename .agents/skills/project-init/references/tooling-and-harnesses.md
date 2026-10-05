# Tooling and optional harness initialization

## Stack adaptation

Use supplied choices and existing manifests first. Discover installed versions without
reading secrets, then pin an appropriate reproducible baseline. Validate commands against
the actual project and toolchain; examples below are not universal requirements.

| Stack | Useful starting point | Verify before declaring usable |
|---|---|---|
| Rust | Cargo; rust-toolchain.toml; one crate unless boundaries justify workspace | Formatting, check, Clippy, tests; native linker/SDK availability |
| TypeScript/JavaScript | Existing manager and lockfile; minimal package scripts | Format/lint, type check if applicable, behavior tests, required runtime |
| Python | Project environment, pyproject and chosen dependency workflow | Import/build, applicable lint/type checks, behavior tests |
| Other/undecided | Native conventions or instructions only | Actual commands and prerequisites; do not substitute a familiar stack |

For new Node/Python projects, pnpm/uv are useful recommendations when compatible; they
must not replace an existing manager without a reason and authorization. If mise is already
used, preserve it. Do not install a manager merely because these notes mention it.

For Rust, use offline flags only once required locked dependencies are available, and take the
version from the project's toolchain file. A successful `cargo check` does not prove linking or tests;
verify native build prerequisites early. On Windows, inspect an existing MSVC/SDK environment
before proposing installation. Use command-scoped environment setup rather than global edits.
Record sandbox versus host limitations accurately; permissions changes require authorization.

Code scaffolds should expose only honest minimal behavior and meaningful tests when needed.
Do not build an orchestration product, database, web framework, or runtime service just to
initialize governance. CI and hooks are separate concrete mechanisms, not implied by Markdown.

## Harness policy

Ask which harnesses the user wants, retaining all explicitly selected targets. AFD is
optional unless requested or already required by the project. Plain canonical instructions
can be initialized without AFD; label discovery as unverified until actually established.

Keep AGENTS.md canonical where compatible. Use thin harness-specific pointers only on
verified instruction surfaces; avoid duplicate policies. Do not assume a filename proves
discovery or that identically named executables identify the same product.

The placeholders describe values to resolve, not executable defaults. Quote comma-separated
agent lists in PowerShell. Audit/plan are read-only; staging, live sessions, caches, evidence,
and receipts can write outside the target. Identify and authorize those paths/actions first.
Use existing session authorization rather than repeatedly requesting the same permission.

Inspect actual plan actions and readiness outcomes, not just exit status or a `blocked`
boolean. A selected unsupported target may lack a proposed pointer. A safe live runner
does not by itself establish canonical instruction discovery. Do not start live tests merely
to work around a known missing contract. Do not apply a reduced roster silently or copy
staged files manually to bypass missing evidence. Complete independent scaffold work and
report the unresolved harness portion separately.

Before apply, recheck canonical content, selected agents, Git state, staged files, evidence,
and exact approval token. Null Git revision/fingerprint is a limitation, not proof of stability;
record it, compare actual content, and follow the installed tool's contract. Do not create
an initial commit solely to satisfy tooling without authority for that Git action.
Verify receipts immediately; later changes may invalidate them and require a fresh plan.
Never fix AFD upstream, install harnesses, modify authentication, or alter global settings
implicitly as part of project initialization.

## Completion evidence

Record what files were initialized, decisions accepted/proposed, actual tooling versions,
checks passed/failed/not-run, and harnesses selected/staged/live-verified/applied. Separate
code failure from missing linker, package, credentials, network, or sandbox access. Do not
claim the project is runnable when only formatting and static checks succeeded.
Keep raw external-tool evidence outside the repository when required; publish only safe
summaries. Provide a concrete next action for each remaining prerequisite.
