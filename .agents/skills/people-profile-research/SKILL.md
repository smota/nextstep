---
name: people-profile-research
description: Research and maintain respectful, evidence-backed Nextstep profiles for recruiters, hiring managers, interviewers, referrals, and outreach contacts.
metadata:
  owner: nextstep
  kind: product-skill
  version: 1
---

# People Profile Research

## When to Use This Skill

Use this skill when the user has a recruiter, hiring manager, interviewer, referral, or target contact to understand. Triggers: "people profile", "profile the recruiter", "hiring manager", "interviewer", "outreach", "who is this person".

## Purpose

Create reusable people intelligence under `Candidatures/people/` and summarize role-specific implications in the application folder when useful.

## Source Rules

- Keep reusable person profile at `Candidatures/people/<person-name>.md`.
- Application-specific notes can go in `Candidatures/applications/<company-role>/people-notes.md`.
- Use `[[wikilinks]]` to connect people, companies, and applications.
- Do not invent personal details. Mark unknowns clearly.
- Use only professionally relevant public or user-provided evidence. Do not collect sensitive personal data or infer protected traits.
- Record source links and retrieval dates. Separate verified facts from role-based hypotheses.
- Read an existing profile before proposing changes and preserve useful sourced information.

## Required Output Structure

```markdown
---
type: person
name: PERSON
company: COMPANY
role: ROLE
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags:
  - people-profile
---

# PERSON — COMPANY

## Role / Influence
Recruiter / Hiring Manager / Interviewer / Referral / Executive / Peer

## Background

## Likely Priorities

## Communication Angle

## How Candidate Should Position
### Opening Angle
### Proof Points
### Avoid

## Outreach Draft

## Related Applications
- [[application-folder/index]]

## Notes / Sources
```

## Quality Bar

Be practical and respectful. The goal is to improve communication and interview preparation, not to over-personalize or speculate beyond evidence. Avoid psychological profiling and do not treat online activity as proof of private intent.

## Nextstep Work Model

- Research produces a proposal or staged artifact; it does not authorize contacting anyone or mutating the vault.
- Durable writes go through Nextstep's registered targets, locks, validation, transaction, and audit mechanisms.
- Reusable person identity belongs in `Candidatures/people/`; application files may contain only relevant linked notes.
- Return the schema requested by the calling workflow. When invoked by the action runner, its completion envelope and artifact allowlist are authoritative.
