# Security and privacy

Nextstep reads and may mutate sensitive local career records. Keep the application repository public-data-only and place private records in an external data root.

## Guarantees

- The server binds to loopback.
- Data and state roots must be outside the application repository.
- Vault writes use canonical containment checks, locks, transaction journals, and audit entries.
- External harnesses run without a shell and generated artifacts are staged and validated before application.
- Holoself context is read through its supported interfaces; durable canonical changes require proposals and explicit approval.

## Reporting

Report vulnerabilities privately to the repository owner. Do not include real candidature documents, context packets, paths, tokens, or logs in reports.

