---
name: people-profile-research
description: Research and maintain respectful evidence-backed Person entities, profile Artifacts, affiliations, application relationships, and Interaction evidence in the canonical Nextstep Sam relational model.
metadata:
  owner: nextstep
  kind: product-skill
  version: 2
---

# People Profile Research

Use this skill for recruiters, hiring managers, interviewers, referrals, and other professional contacts related to one or more opportunities.

## Canonical placement

Read `AGENTS.md` and `Candidatures/README.md`. Resolve or create one stable `person:*` record in `Candidatures/records/people.json`, independent of employer or vacancy. Link affiliations with `company_id` and opportunity relationships with typed Application/Vacancy IDs. Store reusable research as a typed Artifact under `Candidatures/artifacts/people/` and link its `artifact:*` ID from the Person record.

Application-specific notes remain typed Artifacts owned by the relevant Application; they must reference the reusable Person ID rather than create a second identity. A dated outreach, interview, or submission may become an Interaction. If occurrence is not proven, keep its evidence state `planned_or_recorded`. Never recreate legacy `Candidatures/people/` or application folders.

## Research standard

- Use only professionally relevant public or user-provided evidence.
- Record source URLs and retrieval dates; separate verified facts from role-based hypotheses.
- Do not invent personal details, infer protected traits, or psychologically profile a person.
- Mark employer, role, influence, and relationship unknown when evidence is insufficient.
- Preserve existing sourced information and provenance.

A useful profile covers professional role/influence, background, likely priorities clearly labeled as inference, communication angle, evidence-backed positioning, outreach draft when requested, related applications, and sources.

## Governed update

Research does not authorize contacting anyone. For an authorized vault mutation, acquire exact `.coordination` locks, update Person/Interaction records and Artifacts atomically, run `reindex-preview`, apply the approved digest, validate/report, append the audit entry, and release locks. Generated indexes are never edited by hand.
