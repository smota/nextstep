---
name: application-pipeline-manager
description: Operate the canonical Nextstep Sam relational career pipeline across Company, Vacancy, Application, Person, Interaction, and Artifact records, including governed lifecycle changes, reapplications, validation, generated views, and audit.
metadata:
  owner: nextstep
  kind: product-skill
  version: 3
---

# Application Pipeline Manager

Use this skill for new or updated candidatures, status/outcome changes, vacancy or contact links, artifacts, reapplications, generated views, and archival decisions.

## Canonical contract

Read the vault's `AGENTS.md` and `Candidatures/README.md` before proposing writes. The only maintained career model is:

```text
Candidatures/
  records/       # manifest plus typed JSON entity collections
  artifacts/     # durable source and authored documents
  indexes/       # generated Markdown views; never edit manually
  config/        # reviewed identity and lineage overrides
  reports/       # generated review findings
```

Use all six entity types and their typed stable IDs:

- Company is reusable across vacancies.
- Vacancy represents one posting at one Company.
- Application represents one pursuit of one Vacancy.
- Person is reusable across companies, vacancies, and applications.
- Interaction records a planned or evidenced event with an explicit evidence state.
- Artifact preserves content, checksum, type, provenance, and ownership links.

Display names are not foreign keys. Never collapse Company, Vacancy, Application, or Person into a folder identity. A reapplication is a new Vacancy and Application linked through `previous_application_id`, not an overwrite.

## Evidence and state

Use approved Holoself evidence first, governed `Master/` baselines second, then existing canonical records/artifacts. Preserve submitted artifacts and provenance. Never invent identity, claims, dates, metrics, status, contact activity, or URL availability.

## Authoritative documents and renditions

Markdown is always the authoritative, reviewable source for a CV, application letter, application answer, or outreach message. Record its Artifact as `document.representation: canonical_markdown`. DOCX is never a parallel source: generate it only on request and record it as `document.representation: generated_docx` with the exact `source_artifact_id` and `source_sha256` of the Markdown used.

For a DOCX request, resolve the exact primary final Markdown Artifact first, render from that content with the approved document styles/template, and run the normal structural, formatting, accessibility, hyperlink and privacy checks before registering the rendition. Record generator/template provenance when available. If the Markdown hash changes, generate a new rendition Artifact ID or version; never replace a rendition already preserved in a confirmed transmission.

Use a new Artifact ID for a new file or a new document version. A primary final document uses:

```json
{
  "document": {
    "role": "cv",
    "representation": "canonical_markdown",
    "state": "final",
    "version": 2,
    "primary": true,
    "answer_key": null,
    "source_artifact_id": null,
    "source_sha256": null
  }
}
```

There must be exactly one primary final Markdown source for the CV and application letter when a submission default is used. Each applicable application answer has its own stable `answer_key`. Multiple primary finals are an ambiguity and must stop the command. A later edit creates a new Artifact ID or version; never overwrite content frozen by a confirmed submission or outreach transmission.

When Samuel confirms that an application was completed or submitted, default to the current primary final Markdown CV, application letter, and every applicable primary final answer. When a generated DOCX was actually uploaded, preserve that rendition in the same bundle. Explicit user exceptions override the default.

When Samuel confirms that a recruiter was contacted, default to the current primary final Markdown outreach message and the recorded channel and contact Person IDs. Explicit message, recipient, or channel exceptions override the default.

## Canonical transmissions

A confirmed submission Interaction stores a `submission_bundle` with `schema_version`, `selection_mode`, `channel`, `confirmed_at`, optional note, and `items`. Every item preserves `role`, optional `answer_key`, canonical Artifact ID, document version and SHA-256. An actually transmitted rendition additionally preserves its Artifact ID and SHA-256.

```json
{
  "submission_bundle": {
    "schema_version": 1,
    "selection_mode": "default_final",
    "channel": "portal",
    "confirmed_at": "2026-08-28T14:00:00.000Z",
    "items": [
      {
        "role": "cv",
        "artifact_id": "artifact:cv-source",
        "version": 2,
        "sha256": "<canonical-markdown-sha256>",
        "transmitted_artifact_id": "artifact:cv-docx",
        "transmitted_sha256": "<generated-docx-sha256>"
      }
    ]
  }
}
```

