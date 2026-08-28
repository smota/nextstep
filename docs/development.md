# Development

Use Node.js 20+ and the committed lockfile. Nextstep has no runtime dependencies, build, server, or frontend.

```text
npm test
npm run check
```

Tests use synthetic external vaults. Before committing, search tracked files for credentials, personal paths, context packets, private records, `.env` files, and `.nextstep/` state.

Changes to containment, transactions, commit locks, recovery, artifact snapshots, relational invariants, or Holoself execution require focused tests. Skills describe decision boundaries and domain invariants; they do not duplicate mechanics enforced by the CLI.
