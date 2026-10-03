# Nextstep

[![License: MIT](https://img.shields.io/github/license/smota/nextstep)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/node-%3E%3D20-339933)](package.json)
[![Sponsored by MoveTheNeedle](https://img.shields.io/badge/sponsored%20by-MoveTheNeedle-6f42c1)](https://movetheneedle.info)

AI coding agents are good at drafting a CV or a cover letter and terrible at being trusted with the
record of your job search: which opportunities you actually decided to pursue and why, what was
really submitted and when, whether a claim in a letter is backed by evidence, and whether the search
process itself is on track. Left alone, an agent invents that state from chat memory — a different
answer every session.

Nextstep is a local, agent-neutral command engine that owns that record instead. Codex, Claude,
Grok, or any other coding agent stays the interface — it still researches, drafts, and decides.
Nextstep is the only thing allowed to durably change the data: opportunity decisions, submission
evidence at its real precision, outreach, QA state, and closure all go through explicit, audited,
versioned commands, never a guessed chat state. There is no server, no listening port, and no
embedded agent runtime — it's a CLI, plus a domain engine, over your own local files.

## Try it in under a minute (no setup, no private data)

```bash
git clone https://github.com/smota/nextstep.git
cd nextstep
npm install
node bin/nextstep.mjs capabilities --json
node bin/nextstep.mjs workflow templates --json
node bin/nextstep.mjs strategy definitions --json
node bin/nextstep.mjs command describe --command "application-attempt record-submission" --json
```

Those four commands need no configuration and no external data: `capabilities` shows the CLI
contract, `workflow templates` lists the built-in structural contracts (executive CV, application
letter, recruiter scan, and more — never auto-generated prose), `strategy definitions` lists the
eight built-in job-search playbooks, and `command describe` returns any command's full
machine-readable payload schema. This is also the real onboarding path for an AI agent: discover
the contract from the CLI itself, never by reading source.

`npm test` (111+ tests, all against disposable temp fixtures — nothing here touches real data)
works the same way. Some tests exercise the Windows local-tool linker and are Windows-only; the
domain engine itself (everything above) has no OS-specific code.

## Point it at your own data

Everything above works with zero setup. The rest of the CLI — `doctor`, `readiness`,
`pipeline status`, and every mutation — needs a **data root**: a directory you control, outside
this repository, containing your own career records. Nextstep never ships or invents one for you;
your job-search data is yours.

A data root needs a `Master/` directory and a `Candidatures/records/manifest.json` file (see
[docs/data-layout.md](docs/data-layout.md) for the full layout and [docs/cli.md](docs/cli.md) for
every command). Point Nextstep at it with `--data-root C:\path\to\your-private-data`, or run
commands from inside it (`project link` writes a durable `nextstep.yaml` marker there).

Resolution order is `--data-root`, then the nearest `nextstep.yaml` marker, then the nearest
compatible layout above the current directory. No environment variable selects the data root.
Runtime state defaults to `.nextstep/` inside the data root.

`doctor --json` reports whether everything needed is in place. A data root with no candidate
profile and no Holoself (an optional, separately-installed external context tool) configured will
report degraded — set `HOLOSELF_EXECUTABLE` to a trusted Holoself install, or run
`candidate-profile upsert` to add a small native profile card instead; either makes `doctor`
healthy. Nextstep never reads Holoself's own files directly and never duplicates what it manages —
see [Candidate profile](docs/cli.md#candidate-profile) in the CLI reference.

## Link the local CLI on Windows

Nextstep can expose its launcher from one local product tree without copying tools. Choose a per-user profile directory outside this repository and preview the operation first:

```text
node C:\path\to\nextstep\bin\nextstep.mjs integration plan --product-root C:\path\to\nextstep --profile-root C:\path\to\nextstep-profile --manage-user-path --json
node C:\path\to\nextstep\bin\nextstep.mjs integration link --product-root C:\path\to\nextstep --profile-root C:\path\to\nextstep-profile --manage-user-path --json
nextstep project link --data-root C:\path\to\your-private-data --instance-id my-career --profile-root C:\path\to\nextstep-profile --json
```

The profile's `bin` entry is a directory junction to the versioned launchers. `--manage-user-path` appends it to the user PATH; a new process may be required. `project link` creates the durable instance marker without changing career data. Skills are distributed separately as complete copies through the Skills Manager **Next Step** preset; integration commands do not create workspace skill links. See [skill distribution and development updates](docs/skill-distribution.md).

Inspect or remove the link with `integration status` and `integration unlink`. Unlinking removes only a link and ownership metadata whose identity still matches. It never removes the source tree or career data. See [CLI reference](docs/cli.md#linked-tool-integration).

Mutations accept one versioned JSON envelope from stdin. Machine-readable results go to stdout; diagnostics go to stderr. See [CLI reference](docs/cli.md).

## Operating model

- Agents perform interpretation, research, and drafting directly.
- The CLI builds bounded context and performs explicit mutations.
- Bounded context embeds the relevant workflow and authorization contracts, including stable executive-CV structure and candidate-owned headline rules.
- Machine-readable command contracts, readiness checks, submission plans, contract checks, and workflow templates prevent agents from rediscovering payloads or inventing process state.
- Semantic mutations record opportunity decisions, register externally drafted packages, confirm or reconcile submission evidence at its real temporal precision, confirm outreach, attach external QA evidence, and close ApplicationAttempts without embedding an agent or renderer.
- Product-owned StrategyDefinitions provide established playbooks; private Strategy and Experiment records activate and measure them without forcing a mandatory workflow.
- `pipeline status` gives a read-only, portfolio-wide view (status rollup, staleness) across every tracked opportunity, without gating anything.
- Read-only work never acquires a lock.
- A mutation takes one short internal commit lock and atomically updates records, projections, audit, and idempotency state.
- Direct user edits appear as `user_revision_pending` and can be adopted as a new version.
- Document checks are structural by default. Visual review is never automatic.
- Disposable `.nextstep/runs/` manifests accept only privacy-safe operational metadata; prompts and document content are rejected.
- Holoself is consumed through its global CLI and remains an independent product; a small native `candidate-profile` card is a built-in fallback when it isn't installed, never a duplicate of it.

The five portable agent skills are `skills/nxt-context`, `skills/nxt-opportunity`, `skills/nxt-application`, `skills/nxt-networking`, and `skills/nxt-review`. They share the single `skills/references` tree. Skills are optional clients: CLI capabilities, help, schemas, and command results remain authoritative without them.

See [Strategies and experiments](docs/strategies.md) for the catalog, lifecycle, process attribution, and migration contract.

## About the `agentflow-*`, `lib/`, `roles/`, and `schemas/` directories

Those, plus `sdlc.config.json` and most of `docs/`, belong to
[AgentFlow SDLC](https://github.com/smota/agentflow-sdlc), a separately-adopted development-process
tool used to help build *this* repository — they are not part of the `nextstep` package or the
`nextstep` command it installs (`bin/nextstep.mjs`). The Nextstep product itself is `bin/`, `src/`,
`launchers/`, `catalog/`, `skills/nxt-*`, `skills/references/`, and the docs linked from this
README. If a doc under `docs/` talks about roles, phases, or "the product authority," it's
AgentFlow's own documentation, not Nextstep's.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) to open a PR and [SECURITY.md](SECURITY.md) to report a
vulnerability.

## Privacy

Never copy a real Nextstep or Holoself data root into this repository. Tests and examples use synthetic fixtures. See `SECURITY.md`.

## Sponsorship

<a href="https://movetheneedle.info"><img src="assets/movetheneedle-logo.png" alt="MoveTheNeedle" width="220"></a>

Nextstep's open-source development is sponsored by [MoveTheNeedle](https://movetheneedle.info).

## License

MIT — see [LICENSE](LICENSE).

## Adaptive applicant guidance

Read-only `guidance` supports optional applicant questions, research/repair actions, and scoped answer reuse. `guidance record` explicitly persists a private brief Artifact. Personal context reports coverage; detailed reviews preserve criterion evidence; submissions support explicit unknown time/channel and later reconciliation. See [the guide](docs/adaptive-guidance.md) for contracts, examples, and boundaries.
