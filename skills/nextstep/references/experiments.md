# Experiments

Experiments compare measured cohorts associated with one or more strategies. They do not manufacture events or outcomes.

Read with `experiment list`, `experiment get --id`, or `experiment evaluate --id`. Manage with `experiment create`, `experiment update`, and `experiment set-status`, using the standard mutation envelope.

Lifecycle is `draft -> running -> paused -> running|completed|abandoned`; a draft may also be abandoned. Closing requires a conclusion. Updates and status changes require `expectedRevision`.

Every experiment has a hypothesis, at least one existing Strategy, named cohorts with explicit selection rules, and metrics. Attribute confirmed execution only while the Experiment is running, using `strategyIds`, `experimentId`, and a valid `cohortId`. Evaluation includes only confirmed events and reports cohorts separately.

Never present a small or immature cohort as causal proof. Record conclusions as user-reviewed interpretation.
