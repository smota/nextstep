# Entities

Read a typed entity with `nextstep get --id <typed-id> --json`.

Create or replace Company, Vacancy, Application, Person, or Interaction through `nextstep entity upsert --input -`. Supply a complete record. When replacing an existing entity, pass its current `source_revision` as envelope `expectedRevision`.

Use dedicated commands for Strategy, Experiment, Artifact, outreach, and submission. Do not use generic upsert to bypass their lifecycle or evidence rules.

Before a mutation, retrieve the current entity and preserve unrelated fields and typed relationships. Afterward, inspect the returned revision and validate the smallest relevant scope.
