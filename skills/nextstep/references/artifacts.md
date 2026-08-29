# Artifacts

Use `artifact status` with exactly one of `--artifact`, `--application`, or explicit `--all`. Status is read-only and does not create runtime state.

Use `artifact register --input -` for an existing contained vault file. The CLI records its metadata and immutable initial snapshot.

Use `artifact adopt --input -` when a registered working file changed. Inspect the change first, identify authorship as `user`, `ai`, or `mixed`, and optionally pass the recorded SHA-256 as an optimistic check. Never overwrite or reverse-map user edits.

`artifact bootstrap-snapshots` is a migration/maintenance command, not a normal drafting step. Structural DOCX/PDF validation is not visual approval.

Use `artifact record-qa --input -` to attach a renderer-independent QA manifest to a clean artifact. The external capability supplies its identity/version, template identity/version, source and artifact digests, and structural, accessibility, parity, and visual results. Nextstep computes the QA state. Never claim `visually_verified` or upload-ready when the visual result was not run or did not pass.
