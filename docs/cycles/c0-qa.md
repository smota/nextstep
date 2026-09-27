# C0 independent QA report

Date: 2026-09-19

Status: `passed`; ready for CO to decide C0-G.

## Candidate identity

| Item | Observed value |
|---|---|
| Git `HEAD` at final QA | `baae1363398b3ce668aea5a40659b5888a245a06` |
| C0 historical reference commit | `baae1363398b3ce668aea5a40659b5888a245a06` |
| `bin/nextstep.mjs` SHA-256 | `D0F54C08CB4C0F1A545B6EFFBD37EED6622AE47246A3A8ED6FE3851A9780D5D0` |
| Candidate fingerprint | `bdbcaae91ff47446529570afe9b212f2bf63803fbeee4c11d7cd29562489c5c8` |
| `scripts/c0-baseline.mjs` SHA-256 | `EC09860140A09A000942C522715E236FDFB6054812A394E2C52C1155B3F94166` |
| `test/c0-baseline.test.mjs` SHA-256 | `878032F047F7B5AA331646419112A39816A94353675573D4EB0E83521D319BE0` |
| `docs/cycles/c0-spec.md` SHA-256 | `8EA5FAA9CCD0BBC243C6A546A07FA04E0598DBCA3FBAA22DD413109359948BD7` |
| `docs/portable-product-spec.md` SHA-256 | `A12095C5164E0C469D67583A84F33D40DCEC0A7778658143AA27D0EA545ED54F` |
| `docs/cycles/c0-baseline.json` SHA-256 | `CF200C9CE6D3AA4A8BFEDED8A36D73BA1F45C81DEDC920CAEA5C890B589E5E86` |
| Effective automated environment | `win32 10.0.26200`; Node `v26.8.1`; Nextstep `2.0.0` |

The report labels the fixed commit and bin digest as historical references. Test success depends on capturing the candidate before and after execution, not on matching a hardcoded checkout hash. The final observed `HEAD` and bin digest above were checked independently after the test run.

## Automated results

| Command | Result |
|---|---|
| `node scripts/c0-baseline.mjs` | passed; C0-B01 through C0-B10 passed |
| `node --test test/c0-baseline.test.mjs` | 11 passed, 0 failed, 0 skipped |
| `npm test` | 44 passed, 0 failed, 0 skipped |
| `npm run check` | passed; capabilities returned `local-cli`, version `2.0.0` |

The saved evidence in `docs/cycles/c0-baseline.json` is semantically identical to a fresh standalone run. It contains ten passed cases, no absolute checkout/home/temp path, no synthetic poison value, and no execution-canary path.

| Case | Status | Observed oracle |
|---|---|---|
| C0-B01 | passed | Root-free `capabilities --json` exited 0 with interface and version. |
| C0-B02 | passed | Root discovery selected fixture A; CLI value and resolver label agreed. |
| C0-B03 | passed | Nested working directory selected fixture A. |
| C0-B04 | passed | Explicit argument selected fixture A over environment and ancestor fixture B. |
| C0-B05 | passed | Environment selected fixture A over ancestor fixture B. |
| C0-B06 | passed | Marker-free working directory produced `DATA_ROOT_REQUIRED` in CLI and resolver without tree change. |
| C0-B07 | passed | Unknown command exited 64 with `USAGE` and no tree change. |
| C0-B08 | passed | Named command produced spawn-level `ENOENT`; absolute Node plus candidate bin exited 0. |
| C0-B09 | passed | Checked-in skill source and references were inventoried; host discovery stayed `not_run`. |
| C0-B10 | passed | Direct external and junction roots were rejected by the actual product wrapper and shared spawn guard; external teardown was rejected; sentinel remained and execution canary was absent. |

## Independent negative coverage

- Mixed-case inherited `NEXTSTEP_*` variables are removed on Windows. PATH is absent unless a case supplies its controlled value. A poisoned standalone process still produced B06 `DATA_ROOT_REQUIRED`, and poison values did not enter evidence.
- The exported product wrapper derives `--data-root` from the real argv and rejects a direct external root, junction escape, repeated operand, relative operand, and metadata mismatch before spawning.
- The actual teardown guard rejects suite equality, an external sibling, missing/wrong/linked ownership markers, and a root replaced by a junction. It deletes a valid owned descendant.
- Read-only tree hashing changes when only an empty directory is created. This closes the false-positive in which an unexpected empty `.nextstep/` directory could have gone undetected.
- Fixture A and B use the same entity ID with different names, so precedence assertions cannot pass merely because either fixture contains the requested ID.

## Limits and C0 decisions

- Q-01: `not_reproduced`. The original incident still lacks the host, version, prompt, start directory, expected result, and observed result. The synthetic corpus does not establish its cause.
- Q-02: the observed automated row is limited to Windows build 26200, Node 26.8.1, and Nextstep 2.0.0. It does not establish macOS, Linux, IDE, or other host support.
- Q-06: the deterministic initial corpus C0-B01 through C0-B10 is executable and passed with bounded evidence.
- H-01 has supporting evidence for a tooling/discovery distinction: the controlled PATH probe could not resolve `nextstep`, while the absolute candidate invocation worked. This is not a root-cause conclusion for the original incident.
- H-02 remains indeterminate. B09 proves source inventory only; it does not measure skill discovery or activation.
- A fresh Codex CLI observation supplied by CO found no resolvable `nextstep` command and no Nextstep skill. The Anti-Gravity permission probe was auto-denied and remains `tooling_denied`/`not_run`. These external observations are separate from the passed product cases.

QA accessed only public product files and synthetic system-temp fixtures. It did not read the private vault or `.tmp/`, install tools or skills, alter product behavior, or change the preserved `bin/nextstep.mjs` bytes. QA-owned writes are the independent test additions, the sanitized evidence, and this report. Final C0-G ownership remains with CO.
