# Skills Manager migration — execution evidence

Date: 2026-09-25. User authorized execution after explicitly allowing managed copies and excluding changes to Skills Manager software.

## Applied

- The product remains the authoring source for five `nxt-*` skills and shared references.
- `scripts/package-skills.mjs` builds deterministic independent packages, rewrites relative reference links, rejects missing/escaping references and personal paths, and retains prior distributions.
- `scripts/update-skills.mjs` imports or updates only these five library entries, detects local/deployment drift, preserves IDs and preset membership, verifies hashes, and checkpoints successful updates. The mandatory development-update procedure is linked from AGENTS and README.
- CLI integration no longer creates workspace skill links. Selective migration has a public preview, ownership checks, interruption recovery, and an explicit rollback receipt. Doctor distinguishes external skill management from CLI health and does not infer global host activation.
- Seven registered junctions were removed from the private workspace: one discovery root, five skill links, and shared reference support. The launcher, user PATH metadata, instance marker and Holoself link were retained.
- Existing empty preset `NextStep` was renamed to **Next Step**, preserving its ID. Five packaged local sources were imported and assigned to it. Codex deployment is active for 5/5 skills, using the Manager's existing additive deployment operation.

## Verified

| Check | Result |
|---|---|
| Product tests, including real isolated Manager import/update | 99 passed, zero failed/skipped |
| Product capability check | passed |
| Five packaged skills: skill-creator quick validation | passed; validator ran in a disposable isolated Python environment |
| Package closure and deterministic output | passed |
| Manager update | Synthetic source change propagated with stable IDs and preset; a conflicting library edit was preserved and rejected |
| Selective removal | Tests cover preview, idempotence, drift, rollback conflict and interruption after each of seven links |
| Real deployment verification | Library and Codex payload hashes match packages; repeated updater returned no changes for all five |
| Private preservation | 2,752 file hashes unchanged across career roots, AGENTS and marker; local Holoself junction target unchanged |
| CLI after migration | Integration doctor returned healthy with skills externally managed |
| Fresh Codex CLI session in private workspace | Listed exactly five skills, read installed nxt-context and internal validation reference, executed structural validation successfully |
| Unrelated prompt in a separate fresh Codex CLI session | Arithmetic response only; no tool calls or skill file reads |
| Git whitespace validation | passed; existing LF/CRLF warnings only |

The package manifest digest at deployment was `2b77bfcce5d711a63fba330305af54308357665809c01e2425336a1231861090`. Regeneration reports the current digest; this evidence does not certify future edits.

## Boundaries and remaining host evidence

Skills Manager 1.40.0 rejected the requested Anti-Gravity deployment preview with `agent is not installed: Antigravity`. The `agy` executable exists, but the Manager's configured detection directory is absent. No application source, adapter setting, synthetic installation marker or target directory was modified to bypass that result. The preset is available in the library; Anti-Gravity deployment remains pending a valid adapter configuration/installation. The failed combined preview performed no deployment; Codex was then previewed and deployed separately.

Codex Desktop discovery in a new task was not tested in this execution. The verified host is a fresh Codex CLI session. The current desktop session can retain its original skill inventory.

The unrelated library entries retained their deployment fields; some unrelated preset memberships changed between snapshots during the session. This migration issued membership operations only for the five Nextstep skills and did not revert those other memberships. Their cause was not established.

Baseline snapshots, private file hashes, original registry, migration receipt and host transcripts are local-only under the installation profile and its migration backup directory. No career contents or personal absolute paths were added to this report. Existing checkout work was preserved; no commit, push or publication was performed.
