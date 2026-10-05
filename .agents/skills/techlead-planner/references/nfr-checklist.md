# Non-functional checklist

Used in step 7. Mark each area *applies* with a measurable target or a named decision, or *not applicable* with a one-clause reason. The examples show the level of specificity wanted, not defaults.

| Area | Ask | Example of a target or decision |
|---|---|---|
| Security | Who may do what, where secrets live, what input is untrusted, what is audited. | "Only role `billing` may refund; secrets come from the vault and never appear in logs." |
| Privacy and compliance | Which data is personal, how long it is kept, how it is deleted, where it may be stored. | "Email is personal data, retained 90 days after account closure, stored in the EU region." |
| Performance and capacity | Latency, throughput, expected growth, resource ceiling. | "p95 under 200 ms at 50 requests per second; 10x volume in 12 months." |
| Reliability | Failure modes, timeouts, retries, idempotency, degradation, availability, recovery objectives. | "Retry with backoff and jitter, at most 3 times; the operation is idempotent by request id; recovery point 5 minutes." |
| Observability | How anyone learns it is failing in production: logs, metrics, traces, alerts. | "Structured log per request with request id; alert when error rate exceeds 1% for 5 minutes." |
| Operability | Deploy, configuration, feature flags, migration, rollback, runbook. | "Ships behind a flag; schema change is expand, migrate, contract over three releases; rollback is turning the flag off." |
| Compatibility and versioning | Who consumes the interface, how long the old shape is supported, how deprecation is announced. | "v1 stays for two releases; the new field is optional." |
| Cost | Unit cost per request or user, spend ceiling for infrastructure and third parties. | "Under $0.002 per request at expected volume." |
| Usability and accessibility | For user interfaces: accessibility level, localization, error messages. | "WCAG 2.2 AA; strings extracted for translation." |
| Maintainability and testability | Size and shape of the change, test level per slice, documentation, conventions followed. | "Each slice tested at the use-case level; no module above the repo's size norm." |
| Portability and environment | Supported runtimes, operating systems, and versions. | "Node 20 and 22; Linux and macOS." |

An area marked *applies* without a number, threshold, or named decision is incomplete. An area marked *not applicable* without a reason is a blank.
