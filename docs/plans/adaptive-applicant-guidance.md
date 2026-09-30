# Plan: adaptive applicant guidance

Status: implemented locally; qualification results and limitations are recorded in [the implementation report](adaptive-applicant-guidance-implementation.md).
Date: 2026-09-30.

## Goal and acceptance

Help applicants make deliberate choices and produce credible, appropriate applications through a reusable CLI contract and optional conversation with their existing agent. Questions should improve a decision or deliverable, preserve the applicant's voice, and stop when they stop adding value.

Nextstep remains a local CLI and domain engine. External agents conduct the conversation, research employers, interpret answers, coach, draft, and render. Nextstep supplies bounded context, evidence gaps, reusable guidance contracts, explicit persistence, and evidence-preserving lifecycle operations. The consultations used to prepare this plan are external engineering work, not a capability to embed in Nextstep.

Acceptance criteria:

- Relevant personal context is selected by coverage and budget, with missing, omitted, and truncated material distinguished.
- A candidate can request a single answer, a CV revision, networking help, or guidance through an application without entering a mandatory sequence.
- Known answers and applicable preferences are reused. Declining optional coaching is respected. Zero questions is valid.
- Questions target a consequential uncertainty and identify the appropriate answerer: applicant, researcher, employer, or integration maintainer.
- Guidance adapts to career direction, channel, audience, evidence, and explicit preferences. Executive style is never the universal default.
- Durable answers have explicit scope and provenance; the product does not create another canonical personal profile alongside Holoself.
- Semantic review explains its findings and remains separate from structural QA, visual QA, applicant acceptance, and transmission.
- A confirmed submission can be recorded with unknown occurrence time, channel, or artifacts and reconciled without changing transmitted bytes or inventing facts.
- Implementation passes synthetic regression scenarios, existing tests, command discovery checks, and verified skill library/deployment hashes.

## Blocking questions

None blocking for this plan. Interactive guidance is interpreted as conversation through the current agent, backed by the CLI. A native terminal wizard, standalone interface, or embedded model runtime would require a separate scope decision.

## Evidence and diagnosis

The motivating conversations concern one applicant across five opportunities. They establish repeated context and workflow failures; they do not establish universal preferences or hiring effectiveness.

| Current evidence | Consequence for this plan |
|---|---|
| `src/candidate-profile.mjs`: application selection excludes voice; drafting excludes positioning/preferences; selection uses an ordered document-count cutoff. | Fix selection coverage before asking more questions. |
| `src/commands.mjs`: small/standard budgets select one/two personal documents respectively. | Adding another path to a list cannot by itself fix missing context. |
| `src/holoself.mjs`: discovery and invocation are isolated behind a global CLI adapter; context failures produce degraded results. | Improve diagnostics and exercise launcher discovery using synthetic installations. Preserve the external-tool boundary. |
| `catalog/workflow-templates.json`: channel manifest, decision brief, application formats, and recruiter review already exist. | Reuse these contracts; do not create a parallel coaching framework. |
| Executive CV guidance favors results/scale in the opening and a flat capability list. | Make presentation and opening style adaptable to the selected profile and applicant preference. |
| `src/commands.mjs`: reviews store a pass/flag, lens, notes, and artifact digest; reviews are keyed by template ID. | Preserve separate criterion/lens findings within a review; bind them to relevant context as well as artifact content. |
| `src/commands.mjs`: submission requires occurrence time; reconciliation only resolves unknown artifact selection. | Extend evidence semantics and all affected projections together. |
| `docs/architecture.md`, `docs/data-layout.md`, `AGENTS.md`: composable workflows, eight canonical collections, external agents, explicit mutations. | Reuse artifacts and existing records; avoid a new conversation/session database. |
| `docs/skill-distribution.md`: product sources are distributed through Skills Manager with hash verification. | Verify source-to-library-to-deployment delivery in the final implementation slice. |

Source investigation was read-only. No private applicant facts or conversation transcripts are included in this product plan.

## Advisor consultation and synthesis

Two distinct external consultations received the same anonymized evidence brief, with separate role instructions, no tools, no browsing, and no implementation authority:

- **Grok, executive coach:** Grok CLI 1.0.41; response reported `grok-4.7-build`; session `01a0f161-a3f8-7570-a21d-d14b10019069`.
- **Claude, headhunter:** Claude Code 2.1.263; substantive response reported `claude-sonnet-5`; session `d90e4598-5374-4621-976e-ead48c995e3b`. An earlier plan-mode attempt returned an intention to answer rather than advice; it was excluded and retried with a direct-response instruction.

