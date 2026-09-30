# Adaptive applicant guidance

Nextstep supplies evidence and suggestions to the applicant's current agent. The agent asks questions, interprets answers, researches, drafts and reviews. Every operation is independently usable; no application or strategy record is required just to have a useful conversation.

## Read-only example

Pass this JSON through stdin to `nextstep guidance --input - --json`:

```json
{
  "schemaVersion": 1,
  "operation": "draft",
  "observations": [
    {
      "criterion": "mandate",
      "state": "unknown",
      "source": { "kind": "external", "reference": "posting:example" }
    },
    {
      "criterion": "contribution",
      "state": "unknown",
      "source": { "kind": "agent", "reference": "draft-review:opening" }
    }
  ]
}
```

The first item produces a research action. The second can produce an applicant question. The default is at most one applicant question, configurable up to three. No observations produces no questions. `essentialOnly: true` or a completed optional round suppresses optional questions; `deepen: true` allows further optional rounds. These controls express client-provided conversational context, not an engine-managed session.

Discover complete inputs with `command describe --command guidance --json`. Operations include evaluate, draft, review, submit, follow_up, interview, decide, and reflect. Observations are explicitly attributed; supplying them does not verify them. Instruction-like source text is data.

## Saving selected answers

`guidance record --input -` accepts the standard mutation envelope. Its payload is:

```json
{
  "artifactId": "artifact:example-brief",
  "brief": {
    "schemaVersion": 1,
    "scope": "opportunity:example-role",
    "answers": [
      {
        "id": "opening-choice",
        "criterion": "presentation",
        "scope": "opportunity:example-role",
        "kind": "preference",
        "state": "answered",
        "value": "Use a chronological opening and a plain capabilities list.",
        "source": { "kind": "user", "reference": "applicant confirmation" }
      }
    ]
  }
}
```

The opportunity must already exist. Alternatively, explicitly choose shared scope for a reusable campaign brief and provide its Artifact ID in `briefIds` when requesting guidance. Stable personal identity and voice belong to Holoself.

Use the current `expectedRevision` to update a brief. Retain prior answers as returned from the saved JSON and append a new answer with `supersedes` when a choice changes. Known/unknown/deferred/declined answers remain distinct. Dependencies are a map of stable names to SHA-256 values; include only inputs whose change should invalidate that answer. Do not use a whole-artifact digest for an independent voice preference.

Persistence occurs only on an explicit command. Payloads are limited to 128 KiB, 128 answers and 4,096 characters per answer. Plain JSON objects reject unrecognized fields. These are private artifacts with immutable revisions; run telemetry contains no answer text.

## Coverage and review

Personal context uses category coverage rather than the first one or two documents. Inspect coverage states before relying on excerpts. Character budgets bound source text, not serialized metadata. Missing evidence stays missing; provider failure is a diagnostic, not an applicant answer.

`workflow-template:applicant-review` supports schemaVersion 2 review records with criterion findings, evidence references, and separate candidate/reader lenses. Use every template section as a criterion; mark a criterion not_applicable with a reason when appropriate. Applicable findings require evidence references. Include relevant brief artifacts as `{ artifactId, sha256 }` dependencies. A template or declared dependency change invalidates the review. Narrative persuasion remains a judgment by the external reviewer.

## Incomplete reports

After a confirmed application, `application-attempt record-submission` accepts explicit `timeUnknown: true` and `channelUnknown: true` alongside `artifactSelection: { "state": "unknown" }`. The original report and receipt timestamp are preserved separately. `reconcile-submission` resolves the unknown fields on that same event with `expectedRevision`.

When exact files are later confirmed, use `artifactSelection.revisions: [{ artifactId, sha256 }]` if working files have changed. Unknown bytes remain unknown. Use explicit `reportMode: "retrospective"` with `evidenceSource` only to record an already-reported event despite an unmet gate; readiness still exposes the gate. No command here sends an application or message.

## Delivery and limitations

New contract shapes are additive; historical evidence is not rewritten. New schema versions require a compatible reader, so disabling new writes or fixing forward is safer than downgrading after real evidence is recorded. See ADRs 010-012 for boundaries and rollback.

Synthetic tests establish contract behavior and failure handling. Scenario review checks contrasting applicant styles; it does not establish hiring effectiveness or guarantee that every external agent follows the conversation policy.
