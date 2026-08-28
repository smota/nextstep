# Security and privacy

Nextstep may mutate sensitive local career records. Keep this product repository public-data-only and private records in an external vault.

## Guarantees

- There is no listening service or network interface.
- The CLI never launches an agent runtime.
- Read-only commands do not lock or mutate the vault.
- State, artifacts, snapshots, and recovery targets remain physically contained by the configured vault root; symlink and junction escapes fail closed.
- Mutations use a short commit lock, optimistic revisions, recovery journals, validation, and durable audit records.
- Direct edits become explicit artifact revisions; transmitted bytes are snapshotted immutably.
- Holoself is accessed through its global CLI; canonical changes still require its proposal and review flow.

Do not include real candidature documents, context packets, personal paths, tokens, or private logs in vulnerability reports.