AgentFlow classified the proposed public-contract/data changes as council complexity. Its generated helper defaults were not additional participants: the actual advisory seats were the two roles requested by the user. This document is the accountable planner's synthesis, not an independent implementation audit or an acceptance receipt.

| Advice or objection | Disposition |
|---|---|
| Both: one executive's style must not become universal coaching policy. | Accepted. Only neutral evidence/channel/intent constraints enter deterministic logic. Style is applicant-scoped; executive templates remain optional. |
| Grok: repair context before interviewing the applicant; avoid a large question ontology and another answer database. | Accepted. Context first; small finite guidance rules; existing Artifact storage for optional durable briefs. No extensible rules DSL or coaching score. |
| Grok: intent briefs and employer-challenge narratives must not be mandatory stages. | Accepted. Entry at any deliverable; optional brief; employer questions only when relevant to the requested artifact. |
| Claude: move mandate and channel checks earlier; strengthen review before expanding coaching. | Accepted. The first behavioral slice improves those checks and reviews in the skills/catalog before durable guidance expansion. |
| Claude: require additional real applicants before a generalized coaching engine. | Accepted as a constraint on future generalization, not a blocker for objective context/evidence fixes. Use diverse synthetic cases now; make no cross-applicant effectiveness claim. A broader coaching taxonomy needs separate real-user research and consent. |
| Claude: ask again whether to retain a saved table preference on regeneration. | Rejected as a default. Apply a valid preference silently; ask only when it conflicts with a changed requirement. |
| Advisors: rendering was contrary to a private preference. | Corrected. The actual preference made visual QA opt-in. Preserve that choice; this plan adds no renderer or mandatory visual review. |
| Advisors: engine should detect a missing persuasive argument. | Narrowed. It can detect a missing declared review/brief field. Whether an argument exists in prose or persuades a reader is external semantic judgment. |

Confidence is high in the context-selection defect and current evidence limitations, moderate in the proposed interaction design, and unproven for hiring outcomes. The initial overgeneralization objection is resolved by the narrower design; broader coaching automation remains out of scope.

## Applicant experience

The agent follows a short loop: understand the requested outcome, retrieve relevant context, resolve consequential gaps, create or refine the requested work, then review it against that intent. This is a reusable conversation pattern, not a required lifecycle.

| Moment and trigger | Useful question or action | Effect |
|---|---|---|
| Exploring a role; stated career goal conflicts with known scope | “Would this move still interest you without people or budget ownership?” | Clarify a deliberate trade-off; preserve the applicant's choice to explore. |
| Employer authority is absent from the posting | Research it or prepare a recruiter question: “What decisions and resources does this role own?” | Keep employer uncertainty separate from applicant intent. Do not ask the applicant to invent the answer. |
| Drafting; distinctive contribution is unclear | “What should the reader understand about your contribution after the first paragraph?” | Refine the opening using supported evidence and the applicant's chosen style. |
| A consequential claim has weak attribution | “What did you personally do, and what changed as a result?” | Separate individual contribution, team work, aspiration, and measured results. |
| The actual channel is inaccessible or unknown | “Does the application accept a letter, or ask for a short motivation answer?” | Avoid producing the wrong deliverable. Research accessible requirements first. |
| Outreach; relationship context is missing | “How do you know this person, and what would you like the conversation to achieve?” | Adapt warmth, language, and request without assuming hiring authority. |
| Review; applicant's prior feedback conflicts with the draft | Show the mismatch and offer a targeted revision. | Apply existing guidance without repeating the original question. |
| Applicant reports applying but details are incomplete | Record the confirmed fact when authorized; optionally ask which detail they remember. | Missing metadata does not erase a real event or force invented dates. |
| Interview preparation; a likely question lacks a usable example | “Which example could you explain most concretely under follow-up questions?” | Prepare credible evidence rather than a polished but fragile story. |
| Offer or next-step decision; a previously important condition is unresolved | “Has this opportunity met the conditions you said mattered?” | Revisit the applicant's own criteria, not a generic score. |
| Outcome reflection is requested | “What did you learn that should change the next application?” | Propose a scoped lesson; do not infer rejection causes or automatically promote preferences. |

