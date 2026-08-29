# Workflow support

Use immutable product views to reduce user reading and agent orchestration without forcing a workflow.

- `workflow templates` lists compact support-document, user-answer, and quality-check shapes.
- `workflow template --id <workflow-template:id>` returns one complete section contract.
- `readiness --intent analyze|outreach|package|submit|close --subject <typed-id>` reports current state, required evidence, active gates, and validation scope. It is advisory and never authorizes a mutation.
- `application submission-plan` is the more detailed Application-specific artifact and gate view.

The external agent still researches, reasons, drafts, selects an action, and asks for any missing user confirmation. Nextstep never fills a template with generated prose.

Artifact contracts are available for executive CVs, company-problem-first letters, exact bounded form answers, and 90-140 word executive outreach. Use their structure and constraints without treating them as mandatory content or substituting stock wording for evidence-based writing.

Operational measurement is explicit and disposable:

- `run record --input -` stores a whitelisted timing/error/digest manifest under `.nextstep/runs/`.
- `run list` returns compact summaries.

Never include prompts, responses, messages, document content, credentials, secrets, or tokens. The CLI rejects unknown and content-bearing fields.
