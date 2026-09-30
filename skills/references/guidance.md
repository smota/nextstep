# Adaptive applicant guidance

Use this conversation loop for analysis, drafting, networking, interview preparation, and decisions. Enter at the user's requested outcome; a single edit needs no intake ceremony.

1. Retrieve applicable context, including voice, preferences, positioning, and evidence. Inspect coverage and source warnings. Repair unavailable context before asking the applicant to repeat information. Finish when the relevant evidence and genuine unknowns are distinguished.
2. Check the intended outcome, audience, role mandate, and real channel where relevant. Research employer facts first. Use `guidance --input - --json` for reusable gap and suppression rules; `command describe --command guidance --json` defines its input. Finish when each consequential gap has the right answerer or can remain unknown.
3. Ask one useful question by default, at most three related questions. Explain what the answer changes. Allow free text, unknown, skip, or a delegable “use your judgment.” One optional round per deliverable is enough unless the applicant engages in deeper refinement. Zero questions is valid. Continue independent work while waiting; no answer is not approval.
4. Apply known answers and preferences without asking again. Respect declined/deferred items until their relevant input changes, and explain the change before revisiting. Keep technical failures, applicant choices, and unknown employer facts separate.
5. Draft for the chosen channel and applicant. A chronological summary, identity pitch, plain capability list, domain table, brief motivation answer, and relationship message are legitimate choices. Use evidence to support the contribution. Articles express a perspective; projects do not establish measured employer results by themselves.
6. Review against the actual request: contribution, claim attribution, audience/channel, relevant preferences, and known gaps. Give criterion evidence and separate lens findings through `artifact record-review`; narrative judgment remains yours. Applicant acceptance, structural QA, visual QA, and transmission are distinct. Follow the user's visual-QA preference.

## Useful questions

- Career trade-off: “Would this move still interest you without people or budget ownership?” Respect deliberate changes of direction.
- Contribution: “What should the reader understand about your contribution after the first paragraph?”
- Evidence: “What did you personally do, and what changed?”
- Relationship: “How do you know this person, and what would you like the conversation to achieve?”
- Interview: “Which example can you explain concretely under follow-up questions?”
- Decision: “Has this opportunity met the conditions you said mattered?”

Unknown reporting lines, budgets, and hiring authority belong to research or recruiter questions. An inaccessible form may justify an applicant question about the format. Keep coaching language separate from the requested deliverable language.

## Continuity and authorization

Use conversational answers immediately within scope. Save selected answers only when the task authorizes recording or the applicant requests durable reuse, using `guidance record --input -`. The command creates/revises a private brief Artifact, not a conversation transcript. Read the command contract before constructing a payload. Scope exceptions to the opportunity, person, or artifact; campaign reuse needs an explicit brief reference. Factual conflicts remain visible.

Stable identity/voice updates go through Holoself's public proposal/review workflow. Nextstep does not keep a second self. A skipped question is not a fact, a recommendation is not a decision, and a draft is not an event. Guidance never requires a Strategy or ApplicationAttempt.

When a user confirms an application with incomplete details, preserve the event and explicit unknowns through `application-attempt record-submission`. Use retrospective mode only for an already-reported event; it does not authorize submission. Reconcile later against exact historical artifacts, not whichever files are current.
