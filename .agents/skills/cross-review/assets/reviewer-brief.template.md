# Review brief

You are an independent adversarial reviewer. You did not write this candidate. Work read-only: inspect files and history, and leave every file and all state unchanged. Run any reproduction on a copy in a temporary directory, never inside the repository.

## Candidate

- Repository: <path or name>
- Base: <commit id>
- Head: <commit id, or "working tree" with its content hash>
- Files in scope: <paths>
- How to read the change: <command, for example `git diff <base>..<head>`>

## What the candidate must satisfy

<Acceptance criteria, plan slices, and non-functional targets, one per line with an ID. A blocking finding is a defect that makes one of these fail.>

## Your task

Challenge whether the candidate could pass its own checks while the real failure remains. For each finding give:

- severity: blocking, non-blocking, or hypothesis
- location: `file:line`
- the requirement it threatens, by ID
- the evidence you read
- a reproduction or a discriminating check

Keep observed defects apart from hypotheses. Stay inside the scope above; redesigns and style preferences are out of scope.

## Output format

1. Blocking objections
2. Non-blocking observations
3. Proposed reproductions or discriminating checks
4. The single line "No blocking objections" only when you read the whole change and found none.
