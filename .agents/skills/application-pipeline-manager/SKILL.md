---
name: application-pipeline-manager
description: Create and maintain self-contained application folders, statuses, metadata, company/people links, and the candidature index
---

# Application Pipeline Manager

## When to Use This Skill

Use this skill when Samuel wants to:
- create a new job application/candidature
- update application status
- organize CVs, cover letters, job descriptions, company profiles, or people profiles
- rebuild the application index
- clean up or archive old application content
- mentions: "new candidature", "new application", "application workflow", "pipeline", "status", "archive", "company profile", "people profile"

## Core Principle

This project is an Obsidian-style career vault. Application status is managed through YAML frontmatter and `Candidatures/index.md`, not by moving files between status folders.

Follow `AGENTS.md` as the canonical workflow contract. Do not treat any agent-specific bootstrap file as the source of truth.

## Source-of-Truth Order

1. Canonical reusable identity and approved evidence: linked Holoself context loaded through `.holoself/BOOTSTRAP.md` with the career lens.
2. Career baseline view and CV structure: `Master/Samuel_Guedes_Mota_Baseline_CV.md`.
3. Supporting career-project evidence: `Master/Samuel_Guedes_Mota_Knowledge_Base_v3.md`.
4. LinkedIn alignment: `Master/Samuel_Guedes_Mota_LinkedIn_Profile.md`.
5. Executive calibration: `Master/Samuel_Guedes_Mota_Executive_Search_Positioning.md`.
6. Compensation / negotiation: `Master/Samuel_Guedes_Mota_Compensation_Context.md`.
7. Application-specific notes under `Candidatures/applications/`.

Master views do not override approved Holoself claims. Flag conflicts for review and preserve provenance, exactly as required by `AGENTS.md`.

## Folder Conventions

```text
Candidatures/
  index.md
  applications/
    company-role/
      index.md
      metadata.md
      job-description.md
      fit-analysis.md
      cv.md
      cover-letter.md
      company-profile.md      # optional local snapshot
      people-notes.md         # optional
      interview-prep.md       # optional
  companies/
  people/
  templates/
  archive/
```

## Lifecycle and Readiness

Lifecycle status and artifact readiness are independent. Use only these lifecycle values:

`identified` · `to_apply` · `applied` · `recruiter_screen` · `interview` · `offer` · `rejected` · `withdrawn` · `archived`

Valid transitions are:

- `identified` → `to_apply`, `rejected`, `withdrawn`, or `archived`
- `to_apply` → `applied`, `rejected`, `withdrawn`, or `archived`
- `applied` → `recruiter_screen`, `rejected`, `withdrawn`, or `archived`
- `recruiter_screen` → `interview`, `rejected`, `withdrawn`, or `archived`
- `interview` → `offer`, `rejected`, `withdrawn`, or `archived`
- `offer` → `rejected`, `withdrawn`, or `archived`
- `rejected` or `withdrawn` → `identified` or `archived`
- `archived` → `identified`

The recommended forward transition is `identified` → `to_apply` → `applied` → `recruiter_screen` → `interview` → `offer`; recommendations never authorize a transition outside the valid list. Readiness gates describe artifact completeness and may block a recommended document action, but never rewrite or restrict lifecycle truth.

## New Application Workflow

When creating a new application:

1. Create `Candidatures/applications/company-role/` from `Candidatures/templates/application-folder-template.md`.
2. Create inside that folder:
   - `index.md` navigation page
   - `metadata.md` with YAML frontmatter
   - `job-description.md`
   - `fit-analysis.md`
   - `cv.md`
   - `cover-letter.md`
   - optional `company-profile.md`, `people-notes.md`, `interview-prep.md`
3. Paste or summarize the job description in `job-description.md`.
4. Run fit analysis before writing any CV or cover letter and save it in `fit-analysis.md`.
5. Create/update reusable company profile under `Candidatures/companies/`; optionally snapshot it locally.
6. Create/update reusable people profiles under `Candidatures/people/` when names are available; optionally summarize locally.
7. Select one dominant narrative:
   - AI Transformation
   - Enterprise Architecture
   - Platform Engineering
   - Digital Delivery Governance
   - Solution / Consulting Director
   - Operational Excellence
   - Life Sciences Technology
8. Generate tailored CV as `cv.md` inside the application folder.
9. Generate cover letter as `cover-letter.md` inside the application folder.
10. Update `Candidatures/index.md` and `Candidatures/applications/index.md`.

## Status and Document Mutation Workflow

Archive means setting lifecycle status to `archived`; it is not a folder move. When an authorized mutating workflow changes status or documents:

1. Acquire the relevant `.coordination/locks/` lock before editing.
2. Validate the requested lifecycle transition against the valid transition list.
3. Apply metadata, document, and index writes atomically (rollback on failure).
4. Keep `metadata.md`, `Candidatures/index.md`, and `Candidatures/applications/index.md` synchronized.
5. Append a dated `.coordination/audit-log.md` entry and release the lock.

Submitted or likely submitted `cv.md` and `cover-letter.md` files are protected historical records. Preserve them unchanged; put refinements in `submission-notes.md`, `executive-review.md`, or a clearly named follow-up version.

## Company Profile Workflow

Create one reusable profile per company. Do not duplicate company research inside every application.

Template: `Candidatures/templates/company-profile-template.md`

Company profile must include:
- Business snapshot
- Strategic priorities
- Why the role likely exists
- Fit with Samuel
- Risks / red flags
- Talking points
- Sources

## People Profile Workflow

Create one reusable profile per person.

Template: `Candidatures/templates/people-profile-template.md`

People profile must include:
- Role/influence
- Background
- Likely priorities
- Communication angle
- How Samuel should position
- Outreach draft if needed

## Cleanup / Archive Workflow

Do not delete content on first pass. Classify as:

- keep_active
- convert_to_application
- convert_to_company
- convert_to_person
- archive_reference
- delete_candidate_later

For applications, archive by lifecycle status rather than moving the folder. `Candidatures/archive/` remains legacy/reference storage; any explicit migration of non-application reference material requires the same lock, atomic write, audit, and index-synchronization safeguards.

## Output Standard

When using this skill, report:

```markdown
# APPLICATION PIPELINE UPDATE

## Changes Made
- ...

## Files Created / Updated
- ...

## Status
- ...

## Next Actions
- [ ] ...
```

## UI / Automation Contract

Preparation represents document evidence independently of lifecycle status: job source → position analysis → CV/letter → interview preparation. A missing document blocks only its dependent action, never lifecycle truth. UI mutations retain locks, atomic writes, synchronized indexes, audit logging, and submitted-version protection. For runner invocation, the runner is authoritative: return exactly `status`, `summary`, `artifacts` (items contain only `artifact` and `content`), `blockers`, and `next_recommended_action`; do not return `action`, `target_paths`, or `result_links`. Harness selection and per-run override do not alter existing CLI triggers or business rules.
