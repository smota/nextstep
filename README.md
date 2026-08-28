# Nextstep

Nextstep is a local, agent-neutral command engine for governed career opportunity data. Codex, Claude, or another agent is the interface; Nextstep supplies deterministic context, relational storage, transactions, validation, and provenance.

## Requirements

- Node.js 20 or newer
- npm, using the committed `package-lock.json`
- An external data root containing `Candidatures/records/` and `Master/`

## Configure

Run the command from a `nextstep-sam` vault or set:

```text
NEXTSTEP_DATA_ROOT=C:\path\to\private-nextstep-data
```

The CLI discovers the nearest parent containing `Master/` and `Candidatures/records/`. `--data-root` and `NEXTSTEP_DATA_ROOT` are explicit overrides. Runtime state defaults to `.nextstep/` inside the vault. `HOLOSELF_EXECUTABLE` may identify a trusted global Holoself executable when normal discovery is unavailable.

## Use and test

```text
npm install
npm test
node bin/nextstep.mjs doctor --json
node bin/nextstep.mjs capabilities --json
```

Mutations accept one versioned JSON envelope from stdin. Machine-readable results go to stdout; diagnostics go to stderr. See [CLI reference](docs/cli.md).

## Operating model

- Agents perform interpretation, research, and drafting directly.
- The CLI builds bounded context and performs explicit mutations.
- Read-only work never acquires a lock.
- A mutation takes one short internal commit lock and atomically updates records, projections, audit, and idempotency state.
- Direct user edits appear as `user_revision_pending` and can be adopted as a new version.
- Document checks are structural by default. Visual review is never automatic.
- Holoself is consumed through its global CLI and remains an independent product.

The portable agent skill is in `skills/nextstep/SKILL.md`. It is optional: the command contract remains usable without a skill.

## Privacy

Never copy a real Nextstep or Holoself data root into this repository. Tests and examples use synthetic fixtures. See `SECURITY.md`.

## License

MIT
