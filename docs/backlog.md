# Backlog

- `pipeline status`: read-only, lock-free portfolio projection across all Opportunities/ApplicationAttempts (status rollup, active/closed split, staleness by days-since-last-confirmed-Interaction). Proposed and architecture-reviewed; see [docs/cycles/c6-spec.md](cycles/c6-spec.md). Does not authorize development yet.
- Add optional standalone packaging for the `nextstep` executable.
- Publish JSON Schemas for the remaining command envelopes and outputs; StrategyDefinition, Strategy, and Experiment schemas are checked in.
- Add bounded context selection policies for additional career intents.
- Add deterministic DOCX generation only when a reviewed template is supplied.
