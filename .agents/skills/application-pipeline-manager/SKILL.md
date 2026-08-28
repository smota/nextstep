---
name: application-pipeline-manager
description: Operate the canonical Nextstep Sam relational career pipeline across Company, Vacancy, Application, Person, Interaction, and Artifact records, including governed lifecycle changes, reapplications, validation, generated views, and audit.
metadata:
  owner: nextstep
  kind: product-skill
  version: 2
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
4. Run `relational-migration.mjs reindex-preview`; review its content-derived digest.
5. Run `reindex-apply` with that exact digest, then `validate` and `report`.
6. Append the audit record and release locks.

Use project dependencies and the managed Node runtime. Do not maintain legacy `applications/`, `companies/`, `people/`, templates, metadata files, or manual indexes. Do not route writes through the current Nextstep application runtime until it explicitly supports this model.

## Output

Report changed entity IDs and artifacts, lifecycle/outcome/storage effects, validation and generated-view results, unresolved evidence, and next actions. If a workflow invokes a runner, follow its response schema and artifact allowlist exactly.
