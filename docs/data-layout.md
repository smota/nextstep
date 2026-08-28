# Private data contract

The external private vault contains:

```text
Candidatures/
  records/        canonical relational records and durable audit.jsonl
  artifacts/      working artifacts and immutable .versions snapshots
  indexes/        generated projections
  config/         user-owned strategy and policy
  reports/        user-owned or generated reports
Master/           reviewed private baselines
.nextstep/        disposable locks, journals and idempotency state
.holoself/        project link metadata and reviewable proposals
```

There is no coordination control plane in the vault. Agents do not create work queues, handoffs, locks, or executable tools. Holoself canonical context remains in its independently managed root.
