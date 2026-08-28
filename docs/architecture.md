# Architecture

Nextstep has four boundaries:

1. **Product** — this repository contains the CLI, domain rules, storage engine, tests, and portable skill.
2. **User vault** — `nextstep-sam` owns private relational records, strategy, working artifacts, immutable versions, and durable audit evidence.
3. **Runtime state** — `.nextstep/` contains short-lived locks, transaction journals, and idempotency state. It is disposable operational state, not career evidence.
4. **Holoself** — an independent, globally installed CLI supplying approved personal context through a versioned command contract.

The local domain engine is the only mutation authority. Agents never edit relational JSON, indexes, audit, locks, or transaction files directly.

## Agent boundary

An external agent invokes the CLI and receives structured JSON. Nextstep never launches another agent. Read-only commands are lock-free. Mutations acquire a single short commit lock, apply optimistic revision checks, validate affected records, update projections and audit, then release the lock.

## Workflow boundary

The product enforces invariants, not a mandatory workflow. Company, Vacancy, Person, Interaction, Application, and Artifact remain distinct. Networking and outreach may exist without an Application. Analysis and drafting may remain conversational and unpersisted.

## Artifact boundary

Registered paths are working copies. A user edit is detected as drift and may be adopted with explicit authorship. Each adopted or transmitted version receives an immutable content snapshot. DOCX edits by the user are `user_edited_docx`; they are not treated as unknown files or falsely reverse-mapped to Markdown.
