# Contributing

1. Create a focused branch and keep unrelated user changes intact.
2. Install dependencies from the committed lockfile with `npm install`.
3. Add or update tests for behavior changes.
4. Run `npm test` and a synthetic-data API smoke test before opening a pull request.
5. Confirm that no private data, absolute personal paths, credentials, caches, or generated runtime files are included.

Changes to vault writes, path containment, transactions, locks, or Holoself integration require explicit security-focused review.
