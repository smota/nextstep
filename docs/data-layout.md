# Private data contract

The external private vault contains:

```text
Candidatures/
  records/        canonical relational records, including strategies and experiments, plus durable audit.jsonl
  artifacts/      working artifacts and immutable .versions snapshots
  indexes/        generated projections covering registered entities and artifacts
  config/         user-owned policy and preserved legacy strategy provenance
  reports/        user-owned or generated reports
Master/           reviewed private baselines and guides (explicit read-only catalog/query; no persistent index)
.nextstep/        disposable locks, journals, idempotency state, and privacy-safe run manifests
.holoself/        project link metadata and reviewable proposals
```

There is no coordination control plane in the vault. Agents do not create work queues, handoffs, locks, or executable tools. Optional `.nextstep/runs/*.json` files contain only whitelisted durations, tool families, command/error codes, retry/cache counts, digests, QA status, and validation scopes; prompts, responses, document content, credentials, and other durable career evidence are forbidden. Holoself canonical context remains in its independently managed root; Holoself alone owns and resolves personal context lenses, and Nextstep queries with `--self-only` without a lens default/forwarding. Generated indexes under `Candidatures/indexes/` cover registered entities and artifacts. `master catalog` and `master query` explicitly retrieve current local Markdown with source hashes and bounded excerpts; no persistent Master index is written. Archive, hidden entries, links and non-Markdown files are excluded and reported.

The canonical model uses nine collections: `companies`, `opportunities`, `applicationAttempts`, `people`, `interactions`, `artifacts`, `strategies`, `experiments`, and `actions`. They are stored in `companies.json`, `opportunities.json`, `application-attempts.json`, `people.json`, `interactions.json`, `artifacts.json`, `strategies.json`, `experiments.json`, and `actions.json`. `actions.json` is the ninth collection. On a vault that already exists, that file is part of the live model only after the explicit upgrade. Strategy definitions are public product data under `catalog/`; private objectives, parameters, cohorts, and conclusions remain in the vault.

Opportunity records expose first-class structured fields for filtering and scoring: `location` (`country` array of ISO country codes, optional `city`, `raw` location string), `work_model` (`onsite`, `hybrid`, `remote`, `unknown`), and `pay` (`currency`, `min`, `max`, `period`, `ote` flag). Values may be filled by humans or later by external job monitors (such as Kyle) or import pipelines; paraphrased job descriptions must not auto-invent pay or location when omitted in the source posting.

This is the only supported layout. The product does not load legacy collection names or initialize an older model at runtime.

## Manifest version 5

Ready vaults are manifest `schema_version` 5 with nine collection files, including canonical empty `actions.json`, and nine counts, including `counts.actions`. On a vault that already exists, `actions.json` is part of the live model only after `model upgrade-preview` and `model upgrade-apply`. A missing `actions.json` on version 5 is malformed. It is not an empty collection, and ordinary commands do not create it.

There is no new init command. Upgrade does not create a vault. Ordinary commands on a consistent `schema_version` 4 vault fail with `VAULT_UPGRADE_REQUIRED` and write nothing.

A missing token is INVALID_COMMAND before the lock and does not recover. A forgotten token is not --recover-only. `model upgrade-apply --recover-only` recovers a supported journal and writes no schema.

No downgrade command exists. A previous binary can force schema_version 4 and eight counts on a v5 vault. This product does not repair that.

Vault schema_version 5 is not a submission-bundle version. Submission bundles stay on their own evidence versions.

Parent career files and generated index pages do not gain action backlinks. `entity upsert` cannot create or replace an action. `artifact bootstrap-snapshots` remains a snapshot tool. On a version 5 vault it does not force version 4 or invent `actions.json`.

Apply of a matching version 4 token leaves the eight career files, snapshots, submission bundles, and transmission bytes byte-identical, keeps those eight counts, and appends one audit line after the previous audit prefix.

## Torn multi-file reads

Lock-free reads, including `model upgrade-preview`, `action list`, `action get`, `pipeline status`, and `readiness`, can observe a torn multi-file read while a locked mutation writes files one at a time. A torn read is not a successful upgrade and is not a reason to create `actions.json`.
