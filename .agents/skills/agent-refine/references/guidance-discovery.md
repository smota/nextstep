# Guidance discovery

Use this reference when the command includes `guidance`.

## Discovery boundary

Search only sources exposed or configured by the active harness and project:

- skill names, descriptions, and metadata available in the current session;
- configured skill or plugin roots;
- project-local skill/plugin manifests and instruction pointers;
- configured validators, linters, generators, or scripts whose declared purpose concerns agent instructions;
- documentation explicitly named by one of those sources.

Do not crawl unrelated home directories, search the whole disk, contact marketplaces, install packages,
enable plugins, or fetch remote guidance unless the user separately requests that expansion.

## Select relevant guidance

Use names, descriptions, frontmatter, manifests, and documented script purpose to find guidance that changes
how the current review should judge or write:

- agent instruction files or runtime adapters;
- context pointers, hierarchy, scoping, inheritance, or progressive disclosure;
- consolidation, duplication, drift, linting, generation, or validation;
- guardrails, authority boundaries, privacy, provenance, or verification in instruction authoring.

A keyword match alone is insufficient. Read only the minimum relevant entry point needed to confirm purpose
and contribution. Follow its disclosed references only when the current analysis reaches that branch.

## Use sources as advisories

For every selected source record:

- name and type (`skill`, `script`, `validator`, `document`, or `plugin capability`);
- configured provenance and version when visible;
- access state (`available and read`, `metadata only`, `unavailable`, or `conflicting`);
- reason it applies;
- review dimension it contributed;
- overlap or conflict with local policy.

Apply a readable advisory as a lens over the local evidence. Cite its contribution in the conversational report,
but keep its detailed rule set in its own source. Do not copy the advisory into this skill or the target project's
policy, and do not claim that its presence makes a behavior enforced.

Project policy and explicit user instructions remain authoritative for the project. Advisory guidance can expose
a gap or improve wording; it cannot silently replace a local decision. When two advisories conflict, present the
conflict and the concrete consequence instead of averaging them.

Do not execute discovered scripts, invoke mutating commands, or install/update a source during discovery.
Execution requires an explicit request and the permissions that source declares.

Guidance discovery is complete when every configured source whose metadata plausibly matches the review has
one recorded disposition: used, irrelevant, unavailable, or conflicting.
