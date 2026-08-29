# Development

Use Node.js 20+ and the committed lockfile. Nextstep has no runtime dependencies, build, server, or frontend.

```text
npm test
npm run check
```

Tests use synthetic external vaults. Before committing, search tracked files for credentials, personal paths, context packets, private records, `.env` files, and `.nextstep/` state.

Changes to containment, transactions, commit locks, recovery, artifact snapshots, Strategy/Experiment lifecycle, relational invariants, or Holoself execution require focused tests. Skills describe routing, decision boundaries, and domain invariants; they do not replace mechanics enforced by the CLI.

Public StrategyDefinitions must remain generic, synthetic, evidence-bounded, and free of personal paths or private search decisions. Update the catalog, schemas, CLI capability output, strategy documentation, and routed skill reference together. Tests must prove that every advertised CLI command family is represented by the portable skill.