Interaction policy:

- Default to one high-value question; group up to three tightly related questions when useful.
- One optional clarification round per requested deliverable by default. Further optional rounds require the applicant to engage in deeper refinement; new essential ambiguity may still be surfaced.
- Explain the consequence briefly, without exposing internal schema terminology.
- Always allow free text, “unknown,” “skip,” and “use your judgment” where the choice is legitimately delegable. No answer is never approval.
- Use standing conversational preferences such as “ask only essential questions” or “explore this with me.” Do not add engine-level quick/standard/deep coaching modes in v1; existing context budgets remain a separate concept.
- Reuse known answers. A skipped item stays skipped for its scope; only a relevant dependency change can make it eligible again, and the agent explains that change.
- Do not restart a coaching sequence on every revision. An unrelated opportunity edit does not invalidate a voice or formatting preference.
- Technical context failure triggers diagnosis, not a new interview to reconstruct missing personal data. Continue independent work with declared gaps.
- Recommendations do not become pursuit decisions. Analysis creates neither an ApplicationAttempt nor a Strategy.
- Stable preferences may be proposed for Holoself through its public workflow when the user wants durable reuse. No automatic personal-memory writes.

## Reusable design

### A. Coverage-aware personal context

Replace positional document-count selection with bounded coverage of relevant categories: identity/intent, voice/preferences, career/claims, positioning, and task-specific evidence. Relevance varies by requested operation; no requirement exists that every category contain data.

Preserve source identifiers, original excerpts, and truncation indicators. Return a coverage manifest distinguishing `included`, `missing_at_source`, `omitted_by_budget`, `truncated`, and `dependency_unavailable`. Do not imply that selecting a document makes all its evidence visible. Use fair allocation across relevant categories under a total character budget rather than filling the budget from the first document. No LLM summarizer belongs in this path.

Retain named budgets and bound the personal-context payload to 1,200 / 3,600 / 48,000 characters for small / standard / deep initially, matching current maximum text allocations. Explicitly test whether the small budget is adequate for a task; report partial coverage instead of quietly increasing it. Offer a next retrieval action when an essential excerpt is absent.

Adapter diagnostics identify discovery, timeout, malformed-response, and version/contract problems. Preserve current native-card semantics: the thin fallback is not a full voice/story repository, and a reachable but failing Holoself installation is not silently replaced.

### B. Small advisory guidance contract

Proposed new read-only command: `nextstep guidance --input - --json`. Exact schema is frozen in S3 before implementation. It accepts an operation, optional existing subject, bounded supplied observations, and scoped answer references. A transient request without a subject is valid and causes no persistent writes.

Use existing workflow-template contracts plus at most twelve explicit v1 gap rules. No expression evaluator, plugin engine, archetype taxonomy, or hiring-probability score. Supported operations cover evaluating, drafting, reviewing, recording a submission, following up, preparing an interview, and deciding. They do not imply an execution order.

Each returned item contains a stable criterion ID, reason code, source/dependency references, suggested answerer, consequence, optional question suggestion, and whether the requested action actually depends on it. A missing recruiter response, a broken CLI, and an applicant preference must produce different actions.

The engine ranks explicit gaps and conflicts, caps question suggestions at three, and can return zero. It never reads raw prose and claims to have assessed persuasion. External agents may supply observations, clearly labeled as agent judgments with evidence; those are not silently elevated to verified facts.

Reuse the same projection in context/readiness responses where appropriate. Share one implementation rather than duplicating scheduling or gap logic. Existing commands remain independently usable.

### C. Scoped persistence without a conversation database

Start S3 with caller-supplied answers and existing artifacts. Add optional durable continuity in S4 through a `guidance_brief` Artifact using a versioned JSON payload. This is a private working artifact with immutable revisions; it is not an agent session, task queue, transcript, or runtime record. It need not exist for ordinary conversation.

Proposed explicit mutation: `nextstep guidance record --input - [--dry-run] --json`. It atomically writes or revises the bounded brief and its Artifact record using the existing mutation engine. It does not create a Company, Opportunity, ApplicationAttempt, Person, or Strategy as a side effect. Use an existing subject, or explicitly create a shared brief when no subject is needed.

