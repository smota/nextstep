# C2 environment record

Observed on 2026-09-24. This record separates deterministic fixture results from host observations.

| Component | Observed |
|---|---|
| OS | Microsoft Windows 11 Pro |
| PowerShell | 7.6.5 |
| Node.js | 26.10.0; product minimum remains 20 |
| npm | 11.19.1 |
| Git | 2.55.0.windows.3 |
| Anti-Gravity CLI | `agy` 1.2.10; model `Gemini 3.8 Flash (Low)` |
| Codex CLI | 0.154.0; model selected by host `gpt-6-astra`, low reasoning |

## Host discovery probes

Both probes used a new synthetic workspace outside the product and private instance. The workspace contained only a synthetic `AGENTS.md` and `.agents/skills` junction created by `integration link`. No PATH or private data was supplied.

- Anti-Gravity with `--new-project` listed exactly `nextstep`: `host_listed = passed`, `host_activated = not_run`. A run without project creation loaded an unrelated existing project context and was discarded as invalid evidence.
- Codex CLI with `--skip-git-repo-check`, a new session, and read-only sandbox returned an empty workspace skill list: `host_listed = failed`, `host_activated = not_run`.

C2 therefore proves the generic workspace junction and technical discovery in Anti-Gravity CLI only. Codex 0.154 requires a host-specific linked adapter in C3; no support claim is made from filesystem visibility alone.

The probes were unlinked and their fixed temporary roots removed after the observation.
