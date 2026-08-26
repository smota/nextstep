---
name: company-profile-research
description: Research and maintain reusable company intelligence for applications, interviews, outreach, offer decisions, red flags, and talking points
---

# Company Profile Research

## When to Use This Skill

Use this skill when Samuel needs company intelligence for an application, interview, outreach, or offer decision. Triggers: "company profile", "research company", "why this company", "red flags", "business model", "company intelligence".

## Purpose

Create reusable company intelligence under `Candidatures/companies/` and link/snapshot it from the relevant application folder.

## Source Rules

- Keep reusable company profile at `Candidatures/companies/<company>-company-profile.md`.
- If the profile materially affects a specific application, copy/summarize the relevant section into `Candidatures/applications/<company-role>/company-profile.md`.
- Use `[[wikilinks]]`.
- Do not mix company research into CV or cover letter files directly; synthesize only the relevant talking points.

## Required Output Structure

```markdown
---
type: company
company: COMPANY
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags:
  - company-profile
---

# COMPANY Company Profile

## Business Snapshot
- Industry:
- Size:
- Geography:
- Revenue / funding:
- Ownership:

## Strategic Priorities

## Why This Role Likely Exists

## Fit With Samuel
### Strong Links
### Weak Links
### Differentiators

## Risks / Red Flags

## Interview / Cover Letter Talking Points
### Why Company
### Why Now
### Samuel's Contribution

## Sources
```

## Quality Bar

Be critical. A company profile is not marketing copy. Flag instability, unrealistic requirements, unclear mandate, language mismatch, compensation mismatch, or signs of political complexity.
