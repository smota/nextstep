# Security and privacy

Nextstep may mutate sensitive local career records. Keep this product repository public-data-only and private records in an external vault.

## Reporting a vulnerability

Preferred: use GitHub's private vulnerability reporting for this repository (Security tab → **Report a vulnerability**). Alternatively, email samuelmota@gmail.com. Please allow a reasonable window to investigate and release a fix before any public disclosure. There is no bug-bounty program; this is a maintained open-source project on a best-effort basis.

Only the latest released version on the default branch is supported.

## Guarantees

- There is no listening service or network interface.
- The CLI never launches an agent runtime.
- Read-only commands do not lock or mutate the vault.
- State, artifacts, snapshots, and recovery targets remain physically contained by the configured vault root; symlink and junction escapes fail closed.
- Mutations use a short commit lock, optimistic revisions, recovery journals, validation, and durable audit records.
- Direct edits become explicit artifact revisions; transmitted bytes are snapshotted immutably.
- Holoself is accessed through its global CLI; canonical changes still require its proposal and review flow.

Do not include real candidature documents, context packets, personal paths, tokens, or private logs in vulnerability reports.
