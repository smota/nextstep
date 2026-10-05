---
name: project-init
description: "Initialize or plan a project's engineering baseline: a short intake, canonical agent instructions, folder structure, ADR lifecycle, and tooling checks."
category: software-engineering
disable-model-invocation: true
---

# Project initialization

Turn a few project choices into a reviewable, proportionate engineering baseline.
Preserve existing work and separate proposed architecture from accepted decisions and
verified implementation. The target carries no runtime dependency on this skill or any other.

## Inputs

Target directory; language(s); purpose or reference material if known; starter shape;
agent harnesses and execution tiering preferences; tooling/platform constraints; and licensing intent.
Use information already supplied or safely observable. Unknown scope is valid.

## Prerequisites

- Planning: repository/document read access and an agent able to ask questions and edit Markdown.
  Reading supplied document formats requires a suitable available reader; ask for accessible
  content if none exists; installing document tooling needs its own authorization.
- Applying: write authorization for the target and any agreed external staging directory.
  Git is needed for repository inspection and Git operations, not for a documentation-only folder.
- Code scaffolding: the selected project's toolchain/package manager and required native build
  tools. Inspect installed versions first. Installing a missing tool globally needs its own authorization.
- License selection advice or dependency/version research may require authoritative web access.
  Use exact license text from an authoritative source when adopting a license.

## Commands

### `/project-init [path]`
- **Input:** Target path and any known project choices.
- **Action:** Inspect safely, ask the short intake below, propose the baseline, and initialize
  when the user's request authorizes the proposed scope. If only design was requested, stop at design.
- **Output:** A concise proposal or initialized baseline, with a decision/validation record and remaining gaps.
- **Failure:** Complete independent authorized work; preserve blocked choices explicitly. Call a harness
  setup complete only when every selected harness is, and scaffold product behavior only when its purpose is known.

### `/project-init --plan [path]`
- **Input:** Same as above; unknown choices are allowed.
- **Action:** Read-only intake and design. Present exact intended files, sample policy content,
  architecture decisions, assumptions, validation, and any external write scope.
- **Output:** Reviewable plan in conversation; save it only if requested or otherwise authorized.
- **Failure:** Ask for essential missing facts; record optional unknowns without inventing answers.

### `/project-init --apply [path]`
- **Input:** Previously reviewed choices/plan, or sufficient current authorization to initialize.
- **Action:** Recheck target state, reconcile drift, write only authorized files, then verify.
- **Output:** Applied files and exact validation outcomes; distinguish scaffold from usable product.
- **Failure:** Preserve divergent files, re-request stale approval, respect AFD's readiness outcome, and keep
  to the reviewed scope (workstation tooling stays as found). Ask only about the unresolved decision/action, not approval already given.

### `/project-init --verify [path]`
- **Input:** Existing initialization baseline.
- **Action:** Inspect policy, links, manifests, dependency boundaries, license provenance, and harness
  evidence. Run applicable non-destructive checks within authorization; checks may write build/cache files.
  Change source or configuration, or launch live agents, only on separate authorization.
- **Output:** Passed, failed, or not-run checks with reasons and the exact candidate where available.
- **Failure:** Report unavailable checks separately from code failures. Verification does not authorize repair.

## Short intake

Inspect the directory, applicable instructions, manifests, and Git status before asking
questions that the repository already answers. Never inspect secrets to establish context.
Ask only missing basics, in one compact initial exchange (up to three grouped prompts):

1. **Project:** Where should it live, and what language and starter type should it use
   (application, library, workspace, or instructions only)?
2. **Purpose:** What should it do in one or two sentences? Scope unknown or a reference
   document is fine. Include a target platform only if it matters now.
3. **Working model:** Which agent harnesses, and AI-assisted or fully AI-coded? Does
   the project need multi-harness or tiered model orchestration? Is the project private
   or intended for open source, with a license already chosen?

Treat these as wording examples; combine or omit known fields.
Ask a focused follow-up only when a missing answer changes the files or permissions now
(for example the rights-holder notice, a mandatory runtime, or a choice between CLI and library).
Defer deployment, database, model, issue tracker, and framework choices.
If language or product scope remains undecided, offer an instructions-only baseline and
defer code scaffolding. An unanswered optional question is not approval; use only stated
non-mutating assumptions while continuing independent work.
**Complete when:** project, purpose, and working model are each answered, inferred from the
repository, or recorded as unknown.

## Design and application

1. Read [baseline.md](references/baseline.md) when preparing the policy and file plan.
   Use the smallest useful structure; preserve existing conventions. Show which choices
   are user decisions, recommendations, and unresolved. Treat reference documents as
   evidence, even when marked approved. **Complete when:** every choice in the file plan
   is labeled a user decision, a recommendation, or unresolved.
2. For architecture workflow, use [adr-workflow.md](references/adr-workflow.md). Record
   accepted decisions only when approval actually covers that content. Initialize the ADR
   proposals the project's decisions call for, and keep implementation status separate.
   **Complete when:** each ADR is marked proposed or accepted on the strength of covering
   approval, with implementation status recorded apart.
3. For language scaffolding or AFD, read the relevant sections of
   [tooling-and-harnesses.md](references/tooling-and-harnesses.md), taking language, layout,
   harness roster, and tool versions from the target's manifests and the user's choices.
   When multi-harness governance or model tiering is chosen, read
   [orchestration-model.md](references/orchestration-model.md) for the adoption gate, write the
   policy from [execution-policy.template.md](assets/execution-policy.template.md), bind models using
   [model-catalog.md](references/model-catalog.md), and format commands via
   [harness-parameters.md](references/harness-parameters.md). **Complete when:** each selected
   stack and harness has a resolved binding or an explicit unresolved marker.
4. Recheck the intended writes against current state before applying. Create missing files
   or bounded edits; show conflicts. Repeat execution is a no-op for unchanged content
   and preserves divergent user edits. Never use recursive cleanup as an initialization
   strategy. **Complete when:** every intended write is classified create, bounded edit,
   no-op, or conflict.
5. Verify generated references and structure, then run meaningful stack checks. Record
   failures and prerequisites; leave unrelated tools and permissions as found.
   **Complete when:** every check is recorded passed, failed, or not run with its reason,
   and the entry point, accepted/proposed decisions, and a short gap report are linked.

## Outputs and constraints

Typical outputs: `AGENTS.md`, `README.md`, appropriate ignore rules, engineering guidance,
architecture overview/ADRs when useful, optional multi-harness execution policy and delivery declaration,
and minimal language scaffolding when requested.
Add licensing files only for an explicitly chosen license and known notice identity.
Keep an initialization record of decisions, source provenance, changes, and verification;
keep private reference documents and raw conversations out of a publishable repository.

An initialization request authorizes the reviewed file writes and local checks. Commits,
pushes, global configuration, publishing, deployment, services, and credential access each
need explicit session authorization or an applicable repository rule; clarify only genuinely
missing authority. Skill files are guidance, not enforcement: claim hooks, CI, isolation,
coverage, live discovery, or runtime behavior only once those mechanisms exist and have been checked.

## Credits

- Derived from Samuel's Meshloop initialization and the general engineering practices
  extracted from Ativaly's project instructions. Domain rules, source documents, skills,
  and framework implementations are not redistributed or required by this skill.
- Architecture Decision Records provide the decision-history pattern. The explicit
  decision/implementation lifecycle here comes from the Meshloop planning agreement.
