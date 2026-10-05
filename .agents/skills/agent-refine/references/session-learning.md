# Session learning

Use this reference for the default, `session`, and `session guidance` modes.

## Establish evidence coverage

Declare one coverage state before extracting lessons:

- `complete`: the harness exposes the full session relevant to the current task.
- `compacted`: earlier turns are represented by a summary rather than verbatim context.
- `partial`: only part of the conversation or runtime instruction set is available.
- `unavailable`: no usable session history is exposed.

Name the visible evidence classes: user instructions and corrections, agent decisions, tool outcomes,
runtime instructions, applicable project policy, and unresolved disagreements. A summary is evidence of
what it states, not evidence of omitted wording or events.

## Extract candidate lessons

Look for behavior-changing evidence:

- repeated user corrections or preferences;
- a constraint that materially shaped successful work;
- a failure caused by missing, unclear, conflicting, or over-broad instructions;
- an authority, safety, provenance, privacy, or verification boundary;
- a stable division of responsibility between canonical policy, adapters, references, and mechanisms;
- a decision rule that would apply again across more than the current task.

Keep the evidence paraphrased and minimal. Do not place raw conversation excerpts, personal data, secrets,
or temporary state into a proposed repository change.

## Qualify each candidate

Assess every candidate against all of these dimensions:

| Dimension | Question |
|---|---|
| Durability | Is this expected to remain valid in future work? |
| Breadth | Does it affect multiple tasks within the proposed scope? |
| Consequence | Would omitting it change authority, safety, quality, or a material decision? |
| Scope | Does it belong to this subsystem, project, host, operator, or provider? |
| Novelty | Is the behavior already covered semantically? |
| Discoverability | Can an agent obtain the fact cheaply from code, configuration, or help output? |
| Generalization | Does the evidence support a rule rather than describe one episode? |
| Effect | Would the proposed wording change model behavior rather than restate a default? |

Strong consequence can justify a guardrail after one incident, but state that reasoning explicitly.
Uncertain recurrence or scope remains an open question for the operator.

## Classify and route

Assign one primary classification and destination:

| Classification | Destination |
|---|---|
| Stable principle or guardrail | Canonical policy for the narrowest valid scope |
| Stable branch-specific guidance | Referenced document behind a precise conditional pointer |
| Runtime-specific requirement | The affected runtime adapter or configured runtime layer |
| Decision and rationale | ADR or maintained documentation |
| Enforceable or cheaply discoverable operation | Script, configuration, manifest, CI, or tool help |
| Temporary task fact | Issue, plan, work log, or no persistent destination |
| Already covered | No change; optionally sharpen a weak pointer |
| Uncertain or conflicting | Operator decision before proposing text |

Do not create a non-policy destination as a side effect of this review. Recommend it and keep it outside
the policy patch unless the user separately asks for that artifact.

## Report

For each candidate include:

- concise lesson;
- paraphrased evidence and source class;
- qualification result;
- intended scope;
- current semantic coverage;
- classification and destination;
- proposed wording when policy is warranted;
- confidence and open question.

Also list rejected candidates that could otherwise be mistaken for policy, especially commands, versions,
paths, implementation status, one-off recovery steps, and facts already expressed by the environment.

The session analysis is complete when every material correction, constraint, conflict, and outcome visible
in the declared coverage is either mapped to a candidate, mapped to existing policy, or explicitly excluded.