A confirmed outreach Interaction stores a `transmission` with `schema_version`, `selection_mode`, `channel`, `sent_at`, `confirmed_at`, canonical message Artifact ID and SHA-256. Submission and outreach commands use typed relational IDs, expected Application revision, a command ID, and an idempotency key. Reusing the same key for another intent is an error.

Keep these independent:

- `lifecycle_status`: recorded pipeline position.
- `outcome`: evidenced result or `null`.
- `storage_scope`: `active` or `archive`; storage alone never determines lifecycle or outcome.
- `vacancy_state`: may be closed or expired while Company and Person remain active reusable entities.

Treat `planned_or_recorded` interactions as ambiguous unless a dated source establishes occurrence. Treat an unavailable or unchecked source URL separately from a preserved local vacancy snapshot.

Valid forward lifecycle transitions are `identified` → `to_apply` or `applied`; `to_apply` → `applied`; `applied` → `recruiter_screen` or `interview`; `recruiter_screen` → `interview` or `offer`; and `interview` → `offer`. Any nonterminal state may also end as `rejected`, `withdrawn`, or `archived`. Do not reopen a terminal record: create a new linked Application. A status correction needs explicit evidence and audit.

## Governed mutation workflow

1. Read existing records and resolve IDs before creating anything.
2. Acquire exact `.coordination` locks and register the task before editing durable business artifacts.
3. Update the smallest canonical record collections and typed artifacts needed. Validate all forward and reverse relationships.
4. Run the canonical submission or outreach command using the Application ID and current `source_revision`. Do not route the operation through folder-based runtime commands.
5. Run `npm run vault -- reindex-preview --application-id <Application ID>`; review its content-derived digest.
6. Run `reindex-apply` with that exact digest and the same Application ID, then run localized validation and a fresh report.
7. Use global structure validation and global checksum audit only as explicit separate checks.
8. Append the audit record and release locks.

Use project dependencies and the managed Node runtime. Do not maintain legacy `applications/`, `companies/`, `people/`, templates, metadata files, manual indexes, compatibility copies, or a legacy fallback.

```text
NEXTSTEP_DATA_ROOT must point to the private vault. From the Nextstep product checkout, use only the stable product interface:

npm run vault -- execute --command-file <vault-relative-command.json>
npm run vault -- validate-application --application-id <Application ID>
npm run vault -- reindex-preview --application-id <Application ID>
npm run vault -- reindex-apply --application-id <Application ID> --expect-digest <preview digest>
npm run vault -- validate-structure
npm run vault -- audit-checksums
```

Submission command example:

```json
{
  "schemaVersion": 1,
  "commandId": "submission-20260828-001",
  "idempotencyKey": "application:example|submission|2026-08-28",
  "expectedRevision": 3,
  "applicationId": "application:example",
  "type": "application.recordSubmission",
  "payload": {
    "occurredAt": "2026-08-28T14:00:00.000Z",
    "channel": "portal",
    "note": null
  }
}
```

Omitting `artifactIds` activates the final-document defaults. Provide `artifactIds` only for an explicit exception and `transmittedArtifactIds` only for generated DOCX renditions known to have been sent.

Outreach command example:

```json
{
  "schemaVersion": 1,
  "commandId": "outreach-20260828-001",
  "idempotencyKey": "application:example|outreach|person:recruiter|2026-08-28",
  "expectedRevision": 4,
  "applicationId": "application:example",
  "type": "application.recordOutreach",
  "payload": {
    "occurredAt": "2026-08-28T15:00:00.000Z",
    "channel": "LinkedIn",
    "note": null
  }
}
```

## Output

Report changed entity IDs and scoped artifact/interaction counts, lifecycle/outcome/storage effects, validation scope, generated-view results, unresolved evidence, and next actions. Never present the global Artifact count as the Application scope. If a workflow invokes a runner, follow its response schema and artifact allowlist exactly.
