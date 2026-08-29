# Context

Use `nextstep context build --intent <intent> [--subject <typed-id>] [--strategy <strategy:id>] [--task <text>] [--budget small|standard|deep] --json`.

- Start with `small` or `standard`; use `deep` only when broader evidence is necessary.
- Omit `--strategy` when no strategy is required. The CLI may include active strategies explicitly related to the subject.
- Pass `--strategy` when the user selected a strategy and its structured instructions are relevant.
- A context packet is read-only evidence. It does not create a record, select a strategy, or authorize a mutation.
- Respect truncation flags and warnings. Do not fill missing evidence from assumption.
