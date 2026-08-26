# Migration from the legacy workspace

Migration is copy-first and non-destructive:

1. inventory and hash the source;
2. reconcile the source repository state;
3. copy application code into Nextstep;
4. copy approved private artifacts into Nextstep Sam;
5. move runtime state to `.nextstep`;
6. configure the project-local Holoself link without changing Holoself or its canonical data;
7. compare hashes and run the full validation suite;
8. retain the source read-only until explicit archival approval.

Generated caches and old runtime state are rebuilt rather than migrated.
