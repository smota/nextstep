---
name: agent-refine
description: "Distill session lessons and consolidate a project's agent-instruction layers into scoped, reviewable policy."
category: software-engineering
disable-model-invocation: true
---

# Agent refine

Turn evidence from the current session and the project's instruction files into a
reviewable policy proposal. Find drift across agent-specific entry points, preserve
intentional runtime differences, and keep one source of truth for shared behavior.

Treat analysis, agreement, file mutation, and publication as separate actions. A loaded
skill does not authorize edits. Continue the conversation through proposal and refinement;
write only after the user confirms the final proposal in their language.

## Inputs

Use the active project supplied by the harness. Otherwise use the Git repository root,
then the current working directory. If several roots are plausible, show them and ask the
user to select one. Accept another root when the user names it explicitly; a path is not
required in ordinary use.

Use only session history and runtime instructions visible to the current agent. State the
coverage as `complete`, `compacted`, `partial`, or `unavailable`; never claim to have read
conversation content the harness did not expose.

## Prerequisites

- Read access to the target project and its applicable instruction files.
- Access to the visible conversation and runtime instructions for session analysis.
- A file-search capability for consolidation; Git is optional but useful for root discovery,
  ignore rules, status, and diffs.
- Write access is required only after the user confirms a final proposal.
- Guidance discovery uses the skill/plugin registries and configured roots exposed by the
  current harness.

## Commands

`/agent-refine [mode] [modifiers]`: the words after the skill name select a mode (`session`,
`consolidate`, `guidance`, `verify`) and modifiers (`recursive` for `consolidate` and `verify`;
`guidance` for `session` and `consolidate`). With no words, the default runs session analysis and
non-recursive consolidation.

| Command | Reads | Action | Output |
|---|---|---|---|
| `/agent-refine` | [session-learning](references/session-learning.md), [layer-consolidation](references/layer-consolidation.md) | Session analysis plus non-recursive consolidation, prepared as one integrated proposal | Coverage declaration, instruction topology, classified lessons, difference matrix, excluded tactical findings, minimal proposal |
| `/agent-refine session` | [session-learning](references/session-learning.md) | Extract durable lessons from the visible session and compare them with the policy layers applicable to its scope | Qualified policy candidates, existing coverage, tactical exclusions, scope, evidence, confidence, proposed destinations |
| `/agent-refine session guidance` | [session-learning](references/session-learning.md), [guidance-discovery](references/guidance-discovery.md) | `session`, with readable advisory guidance used as review lenses without copying its rule sets | The session report plus an advisory-source register showing what influenced the review |
| `/agent-refine consolidate` | [layer-consolidation](references/layer-consolidation.md) | Build the instruction graph from root-level files and the documents their pointers reach, compare meaning across layers, propose consolidation | Source-of-truth assessment, layer matrix, intentional differences, gaps, conflicts, duplications, weak pointers, orphans, scope leaks, proposed topology |
| `/agent-refine consolidate recursive` | [layer-consolidation](references/layer-consolidation.md) | `consolidate` extended to nested scopes: bounded discovery, inheritance and overrides modeled per scope, each rule compared only where its scope applies | Project-wide scope tree and a consolidation matrix partitioned by scope |
| `/agent-refine consolidate guidance` | [layer-consolidation](references/layer-consolidation.md), [guidance-discovery](references/guidance-discovery.md) | `consolidate`, applying relevant advisory guidance | Consolidation report plus advisory provenance and any advisory conflicts |
| `/agent-refine consolidate recursive guidance` | [layer-consolidation](references/layer-consolidation.md), [guidance-discovery](references/guidance-discovery.md) | `consolidate recursive` plus advisory discovery; every discovered instruction layer is accounted for once in the scope tree and every used advisory once in the register | Full scope tree, semantic difference matrix, advisory register, one bounded proposal |
| `/agent-refine guidance` | [guidance-discovery](references/guidance-discovery.md) | Inventory guidance for authoring, reviewing, consolidating, or validating instruction files from skill/plugin registries, configured skill roots, project pointers, and relevant validation scripts; discovered scripts stay unexecuted | Advisory-source register: provenance, relevance, accessibility, intended contribution |
| `/agent-refine verify` | [layer-consolidation](references/layer-consolidation.md) | Rebuild the non-recursive graph and verify canonicality, pointers, semantic consistency, intentional runtime differences, references, and unintended edits, including any proposal just applied in this conversation | Passed, failed, and not-run checks with evidence |
| `/agent-refine verify recursive` | [layer-consolidation](references/layer-consolidation.md) | `verify` across the bounded recursive scope tree, including inheritance and overrides | Verification results by scope and an aggregate gap list |

