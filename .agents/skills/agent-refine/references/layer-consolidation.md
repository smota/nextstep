# Layer consolidation

Use this reference for the default, `consolidate`, and `verify` modes and their `recursive` and `guidance` variants.

## Discover the instruction topology

Begin at the active project root. In non-recursive mode inspect root-level instruction entry points,
applicable ancestor instructions exposed by the harness, configured instruction files, and documents reached
through their pointers. Do not scan every subdirectory.

In `recursive` mode, discover nested instruction scopes inside the project. Honor Git ignore rules and project
ignore conventions. Exclude version-control metadata, dependencies, virtual environments, caches, generated
output, build artifacts, vendored trees, and any explicitly excluded scope. Report material exclusions.

Candidate entry points include present or configured `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `CODEX.md`,
equivalent harness-specific files named by harness configuration or explicit context pointers, and case
variants. Take authority from declarations, pointers, and scope, and leave missing variants uncreated.

For each file record:

- absolute or project-relative location;
- scope and inheritance boundary;
- runtime or consumer when known;
- inbound and outbound pointers;
- declared canonical source, if any;
- whether its contents are shared policy, adapter-specific policy, reference, generated material, or unknown.

## Build a semantic matrix

Extract behavior-changing rules as meanings rather than lines. Keep distinct rules separate even when they
share a paragraph; merge paraphrases only when they impose the same behavior, conditions, scope, and authority.

Compare each meaning across every layer where it could apply:

| Status | Meaning |
|---|---|
| Canonical | Defined once in an explicitly authoritative source |
| Pointer | Reached through a pointer that states when to read the target |
| Runtime-specific | Legitimate behavior unique to one harness or consumer |
| Duplicate | Same policy meaning maintained in multiple places |
| Missing | Expected layer or pointer lacks required coverage |
| Conflict | Applicable layers demand incompatible behavior |
| Orphan | A relevant document or rule has no effective path from an entry point |
| Weak pointer | Target is named without a useful trigger or scope |
| Scope leak | Narrow policy appears at a broader level without evidence |
| Sediment | Stale, irrelevant, redundant, or behaviorally inert instruction |
| Tactical cache | Policy text restates a fact cheaply discoverable from the environment |

Include intentional absence as `not applicable`, with its reason, rather than calling every blank cell a gap.

## Propose consolidation

Use explicit declarations, pointer topology, harness configuration, existing scope, and operator decisions to
identify authority. When those disagree or no canonical source exists, show the candidate topologies and ask
the operator to choose.

Prefer these outcomes when supported by evidence:

1. Keep shared, stable, behavior-changing policy in one canonical source for its narrowest valid scope.
2. Replace duplicated common policy in runtime adapters with short pointers whose wording states the trigger.
3. Keep true runtime-specific behavior co-located in its adapter.
4. Keep branch-specific reference behind a conditional pointer instead of loading it in every task.
5. Keep nested overrides within their subsystem and preserve inherited parent policy.
6. Remove stale or inert text only when the proposal identifies the meaning lost and proves it has no live role.
7. Route tactical or enforceable material to the environment; do not move it as part of this policy change
   without separate scope.

Consolidation seeks semantic consistency and maintainable authority. It does not require identical files,
identical headings, or the creation of an adapter for every known runtime.

## Verify

Verification accounts for every discovered node, pointer, scope, and semantic rule. Check:

- one unambiguous authority for each shared meaning;
- valid, reachable pointers with useful conditions;
- preserved runtime-specific behavior;
- absence of unresolved applicable conflicts and accidental duplicates;
- correct parent-to-child inheritance and bounded overrides;
- references that resolve from the file containing each pointer;
- no private session evidence or tactical cache introduced into policy;
- no unrelated file content changed;
- all inaccessible or excluded scopes reported as not run.

A check passes only with observable evidence. An unavailable check remains `not run`; it is not a pass.
