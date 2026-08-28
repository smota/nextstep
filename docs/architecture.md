# Architecture

Nextstep has four boundaries:

1. **Backend root** — this repository: Express API, domain services, tests, product skills, workflow definitions, and work-model contracts.
2. **Data root** — private durable career artifacts, coordination records, and audit logs.
3. **State root** — disposable indexes plus private runtime settings, runs, intakes, receipts, journals, and recovery state. By default it is `.nextstep` inside the data root, never inside this repository.
4. **Holoself** — optional external context dependency. Its canonical personal context is never vendored or mutated directly by Nextstep.

The API is the only mutation authority. Requests never supply filesystem targets. Every durable mutation maps to a registered artifact and passes through canonical containment, locks, transaction journals, validation, and audit.

## API boundary

The service binds to loopback and exposes JSON routes under `/api`. It does not serve HTML, static assets, or a single-page application. Public DTOs redact filesystem and execution internals. Links emitted by the backend identify API resources rather than browser routes.

Applications require an explicit `active` or `archive` scope whenever a slug could be ambiguous. The canonical public process projection is `preparation`; lifecycle state and permitted actions remain separate.

## Skills

Nextstep does not vendor third-party skill implementations. Their sources and hashes live in `skills-lock.json`; `npm run skills:install` restores them into `.agents/skills`.

The product owns and versions `application-pipeline-manager`, `company-profile-research`, and `people-profile-research`. Missing external skills disable only the affected AI actions; governed non-AI backend functions remain available.

## Configuration

Normal operation requires only `NEXTSTEP_DATA_ROOT`, supplied by the process environment or an ignored application-root `.env`. State and skill paths have safe defaults. Invalid, internal, or incomplete data roots fail before startup recovery or API initialization.