Store only selected answers and decisions worth preserving: criterion/key, value or unknown, epistemic type, source, scope, recorded time, known occurrence precision when relevant, dependency digests, and a superseded reference. Epistemic types distinguish fact, preference, hypothesis, and decision; answer state distinguishes answered, unknown, deferred, and declined. These describe meaning, not execution state.

Use a maximum 128 KiB mutation payload, 128 entries per brief, and 4,096 characters per answer initially. Reject unknown fields and invalid cross-vault references. Validate these limits in S3/S4, not only in prose.

Scope resolution:

- Immediate conversational choices are ephemeral unless the existing task authorization includes recording them or the applicant asks to remember them.
- Opportunity, contact, and artifact choices use explicitly related briefs. An application-specific relocation choice does not become a global preference.
- Campaign reuse requires an explicit brief reference; it does not require a Strategy activation.
- Stable identity/voice remains in Holoself. A Nextstep brief may carry an attributed source reference and a scoped exception, not a competing permanent self profile.
- Explicit narrower-scope preferences take precedence for that scope. Factual conflicts are surfaced rather than resolved by “latest wins.”
- Skip suppression uses criterion plus scope plus relevant dependency digest. A different artifact digest alone must not reset every preference question.

### D. Adaptable drafting and review

General artifact contracts cover audience, channel, claim grounding, candidate intent, and requested format. Executive-specific contracts remain selected variants, not defaults imposed on all applicants. Existing template IDs are not renamed through aliases.

Opening style, first/third person, capability tables, letter length, and outreach tone are preferences constrained by the channel. Business-oriented letters are appropriate when requested; a motivation form answers its exact prompt. Articles and projects can support a perspective without becoming evidence of delivered employer outcomes.

Strengthen `artifact record-review` with criterion findings, applicability, short rationale, evidence references, distinct lens findings, and digests for the artifact and relevant brief/template inputs. Record applicant acceptance separately from agent review. An assertion of `passed` is not itself proof of persuasive quality.

Avoid new mandatory peer calls or models in the product. External agents perform semantic review; deterministic tests validate structure, source references, freshness, and required evidence fields. Existing historical review records remain readable, but are reported as lacking criterion-level evidence for a newly selected review contract; never silently upgrade them to a detailed pass.

### E. Honest incomplete submission evidence

Evolve `application-attempt record-submission` and `reconcile-submission` around one event identity and explicit knowledge states. Keep existing valid dated calls working without compatibility aliases. For new undated calls require explicit unknown time rather than interpreting an omitted date as unknown accidentally. Channel similarly distinguishes known and unknown; artifact selection retains its existing three states.

Keep the applicant-reported event, receipt time, and any known occurrence time separate. Generate event identity independently of an unknown date. Record the report source. An undated confirmed submission updates the application lifecycle while remaining outside occurrence-date cohorts; portfolio views expose undated confirmed counts rather than hiding them.

Reconciliation fills unknown fields with explicit evidence and optimistic revision checks. It preserves original report provenance and append-only audit history, updates projections on the same event, and does not double-count it. Previously known contradictory values require an explicit correction path/reason, not generic reconciliation.

For artifacts confirmed after a working-file revision, select the actual historical snapshot/digest. Never equate the current working file with what was sent. If exact bytes cannot be established, preserve `unknown`.

The engine's strategy-gated preparation/recording rules must not conceal an event the user says already happened. Specify an explicit retrospective-report path in the same semantic operation: it records the real event and any unmet gate as a deviation, without authorizing an external action or bypassing pre-action readiness. This distinction requires an ADR and targeted review in S6.

## Assumptions

1. **Data:** eight canonical collections remain. New continuity uses bounded private artifacts, not a ninth conversation collection. Inputs are untrusted UTF-8 JSON with explicit source references; malformed input fails without writes.
2. **Failure:** context dependencies may be absent, fail, or truncate. Return diagnostic states and continue independent work; never fabricate answers or silently turn source failure into candidate uncertainty.
3. **Boundaries:** external agents own semantic judgment and interaction. Holoself remains external. No model calls, provider SDKs, browser UI, or native wizard are added to Nextstep.
4. **State:** durable operations use existing atomic commits, idempotency, expected revisions, and immutable snapshots. Ephemeral requests remain lock-free. No answer persistence or scope promotion occurs merely because a question was answered.
5. **Environment:** preserve declared Node >=20 support and Windows/PowerShell use; test the relevant paths on Windows and Linux. Provider availability is not required by product tests.
6. **Scope:** application guidance spans independent moments through interview/decision/reflection, but no scheduling engine, automated outreach, psychometric assessment, job matching service, or outcome-causality claim is introduced.
7. **Testing:** synthetic fixtures prove contracts and failure behavior. External-agent scenario reviews assess experience; they cannot prove hiring effectiveness or universal adherence by every agent host.

