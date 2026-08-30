# Architecture

Nextstep has four boundaries:

1. **Product** — this repository contains the CLI, domain rules, storage engine, tests, and portable skill.
2. **User vault** — `nextstep-sam` owns private Strategy and Experiment activations, other relational records, working artifacts, immutable versions, and durable audit evidence.
3. **Runtime state** — `.nextstep/` contains short-lived locks, transaction journals, and idempotency state. It is disposable operational state, not career evidence.
4. **Holoself** — an independent, globally installed CLI supplying approved personal context through a versioned command contract.

The local domain engine is the only mutation authority. Agents never edit relational JSON, indexes, audit, locks, or transaction files directly.

## Agent boundary

An external agent invokes the CLI and receives structured JSON. Nextstep never launches another agent. Read-only commands are lock-free. Mutations acquire a single short commit lock, apply optimistic revision checks, validate affected records, update projections and audit, then release the lock.

The boundary is explicit:

- The external agent owns research, interpretation, career judgment, drafting, browser use, and document rendering.
- Nextstep owns deterministic retrieval, embedded workflow contracts, readiness projections, relational state, strategy gates, explicit artifact-evidence state, temporal precision, immutable bytes, lifecycle changes, and validation.
- Product workflow templates define compact support-document and user-answer shapes. Relevant contracts travel with bounded context so portable-skill discovery is not required; they remain guidance and checks rather than an embedded agent or mandatory pipeline.

## Workflow boundary

The product enforces invariants, not a mandatory workflow. Company, Vacancy, Person, Interaction, Application, and Artifact remain distinct. Networking and outreach may exist without an Application. Analysis and drafting may remain conversational and unpersisted.

`readiness` and `application submission-plan` are advisory projections. Atomic semantic mutations such as `opportunity record-decision`, `application register-package`, and `application close` reduce orchestration calls but do not decide whether the user should pursue a role or manufacture missing evidence.

StrategyDefinition is immutable product reference data. Strategy and Experiment are private, versioned relational records. A Strategy activates a definition for an objective and scope; an Experiment measures explicit cohorts across one or more Strategies. Selecting a Strategy makes its declared requirements relevant, but no Strategy is required for ordinary analysis, drafting, networking, or user-directed action.

Confirmed Interactions and submissions may carry Strategy and Experiment attribution. Evaluation is a read-only projection over confirmed attributed events; it never infers causality, silence, rejection, or recruiter intent.

## Artifact boundary

Registered paths are working copies. A user edit is detected as drift and may be adopted with explicit authorship. Each adopted or transmitted version receives an immutable content snapshot. DOCX edits by the user are `user_edited_docx`; they are not treated as unknown files or falsely reverse-mapped to Markdown.

External renderers may attach a versioned QA manifest. Nextstep distinguishes generated, structurally verified, visually verified, and transmitted evidence without performing rendering itself. Only a passed external visual check supports `visually_verified`.

Canonical Markdown may be checked against a public artifact contract before rendition. The deterministic checker validates stable structure, obvious vacancy-title mirroring, and declared source phrases; interpretation and rewriting remain external.

Submission evidence distinguishes an unknown artifact set from a confirmed empty or confirmed non-empty set. Event time records date or date-time precision exactly, and later confirmation of an unknown artifact set uses a versioned semantic reconciliation rather than generic Interaction replacement.
