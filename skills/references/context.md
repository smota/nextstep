# Context

Use `nextstep context build --intent <intent> [--subject <typed-id>] [--strategy <strategy:id>] [--task <text>] [--budget small|standard|deep] --json`.

- Start with `small` or `standard`; use `deep` only when broader evidence is necessary.
- Omit `--strategy` when no strategy is required. The CLI may include active strategies explicitly related to the subject.
- Pass `--strategy` when the user selected a strategy and its structured instructions are relevant.
- A context packet is read-only evidence. It does not create a record, select a strategy, or authorize a mutation.
- Context packets include the immutable workflow contracts for the requested intent. For application packages, follow the embedded candidate-owned headline, stable-heading, canonical-fact, authorization, and separate-confirmation boundaries.
- Respect truncation flags and warnings. Do not fill missing evidence from assumption.
- `packet.self.source` is `holoself` or `native`. Holoself alone owns and resolves the personal context lens; Nextstep queries with `--self-only` without a `--lens` default or override, and propagates whichever lens Holoself returns.
- `native` means a small local candidate-profile card answered instead of the external tool — read `displayName`/`targetRoles`/`positioning`/`flagshipFacts` directly. An empty `documents` array in that case is not permission to invent a career history or quote a `context/career.md`-shaped path that was never returned; those paths only ever come from a real Holoself response. Use `nextstep candidate-profile show`/`candidate-profile upsert --input -` to read or set that native card; it is a thin fallback, not a résumé, and is never merged with Holoself's own output.
- Generated indexes cover registered relational entities and artifacts under `Candidatures/`; Nextstep provides no generic Master full-text search. External clients can read local `Master/` guides and baselines directly from the filesystem, but this is direct external client reading, not automatic engine indexing.

Personal excerpts are allocated across relevant categories within the chosen text budget. Inspect `self.coverage`: included, missing_at_source, omitted_by_budget, and truncated are different states. Dependency failure is reported separately. Included does not mean a source was read in full. Use targeted or deeper retrieval when an essential passage is absent.
