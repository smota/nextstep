# Private data contract

The external private vault contains:

```text
Candidatures/
  records/        canonical relational records, including strategies and experiments, plus durable audit.jsonl
  artifacts/      working artifacts and immutable .versions snapshots
  indexes/        generated projections
  config/         user-owned policy and preserved legacy strategy provenance
  reports/        user-owned or generated reports
Master/           reviewed private baselines
.nextstep/        disposable locks, journals, idempotency state, and privacy-safe run manifests
.holoself/        project link metadata and reviewable proposals
```

There is no coordination control plane in the vault. Agents do not create work queues, handoffs, locks, or executable tools. Optional `.nextstep/runs/*.json` files contain only whitelisted durations, tool families, command/error codes, retry/cache counts, digests, QA status, and validation scopes; prompts, responses, document content, credentials, and other durable career evidence are forbidden. Holoself canonical context remains in its independently managed root.

The canonical model uses eight collections: `companies`, `vacancies`, `applications`, `people`, `interactions`, `artifacts`, `strategies`, and `experiments`. Strategy definitions are public product data under `catalog/`; private objectives, parameters, cohorts, and conclusions remain in the vault.

Older six-collection vaults require the explicit `strategy initialize` mutation. Read-only commands never create the two new collections.
