# Architecture

Nextstep has four boundaries:

1. **Application root** — this repository: React/Vite client, Express server, tests, workflow definitions, and work-model contracts.
2. **Data root** — private durable project artifacts such as candidatures, Master documents, coordination records, and audit logs.
3. **State root** — disposable indexes plus private settings, runs, intakes, receipts, journals, and migration state.
4. **Holoself** — optional external context dependency. A project-local metadata link belongs to the private data project; canonical personal context remains in its own Holoself root.

The server is the only mutation authority. Client requests never supply filesystem targets. Every durable mutation is mapped to a registered artifact, canonically contained, locked, journaled, validated, and audited.

Holoself is not vendored. Agent context may be available through the installed skill and `AFD_HOLOSELF_ROOT`; structured application operations use a configured CLI executable. Nextstep must degrade safely if either integration is unavailable.

## Skills

Nextstep does not vendor third-party skill implementations. The upstream source and content hashes live in `skills-lock.json`; `npm run skills:install` restores them only into this project's `.agents/skills`. Actions declare stable capability IDs and add the workflow around them: prerequisites, authoritative inputs, output schemas, mutation boundaries, staging, confirmation, transactions, and audit.

Three complete product skills are owned and versioned by Nextstep: `application-pipeline-manager`, `company-profile-research`, and `people-profile-research`. Their frontmatter declares `metadata.owner: nextstep` and `metadata.kind: product-skill`; unlike generated third-party dependencies, these files are committed and maintained with the application.

By default each capability resolves as `.agents/skills/<capability-id>/SKILL.md`. `NEXTSTEP_SKILLS_ROOT` may select another collection. Users may substitute implementations by preserving the capability IDs and documented output contract. A missing or invalid skill disables only the affected AI actions; vault browsing and governed non-AI workflows continue to work.
