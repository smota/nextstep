# ADR 010: advisory applicant guidance

Status: accepted for implementation by the approved adaptive-applicant-guidance plan.

## Decision

External agents own questions, coaching, research, and prose judgments. The engine exposes bounded context coverage, a finite set of explicit gap rules, and an advisory `guidance` projection. It evaluates supplied observations rather than attempting to interpret raw prose. Guidance can be transient without a vault or registered subject.

The same projection travels with context and readiness. Candidate preferences and deliberate career trade-offs take precedence over optional executive templates. Technical failures route to repair, employer unknowns to research, and applicant-owned choices to optional questions. Known and skipped answers suppress repeats until relevant dependencies change. Hypotheses remain hypotheses.

## Consequences

No model runtime, provider SDK, universal coaching taxonomy, arbitrary rule evaluator, or mandatory workflow is added. A finite rule list and versioned JSON input make behavior portable and testable. A client's failure to follow the portable interaction policy cannot be prevented by the domain engine and must be reported separately from contract conformance.
