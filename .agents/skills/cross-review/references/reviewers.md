# Reviewers

Used in step 2 and step 4. Shell syntax is POSIX, tested in Git Bash on Windows. Each command reads the brief from a file the skill wrote outside the repository, and runs from the repository root.

| Reviewer | Read-only invocation | Status (checked 2026-09-21) |
|---|---|---|
| Claude Code | `claude -p --permission-mode plan --model opus --effort high < brief.md` | Verified end to end with claude 2.1.263: reviewed a toy diff and found all three planted defects. |
| Codex | `codex exec -s read-only - < brief.md` (add `-o <file>` to save the last message) | Invocation accepted by codex-cli 0.154.0. The model call failed on an account usage limit, so no review completed. |
| pi | `pi -p --provider <provider> --model <id> --tools read,grep,find,ls @brief.md "Follow the review brief."` | Not verified with pi 0.85.1. Without `--provider`, `--model sonnet` resolved to a provider with no key. With an explicit provider it produced no output in 240 seconds. |

## Rules

- Confirm the invocation with the CLI's own help before first use, and again whenever it fails or the CLI version differs from the table.
- Pass the brief on stdin or as a file. A long brief on the command line fails on quoting and length.
- `--permission-mode plan` and `-s read-only` restrict edits, and a reviewer can still run commands, so the repository snapshot in step 4 is the check that read-only held.
- Sign in to the reviewer's provider before the run. A missing key, a usage limit, or a timeout is a failed review, and the report records it as one.
- Independence needs a different harness and a different vendor or model family than the author's. Pair a Claude author with Codex or pi on another vendor's model, and the reverse.
