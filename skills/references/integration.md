# Installation and skill distribution

Use `nextstep integration status --profile-root <absolute-path> --json` to inspect the CLI installation. `integration plan` previews launcher and optional user PATH changes; `integration link` applies them. Workspace skill deployment is owned by Skills Manager and is independent of the CLI installation.

Use Skills Manager to inspect the **Next Step** preset and its per-agent deployment state. Product skill sources are packaged with their references and imported as local copies. Updating the development environment must regenerate packages and update those copies through the product maintenance procedure. A running host may need a new session to discover changed skills.

For removal of a previously registered workspace activation, preview `nextstep integration unlink --scope skills --dry-run --profile-root <absolute-path> --json`. The same command without `--dry-run` removes only registered skill links and preserves the launcher, PATH, instance marker and data. `integration restore-skills` is an explicit migration rollback. A full `integration unlink` also removes the CLI installation.

Bind a vault with `project plan` followed by `project link`, supplying absolute `--data-root` and `--profile-root` values plus a stable `--instance-id`. `project status` is read-only. `project unlink` removes only an unchanged owned marker, never career data.

Resolve conflicts through the owning tool; never edit its registry or remove source trees to repair a link.
