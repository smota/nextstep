# C2 execution record

| Field | Value |
|---|---|
| Cycle | C-2 |
| Criteria | C2-S revision 0.1 |
| Status | C2-G passed |
| Baseline | C1-G candidate `8dd5d5d49eba1e865e76e3eff2bd121792f7df94321efaf6546fa4f4cc7f8293` |
| Private-data access | none |
| Real HKCU mutation | none; PATH tests used injected in-memory adapters |

## Implemented behavior

- Strict `nextstep.yaml` parser and root precedence: argument, environment, nearest marker, layout.
- `project plan/link/status/unlink` with owned marker records, temporary exclusive locks, conflict and drift protection.
- One workspace junction `.agents/skills` to the complete product skill root; no copied skill or launcher payload.
- Optional Windows user PATH management that preserves registry type and unrelated/concurrent segments, verifies writes, and reports the new-process boundary.
- Journals for tool linking and host augmentation/unlink with identity-checked recovery.
- `doctor --integration` before data-root resolution, with separate executable, product/runtime, skills/duplicates, instance/data, Holoself, and recovery evidence.
- Registry readers and rewriters preserve unknown fields; a registry with extension fields remains after the last managed link is removed.

## Deterministic validation

The latest author run completed:

- `npm test`: 82 passed, 0 failed in independent QA.
- `npm run check`: passed.
- `git diff --check`: passed; only working-tree LF/CRLF notices were emitted.
- Pre-existing `bin/nextstep.mjs` SHA-256 remained `d0f54c08cb4c0f1a545b6effbd37eed6622ae47246a3a8ed6fe3851a9780d5d0`.
- Candidate manifest (21 relevant files): `5aeaeafa2dc4c10b48e825cb0f476c7d2f1c12395674d1f930f946a88ead91d8`.
- `src/integration.mjs`: `2f2b7f242ba96eed148f9843f2e04a68f8e0db8f59db8bc790e5df92bc8abd13`.
- `src/instance-config.mjs`: `d38a8f2af1dbb54b4973b4682cec1a02151fc8901161a3919ec8fb537761fca8`.
- `test/integration-c2.test.mjs`: `a67105f2c72a7017ef7d1f19b20101f61b1529df13a2e7c25ebcffc346734829`.
- `test/instance-config.test.mjs`: `79394f01ae95205c37fd3fbb80e3a30c491708e9bc491cdabe7700980ad3784e`.

C2-01 through C2-14 and C2-16 have automated fixture coverage. C2-15 is recorded per host in `c2-environment.md`: Anti-Gravity listing passed; Codex listing failed; activation was not run in C2.

## Independent QA history

The first QA candidate failed with findings covering root evidence, partial rollback, ownership adoption, false health with duplicate skills, recovery diagnosis, marker grammar, non-vault binding, unknown registry extensions, quoted YAML names and interrupted project unlink. Each was corrected and received an adversarial regression. Independent re-evaluation returned PASS with no open finding.

## Gate

C2-G passed for C2-01..14 and C2-16. Behavioral activation and the Codex-specific linked skill adapter belong to C3. Host evidence remains scoped as recorded in `c2-environment.md`.
