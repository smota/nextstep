# 013 — Explicit local Master retrieval

Status: accepted, 2026-10-04.

## Context

Relational context selects registered entities and artifacts, but cannot find local Master guides by topic. Personal context belongs to Holoself; domain guide retrieval belongs to Nextstep.

## Decision

Add read-only `master catalog` and `master query` commands. A filesystem adapter reads current UTF-8 Markdown and hashes its bytes. A pure query use case handles metadata projection, literal token matching and bounded excerpts. The CLI composes these layers. Neither query policy nor storage imports Holoself.

Search is explicit and does not change `context build`. There is no server, embedding model, background task or persistent index. Paths and SHA-256 values identify the source observed at query time; later edits require a fresh query.

Exclude Archive directories, hidden entries, links and non-Markdown files, and report exclusions. Reject linked Master roots, escaping paths, invalid UTF-8, files changing during read and oversized corpora. Limits are 2 MiB per file, 32 MiB total, 1000 Markdown documents, 10000 directory entries and depth 20. Query results have caller-visible count and excerpt bounds.

## Consequences

Small local guide collections are discoverable without injecting domain content into personal context. Every query rereads the collection, trading persistent-index complexity for predictable current evidence. Exclusions and literal matching mean no result does not prove that a fact is absent. Binary artifacts remain governed by the existing artifact engine.