## Vertical slices

Sizes are relative effort, not calendar estimates. Each slice is separately reviewable and mergeable.

| ID | Observable behavior | Acceptance check | Test level | Size | Blast radius | Depends on |
|---|---|---|---|---|---|---|
| S1 | Useful personal context survives every budget; dependency failures are diagnosable. | Category coverage, bounded output, source/truncation flags, discovery/error fixtures. | Unit + CLI integration | M | Context and Holoself adapter | None |
| S2 | Existing agents ask fewer, better questions and draft/review against applicant intent and actual channel. | Diverse scenario rubric; repeated preferences applied; analysis/networking work without an attempt; zero-question path. | Catalog/skill contracts + semantic scenario review | M | Skills and workflow templates | S1 |
| S3 | Reusable read-only guidance works with an existing subject or transient supplied context. | Stable reason codes, correct answerer, at most three suggestions, no implicit writes, bounded input, changed-dependency behavior. | Pure unit + CLI integration | M | New advisory CLI surface | S2 |
| S4 | Explicitly saved scoped answers and skips survive restart and can be revised safely. | Cross-session replay, scope precedence, conflict visibility, dry-run, stale revision, atomic failure and snapshot tests. | Domain + storage integration | M | Brief artifacts and semantic mutation | S3 |
| S5 | Reviews show criterion evidence and become stale when relevant inputs change. | Unsupported pass rejected for new contract; multiple lenses preserved; old reviews readable; irrelevant changes do not invalidate. | Domain + CLI + semantic fixtures | M | Review metadata/readiness | S2; S4 for persisted brief digests |
| S6 | Incomplete confirmed submissions are recorded and reconciled honestly. | Unknown/date/date-time matrix; historical artifact selection; idempotency; cohort counts; retrospective gate deviation; crash rollback. | Domain + integration | L | Submission model, projections, strategy evaluation | S1; independent of S3-S5 |
| S7 | The improvement is verified end to end and actually reaches deployed skills. | Full test/check results, synthetic journey review, portable contract checks, distribution hashes, drift-safe update. | System + semantic + distribution | M | Product/deployed skills | S1-S6 |

## Order and rationale

S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7 is the default single-writer order. S1 removes a confirmed root cause. S2 proves interaction value with existing mechanisms before new APIs. S3 establishes the smallest read-only contract before S4 adds persistence. S5 uses the settled brief semantics. S6 is isolated because it has the widest evidence/migration risk; it may be delivered after S1 as an independent workstream if separately authorized and isolated. S7 proves integration and deployed availability.

After S2, review whether guidance can remain entirely in skills plus context/readiness. Ship S3 only if stable, reusable gap/suppression behavior across clients is still needed. After S3, require a restart/cross-client continuity scenario that existing artifacts cannot handle cleanly before introducing S4's dedicated mutation. These are scope checks, not excuses to leave the requested interactive experience unfinished.

## Placement and dependencies

| Module | Layer | Import direction | Boundary rationale |
|---|---|---|---|
| `src/candidate-profile.mjs`, proposed `src/context-selection.mjs` | Adapter + pure selection policy | Adapter passes plain source records to pure policy. | Test category allocation independently of Holoself/processes. |
| `src/holoself.mjs` | External-tool adapter | Process/OS details remain here; callers receive structured results/errors. | Provider installation changes must not leak into domain logic. |
| `catalog/workflow-templates.json`, `src/workflow-templates.mjs` | Public reference contracts + loader | Guidance consumes validated contracts. | Reuse current catalog; finite rule types, no executable user expressions. |
| Proposed `src/guidance.mjs` | Pure use-case policy | Plain context/brief/requirements in; gap/recommendation records out. No fs, process, storage, or provider imports. | Deterministic and independently testable. |
| Proposed `src/guidance-brief.mjs` | Domain validation | Pure brief normalization/scope/dependency validation. | Keep private data validation separate from dialogue rendering. |
| `src/commands.mjs` | Existing orchestration layer | Calls pure policy and existing storage adapters. | Adds explicit brief and evidence operations without a whole-repo rewrite. |
| `src/model.mjs`, `src/storage.mjs` | Existing model/storage boundary | Validate typed changes; commit atomically through existing engine. | Preserve relational consistency and snapshots. |
| `src/cli.mjs`, `src/command-catalog.mjs` | CLI adapter/public contract | Parse/validate and dispatch inward to commands. | All new names and payloads discoverable; useful typed errors. |
| `skills/nxt-*`, `skills/references/*` | External-client instructions | Consume CLI contracts. Engine never imports or executes a skill. | Interaction varies by host while domain evidence stays portable. |

