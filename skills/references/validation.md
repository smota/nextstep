# Validation

Use the smallest scope that proves the relevant result:

```text
nextstep validate --scope structure --json
nextstep validate --scope application-attempt:<id> --json
nextstep validate --scope all --json
```

- `structure` validates typed records, backlinks, Strategy and Experiment relationships, lifecycle values, and snapshot references.
- `application-attempt:<id>` adds file integrity checks for one ApplicationAttempt subgraph and is the normal post-attempt mutation check.
- `all` verifies all registered artifact files and is for migrations or maintenance.

Do not claim that a global count proves a specific ApplicationAttempt was reviewed. Report the exact scope and errors. Never repair canonical JSON, indexes, audit, journals, or locks by hand.
