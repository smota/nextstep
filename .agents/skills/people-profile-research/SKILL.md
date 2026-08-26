---
name: people-profile-research
description: Research and maintain reusable recruiter, hiring manager, interviewer, referral, and target-contact profiles for applications and outreach
---

# People Profile Research

## When to Use This Skill

Use this skill when Samuel has a recruiter, hiring manager, interviewer, referral, or target contact to understand. Triggers: "people profile", "profile the recruiter", "hiring manager", "interviewer", "outreach", "who is this person".

## Purpose

Create reusable people intelligence under `Candidatures/people/` and summarize role-specific implications in the application folder when useful.

## Source Rules

- Keep reusable person profile at `Candidatures/people/<person-name>.md`.
- Application-specific notes can go in `Candidatures/applications/<company-role>/people-notes.md`.
- Use `[[wikilinks]]` to connect people, companies, and applications.
- Do not invent personal details. Mark unknowns clearly.

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

## How Samuel Should Position
### Opening Angle
### Proof Points
### Avoid

## Outreach Draft

## Related Applications
- [[application-folder/index]]

## Notes / Sources
```

## Quality Bar

Be practical and respectful. The goal is to improve communication and interview preparation, not to over-personalize or speculate beyond evidence.
