# Nextstep

Nextstep is a local, agent-neutral command engine for governed career opportunity data. Codex, Claude, or another agent is the interface; Nextstep supplies deterministic context, structured job-search strategies, relational storage, transactions, validation, and provenance.

## Requirements

- Node.js 20 or newer
- npm, using the committed `package-lock.json`
- An external data root containing `Candidatures/records/` and `Master/`

## Configure

Run the command from a compatible private vault or set:

```text
NEXTSTEP_DATA_ROOT=C:\path\to\private-nextstep-data
```

The CLI resolves `--data-root`, then `NEXTSTEP_DATA_ROOT`, then the nearest `nextstep.yaml` marker, and finally the nearest compatible vault layout. Runtime state defaults to `.nextstep/` inside the vault. `HOLOSELF_EXECUTABLE` may identify a trusted global Holoself executable when normal discovery is unavailable.

## Link the local CLI on Windows

Nextstep can expose its launcher from one local product tree without copying tools. Choose a per-user profile directory outside this repository and preview the operation first:

```text
node C:\path\to\nextstep\bin\nextstep.mjs integration plan --product-root C:\path\to\nextstep --profile-root C:\path\to\nextstep-profile --manage-user-path --json
node C:\path\to\nextstep\bin\nextstep.mjs integration link --product-root C:\path\to\nextstep --profile-root C:\path\to\nextstep-profile --manage-user-path --json
nextstep project link --data-root C:\path\to\private-nextstep-data --instance-id my-career --profile-root C:\path\to\nextstep-profile --json
```

The profile's `bin` entry is a directory junction to the versioned launchers. `--manage-user-path` appends it to the user PATH; a new process may be required. `project link` creates the durable instance marker without changing career data. Skills are distributed separately as complete copies through the Skills Manager **Next Step** preset; integration commands do not create workspace skill links. See [skill distribution and development updates](docs/skill-distribution.md).

Inspect or remove the link with `integration status` and `integration unlink`. Unlinking removes only a link and ownership metadata whose identity still matches. It never removes the source tree or career data. See [CLI reference](docs/cli.md#linked-tool-integration).

## Use and test

```text
npm install
npm test
node bin/nextstep.mjs doctor --json
node bin/nextstep.mjs capabilities --json
node bin/nextstep.mjs command describe --command "application-attempt record-submission" --json
node bin/nextstep.mjs workflow templates --json
node bin/nextstep.mjs strategy definitions --json
```

Mutations accept one versioned JSON envelope from stdin. Machine-readable results go to stdout; diagnostics go to stderr. See [CLI reference](docs/cli.md).

## Operating model

- Agents perform interpretation, research, and drafting directly.
- The CLI builds bounded context and performs explicit mutations.
- Bounded context embeds the relevant workflow and authorization contracts, including stable executive-CV structure and candidate-owned headline rules.
- Machine-readable command contracts, readiness checks, submission plans, contract checks, and workflow templates prevent agents from rediscovering payloads or inventing process state.
- Semantic mutations record opportunity decisions, register externally drafted packages, confirm or reconcile submission evidence at its real temporal precision, confirm outreach, attach external QA evidence, and close ApplicationAttempts without embedding an agent or renderer.
- Product-owned StrategyDefinitions provide established playbooks; private Strategy and Experiment records activate and measure them without forcing a mandatory workflow.
- Read-only work never acquires a lock.
- A mutation takes one short internal commit lock and atomically updates records, projections, audit, and idempotency state.
- Direct user edits appear as `user_revision_pending` and can be adopted as a new version.
- Document checks are structural by default. Visual review is never automatic.
- Disposable `.nextstep/runs/` manifests accept only privacy-safe operational metadata; prompts and document content are rejected.
- Holoself is consumed through its global CLI and remains an independent product.

The five portable agent skills are `skills/nxt-context`, `skills/nxt-opportunity`, `skills/nxt-application`, `skills/nxt-networking`, and `skills/nxt-review`. They share the single `skills/references` tree. Skills are optional clients: CLI capabilities, help, schemas, and command results remain authoritative without them.

See [Strategies and experiments](docs/strategies.md) for the catalog, lifecycle, process attribution, and migration contract.

## Privacy

Never copy a real Nextstep or Holoself data root into this repository. Tests and examples use synthetic fixtures. See `SECURITY.md`.

## License

MIT
