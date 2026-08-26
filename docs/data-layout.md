# Private data contract

A compatible data root contains:

```text
Candidatures/
  applications/
  archive/applications/
  companies/
  people/
Master/
.coordination/
  audit-log.md
  work-queue.md
  locks/
  tools/vault-lock.mjs
.nextstep/
.holoself/
```

`.nextstep/` is runtime state and should normally be ignored. `.holoself/` is project-local integration metadata; it may contain private paths, indexes, reports, proposals, or snapshots and must be reviewed before synchronization.

Nextstep data is project-owned. Holoself canonical context is not stored here; the metadata link points to an independently managed canonical root.