Do not combine this work with a general refactor of `commands.mjs`, framework adoption, or dependency upgrades.

## Non-functional checks

| Area | Target or decision |
|---|---|
| Security | Validate bounded input, typed subject links, path containment, and plain JSON; no executable rule strings or provider execution. Test malicious paths and instruction-like source text as data. |
| Privacy | Public fixtures are synthetic. No raw chats/prompts/answers in run telemetry. Durable selected answers stay in private artifacts; personal source updates use Holoself's explicit workflow. |
| Performance/capacity | Guidance over 128 supplied entries completes within 100 ms p95 after inputs are loaded on the measured test machine. Exclude process startup/Holoself latency; report both separately. Enforce stated input/text budgets. |
| Reliability | Read-only requests write no files. Dry-run writes no files/audit. Idempotent mutations, stale revision rejection, and injected commit-failure recovery preserve pre-commit state and snapshots. |
| Observability | Report coverage and actionable error/reason codes. Timing/error telemetry contains counts/digests only. Do not claim semantic quality from a technical pass. |
| Operability | Update CLI docs, examples, skill guidance, and recovery notes with each surface change. Distribution drift blocks overwrites and leaves unrelated skills intact. |
| Compatibility/versioning | Optional contract additions preserve valid existing calls. Version new brief/review/submission shapes. No aliases, guessed conversions, or mandatory bulk migration of private history. Explicitly fail unsupported future versions. |
| Cost | Zero LLM calls from product code/tests. Default at most one optional question round per requested deliverable. Deeper coaching remains applicant-directed. |
| Usability/accessibility | One clear question by default, maximum three suggestions, explain consequence, allow free text/unknown/skip. Separate coaching language from deliverable language. Output usable as JSON or plain text without color dependence. |
| Maintainability/testability | Finite rule list, pure guidance tests, source fixtures for context behavior, schema validation, and documented extension criteria. No universal style assertions in deterministic tests. |
| Portability/environment | Node >=20 contract, Windows and Linux tests, mocked external CLI adapters. No live credentials or private workspaces in test execution. |

## Regression and experience scenarios

Use at least six clearly synthetic profiles spanning early career, experienced individual contributor, technical specialist, people manager, executive, and deliberate career changer. These are diversity checks, not substitutes for real-user research.

1. Identity, voice, preferences, claims, and positioning are available: standard context exposes useful coverage with exact sources; small context reports omissions explicitly.
2. Holoself is callable by a supported global installation but discovery differs by host: diagnose and repair adapter behavior using fixtures, without hardcoded checkout paths or repeated personal questions.
3. Applicant prefers a chronological summary and plain capabilities: no identity-pitch or table requirement is imposed.
4. Applicant requests an identity-led opening and domain table: preference survives three revisions and a restart without being re-asked.
5. Senior applicant deliberately chooses an individual-contributor move: one calibration conversation, no recurring seniority objection or automatic stop.
6. Employer scope is unknown: return research/recruiter action, not an applicant question requiring invented knowledge.
7. A letter changes to a motivation form: adapt to exact prompt/limit and invalidate only dependent format decisions/reviews.
8. A contact is a friend with unknown hiring authority: preserve warmth/language and avoid assuming referral or hiring power. No ApplicationAttempt required.
9. Applicant skips optional coaching and requests only a small edit: complete that edit with no new briefing gate or record.
10. A claim confuses team output with personal work: semantic review flags the attribution gap; no invented metric or automated persuasion score.
11. Undated submission with unknown artifacts: record once, expose undated count, reconcile date/channel/exact historical bytes later without double-counting.
12. Confirmed action occurred despite an unmet strategy gate: preserve both the reported event and the deviation; pre-action readiness still reports the gate.
13. Two clients revise a brief concurrently: the stale writer fails; no answer or snapshot is lost.
14. Interview/offer/reflection assistance works without generating unnecessary CVs, letters, strategies, or scheduled follow-ups.

