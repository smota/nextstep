# Adaptive applicant guidance: implementation report

Implementation qualified on 2026-09-30 on branch `codex/adaptive-applicant-guidance`. This report records the qualification snapshot before delivery; Git history records subsequent publication. Implementation follows [the approved plan](adaptive-applicant-guidance.md); usage is in [adaptive guidance](../adaptive-guidance.md).

## Delivered

- Personal context allocates its text budget across identity, preferences, evidence, positioning and examples, with explicit coverage diagnostics. Holoself remains an external installed CLI.
- Read-only `guidance` suggests bounded questions or research/repair actions. Known answers and skips are reused until relevant dependencies change. Agents retain conversation, interpretation and drafting responsibility.
- Explicit `guidance record` saves scoped, versioned brief Artifacts through existing transactions. No new canonical collection or implicit application/strategy creation.
- Detailed reviews preserve criterion evidence and separate candidate/reader lenses. Artifact, template and declared dependency changes invalidate freshness. Removed templates degrade to advisory `unknown_template`.
- Submission reports support unknown occurrence time, channel and transmitted artifacts. Reconciliation preserves the original report and exact historical bytes. Explicit retrospective reports preserve unmet gate deviations without changing readiness.
- Portable skills, command discovery, examples and ADRs 010–012 document the contracts and rollback boundaries. No model execution was added to Nextstep.

## Validation

| Check | Result |
|---|---|
| Windows, Node 26.10.0, `npm test` | 150 tests: 149 passed; 1 optional real Skills Manager integration test skipped; 0 failed |
| Linux/WSL, Node 26.8.1, portable CLI and new feature suites | 84 passed; 0 failed |
| Initial full Linux suite | 98 passed, 47 failed, 1 skipped: existing linked-installation tests invoke the Windows-only integration boundary. Full Linux suite is not green. |
| `npm run check` | Passed |
| `git diff --check` | Passed |
| Guidance 128-entry loaded-input benchmark, first full run | Windows p95 0.63 ms; Linux p95 0.77 ms, below 100 ms target |
| Empty guidance CLI including startup, 10 Windows runs | p95 62.68 ms; excludes Holoself/model latency |
| `npm run skills:update`, final run | Five library copies verified, all `changed: false`; no active deployments reported |

Portable Linux command: `node --test test/applicant-scenarios.test.mjs test/artifact-review-evidence.test.mjs test/context-selection.test.mjs test/guidance*.test.mjs test/holoself-context.test.mjs test/submission-evidence.test.mjs test/cli.test.mjs`.

Skills distribution digest: `5d4ad5f6670a5250a78bf2fd655330260452df53b397b0c86501269a285a815f`. Library hashes were verified through the supported updater. Empty deployment lists mean there were no deployed copies to verify; host discovery/activation was not demonstrated. Existing installation ownership was preserved.

Tests include read-only/no-vault operation, dry-run, scoped restart reuse, stale revision rejection, failure rollback, historical snapshot selection, unknown-event counts, retrospective gate deviations, and review freshness. Fixtures are synthetic. No private instance was changed.

## Independent cross-review

Author: Codex. Reviewer: Claude Code 2.1.263, substantive model `claude-sonnet-5`, different harness and vendor. Two rounds, both exit 0. Tools/MCP/customizations disabled; brief supplied on stdin; no session persistence. SHA-256 manifests covered every modified/untracked candidate file, with zero content changes during each review.

| Round | Candidate manifest digest | Session | Duration | CLI-reported cost |
|---|---|---|---|---|
| 1 | `9d52bb1cdcde7b739979b3fccc5158a7570077b4d4b9acb70f5bdf9c27767b26` | `d700fa76-3d98-4b91-8a45-bb524665aa20` | 470.1 s | USD 1.289112 |
| 2 | `682fd1c4f9864d853a87fafec19a6f269bf067c4cb0e05dc2e264795112597bd` | `d8395ae7-16a1-415f-81e4-7e770606e4d8` | 37.3 s | USD 0.110994 |

Briefs and manifest evidence were saved outside the repository under the task's temporary review directory. Invocation used `claude -p --tools '' --strict-mcp-config --safe-mode --permission-mode dontAsk --no-session-persistence --output-format json`; confirmation used `--effort medium`. Raw provider output and internal reasoning are not repository artifacts. CLI-reported costs include auxiliary model activity and are not a billing statement.

| Finding | Disposition |
|---|---|
| F1: context/readiness load the model twice | Fixed by passing the loaded model to guidance. Reviewer confirmed. |
| F2: removed templates crash advisory reads | Fixed with `unknown_template`; pending working-file changes also return stale. Regression passed; reviewer confirmed. |
| F3: weaker executive evidence guardrails | Restored concrete responsibility/outcome, scale and capability grounding. Applicant-chosen structure remains intentional. Reviewer accepted. |
| F4: illustrations do not prove prose-error detection; coverage concern | Scope clarified: external review supplies structured observations. Added authority/claim routing test and a test covering all 11 finite criteria. Both platforms passed. Confirmation reviewer did not receive `guidance.test.mjs`, so its all-criteria coverage concern was not independently closed. Author disposition is supported by `all finite criteria expose actionable bounded suggestions` in that file. |
| F5: context action lacks question text | Added an actionable diagnostic question; reviewer confirmed. |
| F6: Holoself errors absent from discovery taxonomy | Added the six external-adapter error codes; reviewer confirmed. The untrusted-override behavior itself predates this change. |
| F7: duplicate PATH casing and quoted delimiter directories | Fixed discovery and added a synthetic regression; reviewer confirmed. |

The final report and plan status update postdate the reviewed candidate; implementation logic is unchanged from round 2; delivery removed an extra blank line at the end of a test fixture. Review does not certify future edits or replace user acceptance.

## Headhunter scenario review

Six hand-written baseline/revised pairs illustrate early career, experienced IC, technical specialist, people manager, executive and deliberate career changer. Claude found the early-career, IC, specialist and career-changer revisions appropriately grounded. It confirmed that the outreach revision removes assumed hiring authority and a fabricated submission. It flagged the executive opening as generic; the final version now leads with establishing/leading teams and the supplied platform/engineering/operations evidence, without invented metrics.

These examples and structured-observation tests establish no automatic prose detection, hiring effectiveness, or offer-rate improvement. External agents must still inspect claims, actual channel constraints and applicant intent. Real-user experience measurements remain future evaluation work.
