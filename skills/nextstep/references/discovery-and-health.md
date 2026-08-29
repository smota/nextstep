# Discovery and health

Use `nextstep capabilities --json` before relying on a command family whose installed version is unknown. It is read-only and does not need a data root.

Use `nextstep doctor --json` to verify the selected vault, recovery state, relational model, strategy catalog, and Holoself integration. A degraded result is evidence, not authorization to repair or initialize state.

If `doctor` reports `MODEL_INCOMPLETE` with migration command `strategy initialize`, explain the required explicit mutation. Do not create `strategies.json` or `experiments.json` directly.

Treat executable identity and the returned capability contract as authoritative. Unknown commands or options must fail with `USAGE`; do not retry with guessed aliases.