Measure repeat-question count, corrective turns about already-known preferences, unsupported claims, wrong-format artifacts, context/command retries, and criterion-level review defects. Target zero repeated known-answer questions and zero invented evidence in the scripted suite. Compare semantic drafts against the S2 baseline with independent review; do not promise interview or offer gains.

## Quality gates, ADRs, and rollback

- Per slice: targeted tests plus relevant existing regression checks; show outputs and unresolved findings. No tests are run merely to validate this planning document.
- After contract/schema changes: check command catalog/schema examples and validate synthetic old/new records. Review unknown versus missing versus declined semantics explicitly.
- Before completion: `npm test`, `npm run check`, `git diff --check`, semantic scenario review, and `npm run skills:update` with verified library/deployed hashes. Scope and resolve distribution drift using `docs/skill-distribution.md`.
- ADRs required: (1) advisory guidance and personal-context ownership, (2) scoped brief Artifact persistence if S4 proceeds, (3) incomplete-event reconciliation and retrospective reporting versus pre-action strategy gates.
- Existing history is not automatically rewritten. Any migration discovered to be necessary requires a separate preview, snapshot, exact scope, and rollback rehearsal on synthetic data before private use.
- Rollback for context/skills: revert product sources, restore the validated package version through Skills Manager, and verify hashes. Do not overwrite drifted installations.
- Rollback for new data shapes: deploy readers before enabling new writers; preserve original records/snapshots. Once new evidence is written, disable new writes or fix forward on a compatible reader. Do not downgrade to a binary that cannot read that evidence or destructively flatten unknown states.
- Human/semantic review is required at S2 interaction design, S4 ownership, S5 review quality, and S6 event/strategy semantics. Advisor agreement is not implementation acceptance.

## Autonomous slice goal conditions

Commands below identify the slice tests, now implemented. Each run must show the command result and semantic evidence in the conversation. A turn bound means checkpoint and report, not mark incomplete work complete.

- **S1 (12 turns):** Bounded coverage and adapter diagnostics pass `node --test test/context-selection.test.mjs test/holoself-context.test.mjs` plus affected existing tests, exit 0. Preserve source semantics and external CLI boundary. Stop if assumptions 2, 3, or 5 fail.
- **S2 (10 turns):** Revised contracts/skills pass `node --test test/guidance-contracts.test.mjs` and a reported review of scenarios 3-10 and 14, including a zero-question path and contrasting applicant styles. No new durable state. Stop if instructions require a universal style or mandatory workflow.
- **S3 (12 turns):** `node --test test/guidance.test.mjs` proves bounded, deterministic, mutation-free guidance and command discovery, exit 0. Adopt the smallest viable contract after S2's scope check. Stop if this requires semantic prose scoring or executing user rules.
- **S4 (14 turns):** `node --test test/guidance-brief.test.mjs` proves authorized persistence, restart reuse, scope isolation, concurrency, and rollback, exit 0. Stay within existing Artifact storage. Stop if a new personal source of truth or new canonical collection is required.
- **S5 (10 turns):** `node --test test/artifact-review-evidence.test.mjs` proves criterion/lens preservation and relevant-input freshness, exit 0; external scenario review explains its findings. Stop if a technical pass is being substituted for semantic judgment.
- **S6 (16 turns):** `node --test test/submission-evidence.test.mjs` proves all precision/reconciliation/cohort/gate cases and exact snapshot preservation, exit 0. Stop if historical evidence must be destructively rewritten or recording an event cannot be separated from permission to act.
- **S7 (12 turns):** Full tests/checks pass, semantic comparison is reported, and skill update verifies library/deployed hashes. Show Windows/Linux scope and any host-discovery limits honestly. Stop on unresolved data loss, private-data leakage, or distribution ownership conflict.

## Stop conditions

Return for a scope decision if implementation requires an embedded LLM, native UI, another canonical personal store, unsupported Holoself contract changes, destructive history migration, or a general-purpose workflow/rule engine. Resolve integration failures before claiming complete personal context. Keep optional coaching optional even if a rubric would prefer more information.

## Approval

Implementation authorized by the user on 2026-09-30. See the implementation report for completion evidence and limitations.
