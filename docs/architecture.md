# Architecture

Nextstep has four boundaries:

1. **Product** — this repository contains the CLI, domain rules, storage engine, tests, and portable skill.
2. **User vault** — `example-instance` owns private Strategy and Experiment activations, other relational records, working artifacts, immutable versions, and durable audit evidence.
3. **Runtime state** — `.nextstep/` contains short-lived locks, transaction journals, and idempotency state. It is disposable operational state, not career evidence.
4. **Holoself** — an independent, globally installed CLI supplying approved personal context through a versioned command contract. Holoself alone owns and resolves the personal context lens; Nextstep queries Holoself with `--self-only` without a lens default/forwarding, and propagates the returned lens.

The local domain engine is the only mutation authority. Agents never edit relational JSON, indexes, audit, locks, or transaction files directly.

## Agent boundary

An external agent invokes the CLI and receives structured JSON. Nextstep never launches another agent. Read-only commands are lock-free. Mutations acquire a single short commit lock, apply optimistic revision checks, validate affected records, update projections and audit, then release the lock.

The boundary is explicit:

- The external agent owns research, interpretation, career judgment, drafting, browser use, and document rendering.
- Nextstep owns deterministic retrieval, embedded workflow contracts, readiness projections, relational state, strategy gates, explicit artifact-evidence state, temporal precision, immutable bytes, lifecycle changes, and validation. Generated indexes cover registered entities and artifacts under `Candidatures/`. Explicit `master catalog` and `master query` commands read current local Markdown guides through a filesystem adapter and pure query use case; they do not persist an index or use Holoself. See [ADR 013](adr/013-local-master-retrieval.md).
- Product workflow templates define compact support-document, review perspective, and user-answer shapes. Relevant contracts travel with bounded context so portable-skill discovery is not required; they remain guidance and checks rather than an embedded agent or mandatory pipeline. Schema field names for review perspectives (`lens`, `lenses`) remain unchanged.

## Workflow boundary

The product enforces invariants, not a mandatory workflow. Company, Opportunity, Person, Interaction, ApplicationAttempt, and Artifact remain distinct. Networking and outreach may exist without an ApplicationAttempt. Analysis and drafting may remain conversational and unpersisted.

`readiness` and `application-attempt submission-plan` are advisory projections. Atomic semantic mutations such as `opportunity record-decision`, `application-attempt register-package`, and `application-attempt close` reduce orchestration calls but do not decide whether the user should pursue a role or manufacture missing evidence.

StrategyDefinition is immutable product reference data. Strategy and Experiment are private, versioned relational records. A Strategy activates a definition for an objective and scope; an Experiment measures explicit cohorts across one or more Strategies. Selecting a Strategy makes its declared requirements relevant, but no Strategy is required for ordinary analysis, drafting, networking, or user-directed action.

Confirmed Interactions and submissions may carry Strategy and Experiment attribution. Evaluation is a read-only projection over confirmed attributed events; it never infers causality, silence, rejection, or recruiter intent.

## Artifact boundary

Registered paths are working copies. A user edit is detected as drift and may be adopted with explicit authorship. Each adopted or transmitted version receives an immutable content snapshot. DOCX edits by the user are `user_edited_docx`; they are not treated as unknown files or falsely reverse-mapped to Markdown.

External renderers may attach a versioned QA manifest. Nextstep distinguishes generated, structurally verified, visually verified, and transmitted evidence without performing rendering itself. Only a passed external visual check supports `visually_verified`.

Canonical Markdown may be checked against a public artifact contract before rendition. The deterministic checker validates stable structure, obvious opportunity-title mirroring, and declared source phrases; interpretation and rewriting remain external.

Submission evidence distinguishes an unknown artifact set from a confirmed empty or confirmed non-empty set. Event time records date or date-time precision exactly, and later confirmation of an unknown artifact set uses a versioned semantic reconciliation rather than generic Interaction replacement.

## Adaptive applicant guidance

Read-only `guidance` supports optional applicant questions, research/repair actions, and scoped answer reuse. `guidance record` explicitly persists a private brief Artifact. Personal context reports coverage; detailed reviews preserve criterion evidence; submissions support explicit unknown time/channel and later reconciliation. See [adaptive guidance](adaptive-guidance.md) for contracts, examples, and boundaries.

## Planned actions

A planned action is not an interaction, an application close, or a strategy or experiment terminal. Completion records evidence on the action. It does not insert an interaction, and it does not change `lifecycle_status` or `pursuit_status`. Optional strategy, experiment, and cohort ids on an action are attribution only. Storing them does not count as execution and does not move contact clocks.

`action list` and `action get` are lock-free, write nothing, and do not create `actions.json`. Parent career files and generated index pages do not gain action backlinks.

## Vault upgrade

Upgrade is `model upgrade-preview`, then `model upgrade-apply` with that token. There is no new init command. Upgrade does not create a vault. A missing token is INVALID_COMMAND before the lock and does not recover. A forgotten token is not --recover-only. `model upgrade-apply --recover-only` recovers a supported journal when preview refuses a token because a domain journal is pending. It writes no schema and appends no upgrade audit line.

No downgrade command exists. A previous binary can force schema_version 4 and eight counts on a v5 vault. This product does not repair that.

Vault schema_version 5 is not a submission-bundle version. Submission bundles stay on their own evidence versions.

## Contact clocks

Contact clocks are derived from stored interactions. Direction exists only on the closed contact-kind set (`outreach`, `outreach_sent`, `outreach_response`, `human_response`, `conversation`, `interview`, `screen`), on rows written from this change forward. Historical rows are not rewritten to add direction.

Explicit `outbound` or `inbound` on a confirmed contact kind with a real `occurred_at` selects that clock, and explicit direction wins over kind. With no direction, kind `outreach` or `outreach_sent` selects outbound as a kind match. Every other undirected contact kind stays unknown, including `conversation` and `interview`. Direction on any other kind is rejected, and those kinds never enter either clock. `outreach record-sent` stores kind `outreach` and direction `outbound`. `application-attempt record-submission` does not set direction and does not feed contact clocks.

Completion is an event match or internal evidence. Direction and a clock-usable time are clock classification, not completion evidence. A confirmed conversation or interview completes an action whose expected kind is that kind, including when direction and a clock-usable `occurred_at` are absent.

## Torn multi-file reads

Lock-free reads, including `model upgrade-preview`, `action list`, `action get`, `pipeline status`, and `readiness`, can observe a torn multi-file read while a locked mutation writes files one at a time. A torn read is not a successful upgrade and is not a reason to create `actions.json`.