**Failure behavior, all commands:** complete every available read-only part, label unavailable
evidence, and infer no missing history, authority, or policy. Then by mode:

- `session`: downgrade isolated or ambiguous observations instead of turning them into universal rules.
- `consolidate`: when canonical authority is ambiguous, present the candidates and ask the user to decide.
  With `recursive`, report excluded or unreadable areas, stop an affected branch at permission or access
  boundaries and complete the rest, and promote a nested rule to a broader scope only on evidence.
- `guidance`: name the configured sources that could not be checked and continue with this skill's own
  criteria; treat unreadable or incompatible guidance as unavailable, not as failed project policy; search
  only the configured sources.
- `verify`: verification does not authorize repair; propose corrections through the workflow below. With
  `recursive`, call the project verified only when every relevant scope was inspected.

## Common workflow

1. **Establish the frame.** Determine the active root, selected mode, visible-session coverage,
   and read/write boundaries. **Complete when:** root, mode, coverage state, and boundaries are stated.
2. **Inventory.** List the relevant instruction layers before judging individual rules.
   **Complete when:** every relevant layer is listed once (for `session`, the layers applicable to its scope).
3. **Separate and compare.** Separate observed evidence from interpretation and recommendation, and
   compare rules by meaning, scope, authority, and behavioral effect rather than text alone.
   **Complete when:** every rule or candidate carries a status or classification from the references.
4. **Route.** Send each finding to its destination using the classification table in
   [session-learning](references/session-learning.md) and the consolidation outcomes in
   [layer-consolidation](references/layer-consolidation.md). **Complete when:** every finding has one destination.
5. **Propose.** Present the smallest proposal that resolves supported gaps: exact intended files and
   edits, open questions, exclusions, and validation. End a proposal containing changes by asking, in the
   user's language, whether they want to change anything or confirm it, and name a confirming phrase (for
   example `apply`; any equivalent, unambiguous phrase in their language counts). With no proposed change,
   report that result and ask for no confirmation. **Complete when:** the proposal lists files, edits, open
   questions, exclusions, and validation, or the no-change result is reported.
6. **Refine.** Every revision replaces the previous proposal. **Complete when:** the user confirms the final proposal.
7. **Apply.** Re-read every target and detect drift; material drift invalidates the proposal, so show the
   revised patch and ask again. Apply only the confirmed proposal, then verify all changed scopes and report
   exact outcomes. Commits, pushes, publishing, deployment, installation, and activation each need separate
   authorization. **Complete when:** each confirmed edit is applied and verified, and the outcomes are reported.

## Boundaries

- Treat runtime/system instructions as evidence of the current operating context, not automatically as
  project-owned policy. Keep provider policy, private conversation, secrets, and raw transcripts out of a repository.
- Preserve unrelated and user-authored content; show conflicts instead of choosing a winner.

## Credits

- Information hierarchy, context pointers, single-source-of-truth pruning, and no-op analysis are adapted
  from the locally supplied `writing-for-agents` guidance. That skill is optional and is not redistributed.
- Skill structure and progressive-disclosure choices are informed by OpenAI's `skill-creator` guidance.
