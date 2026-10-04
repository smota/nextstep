# Workflow support

Use immutable product views to reduce user reading and agent orchestration without forcing a workflow.

- `workflow templates` lists compact support-document, user-answer, and quality-check shapes.
- `workflow template --id <workflow-template:id>` returns one complete section contract.
- `readiness --intent analyze|outreach|package|submit|close --subject <typed-id>` reports current state, required evidence, active gates, and validation scope. It is advisory and never authorizes a mutation.
- `application-attempt submission-plan` is the more detailed Application-specific artifact and gate view.
- `pipeline status [--stale-after-days <integer>=14]` is the only portfolio-wide view: a read-only, lock-free rollup of every Opportunity/ApplicationAttempt by status (active vs. closed), plus a `subjects` list with `daysSinceLastConfirmed` and `stale` derived only from confirmed Interactions. It never gates anything; use it to see the shape of a multi-pursuit search before drilling into a single subject with `readiness`/`submission-plan`.
- `context build` and package `readiness` embed the relevant contracts so correct behavior does not depend on a separately installed skill or an additional template lookup.

The external agent still researches, reasons, drafts, selects an action, and asks for any missing user confirmation. Nextstep never fills a template with generated prose.

Artifact contracts are available for executive CVs, company-problem-first letters, exact bounded form answers, and 90-140 word executive outreach. Use their structure and constraints without treating them as mandatory content or substituting stock wording for evidence-based writing.

Select a review contract appropriate to the applicant and channel. `workflow-template:applicant-review` requires schemaVersion 2 criterion findings, rationale, evidence references, and distinct candidate/reader review perspectives (schema field `lenses` unchanged). List relevant brief artifacts and their digests as dependencies. `artifact record-review` stores the external judgment; readiness reports missing, stale, flagged, or insufficient evidence without turning it into an eligibility gate. Executive review is an optional variant. Apply meaningful role language with supported claims; literal keyword absence alone is not proof of ATS rejection.

Use `guidance --input -` for read-only gap suggestions and `guidance record --input -` only for authorized durable answers. See [adaptive guidance](guidance.md). Context/readiness include relevant saved briefs; shared campaign briefs require explicit selection.

Operational measurement is explicit and disposable:

- `run record --input -` stores a whitelisted timing/error/digest manifest under `.nextstep/runs/`.
- `run list` returns compact summaries.

Never include prompts, responses, messages, document content, credentials, secrets, or tokens. The CLI rejects unknown and content-bearing fields.
