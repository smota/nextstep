# Skill distribution and development updates

The product owns `skills/nxt-*` and `skills/references`. Skills Manager owns library copies, preset **Next Step**, and agent deployments. A private instance supplies data and its marker; it does not install product skills locally. Skills never select a personal data path.

## Initial migration

1. Run `npm run skills:package`. Each ignored `.skill-distribution/current/nxt-*` directory is an independent skill with its referenced documents inside `references/`. The manifest records source and package SHA-256 values. Previous distributions are retained for rollback.
2. For an installation with old workspace links, preview `nextstep integration unlink --scope skills --dry-run --profile-root <profile> --json`. Apply without `--dry-run` after inspecting the exact destinations. It preserves the CLI, PATH, instance marker and data. It records a migration receipt in the profile; rerunning resumes an interrupted removal.
3. Run `npm run skills:update -- --install`. This imports only the five packaged skills using the existing Manager CLI. Set `SKILLS_MANAGER_CLI` or pass `--manager <executable>` if its standard per-user binary is elsewhere. The packages must stay at the registered path for later updates.
4. Inspect presets, reuse/rename an existing suitable preset or create **Next Step** with the Manager CLI, then use `presets add-skill` to add the five canonical names. Import and membership do not imply deployment.
5. Preview `presets deploy "Next Step" --agent <agent> --dry-run`, then deploy to the selected agents. This is additive; avoid the exclusive `presets apply` operation. Preserve unrelated presets and Holoself.
6. Check `presets status "Next Step"`, rerun `npm run skills:update` to verify installed payloads, and open new host sessions to validate discovery and relative references. CLI health alone does not prove host activation.

All Manager command examples refer to its installed CLI. No Manager source or database modifications are required.

## Every development environment update

Run `npm run skills:update` after changing the product checkout/environment, including after edits to skill sources. It regenerates packages, checks all five entries for divergence before changing the library, updates only changed entries, preserves IDs/preset membership/deployed agents, and verifies library and deployed hashes. No-change runs report `changed: false`.

The updater uses the Manager's existing `skills update` command. In version 1.40.0, `skills check` skips local sources, so local freshness is determined by the product manifest and actual file hashes instead. The local `.skill-distribution/sync-state.json` stores the last verified payload per installed ID; it is ignored by Git and contains no career content. Keep it with the development installation. An absent baseline with differing copies requires review, not blind adoption.

If the library or an agent copy differs from the last verified payload, stop and reconcile that edit in the product source before retrying. The updater preserves that copy. If the Manager reports held-back file removals, use its supported review UI to approve the exact removal set, then rerun; do not delete its files or edit its database to bypass the review. A failure is an incomplete environment update even if some skills were already refreshed; successful per-skill state is checkpointed for a retry.

An interrupted updater can leave `.skill-distribution/update.lock`. Confirm no update process is running before removing that stale lock. If a process was interrupted while publishing packages, inspect `stage-*`, `previous-*`, and `current` in the same directory, restore a complete distribution, and rerun. All are generated files; never substitute personal vault content. Retained `previous-*` distributions are rollback material and can be pruned after acceptance.

## Recovery and validation

To roll back copies, preserve the current distribution and restore a previously validated package set to the same `current` path, then run the Manager's `skills update` for each affected ID and verify hashes. Do not run the product updater until the source is also reverted, because it regenerates the latest source. Membership and unrelated deployments stay unchanged.

If the migration itself must be reversed, use `nextstep integration restore-skills --profile-root <profile> --dry-run --json` and then apply without `--dry-run`. First undeploy the new preset on affected agents to avoid duplicate discovery. Restoration requires the original source and unchanged/free destinations; it never overwrites a conflict. Normal CLI relink never restores workspace skills.

Tests use synthetic sources and vaults. `npm test` covers packaging and selective migration; set `NEXTSTEP_TEST_SKILLS_MANAGER` to an installed executable to also run the isolated library import/update test. `--skills-root` on the updater selects an isolated Manager library for such tests; it does not authorize deploying synthetic skills to real agents.
