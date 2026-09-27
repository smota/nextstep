# Artifacts

Use `artifact status` with exactly one of `--artifact`, `--application-attempt`, or explicit `--all`. Status is read-only and does not create runtime state.

Use `artifact contract-check --artifact <id> --template workflow-template:executive-cv` on canonical Markdown before producing a rendition. It checks stable section labels and order, obvious opportunity-title mirroring, and any canonical phrases declared in `document.contract.required_phrases`.

Use `artifact register --input -` for an existing contained vault file. The CLI records its metadata and immutable initial snapshot.

Use `artifact adopt --input -` when a registered working file changed. Inspect the change first, identify authorship as `user`, `ai`, or `mixed`, and optionally pass the recorded SHA-256 as an optimistic check. Never overwrite or reverse-map user edits.

`artifact bootstrap-snapshots` is a migration/maintenance command, not a normal drafting step. Structural DOCX/PDF validation is not visual approval.

Use `artifact record-qa --input -` to attach a renderer-independent QA manifest to a clean artifact. The external capability supplies its identity/version, template identity/version, source and artifact digests, and structural, accessibility, parity, and visual results. Nextstep computes the QA state. Never claim `visually_verified` or upload-ready when the visual result was not run or did not pass.

Use `artifact record-review --input -` to attach a judgment-based workflow-template review (e.g. `workflow-template:recruiter-scan`) to a clean artifact, with a `status` of `passed` or `flagged` and optional `lens`/`notes`. Unlike QA, this review is an external judgment call, never automated. For CV and letter artifacts, set `document.contract.templates` to the relevant `artifact-contract` template id(s) plus `workflow-template:recruiter-scan` so `submission-plan`/`readiness` can surface review status (missing/stale/flagged) as advisory unresolved evidence.

Use `artifact remove --input -` only to drop the record of an artifact whose file is already gone, with a `reason`. It refuses when the file exists, when revisions were preserved, or when an interaction references the artifact. Confirm with the user first and run `--dry-run` before applying.
