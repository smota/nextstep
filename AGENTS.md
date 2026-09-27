# Nextstep engineering contract

Nextstep is a local CLI and domain engine. It is not an application, API, server, UI, or agent runtime.

- Preserve the separation between this public product, private `example-instance` data, disposable `.nextstep/` state, and canonical Holoself context.
- Agents are external clients. Never launch or coordinate an LLM from Nextstep.
- All durable mutations go through the CLI/domain engine. Locks are internal, short-lived commit details and never part of an agent workflow.
- Analysis and drafting are read-only until the user or agent invokes an explicit mutation command.
- Workflows are composable; do not require an ApplicationAttempt, fit analysis, CV, or letter unless the requested outcome needs it.
- Treat direct edits to registered files as user revisions. Preserve immutable transmitted snapshots and provenance.
- Holoself is a globally installed external CLI. Never read or mutate its canonical data directly and never hardcode its source checkout.
- Use project-isolated dependencies and synthetic fixtures. Never commit private career data, absolute personal paths, runtime state, or credentials.
- No compatibility aliases, legacy folder model, HTTP contracts, or retired execution paths.

## Skill distribution and development updates

- Author `nxt-*` skills and shared references in this product. Keep instance paths and career data outside skills and distribution packages.
- Skills Manager owns library copies, the **Next Step** preset and agent deployments. Keep private workspaces free of Nextstep skill activation links.
- When updating the development environment or skill sources, run `npm run skills:update` and require verified library/deployment hashes before reporting completion. Follow [skill distribution](docs/skill-distribution.md) for initial import, drift, held-back removals or recovery. Edit the product source, not installed copies.
